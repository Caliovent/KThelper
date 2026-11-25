export interface BountyCall {
  call: number; // jetons à ajouter
  finalPot: number; // pot final en jetons, call inclus
  bountyCash: number; // prime encaissable immédiatement
  chipsInPlay: number;
  remainingRegularPool: number;
  remainingBountyPool: number;
}

/** PKO 50/50 : bountyCash = 0.5 × prime affichée. Mystery : moyenne des enveloppes restantes.
 *  Valide seulement si Héros couvre Vilain. Approximation ChipEV : n'inclut pas l'ICM. */
export function bountyAdjusted(b: BountyCall) {
  const bountyPower = b.chipsInPlay / (b.remainingRegularPool + b.remainingBountyPool);
  const bountyChips = b.bountyCash * bountyPower;
  const chipEv = b.call / b.finalPot;
  const withBounty = b.call / (b.finalPot + bountyChips);
  return { bountyPower, bountyChips, chipEv, withBounty, equityDrop: withBounty - chipEv };
}

/** Expresso winner-takes-all. cev = jetons gagnés (ajustés all-in) par partie. */
export const evItmWta = (cev: number, start: number) => (start + cev) / (3 * start);
export const evRoiWta = (cev: number, start: number, rakeRate: number) =>
  (cev / start + 1) * (1 - rakeRate) - 1;
export const breakevenCev = (start: number, rakeRate: number) =>
  start * (1 / (1 - rakeRate) - 1);

export const rake = (
  pot: number,
  rate: number,
  cap: number,
  sawFlop: boolean,
  noFlopNoDrop = true
) => (!sawFlop && noFlopNoDrop ? 0 : Math.min(pot * rate, cap));

/** mu et sigma en bb/100, bankroll en bb. Modèle de diffusion, winrate supposé connu. */
export const riskOfRuin = (mu: number, sigma: number, bankrollBb: number) =>
  mu <= 0 ? 1 : Math.exp((-2 * mu * bankrollBb) / (sigma * sigma));

export const winrateCi95 = (mu: number, sigma: number, hands: number) => {
  const h = (1.96 * sigma) / Math.sqrt(hands / 100);
  return [mu - h, mu + h] as const;
};
