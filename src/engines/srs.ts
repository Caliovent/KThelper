import { createEmptyCard, fsrs, Rating, type Card } from 'ts-fsrs';

export type Grade = 1 | 2 | 3 | 4; // Again, Hard, Good, Easy (= Rating de ts-fsrs)

export interface Attempt {
  evLossBb: number | null;
  freqError: number;
  ms: number;
  limitMs: number;
  usedHint: boolean;
}

export function gradeAttempt(a: Attempt): Grade {
  const wrong = a.evLossBb !== null ? a.evLossBb > 0.1 : a.freqError > 0.35;
  if (wrong || a.ms > a.limitMs) return 1;
  if (a.usedHint || a.ms > 0.7 * a.limitMs || (a.evLossBb ?? 0) > 0.03) return 2;
  return a.ms < 0.35 * a.limitMs ? 4 : 3;
}

export interface SkillStats {
  successes: number;
  failures: number;
  retrievability: number;
  fastShare: number;
  transferShare: number;
}

/** 0..100. Poids de départ, à recalibrer sur les données réelles. */
export function masteryScore(s: SkillStats): number {
  const n = s.successes + s.failures;
  const acc = (s.successes + 2) / (n + 4); // a priori Beta(2,2)
  const raw =
    0.45 * acc +
    0.25 * s.retrievability +
    0.15 * s.fastShare +
    0.15 * s.transferShare;
  return Math.round(100 * raw * Math.min(1, n / 12));
}

function logChoose(n: number, k: number) {
  let r = 0;
  for (let i = 1; i <= k; i++) r += Math.log((n - k + i) / i);
  return r;
}

/** P(X < x) pour X ~ Beta(a, b), a et b entiers. */
export function betaCdfInt(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const n = a + b - 1;
  let s = 0;
  for (let j = a; j <= n; j++) {
    s += Math.exp(logChoose(n, j) + j * Math.log(x) + (n - j) * Math.log(1 - x));
  }
  return Math.min(1, s);
}

export interface LeakObs {
  k: number;
  n: number;
  low: number;
  high: number;
}

/** Probabilité que la vraie fréquence soit hors de la bande cible (a priori uniforme). */
export function leakProbability({ k, n, low, high }: LeakObs) {
  const below = betaCdfInt(low, k + 1, n - k + 1);
  const above = 1 - betaCdfInt(high, k + 1, n - k + 1);
  return {
    below,
    above,
    direction: below > above ? ('trop_bas' as const) : ('trop_haut' as const),
    p: Math.max(below, above),
  };
}

export interface Candidate {
  id: string;
  family: string;
  kind: 'due' | 'leak' | 'new' | 'transfer';
  priority: number;
  seconds: number;
}

export function buildWarmup(c: Candidate[], budget = 300): Candidate[] {
  const share = { due: 0.5, leak: 0.25, new: 0.15, transfer: 0.1 };
  const picked: Candidate[] = [];
  let used = 0;
  const take = (x: Candidate) => {
    picked.push(x);
    used += x.seconds;
  };
  const sorted = [...c].sort((a, b) => b.priority - a.priority);
  for (const kind of Object.keys(share) as Candidate['kind'][]) {
    let q = 0;
    for (const x of sorted.filter((y) => y.kind === kind)) {
      if (q + x.seconds <= share[kind] * budget) {
        take(x);
        q += x.seconds;
      }
    }
  }
  for (const x of sorted) {
    if (!picked.includes(x) && used + x.seconds <= budget) take(x);
  }
  // entrelacement : éviter deux familles identiques à la suite
  const out: Candidate[] = [];
  while (picked.length) {
    const i = picked.findIndex((x) => x.family !== out.at(-1)?.family);
    out.push(...picked.splice(i < 0 ? 0 : i, 1));
  }
  return out;
}

export interface FunnelAttemptInput {
  overlapScore: number; // 0..1
  ms: number;
  limitMs: number;
  usedHint: boolean;
  missedMajorDrawer: boolean;
  minorDrawerImbalance: boolean;
}

/** Barème PALM-Funnel FSRS (Lots 3) : Grade 1 (Again) à 4 (Easy). */
export function gradeFunnelAttempt(input: FunnelAttemptInput): Grade {
  if (input.missedMajorDrawer || input.overlapScore < 0.65 || input.ms > input.limitMs) {
    return 1;
  }
  if (
    input.usedHint ||
    input.ms > 0.7 * input.limitMs ||
    input.minorDrawerImbalance ||
    input.overlapScore < 0.85
  ) {
    return 2;
  }
  if (input.ms < 0.35 * input.limitMs && input.overlapScore > 0.9) {
    return 4;
  }
  return 3;
}

const funnelScheduler = fsrs({ enable_fuzz: false });

function toTsFsrsRating(grade: Grade): Rating.Again | Rating.Hard | Rating.Good | Rating.Easy {
  if (grade === 1) return Rating.Again;
  if (grade === 2) return Rating.Hard;
  if (grade === 4) return Rating.Easy;
  return Rating.Good;
}

export function createFunnelFsrsCard(now: Date = new Date()): Card {
  return createEmptyCard(now);
}

export function getFunnelCardRetrievability(card: Card, now: Date = new Date()): number {
  if (card.reps === 0) return 0;
  return funnelScheduler.get_retrievability(card, now, false);
}

export function reviewFunnelFsrsCard(
  card: Card,
  grade: Grade,
  now: Date = new Date()
): { card: Card; retrievability: number; nextDueIso: string } {
  const result = funnelScheduler.next(card, now, toTsFsrsRating(grade));
  const nextCard = result.card;
  return {
    card: nextCard,
    retrievability: getFunnelCardRetrievability(nextCard, now),
    nextDueIso: nextCard.due.toISOString(),
  };
}

export interface FunnelWarmupCandidate extends Candidate {
  source: 'palm_funnel';
  scenarioId: string;
  hand: string;
  spotLabel: string;
  retrievability: number;
}

/**
 * Injecte dans le Daily Warm-up de 5 min les spots Entonnoir ayant une faible Retrievability (< 85%)
 * ou dont l'échéance FSRS est arrivée.
 */
export function buildFunnelWarmupCandidates(
  records: readonly { scenarioId: string; title: string; focusHand: string; card: Card }[],
  now: Date = new Date()
): FunnelWarmupCandidate[] {
  const out: FunnelWarmupCandidate[] = [];
  for (const rec of records) {
    const r = getFunnelCardRetrievability(rec.card, now);
    const isDue = rec.card.due.getTime() <= now.getTime();
    if (r < 0.85 || isDue) {
      out.push({
        id: `funnel-${rec.scenarioId}`,
        family: `funnel_${rec.scenarioId}`,
        kind: rec.card.lapses > 0 || r < 0.7 ? 'leak' : 'due',
        priority: Math.round((1 - Math.min(1, r)) * 100) + (isDue ? 20 : 0),
        seconds: 45,
        source: 'palm_funnel',
        scenarioId: rec.scenarioId,
        hand: rec.focusHand,
        spotLabel: rec.title,
        retrievability: r,
      });
    }
  }
  return out.sort((a, b) => b.priority - a.priority);
}
