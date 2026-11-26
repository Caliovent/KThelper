import type { ProPokerSuiteStateV3, ReviewEvent, ReviewEventV3 } from '../../domain/types';
import { FSRS_THRESHOLDS } from './config';
import { ReviewEventV3Schema } from './schemas';

export function makeMultiplayerEventId(matchId: string, spotIndex: number): string {
  return `mp:${matchId}:${spotIndex}`;
}

export function createMultiplayerReviewEvent(params: {
  matchId: string;
  spotIndex: number;
  skillId: string;
  grade: 1 | 2 | 3 | 4;
  ms: number;
  evLossBb: number | null;
  pd: number;
  variantSeed: string;
  at?: string;
}): ReviewEventV3 {
  const ev: ReviewEventV3 = {
    id: makeMultiplayerEventId(params.matchId, params.spotIndex),
    skillId: params.skillId,
    at: params.at ?? new Date().toISOString(),
    grade: params.grade,
    ms: params.ms,
    evLossBb: params.evLossBb,
    variantSeed: params.variantSeed,
    source: 'multiplayer',
    matchId: params.matchId,
    pd: params.pd,
    // Réussite en MP = provisional (ne compte pas dans M), échec = confirmed immédiatement (Bible p.8)
    confirmation: params.grade === 1 ? 'confirmed' : 'provisional',
  };
  return ReviewEventV3Schema.parse(ev);
}

/** Ajoute les événements MP de façon idempotente en excluant les spots déjà vus ou spoilés. */
export function appendMultiplayerReviews(
  existing: readonly ReviewEventV3[],
  incoming: readonly ReviewEventV3[],
  spoiledOrSeenIds: ReadonlySet<string> = new Set()
): ReviewEventV3[] {
  const seenIds = new Set(existing.map((e) => e.id));
  const out = [...existing];
  for (const ev of incoming) {
    if (seenIds.has(ev.id) || spoiledOrSeenIds.has(ev.id) || spoiledOrSeenIds.has(ev.variantSeed)) {
      continue;
    }
    seenIds.add(ev.id);
    out.push(ev);
  }
  return out;
}

/** Une réussite solo à froid au moins 7 jours après le MP confirme l'événement provisoire pour M. */
export function confirmProvisionalReviews(
  events: readonly ReviewEventV3[],
  skillId: string,
  soloReviewAtMs: number
): ReviewEventV3[] {
  return events.map((ev) => {
    if (
      ev.source === 'multiplayer' &&
      ev.skillId === skillId &&
      ev.confirmation === 'provisional' &&
      ev.grade >= 2
    ) {
      const playedMs = Date.parse(ev.at);
      if (Number.isFinite(playedMs) && soloReviewAtMs - playedMs >= FSRS_THRESHOLDS.confirmDelayMs) {
        return { ...ev, confirmation: 'confirmed' };
      }
    }
    return ev;
  });
}

/** Calcule les compteurs pris en compte dans le Score de Maîtrise M (Bible p.8). */
export function computeMasteryCountsFromReviews(events: readonly ReviewEventV3[]): {
  confirmedSuccesses: number;
  provisionalSuccesses: number;
  failures: number;
} {
  let confirmedSuccesses = 0;
  let provisionalSuccesses = 0;
  let failures = 0;

  for (const ev of events) {
    if (ev.grade === 1) {
      failures += 1;
      continue;
    }
    if (ev.source === 'multiplayer' && ev.confirmation !== 'confirmed') {
      provisionalSuccesses += 1;
    } else {
      confirmedSuccesses += 1;
    }
  }
  return { confirmedSuccesses, provisionalSuccesses, failures };
}

/** Migre une sauvegarde ProPokerSuiteState schemaVersion: 2 vers schemaVersion: 3 (Bible p.8). */
export function migrateSuiteStateToV3(raw: Record<string, unknown>): ProPokerSuiteStateV3 {
  const baseSrs = (raw.srs as Record<string, unknown> | undefined) ?? {};
  const rawLog = Array.isArray(baseSrs.log) ? (baseSrs.log as (ReviewEvent | ReviewEventV3)[]) : [];
  const normalizedLog: ReviewEventV3[] = rawLog.map((item) => {
    const rev = item as ReviewEventV3;
    return {
      ...rev,
      confirmation:
        rev.source === 'multiplayer'
          ? rev.confirmation ?? (rev.grade === 1 ? 'confirmed' : 'provisional')
          : 'confirmed',
    };
  });

  const profile = (raw.profile as ProPokerSuiteStateV3['profile'] | undefined) ?? {
    xp: 0,
    level: 1,
    videosDone: [],
    quizAnswered: {},
  };
  const settings = (raw.settings as ProPokerSuiteStateV3['settings'] | undefined) ?? {
    locale: 'fr',
    desiredRetention: 0.9,
    aiEnabled: true,
    geminiModel: 'gemini-4-hydrogen',
  };

  return {
    schemaVersion: 3,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : new Date().toISOString(),
    appVersion: typeof raw.appVersion === 'string' ? raw.appVersion : '2.1.0',
    profile,
    settings,
    ranges: Array.isArray(raw.ranges) ? (raw.ranges as ProPokerSuiteStateV3['ranges']) : [],
    srs: {
      engine: 'ts-fsrs',
      parameters: baseSrs.parameters ?? null,
      skills: (baseSrs.skills as ProPokerSuiteStateV3['srs']['skills']) ?? {},
      log: normalizedLog,
    },
    bankroll: (raw.bankroll as ProPokerSuiteStateV3['bankroll']) ?? { sessions: [], movements: [] },
    hands: (raw.hands as ProPokerSuiteStateV3['hands']) ?? { index: [] },
    leaks: Array.isArray(raw.leaks) ? (raw.leaks as ProPokerSuiteStateV3['leaks']) : [],
    aiReviews: Array.isArray(raw.aiReviews) ? (raw.aiReviews as ProPokerSuiteStateV3['aiReviews']) : [],
    legacy: (raw.legacy as Record<string, string> | undefined) ?? undefined,
  };
}
