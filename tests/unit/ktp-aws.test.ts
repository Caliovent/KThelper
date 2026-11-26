import crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AWS_KTP_BASE_URL,
  KTPApiError,
  createChallenge,
  getChallenge,
  getLeaderboard,
  resolveKtpBaseUrl,
  submitChallenge,
} from '../../src/services/ktpApi';
import { computeKtpChecksum } from '../../src/services/ktpChecksum';
import { clearKtpQueue, flushQueue, getQueuedSubmissions, syncSubmit } from '../../src/services/ktpSync';

describe('Intégration Hybride AWS ktp-backend (Client, Checksum & File IndexedDB/Fallback)', () => {
  const store = new Map<string, string>();

  beforeEach(async () => {
    store.clear();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    });
    await clearKtpQueue();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('computeKtpChecksum génère le SHA-256 hex exact attendu par AWS', async () => {
    const actual = await computeKtpChecksum('2Ds4kL', 'anon_001', 2.34, 4200, 'seed_xyz');
    const expected = crypto
      .createHash('sha256')
      .update('2Ds4kL:anon_001:2.34:4200:seed_xyz', 'utf8')
      .digest('hex');
    expect(actual).toBe(expected);
    expect(actual).toMatch(/^[a-f0-9]{64}$/);
  });

  it('ktpApi appelle les 4 endpoints avec X-Player-Id et bascule vers proxy local hors origin prod', async () => {
    expect(resolveKtpBaseUrl()).toBe(AWS_KTP_BASE_URL);

    vi.stubGlobal('window', { location: { origin: 'http://127.0.0.1:4173' } });
    expect(resolveKtpBaseUrl()).toBe('/api/ktp-aws');

    vi.stubGlobal('window', { location: { origin: 'https://kill-tilt-poker-suite.ai.studio' } });
    expect(resolveKtpBaseUrl()).toBe(AWS_KTP_BASE_URL);

    const calls: { url: string; method: string; xPlayerId: string | null }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const hdrs = (init?.headers as Record<string, string>) ?? {};
        calls.push({ url, method: init?.method ?? 'GET', xPlayerId: hdrs['X-Player-Id'] ?? null });
        if (url.endsWith('/challenges') && init?.method === 'POST') {
          return new Response(
            JSON.stringify({ challengeId: 'cid1', seed: 'seed1', variant: 'cash', expiresAt: 9999999999 }),
            { status: 200 }
          );
        }
        if (url.endsWith('/challenges/cid1') && (init?.method ?? 'GET') === 'GET') {
          return new Response(
            JSON.stringify({
              challengeId: 'cid1',
              seed: 'seed1',
              variant: 'cash',
              gameContext: { stacksBb: [100, 100], positions: ['BTN', 'BB'], street: 'flop', board: ['Ah', 'Kd', '2c'] },
              status: 'open',
              expiresAt: 9999999999,
            }),
            { status: 200 }
          );
        }
        if (url.endsWith('/challenges/cid1/submit')) {
          return new Response(
            JSON.stringify({ accepted: true, gtoEloDelta: 12, gtoElo: 1512, rank: 1, leagueId: 'cash' }),
            { status: 200 }
          );
        }
        if (url.includes('/leaderboard?league=cash&limit=10')) {
          return new Response(
            JSON.stringify({ league: 'cash', updatedAt: 1, entries: [{ rank: 1, playerId: 'p1', gtoElo: 1512 }] }),
            { status: 200 }
          );
        }
        return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
      })
    );

    const created = await createChallenge(
      { variant: 'cash', gameContext: { stacksBb: [100, 100], positions: ['BTN', 'BB'], street: 'flop', board: ['Ah', 'Kd', '2c'] } },
      'player_test_1'
    );
    expect(created.challengeId).toBe('cid1');

    const meta = await getChallenge('cid1', 'player_test_1');
    expect(meta.seed).toBe('seed1');

    const sub = await submitChallenge('cid1', {
      playerId: 'player_test_1',
      evLossBb: 0.4,
      reactionMs: 3200,
      clientChecksum: 'abc',
    });
    expect(sub.gtoElo).toBe(1512);

    const board = await getLeaderboard('cash', 10, 'player_test_1');
    expect(board.entries[0].gtoElo).toBe(1512);
    expect(calls.every((c) => c.xPlayerId === 'player_test_1')).toBe(true);

    await expect(getChallenge('missing', 'player_test_1')).rejects.toBeInstanceOf(KTPApiError);
  });

  it('ktpSync met en file hors-ligne quand navigator.onLine=false puis flushe avec checksum valide', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    const queued = await syncSubmit('cid_off', 'seed_off', {
      playerId: 'p_off',
      evLossBb: 1.25,
      reactionMs: 4100,
    });
    expect(queued.queued).toBe(true);
    expect((await getQueuedSubmissions()).length).toBe(1);

    vi.stubGlobal('navigator', { onLine: true });
    let capturedBody: { clientChecksum?: string } = {};
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        capturedBody = JSON.parse(String(init?.body ?? '{}')) as { clientChecksum?: string };
        return new Response(
          JSON.stringify({ accepted: true, gtoEloDelta: 8, gtoElo: 1508, rank: 2, leagueId: 'all_around' }),
          { status: 200 }
        );
      })
    );

    const summary = await flushQueue();
    expect(summary.flushed).toBe(1);
    expect(summary.remaining).toBe(0);
    expect((await getQueuedSubmissions()).length).toBe(0);
    const expectedSum = await computeKtpChecksum('cid_off', 'p_off', 1.25, 4100, 'seed_off');
    expect(capturedBody.clientChecksum).toBe(expectedSum);
  });
});
