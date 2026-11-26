import assert from 'node:assert/strict';
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
  scoreSolution,
  totals,
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
} from './index';
import type { GhostChallengeV2 } from '../../domain/types';

(async () => {
  // MP-01: Drapeau mpEnabled présent par défaut
  assert.equal(DEFAULT_MP_ENABLED, true);

  // MP-02: Types & schémas Zod stricts (champ inconnu ou version inconnue refusés)
  assert.throws(() =>
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
  );
  assert.throws(() =>
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
      unexpectedField: 'forbidden',
    })
  );
  assert.throws(() =>
    ReviewEventV3Schema.parse({
      id: 'mp:1:0',
      skillId: 'icm.eq.s1',
      at: '2026-11-26T00:00:00Z',
      grade: 3,
      ms: 1000,
      evLossBb: 0,
      variantSeed: 'v1',
      source: 'multiplayer',
      extraProp: true,
    })
  );

  // MP-03: Vecteurs de référence exacts (Bible p.11) + pool inversé = même série + PoolTooSmall
  const refRng = await rngFrom('kill-tilt', 'v1');
  assert.deepEqual([refRng(), refRng(), refRng(), refRng()], [1005323447, 2164938751, 1576182334, 283372254]);
  assert.deepEqual(shuffle(await rngFrom('v'), [0, 1, 2, 3, 4, 5, 6, 7]), [3, 7, 2, 0, 4, 1, 6, 5]);

  const h = new Array(7).fill(0);
  const r2 = await rngFrom('dist');
  for (let i = 0; i < 70000; i++) h[int(r2, 7)]++;
  assert.ok(h.every((x) => Math.abs(x - 10000) < 500));

  for (let n = 12; n <= 20; n++) {
    const q = quotas(n);
    assert.equal(q.frontier + q.transfer + q.mixed, n);
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
  assert.deepEqual(sA, sB);
  assert.equal(new Set(sA.map((t) => t.skillId)).size, 15);
  await assert.rejects(selectSeries(pool.slice(0, 6), 15, 'x', 'c', 'g', false), PoolTooSmall);

  // MP-04: Notation exacte (fold optimal + timeout = 300 PD, indice en classé refusé, action illégale refusée)
  const key: SpotKey = { unit: 'mbb', ev: { fold: 0, call: -420, raise: 8 }, defaultAction: 'fold', trivial: false };
  assert.equal(scoreSpot(key, { action: 'fold', elapsedMs: 900, usedHint: false }, 8000, true).pd, 0);
  assert.equal(scoreSpot(key, { action: 'call', elapsedMs: 900, usedHint: false }, 8000, true).pd, 428);
  assert.equal(scoreSpot(key, { action: null, elapsedMs: 8000, usedHint: false }, 8000, true).pd, 300);
  assert.throws(() => scoreSpot(key, { action: 'fold', elapsedMs: 1, usedHint: true }, 8000, true));
  assert.throws(() => scoreSpot(key, { action: 'illegal', elapsedMs: 500, usedHint: false }, 8000, true));
  assert.equal(ratedOutcome({ pd: 200, perfects: 1, ms: 1 }, { pd: 300, perfects: 9, ms: 0 }), 0.5);
  assert.equal(ratedOutcome({ pd: 199, perfects: 1, ms: 1 }, { pd: 300, perfects: 9, ms: 0 }), 1);
  assert.equal(compareForBoard({ pd: 100, perfects: 5, ms: 1550 }, { pd: 100, perfects: 5, ms: 1599 }), 0);
  assert.equal(estimatePd(69.5, 68.9), 0);
  assert.equal(funnelPd({ AK: 1 }, { AK: 1 }), 0);
  assert.equal(funnelPd({ QQ: 1 }, { AK: 1 }), 1000);

  // MP-05: Machine à états (double réponse ignorée, après tolérance 400ms -> timeout, abandon ready/open)
  let m = newRun([4000, 4000]);
  m = reduce(m, { t: 'ANSWER', i: 0, action: 'x', now: 1 });
  assert.equal(m.locked.length, 0);
  m = reduce(m, { t: 'OPEN', i: 0, now: 1000 });
  m = reduce(m, { t: 'OPEN', i: 0, now: 3000 });
  m = reduce(m, { t: 'ANSWER', i: 0, action: 'push', now: 2500 });
  m = reduce(m, { t: 'ANSWER', i: 0, action: 'fold', now: 2600 });
  assert.deepEqual(m.locked, [{ i: 0, action: 'push', elapsedMs: 1500 }]);
  m = reduce(m, { t: 'OPEN', i: 1, now: 5000 });
  m = reduce(m, { t: 'TICK', now: 9401 });
  assert.equal(m.phase.s, 'done');
  assert.equal(m.locked[1].action, null);
  assert.equal(reduce(newRun([4000]), { t: 'FORFEIT' }).phase.s, 'forfeit');

  // MP-06 & MP-14: Corpus maths_icm >= 150 gabarits (90/40/20), 68.9% Bible p.18 vérifié, validateur build strict
  assert.ok(MP_CORPUS.length >= 150);
  validateCorpus(MP_CORPUS, { isProduction: true });
  validateCorpus(FRIENDLY_HEURISTIC_TEMPLATES, { isProduction: true });
  assert.equal(getLeagueAvailability('maths_icm', MP_CORPUS).rankedOpen, true);
  assert.equal(getLeagueAvailability('cash', MP_CORPUS).rankedOpen, false);
  assert.equal(getLeagueAvailability('mtt_icm', MP_CORPUS).rankedOpen, false);
  assert.equal(getLeagueAvailability('expresso', MP_CORPUS).rankedOpen, false);

  const bibleIcmSpot = MP_CORPUS.find((t) => t.id === 'math_icmeq_01');
  assert.ok(bibleIcmSpot && bibleIcmSpot.solution.kind === 'estimate');
  assert.ok(Math.abs(bibleIcmSpot.solution.truthPct - 68.9) < 0.15);

  const badHeuristicRanked = { ...FRIENDLY_HEURISTIC_TEMPLATES[0], ranked: true };
  assert.throws(() => validateCorpus([badHeuristicRanked], { isProduction: false }));
  const fakeProd = { ...MP_CORPUS[0], id: 'FAKE_SPOT_TEST' };
  assert.throws(() => validateCorpus([fakeProd], { isProduction: true }));

  for (const count of [12, 15, 20]) {
    const sel1 = await selectCorpusSeries('maths_icm', count, 'm0-seed', true);
    const sel2 = await selectCorpusSeries('maths_icm', count, 'm0-seed', true);
    assert.equal(sel1.templates.length, count);
    assert.deepEqual(sel1.seriesRef.templateIds, sel2.seriesRef.templateIds);
  }
  const daily = await composeLocalDaily(Date.parse('2026-11-26T10:00:00Z'));
  assert.equal(daily.templates.length, 15);
  assert.equal(daily.isLocalOnly, true);
  const baseline = await buildReferenceBaseline(daily.templates, daily.dayKey);
  assert.equal(baseline.isHuman, false);
  assert.equal(baseline.scores.length, 15);

  // MP-08: Turning Points (101 PD signalé, 100 PD non signalé)
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
  assert.equal(tp.length, 1);
  assert.equal(tp[0].spotIndex, 0);
  assert.equal(tp[0].diff, 101);

  // MP-09: Ghost amical KT2. round-trip, refus altéré / inconnu / trop grand sans plantage
  const { seriesRef } = await selectCorpusSeries('maths_icm', 12, 'ghost-kt2', true);
  const ghostPayload: GhostChallengeV2 = {
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
  const kt2 = await encodeGhostV2(ghostPayload);
  assert.ok(kt2.startsWith(GHOST_LIMITS.prefix));
  const decodedKt2 = await decodeGhostV2(kt2);
  assert.equal(decodedKt2.integrity, 'L0');
  assert.equal(decodedKt2.creatorPseudo, 'Hero_L0');
  assert.equal(needsGhostFile('x'.repeat(2001)), true);
  await assert.rejects(decodeGhostV2('KT1.invalid'));
  await assert.rejects(decodeGhostV2(`${kt2.slice(0, -4)}AAAA`));
  await assert.rejects(decodeGhostV2(`KT2.${'a'.repeat(GHOST_LIMITS.maxTokenChars + 5)}`));

  // MP-10: Migration V3 et FSRS idempotent + provisional (sans effet sur M) -> confirmed à +7j + échec immédiat
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
  assert.equal(revWin.id, 'mp:match-1:0');
  assert.equal(revWin.confirmation, 'provisional');
  assert.equal(revFail.confirmation, 'confirmed');

  const log1 = appendMultiplayerReviews([], [revWin, revFail]);
  const log2 = appendMultiplayerReviews(log1, [revWin, revFail]); // replay idempotent
  assert.equal(log2.length, 2);
  assert.equal(computeMasteryCountsFromReviews(log2).confirmedSuccesses, 0);
  assert.equal(computeMasteryCountsFromReviews(log2).provisionalSuccesses, 1);
  assert.equal(computeMasteryCountsFromReviews(log2).failures, 1);

  const tooEarly = confirmProvisionalReviews(log2, 'icm.eq.s1', t0 + FSRS_THRESHOLDS.confirmDelayMs - 1000);
  assert.equal(computeMasteryCountsFromReviews(tooEarly).confirmedSuccesses, 0);
  const confirmed7d = confirmProvisionalReviews(log2, 'icm.eq.s1', t0 + FSRS_THRESHOLDS.confirmDelayMs + 1000);
  assert.equal(computeMasteryCountsFromReviews(confirmed7d).confirmedSuccesses, 1);

  const migratedV3 = migrateSuiteStateToV3({
    schemaVersion: 2,
    exportedAt: '2026-11-26T00:00:00Z',
    srs: { engine: 'ts-fsrs', skills: {}, log: [{ ...revWin, source: 'game' }] },
  });
  assert.equal(migratedV3.schemaVersion, 3);
  assert.equal(migratedV3.srs.log[0].confirmation, 'confirmed');

  // MP-11: Quêtes (spot déjà vu ignoré, Zéro Tilt remis à zéro à 151 PD, aucune modification de leak)
  const qZt = { id: 'zt', skillPrefix: '', target: 20, maxMeanPd: 150, criticalPd: 150, consecutive: true };
  let p = emptyProgress();
  for (let i = 0; i < 19; i++) {
    p = advance(qZt, p, { eventId: '' + i, skillId: 'icm.eq.s1', variantSeed: '' + i, pd: 0, usedHint: false, firstSeen: true });
  }
  p = advance(qZt, p, { eventId: 'dup', skillId: 'icm.eq.s1', variantSeed: 'dup', pd: 0, usedHint: false, firstSeen: false });
  assert.equal(p.window.length, 19); // firstSeen: false ignoré
  p = advance(qZt, p, { eventId: '19', skillId: 'icm.eq.s1', variantSeed: '19', pd: 151, usedHint: false, firstSeen: true });
  assert.equal(p.window.length, 0); // remis à zéro à 151 PD

  // Daily helpers, Glicko-2 exemple Glickman, gradeFromPd, share.ts, timing anomalies
  assert.equal(dayKey(Date.parse('2026-11-27T00:30:00+01:00')), 'daily-2026-11-26');
  assert.deepEqual(
    medals(Array(15).fill({ loss: 0, pd: 0, perfect: true, timeout: false, countedMs: 2000 })),
    ['chirurgien', 'eclair']
  );
  assert.equal(trapSpot([{ spotIndex: 1, answers: 10, meanPd: 900 }, { spotIndex: 2, answers: 40, meanPd: 100 }])!.spotIndex, 2);

  const gOut = update(
    { r: 1500, rd: 200, sigma: 0.06 },
    [
      { opp: { r: 1400, rd: 30, sigma: 0.06 }, score: 1 },
      { opp: { r: 1550, rd: 100, sigma: 0.06 }, score: 0 },
      { opp: { r: 1700, rd: 300, sigma: 0.06 }, score: 0 },
    ],
    0.5
  );
  assert.ok(Math.abs(gOut.r - 1464.06) < 0.02 && Math.abs(gOut.rd - 151.52) < 0.02 && Math.abs(gOut.sigma - 0.05999) < 1e-4);
  assert.ok(expected({ r: 1200, rd: 60, sigma: 0.06 }, { r: 1500, rd: 60, sigma: 0.06 }) < 0.2);
  assert.equal(division(1750, { mastery: 70, bossValidated: true, retention7dVerified: true }), 'grinder');
  assert.equal(division(2100, { mastery: 95, bossValidated: true, retention7dVerified: false }), 'master');

  assert.equal(gradeFromPd({ loss: 0, pd: 0, perfect: true, timeout: false, countedMs: 1200 }, 8000, false), 4);
  assert.equal(gradeFromPd({ loss: 0, pd: 101, perfect: false, timeout: false, countedMs: 1200 }, 8000, false), 1);
  assert.equal(detectTimingAnomaly(Array.from({ length: 12 }, () => ({ elapsedMs: 2000, pd: 0 }))).flagged, true);

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
  const sharedClean = toShared(parsedSrc, Date.parse('2026-11-26T06:00:00Z'));
  assert.equal(sharedClean.heroLabel, 'BTN');
  assert.ok(!/RealPseudoHero|FishTable99|RegVillian|20261120-777/.test(JSON.stringify(sharedClean)));
  assert.throws(() => toShared(parsedSrc, parsedSrc.playedAtMs + MIN_AGE_MS - 1000));

  console.log(
    `VERIFY_MP_M0 ALL OK (MP-01..11, Zod strict, KT2. Ghost, FSRS V3, ${MP_CORPUS.length} Maths & ICM exact spots)`
  );
})();
