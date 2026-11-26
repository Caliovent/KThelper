import fs from 'node:fs';
import path from 'node:path';
import type { League, MatchMode } from '../../domain/types';
import type { Rating } from '../../engines/mp/glicko2';
import type { Run } from '../../engines/mp/match';
import type { Unit } from '../../engines/mp/scoring';
import type { SignedReceipt } from './crypto';

export type MatchState =
  | 'created'
  | 'waiting_opponent'
  | 'awaiting_second_run'
  | 'live'
  | 'settling'
  | 'settled'
  | 'cancelled'
  | 'expired';

export interface DbPlayer {
  id: string;
  pseudo: string;
  emailHash: string;
  adultAttestedAt: string;
  createdAt: string;
  deletedAt: string | null;
}

export interface DbRating {
  playerId: string;
  league: League;
  season: number;
  r: number;
  rd: number;
  sigma: number;
  matches: number;
  lastMatchAt: string | null;
}

export interface DbSeries {
  id: string;
  seed: string;
  corpusVersion: string;
  generatorVersion: string;
  rulesVersion: string;
  templateIds: string[];
}

export interface DbMatch {
  id: string;
  mode: MatchMode;
  league: League;
  seriesId: string;
  state: MatchState;
  season: number;
  createdAt: string;
  createdAtMs: number;
  expiresAtMs: number | null;
  settledAt: string | null;
  dailyKey: string | null;
  creatorId: string;
  opponentId: string | null;
  receipt: SignedReceipt | null;
}

export interface DbRun {
  id: string;
  matchId: string;
  playerId: string;
  engineRun: Run;
  openedAtMs: Record<number, number>;
  openKeys: Record<number, { key: string; response: unknown }>;
  totalPd: number | null;
  perfects: number | null;
  totalMs: number | null;
  ratingBefore: Rating | null;
  ratingAfter: Rating | null;
  flags: string[];
}

export interface DbAttempt {
  runId: string;
  spotIndex: number;
  action: string | null;
  serverMs: number;
  clientMs: number | null;
  pd: number;
  loss: number | null;
  lossUnit: Unit | null;
  timeout: boolean;
  idempotencyKey: string;
}

export interface DbDaily {
  dailyKey: string;
  seriesId: string;
  secretSeed: string;
  seedCommitment: string;
  opensAtMs: number;
  closesAtMs: number;
  revealedAt: string | null;
  compositionLabel: string;
}

export interface DbDailyEntry {
  dailyKey: string;
  playerId: string;
  runId: string;
  createdAt: string;
}

export interface DbAuthLink {
  token: string;
  emailHash: string;
  pseudo: string;
  adultAttestedAt: string;
  expiresAtMs: number;
  usedAtMs: number | null;
}

export interface DbSession {
  token: string;
  playerId: string;
  expiresAtMs: number;
}

export interface DbSnapshot {
  currentSeason: number;
  seasonTheme: string;
  players: DbPlayer[];
  ratings: DbRating[];
  series: DbSeries[];
  matches: DbMatch[];
  runs: DbRun[];
  attempts: DbAttempt[];
  dailies: DbDaily[];
  dailyEntries: DbDailyEntry[];
  authLinks: DbAuthLink[];
  sessions: DbSession[];
  forfeitTimestampsByPlayer: Record<string, number[]>;
  linkRateLimits: Record<string, number[]>;
}

export class MpStore {
  public currentSeason: number;
  public seasonTheme: string;
  public readonly players = new Map<string, DbPlayer>();
  public readonly ratings = new Map<string, DbRating>(); // key = `${playerId}:${league}:${season}`
  public readonly series = new Map<string, DbSeries>();
  public readonly matches = new Map<string, DbMatch>();
  public readonly runs = new Map<string, DbRun>();
  public readonly attempts = new Map<string, DbAttempt>(); // key = `${runId}:${spotIndex}`
  public readonly attemptByIdempotency = new Map<string, DbAttempt>();
  public readonly dailies = new Map<string, DbDaily>();
  public readonly dailyEntries = new Map<string, DbDailyEntry>(); // key = `${dailyKey}:${playerId}`
  public readonly authLinks = new Map<string, DbAuthLink>();
  public readonly sessions = new Map<string, DbSession>();
  public readonly forfeitTimestampsByPlayer = new Map<string, number[]>();
  public readonly linkRateLimits = new Map<string, number[]>();

