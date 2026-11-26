import assert from 'node:assert/strict';
import { icm, icmWithBusts, bubbleFactor, requiredEquityIcm } from './icm.ts';
import * as F from './formats.ts';
import { solvePushFold } from './nash.ts';
import { lines, describeLine, comboCount, blockerImpact } from './chunk.ts';
import * as S from './srs.ts';
import { importFile } from './parser.ts';
import { texture } from './postflop.ts';
import { V2_WEIGHTED_RANGES, expandRangeGroups, simplifyFreqVector25 } from './v2Ranges.ts';

// 1. ICM contre énumération brute (200 configurations de 3 à 8 joueurs)
function brute(s: number[], p: number[]) {
  const ev = s.map(() => 0);
  const rec = (left: number[], d: number, pr: number) => {
    if (d >= p.length || !left.length) return;
    const t = left.reduce((a, i) => a + s[i], 0);
    for (const i of left) {
      const q = (pr * s[i]) / t;
      ev[i] += q * p[d];
      rec(
        left.filter((j) => j !== i),
        d + 1,
        q
      );
    }
  };
  rec(
    s.map((_, i) => i),
    0,
    1
  );
  return ev;
}

for (let t = 0; t < 200; t++) {
  const n = 3 + (t % 6);
  const s = Array.from({ length: n }, (_, i) => 1 + ((t * 37 + i * 91) % 173));
  const p = [50, 30, 20].slice(0, Math.min(3, n));
  icm(s, p).forEach((v, i) => assert.ok(Math.abs(v - brute(s, p)[i]) < 1e-9));
}

// 2. Cas de référence Bulle 4-Max 40/25/20/15 (50/30/20/0) & Expresso 80/12/8
const P = [50, 30, 20, 0];
const St = [40, 25, 20, 15];
assert.ok(Math.abs(bubbleFactor(St, P, 1, 0).bf - 2.377) < 0.005);
assert.ok(Math.abs(bubbleFactor(St, P, 2, 1).bf - 1.869) < 0.005);
assert.ok(Math.abs(bubbleFactor(St, P, 3, 0).bf - 1.830) < 0.005);
assert.ok(Math.abs(bubbleFactor(St, P, 0, 1).bf - 1.490) < 0.005);

const reqEqBulle = requiredEquityIcm({
  start: St,
  ifFold: [41, 24, 20, 15],
  ifWin: [15, 50, 20, 15],
  ifLose: [65, 0, 20, 15],
  hero: 1,
  payouts: P,
});
assert.ok(Math.abs(reqEqBulle - 0.689) < 0.002);

// Expresso Jackpot 80/12/8 (valeurs auditées contre force brute)
const J = [80, 12, 8];
const expChecks: [number[], number, number, number, number][] = [
  [[25, 25, 25], 0, 1, 1.056, 1.35],
  [[45, 20, 10], 2, 0, 1.067, 1.62],
  [[45, 20, 10], 1, 0, 1.113, 2.68],
  [[45, 20, 10], 0, 1, 1.012, 0.3],
];
for (const [stacks, hero, vil, expectedBf, expectedRp] of expChecks) {
  const r = bubbleFactor(stacks, J, hero, vil);
  assert.ok(Math.abs(r.bf - expectedBf) < 0.002, `BF mismatch: ${r.bf} vs ${expectedBf}`);
  assert.ok(Math.abs(100 * r.riskPremium - expectedRp) < 0.05, `RP mismatch`);
}
assert.deepEqual(icmWithBusts([25, 0, 25], J, [25, 25, 25])[1], 8);

// 3. Mystery Bounty (250 000 jetons) & Expresso cEV breakeven
const my = F.bountyAdjusted({
  call: 1,
  finalPot: 2,
  bountyCash: 1000,
  chipsInPlay: 50e6,
  remainingRegularPool: 100000,
  remainingBountyPool: 100000,
});
assert.equal(my.bountyChips, 250000);
assert.ok(Math.abs(F.breakevenCev(500, 0.07) - 37.634) < 0.01);
assert.ok(Math.abs(F.breakevenCev(300, 0.07) - 22.58) < 0.01);
assert.ok(Math.abs(F.breakevenCev(500, 1 - 2.74 / 3) - 47.445) < 0.01);
assert.ok(Math.abs(F.evRoiWta(50, 500, 0.07) - 0.023) < 0.001);

// 4. Nash Push/Fold jouet + Chunking 25 lignes + Bloqueurs
const tb = { eq: [[0.5, 0.8, 0.85], [0.2, 0.5, 0.65], [0.15, 0.35, 0.5]], w: [[1, 1, 1], [1, 1, 1], [1, 1, 1]] };
const nashRes = solvePushFold(tb, 10);
assert.equal(nashRes.push.length, 3);

assert.equal(lines().length, 25);
assert.equal(lines().flatMap((l) => l.hands).length, 169);
assert.equal(lines().flatMap((l) => l.hands).reduce((a, h) => a + comboCount(h), 0), 1326);
const set = new Set(['AKs', 'AQs', 'AJs', 'ATs', 'A5s', 'A4s']);
const desc = describeLine(lines()[1], (h) => (set.has(h) ? 1 : 0));
assert.equal(desc.floor, 'ATs');
assert.deepEqual(desc.islands, ['A5s', 'A4s']);
assert.deepEqual(blockerImpact('A5s'), { AA: 3, KK: 6, QQ: 6, AK: 12, AQ: 12 });

