import type { League, MatchMode, ReviewEventV3 } from '../domain/types';
import { DEFAULT_MP_ENABLED, GLICKO, MAX_ACTIVE_QUESTS, MP_FLAG_STORAGE_KEY } from '../engines/mp/config';
import type { Rating } from '../engines/mp/glicko2';
import { advance, emptyProgress, type QuestEvent, type QuestProgress, type QuestSpec } from '../engines/mp/quests';
import type { SharedHand } from '../engines/mp/share';

export const ARENA_STORAGE_KEY = 'pro_poker_suite_v2_arena';

export function isMpEnabled(): boolean {
  try {
    if (typeof window !== 'undefined' && typeof window.location !== 'undefined') {
      const q = new URLSearchParams(window.location.search).get('mp');
      if (q === '0' || q === 'false') return false;
      if (q === '1' || q === 'true') return true;
    }
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(MP_FLAG_STORAGE_KEY);
      if (stored === 'false') return false;
      if (stored === 'true') return true;
    }
  } catch {
    // Fallback sur la valeur par défaut
  }
  return DEFAULT_MP_ENABLED;
}

export function setMpEnabledFlag(enabled: boolean): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(MP_FLAG_STORAGE_KEY, String(enabled));
    }
  } catch {
    // Ignore
  }
}

export interface ArenaLocalRunSummary {
  id: string;
  at: string;
  mode: MatchMode | 'friendly_practice' | 'onboarding_l0';
  league: League;
  seed: string;
  integrity: 'L0';
  baselineLabel: string;
  heroPd: number;
  baselinePd: number;
  heroPerfects: number;
  heroMs: number;
  outcome: 0 | 0.5 | 1;
}

export interface DailyLocalEntry {
  dayKey: string;
  bestPd: number;
  bestPerfects: number;
  bestMs: number;
  medals: string[];
  runsCount: number;
}

export interface EcurieMember {
  pseudo: string;
  divisionId: string;
  weeklyFsrsVolume: number;
}

export interface SharedEcurieHand {
  id: string;
  sharedAt: string;
  note: string;
  tags: string[];
  hand: SharedHand;
}

export interface EcurieTeam {
  name: string;
  members: EcurieMember[];
  weeklyTargetVolume: number;
  raidsCompleted: number;
  raidBestMeanPd: number | null;
  sharedHands: SharedEcurieHand[];
}

export interface ArenaState {
  schemaVersion: 3;
  pseudo: string;
  ratings: Record<League, Rating>;
  localRuns: ArenaLocalRunSummary[];
  dailyLocalRuns: Record<string, DailyLocalEntry>;
  quests: Record<string, QuestProgress>;
  ecurie: EcurieTeam | null;
  reviewLog: ReviewEventV3[];
  seenSpotVariants: string[];
  gates: {
    bossValidated: boolean;
    retention7dVerified: boolean;
  };
  antiTilt: {
    consecutiveLosses: number;
    soundEnabled: boolean;
    reactionsEnabled: boolean;
    clockMultiplier: 1 | 1.5 | 0;
    roomClosedAttested: boolean;
    firstExperienceDone: boolean;
  };
}

export interface ArenaQuestMeta extends QuestSpec {
  title: string;
  description: string;
  xpReward: number;
}

/** 3 quêtes actives maximum, sans expiration punitive (Bible p.24). */
export const DEFAULT_ARENA_QUESTS: readonly ArenaQuestMeta[] = [
  {
    id: 'quest_correction_icm',
    title: 'Correction Précision ICM',
    description: 'Fenêtre glissante de 15 spots ICM/PKO avec une perte moyenne ≤ 30 PD (hors-indice, inédits).',
    skillPrefix: 'icm.',
    target: 15,
    maxMeanPd: 30,
    consecutive: false,
    xpReward: 120,
  },
  {
    id: 'quest_zero_tilt',
    title: 'Zéro Tilt',
    description: 'Enchaîner 20 décisions consécutives à ≤ 150 PD (remise à zéro au-delà de 150 PD).',
    skillPrefix: '',
    target: 20,
    maxMeanPd: 150,
    criticalPd: 150,
    consecutive: true,
    xpReward: 140,
  },
  {
    id: 'quest_lecture_froide',
    title: 'Lecture Froide (Sans calculatrice)',
    description: 'Réussir 5 estimations de probabilités/cotes exactes à ±1,5 point (0 PD) sans calculatrice externe.',
    skillPrefix: 'pre.',
    target: 5,
    maxMeanPd: 0,
    consecutive: false,
    xpReward: 100,
  },
].slice(0, MAX_ACTIVE_QUESTS);

