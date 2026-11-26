import type { SpotSolution } from '../../domain/types';
import {
  DRAW_BAND_PD,
  FSRS_THRESHOLDS,
  HINT_PD,
  SCALE,
  TIMEOUT,
  TURNING_POINT_MIN_DIFF_PD,
} from './config';

export type Unit = keyof typeof SCALE;

export interface SpotKey {
  unit: Unit;
  ev: Record<string, number>;
  defaultAction: string;
  trivial: boolean;
}

export interface Answer {
  action: string | null;
  elapsedMs: number;
  usedHint: boolean;
}

export interface SpotScore {
  loss: number;
  pd: number;
  perfect: boolean;
  timeout: boolean;
  countedMs: number;
}

export function rawLoss(key: SpotKey, action: string): number {
  if (!(action in key.ev)) throw new Error('action illégale');
  const l = Math.max(...Object.values(key.ev)) - key.ev[action];
  return l <= SCALE[key.unit].epsilon ? 0 : l;
}

export const toPd = (loss: number, unit: Unit) =>
  Math.min(1000, Math.round((1000 * loss) / SCALE[unit].cap));

export function scoreSpot(key: SpotKey, a: Answer, limitMs: number, ranked: boolean): SpotScore {
  if (ranked && a.usedHint) throw new Error('indice interdit en classé');
  const timeout = a.action === null || a.elapsedMs > limitMs;
  const loss = rawLoss(key, timeout ? key.defaultAction : a.action!);
  let pd = toPd(loss, key.unit);
  if (timeout) pd = Math.min(1000, Math.max(pd + TIMEOUT.penaltyPd, TIMEOUT.floorPd));
  if (a.usedHint) pd = Math.min(1000, pd + HINT_PD);
  return {
    loss,
    pd,
    perfect: pd === 0,
    timeout,
    countedMs: key.trivial ? 0 : Math.min(a.elapsedMs, limitMs),
  };
}

/** Note un spot de type `ev` ou `estimate` selon la solution exacte (Bible p.7-8 & p.12). */
export function scoreSolution(
  sol: SpotSolution,
  actionRaw: string | null,
  elapsedMs: number,
  limitMs: number,
  usedHint: boolean,
  ranked: boolean
): { score: SpotScore; lossUnit: Unit | null } {
  if (ranked && usedHint) throw new Error('indice interdit en classé');
  if (sol.kind === 'weights') {
    if (ranked) throw new Error('weights non éligible au classé');
    return {
      score: { loss: 0, pd: 0, perfect: true, timeout: actionRaw === null, countedMs: Math.min(elapsedMs, limitMs) },
      lossUnit: null,
    };
  }
  if (sol.kind === 'ev') {
    return {
      score: scoreSpot(
        { unit: sol.unit, ev: sol.ev, defaultAction: sol.defaultAction, trivial: sol.trivial },
        { action: actionRaw, elapsedMs, usedHint },
        limitMs,
        ranked
      ),
      lossUnit: sol.unit,
    };
  }
  // sol.kind === 'estimate'
  const timeout = actionRaw === null || elapsedMs > limitMs;
  let pd: number;
  if (timeout) {
    pd = TIMEOUT.floorPd;
  } else {
    const parsed = Number(actionRaw);
    if (!Number.isFinite(parsed)) throw new Error('estimation numérique invalide');
    pd = estimatePd(parsed, sol.truthPct, sol.tolerance, sol.zeroAt);
  }
  if (timeout) pd = Math.min(1000, Math.max(pd, TIMEOUT.floorPd));
  if (usedHint) pd = Math.min(1000, pd + HINT_PD);
  return {
    score: {
      loss: pd,
      pd,
      perfect: pd === 0,
      timeout,
      countedMs: Math.min(elapsedMs, limitMs),
    },
    lossUnit: null,
  };
}

export interface Totals {
  pd: number;
  perfects: number;
  ms: number;
}

export const totals = (s: SpotScore[]): Totals =>
  s.reduce(
    (t, x) => ({
      pd: t.pd + x.pd,
      perfects: t.perfects + (x.perfect ? 1 : 0),
      ms: t.ms + x.countedMs,
    }),
    { pd: 0, perfects: 0, ms: 0 }
  );

