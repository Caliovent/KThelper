import { SCALE, TIMEOUT, HINT_PD, DRAW_BAND_PD } from './config';
export type Unit = keyof typeof SCALE;
export interface SpotKey { unit: Unit; ev: Record<string, number>; defaultAction: string; trivial: boolean } // ev en unités entières
export interface Answer { action: string | null; elapsedMs: number; usedHint: boolean }
export interface SpotScore { loss: number; pd: number; perfect: boolean; timeout: boolean; countedMs: number }
export function rawLoss(key: SpotKey, action: string): number {
  if (!(action in key.ev)) throw new Error('action illégale');
  const l = Math.max(...Object.values(key.ev)) - key.ev[action];
  return l <= SCALE[key.unit].epsilon ? 0 : l;
}
export const toPd = (loss: number, unit: Unit) => Math.min(1000, Math.round(1000 * loss / SCALE[unit].cap));
export function scoreSpot(key: SpotKey, a: Answer, limitMs: number, ranked: boolean): SpotScore {
  if (ranked && a.usedHint) throw new Error('indice interdit en classé');
  const timeout = a.action === null || a.elapsedMs > limitMs;
  const loss = rawLoss(key, timeout ? key.defaultAction : a.action!);
  let pd = toPd(loss, key.unit);
  if (timeout) pd = Math.min(1000, Math.max(pd + TIMEOUT.penaltyPd, TIMEOUT.floorPd));
  if (a.usedHint) pd = Math.min(1000, pd + HINT_PD);
  return { loss, pd, perfect: pd === 0, timeout, countedMs: key.trivial ? 0 : Math.min(a.elapsedMs, limitMs) };
}
export interface Totals { pd: number; perfects: number; ms: number }
export const totals = (s: SpotScore[]): Totals => s.reduce((t, x) =>
  ({ pd: t.pd + x.pd, perfects: t.perfects + (x.perfect ? 1 : 0), ms: t.ms + x.countedMs }), { pd: 0, perfects: 0, ms: 0 });
/** Résultat classé (pour A) : seule la précision compte. */
export const ratedOutcome = (a: Totals, b: Totals): 0 | 0.5 | 1 =>
  Math.abs(a.pd - b.pd) <= DRAW_BAND_PD ? 0.5 : a.pd < b.pd ? 1 : 0;
/** Ordre des leaderboards : PD, puis perfects, puis temps au dixième de seconde. */
export const compareForBoard = (a: Totals, b: Totals) =>
  a.pd - b.pd || b.perfects - a.perfects || Math.floor(a.ms / 100) - Math.floor(b.ms / 100);
/** Jeux d'estimation et d'entonnoir. */
export const estimatePd = (answerPct: number, truthPct: number, tol = 1.5, zeroAt = 15) => {
  const e = Math.abs(answerPct - truthPct); return e <= tol ? 0 : Math.min(1000, Math.round(1000 * (e - tol) / (zeroAt - tol)));
};
export function funnelPd(player: Record<string, number>, ref: Record<string, number>): number {
  const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);
  const sp = sum(player), sr = sum(ref); if (!(sr > 0)) throw new Error('référence vide'); if (!(sp > 0)) return 1000;
  let overlap = 0; for (const k of Object.keys(ref)) overlap += Math.min((player[k] ?? 0) / sp, ref[k] / sr);
  return Math.max(0, Math.round(1000 * (1 - overlap)));
}
