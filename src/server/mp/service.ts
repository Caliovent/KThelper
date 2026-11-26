import crypto from 'node:crypto';
import type { League, PlayerAttemptRecord, SpotPublic } from '../../domain/types';
import {
  ANTI_TILT,
  AUTH_LIMITS,
  DAILY_L1,
  GHOST_RANKED,
  GLICKO,
  RULES_VERSION,
  SEASON_CONFIG,
} from '../../engines/mp/config';
import { dayKey, medals, trapSpot } from '../../engines/mp/daily';
import { DIVISION_LABELS, division, expected, update, type Gates, type Rating } from '../../engines/mp/glicko2';
import { GRACE_MS, newRun, reduce } from '../../engines/mp/match';
import { rngFrom, shuffle } from '../../engines/mp/rng';
import {
  compareForBoard,
  detectTimingAnomaly,
  ratedOutcome,
  scoreSolution,
  totals,
  turningPoints,
  type SpotScore,
} from '../../engines/mp/scoring';
import {
  computeAllRounderRating,
  displayDivision,
  isProvisional,
  rolloverSeasonRating,
} from '../../engines/mp/seasons';
import { selectSeries } from '../../engines/mp/series';
import {
  L1_CORPUS_BY_ID,
  L1_CORPUS_VERSION,
  L1_GENERATOR_VERSION,
  L1_MATHS_ICM_CORPUS,
  toStrictPublicSpot,
  verifyL1CorpusTruth,
  type L1CorpusTemplate,
} from './corpusL1';
import {
  computeDailyCommitment,
  createReceiptSigner,
  deriveDailySecretSeed,
  hashEmail,
  type ReceiptSigner,
  type SignedReceipt,
} from './crypto';
import {
  MpStore,
  type DbAttempt,
  type DbDaily,
  type DbMatch,
  type DbPlayer,
  type DbRating,
  type DbRun,
} from './store';

export class MpHttpError extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export interface MpServiceOptions {
  store?: MpStore;
  now?: () => number;
  masterSecret?: string;
  signer?: ReceiptSigner;
  exposeDevAuthToken?: boolean;
}

export interface RunOpenSpotResult {
  spotIndex: number;
  spot: SpotPublic;
  deadline: string;
  serverNow: string;
  limitMs: number;
  ghostProgressSpot: number | null;
}

export interface RunAnswerSpotResult {
  locked: true;
  spotIndex: number;
  nextSpotIndex: number | null;
  runPhase: 'ready' | 'done' | 'forfeit';
  matchState: DbMatch['state'];
}

export class MpService {
  public readonly store: MpStore;
  public readonly signer: ReceiptSigner;
  private readonly now: () => number;
  private readonly masterSecret: string;
  private readonly exposeDevAuthToken: boolean;

  constructor(opts: MpServiceOptions = {}) {
    verifyL1CorpusTruth(L1_MATHS_ICM_CORPUS);
    this.store =
      opts.store ??
      new MpStore({
        currentSeason: SEASON_CONFIG.currentSeason,
        seasonTheme: SEASON_CONFIG.theme,
        persistPath: null,
      });
    this.now = opts.now ?? (() => Date.now());
    this.masterSecret = opts.masterSecret ?? (process.env.MP_MASTER_SECRET || 'dev-local-mp-master-secret');
    this.signer = opts.signer ?? createReceiptSigner();
    this.exposeDevAuthToken =
      opts.exposeDevAuthToken ??
      (process.env.MP_DEV_AUTH === '1' || process.env.NODE_ENV !== 'production');
  }

  private nowIso(): string {
    return new Date(this.now()).toISOString();
  }

  private getOrInitRating(playerId: string, league: League, season = this.store.currentSeason): DbRating {
    const key = this.store.ratingKey(playerId, league, season);
    const existing = this.store.ratings.get(key);
    if (existing) return existing;
    const fresh: DbRating = {
      playerId,
      league,
      season,
      r: GLICKO.r0,
      rd: GLICKO.rd0,
      sigma: GLICKO.sigma0,
      matches: 0,
      lastMatchAt: null,
    };
    this.store.ratings.set(key, fresh);
    return fresh;
  }

  private toRating(row: DbRating): Rating {
    return { r: row.r, rd: row.rd, sigma: row.sigma };
  }

  // ===========================================================================
  // MP-12 : Auth, Comptes, Export & Suppression RGPD
  // ===========================================================================

  public requestAuthLink(input: {
    email: string;
    pseudo: string;
    adultAttested: true;
  }): { accepted: true; expiresInSec: number; devLinkToken?: string } {
    const t = this.now();
    const emailHash = hashEmail(input.email, this.masterSecret);

    // Rate limit par emailHash
    const prevHits = (this.store.linkRateLimits.get(emailHash) ?? []).filter(
      (ts) => t - ts < AUTH_LIMITS.linkWindowMs
    );
    if (prevHits.length >= AUTH_LIMITS.linkMaxPerWindow) {
      throw new MpHttpError(429, 'rate_limited', 'Trop de demandes de connexion. Patientez une minute.');
    }
    prevHits.push(t);
    this.store.linkRateLimits.set(emailHash, prevHits);

    // Unicité du pseudo (sauf si même utilisateur actif)
    const normalizedPseudo = input.pseudo.trim();
    for (const p of this.store.players.values()) {
      if (!p.deletedAt && p.pseudo.toLowerCase() === normalizedPseudo.toLowerCase() && p.emailHash !== emailHash) {
        throw new MpHttpError(409, 'pseudo_taken', 'Ce pseudo est déjà utilisé par un autre compte.');
      }
    }

    const token = crypto.randomBytes(24).toString('base64url');
    this.store.authLinks.set(token, {
      token,
      emailHash,
      pseudo: normalizedPseudo,
      adultAttestedAt: new Date(t).toISOString(),
      expiresAtMs: t + 15 * 60 * 1000,
      usedAtMs: null,
    });
    this.store.save();

    return {
      accepted: true,
      expiresInSec: 900,
      ...(this.exposeDevAuthToken ? { devLinkToken: token } : {}),
    };
  }

  public exchangeAuthLink(linkToken: string): {
    sessionToken: string;
    player: { id: string; pseudo: string; createdAt: string; adultAttestedAt: string };
  } {
    const t = this.now();
    const link = this.store.authLinks.get(linkToken);
    if (!link || link.usedAtMs !== null || link.expiresAtMs < t) {
      throw new MpHttpError(401, 'invalid_link', 'Lien de connexion invalide ou expiré.');
    }
    link.usedAtMs = t;

    let player: DbPlayer | undefined;
    for (const p of this.store.players.values()) {
      if (!p.deletedAt && p.emailHash === link.emailHash) {
        player = p;
        break;
      }
    }

    if (!player) {
      for (const p of this.store.players.values()) {
        if (!p.deletedAt && p.pseudo.toLowerCase() === link.pseudo.toLowerCase()) {
          throw new MpHttpError(409, 'pseudo_taken', 'Ce pseudo vient d’être réservé.');
        }
      }
      player = {
        id: crypto.randomUUID(),
        pseudo: link.pseudo,
        emailHash: link.emailHash,
        adultAttestedAt: link.adultAttestedAt,
        createdAt: new Date(t).toISOString(),
        deletedAt: null,
      };
      this.store.players.set(player.id, player);
      this.getOrInitRating(player.id, 'maths_icm');
    }

    const sessionToken = crypto.randomBytes(32).toString('base64url');
    this.store.sessions.set(sessionToken, {
      token: sessionToken,
      playerId: player.id,
      expiresAtMs: t + AUTH_LIMITS.sessionTtlMs,
    });
    this.store.save();

    return {
      sessionToken,
      player: {
        id: player.id,
        pseudo: player.pseudo,
        createdAt: player.createdAt,
        adultAttestedAt: player.adultAttestedAt,
      },
    };
  }

