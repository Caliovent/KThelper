/** Push/fold SB vs BB, ChipEV. eq[i][j] = équité de la classe i contre j.
 *  w[i][j] = nombre de paires de combos compatibles (retrait de cartes), à précalculer hors ligne. */
export interface PreflopTables {
  eq: number[][];
  w: number[][];
}

export function solvePushFold(
  t: PreflopTables,
  stack: number,
  ante = 0,
  iterations = 2000
) {
  const n = t.eq.length;
  const push = new Float64Array(n).fill(0.5);
  const call = new Float64Array(n).fill(0.5);
  const dead = 1.5 + ante;
  const pot = 2 * stack + ante; // stack inclut la blinde, exclut l'ante

  for (let it = 0; it < iterations; it++) {
    const step = 1 / (it + 2);
    const bp = new Uint8Array(n);
    const bc = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      let all = 0;
      let called = 0;
      let eqSum = 0;
      for (let j = 0; j < n; j++) {
        const k = t.w[i][j] * call[j];
        all += t.w[i][j];
        called += k;
        eqSum += k * t.eq[i][j];
      }
      const pc = called / all;
      const e = called > 0 ? eqSum / called : 0;
      const evPush = (1 - pc) * dead + pc * (e * pot - (stack - 0.5));
      bp[i] = evPush > 0 ? 1 : 0;
    }
    for (let j = 0; j < n; j++) {
      let r = 0;
      let eqSum = 0;
      for (let i = 0; i < n; i++) {
        const k = t.w[j][i] * push[i];
        r += k;
        eqSum += k * t.eq[j][i];
      }
      bc[j] = r > 0 && (eqSum / r) * pot - (stack - 1) > 0 ? 1 : 0;
    }
    for (let i = 0; i < n; i++) {
      push[i] += step * (bp[i] - push[i]);
      call[i] += step * (bc[i] - call[i]);
    }
  }
  return { push, call };
}
