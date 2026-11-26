/** Machine à états d'UN joueur dans UNE série. Le serveur est l'autorité en classé. Fonction pure. */
export type PlayerPhase =
  | { s: 'ready'; i: number }
  | { s: 'open'; i: number; deadline: number }
  | { s: 'done' }
  | { s: 'forfeit' };

export interface Locked {
  i: number;
  action: string | null;
  elapsedMs: number;
}

export interface Run {
  n: number;
  limits: number[];
  phase: PlayerPhase;
  locked: Locked[];
}

export type Ev =
  | { t: 'OPEN'; i: number; now: number }
  | { t: 'ANSWER'; i: number; action: string; now: number }
  | { t: 'TICK'; now: number }
  | { t: 'FORFEIT' };

export const GRACE_MS = 400; // tolérance réseau ; le temps compté reste plafonné à la limite

export const newRun = (limits: number[]): Run => ({
  n: limits.length,
  limits,
  phase: { s: 'ready', i: 0 },
  locked: [],
});

function lock(r: Run, i: number, action: string | null, elapsedMs: number): Run {
  const locked = [...r.locked, { i, action, elapsedMs }];
  return { ...r, locked, phase: i + 1 === r.n ? { s: 'done' } : { s: 'ready', i: i + 1 } };
}

export function reduce(r: Run, e: Ev): Run {
  const p = r.phase;
  if (p.s === 'done' || p.s === 'forfeit') return r;
  if (e.t === 'FORFEIT') return { ...r, phase: { s: 'forfeit' } };
  if (e.t === 'OPEN') {
    return p.s === 'ready' && e.i === p.i
      ? { ...r, phase: { s: 'open', i: p.i, deadline: e.now + r.limits[p.i] } }
      : r;
  }
  if (p.s !== 'open') return r; // doublon ou réponse en retard : ignoré
  const limit = r.limits[p.i];
  const opened = p.deadline - limit;
  if (e.t === 'TICK') return e.now > p.deadline + GRACE_MS ? lock(r, p.i, null, limit) : r;
  if (e.i !== p.i) return r;
  return e.now > p.deadline + GRACE_MS
    ? lock(r, p.i, null, limit)
    : lock(r, p.i, e.action, Math.min(limit, e.now - opened));
}
