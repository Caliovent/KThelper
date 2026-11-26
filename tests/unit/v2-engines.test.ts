import { describe, expect, it } from 'vitest';
import { bubbleFactor, icm, requiredEquityIcm } from '../../src/engines/icm';
import {
  bountyAdjusted,
  breakevenCev,
  evItmWta,
  evRoiWta,
  rake,
  riskOfRuin,
  winrateCi95,
} from '../../src/engines/formats';
import { blockerImpact, comboCount, describeLine, lines } from '../../src/engines/chunk';
import { texture } from '../../src/engines/postflop';
import { buildWarmup, gradeAttempt, leakProbability, masteryScore } from '../../src/engines/srs';
import { detectSite, importFile, parseHand, splitHands } from '../../src/engines/parser';
import { expandRangeGroups, simplifyFreqVector25, V2_WEIGHTED_RANGES } from '../../src/engines/v2Ranges';

describe('Pro Poker Suite V2 — Moteurs mathématiques purs', () => {
  it('calcule exactement ICM, Bubble Factor et requiredEquityIcm (Bulle 4-Max & Expresso 80/12/8)', () => {
    const P = [50, 30, 20, 0];
    const St = [40, 25, 20, 15];
    const ev = icm(St, P);
    expect(ev.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 6);
    expect(bubbleFactor(St, P, 1, 0).bf).toBeCloseTo(2.377, 2);
    expect(bubbleFactor(St, P, 2, 1).bf).toBeCloseTo(1.869, 2);

    const req = requiredEquityIcm({
      start: St,
      ifFold: [41, 24, 20, 15],
      ifWin: [15, 50, 20, 15],
      ifLose: [65, 0, 20, 15],
      hero: 1,
      payouts: P,
    });
    expect(req).toBeCloseTo(0.689, 2);

    const j = [80, 12, 8];
    expect(bubbleFactor([25, 25, 25], j, 0, 1).bf).toBeCloseTo(1.056, 2);
    expect(bubbleFactor([45, 20, 10], j, 2, 0).bf).toBeCloseTo(1.067, 2);
    expect(bubbleFactor([45, 20, 10], j, 1, 0).bf).toBeCloseTo(1.113, 2);
  });

  it('calcule PKO Bounty Power, Expresso EVROI, Rake, Risk of Ruin et IC 95%', () => {
    const b = bountyAdjusted({
      call: 18000,
      finalPot: 40000,
      bountyCash: 10,
      chipsInPlay: 2500000,
      remainingRegularPool: 1250,
      remainingBountyPool: 1250,
    });
    expect(b.bountyPower).toBe(1000);
    expect(b.chipEv).toBeCloseTo(0.45, 4);
    expect(b.withBounty).toBeCloseTo(0.36, 4);

    expect(breakevenCev(500, 0.07)).toBeCloseTo(37.634, 2);
    expect(evItmWta(65, 500)).toBeCloseTo(0.37666, 3);
    expect(evRoiWta(65, 500, 0.07)).toBeCloseTo(0.0509, 3);

    expect(rake(100, 0.0575, 2, true, true)).toBe(2);
    expect(rake(100, 0.0575, 2, false, true)).toBe(0);
    expect(riskOfRuin(5, 80, 5000)).toBeCloseTo(Math.exp((-2 * 5 * 5000) / 6400), 6);
    const [lo, hi] = winrateCi95(6, 80, 10000);
    expect(lo).toBeLessThan(6);
    expect(hi).toBeGreaterThan(6);
  });

  it('chunking 25 lignes, bloqueurs et textures postflop', () => {
    const allLines = lines();
    expect(allLines).toHaveLength(25);
    const pairsLine = describeLine(allLines[0], (h) => (['AA', 'KK', 'QQ', '77'].includes(h) ? 1 : 0));
    expect(pairsLine.floor).toBe('QQ');
    expect(pairsLine.islands).toEqual(['77']);

    expect(comboCount('AKs')).toBe(4);
    expect(comboCount('AA')).toBe(6);
    expect(comboCount('AKo')).toBe(12);
    expect(blockerImpact('A5s')).toEqual({ AA: 3, KK: 6, QQ: 6, AK: 12, AQ: 12 });

    const t = texture(['As', 'Kd', '4c']);
    expect(t).toEqual({ high: 'A', paired: false, trips: false, suits: 'rainbow', connectivity: 1 });
    expect(texture(['Ks', '8d', '2c']).connectivity).toBe(0);
    expect(texture(['Jh', '9s', '8d']).connectivity).toBe(2);
  });

  it('SRS (notes, masteryScore, probabilités bayésiennes, warm-up), parseur HH et ranges V2', () => {
    expect(gradeAttempt({ evLossBb: 0, freqError: 0, ms: 2000, limitMs: 10000, usedHint: false })).toBe(4);
    expect(gradeAttempt({ evLossBb: 0.25, freqError: 1, ms: 2000, limitMs: 10000, usedHint: false })).toBe(1);
    expect(masteryScore({ successes: 10, failures: 2, retrievability: 0.9, fastShare: 0.8, transferShare: 0.5 })).toBeGreaterThan(50);

    const leak = leakProbability({ k: 2, n: 20, low: 0.25, high: 0.4 });
    expect(leak.direction).toBe('trop_bas');
    expect(leak.p).toBeGreaterThan(0.8);

    const warmup = buildWarmup(
      [
        { id: 'd1', family: 'cash', kind: 'due', priority: 90, seconds: 60 },
        { id: 'l1', family: 'icm', kind: 'leak', priority: 95, seconds: 60 },
        { id: 'n1', family: 'exp', kind: 'new', priority: 70, seconds: 40 },
      ],
      300
    );
    expect(warmup.length).toBeGreaterThanOrEqual(2);

    const raw = `Winamax Poker - CashGame - HandId: #20261125-001 - Holdem no limit (0.01€/0.02€) - 2026/11/25 18:10:00 UTC
Table: 'Paris 04' 5-max Seat #1 is the button
Seat 1: Hero (2.00€)
Seat 2: Villain1 (2.00€)
*** ANTE/BLINDS ***
Villain1 posts small blind 0.01€
Dealt to Hero [As Ks]
*** PRE-FLOP ***
Hero raises 0.04€ to 0.06€
Villain1 folds
*** SUMMARY ***`;
    expect(splitHands(raw)).toHaveLength(1);
    expect(detectSite(raw)).toBe('winamax');
    expect(parseHand(raw).hero).toBe('Hero');
    const imp = importFile(raw);
    expect(imp.hands).toHaveLength(1);
    expect(imp.duplicates).toBe(0);

    expect(V2_WEIGHTED_RANGES.length).toBe(7);
    const expanded = expandRangeGroups(V2_WEIGHTED_RANGES[0].groups);
    expect(Object.keys(expanded).length).toBeGreaterThan(20);
    const simp = simplifyFreqVector25({ '3b': 0.4, c: 0.6 });
    expect(Object.values(simp).reduce((a, b) => a + (b ?? 0), 0)).toBeCloseTo(1, 6);
  });
});
