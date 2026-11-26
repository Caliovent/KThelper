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