/** Résultat classé (pour A) : seule la précision compte. */
export const ratedOutcome = (a: Totals, b: Totals): 0 | 0.5 | 1 =>
  Math.abs(a.pd - b.pd) <= DRAW_BAND_PD ? 0.5 : a.pd < b.pd ? 1 : 0;

/** Ordre des leaderboards : PD, puis perfects, puis temps au dixième de seconde. */
export const compareForBoard = (a: Totals, b: Totals) =>
  a.pd - b.pd || b.perfects - a.perfects || Math.floor(a.ms / 100) - Math.floor(b.ms / 100);

/** Jeux d'estimation et d'entonnoir. */
export const estimatePd = (answerPct: number, truthPct: number, tol = 1.5, zeroAt = 15) => {
  const e = Math.abs(answerPct - truthPct);
  return e <= tol ? 0 : Math.min(1000, Math.round((1000 * (e - tol)) / (zeroAt - tol)));
};

export function funnelPd(player: Record<string, number>, ref: Record<string, number>): number {
  const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);
  const sp = sum(player);
  const sr = sum(ref);
  if (!(sr > 0)) throw new Error('référence vide');
  if (!(sp > 0)) return 1000;
  let overlap = 0;
  for (const k of Object.keys(ref)) overlap += Math.min((player[k] ?? 0) / sp, ref[k] / sr);
  return Math.max(0, Math.round(1000 * (1 - overlap)));
}

/** Traduit un SpotScore en note FSRS (Bible p.8). */
export function gradeFromPd(score: SpotScore, limitMs: number, usedHint: boolean): 1 | 2 | 3 | 4 {
  if (score.timeout || score.pd > FSRS_THRESHOLDS.againPd) return 1;
  if (
    usedHint ||
    score.pd > FSRS_THRESHOLDS.hardPd ||
    score.countedMs > FSRS_THRESHOLDS.hardTimeRatio * limitMs
  ) {
    return 2;
  }
  return score.countedMs < FSRS_THRESHOLDS.easyTimeRatio * limitMs ? 4 : 3;
}

/** Turning Points (Bible p.15 & MP-08) : écart STRICTEMENT > 100 PD (101 signalé, 100 non signalé). */
export function turningPoints(
  heroScores: readonly SpotScore[],
  oppScores: readonly SpotScore[],
  minDiffPd = TURNING_POINT_MIN_DIFF_PD
): { spotIndex: number; heroPd: number; oppPd: number; diff: number }[] {
  const out: { spotIndex: number; heroPd: number; oppPd: number; diff: number }[] = [];
  const n = Math.min(heroScores.length, oppScores.length);
  for (let i = 0; i < n; i++) {
    const heroPd = heroScores[i].pd;
    const oppPd = oppScores[i].pd;
    const diff = Math.abs(heroPd - oppPd);
    if (diff > minDiffPd) {
      out.push({ spotIndex: i, heroPd, oppPd, diff });
    }
  }
  return out.sort((a, b) => b.diff - a.diff || a.spotIndex - b.spotIndex);
}

/** Signaux d'intégrité pour revue humaine uniquement (aucune sanction automatique, Bible p.31-32). */
export function detectTimingAnomaly(
  records: readonly { elapsedMs: number; pd: number }[]
): { flagged: boolean; reason: string | null } {
  if (records.length < 10) return { flagged: false, reason: null };
  const times = records.map((r) => r.elapsedMs);
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  const variance = times.reduce((a, t) => a + (t - mean) ** 2, 0) / times.length;
  if (Math.sqrt(variance) < 15) {
    return { flagged: true, reason: 'Signal de revue : écart-type temporel < 15 ms.' };
  }
  const allPerfect = records.length >= 12 && records.every((r) => r.pd === 0);
  if (allPerfect && mean > 6500) {
    return { flagged: true, reason: 'Signal de revue : réponses lentes répétées à 0 PD.' };
  }
  return { flagged: false, reason: null };
}
