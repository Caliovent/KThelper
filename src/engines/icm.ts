/** Malmuth-Harville exact, O(N·2^N). stacks > 0 ; N <= 16. payouts[0] = 1re place. */
export function icm(stacks: readonly number[], payouts: readonly number[]): number[] {
  const n = stacks.length;
  if (n > 16 || stacks.some((s) => !(s > 0))) {
    throw new RangeError('1..16 tapis strictement positifs');
  }
  const ev = new Array<number>(n).fill(0);
  const dp = new Float64Array(1 << n);
  dp[0] = 1;
  const total = stacks.reduce((a, b) => a + b, 0);
  for (let mask = 0; mask < 1 << n; mask++) {
    if (dp[mask] === 0) continue;
    let placed = 0;
    let rem = total;
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        placed++;
        rem -= stacks[i];
      }
    }
    if (placed >= Math.min(n, payouts.length)) continue;
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) continue;
      const p = (dp[mask] * stacks[i]) / rem;
      ev[i] += p * payouts[placed];
      dp[mask | (1 << i)] += p;
    }
  }
  return ev;
}

/** Comme icm(), mais accepte des tapis à 0 (éliminés dans CE coup).
 *  startStacks départage plusieurs éliminés : le plus gros tapis de départ finit mieux. */
export function icmWithBusts(
  end: readonly number[],
  payouts: readonly number[],
  startStacks: readonly number[]
): number[] {
  const alive = end.map((_, i) => i).filter((i) => end[i] > 0);
  const busted = end
    .map((_, i) => i)
    .filter((i) => end[i] <= 0)
    .sort((a, b) => startStacks[b] - startStacks[a]);
  const out = new Array<number>(end.length).fill(0);
  const sub = icm(
    alive.map((i) => end[i]),
    payouts
  );
  alive.forEach((i, k) => {
    out[i] = sub[k];
  });
  busted.forEach((i, k) => {
    out[i] = payouts[alive.length + k] ?? 0;
  });
  return out;
}

export interface IcmSpot {
  start: number[];
  ifFold: number[];
  ifWin: number[];
  ifLose: number[];
  hero: number;
  payouts: number[];
}

/** Équité minimale pour payer, argent mort inclus. Les partages sont ignorés. */
export function requiredEquityIcm(s: IcmSpot): number {
  const v = (st: number[]) => icmWithBusts(st, s.payouts, s.start)[s.hero];
  const f = v(s.ifFold);
  const w = v(s.ifWin);
  const l = v(s.ifLose);
  return (f - l) / (w - l);
}

/** Confrontation symétrique sans argent mort : sert à la jauge de pression. */
export function bubbleFactor(
  stacks: number[],
  payouts: number[],
  hero: number,
  villain: number
) {
  const risk = Math.min(stacks[hero], stacks[villain]);
  const move = (w: number, l: number) =>
    stacks.map((x, i) => (i === w ? x + risk : i === l ? x - risk : x));
  const now = icm(stacks, payouts)[hero];
  const win = icmWithBusts(move(hero, villain), payouts, stacks)[hero];
  const lose = icmWithBusts(move(villain, hero), payouts, stacks)[hero];
  const bf = (now - lose) / (win - now);
  return { bf, requiredEquity: bf / (1 + bf), riskPremium: bf / (1 + bf) - 0.5 };
}
