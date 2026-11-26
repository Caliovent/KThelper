import type { League, SpotPublic, SpotSolution } from '../domain/types';
import type { Rating } from '../engines/mp/glicko2';
import type { SpotScore } from '../engines/mp/scoring';

export const MP_SESSION_STORAGE_KEY = 'pro_poker_suite_mp_session_v1';

export class MpApiClientError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly offline: boolean;

  constructor(status: number, code: string, message: string, offline = false) {
    super(message);
    this.status = status;
    this.code = code;
    this.offline = offline;
  }
}

export interface MpMetaResponse {
  protocol: number;
  rulesVersion: string;
  corpusVersion: string;
  generatorVersion: string;
  season: number;
  seasonTheme: string;
  publicKeyPem: string;
  serverNow: string;
  rttMs: number;
}

export interface MpMeResponse {
  player: {
    id: string;
    pseudo: string;
    createdAt: string;
    adultAttestedAt: string;
  };
  season: {
    currentSeason: number;
    theme: string;
  };
  ratings: Record<
    string,
    {
      r: number;
      rd: number;
      sigma: number;
      matches: number;
      provisional: boolean;
      division: { id: string; label: string };
    }
  >;
  allRounder: { eligible: boolean; r: number | null; rd: number | null };
  forfeitCooldownUntil: string | null;
  matches: {
    matchId: string;
    runId: string;
    mode: string;
    league: League;
    state: string;
    season: number;
    createdAt: string | null;
    settledAt: string | null;
    expiresAt: string | null;
    opponentPseudo: string | null;
    runPhase: string;
    lockedCount: number;
    totalSpots: number;
    totalPd?: number | null;
    perfects?: number | null;
    totalMs?: number | null;
  }[];
  retentionNotice: string;
  exportGeneratedAt: string;
}

export interface MpQueueJoinResponse {
  matchId: string;
  runId: string;
  role: 'creator' | 'challenger';
  league: League;
  state: string;
  spotCount: number;
  opponent: { pseudo: string; mmr: number } | null;
}

export interface MpOpenSpotResponse {
  spotIndex: number;
  spot: SpotPublic;
  deadline: string;
  serverNow: string;
  limitMs: number;
  ghostProgressSpot: number | null;
}

export interface MpAnswerSpotResponse {
  locked: true;
  spotIndex: number;
  nextSpotIndex: number | null;
  runPhase: 'ready' | 'done' | 'forfeit';
  matchState: string;
}

export interface MpMatchResultResponse {
  matchId: string;
  league: League;
  season: number;
  settledAt: string | null;
  opponentPseudo: string;
  heroTotals: { pd: number; perfects: number; ms: number };
  oppTotals: { pd: number; perfects: number; ms: number };
  heroScores: SpotScore[];
  oppScores: SpotScore[];
  heroRatingBefore: Rating | null;
  heroRatingAfter: Rating | null;
  turningPoints: { spotIndex: number; heroPd: number; oppPd: number; diff: number }[];
  spots: {
    spotIndex: number;
    templateId: string;
    skillId: string;
    family: string;
    question: string;
    assumptions: string[];
    solution: SpotSolution;
    explanationId: string;
    explanationText: string;
    heroAttempt: { actionChosen: string | null; pd: number; timeout: boolean; elapsedMs: number };
    oppAttempt: { actionChosen: string | null; pd: number; timeout: boolean; elapsedMs: number };
  }[];
  receiptVerified: boolean;
}

export interface MpDailyCurrentResponse {
  dailyKey: string;
  seedCommitment: string;
  opensAt: string;
  closesAt: string;
  closed: boolean;
  revealed: boolean;
  revealedAt: string | null;
  compositionLabel: string;
  spotCount: number;
  alreadyPlayed: boolean;
  myRunId: string | null;
  myRunPhase: string | null;
  myProvisionalSummary: {
    totalPd: number;
    perfects: number;
    totalMs: number;
    provisionalRank: number | null;
    medals: string[];
    weakFamilies: string[];
  } | null;
  leaderboard: {
    rank: number;
    pseudo: string;
    pd: number;
    perfects: number;
    timeTenths: number;
    medals: string[];
  }[];
}

export interface MpLeaderboardResponse {
  league: League;
  season: number;
  ratingLabel: string;
  page: number;
  limit: number;
  total: number;
  entries: {
    rank: number;
    playerId: string;
    pseudo: string;
    r: number;
    rd: number;
    matches: number;
    provisional: boolean;
    maxMmrDivisionLabel: string;
  }[];
}

export function loadMpSessionToken(): string | null {
  try {
    return localStorage.getItem(MP_SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveMpSessionToken(token: string | null): void {
  try {
    if (!token) localStorage.removeItem(MP_SESSION_STORAGE_KEY);
    else localStorage.setItem(MP_SESSION_STORAGE_KEY, token);
  } catch {
    // Ignore storage errors
  }
}

async function requestJson<T>(url: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init.headers as Record<string, string>) ?? {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers });
  } catch {
    throw new MpApiClientError(0, 'offline', 'Serveur L1 inaccessible (mode hors-ligne L0 actif).', true);
  }

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // non-json response (ex: 404 HTML en vite preview pure)
    throw new MpApiClientError(res.status, 'server_unavailable', 'API L1 non disponible sur ce serveur.', res.status >= 500 || res.status === 404);
  }

  if (!res.ok) {
    const errObj = data as { error?: string; message?: string };
    throw new MpApiClientError(
      res.status,
      errObj?.error ?? 'http_error',
      errObj?.message ?? `Erreur HTTP ${res.status}`,
      false
    );
  }
  return data as T;
}

