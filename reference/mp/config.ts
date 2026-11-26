/** Toutes les valeurs de réglage. Aucune constante magique ailleurs. */
export const RULES_VERSION = 'mp-rules-1';
export const SCALE = {
  // unité entière de perte, seuil négligeable, perte qui vaut 1000 PD
  mbb:    { epsilon: 10,  cap: 1000 },    // milli-bb (cash, cEV)
  ppm_pp: { epsilon: 100, cap: 10000 },   // millionièmes du prize pool (ICM, PKO)
} as const;
export const TIMEOUT = { penaltyPd: 50, floorPd: 300 };
export const HINT_PD = 150;               // amical seulement
export const DRAW_BAND_PD = 100;          // écart total <= bande : nul pour le classement
export const QUOTAS = { frontier: 0.60, transfer: 0.25, mixed: 0.15 };
export const GLICKO = { tau: 0.5, r0: 1500, rd0: 350, sigma0: 0.06, periodMs: 7 * 864e5, provisionalRd: 110 };