  private readonly matchLocks = new Map<string, Promise<void>>();
  private readonly persistPath: string | null;

  constructor(opts: { currentSeason: number; seasonTheme: string; persistPath?: string | null }) {
    this.currentSeason = opts.currentSeason;
    this.seasonTheme = opts.seasonTheme;
    this.persistPath = opts.persistPath ?? null;
    if (this.persistPath) {
      this.loadFromDisk();
    }
  }

  public ratingKey(playerId: string, league: League, season: number): string {
    return `${playerId}:${league}:${season}`;
  }

  public attemptKey(runId: string, spotIndex: number): string {
    return `${runId}:${spotIndex}`;
  }

  public dailyEntryKey(dailyKey: string, playerId: string): string {
    return `${dailyKey}:${playerId}`;
  }

  /** Verrou FIFO par matchId : garantit qu'un règlement concurrent ne s'applique qu'une seule fois (MP-15). */
  public async withMatchLock<T>(matchId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.matchLocks.get(matchId) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const chained = prev.then(() => gate);
    this.matchLocks.set(matchId, chained);
    await prev;
    try {
      return await fn();
    } finally {
      release();
      if (this.matchLocks.get(matchId) === chained) {
        this.matchLocks.delete(matchId);
      }
    }
  }

  public save(): void {
    if (!this.persistPath) return;
    const snap: DbSnapshot = {
      currentSeason: this.currentSeason,
      seasonTheme: this.seasonTheme,
      players: Array.from(this.players.values()),
      ratings: Array.from(this.ratings.values()),
      series: Array.from(this.series.values()),
      matches: Array.from(this.matches.values()),
      runs: Array.from(this.runs.values()),
      attempts: Array.from(this.attempts.values()),
      dailies: Array.from(this.dailies.values()),
      dailyEntries: Array.from(this.dailyEntries.values()),
      authLinks: Array.from(this.authLinks.values()),
      sessions: Array.from(this.sessions.values()),
      forfeitTimestampsByPlayer: Object.fromEntries(this.forfeitTimestampsByPlayer.entries()),
      linkRateLimits: Object.fromEntries(this.linkRateLimits.entries()),
    };
    const dir = path.dirname(this.persistPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tmp = `${this.persistPath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(snap), 'utf8');
    fs.renameSync(tmp, this.persistPath);
  }

  private loadFromDisk(): void {
    if (!this.persistPath || !fs.existsSync(this.persistPath)) return;
    try {
      const raw = fs.readFileSync(this.persistPath, 'utf8');
      const snap = JSON.parse(raw) as DbSnapshot;
      this.currentSeason = snap.currentSeason ?? this.currentSeason;
      this.seasonTheme = snap.seasonTheme ?? this.seasonTheme;
      snap.players?.forEach((p) => this.players.set(p.id, p));
      snap.ratings?.forEach((r) => this.ratings.set(this.ratingKey(r.playerId, r.league, r.season), r));
      snap.series?.forEach((s) => this.series.set(s.id, s));
      snap.matches?.forEach((m) => this.matches.set(m.id, m));
      snap.runs?.forEach((r) => this.runs.set(r.id, r));
      snap.attempts?.forEach((a) => {
        this.attempts.set(this.attemptKey(a.runId, a.spotIndex), a);
        this.attemptByIdempotency.set(a.idempotencyKey, a);
      });
      snap.dailies?.forEach((d) => this.dailies.set(d.dailyKey, d));
      snap.dailyEntries?.forEach((e) => this.dailyEntries.set(this.dailyEntryKey(e.dailyKey, e.playerId), e));
      snap.authLinks?.forEach((l) => this.authLinks.set(l.token, l));
      snap.sessions?.forEach((s) => this.sessions.set(s.token, s));
      Object.entries(snap.forfeitTimestampsByPlayer ?? {}).forEach(([k, v]) =>
        this.forfeitTimestampsByPlayer.set(k, v)
      );
      Object.entries(snap.linkRateLimits ?? {}).forEach(([k, v]) =>
        this.linkRateLimits.set(k, v)
      );
    } catch (err) {
      console.warn('[MpStore] Impossible de recharger le snapshot disque:', err);
    }
  }
}
