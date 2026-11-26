import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MP_ENABLED,
  FSRS_THRESHOLDS,
  GHOST_LIMITS,
  MP_CORPUS,
  FRIENDLY_HEURISTIC_TEMPLATES,
  quotas,
  selectSeries,
  type Template,
  PoolTooSmall,
  rngFrom,
  int,
  shuffle,
  scoreSpot,
  ratedOutcome,
  compareForBoard,
  estimatePd,
  funnelPd,
  gradeFromPd,
  turningPoints,
  detectTimingAnomaly,
  update,
  division,
  expected,
  newRun,
  reduce,
  dayKey,
  medals,
  trapSpot,
  advance,
  emptyProgress,
  toShared,
  parseRawToSourceHand,
  MIN_AGE_MS,
  GhostChallengeV2Schema,
  ReviewEventV3Schema,
  getLeagueAvailability,
  validateCorpus,
  selectCorpusSeries,
  composeLocalDaily,
  buildReferenceBaseline,
  encodeGhostV2,
  decodeGhostV2,
  needsGhostFile,
  createMultiplayerReviewEvent,
  appendMultiplayerReviews,
  confirmProvisionalReviews,
  computeMasteryCountsFromReviews,
  migrateSuiteStateToV3,
  type SpotKey,
} from '../../src/engines/mp';
import type { GhostChallengeV2 } from '../../src/domain/types';