export const mpApi = {
  async getMeta(): Promise<MpMetaResponse> {
    const t0 = performance.now();
    const res = await requestJson<Omit<MpMetaResponse, 'rttMs'>>('/v1/meta', { method: 'GET' });
    return { ...res, rttMs: Math.round(performance.now() - t0) };
  },

  requestAuthLink(body: { email: string; pseudo: string; adultAttested: true }) {
    return requestJson<{ accepted: true; expiresInSec: number; devLinkToken?: string }>('/v1/auth/link', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  exchangeAuthLink(linkToken: string) {
    return requestJson<{
      sessionToken: string;
      player: { id: string; pseudo: string; createdAt: string; adultAttestedAt: string };
    }>('/v1/auth/session', {
      method: 'POST',
      body: JSON.stringify({ linkToken }),
    });
  },

  getMe(token: string, gates?: { mastery?: number; bossValidated?: boolean; retention7dVerified?: boolean }) {
    const qs = new URLSearchParams();
    if (gates?.mastery !== undefined) qs.set('mastery', String(gates.mastery));
    if (gates?.bossValidated) qs.set('bossValidated', 'true');
    if (gates?.retention7dVerified) qs.set('retention7dVerified', 'true');
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return requestJson<MpMeResponse>(`/v1/me${suffix}`, { method: 'GET' }, token);
  },

  deleteMe(token: string) {
    return requestJson<{ deleted: true; anonymizedPseudo: string; deletedAt: string }>(
      '/v1/me',
      { method: 'DELETE' },
      token
    );
  },

  enqueueGhost(token: string, league: League, targetMatchId?: string) {
    return requestJson<MpQueueJoinResponse>(
      '/v1/queue',
      { method: 'POST', body: JSON.stringify({ league, mode: 'ghost_duel', ...(targetMatchId ? { targetMatchId } : {}) }) },
      token
    );
  },

  listOpenMatches(token: string, league: League = 'maths_icm') {
    return requestJson<{
      matches: {
        matchId: string;
        league: League;
        creatorPseudo: string;
        creatorMmr: number;
        createdAt: string;
        expiresAt: string | null;
      }[];
    }>(`/v1/matches/open?league=${encodeURIComponent(league)}`, { method: 'GET' }, token);
  },

  openSpot(token: string, runId: string, spotIndex: number, key: string) {
    return requestJson<MpOpenSpotResponse>(
      `/v1/runs/${encodeURIComponent(runId)}/spots/${spotIndex}/open`,
      { method: 'POST', body: JSON.stringify({ key }) },
      token
    );
  },

  answerSpot(
    token: string,
    runId: string,
    spotIndex: number,
    body: { action: string; clientMs: number; key: string }
  ) {
    return requestJson<MpAnswerSpotResponse>(
      `/v1/runs/${encodeURIComponent(runId)}/spots/${spotIndex}/answer`,
      { method: 'POST', body: JSON.stringify(body) },
      token
    );
  },

  forfeitRun(token: string, runId: string, key: string) {
    return requestJson<{ matchState: string; runPhase: 'forfeit'; cancelledNoMmr: boolean }>(
      `/v1/runs/${encodeURIComponent(runId)}/forfeit`,
      { method: 'POST', body: JSON.stringify({ key }) },
      token
    );
  },

  getMatchResult(token: string, matchId: string) {
    return requestJson<MpMatchResultResponse>(
      `/v1/matches/${encodeURIComponent(matchId)}/result`,
      { method: 'GET' },
      token
    );
  },

  getDailyCurrent(token?: string | null) {
    return requestJson<MpDailyCurrentResponse>('/v1/daily/current', { method: 'GET' }, token);
  },

  startDailyRun(token: string, key: string) {
    return requestJson<{
      dailyKey: string;
      matchId: string;
      runId: string;
      spotCount: number;
      seedCommitment: string;
    }>('/v1/daily/current/start', { method: 'POST', body: JSON.stringify({ key }) }, token);
  },

  getDailyReview(dailyKey: string) {
    return requestJson<{
      dailyKey: string;
      revealedAt: string;
      secretSeed: string;
      seedCommitment: string;
      expectedCommitment: string;
      trapSpot: null | { spotIndex: number; answers: number; timeoutCount: number; meanPd: number; question: string };
      spots: { spotIndex: number; question: string; meanPd: number; explanationText: string }[];
    }>(`/v1/daily/${encodeURIComponent(dailyKey)}/review`, { method: 'GET' });
  },

  getLeaderboard(league: League, page = 1) {
    return requestJson<MpLeaderboardResponse>(
      `/v1/leaderboards/${encodeURIComponent(league)}?page=${page}&limit=20`,
      { method: 'GET' }
    );
  },
};
