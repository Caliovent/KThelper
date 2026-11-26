/** Toutes les valeurs de réglage du mode multijoueur. Aucune constante magique ailleurs. */
export const RULES_VERSION = 'mp-rules-1';
export const DEFAULT_MP_ENABLED = true;
export const MP_FLAG_STORAGE_KEY = 'pro_poker_suite_mp_enabled';

export const SCALE = {
  // unité entière de perte, seuil négligeable, perte qui vaut 1000 PD
  mbb: { epsilon: 10, cap: 1000 }, // milli-bb (cash, cEV)
  ppm_pp: { epsilon: 100, cap: 10000 }, // millionièmes du prize pool (ICM, PKO)
} as const;

export const TIMEOUT = { penaltyPd: 50, floorPd: 300 } as const;
export const HINT_PD = 150; // amical seulement
export const DRAW_BAND_PD = 100; // écart total <= bande : nul pour le classement
export const TURNING_POINT_MIN_DIFF_PD = 100; // strictement > 100 PD (101 signalé, 100 non signalé)
export const QUOTAS = { frontier: 0.6, transfer: 0.25, mixed: 0.15 } as const;

export const GLICKO = {
  tau: 0.5,
  r0: 1500,
  rd0: 350,
  sigma0: 0.06,
  periodMs: 7 * 864e5,
  provisionalRd: 110,
} as const;

/** Horloges officielles par jeu (Bible p.13). */
export const CLOCK_MS = {
  icm: 8000,
  rafale3max: 4000,
  chrono: 6000,
  depth: 6000,
  estimate: 20000,
  texture: 8000,
  funnel: 20000,
  boss: 20000,
  paint: 25000,
  leak_drill: 8000,
} as const;

/** Seuil d'ouverture d'une ligue classée (Bible p.11). */
export const LEAGUE_OPEN_THRESHOLD = {
  total: 150,
  frontier: 90,
  transfer: 40,
  mixed: 20,
  minFamilies: 5,
} as const;

export const GHOST_LIMITS = {
  prefix: 'KT2.',
  maxUrlChars: 2000,
  maxTokenChars: 24000,
  maxDecompressedBytes: 65536,
} as const;

export const MAX_ACTIVE_QUESTS = 3;

export const FSRS_THRESHOLDS = {
  againPd: 100,
  hardPd: 30,
  hardTimeRatio: 0.7,
  easyTimeRatio: 0.35,
  confirmDelayMs: 7 * 864e5,
} as const;

/** Règles M1 Ghost classé & appariement (Bible p.22 & p.35). */
export const GHOST_RANKED = {
  spotCount: 15,
  expiryMs: 48 * 3600 * 1000,
  pairWindowMs: 30 * 864e5,
  maxPairMatchesInWindow: 3,
  antiRepeatMs: 14 * 864e5,
} as const;

/** Protection anti-tilt serveur (Bible p.28). */
export const ANTI_TILT = {
  forfeitWindowMs: 3600 * 1000,
  maxForfeitsInWindow: 2,
  cooldownMs: 15 * 60 * 1000,
} as const;

/** Daily Top officiel L1 (Bible p.23-24). */
export const DAILY_L1 = {
  spotCount: 15,
  graceCloseMs: 15 * 60 * 1000,
  regularityWindowDays: 7,
  regularityTarget: 5,
} as const;

/** Saisons (Bible p.22). */
export const SEASON_CONFIG = {
  currentSeason: 1,
  durationWeeks: 8,
  rdBump: 100,
  theme: 'Saison 1 — Précision Maths & ICM',
} as const;

/** Fresque Duel (Peins la Range) & Salve (Rafale 3-Max) (Bible p.17 & p.19). */
export const FRESQUE_CONFIG = {
  lineCount: 6,
  lineLimitMs: 25000,
  frontierWeight: 2,
} as const;

export const SALVE_CONFIG = {
  spotCount: 15,
  rafaleCount: 12,
  suddenDeathCount: 3,
  limitMs: 4000,
} as const;

/** Auth & bornes HTTP serveur (Bible p.29-30). */
export const AUTH_LIMITS = {
  linkMaxPerWindow: 5,
  linkWindowMs: 60 * 1000,
  sessionTtlMs: 7 * 864e5,
  maxBodyBytes: 65536,
} as const;

/** M2 Direct : WebSocket Live Arena, Radar de Board, Détectives & Console de Revue (Bible p.13, 18, 21-22, 30-32). */
export const LIVE_ARENA = {
  spotCount: 15,
  reconnectGraceTotalMs: 60000,
  maxWsBytes: 16384,
  mmrWindows: [
    { maxWaitMs: 10000, delta: 75 },
    { maxWaitMs: 20000, delta: 150 },
    { maxWaitMs: 40000, delta: 300 },
  ],
} as const;

export const TEXTURE_CONFIG = {
  phase1Ms: 3000,
  phase2Ms: 5000,
  freqSteps: [0, 25, 50, 75, 100] as const,
  sizingsPct: [33, 50, 75, 125] as const,
} as const;

export const FUNNEL_CONFIG = {
  streetLimitMs: 20000,
  minBlocks: 6,
  maxBlocks: 10,
} as const;

export const REVIEW_SIGNALS = {
  minRuns: 5,
  timingStdMs: 15,
  slowPerfectRatio: 0.85,
  levelJumpPdDrop: 120,
  collusionPairForfeits: 2,
} as const;
