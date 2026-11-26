import fs from 'node:fs';
import path from 'node:path';
import type { League, MatchMode } from '../../domain/types';
import type { BossId, BossPhase } from '../../engines/mp/boss';
import type { Rating } from '../../engines/mp/glicko2';
import type { Run } from '../../engines/mp/match';
import type { Unit } from '../../engines/mp/scoring';
import type { SharedHand } from '../../engines/mp/share';
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

export interface DbReviewCase {
  id: string;
  playerId: string;
  matchId: string;
  signals: { kind: string; severity: 'low' | 'medium'; summary: string }[];
  status: 'open' | 'dismissed' | 'warned' | 'annulled';
  createdAt: string;
  appealNote: string | null;
  appealedAt: string | null;
  decision: 'dismiss' | 'warn_player' | 'annul_match_recalc_mmr' | null;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionReason: string | null;
}

export interface DbReviewAuditEntry {
  id: string;
  caseId: string;
  actor: string;
  action: 'open_signal' | 'appeal' | 'dismiss' | 'warn_player' | 'annul_match_recalc_mmr';
  reason: string;
  at: string;
  mmrChanged: boolean;
}

export interface DbStable {
  id: string;
  name: string;
  createdAt: string;
}

export interface DbStableMember {
  stableId: string;
  playerId: string;
  role: 'owner' | 'captain' | 'member';
  joinedAt: string;
}

export interface DbStableWeeklyMemberContribution {
  stableId: string;
  weekKey: string;
  playerId: string;
  skillKeys: string[];
  cappedCount: number;
}

export interface DbSharedHand {
  id: string;
  stableId: string;
  hand: SharedHand;
  tags: string[];
  question: string;
  votesByPlayer: Record<string, 'fold' | 'check' | 'call' | 'bet' | 'raise'>;
  createdDay: string;
}

export interface DbRaidRun {
  raidId: string;
  playerId: string;
  variantOrderIds: string[];
  started: boolean;
  finished: boolean;
  forfeited: boolean;
  decisions: {
    handIndex: number;
    decisionIndex: number;
    phase: BossPhase;
    pd: number;
    action: string;
    idempotencyKey: string;
  }[];
}

export interface DbRaid {
  id: string;
  stableId: string;
  bossId: BossId;
  state: 'open' | 'closed';
  roster: string[];
  opensAt: string;
  closesAtMs: number;
  closesAt: string;
  highlights: { authorId: string; handIndex: number; decisionIndex: number; label: string }[];
}

export interface DbPrivateTournament {
  id: string;
  stableId: string;
  name: string;
  seriesId: string;
  createdAt: string;
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
  reviewCases: DbReviewCase[];
  reviewAuditLog: DbReviewAuditEntry[];
  stables: DbStable[];
  stableMembers: DbStableMember[];
  stableWeeklyContribs: DbStableWeeklyMemberContribution[];
  sharedHands: DbSharedHand[];
  raids: DbRaid[];
  raidRuns: DbRaidRun[];
  privateTournaments: DbPrivateTournament[];
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
  public readonly reviewCases = new Map<string, DbReviewCase>();
  public readonly reviewAuditLog: DbReviewAuditEntry[] = [];
  public readonly stables = new Map<string, DbStable>();
  public readonly stableMembers = new Map<string, DbStableMember>(); // key = playerId (1 écurie max par joueur)
  public readonly stableWeeklyContribs = new Map<string, DbStableWeeklyMemberContribution>(); // key = `${stableId}:${weekKey}:${playerId}`
  public readonly sharedHands = new Map<string, DbSharedHand>();
  public readonly raids = new Map<string, DbRaid>();
  public readonly raidRuns = new Map<string, DbRaidRun>(); // key = `${raidId}:${playerId}`
  public readonly privateTournaments = new Map<string, DbPrivateTournament>();
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
      reviewCases: Array.from(this.reviewCases.values()),
      reviewAuditLog: [...this.reviewAuditLog],
      stables: Array.from(this.stables.values()),
      stableMembers: Array.from(this.stableMembers.values()),
      stableWeeklyContribs: Array.from(this.stableWeeklyContribs.values()),
      sharedHands: Array.from(this.sharedHands.values()),
      raids: Array.from(this.raids.values()),
      raidRuns: Array.from(this.raidRuns.values()),
      privateTournaments: Array.from(this.privateTournaments.values()),
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
      snap.reviewCases?.forEach((c) => this.reviewCases.set(c.id, c));
      if (Array.isArray(snap.reviewAuditLog)) {
        this.reviewAuditLog.push(...snap.reviewAuditLog);
      }
      snap.stables?.forEach((s) => this.stables.set(s.id, s));
      snap.stableMembers?.forEach((m) => this.stableMembers.set(m.playerId, m));
      snap.stableWeeklyContribs?.forEach((c) =>
        this.stableWeeklyContribs.set(`${c.stableId}:${c.weekKey}:${c.playerId}`, c)
      );
      snap.sharedHands?.forEach((h) => this.sharedHands.set(h.id, h));
      snap.raids?.forEach((r) => this.raids.set(r.id, r));
      snap.raidRuns?.forEach((rr) => this.raidRuns.set(`${rr.raidId}:${rr.playerId}`, rr));
      snap.privateTournaments?.forEach((pt) => this.privateTournaments.set(pt.id, pt));
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
