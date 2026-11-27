import { describe, expect, it } from 'vitest';
import {
  applyVillainProfileAdaptation,
  buildDefenseDrillQuestions,
  computeMdfVs3Bet,
  computeRange3BetStats,
  DEFAULT_3BET_SPOTS,
  exportHandsToNotation,
  handsArrayToMap,
  parseNotationIntoHands,
  type Range3BetSpot,
} from '../../src/engines/rangeBuilder3Bet.ts';

describe('rangeBuilder3Bet engine', () => {
  it('conserves combos strictly over openHands and sums Hamilton defense % to 100%', () => {
    for (const spot of DEFAULT_3BET_SPOTS) {
      const stats = computeRange3BetStats(spot);
      expect(stats.openCombos).toBeGreaterThan(0);
      expect(
        stats.fourbetValueCombos +
          stats.fourbetBluffCombos +
          stats.callCombos +
          stats.foldCombos,
      ).toBe(stats.openCombos);

      expect(
        stats.fourbetValuePct + stats.fourbetBluffPct + stats.callPct + stats.foldPct,
      ).toBe(100);
      expect(stats.fourbetBluffCombos).toBeGreaterThan(0);
      expect(stats.fourbetValueCombos).toBeGreaterThan(0);
    }
  });

  it('ignores defenseMap entries outside openHands (non-open lock)', () => {
    const base = DEFAULT_3BET_SPOTS[0];
    const baseStats = computeRange3BetStats(base);

    const polluted: Range3BetSpot = {
      ...base,
      openHands: { ...base.openHands },
      defenseMap: {
        ...base.defenseMap,
        '72o': 'fourbet_bluff',
        '32o': 'call',
        '92o': 'fourbet_value',
      },
    };
    expect(polluted.openHands['72o']).toBeUndefined();

    const pollutedStats = computeRange3BetStats(polluted);
    expect(pollutedStats.openCombos).toBe(baseStats.openCombos);
    expect(pollutedStats.fourbetBluffCombos).toBe(baseStats.fourbetBluffCombos);
    expect(pollutedStats.callCombos).toBe(baseStats.callCombos);
    expect(pollutedStats.fourbetValueCombos).toBe(baseStats.fourbetValueCombos);
  });

  it('computes exact MDF and Alpha for IP and OOP 3-Bets (MDF + Alpha === 100)', () => {
    // CO 2.5bb vs BTN 8.5bb (dead 1.5bb => pot before 3bet = 4.0bb, villain risks 8.5bb)
    const oopMdf = computeMdfVs3Bet(2.5, 8.5, 1.5, 'BTN');
    expect(oopMdf.potBeforeVillainBb).toBe(4);
    expect(oopMdf.villainRiskBb).toBe(8.5);
    expect(oopMdf.mdfPct + oopMdf.alphaPct).toBeCloseTo(100, 1);
    expect(oopMdf.mdfPct).toBeCloseTo((4 / 12.5) * 100, 1);

    // BTN 2.5bb vs BB 10bb (BB already posted 1bb => pot before = 4.0bb, villain risks 9.0bb)
    const bbMdf = computeMdfVs3Bet(2.5, 10, 1.5, 'BB');
    expect(bbMdf.villainRiskBb).toBe(9);
    expect(bbMdf.mdfPct).toBeCloseTo((4 / 13) * 100, 1);
    expect(bbMdf.potOddsPct).toBeCloseTo((7.5 / 20.5) * 100, 1);
  });

  it('adapts to nit (0 bluffs), reg, and aggro without modifying openHands', () => {
    const coSpot = DEFAULT_3BET_SPOTS[0];
    const nitSpot = applyVillainProfileAdaptation(coSpot, 'nit');
    const aggroSpot = applyVillainProfileAdaptation(coSpot, 'aggro');

    const nitStats = computeRange3BetStats(nitSpot);
    const aggroStats = computeRange3BetStats(aggroSpot);

    expect(nitSpot.openHands).toEqual(coSpot.openHands);
    expect(nitStats.fourbetBluffCombos).toBe(0);
    expect(nitStats.fourbetValueCombos).toBe(12); // AA (6) + KK (6)
    expect(aggroStats.defendCombos).toBeGreaterThan(nitStats.defendCombos);
    expect(aggroStats.fourbetBluffCombos).toBeGreaterThan(0);
  });

  it('supports Equilab notation round-trip parsing and export', () => {
    const hands = parseNotationIntoHands('JJ+, ATs+, A5s-A2s, KQo');
    const exported = exportHandsToNotation(hands);
    const reparsed = parseNotationIntoHands(exported);
    expect(reparsed).toEqual(hands);
    expect(hands).toContain('AA');
    expect(hands).toContain('A5s');
    expect(hands).toContain('A2s');
    expect(hands).toContain('KQo');
    expect(hands).not.toContain('TT');
  });

  it('builds drill questions exclusively from openHands', () => {
    const custom: Range3BetSpot = {
      ...DEFAULT_3BET_SPOTS[0],
      openHands: handsArrayToMap(['AA', 'KK', 'A5s', 'JJ', 'KJs', '98s']),
      defenseMap: {
        AA: 'fourbet_value',
        KK: 'fourbet_value',
        A5s: 'fourbet_bluff',
        JJ: 'call',
        KJs: 'call',
        '98s': 'fold',
      },
    };
    const questions = buildDefenseDrillQuestions(custom, 8, 42);
    expect(questions).toHaveLength(6);
    for (const q of questions) {
      expect(custom.openHands[q.hand]).toBe(true);
      expect(q.explanation.length).toBeGreaterThan(20);
    }
  });
});
