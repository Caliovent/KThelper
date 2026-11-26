import { GLICKO } from './config';

export interface Rating {
  r: number;
  rd: number;
  sigma: number;
}

export interface Result {
  opp: Rating;
  score: 0 | 0.5 | 1;
}

const S = 173.7178;
const g = (phi: number) => 1 / Math.sqrt(1 + (3 * phi * phi) / Math.PI ** 2);

export const expected = (me: Rating, o: Rating) =>
  1 / (1 + Math.exp((-g(o.rd / S) * (me.r - o.r)) / S));

export function update(p: Rating, results: Result[], tau = GLICKO.tau): Rating {
  const mu = (p.r - 1500) / S;
  const phi = p.rd / S;
  if (!results.length) return { ...p, rd: Math.min(GLICKO.rd0, S * Math.hypot(phi, p.sigma)) };
  const t = results.map((x) => {
    const m = (x.opp.r - 1500) / S;
    const gj = g(x.opp.rd / S);
    return { gj, E: 1 / (1 + Math.exp(-gj * (mu - m))), s: x.score };
  });
  const v = 1 / t.reduce((a, x) => a + x.gj ** 2 * x.E * (1 - x.E), 0);
  const sum = t.reduce((a, x) => a + x.gj * (x.s - x.E), 0);
  const delta = v * sum;
  const a = Math.log(p.sigma ** 2);
  const f = (x: number) => {
    const e = Math.exp(x);
    return (e * (delta ** 2 - phi ** 2 - v - e)) / (2 * (phi ** 2 + v + e) ** 2) - (x - a) / tau ** 2;
  };
  let A = a;
  let B: number;
  if (delta ** 2 > phi ** 2 + v) B = Math.log(delta ** 2 - phi ** 2 - v);
  else {
    let k = 1;
    while (f(a - k * tau) < 0) k++;
    B = a - k * tau;
  }
  let fA = f(A);
  let fB = f(B);
  while (Math.abs(B - A) > 1e-6) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else fA /= 2;
    B = C;
    fB = fC;
  }
  const sigma = Math.exp(A / 2);
  const phiStar = Math.hypot(phi, sigma);
  const phiNew = 1 / Math.sqrt(1 / phiStar ** 2 + 1 / v);
  return { r: 1500 + S * (mu + phiNew ** 2 * sum), rd: S * phiNew, sigma };
}

export const DIVISIONS = [
  { id: 'apprenti', min: -Infinity, mastery: 0 },
  { id: 'grinder', min: 1100, mastery: 60 },
  { id: 'stratege', min: 1400, mastery: 75 },
  { id: 'master', min: 1700, mastery: 85 },
  { id: 'shark', min: 2000, mastery: 90 },
] as const;

export const DIVISION_LABELS: Record<string, string> = {
  apprenti: 'Apprenti Micro',
  grinder: 'Grinder Régulier',
  stratege: 'Stratège Confirmé',
  master: 'ICM / EV Master',
  shark: 'GTO Shark',
};

export interface Gates {
  mastery: number;
  bossValidated: boolean;
  retention7dVerified: boolean;
}

/** Division affichée = la plus haute dont le MMR ET les prérequis sont atteints. */
export function division(mmr: number, gt: Gates): string {
  let out = 'apprenti';
  DIVISIONS.forEach((d, i) => {
    if (
      mmr >= d.min &&
      gt.mastery >= d.mastery &&
      (i < 3 || gt.bossValidated) &&
      (i < 4 || gt.retention7dVerified)
    ) {
      out = d.id;
    }
  });
  return out;
}