function initialRatings(): Record<League, Rating> {
  const base = (): Rating => ({ r: GLICKO.r0, rd: GLICKO.rd0, sigma: GLICKO.sigma0 });
  return {
    maths_icm: base(),
    cash: base(),
    mtt_icm: base(),
    expresso: base(),
    all_rounder: base(),
  };
}

function initialQuests(): Record<string, QuestProgress> {
  const out: Record<string, QuestProgress> = {};
  DEFAULT_ARENA_QUESTS.forEach((q) => {
    out[q.id] = emptyProgress();
  });
  return out;
}

export function createDefaultArenaState(): ArenaState {
  return {
    schemaVersion: 3,
    pseudo: 'Joueur_KillTilt',
    ratings: initialRatings(),
    localRuns: [],
    dailyLocalRuns: {},
    quests: initialQuests(),
    ecurie: null,
    reviewLog: [],
    seenSpotVariants: [],
    gates: {
      bossValidated: false,
      retention7dVerified: false,
    },
    antiTilt: {
      consecutiveLosses: 0,
      soundEnabled: false,
      reactionsEnabled: true,
      clockMultiplier: 1,
      roomClosedAttested: false,
      firstExperienceDone: false,
    },
  };
}

export function loadArenaState(): ArenaState {
  const fallback = createDefaultArenaState();
  try {
    const raw = localStorage.getItem(ARENA_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<ArenaState>;
    return {
      schemaVersion: 3,
      pseudo: typeof parsed.pseudo === 'string' && parsed.pseudo.trim() ? parsed.pseudo : fallback.pseudo,
      ratings: { ...fallback.ratings, ...(parsed.ratings ?? {}) },
      localRuns: Array.isArray(parsed.localRuns) ? parsed.localRuns : [],
      dailyLocalRuns:
        parsed.dailyLocalRuns && typeof parsed.dailyLocalRuns === 'object' ? parsed.dailyLocalRuns : {},
      quests: { ...fallback.quests, ...(parsed.quests ?? {}) },
      ecurie: parsed.ecurie ?? null,
      reviewLog: Array.isArray(parsed.reviewLog) ? parsed.reviewLog : [],
      seenSpotVariants: Array.isArray(parsed.seenSpotVariants) ? parsed.seenSpotVariants : [],
      gates: { ...fallback.gates, ...(parsed.gates ?? {}) },
      antiTilt: { ...fallback.antiTilt, ...(parsed.antiTilt ?? {}) },
    };
  } catch {
    return fallback;
  }
}

export function saveArenaState(state: ArenaState): void {
  try {
    localStorage.setItem(ARENA_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore quota errors cleanly
  }
}

export function createDefaultEcurie(
  heroPseudo: string,
  heroDivisionId: string,
  ecurieName = 'Écurie Kill Tilt Entraide'
): EcurieTeam {
  return {
    name: ecurieName.trim() || 'Écurie Kill Tilt Entraide',
    weeklyTargetVolume: 400,
    raidsCompleted: 0,
    raidBestMeanPd: null,
    members: [
      { pseudo: heroPseudo, divisionId: heroDivisionId, weeklyFsrsVolume: 0 },
      { pseudo: 'Membre_B', divisionId: 'grinder', weeklyFsrsVolume: 0 },
      { pseudo: 'Membre_C', divisionId: 'stratege', weeklyFsrsVolume: 0 },
      { pseudo: 'Membre_D', divisionId: 'apprenti', weeklyFsrsVolume: 0 },
    ],
    sharedHands: [],
  };
}

export function applyArenaQuestEvents(
  prevQuests: Record<string, QuestProgress>,
  events: readonly QuestEvent[]
): { nextQuests: Record<string, QuestProgress>; newlyCompleted: ArenaQuestMeta[] } {
  const nextQuests: Record<string, QuestProgress> = { ...prevQuests };
  const newlyCompleted: ArenaQuestMeta[] = [];

  for (const q of DEFAULT_ARENA_QUESTS) {
    let cur = nextQuests[q.id] ?? emptyProgress();
    const wasDone = cur.done;
    for (const ev of events) {
      cur = advance(q, cur, ev);
    }
    nextQuests[q.id] = cur;
    if (!wasDone && cur.done) {
      newlyCompleted.push(q);
    }
  }
  return { nextQuests, newlyCompleted };
}
