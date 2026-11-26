import { z } from 'zod';

export const AWS_KTP_BASE_URL = 'https://87ne5a9wk5.execute-api.eu-north-1.amazonaws.com/prod';
export const AWS_KTP_ALLOWED_ORIGIN = 'https://kill-tilt-poker-suite.ai.studio';
export const KTP_PLAYER_ID_KEY = 'ktp_player_id';

export type KtpLeague = 'cash' | 'mtt_icm' | 'expresso' | 'all_around';

export const KtpLeagueSchema = z.enum(['cash', 'mtt_icm', 'expresso', 'all_around']);

export interface KtpGameContext {
  stacksBb: number[];
  positions: string[];
  street: string;
  board: string[];
}

export interface KtpChallengeCreateResponse {
  challengeId: string;
  seed: string;
  variant: KtpLeague;
  expiresAt: number;
}

export interface KtpChallengeMeta {
  challengeId: string;
  seed: string;
  variant: KtpLeague;
  gameContext: KtpGameContext;
  status: 'open' | 'closed' | string;
  expiresAt: number;
}

export interface KtpSubmitPayload {
  playerId: string;
  evLossBb: number;
  reactionMs: number;
  clientChecksum: string;
}

export interface KtpSubmitResponse {
  accepted: boolean;
  gtoEloDelta: number;
  gtoElo: number;
  rank: number;
  leagueId: KtpLeague | string;
}

export interface KtpLeaderboardEntry {
  rank: number;
  playerId: string;
  gtoElo: number;
}

export interface KtpLeaderboardResponse {
  league: KtpLeague | string;
  updatedAt: string | number;
  entries: KtpLeaderboardEntry[];
}

export class KTPApiError extends Error {
  public readonly status: number;
  public readonly body: unknown;
  public readonly offline: boolean;

  constructor(status: number, body: unknown, offline = false) {
    const b = body as { error?: string; reason?: string; message?: string } | null;
    super(b?.error || b?.reason || b?.message || `HTTP ${status}`);
    this.status = status;
    this.body = body;
    this.offline = offline;
  }
}

/**
 * En production sur https://kill-tilt-poker-suite.ai.studio, appelle directement API Gateway.
 * En dev/Playwright local (localhost / 127.0.0.1), passe par le proxy same-origin /api/ktp-aws.
 */
export function resolveKtpBaseUrl(): string {
  if (typeof window !== 'undefined' && typeof window.location !== 'undefined') {
    if (window.location.origin === AWS_KTP_ALLOWED_ORIGIN) {
      return AWS_KTP_BASE_URL;
    }
    return '/api/ktp-aws';
  }
  return AWS_KTP_BASE_URL;
}

export function getOrCreateKtpPlayerId(): string {
  try {
    const existing = localStorage.getItem(KTP_PLAYER_ID_KEY);
    if (existing && existing.trim().length > 0) return existing;
    const generated =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `ktp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(KTP_PLAYER_ID_KEY, generated);
    return generated;
  } catch {
    return `ktp-anon-${Date.now().toString(36)}`;
  }
}

async function ktpFetchJson<T>(
  path: string,
  init: RequestInit = {},
  playerId?: string
): Promise<T> {
  const baseUrl = resolveKtpBaseUrl();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init.headers as Record<string, string>) ?? {}),
  };
  const tracingId = playerId ?? (typeof localStorage !== 'undefined' ? getOrCreateKtpPlayerId() : undefined);
  if (tracingId) {
    headers['X-Player-Id'] = tracingId;
  }

  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, { ...init, headers });
  } catch (err) {
    throw new KTPApiError(
      0,
      { error: err instanceof Error ? err.message : 'Réseau indisponible' },
      true
    );
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    throw new KTPApiError(res.status, body, res.status >= 502);
  }
  return body as T;
}

export async function createChallenge(
  params: { variant: KtpLeague; gameContext: KtpGameContext },
  playerId?: string
): Promise<KtpChallengeCreateResponse> {
  return ktpFetchJson<KtpChallengeCreateResponse>(
    '/challenges',
    {
      method: 'POST',
      body: JSON.stringify(params),
    },
    playerId
  );
}

export async function getChallenge(
  challengeId: string,
  playerId?: string
): Promise<KtpChallengeMeta> {
  return ktpFetchJson<KtpChallengeMeta>(
    `/challenges/${encodeURIComponent(challengeId)}`,
    { method: 'GET' },
    playerId
  );
}

export async function submitChallenge(
  challengeId: string,
  payload: KtpSubmitPayload
): Promise<KtpSubmitResponse> {
  return ktpFetchJson<KtpSubmitResponse>(
    `/challenges/${encodeURIComponent(challengeId)}/submit`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    payload.playerId
  );
}

export async function getLeaderboard(
  league: KtpLeague = 'all_around',
  limit = 50,
  playerId?: string
): Promise<KtpLeaderboardResponse> {
  const safeLimit = Math.min(100, Math.max(1, Math.round(limit)));
  return ktpFetchJson<KtpLeaderboardResponse>(
    `/leaderboard?league=${encodeURIComponent(league)}&limit=${safeLimit}`,
    { method: 'GET' },
    playerId
  );
}
