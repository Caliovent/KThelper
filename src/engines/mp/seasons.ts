import { GLICKO, SEASON_CONFIG } from './config';
import { DIVISION_LABELS, division, update, type Gates, type Rating } from './glicko2';

/** Applique l'inflation d'inactivité (une fois par semaine complète sans match, RD plafonnée à 350, Bible p.20). */
export function inflateRdForInactivity(rating: Rating, elapsedMs: number): Rating {
  const weeks = Math.floor(Math.max(0, elapsedMs) / GLICKO.periodMs);
  let cur: Rating = { ...rating };
  for (let i = 0; i < weeks; i++) {
    cur = update(cur, []);
  }
  return cur;
}

/** Transition de saison (Bible p.22 & MP-18) : MMR conservé, RD = min(350, sqrt(RD^2 + 100^2)), aucune remise à zéro punitive. */
export function rolloverSeasonRating(rating: Rating): Rating {
  const nextRd = Math.min(GLICKO.rd0, Math.hypot(rating.rd, SEASON_CONFIG.rdBump));
  return {
    r: rating.r,
    rd: nextRd,
    sigma: rating.sigma,
  };
}

/** Placement & statut provisoire (Bible p.20) : 5 duels ET RD <= 110. */
export function isProvisional(rating: Rating, matches: number): boolean {
  return matches < 5 || rating.rd > GLICKO.provisionalRd;
}

/** Rating Polyvalent dérivé (Bible p.21) : moyenne à parts égales de Cash, Tournois et Expresso, affichée ssi les trois ont RD <= 110. */
export function computeAllRounderRating(
  ratings: Partial<Record<'cash' | 'mtt_icm' | 'expresso', Rating>>
): { eligible: boolean; r: number | null; rd: number | null } {
  const cash = ratings.cash;
  const mtt = ratings.mtt_icm;
  const exp = ratings.expresso;
  if (!cash || !mtt || !exp) {
    return { eligible: false, r: null, rd: null };
  }
  if (
    cash.rd > GLICKO.provisionalRd ||
    mtt.rd > GLICKO.provisionalRd ||
    exp.rd > GLICKO.provisionalRd
  ) {
    return { eligible: false, r: null, rd: null };
  }
  const r = Math.round(((cash.r + mtt.r + exp.r) / 3) * 100) / 100;
  const rd = Math.round((Math.hypot(cash.rd, mtt.rd, exp.rd) / 3) * 100) / 100;
  return { eligible: true, r, rd };
}

/** Division affichée = la plus haute dont MMR ET certification M sont atteints (Bible p.21 & MP-18). */
export function displayDivision(
  mmr: number,
  gates: Gates
): { id: string; label: string; mmr: number } {
  const id = division(mmr, gates);
  return {
    id,
    label: DIVISION_LABELS[id] ?? id,
    mmr: Math.round(mmr),
  };
}
