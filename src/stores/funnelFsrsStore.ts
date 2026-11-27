import type { Card } from 'ts-fsrs';
import {
  EVOLUTIONARY_FUNNEL_SCENARIOS,
  getScenarioById,
} from '../engines/evolutionaryFunnel';
import {
  buildFunnelWarmupCandidates,
  createFunnelFsrsCard,
  getFunnelCardRetrievability,
  reviewFunnelFsrsCard,
  type FunnelWarmupCandidate,
  type Grade,
} from '../engines/srs';

export const PALM_FUNNEL_STORAGE_KEY = 'pro_poker_palm_funnel_v1';

export interface FunnelScenarioProgress {
  scenarioId: string;
  card: Card;
  lastGrade: Grade | null;
  lastReviewedIso: string | null;
  untimedBestOverlapPct: number;
  timedUnlocked: boolean;
  attemptsCount: number;
}

interface PersistedFunnelCard {
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review?: string;
}

interface PersistedScenarioProgress {
  scenarioId: string;
  card: PersistedFunnelCard;
  lastGrade: Grade | null;
  lastReviewedIso: string | null;
  untimedBestOverlapPct: number;
  timedUnlocked: boolean;
  attemptsCount: number;
}

function hydrateCard(raw: PersistedFunnelCard | undefined): Card {
  if (!raw) return createFunnelFsrsCard();
  return {
    due: new Date(raw.due),
    stability: Number(raw.stability) || 0,
    difficulty: Number(raw.difficulty) || 0,
    elapsed_days: Number(raw.elapsed_days) || 0,
    scheduled_days: Number(raw.scheduled_days) || 0,
    learning_steps: Number(raw.learning_steps) || 0,
    reps: Number(raw.reps) || 0,
    lapses: Number(raw.lapses) || 0,
    state: Number(raw.state) || 0,
    last_review: raw.last_review ? new Date(raw.last_review) : undefined,
  } as Card;
}

function dehydrateCard(card: Card): PersistedFunnelCard {
  return {
    due: card.due instanceof Date ? card.due.toISOString() : new Date(card.due).toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review
      ? card.last_review instanceof Date
        ? card.last_review.toISOString()
        : new Date(card.last_review).toISOString()
      : undefined,
  };
}

function defaultProgress(scenarioId: string): FunnelScenarioProgress {
  return {
    scenarioId,
    card: createFunnelFsrsCard(),
    lastGrade: null,
    lastReviewedIso: null,
    untimedBestOverlapPct: 0,
    timedUnlocked: false,
    attemptsCount: 0,
  };
}

export function loadAllFunnelProgress(): Record<string, FunnelScenarioProgress> {
  const out: Record<string, FunnelScenarioProgress> = {};
  for (const sc of EVOLUTIONARY_FUNNEL_SCENARIOS) {
    out[sc.id] = defaultProgress(sc.id);
  }
  if (typeof window === 'undefined' || !window.localStorage) return out;
  try {
    const raw = window.localStorage.getItem(PALM_FUNNEL_STORAGE_KEY);
    if (!raw) return out;
    const parsed = JSON.parse(raw) as Record<string, PersistedScenarioProgress>;
    for (const [id, row] of Object.entries(parsed)) {
      if (!row || typeof row !== 'object') continue;
      out[id] = {
        scenarioId: id,
        card: hydrateCard(row.card),
        lastGrade: row.lastGrade ?? null,
        lastReviewedIso: row.lastReviewedIso ?? null,
        untimedBestOverlapPct: Number(row.untimedBestOverlapPct) || 0,
        timedUnlocked: Boolean(row.timedUnlocked),
        attemptsCount: Number(row.attemptsCount) || 0,
      };
    }
  } catch {
    return out;
  }
  return out;
}

export function saveAllFunnelProgress(map: Record<string, FunnelScenarioProgress>): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const serialized: Record<string, PersistedScenarioProgress> = {};
    for (const [id, row] of Object.entries(map)) {
      serialized[id] = {
        scenarioId: id,
        card: dehydrateCard(row.card),
        lastGrade: row.lastGrade,
        lastReviewedIso: row.lastReviewedIso,
        untimedBestOverlapPct: row.untimedBestOverlapPct,
        timedUnlocked: row.timedUnlocked,
        attemptsCount: row.attemptsCount,
      };
    }
    window.localStorage.setItem(PALM_FUNNEL_STORAGE_KEY, JSON.stringify(serialized));
  } catch {
    // ignore storage quota errors
  }
}

export function getScenarioProgress(scenarioId: string): FunnelScenarioProgress {
  const all = loadAllFunnelProgress();
  return all[scenarioId] ?? defaultProgress(scenarioId);
}

export function recordFunnelFsrsReview(params: {
  scenarioId: string;
  grade: Grade;
  untimedOverlapPct?: number;
  now?: Date;
}): {
  progress: FunnelScenarioProgress;
  retrievability: number;
  nextDueIso: string;
} {
  const now = params.now ?? new Date();
  const all = loadAllFunnelProgress();
  const current = all[params.scenarioId] ?? defaultProgress(params.scenarioId);
  const reviewed = reviewFunnelFsrsCard(current.card, params.grade, now);

  const nextBest = Math.max(current.untimedBestOverlapPct, params.untimedOverlapPct ?? 0);
  const nextProgress: FunnelScenarioProgress = {
    scenarioId: params.scenarioId,
    card: reviewed.card,
    lastGrade: params.grade,
    lastReviewedIso: now.toISOString(),
    untimedBestOverlapPct: nextBest,
    timedUnlocked: current.timedUnlocked || nextBest >= 80,
    attemptsCount: current.attemptsCount + 1,
  };

  all[params.scenarioId] = nextProgress;
  saveAllFunnelProgress(all);
  return {
    progress: nextProgress,
    retrievability: reviewed.retrievability,
    nextDueIso: reviewed.nextDueIso,
  };
}

export function getFunnelRetrievabilityPct(scenarioId: string, now: Date = new Date()): number {
  const prog = getScenarioProgress(scenarioId);
  if (prog.attemptsCount === 0 && prog.card.reps === 0) return 0;
  return Math.round(getFunnelCardRetrievability(prog.card, now) * 100);
}

export function getFunnelWarmupCandidatesFromStore(now: Date = new Date()): FunnelWarmupCandidate[] {
  const all = loadAllFunnelProgress();
  const rows = EVOLUTIONARY_FUNNEL_SCENARIOS.map((sc) => ({
    scenarioId: sc.id,
    title: sc.title,
    focusHand: sc.quizQuestions[0]?.focusHand ?? 'KJs',
    card: (all[sc.id] ?? defaultProgress(sc.id)).card,
  }));
  return buildFunnelWarmupCandidates(rows, now);
}

export function openFunnelScenarioInUi(scenarioId: string): void {
  const sc = getScenarioById(scenarioId);
  if (typeof window === 'undefined') return;
  const w = window as unknown as {
    switchSuiteTab?: (tab: 'ranges') => void;
    setAppMode?: (mode: 'funnel') => void;
  };
  w.switchSuiteTab?.('ranges');
  w.setAppMode?.('funnel');
  window.dispatchEvent(
    new CustomEvent('propoker-open-funnel-scenario', { detail: { scenarioId: sc.id } })
  );
}
