/** Aléatoire déterministe : SHA-256(graine) -> sfc32. Jamais Math.random. */
export type Rng = () => number; // entier non signé 32 bits

export async function rngFrom(...parts: string[]): Promise<Rng> {
  const bytes = new TextEncoder().encode(JSON.stringify(parts));
  const d = new DataView(await crypto.subtle.digest('SHA-256', bytes));
  let a = d.getUint32(0);
  let b = d.getUint32(4);
  let c = d.getUint32(8);
  let n = d.getUint32(12);
  const next: Rng = () => {
    const t = (((a + b) >>> 0) + n) >>> 0;
    n = (n + 1) >>> 0;
    a = (b ^ (b >>> 9)) >>> 0;
    b = (c + (c << 3)) >>> 0;
    c = ((c << 21) | (c >>> 11)) >>> 0;
    c = (c + t) >>> 0;
    return t;
  };
  for (let i = 0; i < 12; i++) next();
  return next;
}

export function int(rng: Rng, n: number): number {
  if (!Number.isInteger(n) || n <= 0 || n > 2 ** 32) throw new RangeError('n');
  const limit = Math.floor(2 ** 32 / n) * n;
  let x = rng();
  while (x >= limit) x = rng();
  return x % n;
}

export function shuffle<T>(rng: Rng, xs: readonly T[]): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = int(rng, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
