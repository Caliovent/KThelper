export const RANKS = 'AKQJT98765432';
export type Freq = (hand: string) => number; // fréquence de jeu 0..1
export interface Line {
  id: string;
  hands: string[]; // ordonnées de la plus forte à la plus faible
}

export function lines(): Line[] {
  const out: Line[] = [{ id: 'pairs', hands: [...RANKS].map((r) => r + r) }];
  for (const s of ['s', 'o'] as const) {
    for (let hi = 0; hi < 12; hi++) {
      out.push({
        id: RANKS[hi] + 'x' + s,
        hands: [...RANKS.slice(hi + 1)].map((lo) => RANKS[hi] + lo + s),
      });
    }
  }
  return out;
}

/** Une ligne = bloc continu depuis le haut (un seuil) + des îlots isolés (ex. A5s-A4s). */
export function describeLine(line: Line, f: Freq, min = 0.5) {
  let k = 0;
  while (k < line.hands.length && f(line.hands[k]) >= min) k++;
  return {
    id: line.id,
    floor: k ? line.hands[k - 1] : null,
    islands: line.hands.slice(k).filter((h) => f(h) >= min),
  };
}

export const comboCount = (h: string) => (h.length === 2 ? 6 : h[2] === 's' ? 4 : 12);

/** Impact combinatoire exact des bloqueurs d'une classe de main (ex: A5s, KQo). */
export function blockerImpact(heroHand: string) {
  const r1 = heroHand[0];
  const r2 = heroHand[1];
  const countPair = (rank: string) => {
    const blocked = (r1 === rank ? 1 : 0) + (r2 === rank ? 1 : 0);
    const rem = 4 - blocked;
    return (rem * (rem - 1)) / 2;
  };
  const countUnpaired = (hi: string, lo: string) => {
    const remHi = 4 - (r1 === hi ? 1 : 0) - (r2 === hi ? 1 : 0);
    const remLo = 4 - (r1 === lo ? 1 : 0) - (r2 === lo ? 1 : 0);
    return remHi * remLo;
  };
  return {
    AA: countPair('A'),
    KK: countPair('K'),
    QQ: countPair('Q'),
    AK: countUnpaired('A', 'K'),
    AQ: countUnpaired('A', 'Q'),
  };
}