  public authenticateBearer(authHeader: string | undefined): DbPlayer {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new MpHttpError(401, 'unauthorized', 'Authentification L1 requise.');
    }
    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      throw new MpHttpError(401, 'unauthorized', 'Jeton de session L1 manquant.');
    }
    const session = this.store.sessions.get(token);
    if (!session || session.expiresAtMs < this.now()) {
      throw new MpHttpError(401, 'unauthorized', 'Session L1 expirée ou invalide.');
    }
    const player = this.store.players.get(session.playerId);
    if (!player || player.deletedAt) {
      throw new MpHttpError(401, 'account_deleted', 'Compte supprimé ou introuvable.');
    }
    return player;
  }

  public getMe(playerId: string, declaredGates?: Partial<Gates>) {
    const player = this.store.players.get(playerId);
    if (!player || player.deletedAt) {
      throw new MpHttpError(404, 'not_found', 'Joueur introuvable.');
    }
    const gates: Gates = {
      mastery: Math.min(100, Math.max(0, Number(declaredGates?.mastery ?? 60))),
      bossValidated: Boolean(declaredGates?.bossValidated),
      retention7dVerified: Boolean(declaredGates?.retention7dVerified),
    };
    const leagues: League[] = ['maths_icm', 'cash', 'mtt_icm', 'expresso'];
    const ratingsOut: Record<
      string,
      { r: number; rd: number; sigma: number; matches: number; provisional: boolean; division: { id: string; label: string } }
    > = {};
    for (const lg of leagues) {
      const row = this.getOrInitRating(player.id, lg);
      const rat = this.toRating(row);
      const div = displayDivision(row.r, gates);
      ratingsOut[lg] = {
        r: Math.round(row.r * 100) / 100,
        rd: Math.round(row.rd * 100) / 100,
        sigma: Math.round(row.sigma * 100000) / 100000,
        matches: row.matches,
        provisional: isProvisional(rat, row.matches),
        division: { id: div.id, label: div.label },
      };
    }

    const allRounder = computeAllRounderRating({
      cash: this.toRating(this.getOrInitRating(player.id, 'cash')),
      mtt_icm: this.toRating(this.getOrInitRating(player.id, 'mtt_icm')),
      expresso: this.toRating(this.getOrInitRating(player.id, 'expresso')),
    });

    const myRuns = Array.from(this.store.runs.values()).filter((r) => r.playerId === player.id);
    const matchesSummary = myRuns.map((run) => {
      const match = this.store.matches.get(run.matchId);
      const oppRun = match
        ? Array.from(this.store.runs.values()).find((r) => r.matchId === match.id && r.playerId !== player.id)
        : undefined;
      const oppPlayer = oppRun ? this.store.players.get(oppRun.playerId) : undefined;
      return {
        matchId: run.matchId,
        runId: run.id,
        mode: match?.mode ?? 'ghost_duel',
        league: match?.league ?? 'maths_icm',
        state: match?.state ?? 'settled',
        season: match?.season ?? this.store.currentSeason,
        createdAt: match?.createdAt ?? null,
        settledAt: match?.settledAt ?? null,
        expiresAt: match?.expiresAtMs ? new Date(match.expiresAtMs).toISOString() : null,
        opponentPseudo: oppPlayer ? oppPlayer.pseudo : null,
        runPhase: run.engineRun.phase.s,
        lockedCount: run.engineRun.locked.length,
        totalSpots: run.engineRun.n,
        // Règle anti-fuite : totalPd visible uniquement si le match est settled OU si c'est un run Daily déjà terminé
        ...(match?.state === 'settled' || (match?.mode === 'daily_top' && run.engineRun.phase.s === 'done')
          ? { totalPd: run.totalPd, perfects: run.perfects, totalMs: run.totalMs }
          : {}),
      };
    });

    const cooldownUntil = this.getForfeitCooldownUntil(player.id);

    return {
      player: {
        id: player.id,
        pseudo: player.pseudo,
        createdAt: player.createdAt,
        adultAttestedAt: player.adultAttestedAt,
      },
      season: {
        currentSeason: this.store.currentSeason,
        theme: this.store.seasonTheme,
      },
      ratings: ratingsOut,
      allRounder,
      forfeitCooldownUntil: cooldownUntil ? new Date(cooldownUntil).toISOString() : null,
      matches: matchesSummary,
      retentionNotice: 'Tentatives L1 conservées 24 mois max ; suppression efface l’identité et anonymise vos matchs pour autrui.',
      exportGeneratedAt: this.nowIso(),
    };
  }

  /** Suppression RGPD (Bible p.33 & MP-12) : efface l'identité et révoque les sessions, anonymise les résultats nécessaires aux matchs d'autrui. */
  public deleteMe(playerId: string): { deleted: true; anonymizedPseudo: string; deletedAt: string } {
    const player = this.store.players.get(playerId);
    if (!player || player.deletedAt) {
      throw new MpHttpError(404, 'not_found', 'Compte déjà supprimé ou inexistant.');
    }
    const deletedAt = this.nowIso();
    const anonymizedPseudo = `Joueur_supprime_${player.id.slice(0, 8)}`;
    player.deletedAt = deletedAt;
    player.emailHash = `deleted:${crypto.randomBytes(32).toString('hex')}`;
    player.pseudo = anonymizedPseudo;

    for (const [token, sess] of this.store.sessions.entries()) {
      if (sess.playerId === playerId) this.store.sessions.delete(token);
    }
    for (const [token, link] of this.store.authLinks.entries()) {
      if (link.pseudo === player.pseudo) this.store.authLinks.delete(token);
    }
    this.store.forfeitTimestampsByPlayer.delete(playerId);
    this.store.save();

    return { deleted: true, anonymizedPseudo, deletedAt };
  }

  // ===========================================================================
  // MP-16 : Expiration, Appariement Ghost Classé & Plafond 3 matchs / 30 jours
  // ===========================================================================

  public expireStaleMatches(): number {
    const t = this.now();
    let count = 0;
    for (const m of this.store.matches.values()) {
      if (
        (m.state === 'created' || m.state === 'waiting_opponent' || m.state === 'awaiting_second_run') &&
        m.expiresAtMs !== null &&
        t >= m.expiresAtMs
      ) {
        m.state = 'expired';
        count++;
      }
    }
    if (count > 0) this.store.save();
    return count;
  }

  private getForfeitCooldownUntil(playerId: string): number | null {
    const t = this.now();
    const stamps = (this.store.forfeitTimestampsByPlayer.get(playerId) ?? []).filter(
      (ts) => t - ts <= ANTI_TILT.forfeitWindowMs
    );
    this.store.forfeitTimestampsByPlayer.set(playerId, stamps);
    if (stamps.length >= ANTI_TILT.maxForfeitsInWindow) {
      const latest = Math.max(...stamps);
      const until = latest + ANTI_TILT.cooldownMs;
      return until > t ? until : null;
    }
    return null;
  }

  private countPairMatchesInWindow(playerA: string, playerB: string): number {
    const cutoff = this.now() - GHOST_RANKED.pairWindowMs;
    let count = 0;
    for (const m of this.store.matches.values()) {
      if (m.mode !== 'ghost_duel') continue;
      if (m.createdAtMs < cutoff) continue;
      if (m.state === 'cancelled' || m.state === 'expired') continue;
      const involvesPair =
        (m.creatorId === playerA && m.opponentId === playerB) ||
        (m.creatorId === playerB && m.opponentId === playerA);
      if (involvesPair) count++;
    }
    return count;
  }

  private getSeenTemplatesLast14Days(playerIds: readonly string[]): Set<string> {
    const cutoff = this.now() - GHOST_RANKED.antiRepeatMs;
    const seen = new Set<string>();
    const playerSet = new Set(playerIds);
    for (const run of this.store.runs.values()) {
      if (!playerSet.has(run.playerId)) continue;
      const match = this.store.matches.get(run.matchId);
      if (!match || match.createdAtMs < cutoff) continue;
      const ser = this.store.series.get(match.seriesId);
      ser?.templateIds.forEach((id) => seen.add(id));
    }
    return seen;
  }

  public async enqueueGhostRanked(
    playerId: string,
    league: League,
    opts?: { targetMatchId?: string }
  ): Promise<{
    matchId: string;
    runId: string;
    role: 'creator' | 'challenger';
    league: League;
    state: DbMatch['state'];
    spotCount: number;
    opponent: { pseudo: string; mmr: number } | null;
  }> {
    this.expireStaleMatches();
    const player = this.store.players.get(playerId);
    if (!player || player.deletedAt) throw new MpHttpError(401, 'unauthorized', 'Joueur invalide.');

    if (league !== 'maths_icm') {
      throw new MpHttpError(
        409,
        'league_closed',
        'Seule la ligue Maths & ICM est ouverte en classé L1 tant qu’aucun export solveur relu n’est chargé.'
      );
    }

    const cooldownUntil = this.getForfeitCooldownUntil(playerId);
    if (cooldownUntil) {
      throw new MpHttpError(
        429,
        'cooldown',
        `File classée suspendue 15 minutes suite à 2 forfaits en 1 heure (jusqu’à ${new Date(cooldownUntil).toLocaleTimeString('fr-FR')}).`
      );
    }

    // Si un match précis est ciblé
    if (opts?.targetMatchId) {
      return this.joinGhostMatch(playerId, opts.targetMatchId);
    }

    // Recherche d'un Ghost en attente compatible (autre joueur, < 3 matchs en 30 jours)
    const candidates = Array.from(this.store.matches.values())
      .filter(
        (m) =>
          m.mode === 'ghost_duel' &&
          m.league === league &&
          m.state === 'awaiting_second_run' &&
          m.season === this.store.currentSeason &&
          m.creatorId !== playerId &&
          m.opponentId === null &&
          (m.expiresAtMs === null || m.expiresAtMs > this.now())
      )
      .sort((a, b) => a.createdAtMs - b.createdAtMs);

    for (const candidate of candidates) {
      if (this.countPairMatchesInWindow(playerId, candidate.creatorId) < GHOST_RANKED.maxPairMatchesInWindow) {
        return this.joinGhostMatch(playerId, candidate.id);
      }
    }

    // Création d'un nouveau Ghost classé par le joueur A
    const seed = crypto.randomBytes(16).toString('hex');
    const seen = this.getSeenTemplatesLast14Days([playerId]);
    const filteredPool = L1_MATHS_ICM_CORPUS.filter((t) => !seen.has(t.id));

    let picked: L1CorpusTemplate[];
    try {
      picked = await selectSeries(
        filteredPool,
        GHOST_RANKED.spotCount,
        seed,
        L1_CORPUS_VERSION,
        L1_GENERATOR_VERSION,
        true
      );
    } catch (err) {
      throw new MpHttpError(
        409,
        'pool_too_small',
        err instanceof Error ? err.message : 'Pool anti-répétition 14 jours insuffisant.'
      );
    }

    const seriesId = crypto.randomUUID();
    this.store.series.set(seriesId, {
      id: seriesId,
      seed,
      corpusVersion: L1_CORPUS_VERSION,
      generatorVersion: L1_GENERATOR_VERSION,
      rulesVersion: RULES_VERSION,
      templateIds: picked.map((t) => t.id),
    });

    const t = this.now();
    const matchId = crypto.randomUUID();
    const runId = crypto.randomUUID();
    const ratingA = this.getOrInitRating(playerId, league);
    const frozenA = this.toRating(ratingA);

    const match: DbMatch = {
      id: matchId,
      mode: 'ghost_duel',
      league,
      seriesId,
      state: 'created',
      season: this.store.currentSeason,
      createdAt: new Date(t).toISOString(),
      createdAtMs: t,
      expiresAtMs: t + GHOST_RANKED.expiryMs,
      settledAt: null,
      dailyKey: null,
      creatorId: playerId,
      opponentId: null,
      receipt: null,
    };

    const run: DbRun = {
      id: runId,
      matchId,
      playerId,
      engineRun: newRun(picked.map((x) => x.public.limitMs)),
      openedAtMs: {},
      openKeys: {},
      totalPd: null,
      perfects: null,
      totalMs: null,
      ratingBefore: frozenA,
      ratingAfter: null,
      flags: [],
    };

    this.store.matches.set(matchId, match);
    this.store.runs.set(runId, run);
    this.store.save();

    return {
      matchId,
      runId,
      role: 'creator',
      league,
      state: match.state,
      spotCount: picked.length,
      opponent: null,
    };
  }

  public joinGhostMatch(playerId: string, matchId: string): {
    matchId: string;
    runId: string;
    role: 'challenger';
    league: League;
    state: DbMatch['state'];
    spotCount: number;
    opponent: { pseudo: string; mmr: number };
  } {
    this.expireStaleMatches();
    const match = this.store.matches.get(matchId);
    if (!match) throw new MpHttpError(404, 'not_found', 'Match introuvable.');
    if (match.state === 'expired') throw new MpHttpError(409, 'expired', 'Ce défi Ghost a expiré (48 h).');
    if (match.state !== 'awaiting_second_run' || match.opponentId !== null) {
      throw new MpHttpError(409, 'not_available', 'Ce match n’est plus disponible pour un appariement.');
    }
    if (match.creatorId === playerId) {
      throw new MpHttpError(403, 'not_participant', 'Impossible d’affronter son propre Ghost.');
    }

    const cooldownUntil = this.getForfeitCooldownUntil(playerId);
    if (cooldownUntil) {
      throw new MpHttpError(429, 'cooldown', 'File classée suspendue 15 min après 2 forfaits en 1 h.');
    }

    if (this.countPairMatchesInWindow(playerId, match.creatorId) >= GHOST_RANKED.maxPairMatchesInWindow) {
      throw new MpHttpError(
        409,
        'pair_limit_reached',
        'Plafond atteint : maximum 3 matchs classés entre les deux mêmes comptes sur 30 jours glissants.'
      );
    }

    const ser = this.store.series.get(match.seriesId);
    if (!ser) throw new MpHttpError(500, 'series_missing', 'Série introuvable.');
    const templates = ser.templateIds.map((id) => {
      const tpl = L1_CORPUS_BY_ID.get(id);
      if (!tpl) throw new MpHttpError(500, 'template_missing', `Gabarit manquant: ${id}`);
      return tpl;
    });

    const creator = this.store.players.get(match.creatorId);
    const creatorRun = Array.from(this.store.runs.values()).find(
      (r) => r.matchId === match.id && r.playerId === match.creatorId
    );
    const frozenCreator = creatorRun?.ratingBefore ?? this.toRating(this.getOrInitRating(match.creatorId, match.league));
    const ratingB = this.toRating(this.getOrInitRating(playerId, match.league));

    const runId = crypto.randomUUID();
    const runB: DbRun = {
      id: runId,
      matchId: match.id,
      playerId,
      engineRun: newRun(templates.map((t) => t.public.limitMs)),
      openedAtMs: {},
      openKeys: {},
      totalPd: null,
      perfects: null,
      totalMs: null,
      ratingBefore: ratingB,
      ratingAfter: null,
      flags: [],
    };

    match.opponentId = playerId;
    match.state = 'live';
    this.store.runs.set(runId, runB);
    this.store.save();

    return {
      matchId: match.id,
      runId,
      role: 'challenger',
      league: match.league,
      state: match.state,
      spotCount: templates.length,
      opponent: {
        pseudo: creator?.pseudo ?? 'Adversaire',
        mmr: Math.round(frozenCreator.r),
      },
    };
  }

  public listAvailableGhosts(playerId: string, league: League) {
    this.expireStaleMatches();
    return Array.from(this.store.matches.values())
      .filter(
        (m) =>
          m.mode === 'ghost_duel' &&
          m.league === league &&
          m.state === 'awaiting_second_run' &&
          m.creatorId !== playerId &&
          m.opponentId === null &&
          this.countPairMatchesInWindow(playerId, m.creatorId) < GHOST_RANKED.maxPairMatchesInWindow
      )
      .map((m) => {
        const creator = this.store.players.get(m.creatorId);
        const creatorRating = this.getOrInitRating(m.creatorId, m.league, m.season);
        return {
          matchId: m.id,
          league: m.league,
          creatorPseudo: creator?.pseudo ?? 'Anonyme',
          creatorMmr: Math.round(creatorRating.r),
          createdAt: m.createdAt,
          expiresAt: m.expiresAtMs ? new Date(m.expiresAtMs).toISOString() : null,
        };
      });
  }

  // ===========================================================================
  // MP-13 : Runs autoritaires, Horloges, Idempotence & Zéro fuite avant révélation
  // ===========================================================================

  private validateLegalAction(template: L1CorpusTemplate, action: string): void {
    const st = template.public.state;
    if (st.kind === 'estimate') {
      const n = Number(action);
      if (!Number.isFinite(n) || n < st.min || n > st.max) {
        throw new MpHttpError(400, 'illegal_action', `Estimation hors bornes [${st.min}..${st.max}].`);
      }
      return;
    }
    if (st.kind === 'decision' || st.kind === 'texture') {
      if (!st.options.some((o) => o.id === action)) {
        throw new MpHttpError(400, 'illegal_action', 'Action inexistante pour ce spot.');
      }
      return;
    }
    throw new MpHttpError(400, 'illegal_action', 'Type de spot non supporté en L1.');
  }

  private computeGhostProgressSpot(match: DbMatch, run: DbRun, t: number): number | null {
    if (match.mode !== 'ghost_duel') return null;
    const oppRun = Array.from(this.store.runs.values()).find(
      (r) => r.matchId === match.id && r.playerId !== run.playerId
    );
    if (!oppRun || oppRun.engineRun.locked.length === 0) return null;
    const runStart = run.openedAtMs[0] ?? t;
    const elapsedSinceStart = Math.max(0, t - runStart);
    let oppCum = 0;
    let doneCount = 0;
    for (const l of oppRun.engineRun.locked) {
      oppCum += l.elapsedMs + 600; // inclut ~600ms de transition entre spots
      if (oppCum <= elapsedSinceStart + 100) doneCount++;
    }
    return doneCount;
  }

  public openSpot(
    playerId: string,
    runId: string,
    spotIndex: number,
    idempotencyKey: string
  ): RunOpenSpotResult {
    const run = this.store.runs.get(runId);
    if (!run) throw new MpHttpError(404, 'not_found', 'Run introuvable.');
    if (run.playerId !== playerId) {
      throw new MpHttpError(403, 'forbidden', 'Accès interdit au run d’un autre joueur.');
    }
    const match = this.store.matches.get(run.matchId);
    if (!match) throw new MpHttpError(404, 'not_found', 'Match introuvable.');
    if (match.state === 'expired' || match.state === 'cancelled' || match.state === 'settled') {
      throw new MpHttpError(409, 'run_closed', 'Ce match est fermé ou terminé.');
    }

    const existingOpen = run.openKeys[spotIndex];
    if (existingOpen && existingOpen.key === idempotencyKey) {
      return existingOpen.response as RunOpenSpotResult;
    }

    const phase = run.engineRun.phase;
    if (phase.s === 'done' || phase.s === 'forfeit') {
      throw new MpHttpError(409, 'run_closed', 'Ce run est déjà terminé.');
    }
    if (phase.s !== 'ready' || phase.i !== spotIndex) {
      throw new MpHttpError(409, 'out_of_order', `Spot attendu : #${phase.i}.`);
    }

    const ser = this.store.series.get(match.seriesId);
    if (!ser) throw new MpHttpError(500, 'series_missing', 'Série introuvable.');
    const templateId = ser.templateIds[spotIndex];
    const template = templateId ? L1_CORPUS_BY_ID.get(templateId) : undefined;
    if (!template) throw new MpHttpError(500, 'template_missing', 'Gabarit introuvable.');

    const t = this.now();
    run.engineRun = reduce(run.engineRun, { t: 'OPEN', i: spotIndex, now: t });
    run.openedAtMs[spotIndex] = t;

    const newPhase = run.engineRun.phase;
    const deadlineMs = newPhase.s === 'open' ? newPhase.deadline : t + template.public.limitMs;

    const response: RunOpenSpotResult = {
      spotIndex,
      spot: toStrictPublicSpot(template, spotIndex),
      deadline: new Date(deadlineMs).toISOString(),
      serverNow: new Date(t).toISOString(),
      limitMs: template.public.limitMs,
      ghostProgressSpot: this.computeGhostProgressSpot(match, run, t),
    };
    run.openKeys[spotIndex] = { key: idempotencyKey, response };
    this.store.save();
    return response;
  }

  public async answerSpot(
    playerId: string,
    runId: string,
    spotIndex: number,
    input: { action: string; clientMs: number; key: string }
  ): Promise<RunAnswerSpotResult> {
    const run = this.store.runs.get(runId);
    if (!run) throw new MpHttpError(404, 'not_found', 'Run introuvable.');
    if (run.playerId !== playerId) {
      throw new MpHttpError(403, 'forbidden', 'Accès interdit au run d’un autre joueur.');
    }
    const match = this.store.matches.get(run.matchId);
    if (!match) throw new MpHttpError(404, 'not_found', 'Match introuvable.');

    // Idempotence stricte par clé UUID
    const existingAttempt = this.store.attempts.get(this.store.attemptKey(runId, spotIndex));
    if (existingAttempt) {
      if (existingAttempt.idempotencyKey === input.key) {
        const p = run.engineRun.phase;
        return {
          locked: true,
          spotIndex,
          nextSpotIndex: p.s === 'ready' ? p.i : null,
          runPhase: p.s === 'done' ? 'done' : p.s === 'forfeit' ? 'forfeit' : 'ready',
          matchState: match.state,
        };
      }
      throw new MpHttpError(409, 'not_open', 'Ce spot est déjà verrouillé.');
    }

    const phase = run.engineRun.phase;
    if (phase.s === 'done' || phase.s === 'forfeit') {
      throw new MpHttpError(409, 'run_closed', 'Ce run est fermé.');
    }
    if (phase.s !== 'open' || phase.i !== spotIndex) {
      throw new MpHttpError(409, 'not_open', 'Ce spot n’est pas ouvert.');
    }

    const ser = this.store.series.get(match.seriesId);
    if (!ser) throw new MpHttpError(500, 'series_missing', 'Série introuvable.');
    const template = L1_CORPUS_BY_ID.get(ser.templateIds[spotIndex]);
    if (!template) throw new MpHttpError(500, 'template_missing', 'Gabarit introuvable.');

    // Valider la légalité de l'action avant de verrouiller
    this.validateLegalAction(template, input.action);

    const t = this.now();
    const openedAt = run.openedAtMs[spotIndex] ?? t;
    const rawServerElapsed = Math.max(0, t - openedAt);
    const isTimeout = t > phase.deadline + GRACE_MS;

    run.engineRun = reduce(run.engineRun, {
      t: 'ANSWER',
      i: spotIndex,
      action: input.action,
      now: t,
    });

    const lockedEntry = run.engineRun.locked[run.engineRun.locked.length - 1];
    const scored = scoreSolution(
      template.solution,
      isTimeout ? null : input.action,
      lockedEntry.elapsedMs,
      template.public.limitMs,
      false,
      true
    );

    const attempt: DbAttempt = {
      runId,
      spotIndex,
      action: isTimeout ? null : input.action,
      serverMs: Math.min(template.public.limitMs, rawServerElapsed),
      clientMs: input.clientMs,
      pd: scored.score.pd,
      loss: scored.score.loss,
      lossUnit: scored.lossUnit,
      timeout: scored.score.timeout,
      idempotencyKey: input.key,
    };

    this.store.attempts.set(this.store.attemptKey(runId, spotIndex), attempt);
    this.store.attemptByIdempotency.set(input.key, attempt);

    if (run.engineRun.phase.s === 'done') {
      await this.finalizeCompletedRun(match, run);
    }

    this.store.save();
    const nextPhase = run.engineRun.phase;
    return {
      locked: true,
      spotIndex,
      nextSpotIndex: nextPhase.s === 'ready' ? nextPhase.i : null,
      runPhase: nextPhase.s === 'done' ? 'done' : nextPhase.s === 'forfeit' ? 'forfeit' : 'ready',
      matchState: match.state,
    };
  }

  private computeRunTotals(runId: string, limitCount: number): {
    scores: SpotScore[];
    totals: { pd: number; perfects: number; ms: number };
    records: PlayerAttemptRecord[];
  } {
    const scores: SpotScore[] = [];
    const records: PlayerAttemptRecord[] = [];
    for (let i = 0; i < limitCount; i++) {
      const a = this.store.attempts.get(this.store.attemptKey(runId, i));
      if (!a) {
        scores.push({ loss: 300, pd: 300, perfect: false, timeout: true, countedMs: 0 });
        records.push({
          spotIndex: i,
          actionChosen: null,
          elapsedMs: 0,
          usedHint: false,
          loss: 300,
          lossUnit: null,
          pd: 300,
          timeout: true,
        });
      } else {
        scores.push({
          loss: a.loss ?? a.pd,
          pd: a.pd,
          perfect: a.pd === 0,
          timeout: a.timeout,
          countedMs: a.serverMs,
        });
        records.push({
          spotIndex: i,
          actionChosen: a.action,
          elapsedMs: a.serverMs,
          usedHint: false,
          loss: a.loss,
          lossUnit: a.lossUnit,
          pd: a.pd,
          timeout: a.timeout,
        });
      }
    }
    return { scores, totals: totals(scores), records };
  }

  private async finalizeCompletedRun(match: DbMatch, run: DbRun): Promise<void> {
    const computed = this.computeRunTotals(run.id, run.engineRun.n);
    run.totalPd = computed.totals.pd;
    run.perfects = computed.totals.perfects;
    run.totalMs = computed.totals.ms;

    const anomaly = detectTimingAnomaly(
      computed.records.map((r) => ({ elapsedMs: r.elapsedMs, pd: r.pd }))
    );
    if (anomaly.flagged && !run.flags.includes('timing_review')) {
      run.flags.push('timing_review');
    }

    if (match.mode === 'ghost_duel') {
      const allRuns = Array.from(this.store.runs.values()).filter((r) => r.matchId === match.id);
      if (allRuns.length === 1 && match.state === 'created') {
        match.state = 'awaiting_second_run';
        match.expiresAtMs = this.now() + GHOST_RANKED.expiryMs;
      } else if (
        allRuns.length === 2 &&
        allRuns.every((r) => r.engineRun.phase.s === 'done' || r.engineRun.phase.s === 'forfeit')
      ) {
        await this.settleMatchOnce(match.id);
      }
    }
  }

  public async forfeitRun(
    playerId: string,
    runId: string,
    _idempotencyKey: string
  ): Promise<{ matchState: DbMatch['state']; runPhase: 'forfeit'; cancelledNoMmr: boolean }> {
    const run = this.store.runs.get(runId);
    if (!run) throw new MpHttpError(404, 'not_found', 'Run introuvable.');
    if (run.playerId !== playerId) {
      throw new MpHttpError(403, 'forbidden', 'Accès interdit au run d’un autre joueur.');
    }
    const match = this.store.matches.get(run.matchId);
    if (!match) throw new MpHttpError(404, 'not_found', 'Match introuvable.');

    if (run.engineRun.phase.s === 'forfeit') {
      return {
        matchState: match.state,
        runPhase: 'forfeit',
        cancelledNoMmr: match.state === 'cancelled',
      };
    }
    if (run.engineRun.phase.s === 'done') {
      throw new MpHttpError(409, 'run_closed', 'Run déjà terminé.');
    }

    const noSpotOpenedYet =
      run.engineRun.locked.length === 0 &&
      run.engineRun.phase.s === 'ready' &&
      Object.keys(run.openedAtMs).length === 0;

    run.engineRun = reduce(run.engineRun, { t: 'FORFEIT' });

    if (noSpotOpenedYet && match.mode === 'ghost_duel' && match.opponentId === null) {
      match.state = 'cancelled';
      this.store.save();
      return { matchState: match.state, runPhase: 'forfeit', cancelledNoMmr: true };
    }

    // Journalisation anti-tilt (>= 1 spot ouvert)
    const t = this.now();
    const list = (this.store.forfeitTimestampsByPlayer.get(playerId) ?? []).filter(
      (ts) => t - ts <= ANTI_TILT.forfeitWindowMs
    );
    list.push(t);
    this.store.forfeitTimestampsByPlayer.set(playerId, list);

    const allRuns = Array.from(this.store.runs.values()).filter((r) => r.matchId === match.id);
    if (allRuns.length === 2 && allRuns.every((r) => r.engineRun.phase.s === 'forfeit')) {
      match.state = 'cancelled';
      allRuns.forEach((r) => r.flags.push('mutual_forfeit'));
      this.store.save();
      return { matchState: match.state, runPhase: 'forfeit', cancelledNoMmr: true };
    }

    if (match.mode === 'ghost_duel' && match.opponentId === null) {
      // Créateur abandonne avant appariement -> match annulé sans effet MMR
      match.state = 'cancelled';
      this.store.save();
      return { matchState: match.state, runPhase: 'forfeit', cancelledNoMmr: true };
    }

    if (
      allRuns.length === 2 &&
      allRuns.every((r) => r.engineRun.phase.s === 'done' || r.engineRun.phase.s === 'forfeit')
    ) {
      await this.settleMatchOnce(match.id);
    }
    this.store.save();
    return {
      matchState: match.state,
      runPhase: 'forfeit',
      cancelledNoMmr: match.state === 'cancelled',
    };
  }

  // ===========================================================================
  // MP-15 : Règlement atomique Glicko-2 + Reçu Ed25519
  // ===========================================================================

  public async settleMatchOnce(matchId: string): Promise<SignedReceipt> {
    return this.store.withMatchLock(matchId, async () => {
      const match = this.store.matches.get(matchId);
      if (!match) throw new MpHttpError(404, 'not_found', 'Match introuvable.');
      if (match.state === 'settled' && match.receipt) {
        return match.receipt;
      }
      if (match.state === 'cancelled' || match.state === 'expired') {
        throw new MpHttpError(409, 'match_closed', 'Match annulé ou expiré.');
      }

      const runs = Array.from(this.store.runs.values()).filter((r) => r.matchId === matchId);
      if (runs.length !== 2) {
        throw new MpHttpError(409, 'not_ready', 'Deux runs sont requis pour régler le match.');
      }
      const runA = runs.find((r) => r.playerId === match.creatorId) ?? runs[0];
      const runB = runs.find((r) => r.playerId !== runA.playerId) ?? runs[1];
      if (
        (runA.engineRun.phase.s !== 'done' && runA.engineRun.phase.s !== 'forfeit') ||
        (runB.engineRun.phase.s !== 'done' && runB.engineRun.phase.s !== 'forfeit')
      ) {
        throw new MpHttpError(409, 'not_ready', 'Les deux runs ne sont pas terminés.');
      }

      match.state = 'settling';

      const compA = this.computeRunTotals(runA.id, runA.engineRun.n);
      const compB = this.computeRunTotals(runB.id, runB.engineRun.n);
      runA.totalPd = compA.totals.pd;
      runA.perfects = compA.totals.perfects;
      runA.totalMs = compA.totals.ms;
      runB.totalPd = compB.totals.pd;
      runB.perfects = compB.totals.perfects;
      runB.totalMs = compB.totals.ms;

      let outcomeA: 0 | 0.5 | 1;
      if (runA.engineRun.phase.s === 'forfeit' && runB.engineRun.phase.s === 'done') {
        outcomeA = 0;
      } else if (runB.engineRun.phase.s === 'forfeit' && runA.engineRun.phase.s === 'done') {
        outcomeA = 1;
      } else {
        outcomeA = ratedOutcome(compA.totals, compB.totals);
      }
      const outcomeB: 0 | 0.5 | 1 = outcomeA === 1 ? 0 : outcomeA === 0 ? 1 : 0.5;

      const curA = this.getOrInitRating(runA.playerId, match.league, match.season);
      const curB = this.getOrInitRating(runB.playerId, match.league, match.season);

      const frozenA = runA.ratingBefore ?? this.toRating(curA);
      const frozenB = runB.ratingBefore ?? this.toRating(curB);

      const nextFrozenA = update(frozenA, [{ opp: frozenB, score: outcomeA }]);
      const nextFrozenB = update(frozenB, [{ opp: frozenA, score: outcomeB }]);

      // Application du delta aux notes courantes (pour les Ghosts concurrents)
      const deltaRA = nextFrozenA.r - frozenA.r;
      const deltaRB = nextFrozenB.r - frozenB.r;

      const nowIso = this.nowIso();
      curA.r = Math.round((curA.r + deltaRA) * 100) / 100;
      curA.rd = Math.round(nextFrozenA.rd * 100) / 100;
      curA.sigma = nextFrozenA.sigma;
      curA.matches += 1;
      curA.lastMatchAt = nowIso;

      curB.r = Math.round((curB.r + deltaRB) * 100) / 100;
      curB.rd = Math.round(nextFrozenB.rd * 100) / 100;
      curB.sigma = nextFrozenB.sigma;
      curB.matches += 1;
      curB.lastMatchAt = nowIso;

      runA.ratingBefore = frozenA;
      runA.ratingAfter = { r: curA.r, rd: curA.rd, sigma: curA.sigma };
      runB.ratingBefore = frozenB;
      runB.ratingAfter = { r: curB.r, rd: curB.rd, sigma: curB.sigma };

      const pA = this.store.players.get(runA.playerId);
      const pB = this.store.players.get(runB.playerId);

      const receipt = this.signer.signReceipt({
        schemaVersion: 1,
        matchId: match.id,
        league: match.league,
        season: match.season,
        settledAt: nowIso,
        rulesVersion: RULES_VERSION,
        corpusVersion: L1_CORPUS_VERSION,
        outcomeA,
        playerA: {
          id: runA.playerId,
          pseudo: pA?.pseudo ?? 'Joueur A',
          pd: compA.totals.pd,
          ratingBefore: Math.round(frozenA.r * 100) / 100,
          ratingAfter: curA.r,
        },
        playerB: {
          id: runB.playerId,
          pseudo: pB?.pseudo ?? 'Joueur B',
          pd: compB.totals.pd,
          ratingBefore: Math.round(frozenB.r * 100) / 100,
          ratingAfter: curB.r,
        },
      });

      match.receipt = receipt;
      match.settledAt = nowIso;
      match.state = 'settled';
      this.store.save();
      return receipt;
    });
  }

  public getMatchResult(playerId: string, matchId: string) {
    const match = this.store.matches.get(matchId);
    if (!match) throw new MpHttpError(404, 'not_found', 'Match introuvable.');
    if (match.creatorId !== playerId && match.opponentId !== playerId) {
      throw new MpHttpError(403, 'not_participant', 'Accès refusé : vous ne participez pas à ce match.');
    }
    if (match.state !== 'settled' || !match.receipt) {
      throw new MpHttpError(409, 'not_settled', 'Le match n’est pas encore réglé.');
    }

    const runs = Array.from(this.store.runs.values()).filter((r) => r.matchId === match.id);
    const heroRun = runs.find((r) => r.playerId === playerId);
    const oppRun = runs.find((r) => r.playerId !== playerId);
    if (!heroRun || !oppRun) throw new MpHttpError(500, 'runs_missing', 'Runs manquants.');

    const ser = this.store.series.get(match.seriesId);
    if (!ser) throw new MpHttpError(500, 'series_missing', 'Série manquante.');

    const heroComp = this.computeRunTotals(heroRun.id, heroRun.engineRun.n);
    const oppComp = this.computeRunTotals(oppRun.id, oppRun.engineRun.n);
    const tps = turningPoints(heroComp.scores, oppComp.scores);
    const oppPlayer = this.store.players.get(oppRun.playerId);

    const spotsDetail = ser.templateIds.map((id, i) => {
      const tpl = L1_CORPUS_BY_ID.get(id)!;
      return {
        spotIndex: i,
        templateId: id,
        skillId: tpl.skillId,
        family: tpl.family,
        question: tpl.public.state.kind === 'estimate' ? tpl.public.state.question : tpl.id,
        assumptions: tpl.public.state.kind === 'estimate' ? tpl.public.state.assumptions : [],
        solution: tpl.solution,
        provenance: tpl.provenance,
        explanationId: tpl.explanationId,
        explanationText: tpl.explanationText,
        heroAttempt: heroComp.records[i],
        oppAttempt: oppComp.records[i],
      };
    });

    return {
      matchId: match.id,
      league: match.league,
      season: match.season,
      settledAt: match.settledAt,
      opponentPseudo: oppPlayer?.pseudo ?? 'Adversaire',
      heroTotals: heroComp.totals,
      oppTotals: oppComp.totals,
      heroScores: heroComp.scores,
      oppScores: oppComp.scores,
      heroRatingBefore: heroRun.ratingBefore,
      heroRatingAfter: heroRun.ratingAfter,
      turningPoints: tps,
      spots: spotsDetail,
      receipt: match.receipt,
      receiptVerified: this.signer.verifyReceipt(match.receipt),
    };
  }

  // ===========================================================================
  // MP-17 : Daily Top Officiel (Engagement, Essai unique, Clôture différée, Spot Piège >= 30)
  // ===========================================================================

  private async ensureTodayDaily(): Promise<DbDaily> {
    const t = this.now();
    const key = dayKey(t);
    const existing = this.store.dailies.get(key);
    if (existing) return existing;

    const secretSeed = deriveDailySecretSeed(this.masterSecret, key);
    const rng = await rngFrom(secretSeed, L1_CORPUS_VERSION, L1_GENERATOR_VERSION, 'daily-top-l1');
    const b1 = shuffle(
      rng,
      L1_MATHS_ICM_CORPUS.filter((tpl) => tpl.family === 'pot_odds_exact' || tpl.family === 'outs_turn_river')
    ).slice(0, 5);
    const b2 = shuffle(
      rng,
      L1_MATHS_ICM_CORPUS.filter((tpl) => tpl.family === 'combos_blockers')
    ).slice(0, 5);
    const b3 = shuffle(
      rng,
      L1_MATHS_ICM_CORPUS.filter(
        (tpl) => tpl.family === 'icm_equity' || tpl.family === 'icm_bubble_factor' || tpl.family === 'pko_bounty_call'
      )
    ).slice(0, 5);

    const templateIds = [...b1, ...b2, ...b3].map((x) => x.id);
    const seriesId = crypto.randomUUID();
    this.store.series.set(seriesId, {
      id: seriesId,
      seed: key,
      corpusVersion: L1_CORPUS_VERSION,
      generatorVersion: L1_GENERATOR_VERSION,
      rulesVersion: RULES_VERSION,
      templateIds,
    });

    const d = new Date(t);
    const opensAtMs = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0);
    const closesAtMs = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999);

    const daily: DbDaily = {
      dailyKey: key,
      seriesId,
      secretSeed,
      seedCommitment: computeDailyCommitment(secretSeed, templateIds),
      opensAtMs,
      closesAtMs,
      revealedAt: null,
      compositionLabel:
        'Parcours Repli Maths & ICM : 5 Échauffement (Cotes/Outs) • 5 Lecture (Combos/Bloqueurs) • 5 Pression (ICM/PKO)',
    };
    this.store.dailies.set(key, daily);
    this.store.save();
    return daily;
  }

  public async getDailyCurrent(playerId?: string) {
    const daily = await this.ensureTodayDaily();
    const t = this.now();
    const entries = Array.from(this.store.dailyEntries.values()).filter((e) => e.dailyKey === daily.dailyKey);

    const boardRows = entries
      .map((entry) => {
        const run = this.store.runs.get(entry.runId);
        const p = this.store.players.get(entry.playerId);
        if (!run || run.engineRun.phase.s !== 'done' || run.flags.includes('timing_review')) return null;
        const comp = this.computeRunTotals(run.id, run.engineRun.n);
        return {
          playerId: entry.playerId,
          pseudo: p?.pseudo ?? 'Anonyme',
          totals: comp.totals,
          medals: medals(comp.scores, DAILY_L1.spotCount),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => compareForBoard(a.totals, b.totals));

    const myEntry = playerId ? this.store.dailyEntries.get(this.store.dailyEntryKey(daily.dailyKey, playerId)) : undefined;
    const myRun = myEntry ? this.store.runs.get(myEntry.runId) : undefined;
    const myRankIndex = playerId ? boardRows.findIndex((r) => r.playerId === playerId) : -1;

    let myProvisionalSummary: null | {
      totalPd: number;
      perfects: number;
      totalMs: number;
      provisionalRank: number | null;
      medals: string[];
      weakFamilies: string[];
    } = null;

    if (myRun && myRun.engineRun.phase.s === 'done') {
      const ser = this.store.series.get(daily.seriesId)!;
      const comp = this.computeRunTotals(myRun.id, myRun.engineRun.n);
      const familyPd = new Map<string, number>();
      ser.templateIds.forEach((tid, i) => {
        const fam = L1_CORPUS_BY_ID.get(tid)?.family ?? 'maths';
        familyPd.set(fam, (familyPd.get(fam) ?? 0) + comp.scores[i].pd);
      });
      const weakFamilies = Array.from(familyPd.entries())
        .filter(([, pd]) => pd > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([fam]) => fam);

      myProvisionalSummary = {
        totalPd: comp.totals.pd,
        perfects: comp.totals.perfects,
        totalMs: comp.totals.ms,
        provisionalRank: myRankIndex >= 0 ? myRankIndex + 1 : null,
        medals: medals(comp.scores, DAILY_L1.spotCount),
        weakFamilies,
      };
    }

    return {
      dailyKey: daily.dailyKey,
      seedCommitment: daily.seedCommitment,
      opensAt: new Date(daily.opensAtMs).toISOString(),
      closesAt: new Date(daily.closesAtMs).toISOString(),
      closed: daily.revealedAt !== null || t > daily.closesAtMs,
      revealed: daily.revealedAt !== null,
      revealedAt: daily.revealedAt,
      compositionLabel: daily.compositionLabel,
      spotCount: DAILY_L1.spotCount,
      alreadyPlayed: Boolean(myEntry),
      myRunId: myRun?.id ?? null,
      myRunPhase: myRun?.engineRun.phase.s ?? null,
      myProvisionalSummary,
      leaderboard: boardRows.map((row, idx) => ({
        rank: idx + 1,
        pseudo: row.pseudo,
        pd: row.totals.pd,
        perfects: row.totals.perfects,
        timeTenths: Math.floor(row.totals.ms / 100),
        medals: row.medals,
      })),
    };
  }

  public async startDailyRun(playerId: string, _idempotencyKey: string) {
    const daily = await this.ensureTodayDaily();
    const t = this.now();
    if (daily.revealedAt !== null || t > daily.closesAtMs) {
      throw new MpHttpError(409, 'closed', 'Les ouvertures du Daily Top de ce jour sont closes.');
    }

    const entryKey = this.store.dailyEntryKey(daily.dailyKey, playerId);
    if (this.store.dailyEntries.has(entryKey)) {
      throw new MpHttpError(409, 'already_played', 'Vous avez déjà consommé votre essai officiel pour ce Daily Top.');
    }

    const ser = this.store.series.get(daily.seriesId)!;
    const templates = ser.templateIds.map((id) => L1_CORPUS_BY_ID.get(id)!);
    const matchId = crypto.randomUUID();
    const runId = crypto.randomUUID();

    this.store.matches.set(matchId, {
      id: matchId,
      mode: 'daily_top',
      league: 'maths_icm',
      seriesId: daily.seriesId,
      state: 'live',
      season: this.store.currentSeason,
      createdAt: new Date(t).toISOString(),
      createdAtMs: t,
      expiresAtMs: daily.closesAtMs + DAILY_L1.graceCloseMs,
      settledAt: null,
      dailyKey: daily.dailyKey,
      creatorId: playerId,
      opponentId: null,
      receipt: null,
    });

    this.store.runs.set(runId, {
      id: runId,
      matchId,
      playerId,
      engineRun: newRun(templates.map((tpl) => tpl.public.limitMs)),
      openedAtMs: {},
      openKeys: {},
      totalPd: null,
      perfects: null,
      totalMs: null,
      ratingBefore: null,
      ratingAfter: null,
      flags: [],
    });

    this.store.dailyEntries.set(entryKey, {
      dailyKey: daily.dailyKey,
      playerId,
      runId,
      createdAt: new Date(t).toISOString(),
    });
    this.store.save();

    return {
      dailyKey: daily.dailyKey,
      matchId,
      runId,
      spotCount: templates.length,
      seedCommitment: daily.seedCommitment,
    };
  }

  public closeDaily(dailyKey: string) {
    const daily = this.store.dailies.get(dailyKey);
    if (!daily) throw new MpHttpError(404, 'not_found', 'Daily introuvable.');
    if (!daily.revealedAt) {
      daily.revealedAt = this.nowIso();
      this.store.save();
    }
    return this.getDailyReview(dailyKey);
  }

  public getDailyReview(dailyKey: string) {
    const daily = this.store.dailies.get(dailyKey);
    if (!daily) throw new MpHttpError(404, 'not_found', 'Daily introuvable.');
    if (!daily.revealedAt) {
      throw new MpHttpError(409, 'not_closed', 'Les corrections du Daily Top ne sont révélées qu’à la clôture UTC.');
    }

    const ser = this.store.series.get(daily.seriesId)!;
    const entries = Array.from(this.store.dailyEntries.values()).filter((e) => e.dailyKey === dailyKey);
    const validRuns = entries
      .map((e) => this.store.runs.get(e.runId))
      .filter((r): r is DbRun => Boolean(r && !r.flags.includes('timing_review')));

    const spotStats = ser.templateIds.map((tid, spotIndex) => {
      const tpl = L1_CORPUS_BY_ID.get(tid)!;
      let answers = 0;
      let timeoutCount = 0;
      let sumPd = 0;
      let sumLoss = 0;
      for (const r of validRuns) {
        const a = this.store.attempts.get(this.store.attemptKey(r.id, spotIndex));
        if (!a) continue;
        if (a.timeout) {
          timeoutCount++;
        } else {
          answers++;
          sumPd += a.pd;
          sumLoss += a.loss ?? a.pd;
        }
      }
      const totalAll = answers + timeoutCount;
      const meanPd = answers > 0 ? Math.round(sumPd / answers) : 0;
      const meanLoss = answers > 0 ? Math.round((sumLoss / answers) * 100) / 100 : 0;
      return {
        spotIndex,
        templateId: tid,
        family: tpl.family,
        question: tpl.public.state.kind === 'estimate' ? tpl.public.state.question : tpl.id,
        assumptions: tpl.public.state.kind === 'estimate' ? tpl.public.state.assumptions : [],
        solution: tpl.solution,
        explanationText: tpl.explanationText,
        answers: totalAll,
        validAnswers: answers,
        timeoutCount,
        meanPd,
        meanLoss,
      };
    });

    const detectedTrap = trapSpot(
      spotStats.map((s) => ({ spotIndex: s.spotIndex, answers: s.answers, meanPd: s.meanPd }))
    );

    return {
      dailyKey: daily.dailyKey,
      revealedAt: daily.revealedAt,
      secretSeed: daily.secretSeed,
      seedCommitment: daily.seedCommitment,
      expectedCommitment: computeDailyCommitment(daily.secretSeed, ser.templateIds),
      templateIds: ser.templateIds,
      trapSpot: detectedTrap ? spotStats[detectedTrap.spotIndex] : null,
      spots: spotStats,
    };
  }

  // ===========================================================================
  // MP-18 : Leaderboards & Saisons
  // ===========================================================================

  public getLeaderboard(league: League, page = 1, limit = 20, season = this.store.currentSeason) {
    const rows = Array.from(this.store.ratings.values())
      .filter((r) => r.league === league && r.season === season && r.matches > 0)
      .filter((r) => {
        const p = this.store.players.get(r.playerId);
        return Boolean(p && !p.deletedAt);
      })
      .sort((a, b) => b.r - a.r || a.rd - b.rd);

    const total = rows.length;
    const start = (page - 1) * limit;
    const slice = rows.slice(start, start + limit).map((row, idx) => {
      const p = this.store.players.get(row.playerId)!;
      const divId = division(row.r, { mastery: 100, bossValidated: true, retention7dVerified: true });
      return {
        rank: start + idx + 1,
        playerId: row.playerId,
        pseudo: p.pseudo,
        r: Math.round(row.r * 100) / 100,
        rd: Math.round(row.rd * 100) / 100,
        matches: row.matches,
        provisional: isProvisional(this.toRating(row), row.matches),
        maxMmrDivisionLabel: DIVISION_LABELS[divId] ?? divId,
      };
    });

    return {
      league,
      season,
      ratingLabel: league === 'maths_icm' ? 'Rating de précision' : 'GTO ELO',
      page,
      limit,
      total,
      entries: slice,
    };
  }

  public advanceSeason(newTheme?: string): { previousSeason: number; currentSeason: number; theme: string } {
    const prev = this.store.currentSeason;
    const next = prev + 1;
    const theme = newTheme?.trim() || `Saison ${next} — Précision & Rétention`;

    for (const row of Array.from(this.store.ratings.values())) {
      if (row.season !== prev) continue;
      const rolled = rolloverSeasonRating(this.toRating(row));
      const newRow: DbRating = {
        playerId: row.playerId,
        league: row.league,
        season: next,
        r: rolled.r,
        rd: Math.round(rolled.rd * 100) / 100,
        sigma: rolled.sigma,
        matches: 0,
        lastMatchAt: row.lastMatchAt,
      };
      this.store.ratings.set(this.store.ratingKey(row.playerId, row.league, next), newRow);
    }

    this.store.currentSeason = next;
    this.store.seasonTheme = theme;
    this.store.save();

    return { previousSeason: prev, currentSeason: next, theme };
  }

  // Utilitaire de test/admin pour vérifier l'évolution attendue Glicko-2
  public static expectedScore = expected;
}
