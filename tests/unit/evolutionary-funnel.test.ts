import { describe, expect, it } from 'vitest';
import {
  EVOLUTIONARY_FUNNEL_SCENARIOS,
  MATRIX_HANDS,
  computeStreetMatrixDiff,
  countUnblockedCombos,
  deckCombosRemaining,
  enumerateConcreteCombos,
  inspectHandFunnelHistory,
} from '../../src/engines/evolutionaryFunnel';

describe('Moteur Range Évolutif & Entonnoir de Board (Matrix Diff)', () => {
  it('énumère les 169 classes 13×13 et calcule exactement le card removal du board', () => {
    expect(MATRIX_HANDS).toHaveLength(169);
    expect(deckCombosRemaining(0)).toBe(1326);
    expect(deckCombosRemaining(3)).toBe(1176);
    expect(deckCombosRemaining(4)).toBe(1128);
    expect(deckCombosRemaining(5)).toBe(1081);

    expect(enumerateConcreteCombos('AA')).toHaveLength(6);
    expect(enumerateConcreteCombos('KJs')).toHaveLength(4);
    expect(enumerateConcreteCombos('KJo')).toHaveLength(12);

    // Sur Ah : AA passe de 6 -> 3 combos
    expect(countUnblockedCombos('AA', ['Ah'])).toMatchObject({
      base: 6,
      remaining: 3,
      blocked: 3,
      blockingCards: ['Ah'],
    });

    // Sur Turn Kc (9s 6d 3c Kc) : KJs 4 -> 3 et KJo 12 -> 9 (soit KJ 16 -> 12)
    const kjs = countUnblockedCombos('KJs', ['9s', '6d', '3c', 'Kc']);
    const kjo = countUnblockedCombos('KJo', ['9s', '6d', '3c', 'Kc']);
    expect(kjs).toMatchObject({ base: 4, remaining: 3, blocked: 1, blockingCards: ['Kc'] });
    expect(kjo).toMatchObject({ base: 12, remaining: 9, blocked: 3, blockingCards: ['Kc'] });
    expect(kjs.remaining + kjo.remaining).toBe(12);

    // Sur River Ah (9s 6d 3c Kc Ah) : AKs 4 -> 2 et AKo 12 -> 7 (soit AK = 9 combos)
    const aks = countUnblockedCombos('AKs', ['9s', '6d', '3c', 'Kc', 'Ah']);
    const ako = countUnblockedCombos('AKo', ['9s', '6d', '3c', 'Kc', 'Ah']);
    expect(aks.remaining).toBe(2);
    expect(ako.remaining).toBe(7);
    expect(aks.remaining + ako.remaining).toBe(9);
  });

  it('respecte la monotonicité stricte, zéro doublon de board et la provenance heuristique sur les 3 scénarios', () => {
    expect(EVOLUTIONARY_FUNNEL_SCENARIOS).toHaveLength(3);

    for (const sc of EVOLUTIONARY_FUNNEL_SCENARIOS) {
      expect(sc.provenance.origin).toBe('heuristic');
      expect(sc.quizQuestions.length).toBeGreaterThanOrEqual(3);

      // Zéro carte dupliquée sur le board final et cohérence des nouvelles cartes
      const riverBoard = sc.streets[3].board;
      expect(riverBoard).toHaveLength(5);
      expect(new Set(riverBoard).size).toBe(5);
      expect(sc.streets[0].board).toEqual([]);
      expect(sc.streets[1].board).toHaveLength(3);
      expect(sc.streets[2].board).toHaveLength(4);

      const diffs = ([0, 1, 2, 3] as const).map((i) => computeStreetMatrixDiff(sc, i));
      for (let i = 1; i < 4; i++) {
        // Un entonnoir doit réduire les combos rue après rue
        expect(diffs[i].totalActiveCombos).toBeLessThan(diffs[i - 1].totalActiveCombos);
        for (const cell of diffs[i].cells) {
          expect(cell.freqCurrent).toBeLessThanOrEqual(cell.freqPrev);
        }
      }
    }
  });

  it('génère le calque fantôme et l’historique exact du spot de Shishi (KJs au Turn K♣ & 44 au Flop)', () => {
    const shishi = EVOLUTIONARY_FUNNEL_SCENARIOS[0];
    expect(shishi.id).toBe('shishi_triple_barrel_963r_kc_ah');

    const flopDiff = computeStreetMatrixDiff(shishi, 1);
    const cell44 = flopDiff.cells.find((c) => c.hand === '44')!;
    expect(cell44.status).toBe('eliminated_prev');

    const kjInspection = inspectHandFunnelHistory(shishi, 'KJs');
    expect(kjInspection.history[0].unblockedCombos).toBe(4);
    expect(kjInspection.history[1].unblockedCombos).toBe(4);
    expect(kjInspection.history[2].unblockedCombos).toBe(3);
    expect(kjInspection.history[2].blockingCards).toEqual(['Kc']);
    expect(kjInspection.familyAtStreet(2)).toMatchObject({
      familyName: 'KJ',
      baseTotal: 16,
      unblockedTotal: 12,
      blockedTotal: 4,
    });
  });
});