// 5. SRS, Score de Maîtrise, Beta leakProbability, Daily Warmup (<= 300s, entrelacé)
assert.equal(S.gradeAttempt({ evLossBb: 0, freqError: 0, ms: 1000, limitMs: 5000, usedHint: false }), 4);
assert.equal(S.gradeAttempt({ evLossBb: 0.15, freqError: 0, ms: 1000, limitMs: 5000, usedHint: false }), 1);
assert.ok(Math.abs(S.betaCdfInt(0.5, 3, 3) - 0.5) < 1e-9);
assert.ok(S.leakProbability({ k: 9, n: 30, low: 0.4, high: 0.55 }).p > 0.85);
assert.ok(S.leakProbability({ k: 90, n: 300, low: 0.4, high: 0.55 }).p > 0.99);
assert.equal(S.masteryScore({ successes: 3, failures: 0, retrievability: 1, fastShare: 1, transferShare: 1 }) <= 25, true);

const cands = Array.from({ length: 60 }, (_, i) => ({
  id: '' + i,
  family: ['pre', 'post', 'icm', 'math'][i % 4],
  kind: (['due', 'leak', 'new', 'transfer'] as const)[(i >> 2) % 4],
  priority: Math.sin(i),
  seconds: 12,
}));
const warmup = S.buildWarmup(cands);
assert.ok(warmup.reduce((a, x) => a + x.seconds, 0) <= 300);

// 6. Parseur Winamax + PokerStars & Texture Flop
const w = `Winamax Poker - CashGame - HandId: #123-45-678 - Holdem no limit (0.01€/0.02€) - 2026/11/01 20:00:00 UTC
Table: 'Demo' 5-max (real money) Seat #1 is the button
Seat 1: Alpha (2€)
Seat 2: Hero Two (2.10€)
Seat 3: Gamma (1.50€)
*** ANTE/BLINDS ***
Hero Two posts small blind 0.01€
Gamma posts big blind 0.02€
Dealt to Hero Two [As 5s]
*** PRE-FLOP ***
Alpha raises 0.03€ to 0.05€
Hero Two raises 0.15€ to 0.20€
Gamma folds
Alpha calls 0.15€
*** FLOP *** [Ks 7d 2c]
Hero Two bets 0.13€
Alpha folds
*** SUMMARY ***
Total pot 0.55€`;

const p = `PokerStars Hand #200000000001:  Hold'em No Limit (€0.01/€0.02 EUR) - 2026/11/01 20:00:00 CET
Table 'Demo' 6-max Seat #1 is the button
Seat 1: Alpha (€2.00 in chips)
Seat 2: Beta (€2.00 in chips)
Beta: posts small blind €0.01
Alpha: posts big blind €0.02
*** HOLE CARDS ***
Dealt to Alpha [Ah Kd]
Beta: raises €0.04 to €0.06
Alpha: calls €0.04
*** FLOP *** [Qh Jh 2s]
Alpha: checks
Beta: bets €0.06 and is all-in
Alpha: folds
*** SUMMARY ***
Total pot €0.12`;

const imp = importFile(w + '\n\n\n' + p);
assert.deepEqual(imp.errors, []);
assert.equal(imp.hands.length, 2);
assert.equal(imp.hands[0].actions.length, 6);
assert.equal(imp.hands[1].actions.length, 5);
assert.equal(importFile(w, new Set(imp.hands.map((h) => h.key))).duplicates, 1);
assert.deepEqual(texture(['Ks', '7d', '2c']), { high: 'broadway', paired: false, trips: false, suits: 'rainbow', connectivity: 0 });
assert.deepEqual(texture(['As', '5d', '3c']), { high: 'A', paired: false, trips: false, suits: 'rainbow', connectivity: 2 });
assert.deepEqual(texture(['6d', '5c', '4c']), { high: 'low', paired: false, trips: false, suits: 'twotone', connectivity: 2 });

// 7. Validation des 7 ranges pondérées V2 (somme = 1 par main, pas de doublon, simplification 25%)
for (const spec of V2_WEIGHTED_RANGES) {
  const seen = new Set<string>();
  for (const grp of spec.groups) {
    const sumFreq = Object.values(grp.freq).reduce((s, v) => s + (v ?? 0), 0);
    assert.ok(Math.abs(sumFreq - 1) < 1e-6, `Sum != 1 in ${spec.id}`);
    const simp = simplifyFreqVector25(grp.freq);
    const sumSimp = Object.values(simp).reduce((s, v) => s + (v ?? 0), 0);
    assert.ok(Math.abs(sumSimp - 1) < 1e-6, `Simplified sum != 1 in ${spec.id}`);
    for (const h of grp.hands) {
      assert.ok(!seen.has(h), `Duplicate hand ${h} in ${spec.id}`);
      seen.add(h);
    }
  }
  const expanded = expandRangeGroups(spec.groups);
  assert.equal(Object.keys(expanded).length, seen.size);
}

console.log('VERIFY_V2 ALL OK (ICM, PKO, Expresso, Nash, Chunk, SRS, Parser, 7 V2 Ranges)');
