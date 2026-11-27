import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { RANKS } from '../../src/engines/chunk';
import {
  COMBO_INDEX,
  EVOLUTIONARY_FUNNEL_SCENARIOS,
  MATRIX_HANDS,
  addCardToMask52,
  buildBlockerDrills,
  buildCardMask52,
  buildFloat32ComboWeights,
  computeDrawersForStreet,
  computeRiverArbitrator,
  computeStreetMatrixDiff,
  countFamilyUnblockedCombos,
  countUnblockedCombos,
  deckCombosRemaining,
  enumerateConcreteCombos,
  evaluateScalpelPruning,
  hamiltonRoundPercent,
  inspectHandFunnelHistory,
  projectFloat32ToCells,
  type DrawerStepFreq,
  type FunnelDrawerId,
} from '../../src/engines/evolutionaryFunnel';
import { normalizeFunnelWeightsHamilton } from '../../src/engines/mp/funnel';
import {
  buildFunnelWarmupCandidates,
  buildWarmup,
  createFunnelFsrsCard,
  getFunnelCardRetrievability,
  gradeFunnelAttempt,
  reviewFunnelFsrsCard,
} from '../../src/engines/srs';

const ALL_52_CARDS: readonly string[] = (() => {
  const cards: string[] = [];
  for (const r of RANKS) {
    for (const s of ['s', 'h', 'd', 'c']) {
      cards.push(`${r}${s}`);
    }
  }
  return cards;
})();