describe('Mode Multijoueur M0 — Critères d’acceptation MP-01 à MP-11', () => {
  it('MP-01 & MP-02: drapeau mpEnabled et schémas Zod stricts', () => {
    expect(DEFAULT_MP_ENABLED).toBe(true);

    expect(() =>
      GhostChallengeV2Schema.parse({
        schemaVersion: 99,
        challengeId: 'c1',
        mode: 'ghost_duel',
        league: 'maths_icm',
        series: {
          seed: 's1',
          corpusVersion: 'mp-corpus-maths-v1',
          generatorVersion: 'mp-gen-v1',
          rulesVersion: 'mp-rules-1',
          templateIds: ['math_icmeq_01'],
        },
        createdAt: '2026-11-26T00:00:00Z',
        creatorPseudo: 'Hero',
        integrity: 'L0',
      })
    ).toThrow();

    expect(() =>
      GhostChallengeV2Schema.parse({
        schemaVersion: 2,
        challengeId: 'c1',
        mode: 'ghost_duel',
        league: 'maths_icm',
        series: {
          seed: 's1',
          corpusVersion: 'mp-corpus-maths-v1',
          generatorVersion: 'mp-gen-v1',
          rulesVersion: 'mp-rules-1',
          templateIds: ['math_icmeq_01'],
        },
        createdAt: '2026-11-26T00:00:00Z',
        creatorPseudo: 'Hero',
        integrity: 'L0',
        unexpectedField: true,
      })
    ).toThrow();

    expect(() =>
      ReviewEventV3Schema.parse({
        id: 'mp:1:0',
        skillId: 'icm.eq.s1',
        at: '2026-11-26T00:00:00Z',
        grade: 3,
        ms: 1000,
        evLossBb: 0,
        variantSeed: 'v1',
        source: 'multiplayer',
        unknown: 1,
      })
    ).toThrow();
  });

  it('MP-03: vecteurs de référence RNG, quotas 60/25/15 et déterminisme sur pool inversé', async () => {
    const refRng = await rngFrom('kill-tilt', 'v1');
    expect([refRng(), refRng(), refRng(), refRng()]).toEqual([
      1005323447, 2164938751, 1576182334, 283372254,
    ]);
    expect(shuffle(await rngFrom('v'), [0, 1, 2, 3, 4, 5, 6, 7])).toEqual([
      3, 7, 2, 0, 4, 1, 6, 5,
    ]);

    const h = new Array(7).fill(0);
    const r2 = await rngFrom('dist');
    for (let i = 0; i < 70000; i++) h[int(r2, 7)]++;
    expect(h.every((x) => Math.abs(x - 10000) < 500)).toBe(true);

    for (let n = 12; n <= 20; n++) {
      const q = quotas(n);
      expect(q.frontier + q.transfer + q.mixed).toBe(n);
    }

    const pool: Template[] = Array.from({ length: 300 }, (_, i) => ({
      id: `t${i}`,
      skillId: `s${i}`,
      family: `f${i % 6}`,
      bucket: (['frontier', 'transfer', 'mixed'] as const)[i % 3],
      ranked: i % 11 !== 0,
    }));
    const sA = await selectSeries(pool, 15, 'seed-1', 'c1', 'g1', true);
    const sB = await selectSeries([...pool].reverse(), 15, 'seed-1', 'c1', 'g1', true);
    expect(sA).toEqual(sB);
    expect(new Set(sA.map((t) => t.skillId)).size).toBe(15);
    await expect(selectSeries(pool.slice(0, 6), 15, 'x', 'c', 'g', false)).rejects.toThrow(PoolTooSmall);
  });

  it('MP-04 & MP-05: notation PD, machine à états, Glicko-2 et divisions', () => {
    const key: SpotKey = { unit: 'mbb', ev: { fold: 0, call: -420, raise: 8 }, defaultAction: 'fold', trivial: false };
    expect(scoreSpot(key, { action: 'fold', elapsedMs: 900, usedHint: false }, 8000, true).pd).toBe(0);
    expect(scoreSpot(key, { action: 'call', elapsedMs: 900, usedHint: false }, 8000, true).pd).toBe(428);
    expect(scoreSpot(key, { action: null, elapsedMs: 8000, usedHint: false }, 8000, true).pd).toBe(300);
    expect(() => scoreSpot(key, { action: 'fold', elapsedMs: 1, usedHint: true }, 8000, true)).toThrow();
    expect(() => scoreSpot(key, { action: 'illegal', elapsedMs: 500, usedHint: false }, 8000, true)).toThrow();
    expect(ratedOutcome({ pd: 200, perfects: 1, ms: 1 }, { pd: 300, perfects: 9, ms: 0 })).toBe(0.5);
    expect(ratedOutcome({ pd: 199, perfects: 1, ms: 1 }, { pd: 300, perfects: 9, ms: 0 })).toBe(1);
    expect(compareForBoard({ pd: 100, perfects: 5, ms: 1550 }, { pd: 100, perfects: 5, ms: 1599 })).toBe(0);
    expect(estimatePd(69.5, 68.9)).toBe(0);
    expect(funnelPd({ AK: 1 }, { AK: 1 })).toBe(0);
    expect(funnelPd({ QQ: 1 }, { AK: 1 })).toBe(1000);

    let m = newRun([4000, 4000]);
    m = reduce(m, { t: 'ANSWER', i: 0, action: 'x', now: 1 });
    expect(m.locked).toHaveLength(0);
    m = reduce(m, { t: 'OPEN', i: 0, now: 1000 });
    m = reduce(m, { t: 'OPEN', i: 0, now: 3000 });
    m = reduce(m, { t: 'ANSWER', i: 0, action: 'push', now: 2500 });
    m = reduce(m, { t: 'ANSWER', i: 0, action: 'fold', now: 2600 });
    expect(m.locked).toEqual([{ i: 0, action: 'push', elapsedMs: 1500 }]);
    m = reduce(m, { t: 'OPEN', i: 1, now: 5000 });
    m = reduce(m, { t: 'TICK', now: 9401 });
    expect(m.phase.s).toBe('done');
    expect(m.locked[1].action).toBeNull();
    expect(reduce(newRun([4000]), { t: 'FORFEIT' }).phase.s).toBe('forfeit');

    const gOut = update(
      { r: 1500, rd: 200, sigma: 0.06 },
      [
        { opp: { r: 1400, rd: 30, sigma: 0.06 }, score: 1 },
        { opp: { r: 1550, rd: 100, sigma: 0.06 }, score: 0 },
        { opp: { r: 1700, rd: 300, sigma: 0.06 }, score: 0 },
      ],
      0.5
    );
    expect(Math.abs(gOut.r - 1464.06)).toBeLessThan(0.02);
    expect(Math.abs(gOut.rd - 151.52)).toBeLessThan(0.02);
    expect(Math.abs(gOut.sigma - 0.05999)).toBeLessThan(1e-4);
    expect(expected({ r: 1200, rd: 60, sigma: 0.06 }, { r: 1500, rd: 60, sigma: 0.06 })).toBeLessThan(0.2);
    expect(division(1750, { mastery: 70, bossValidated: true, retention7dVerified: true })).toBe('grinder');
    expect(division(2100, { mastery: 95, bossValidated: true, retention7dVerified: false })).toBe('master');
  });

  it('MP-06 & MP-08: corpus maths_icm exact (>= 150), validateur et Turning Points > 100 PD', async () => {
    expect(MP_CORPUS.length).toBeGreaterThanOrEqual(150);
    validateCorpus(MP_CORPUS, { isProduction: true });
    validateCorpus(FRIENDLY_HEURISTIC_TEMPLATES, { isProduction: true });
    expect(getLeagueAvailability('maths_icm', MP_CORPUS).rankedOpen).toBe(true);
    expect(getLeagueAvailability('cash', MP_CORPUS).rankedOpen).toBe(false);

    const bibleSpot = MP_CORPUS.find((t) => t.id === 'math_icmeq_01');
    expect(bibleSpot?.solution.kind).toBe('estimate');
    if (bibleSpot?.solution.kind === 'estimate') {
      expect(bibleSpot.solution.truthPct).toBeCloseTo(68.9, 1);
    }

    expect(() => validateCorpus([{ ...FRIENDLY_HEURISTIC_TEMPLATES[0], ranked: true }], { isProduction: false })).toThrow();
    expect(() => validateCorpus([{ ...MP_CORPUS[0], id: 'FAKE_TEST' }], { isProduction: true })).toThrow();

    const daily = await composeLocalDaily(Date.parse('2026-11-26T10:00:00Z'));
    expect(daily.templates).toHaveLength(15);
    const baseline = await buildReferenceBaseline(daily.templates, daily.dayKey);
    expect(baseline.isHuman).toBe(false);
    expect(baseline.scores).toHaveLength(15);

    const tp = turningPoints(
      [
        { loss: 0, pd: 101, perfect: false, timeout: false, countedMs: 1000 },
        { loss: 0, pd: 100, perfect: false, timeout: false, countedMs: 1000 },
      ],
      [
        { loss: 0, pd: 0, perfect: true, timeout: false, countedMs: 1000 },
        { loss: 0, pd: 0, perfect: true, timeout: false, countedMs: 1000 },
      ]
    );
    expect(tp).toHaveLength(1);
    expect(tp[0].diff).toBe(101);
  });

  it('MP-09, MP-10 & MP-11: Ghost KT2., migration V3 FSRS, quêtes, daily et share.ts >= 24h', async () => {
    const { seriesRef } = await selectCorpusSeries('maths_icm', 12, 'ghost-kt2', true);
    const payload: GhostChallengeV2 = {
      schemaVersion: 2,
      challengeId: '00000000-0000-4000-8000-000000000002',
      mode: 'ghost_duel',
      league: 'maths_icm',
      series: seriesRef,
      createdAt: '2026-11-26T12:00:00Z',
      creatorPseudo: 'Hero_L0',
      creatorResults: {
        records: [
          {
            spotIndex: 0,
            actionChosen: '68.9',
            elapsedMs: 3200,
            usedHint: false,
            loss: 0,
            lossUnit: null,
            pd: 0,
            timeout: false,
          },
        ],
      },
      integrity: 'L0',
    };

    const token = await encodeGhostV2(payload);
    expect(token.startsWith(GHOST_LIMITS.prefix)).toBe(true);
    const decoded = await decodeGhostV2(token);
    expect(decoded.integrity).toBe('L0');
    expect(decoded.creatorPseudo).toBe('Hero_L0');
    expect(needsGhostFile('x'.repeat(2001))).toBe(true);
    await expect(decodeGhostV2('KT1.bad')).rejects.toThrow();
    await expect(decodeGhostV2(`${token.slice(0, -4)}AAAA`)).rejects.toThrow();
    await expect(decodeGhostV2(`KT2.${'a'.repeat(GHOST_LIMITS.maxTokenChars + 5)}`)).rejects.toThrow();

    const t0 = Date.parse('2026-11-10T10:00:00Z');
    const revWin = createMultiplayerReviewEvent({
      matchId: 'match-1',
      spotIndex: 0,
      skillId: 'icm.eq.s1',
      grade: 3,
      ms: 2500,
      evLossBb: null,
      pd: 0,
      variantSeed: 'seed-m1:math_icmeq_01',
      at: new Date(t0).toISOString(),
    });
    const revFail = createMultiplayerReviewEvent({
      matchId: 'match-1',
      spotIndex: 1,
      skillId: 'icm.eq.s2',
      grade: 1,
      ms: 5000,
      evLossBb: null,
      pd: 250,
      variantSeed: 'seed-m1:math_icmeq_02',
      at: new Date(t0).toISOString(),
    });
    const log2 = appendMultiplayerReviews(appendMultiplayerReviews([], [revWin, revFail]), [revWin, revFail]);
    expect(log2).toHaveLength(2);
    expect(computeMasteryCountsFromReviews(log2).confirmedSuccesses).toBe(0);
    expect(computeMasteryCountsFromReviews(log2).failures).toBe(1);
    const confirmed7d = confirmProvisionalReviews(log2, 'icm.eq.s1', t0 + FSRS_THRESHOLDS.confirmDelayMs + 1000);
    expect(computeMasteryCountsFromReviews(confirmed7d).confirmedSuccesses).toBe(1);

    const v3 = migrateSuiteStateToV3({
      schemaVersion: 2,
      srs: { engine: 'ts-fsrs', skills: {}, log: [{ ...revWin, source: 'game' }] },
    });
    expect(v3.schemaVersion).toBe(3);

    const qZt = { id: 'zt', skillPrefix: '', target: 20, maxMeanPd: 150, criticalPd: 150, consecutive: true };
    let p = emptyProgress();
    for (let i = 0; i < 19; i++) {
      p = advance(qZt, p, { eventId: '' + i, skillId: 'icm.eq.s1', variantSeed: '' + i, pd: 0, usedHint: false, firstSeen: true });
    }
    p = advance(qZt, p, { eventId: 'dup', skillId: 'icm.eq.s1', variantSeed: 'dup', pd: 0, usedHint: false, firstSeen: false });
    expect(p.window).toHaveLength(19);
    p = advance(qZt, p, { eventId: '19', skillId: 'icm.eq.s1', variantSeed: '19', pd: 151, usedHint: false, firstSeen: true });
    expect(p.window).toHaveLength(0);

    expect(dayKey(Date.parse('2026-11-27T00:30:00+01:00'))).toBe('daily-2026-11-26');
    expect(medals(Array(15).fill({ loss: 0, pd: 0, perfect: true, timeout: false, countedMs: 2000 }))).toEqual([
      'chirurgien',
      'eclair',
    ]);
    expect(trapSpot([{ spotIndex: 1, answers: 10, meanPd: 900 }, { spotIndex: 2, answers: 40, meanPd: 100 }])?.spotIndex).toBe(2);
    expect(gradeFromPd({ loss: 0, pd: 0, perfect: true, timeout: false, countedMs: 1200 }, 8000, false)).toBe(4);
    expect(detectTimingAnomaly(Array.from({ length: 12 }, () => ({ elapsedMs: 2000, pd: 0 }))).flagged).toBe(true);

    const rawWina = `Winamax Poker - CashGame - HandId: #20261120-777 - Holdem no limit (0.01€/0.02€) - 2026/11/20 19:15:00 UTC
Table: 'Nice 02' 5-max Seat #1 is the button
Seat 1: RealPseudoHero (2.10€)
Seat 2: FishTable99 (1.90€)
Seat 3: RegVillian (2.40€)
*** ANTE/BLINDS ***
FishTable99 posts small blind 0.01€
RegVillian posts big blind 0.02€
Dealt to RealPseudoHero [As 5s]
*** PRE-FLOP ***
RealPseudoHero raises 0.03€ to 0.05€
FishTable99 folds
RegVillian calls 0.03€
*** FLOP *** [Ks 7d 2c]
RegVillian checks
RealPseudoHero bets 0.04€
RegVillian folds
*** SUMMARY ***`;
    const parsedSrc = parseRawToSourceHand(rawWina);
    const shared = toShared(parsedSrc, Date.parse('2026-11-26T06:00:00Z'));
    expect(shared.heroLabel).toBe('BTN');
    expect(JSON.stringify(shared)).not.toMatch(/RealPseudoHero|FishTable99|RegVillian|20261120-777/);
    expect(() => toShared(parsedSrc, parsedSrc.playedAtMs + MIN_AGE_MS - 1000)).toThrow();
  });
});
