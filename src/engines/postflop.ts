import type { GameContext, Position, Provenance } from '../domain/types';

export type Street = 'flop' | 'turn' | 'river';

export interface Texture {
  high: 'A' | 'broadway' | 'middle' | 'low';
  paired: boolean;
  trips: boolean;
  suits: 'rainbow' | 'twotone' | 'monotone';
  connectivity: 0 | 1 | 2;
}

const V: Record<string, number> = {
  A: 14,
  K: 13,
  Q: 12,
  J: 11,
  T: 10,
  '9': 9,
  '8': 8,
  '7': 7,
  '6': 6,
  '5': 5,
  '4': 4,
  '3': 3,
  '2': 2,
};

/** flop au format ['Ks','7d','2c'] */
export function texture(flop: [string, string, string]): Texture {
  const r = flop.map((c) => V[c[0]]).sort((a, b) => b - a);
  const u = [...new Set(r)];
  const suits = new Set(flop.map((c) => c[1])).size;
  const ext = u.includes(14) ? [...u, 1] : u;
  let best = 0;
  for (let lo = 1; lo <= 10; lo++) {
    best = Math.max(best, ext.filter((x) => x >= lo && x <= lo + 4).length);
  }
  return {
    high: r[0] === 14 ? 'A' : r[0] >= 10 ? 'broadway' : r[0] >= 7 ? 'middle' : 'low',
    paired: u.length < 3,
    trips: u.length === 1,
    suits: suits === 3 ? 'rainbow' : suits === 2 ? 'twotone' : 'monotone',
    connectivity: best >= 3 ? 2 : best === 2 ? 1 : 0,
  };
}

export type HandBucket = 'nuts' | 'strong' | 'medium' | 'strong_draw' | 'weak_draw' | 'air';
export type SizingId = 'x' | 'b25' | 'b33' | 'b50' | 'b75' | 'b125' | 'allin' | 'f' | 'c' | 'r';

export interface Edge {
  action: SizingId;
  sizePotPct?: number;
  freq: number;
  evBb?: number;
  next?: string;
}

export interface DecisionNode {
  id: string;
  street: Street;
  actor: Position;
  potBb: number;
  stackBb: number;
  board: string[];
  range: Edge[];
  byBucket?: Partial<Record<HandBucket, Edge[]>>;
}

export interface PostflopTree {
  id: string;
  context: GameContext;
  potType: 'limp' | 'srp' | '3bp' | '4bp';
  ip: Position;
  oop: Position;
  flopClass: Texture;
  rootId: string;
  nodes: Record<string, DecisionNode>;
  advantage?: { rangeEquityIp: number; nutShareIp: number; nutShareOop: number };
  provenance: Provenance;
}