describe('PALM-Funnel — Moteur Combinatoire, SMI CardMask52, Hamilton, FSRS & fast-check', () => {
  it('vérifie exactement le tableau d’audit combinatoire du PDF (KJs vs KJ, AK, KK, AA, 99/66/33, 98s)', () => {
    expect(MATRIX_HANDS).toHaveLength(169);
    expect(COMBO_INDEX).toHaveLength(1326);
    expect(deckCombosRemaining(0)).toBe(1326);
    expect(deckCombosRemaining(3)).toBe(1176);
    expect(deckCombosRemaining(4)).toBe(1128);
    expect(deckCombosRemaining(5)).toBe(1081);

    const flop = ['9s', '6d', '3c'];
    const turn = ['9s', '6d', '3c', 'Kc'];
    const river = ['9s', '6d', '3c', 'Kc', 'Ah'];
    const turnHeroKdQs = [...turn, 'Kd', 'Qs'];
    const turnHeroAs5s = [...turn, 'As', '5s'];

    // KJs (4 -> 4 -> 3 -> 3 ; et 2 avec Kd Qs) vs KJo (12 -> 12 -> 9 -> 9) vs KJ (16 -> 16 -> 12 -> 12)
    expect(countUnblockedCombos('KJs', flop).remaining).toBe(4);
    expect(countUnblockedCombos('KJs', turn).remaining).toBe(3);
    expect(countUnblockedCombos('KJs', river).remaining).toBe(3);
    expect(countUnblockedCombos('KJs', turnHeroKdQs).remaining).toBe(2);
    expect(countUnblockedCombos('KJo', turn).remaining).toBe(9);
    expect(countFamilyUnblockedCombos('KJ', turn).remaining).toBe(12);

    // AKs (4 -> 4 -> 3 -> 2 ; et 2 avec Kd Qs), AKo (12 -> 12 -> 9 -> 7 ; et 6), AK total (16 -> 12 -> 9 ; et 8)
    expect(countUnblockedCombos('AKs', turn).remaining).toBe(3);
    expect(countUnblockedCombos('AKs', river).remaining).toBe(2);
    expect(countUnblockedCombos('AKs', turnHeroKdQs).remaining).toBe(2);
    expect(countUnblockedCombos('AKo', turn).remaining).toBe(9);
    expect(countUnblockedCombos('AKo', river).remaining).toBe(7);
    expect(countUnblockedCombos('AKo', turnHeroKdQs).remaining).toBe(6);
    expect(countFamilyUnblockedCombos('AK', river).remaining).toBe(9);
    expect(countFamilyUnblockedCombos('AK', turnHeroKdQs).remaining).toBe(8);

    // KK (6 -> 6 -> 3 -> 3 ; et 1 avec Kd Qs), AA (6 -> 6 -> 6 -> 3 ; 3 avec As 5s)
    expect(countUnblockedCombos('KK', turn).remaining).toBe(3);
    expect(countUnblockedCombos('KK', turnHeroKdQs).remaining).toBe(1);
    expect(countUnblockedCombos('AA', turn).remaining).toBe(6);
    expect(countUnblockedCombos('AA', river).remaining).toBe(3);
    expect(countUnblockedCombos('AA', turnHeroAs5s).remaining).toBe(3);

    // 99, 66, 33 (6 -> 3 -> 3 -> 3) & 98s (4 -> 3 -> 3 -> 3)
    expect(countUnblockedCombos('99', flop).remaining).toBe(3);
    expect(countUnblockedCombos('66', flop).remaining).toBe(3);
    expect(countUnblockedCombos('33', flop).remaining).toBe(3);
    expect(countUnblockedCombos('98s', flop).remaining).toBe(3);
    expect(enumerateConcreteCombos('AKo')).toHaveLength(12);
  });

  it('fast-check Invariant 1 : conservation combinatoire stricte actifs + fantôme + bloqués === total préflop', () => {
    for (const sc of EVOLUTIONARY_FUNNEL_SCENARIOS) {
      for (const st of [0, 1, 2, 3] as const) {
        const diff = computeStreetMatrixDiff(sc, st);
        expect(
          diff.activeCombosExact + diff.ghostCombosExact + diff.blockedBoardCombosExact
        ).toBeCloseTo(diff.preflopTotalCombos, 5);
      }
    }

    const shishi = EVOLUTIONARY_FUNNEL_SCENARIOS[0];
    const pfWeights = buildFloat32ComboWeights(shishi.streets[0].activeCombos);

    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 0, max: 51 }), { minLength: 0, maxLength: 7 }),
        fc.integer({ min: 0, max: 3 }),
        (cardIdxList, stIdx) => {
          const cards = cardIdxList.map((i) => ALL_52_CARDS[i]);
          const deadMask = buildCardMask52(cards);
          const actWeights = buildFloat32ComboWeights(shishi.streets[stIdx].activeCombos);
          const proj = projectFloat32ToCells(actWeights, pfWeights, deadMask);

          const sumParts = proj.totalActiveExact + proj.totalGhostExact + proj.totalBlockedExact;
          expect(Math.abs(sumParts - proj.totalPreflopExact)).toBeLessThan(1e-2);
          for (let c = 0; c < 169; c++) {
            const cellSum = proj.activeByCell[c] + proj.ghostByCell[c] + proj.blockedByCell[c];
            expect(Math.abs(cellSum - proj.preflopByCell[c])).toBeLessThan(1e-4);
          }
        }
      ),
      { numRuns: 120 }
    );
  });

  it('fast-check Invariant 2 : la méthode d’Hamilton somme strictement à 100 %', () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: 0, max: 500, noNaN: true, noDefaultInfinity: true }), {
          minLength: 2,
          maxLength: 8,
        }),
        (vec) => {
          const hasPos = vec.some((v) => v > 0);
          const rounded = hamiltonRoundPercent(vec);
          const sum = rounded.reduce((a, b) => a + b, 0);
          if (hasPos) {
            expect(sum).toBe(100);
            expect(rounded.every((x) => Number.isInteger(x) && x >= 0)).toBe(true);
          } else {
            expect(sum).toBe(0);
          }
        }
      ),
      { numRuns: 200 }
    );

    const normalized = normalizeFunnelWeightsHamilton({
      valeur_forte: 11.8,
      valeur_moyenne: 13.8,
      tirages_forts: 23.6,
      tirages_faibles: 12.7,
      bluff_catchers: 11.9,
      air: 1.5,
    });
    expect(Object.values(normalized).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('fast-check Invariant 3 : monotonicité stricte des bloqueurs CardMask52 (SMI-safe)', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 0, max: 51 }), { minLength: 0, maxLength: 6 }),
        fc.integer({ min: 0, max: 51 }),
        fc.integer({ min: 0, max: 168 }),
        (boardIndices, extraIdx, cellIdx) => {
          const hand = MATRIX_HANDS[cellIdx].hand;
          const boardCards = boardIndices.map((i) => ALL_52_CARDS[i]);
          const extraCard = ALL_52_CARDS[extraIdx];

          const maskBefore = buildCardMask52(boardCards);
          const maskAfter = addCardToMask52(maskBefore, extraCard);
          // SMI-safe strictement < 2^26
          expect(maskAfter.lo).toBeGreaterThanOrEqual(0);
          expect(maskAfter.lo).toBeLessThan(2 ** 26);
          expect(maskAfter.hi).toBeGreaterThanOrEqual(0);
          expect(maskAfter.hi).toBeLessThan(2 ** 26);

          const before = countUnblockedCombos(hand, boardCards).remaining;
          const after = countUnblockedCombos(hand, [...boardCards, extraCard]).remaining;
          expect(after).toBeLessThanOrEqual(before);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('valide les 4 modes PALM-Funnel, la monotonicité des 3 scénarios et la traçabilité provenance', () => {
    expect(EVOLUTIONARY_FUNNEL_SCENARIOS).toHaveLength(3);
    for (const sc of EVOLUTIONARY_FUNNEL_SCENARIOS) {
      expect(sc.provenanceKind).toBe('heuristic');
      expect(sc.sismographe.options.length).toBeGreaterThanOrEqual(3);

      const diffs = ([0, 1, 2, 3] as const).map((i) => computeStreetMatrixDiff(sc, i));
      for (let i = 1; i < 4; i++) {
        expect(diffs[i].totalActiveCombos).toBeLessThan(diffs[i - 1].totalActiveCombos);
        for (const cell of diffs[i].cells) {
          expect(cell.freqCurrent).toBeLessThanOrEqual(cell.freqPrev);
        }
      }

      // Mode 2 Scalpel : appliquer les fréquences de référence donne un recouvrement élevé
      const drawers = computeDrawersForStreet(sc, 2);
      const refMap: Partial<Record<FunnelDrawerId, DrawerStepFreq>> = {};
      drawers.forEach((d) => {
        refMap[d.id] = d.referenceFreq;
      });
      const evalRes = evaluateScalpelPruning(sc, 2, refMap);
      expect(evalRes.overlapPct).toBeGreaterThanOrEqual(80);

      // Mode 4 Arbitre River
      const river = computeRiverArbitrator(sc);
      expect(river.provenance).toBe('computed');
      expect(river.valueSharePct + river.bluffSharePct).toBe(100);
      expect(river.potOddsPct).toBe(30);
    }

    // Mode 3 Bloqueur Drills
    const drills = buildBlockerDrills();
    expect(drills).toHaveLength(10);
    expect(drills.every((d) => d.provenance === 'computed')).toBe(true);
    expect(drills[0].correctCombos).toBe(12); // AK sur Kc
    expect(drills[1].correctCombos).toBe(8); // AK sur Kc + Kd Qs
    expect(drills[2].correctCombos).toBe(9); // AK sur Kc + As 5s
    expect(drills[3].correctCombos).toBe(3); // KJs sur Kc

    const kjHist = inspectHandFunnelHistory(EVOLUTIONARY_FUNNEL_SCENARIOS[0], 'KJs');
    expect(kjHist.history.map((h) => h.unblockedCombos)).toEqual([4, 4, 3, 3]);
    expect(kjHist.familyAtStreet(2)?.unblockedTotal).toBe(12);
  });

  it('intègre ts-fsrs (gradeFunnelAttempt 1..4) et injecte les cartes faibles dans buildWarmup', () => {
    expect(
      gradeFunnelAttempt({
        overlapScore: 0.95,
        ms: 3000,
        limitMs: 20000,
        usedHint: false,
        missedMajorDrawer: false,
        minorDrawerImbalance: false,
      })
    ).toBe(4);
    expect(
      gradeFunnelAttempt({
        overlapScore: 0.9,
        ms: 10000,
        limitMs: 20000,
        usedHint: false,
        missedMajorDrawer: false,
        minorDrawerImbalance: false,
      })
    ).toBe(3);
    expect(
      gradeFunnelAttempt({
        overlapScore: 0.88,
        ms: 8000,
        limitMs: 20000,
        usedHint: true,
        missedMajorDrawer: false,
        minorDrawerImbalance: false,
      })
    ).toBe(2);
    expect(
      gradeFunnelAttempt({
        overlapScore: 0.75,
        ms: 4000,
        limitMs: 20000,
        usedHint: false,
        missedMajorDrawer: true,
        minorDrawerImbalance: false,
      })
    ).toBe(1);

    const now = new Date('2026-11-27T10:00:00Z');
    const card0 = createFunnelFsrsCard(now);
    const revBad = reviewFunnelFsrsCard(card0, 1, now);
    const future = new Date('2026-12-10T10:00:00Z');
    const rLater = getFunnelCardRetrievability(revBad.card, future);
    expect(rLater).toBeLessThan(0.85);

    const funnelCands = buildFunnelWarmupCandidates(
      [
        {
          scenarioId: 'shishi_triple_barrel_963r_kc_ah',
          title: 'Spot Shishi',
          focusHand: 'KJs',
          card: revBad.card,
        },
      ],
      future
    );
    expect(funnelCands).toHaveLength(1);
    const warmup = buildWarmup(funnelCands, 300);
    expect(warmup[0].id).toBe('funnel-shishi_triple_barrel_963r_kc_ah');
  });
});
