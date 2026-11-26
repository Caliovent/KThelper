export interface QuestSpec {
  id: string;
  skillPrefix: string;
  target: number;
  maxMeanPd: number;
  criticalPd?: number;
  consecutive: boolean;
}

export interface QuestEvent {
  eventId: string;
  skillId: string;
  variantSeed: string;
  pd: number;
  usedHint: boolean;
  firstSeen: boolean;
}

export interface QuestProgress {
  seen: string[];
  window: number[];
  done: boolean;
}

export const emptyProgress = (): QuestProgress => ({ seen: [], window: [], done: false });

export function advance(q: QuestSpec, p: QuestProgress, e: QuestEvent): QuestProgress {
  if (p.done || !e.skillId.startsWith(q.skillPrefix) || p.seen.includes(e.eventId)) return p;
  const seen = [...p.seen, e.eventId];
  if (e.usedHint || !e.firstSeen) return { ...p, seen };
  if (q.consecutive && q.criticalPd !== undefined && e.pd > q.criticalPd) {
    return { seen, window: [], done: false };
  }
  const window = [...p.window, e.pd].slice(-q.target);
  const mean = window.reduce((a, b) => a + b, 0) / window.length;
  return { seen, window, done: window.length === q.target && mean <= q.maxMeanPd };
}
