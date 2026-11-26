import type { SpotScore } from './scoring';

export const dayKey = (utcMs: number) => `daily-${new Date(utcMs).toISOString().slice(0, 10)}`;

export function medals(s: SpotScore[], expectedSpots = 15): string[] {
  if (s.length !== expectedSpots) return [];
  const pd = s.reduce((a, x) => a + x.pd, 0);
  const clean = s.every((x) => !x.timeout);
  const timed = s.filter((x) => x.countedMs > 0);
  const mean = s.reduce((a, x) => a + x.countedMs, 0) / Math.max(1, timed.length);
  const out: string[] = [];
  if (clean && pd === 0) out.push('chirurgien');
  if (clean && pd < 50 && mean < 2500) out.push('eclair');
  return out;
}

export const MIN_COHORT = 30;

export function trapSpot(rows: { spotIndex: number; answers: number; meanPd: number }[]) {
  return (
    rows
      .filter((r) => r.answers >= MIN_COHORT)
      .sort((a, b) => b.meanPd - a.meanPd || a.spotIndex - b.spotIndex)[0] ?? null
  );
}
