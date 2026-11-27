import type { Provenance } from '../domain/types.ts';
import { RANKS } from './chunk.ts';

export type FunnelStreetId = 'preflop' | 'flop' | 'turn' | 'river';
export type FunnelActionKind = 'open' | 'cbet' | 'barrel' | 'check' | 'call' | 'raise';

export interface HandStreetEntry {
  action: FunnelActionKind;
  /** Fréquence cumulative conservée dans le range à cette rue (0..1). */
  freq: number;
}

export interface StreetNode {
  street: FunnelStreetId;
  label: string;
  board: readonly string[];
  newCards: readonly string[];
  action: FunnelActionKind;
  actionLabel: string;
  narrative: string;
  activeCombos: Record<string, HandStreetEntry>;
}

export interface FunnelQuizQuestion {
  id: string;
  streetIndex: 0 | 1 | 2 | 3;
  prompt: string;
  options: readonly string[];
  correctIndex: number;
  explanation: string;
  focusHand: string;
  provenance: 'computed' | 'heuristic';
}

export type FunnelDrawerId =
  | 'sets_overpairs'
  | 'top_pairs'
  | 'mid_pairs'
  | 'draws'
  | 'overcards_bd'
  | 'air';

export type DrawerStepFreq = 0 | 0.25 | 0.5 | 0.75 | 1;

export interface SismographeChallenge {
  maskedStreetIndex: 1 | 2 | 3;
  prompt: string;
  options: readonly string[];
  correctIndex: number;
  explanation: string;
  focusDrawerId: FunnelDrawerId;
  provenance: 'computed' | 'heuristic';
}

export interface EvolutionaryFunnelScenario {
  id: string;
  title: string;
  subtitle: string;
  format: string;
  actorLabel: string;
  provenanceKind: 'computed' | 'heuristic';
  provenance: Provenance;
  streets: readonly [StreetNode, StreetNode, StreetNode, StreetNode];
  quizQuestions: readonly FunnelQuizQuestion[];
  sismographe: SismographeChallenge;
  riverBetPctPot: number;
}

export type CellDiffStatus =
  | 'active'
  | 'eliminated_prev'
  | 'eliminated_earlier'
  | 'never_in_range';

export interface MatrixCellDiff {
  hand: string;
  row: number;
  col: number;
  handType: 'pair' | 'suited' | 'offsuit';
  status: CellDiffStatus;
  action: FunnelActionKind | null;
  preflopAction: FunnelActionKind | null;
  freqCurrent: number;
  freqPrev: number;
  freqPreflop: number;
  baseCombos: number;
  unblockedCombos: number;
  blockedByBoard: number;
  blockingCards: readonly string[];
  activeCombos: number;
  prevActiveCombos: number;
}

export interface StreetMatrixDiffSummary {
  streetIndex: 0 | 1 | 2 | 3;
  node: StreetNode;
  cells: readonly MatrixCellDiff[];
  preflopTotalCombos: number;
  activeCombosExact: number;
  ghostCombosExact: number;
  blockedBoardCombosExact: number;
  totalActiveCombos: number;
  totalGhostCombos: number;
  totalBlockedByBoardCombos: number;
  deckCombos: number;
  rangePct: number;
  prevActiveCombos: number;
  deltaCombosFromPrev: number;
  eliminatedByActionCombos: number;
  eliminatedByCardRemovalCombos: number;
  composition: {
    pairsCombos: number;
    suitedCombos: number;
    offsuitCombos: number;
    pairsPct: number;
    suitedPct: number;
    offsuitPct: number;
  };
}

export interface HandStreetHistoryItem {
  streetIndex: 0 | 1 | 2 | 3;
  street: FunnelStreetId;
  label: string;
  board: readonly string[];
  status: CellDiffStatus;
  action: FunnelActionKind | null;
  freq: number;
  baseCombos: number;
  unblockedCombos: number;
  blockedByBoard: number;
  blockingCards: readonly string[];
  activeCombos: number;
}

export interface PairedFamilySummary {
  familyName: string;
  suitedHand: string;
  offsuitHand: string;
  baseTotal: number;
  unblockedTotal: number;
  activeTotal: number;
  blockedTotal: number;
}

export interface HandFunnelInspection {
  hand: string;
  handType: 'pair' | 'suited' | 'offsuit';
  history: readonly HandStreetHistoryItem[];
  familyAtStreet: (streetIndex: 0 | 1 | 2 | 3) => PairedFamilySummary | null;
}

const SUITS = ['s', 'h', 'd', 'c'] as const;

export interface MatrixHandDescriptor {
  hand: string;
  row: number;
  col: number;
  handType: 'pair' | 'suited' | 'offsuit';
}

export const MATRIX_HANDS: readonly MatrixHandDescriptor[] = (() => {
  const out: MatrixHandDescriptor[] = [];
  for (let r = 0; r < RANKS.length; r++) {
    for (let c = 0; c < RANKS.length; c++) {
      if (r === c) {
        out.push({ hand: `${RANKS[r]}${RANKS[c]}`, row: r, col: c, handType: 'pair' });
      } else if (r < c) {
        out.push({ hand: `${RANKS[r]}${RANKS[c]}s`, row: r, col: c, handType: 'suited' });
      } else {
        out.push({ hand: `${RANKS[c]}${RANKS[r]}o`, row: r, col: c, handType: 'offsuit' });
      }
    }
  }
  return out;
})();

/** Arrondi de Hamilton (plus fort reste) : garantit que la somme des entiers fait strictement 100. */
export function hamiltonRoundPercent(values: readonly number[]): number[] {
  const safe = values.map((v) => (Number.isFinite(v) && v > 0 ? v : 0));
  const total = safe.reduce((acc, v) => acc + v, 0);
  if (total <= 0) return safe.map(() => 0);

  const exact = safe.map((v) => (v / total) * 100);
  const floors = exact.map((x) => Math.floor(x));
  let remainderPoints = 100 - floors.reduce((acc, f) => acc + f, 0);

  const order = exact
    .map((x, idx) => ({ idx, rem: x - floors[idx] }))
    .sort((a, b) => (b.rem !== a.rem ? b.rem - a.rem : a.idx - b.idx));

  for (let i = 0; i < remainderPoints && i < order.length; i++) {
    floors[order[i].idx] += 1;
  }
  return floors;
}

/** Nombre total de combos possibles restants dans le paquet compte tenu du board. */
export function deckCombosRemaining(boardCount: number): number {
  const remainingCards = Math.max(2, 52 - boardCount);
  return (remainingCards * (remainingCards - 1)) / 2;
}

/** Énumère exactement les combos à 2 cartes d'une classe de main (6 paires, 4 suited, 12 offsuit). */
export function enumerateConcreteCombos(handClass: string): readonly [string, string][] {
  const r1 = handClass[0]?.toUpperCase() ?? 'A';
  const r2 = handClass[1]?.toUpperCase() ?? 'K';
  const kind = handClass.length === 2 ? 'p' : handClass[2]?.toLowerCase();
  const combos: [string, string][] = [];

  if (kind === 'p' || r1 === r2) {
    for (let i = 0; i < SUITS.length; i++) {
      for (let j = i + 1; j < SUITS.length; j++) {
        combos.push([`${r1}${SUITS[i]}`, `${r2}${SUITS[j]}`]);
      }
    }
    return combos;
  }

  if (kind === 's') {
    for (const s of SUITS) {
      combos.push([`${r1}${s}`, `${r2}${s}`]);
    }
    return combos;
  }

  for (const s1 of SUITS) {
    for (const s2 of SUITS) {
      if (s1 !== s2) {
        combos.push([`${r1}${s1}`, `${r2}${s2}`]);
      }
    }
  }
  return combos;
}

function normalizeCard(card: string): string {
  if (!card || card.length < 2) return card;
  return `${card[0].toUpperCase()}${card[1].toLowerCase()}`;
}

/** Masque binaire 52 cartes SMI-safe (2×26 bits strictement < 2^26, zéro BigInt/allocation). */
export interface CardMask52 {
  lo: number; // cartes 0..25
  hi: number; // cartes 26..51
}

export interface ComboEntry {
  id: number;
  cellIndex: number;
  hand: string;
  c1: string;
  c2: string;
  bit1: number;
  bit2: number;
  lo: number;
  hi: number;
}

export function cardToBitIndex(card: string): number {
  if (!card || card.length < 2) return -1;
  const rIdx = RANKS.indexOf(card[0].toUpperCase());
  const sIdx = SUITS.indexOf(card[1].toLowerCase() as (typeof SUITS)[number]);
  if (rIdx < 0 || sIdx < 0) return -1;
  return rIdx * 4 + sIdx;
}

export function addCardBitToMask52(mask: CardMask52, bitIndex: number): CardMask52 {
  if (bitIndex < 0 || bitIndex > 51) return mask;
  if (bitIndex < 26) {
    return { lo: mask.lo | (1 << bitIndex), hi: mask.hi };
  }
  return { lo: mask.lo, hi: mask.hi | (1 << (bitIndex - 26)) };
}

export function addCardToMask52(mask: CardMask52, card: string): CardMask52 {
  return addCardBitToMask52(mask, cardToBitIndex(card));
}

export function buildCardMask52(cards: readonly string[]): CardMask52 {
  let lo = 0;
  let hi = 0;
  for (let i = 0; i < cards.length; i++) {
    const bit = cardToBitIndex(cards[i]);
    if (bit >= 0 && bit < 26) lo |= 1 << bit;
    else if (bit >= 26 && bit <= 51) hi |= 1 << (bit - 26);
  }
  return { lo, hi };
}

export function isComboUnblocked(combo: ComboEntry, deadMask: CardMask52): boolean {
  return (combo.lo & deadMask.lo) === 0 && (combo.hi & deadMask.hi) === 0;
}

/** Index statique précalculé des 1 326 combinaisons Hold'em + lookup par cellule 13×13. */
export const COMBO_INDEX: readonly ComboEntry[] = (() => {
  const entries: ComboEntry[] = [];
  let nextId = 0;
  for (let cellIndex = 0; cellIndex < MATRIX_HANDS.length; cellIndex++) {
    const desc = MATRIX_HANDS[cellIndex];
    const concrete = enumerateConcreteCombos(desc.hand);
    for (let k = 0; k < concrete.length; k++) {
      const [c1, c2] = concrete[k];
      const bit1 = cardToBitIndex(c1);
      const bit2 = cardToBitIndex(c2);
      const mask = addCardBitToMask52(addCardBitToMask52({ lo: 0, hi: 0 }, bit1), bit2);
      entries.push({
        id: nextId++,
        cellIndex,
        hand: desc.hand,
        c1,
        c2,
        bit1,
        bit2,
        lo: mask.lo,
        hi: mask.hi,
      });
    }
  }
  return entries;
})();

const COMBOS_BY_HAND = new Map<string, ComboEntry[]>();
for (const entry of COMBO_INDEX) {
  const list = COMBOS_BY_HAND.get(entry.hand);
  if (list) list.push(entry);
  else COMBOS_BY_HAND.set(entry.hand, [entry]);
}

/** Construit un Float32Array contigu de longueur 1 326 à partir d'un range de rue. */
export function buildFloat32ComboWeights(range: Record<string, HandStreetEntry>): Float32Array {
  const weights = new Float32Array(COMBO_INDEX.length);
  for (let i = 0; i < COMBO_INDEX.length; i++) {
    weights[i] = range[COMBO_INDEX[i].hand]?.freq ?? 0;
  }
  return weights;
}

export interface CellProjectionTotals {
  activeByCell: Float32Array;
  ghostByCell: Float32Array;
  blockedByCell: Float32Array;
  preflopByCell: Float32Array;
  totalActiveExact: number;
  totalGhostExact: number;
  totalBlockedExact: number;
  totalPreflopExact: number;
}

/** Projection rapide O(1326) sans allocation de chaînes vers les 169 cellules 13×13. */
export function projectFloat32ToCells(
  activeWeights: Float32Array,
  preflopWeights: Float32Array,
  deadMask: CardMask52
): CellProjectionTotals {
  const activeByCell = new Float32Array(169);
  const ghostByCell = new Float32Array(169);
  const blockedByCell = new Float32Array(169);
  const preflopByCell = new Float32Array(169);
  let totalActiveExact = 0;
  let totalGhostExact = 0;
  let totalBlockedExact = 0;
  let totalPreflopExact = 0;

  for (let i = 0; i < COMBO_INDEX.length; i++) {
    const entry = COMBO_INDEX[i];
    const pf = preflopWeights[i];
    if (pf <= 0) continue;
    const cellIdx = entry.cellIndex;
    preflopByCell[cellIdx] += pf;
    totalPreflopExact += pf;

    if ((entry.lo & deadMask.lo) === 0 && (entry.hi & deadMask.hi) === 0) {
      const act = Math.min(pf, activeWeights[i]);
      const ghost = pf - act;
      activeByCell[cellIdx] += act;
      ghostByCell[cellIdx] += ghost;
      totalActiveExact += act;
      totalGhostExact += ghost;
    } else {
      blockedByCell[cellIdx] += pf;
      totalBlockedExact += pf;
    }
  }

  return {
    activeByCell,
    ghostByCell,
    blockedByCell,
    preflopByCell,
    totalActiveExact,
    totalGhostExact,
    totalBlockedExact,
    totalPreflopExact,
  };
}

/** Calcule le card removal exact d'une classe de main en O(6/4/12) via CardMask52 SMI-safe. */
export function countUnblockedCombos(
  handClass: string,
  board: readonly string[]
): {
  base: number;
  remaining: number;
  blocked: number;
  blockingCards: string[];
} {
  const list = COMBOS_BY_HAND.get(handClass);
  const concrete = list ?? enumerateConcreteCombos(handClass);
  const base = concrete.length;

  if (board.length === 0) {
    return { base, remaining: base, blocked: 0, blockingCards: [] };
  }

  const deadMask = buildCardMask52(board);
  if (!list) {
    let remaining = 0;
    const blockers = new Set<string>();
    const boardNorm = board.map(normalizeCard);
    for (const [c1, c2] of concrete as readonly [string, string][]) {
      const m = buildCardMask52([c1, c2]);
      if ((m.lo & deadMask.lo) === 0 && (m.hi & deadMask.hi) === 0) remaining += 1;
      else {
        if (boardNorm.includes(c1)) blockers.add(c1);
        if (boardNorm.includes(c2)) blockers.add(c2);
      }
    }
    return {
      base,
      remaining,
      blocked: base - remaining,
      blockingCards: boardNorm.filter((c) => blockers.has(c)),
    };
  }

  let remaining = 0;
  let usedLo = 0;
  let usedHi = 0;
  for (let i = 0; i < list.length; i++) {
    const combo = list[i];
    if ((combo.lo & deadMask.lo) === 0 && (combo.hi & deadMask.hi) === 0) {
      remaining += 1;
    } else {
      usedLo |= combo.lo & deadMask.lo;
      usedHi |= combo.hi & deadMask.hi;
    }
  }

  const blockingCards: string[] = [];
  for (let i = 0; i < board.length; i++) {
    const norm = normalizeCard(board[i]);
    const bit = cardToBitIndex(norm);
    if (bit >= 0 && bit < 26 && (usedLo & (1 << bit)) !== 0) {
      blockingCards.push(norm);
    } else if (bit >= 26 && (usedHi & (1 << (bit - 26))) !== 0) {
      blockingCards.push(norm);
    }
  }

  return {
    base,
    remaining,
    blocked: base - remaining,
    blockingCards,
  };
}

function addHands(
  target: Record<string, HandStreetEntry>,
  hands: readonly string[],
  action: FunnelActionKind,
  freq = 1
): void {
  for (const h of hands) {
    target[h] = { action, freq };
  }
}

function buildRange(
  groups: readonly { hands: readonly string[]; action: FunnelActionKind; freq?: number }[]
): Record<string, HandStreetEntry> {
  const out: Record<string, HandStreetEntry> = {};
  for (const g of groups) {
    addHands(out, g.hands, g.action, g.freq ?? 1);
  }
  return out;
}

/**
 * Clamp monotonique : garantit qu'une rue postérieure ne dépasse jamais la fréquence préflop/antérieure
 * (un vrai entonnoir ne réinjecte jamais une main déjà foldée).
 */
function enforceFunnelMonotonicity(
  streets: readonly [StreetNode, StreetNode, StreetNode, StreetNode]
): readonly [StreetNode, StreetNode, StreetNode, StreetNode] {
  const prevMaps: Record<string, HandStreetEntry>[] = [];
  const cloned = streets.map((node, idx) => {
    const nextMap: Record<string, HandStreetEntry> = {};
    if (idx === 0) {
      for (const [hand, entry] of Object.entries(node.activeCombos)) {
        if (entry.freq > 0) {
          nextMap[hand] = { action: entry.action, freq: Math.min(1, Math.max(0, entry.freq)) };
        }
      }
    } else {
      const prev = prevMaps[idx - 1];
      for (const [hand, entry] of Object.entries(node.activeCombos)) {
        const prevFreq = prev[hand]?.freq ?? 0;
        const clampedFreq = Math.min(prevFreq, Math.min(1, Math.max(0, entry.freq)));
        if (clampedFreq > 0) {
          nextMap[hand] = { action: entry.action, freq: clampedFreq };
        }
      }
    }
    prevMaps.push(nextMap);
    return { ...node, activeCombos: nextMap };
  });

  return [cloned[0], cloned[1], cloned[2], cloned[3]];
}

// ============================================================================
// SCÉNARIO 1 (DÉFAUT) : REPRISE DU SPOT DE SHISHI — TRIPLE BARREL BTN vs BB
// PRÉFLOP -> FLOP 9s 6d 3c -> TURN Kc -> RIVER Ah
// ============================================================================

const SHISHI_PREFLOP = buildRange([
  {
    hands: [
      'AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55', '44', '33', '22',
      'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s',
      'KQs', 'KJs', 'KTs', 'K9s', 'K8s', 'K7s', 'K6s', 'K5s', 'K4s', 'K3s', 'K2s',
      'QJs', 'QTs', 'Q9s', 'Q8s', 'Q7s', 'Q6s', 'Q5s',
      'JTs', 'J9s', 'J8s', 'J7s',
      'T9s', 'T8s', 'T7s',
      '98s', '97s', '96s',
      '87s', '86s', '76s', '75s', '65s', '64s', '54s',
      'AKo', 'AQo', 'AJo', 'ATo', 'A9o', 'A8o', 'A7o', 'A5o',
      'KQo', 'KJo', 'KTo', 'K9o',
      'QJo', 'QTo', 'JTo', 'T9o',
    ],
    action: 'open',
    freq: 1,
  },
]);

const SHISHI_FLOP_CBET = buildRange([
  // Value forte + surpaires + 9x + 6x forts + sets
  {
    hands: [
      'AA', 'KK', 'QQ', 'JJ', 'TT', '99', '66', '33',
      'A9s', 'K9s', 'Q9s', 'J9s', 'T9s', '98s', '97s', '96s', 'T9o',
      'A6s', '76s', '65s', '64s', 'A3s',
    ],
    action: 'cbet',
    freq: 1,
  },
  // Broadways & overcards à fort potentiel Turn + backdoors + gutshots
  {
    hands: [
      'AKs', 'AQs', 'AJs', 'ATs', 'A8s', 'A7s', 'A5s', 'A4s', 'A2s',
      'KQs', 'KJs', 'KTs', 'K8s', 'K7s',
      'QJs', 'QTs', 'Q8s',
      'JTs', 'J8s', 'J7s',
      'T8s', 'T7s', '87s', '86s', '75s', '54s',
      'AKo', 'AQo', 'AJo', 'ATo',
      'KQo', 'KJo', 'KTo',
      'QJo', 'QTo', 'JTo',
    ],
    action: 'cbet',
    freq: 1,
  },
  // Moyennes paires & bas du range en mix C-Bet 50% (77/88 check souvent, petites PP 22/44/55 check-fold)
  {
    hands: ['88', '77', 'K6s', 'K5s', 'Q7s'],
    action: 'cbet',
    freq: 0.5,
  },
]);

const SHISHI_TURN_BARREL = buildRange([
  // Value sur Turn Kc : Kx devenus Top Pair+, sets, overpaires AA, deux paires K9/K6
  {
    hands: [
      'AA', 'KK', '99', '66', '33',
      'AKs', 'KQs', 'KJs', 'KTs', 'K9s', 'K8s', 'K7s', 'K6s', 'K5s',
      'AKo', 'KQo', 'KJo', 'KTo',
    ],
    action: 'barrel',
    freq: 1,
  },
  // Semi-bluffs & tirages forts (trèfles, gutshots/OESD sur K-9-6-3, bloqueurs)
  {
    hands: [
      'QJs', 'QTs', 'JTs', '87s', '75s', '65s', '54s',
      'A5s', 'A4s', 'QJo', 'QTo', 'JTo',
    ],
    action: 'barrel',
    freq: 1,
  },
  // Top paires flop / bonnes mains en mix protection-value ou semi-bluff
  {
    hands: ['QQ', 'JJ', 'TT', 'AQs', 'AJs', 'ATs', 'A9s', 'Q9s', 'J9s', 'T9s', '98s', 'AQo', 'AJo'],
    action: 'barrel',
    freq: 0.5,
  },
]);

const SHISHI_RIVER_BARREL = buildRange([
  // Value max sur River Ah : As-Roi DP+, sets (AA/KK/99/66/33), As-X forts valorisés
  {
    hands: [
      'AA', 'KK', '99', '66', '33',
      'AKs', 'AKo',
      'AQs', 'AJs', 'ATs', 'A9s', 'A5s', 'A4s',
      'AQo', 'AJo',
    ],
    action: 'barrel',
    freq: 1,
  },
  // Deux paires / brelan cachés et bluffs purs (tirages manqués à pique/trèfle + bloqueurs QJ/JT/87/75)
  {
    hands: ['QJs', 'QTs', 'JTs', '87s', '75s', '54s', 'QJo', 'QTo', 'JTo'],
    action: 'barrel',
    freq: 1,
  },
  // KQ/KJ/K9 en thin value polarisée (50% bet, 50% check back selon profil BB)
  {
    hands: ['KQs', 'KJs', 'K9s', 'KQo'],
    action: 'barrel',
    freq: 0.5,
  },
]);

// ============================================================================
// SCÉNARIO 2 : DÉFENSE BB vs CO OPEN SUR Q♥ 9♠ 4♦ → 2♠ → J♠
// ============================================================================

const BB_DEF_PREFLOP = buildRange([
  {
    hands: [
      'TT', '99', '88', '77', '66', '55', '44', '33', '22',
      'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s',
      'KQs', 'KJs', 'KTs', 'K9s', 'K8s', 'K7s', 'K6s', 'K5s', 'K4s', 'K3s', 'K2s',
      'QJs', 'QTs', 'Q9s', 'Q8s', 'Q7s', 'Q6s', 'Q5s', 'Q4s',
      'JTs', 'J9s', 'J8s', 'J7s',
      'T9s', 'T8s', 'T7s',
      '98s', '97s', '96s',
      '87s', '86s', '76s', '75s', '65s', '54s',
      'AQo', 'AJo', 'ATo', 'A9o', 'A8o', 'A7o',
      'KQo', 'KJo', 'KTo', 'K9o',
      'QJo', 'QTo', 'Q9o',
      'JTo', 'J9o', 'T9o', '98o',
    ],
    action: 'call',
    freq: 1,
  },
]);

const BB_DEF_FLOP = buildRange([
  {
    hands: [
      '99', '44',
      'KQs', 'QJs', 'QTs', 'Q9s', 'Q8s', 'Q7s', 'Q6s', 'Q5s', 'Q4s',
      'KQo', 'QJo', 'QTo', 'Q9o',
      'A9s', 'K9s', 'J9s', 'T9s', '98s', '97s', 'K9o', 'J9o', 'T9o', '98o',
      'A4s', 'K4s',
      'KJs', 'KTs', 'JTs', 'T8s', '87s', '76s', '65s', '54s', 'KJo', 'KTo', 'JTo',
    ],
    action: 'call',
    freq: 1,
  },
  {
    hands: ['TT', '88', '77', '66', '55', 'AJs', 'ATs', 'J8s', '86s'],
    action: 'call',
    freq: 0.5,
  },
]);

const BB_DEF_TURN = buildRange([
  {
    hands: [
      '99', '44',
      'KQs', 'QJs', 'QTs', 'Q9s', 'Q8s', 'Q4s',
      'KQo', 'QJo', 'QTo', 'Q9o',
      'A9s', 'K9s', 'J9s', 'T9s', '98s',
      'KJs', 'KTs', 'JTs', 'T8s',
      'A8s', 'A7s', 'A5s', '87s', '76s',
    ],
    action: 'call',
    freq: 1,
  },
  {
    hands: ['TT', 'Q7s', 'Q6s', 'J8s', 'KJo', 'KTo', 'JTo'],
    action: 'call',
    freq: 0.5,
  },
]);

const BB_DEF_RIVER = buildRange([
  {
    hands: [
      '99', '44',
      'QJs', 'Q9s', 'KQs', 'KTs', 'T8s',
      'A9s', 'A8s', 'A7s', 'A5s', 'K9s', 'KJs', 'J9s', '87s', '76s',
      'KTo', 'QJo',
    ],
    action: 'call',
    freq: 1,
  },
  {
    hands: ['KQo', 'QTo', 'QTs', 'JTs'],
    action: 'call',
    freq: 0.5,
  },
]);

// ============================================================================
// SCÉNARIO 3 : POT 3-BET IP — BTN 3-BET vs CO CALL SUR A♣ 8♦ 4♣ → T♥ → 2♠
// ============================================================================

const THREEBET_PREFLOP = buildRange([
  {
    hands: [
      'AA', 'KK', 'QQ', 'JJ', 'TT', '99',
      'AKs', 'AQs', 'AJs', 'ATs', 'A5s', 'A4s', 'A3s',
      'KQs', 'KJs', 'KTs', 'QJs', 'QTs', 'JTs', 'T9s', '98s', '87s', '76s',
      'AKo', 'AQo', 'AJo', 'KQo',
    ],
    action: 'raise',
    freq: 1,
  },
]);

const THREEBET_FLOP = buildRange([
  {
    hands: [
      'AA', '88', 'AKs', 'AQs', 'AJs', 'ATs', 'A5s', 'A4s', 'A3s',
      'AKo', 'AQo', 'AJo',
      'KK', 'QQ', 'JJ', 'TT', '99',
      'KQs', 'KJs', 'KTs', 'QJs', 'QTs', 'JTs', 'T9s', '98s', '87s', '76s',
    ],
    action: 'cbet',
    freq: 1,
  },
  { hands: ['KQo'], action: 'cbet', freq: 0.5 },
]);

const THREEBET_TURN = buildRange([
  {
    hands: [
      'AA', 'TT', '88', 'AKs', 'AQs', 'AJs', 'ATs', 'A5s', 'A4s',
      'AKo', 'AQo', 'AJo',
      'KQs', 'KJs', 'QJs', 'JTs', '98s', '76s',
    ],
    action: 'barrel',
    freq: 1,
  },
  {
    hands: ['KK', 'QQ', 'KTs', 'QTs', 'T9s'],
    action: 'barrel',
    freq: 0.5,
  },
]);

const THREEBET_RIVER = buildRange([
  {
    hands: [
      'AA', 'TT', '88', 'AKs', 'AQs', 'AJs', 'ATs',
      'AKo', 'AQo',
      'KQs', 'KJs', 'QJs', '98s', '76s',
    ],
    action: 'barrel',
    freq: 1,
  },
  {
    hands: ['A5s', 'A4s', 'AJo'],
    action: 'barrel',
    freq: 0.5,
  },
]);

export const EVOLUTIONARY_FUNNEL_SCENARIOS: readonly EvolutionaryFunnelScenario[] = [
  {
    id: 'shishi_triple_barrel_963r_kc_ah',
    title: 'Spot Shishi — Triple Barrel BTN vs BB (9♠ 6♦ 3♣ → K♣ → A♥)',
    subtitle: 'Visualisez la polarisation progressive du range BTN et le card removal exact de K♣ et A♥',
    format: 'Cash Game 6-Max • 100bb',
    actorLabel: 'Hero (BTN — Agresseur IP)',
    provenanceKind: 'heuristic',
    riverBetPctPot: 75,
    provenance: {
      origin: 'heuristic',
      tool: 'Kill Tilt / Shishi — Entonnoir Triple Barrel',
      note: 'Heuristique pédagogique multi-rues avec filtrage combinatoire exact (6/4/12 et card removal)',
      confidence: 'medium',
    },
    streets: enforceFunnelMonotonicity([
      {
        street: 'preflop',
        label: 'PRÉFLOP',
        board: [],
        newCards: [],
        action: 'open',
        actionLabel: 'Open 2.5bb BTN',
        narrative:
          'BTN ouvre ~44 % des combos : toutes les paires, tous les As assortis, la majorité des Rois/Dames assortis et les broadways.',
        activeCombos: SHISHI_PREFLOP,
      },
      {
        street: 'flop',
        label: 'FLOP : 9♠ 6♦ 3♣',
        board: ['9s', '6d', '3c'],
        newCards: ['9s', '6d', '3c'],
        action: 'cbet',
        actionLabel: 'C-Bet 33% pot',
        narrative:
          'Sur 9-6-3 rainbow, BTN C-Bet ses surpaires, 9x, 6x, sets, broadways/overcards et tirages backdoor ; les petites paires (22/44/55) et Ax/Kx offsuit faibles abandonnent.',
        activeCombos: SHISHI_FLOP_CBET,
      },
      {
        street: 'turn',
        label: 'TURN : K♣',
        board: ['9s', '6d', '3c', 'Kc'],
        newCards: ['Kc'],
        action: 'barrel',
        actionLabel: '2nd Barrel 75% pot',
        narrative:
          'Le K♣ favorise l’agresseur : BTN 2-barrel cher ses Kx (top paire+), sets, AA et ses tirages trèfle/quinte (QJs, JTs, 87s, 75s). Plusieurs 6x/88/77 et mains à faible équité sortent en check.',
        activeCombos: SHISHI_TURN_BARREL,
      },
      {
        street: 'river',
        label: 'RIVER : A♥',
        board: ['9s', '6d', '3c', 'Kc', 'Ah'],
        newCards: ['Ah'],
        action: 'barrel',
        actionLabel: '3rd Barrel 75% pot (Polarisé)',
        narrative:
          'L’A♥ crée une river ultra polarisée : BTN mise cher en value ses Ax forts (AK, AQ, AJ, AT, A9, DP, sets) + ses tirages manqués en bluff (QJ, JT, 87, 75), et check-back ses Kx moyens.',
        activeCombos: SHISHI_RIVER_BARREL,
      },
    ]),
    sismographe: {
      maskedStreetIndex: 2,
      focusDrawerId: 'mid_pairs',
      provenance: 'heuristic',
      prompt:
        'Au Turn K♣ (la matrice est masquée), quel bloc logique bascule en calque fantôme ou freine en check face au 2nd Barrel 75 % ?',
      options: [
        'Les paires intermédiaires (77/88/QQ–TT/6x) sans équité contre un Roi',
        'Les brelans et overpaires (99, 66, 33, AA)',
        'Les Kx (AK, KQ, KJ) qui viennent de toucher Top Paire',
      ],
      correctIndex: 0,
      explanation:
        'Sur le Turn K♣, BTN polarise son 2nd Barrel sur Kx / sets / AA + tirages forts (QJ, JT, 87, 75). Les paires intermédiaires et 6x basculent en check/fantôme.',
    },
    quizQuestions: [
      {
        id: 'shishi_q1_kj_removal',
        streetIndex: 2,
        focusHand: 'KJs',
        provenance: 'computed',
        prompt:
          'Au Turn K♣ (board 9♠ 6♦ 3♣ K♣), combien de combos exacts de KJs (et de KJ total KJs+KJo) restent disponibles dans le paquet ?',
        options: [
          'KJs = 3 combos • Famille KJ = 12 combos (-4 bloqués par K♣)',
          'KJs = 4 combos • Famille KJ = 16 combos (aucun blocage)',
          'KJs = 2 combos • Famille KJ = 8 combos (-8 bloqués)',
        ],
        correctIndex: 0,
        explanation:
          'Le Roi de trèfle (K♣) sur le board supprime exactement 1 combo de KJs (K♣J♣ → 3 restants) et 3 combos de KJo (K♣J♠/J♥/J♦ → 9 restants), soit 12 combos au lieu de 16 (-25 %).',
      },
      {
        id: 'shishi_q2_flop_ghost',
        streetIndex: 1,
        focusHand: '44',
        provenance: 'heuristic',
        prompt:
          'Sur le Flop 9♠ 6♦ 3♣, pourquoi les petites paires comme 44 et 22 passent-elles en calque fantôme (éliminées du range de C-Bet) ?',
        options: [
          'Elles n’ont que 2 outs pour améliorer et ne font rien coucher de meilleur sur 9-6-3r',
          'Elles bloquent les tirages couleur à trèfle du BB',
          'Elles ont 100 % d’équité et préfèrent overbet turn',
        ],
        correctIndex: 0,
        explanation:
          'Avec 22 ou 44 sous deux overcards (9 et 6), miser 33% ne fait pas passer les 9x/6x ni les gros broadways avec équité : check pour réaliser sa showdown value est bien meilleur.',
      },
      {
        id: 'shishi_q3_river_ak',
        streetIndex: 3,
        focusHand: 'AKo',
        provenance: 'computed',
        prompt:
          'À la River A♥ (9♠ 6♦ 3♣ K♣ A♥), combien de combos exacts de AK (AKs + AKo) restent possibles après le card removal de K♣ et A♥ ?',
        options: [
          '9 combos (2 AKs + 7 AKo) au lieu de 16',
          '12 combos (3 AKs + 9 AKo)',
          '6 combos (1 AKs + 5 AKo)',
        ],
        correctIndex: 0,
        explanation:
          'Il reste 3 As × 3 Rois = 9 combos de AK au total : 2 assortis (A♠K♠, A♦K♦) et 7 dépareillés, car A♥K♣ est doublement bloqué (7 = 9 − 2).',
      },
    ],
  },
  {
    id: 'bb_defense_q94_2s_js',
    title: 'Défense BB vs CO — Entonnoir de Call (Q♥ 9♠ 4♦ → 2♠ → J♠)',
    subtitle: 'Observez comment la range large de BB (~46 %) se resserre rue par rue jusqu’à la river',
    format: 'Cash Game 6-Max • 100bb',
    actorLabel: 'Hero (BB — Défenseur OOP)',
    provenanceKind: 'heuristic',
    riverBetPctPot: 75,
    provenance: {
      origin: 'heuristic',
      tool: 'Kill Tilt — Hand Reading Entonnoir BB',
      note: 'Modèle pédagogique de compression d’éventail face à un triple barrel CO',
      confidence: 'medium',
    },
    streets: enforceFunnelMonotonicity([
      {
        street: 'preflop',
        label: 'PRÉFLOP',
        board: [],
        newCards: [],
        action: 'call',
        actionLabel: 'Call BB vs CO 2.5x',
        narrative:
          'BB défend largement (~46 %) grâce à la cote directe IP/BB : paires moyennes/basses, suited connectors, Ax/Kx/Qx suited et broadways offsuit.',
        activeCombos: BB_DEF_PREFLOP,
      },
      {
        street: 'flop',
        label: 'FLOP : Q♥ 9♠ 4♦',
        board: ['Qh', '9s', '4d'],
        newCards: ['Qh', '9s', '4d'],
        action: 'call',
        actionLabel: 'Check-Call Flop',
        narrative:
          'BB jette ses poubelles sans connexion avec Q-9-4 (ex. K2s-K8s, 54o/76o sans backdoor) et défend Qx, 9x, 4x, OESD (JTs/T8s), gutshots (KTs/KJs) et paires sous la Q.',
        activeCombos: BB_DEF_FLOP,
      },
      {
        street: 'turn',
        label: 'TURN : 2♠',
        board: ['Qh', '9s', '4d', '2s'],
        newCards: ['2s'],
        action: 'call',
        actionLabel: 'Check-Call 2nd Barrel',
        narrative:
          'Le 2♠ ouvre un tirage couleur backdoor : les paires faibles (55–88) et 4x faibles sortent, tandis que Qx, 9x et tirages à pique (Axs/87s/76s) résistent.',
        activeCombos: BB_DEF_TURN,
      },
      {
        street: 'river',
        label: 'RIVER : J♠',
        board: ['Qh', '9s', '4d', '2s', 'Js'],
        newCards: ['Js'],
        action: 'call',
        actionLabel: 'Bluff-Catch & Value River',
        narrative:
          'Le J♠ complète les quintes (KTs/T8s) et la couleur à pique : seules les couleurs, quintes, DP (QJ/Q9), brelans et bons bluff-catchers Qx/Kx peuvent payer.',
        activeCombos: BB_DEF_RIVER,
      },
    ]),
    sismographe: {
      maskedStreetIndex: 2,
      focusDrawerId: 'air',
      provenance: 'heuristic',
      prompt:
        'Sur le Turn 2♠ face au 2nd Barrel CO, quel bloc de la défense BB sort en calque fantôme ?',
      options: [
        'Les petites paires sous le 9 (55–88) et les connecteurs ratés sans pique',
        'Les Top Paires Qx (KQ, QJ, QT)',
        'Les brelans 99 et 44',
      ],
      correctIndex: 0,
      explanation:
        'Sur Turn 2♠, BB abandonne ses paires faibles (55–88) et 4x faibles pour ne conserver que Qx, 9x et tirages quinte/pique.',
    },
    quizQuestions: [
      {
        id: 'bb_q1_qjs',
        streetIndex: 3,
        focusHand: 'QJs',
        provenance: 'computed',
        prompt:
          'À la River J♠ (Q♥ 9♠ 4♦ 2♠ J♠), pourquoi QJs tombe-t-elle à 2 combos restants au lieu de 4 ?',
        options: [
          'Q♥ (board) bloque Q♥J♥ et J♠ (board) bloque Q♠J♠',
          'Le 2♠ bloque les tirages couleur de BB',
          'Seule la Dame de cœur est sur le board',
        ],
        correctIndex: 0,
        explanation:
          'Q♥ élimine Q♥J♥ et J♠ élimine Q♠J♠ : il ne reste exactement que Q♦J♦ et Q♣J♣ (2 combos de deux paires assorties).',
      },
      {
        id: 'bb_q2_55',
        streetIndex: 2,
        focusHand: '55',
        provenance: 'heuristic',
        prompt:
          'Pourquoi 55 passe-t-il en calque fantôme dès le Turn 2♠ face au 2nd barrel du CO ?',
        options: [
          '3e/4e paire sans bloqueur majeur face à une range polarisée CO Qx+ / tirages forts',
          'Parce que 55 fait brelan sur le 2♠',
          'Parce que 55 bloque KTs',
        ],
        correctIndex: 0,
        explanation:
          'Sous Q-9-4-2, 55 est battu par toute la range de value du CO et possède très peu de bloqueurs sur ses bluffs.',
      },
      {
        id: 'bb_q3_kts',
        streetIndex: 3,
        focusHand: 'KTs',
        provenance: 'computed',
        prompt:
          'Sur la River J♠, quelle famille vient de compléter une quinte max (K-Q-J-T-9) dans le range de défense BB ?',
        options: ['KTs et KTo (quinte à l’As/Roi sur Q-J-T-9)', 'A4s uniquement', '66 et 55'],
        correctIndex: 0,
        explanation:
          'Sur Q-9-4-2-J, tous les KT (KTs + KTo) complètent la quinte par le haut K-Q-J-T-9.',
      },
    ],
  },
  {
    id: 'threebet_pot_a84c_th_2s',
    title: 'Pot 3-Bet IP — BTN 3-Bet vs CO (A♣ 8♦ 4♣ → T♥ → 2♠)',
    subtitle: 'Suivez la compression d’un range polarisé en pot 3-Bet jusqu’à la mise à tapis river',
    format: 'Cash Game 6-Max • 100bb',
    actorLabel: 'Hero (BTN — 3-Bettor IP)',
    provenanceKind: 'heuristic',
    riverBetPctPot: 75,
    provenance: {
      origin: 'heuristic',
      tool: 'Kill Tilt — Pot 3-Bet SPR bas',
      note: 'Modèle pédagogique 3-Bet IP avec card removal As de trèfle',
      confidence: 'medium',
    },
    streets: enforceFunnelMonotonicity([
      {
        street: 'preflop',
        label: 'PRÉFLOP',
        board: [],
        newCards: [],
        action: 'raise',
        actionLabel: '3-Bet 7.5bb BTN',
        narrative:
          'BTN 3-Bet un range structuré : premiums (JJ+/AK/AQ), bons broadways assortis, Ax suited bas (A5s–A3s) et connecteurs assortis.',
        activeCombos: THREEBET_PREFLOP,
      },
      {
        street: 'flop',
        label: 'FLOP : A♣ 8♦ 4♣',
        board: ['Ac', '8d', '4c'],
        newCards: ['Ac', '8d', '4c'],
        action: 'cbet',
        actionLabel: 'C-Bet 33% (Haute fréquence)',
        narrative:
          'Sur A-8-4 bicolore en pot 3-Bet, BTN C-Bet presque tout son range grâce à son énorme avantage de top paire/sets.',
        activeCombos: THREEBET_FLOP,
      },
      {
        street: 'turn',
        label: 'TURN : T♥',
        board: ['Ac', '8d', '4c', 'Th'],
        newCards: ['Th'],
        action: 'barrel',
        actionLabel: '2nd Barrel 66% pot',
        narrative:
          'Turn T♥ : les Ax forts, sets (AA/TT/88) et tirages couleur trèfle (KQs, KJs, QJs, JTs, 98s) continuent ; KK/QQ freinent en contrôle de pot.',
        activeCombos: THREEBET_TURN,
      },
      {
        street: 'river',
        label: 'RIVER : 2♠',
        board: ['Ac', '8d', '4c', 'Th', '2s'],
        newCards: ['2s'],
        action: 'barrel',
        actionLabel: 'Shove Value / Bluff River',
        narrative:
          'Brique 2♠ : BTN pousse en value AK/AQ/AJ/AT/sets et transforme en bluff ses tirages trèfle manqués (KQ/KJ/QJ/98/76 à trèfle).',
        activeCombos: THREEBET_RIVER,
      },
    ]),
    sismographe: {
      maskedStreetIndex: 2,
      focusDrawerId: 'mid_pairs',
      provenance: 'heuristic',
      prompt:
        'Sur Turn T♥ (board A♣ 8♦ 4♣ T♥), quel bloc logique freine en contrôle de pot et passe partiellement en fantôme ?',
      options: [
        'Les pocket pairs sous l’As (KK, QQ, JJ, 99)',
        'Les Top Paires Ax (AK, AQ, AJ)',
        'Les brelans AA et 88',
      ],
      correctIndex: 0,
      explanation:
        'Sur un tableau A-high, KK/QQ/JJ n’ont plus 3 rues de value : elles basculent en check pour contrôler le pot tandis que Ax+ et trèfles continuent.',
    },
    quizQuestions: [
      {
        id: 'tb_q1_ac_aa',
        streetIndex: 1,
        focusHand: 'AA',
        provenance: 'computed',
        prompt:
          'Dès le Flop A♣ 8♦ 4♣, combien de combos exacts de brelan d’As (AA) restent possibles avec A♣ sur le board ?',
        options: ['3 combos (A♠A♥, A♠A♦, A♥A♦)', '6 combos', '1 combo'],
        correctIndex: 0,
        explanation:
          'Un As étant exposé sur le board (A♣), il ne reste que 3 As dans le paquet : 3 × 2 / 2 = 3 combos de AA au lieu de 6.',
      },
      {
        id: 'tb_q2_kk_turn',
        streetIndex: 2,
        focusHand: 'KK',
        provenance: 'heuristic',
        prompt:
          'Sur le Turn T♥ (A♣ 8♦ 4♣ T♥), pourquoi KK/QQ ralentissent-elles (50 % puis check river) ?',
        options: [
          'En 2 barrels sur board A-high, seules de meilleures mains (Ax, TT, 88) paient',
          'Elles n’ont plus que 0 % contre 98s',
          'Elles sont devenues une quinte',
        ],
        correctIndex: 0,
        explanation:
          'Sur un tableau comportant un As, KK/QQ ont une excellente showdown value contre les bluffs/paires inférieures mais se font payer par mieux si elles misent 3 rues.',
      },
      {
        id: 'tb_q3_ak_combos',
        streetIndex: 1,
        focusHand: 'AKo',
        provenance: 'computed',
        prompt:
          'Avec A♣ sur le Flop A♣ 8♦ 4♣, combien de combos d’AKo restent-ils ?',
        options: ['9 combos (3 As × 4 Rois − 3 assortis)', '12 combos', '6 combos'],
        correctIndex: 0,
        explanation:
          'Les 3 combinaisons contenant A♣ sont supprimées : 3 As restants × 4 Rois = 12 AK au total, soit 3 AKs et 9 AKo.',
      },
    ],
  },
];

export function getScenarioById(id: string): EvolutionaryFunnelScenario {
  return (
    EVOLUTIONARY_FUNNEL_SCENARIOS.find((s) => s.id === id) ?? EVOLUTIONARY_FUNNEL_SCENARIOS[0]
  );
}

/**
 * Calcule en O(169) le différentiel complet de la matrice 13×13 à la street demandée :
 * actifs, éliminés à la street N (calque fantôme), éliminés précédemment et card removal exact.
 */
export function computeStreetMatrixDiff(
  scenario: EvolutionaryFunnelScenario,
  streetIndex: 0 | 1 | 2 | 3
): StreetMatrixDiffSummary {
  const preflopNode = scenario.streets[0];
  const prevNode = streetIndex > 0 ? scenario.streets[streetIndex - 1] : null;
  const currentNode = scenario.streets[streetIndex];

  const deckCombos = deckCombosRemaining(currentNode.board.length);
  const prevDeckCombos = prevNode ? deckCombosRemaining(prevNode.board.length) : deckCombos;
  void prevDeckCombos;

  let preflopTotalCombos = 0;
  let activeCombosExact = 0;
  let ghostCombosExact = 0;
  let blockedBoardCombosExact = 0;
  let prevActiveCombos = 0;
  let eliminatedByActionCombos = 0;
  let eliminatedByCardRemovalCombos = 0;

  let pairsCombos = 0;
  let suitedCombos = 0;
  let offsuitCombos = 0;

  const cells: MatrixCellDiff[] = MATRIX_HANDS.map((desc) => {
    const preEntry = preflopNode.activeCombos[desc.hand];
    const prevEntry = prevNode ? prevNode.activeCombos[desc.hand] : preEntry;
    const curEntry = currentNode.activeCombos[desc.hand];

    const freqPreflop = preEntry?.freq ?? 0;
    const freqPrev = prevEntry?.freq ?? 0;
    const freqCurrent = curEntry?.freq ?? 0;

    const removalCurrent = countUnblockedCombos(desc.hand, currentNode.board);
    const removalPrev = prevNode
      ? countUnblockedCombos(desc.hand, prevNode.board)
      : removalCurrent;

    const preCellTotal = removalCurrent.base * freqPreflop;
    const activeCombos = removalCurrent.remaining * freqCurrent;
    const ghostCellCombos = removalCurrent.remaining * Math.max(0, freqPreflop - freqCurrent);
    const blockedCellCombos = removalCurrent.blocked * freqPreflop;
    const prevCellCombos = prevNode ? removalPrev.remaining * freqPrev : activeCombos;

    let status: CellDiffStatus = 'never_in_range';
    if (freqCurrent > 0 && removalCurrent.remaining > 0) {
      status = 'active';
    } else if (streetIndex > 0 && freqPrev > 0) {
      status = 'eliminated_prev';
    } else if (freqPreflop > 0) {
      status = 'eliminated_earlier';
    }

    preflopTotalCombos += preCellTotal;
    activeCombosExact += activeCombos;
    ghostCombosExact += ghostCellCombos;
    blockedBoardCombosExact += blockedCellCombos;
    prevActiveCombos += prevCellCombos;

    if (streetIndex > 0) {
      const blockedDelta = Math.max(0, removalPrev.remaining - removalCurrent.remaining) * freqPrev;
      const actionDelta = Math.max(0, freqPrev - freqCurrent) * removalCurrent.remaining;
      eliminatedByCardRemovalCombos += blockedDelta;
      eliminatedByActionCombos += actionDelta;
    }

    if (activeCombos > 0) {
      if (desc.handType === 'pair') pairsCombos += activeCombos;
      else if (desc.handType === 'suited') suitedCombos += activeCombos;
      else offsuitCombos += activeCombos;
    }

    return {
      hand: desc.hand,
      row: desc.row,
      col: desc.col,
      handType: desc.handType,
      status,
      action: curEntry?.action ?? null,
      preflopAction: preEntry?.action ?? null,
      freqCurrent,
      freqPrev,
      freqPreflop,
      baseCombos: removalCurrent.base,
      unblockedCombos: removalCurrent.remaining,
      blockedByBoard: removalCurrent.blocked,
      blockingCards: removalCurrent.blockingCards,
      activeCombos,
      prevActiveCombos: prevCellCombos,
    };
  });

  const round1 = (v: number) => Math.round(v * 10) / 10;
  const [pairsPct, suitedPct, offsuitPct] = hamiltonRoundPercent([
    pairsCombos,
    suitedCombos,
    offsuitCombos,
  ]);

  return {
    streetIndex,
    node: currentNode,
    cells,
    preflopTotalCombos,
    activeCombosExact,
    ghostCombosExact,
    blockedBoardCombosExact,
    totalActiveCombos: round1(activeCombosExact),
    totalGhostCombos: round1(ghostCombosExact),
    totalBlockedByBoardCombos: round1(blockedBoardCombosExact),
    deckCombos,
    rangePct: Math.round((activeCombosExact / deckCombos) * 1000) / 10,
    prevActiveCombos: round1(prevActiveCombos),
    deltaCombosFromPrev: streetIndex === 0 ? 0 : round1(activeCombosExact - prevActiveCombos),
    eliminatedByActionCombos: round1(eliminatedByActionCombos),
    eliminatedByCardRemovalCombos: round1(eliminatedByCardRemovalCombos),
    composition: {
      pairsCombos: round1(pairsCombos),
      suitedCombos: round1(suitedCombos),
      offsuitCombos: round1(offsuitCombos),
      pairsPct,
      suitedPct,
      offsuitPct,
    },
  };
}

/** Retourne l'historique combinatoire exact d'une main à travers les 4 rues d'un scénario. */
export function inspectHandFunnelHistory(
  scenario: EvolutionaryFunnelScenario,
  hand: string
): HandFunnelInspection {
  const desc = MATRIX_HANDS.find((h) => h.hand === hand) ?? MATRIX_HANDS[0];
  const indices: (0 | 1 | 2 | 3)[] = [0, 1, 2, 3];

  const history: HandStreetHistoryItem[] = indices.map((idx) => {
    const node = scenario.streets[idx];
    const prevNode = idx > 0 ? scenario.streets[idx - 1] : null;
    const preEntry = scenario.streets[0].activeCombos[desc.hand];
    const prevEntry = prevNode ? prevNode.activeCombos[desc.hand] : preEntry;
    const curEntry = node.activeCombos[desc.hand];
    const freq = curEntry?.freq ?? 0;
    const freqPrev = prevEntry?.freq ?? 0;
    const freqPre = preEntry?.freq ?? 0;

    const removal = countUnblockedCombos(desc.hand, node.board);
    let status: CellDiffStatus = 'never_in_range';
    if (freq > 0 && removal.remaining > 0) status = 'active';
    else if (idx > 0 && freqPrev > 0) status = 'eliminated_prev';
    else if (freqPre > 0) status = 'eliminated_earlier';

    return {
      streetIndex: idx,
      street: node.street,
      label: node.label,
      board: node.board,
      status,
      action: curEntry?.action ?? null,
      freq,
      baseCombos: removal.base,
      unblockedCombos: removal.remaining,
      blockedByBoard: removal.blocked,
      blockingCards: removal.blockingCards,
      activeCombos: Math.round(removal.remaining * freq * 10) / 10,
    };
  });

  const familyAtStreet = (streetIndex: 0 | 1 | 2 | 3): PairedFamilySummary | null => {
    if (desc.handType === 'pair') return null;
    const r1 = desc.hand[0];
    const r2 = desc.hand[1];
    const suitedHand = `${r1}${r2}s`;
    const offsuitHand = `${r1}${r2}o`;
    const board = scenario.streets[streetIndex].board;
    const sRem = countUnblockedCombos(suitedHand, board);
    const oRem = countUnblockedCombos(offsuitHand, board);
    const sFreq = scenario.streets[streetIndex].activeCombos[suitedHand]?.freq ?? 0;
    const oFreq = scenario.streets[streetIndex].activeCombos[offsuitHand]?.freq ?? 0;
    return {
      familyName: `${r1}${r2}`,
      suitedHand,
      offsuitHand,
      baseTotal: 16,
      unblockedTotal: sRem.remaining + oRem.remaining,
      activeTotal: Math.round((sRem.remaining * sFreq + oRem.remaining * oFreq) * 10) / 10,
      blockedTotal: sRem.blocked + oRem.blocked,
    };
  };

  return {
    hand: desc.hand,
    handType: desc.handType,
    history,
    familyAtStreet,
  };
}


// ============================================================================
// LOT 1 & 2 — PALM-FUNNEL : TIROIRS (SCALPEL), BLOQUEURS & ARBITRE RIVER
// ============================================================================

export interface DrawerDefinition {
  id: FunnelDrawerId;
  label: string;
  shortDesc: string;
}

export const DRAWER_DEFINITIONS: readonly DrawerDefinition[] = [
  { id: 'sets_overpairs', label: 'Brelans / Overpaires', shortDesc: 'Sets, DP et grosses overpaires' },
  { id: 'top_pairs', label: 'Top Paires', shortDesc: 'TP avec la plus haute carte du board' },
  { id: 'mid_pairs', label: 'Paires intermédiaires', shortDesc: '2e / 3e paire et pocket pairs moyennes' },
  { id: 'draws', label: 'Tirages (Flush / Quinte)', shortDesc: 'OESD, gutshots et tirages couleur' },
  { id: 'overcards_bd', label: 'Overcards & Backdoors', shortDesc: 'Broadways et Ax/Kx au-dessus du flop' },
  { id: 'air', label: 'Air pur / Petites PP', shortDesc: 'Mains sans connexion ni équité forte' },
] as const;

export const DRAWER_STEP_FREQS: readonly DrawerStepFreq[] = [0, 0.25, 0.5, 0.75, 1] as const;

export function drawerFreqLabel(freq: DrawerStepFreq): string {
  if (freq === 0) return 'Jamais (0%)';
  if (freq === 0.25) return 'Rare (25%)';
  if (freq === 0.5) return 'Moitié (50%)';
  if (freq === 0.75) return 'Majoritaire (75%)';
  return 'Toujours (100%)';
}

function rankOrderIdx(rank: string): number {
  const idx = RANKS.indexOf(rank.toUpperCase());
  return idx >= 0 ? idx : 12;
}

function hasStraightWithBoard(r1: string, r2: string, boardRanks: readonly string[]): boolean {
  const vals = new Set<number>();
  const addRankVal = (r: string) => {
    const i = RANKS.indexOf(r.toUpperCase());
    if (i < 0) return;
    const v = 14 - i;
    vals.add(v);
    if (v === 14) vals.add(1);
  };
  addRankVal(r1);
  addRankVal(r2);
  boardRanks.forEach(addRankVal);

  const sorted = Array.from(vals).sort((a, b) => a - b);
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) {
      run += 1;
      if (run >= 5) return true;
    } else {
      run = 1;
    }
  }
  return false;
}

/** Classe déterministement une main 13×13 dans son tiroir logique selon la texture du tableau. */
export function classifyHandToDrawer(hand: string, board: readonly string[]): FunnelDrawerId {
  if (!board.length) {
    if (hand.length === 2) {
      return rankOrderIdx(hand[0]) <= 3 ? 'sets_overpairs' : 'mid_pairs';
    }
    return rankOrderIdx(hand[0]) <= 4 ? 'overcards_bd' : 'draws';
  }

  const boardRanks = board
    .map((c) => c[0]?.toUpperCase() ?? '')
    .filter(Boolean)
    .sort((a, b) => rankOrderIdx(a) - rankOrderIdx(b));
  const uniqueBoardRanks = Array.from(new Set(boardRanks));
  const topRank = uniqueBoardRanks[0] ?? 'A';
  const secondRank = uniqueBoardRanks[1] ?? topRank;

  const r1 = hand[0]?.toUpperCase() ?? 'A';
  const r2 = hand[1]?.toUpperCase() ?? 'K';
  const isPair = hand.length === 2 || r1 === r2;
  const isSuited = hand.length === 3 && hand[2]?.toLowerCase() === 's';

  if (isPair) {
    if (uniqueBoardRanks.includes(r1) || rankOrderIdx(r1) < rankOrderIdx(topRank)) {
      return 'sets_overpairs';
    }
    if (rankOrderIdx(r1) < rankOrderIdx(secondRank)) {
      return 'mid_pairs';
    }
    return 'air';
  }

  const hitR1 = uniqueBoardRanks.includes(r1);
  const hitR2 = uniqueBoardRanks.includes(r2);
  if (hitR1 && hitR2) return 'sets_overpairs';
  if (r1 === topRank || r2 === topRank) return 'top_pairs';
  if (hitR1 || hitR2) return 'mid_pairs';

  if (hasStraightWithBoard(r1, r2, uniqueBoardRanks)) {
    return 'sets_overpairs';
  }

  const gap = Math.abs(rankOrderIdx(r1) - rankOrderIdx(r2));
  const topIdx = rankOrderIdx(topRank);
  const r1Idx = rankOrderIdx(r1);
  const r2Idx = rankOrderIdx(r2);

  // Connecteurs ou broadways non-Ax sous la top card du board -> tirages quinte/flush
  if (gap <= 3 && (r1Idx >= topIdx || isSuited) && r2Idx <= 10) {
    return 'draws';
  }
  if (r1Idx < topIdx || (r1 === 'A' && isSuited)) {
    return 'overcards_bd';
  }
  return isSuited ? 'draws' : 'air';
}

export interface StreetDrawerSpec {
  id: FunnelDrawerId;
  label: string;
  shortDesc: string;
  hands: readonly string[];
  incomingCombos: number;
  referenceActiveCombos: number;
  referenceFreq: DrawerStepFreq;
  isMajorDrawer: boolean;
}

function snapToStepFreq(ratio: number): DrawerStepFreq {
  let best: DrawerStepFreq = 0;
  let bestDist = Infinity;
  for (const step of DRAWER_STEP_FREQS) {
    const d = Math.abs(ratio - step);
    if (d < bestDist) {
      bestDist = d;
      best = step;
    }
  }
  return best;
}

/** Regroupe les mains entrantes d'une rue en tiroirs logiques pour le mode Scalpel (sans clic 169×). */
export function computeDrawersForStreet(
  scenario: EvolutionaryFunnelScenario,
  streetIndex: 0 | 1 | 2 | 3
): readonly StreetDrawerSpec[] {
  const prevNode = streetIndex > 0 ? scenario.streets[streetIndex - 1] : scenario.streets[0];
  const currNode = scenario.streets[streetIndex];

  const grouped = new Map<
    FunnelDrawerId,
    { hands: string[]; incoming: number; refActive: number }
  >();
  for (const def of DRAWER_DEFINITIONS) {
    grouped.set(def.id, { hands: [], incoming: 0, refActive: 0 });
  }

  for (const desc of MATRIX_HANDS) {
    const prevFreq = prevNode.activeCombos[desc.hand]?.freq ?? 0;
    if (prevFreq <= 0) continue;
    const removal = countUnblockedCombos(desc.hand, currNode.board);
    if (removal.remaining <= 0) continue;
    const currFreq = currNode.activeCombos[desc.hand]?.freq ?? 0;
    const incomingCombos = removal.remaining * prevFreq;
    const refCombos = removal.remaining * currFreq;
    const drawerId = classifyHandToDrawer(desc.hand, currNode.board);
    const bucket = grouped.get(drawerId)!;
    bucket.hands.push(desc.hand);
    bucket.incoming += incomingCombos;
    bucket.refActive += refCombos;
  }

  let totalRefActive = 0;
  for (const b of grouped.values()) totalRefActive += b.refActive;

  const round1 = (v: number) => Math.round(v * 10) / 10;

  return DRAWER_DEFINITIONS.map((def) => {
    const b = grouped.get(def.id)!;
    const ratio = b.incoming > 0 ? b.refActive / b.incoming : 0;
    return {
      id: def.id,
      label: def.label,
      shortDesc: def.shortDesc,
      hands: b.hands,
      incomingCombos: round1(b.incoming),
      referenceActiveCombos: round1(b.refActive),
      referenceFreq: snapToStepFreq(ratio),
      isMajorDrawer: totalRefActive > 0 && b.refActive >= 0.15 * totalRefActive,
    };
  }).filter((d) => d.incomingCombos > 0);
}

export interface ScalpelDrawerDetail {
  id: FunnelDrawerId;
  label: string;
  incomingCombos: number;
  userFreq: DrawerStepFreq;
  userCombos: number;
  referenceFreq: DrawerStepFreq;
  referenceCombos: number;
  isMajorDrawer: boolean;
}

export interface ScalpelEvaluationResult {
  cells: readonly MatrixCellDiff[];
  drawers: readonly ScalpelDrawerDetail[];
  userTotalCombos: number;
  refTotalCombos: number;
  overlapScore: number; // 0..1
  overlapPct: number; // 0..100
  missedMajorDrawer: boolean;
  minorDrawerImbalance: boolean;
}

/** Applique les fréquences par tiroirs sur la matrice 13×13 et calcule le recouvrement pondéré par combos. */
export function evaluateScalpelPruning(
  scenario: EvolutionaryFunnelScenario,
  streetIndex: 0 | 1 | 2 | 3,
  userDrawerFreqs: Partial<Record<FunnelDrawerId, DrawerStepFreq>>
): ScalpelEvaluationResult {
  const preNode = scenario.streets[0];
  const prevNode = streetIndex > 0 ? scenario.streets[streetIndex - 1] : scenario.streets[0];
  const currNode = scenario.streets[streetIndex];
  const drawerSpecs = computeDrawersForStreet(scenario, streetIndex);
  const specMap = new Map(drawerSpecs.map((d) => [d.id, d]));

  const cells: MatrixCellDiff[] = MATRIX_HANDS.map((desc) => {
    const preEntry = preNode.activeCombos[desc.hand];
    const prevEntry = prevNode.activeCombos[desc.hand];
    const freqPreflop = preEntry?.freq ?? 0;
    const freqPrev = prevEntry?.freq ?? 0;
    const removal = countUnblockedCombos(desc.hand, currNode.board);
    const drawerId = classifyHandToDrawer(desc.hand, currNode.board);
    const selectedFreq: DrawerStepFreq = userDrawerFreqs[drawerId] ?? 0;
    const effectiveFreq = Math.min(freqPrev, selectedFreq);
    const activeCombos = removal.remaining * effectiveFreq;

    let status: CellDiffStatus = 'never_in_range';
    if (effectiveFreq > 0 && removal.remaining > 0) {
      status = 'active';
    } else if (streetIndex > 0 && freqPrev > 0) {
      status = 'eliminated_prev';
    } else if (freqPreflop > 0) {
      status = 'eliminated_earlier';
    }

    return {
      hand: desc.hand,
      row: desc.row,
      col: desc.col,
      handType: desc.handType,
      status,
      action: effectiveFreq > 0 ? currNode.action : null,
      preflopAction: preEntry?.action ?? null,
      freqCurrent: effectiveFreq,
      freqPrev,
      freqPreflop,
      baseCombos: removal.base,
      unblockedCombos: removal.remaining,
      blockedByBoard: removal.blocked,
      blockingCards: removal.blockingCards,
      activeCombos,
      prevActiveCombos: removal.remaining * freqPrev,
    };
  });

  let userTotalCombos = 0;
  let refTotalCombos = 0;
  let l1Diff = 0;
  let maxUnion = 0;
  let missedMajorDrawer = false;
  let minorDrawerImbalance = false;

  const round1 = (v: number) => Math.round(v * 10) / 10;

  const drawers: ScalpelDrawerDetail[] = drawerSpecs.map((spec) => {
    const uFreq: DrawerStepFreq = userDrawerFreqs[spec.id] ?? 0;
    const uCombos = spec.incomingCombos * uFreq;
    const rCombos = spec.referenceActiveCombos;

    userTotalCombos += uCombos;
    refTotalCombos += rCombos;
    l1Diff += Math.abs(uCombos - rCombos);
    maxUnion += Math.max(uCombos, rCombos);

    if (spec.isMajorDrawer && uFreq === 0) {
      missedMajorDrawer = true;
    }
    if (Math.abs(uFreq - spec.referenceFreq) >= 0.25) {
      minorDrawerImbalance = true;
    }

    return {
      id: spec.id,
      label: spec.label,
      incomingCombos: spec.incomingCombos,
      userFreq: uFreq,
      userCombos: round1(uCombos),
      referenceFreq: spec.referenceFreq,
      referenceCombos: rCombos,
      isMajorDrawer: spec.isMajorDrawer,
    };
  });

  void specMap;
  const overlapScore =
    maxUnion > 0 ? Math.max(0, Math.min(1, 1 - l1Diff / maxUnion)) : 1;

  return {
    cells,
    drawers,
    userTotalCombos: round1(userTotalCombos),
    refTotalCombos: round1(refTotalCombos),
    overlapScore,
    overlapPct: Math.round(overlapScore * 100),
    missedMajorDrawer,
    minorDrawerImbalance,
  };
}

/** Compte exactement les combos restants d'une classe ('KJs', 'AA') ou d'une famille ('AK' = AKs+AKo). */
export function countFamilyUnblockedCombos(
  targetFamily: string,
  deadCards: readonly string[]
): { base: number; remaining: number; blocked: number } {
  if (targetFamily.length === 2 && targetFamily[0] !== targetFamily[1]) {
    const suited = countUnblockedCombos(`${targetFamily}s`, deadCards);
    const offsuit = countUnblockedCombos(`${targetFamily}o`, deadCards);
    return {
      base: suited.base + offsuit.base,
      remaining: suited.remaining + offsuit.remaining,
      blocked: suited.blocked + offsuit.blocked,
    };
  }
  const single = countUnblockedCombos(targetFamily, deadCards);
  return { base: single.base, remaining: single.remaining, blocked: single.blocked };
}

export interface BlockerDrillSpec {
  id: string;
  board: readonly string[];
  heroCards: readonly string[];
  targetFamily: string;
  prompt: string;
  correctCombos: number;
  options: readonly number[];
  explanation: string;
  provenance: 'computed';
}

function buildDrillOptions(correct: number, base: number): number[] {
  const set = new Set<number>([correct]);
  const deltas = [-3, 3, -4, 4, -2, 2, -1, 1];
  for (const d of deltas) {
    if (set.size >= 4) break;
    const cand = correct + d;
    if (cand >= 0 && cand <= base) set.add(cand);
  }
  for (let v = 0; v <= base && set.size < 4; v++) {
    set.add(v);
  }
  return Array.from(set).sort((a, b) => a - b);
}

/** Génère la salve de 10 micro-drills chronométrés pour Mode 3 — L'Œil du Bloqueur (`computed`). */
export function buildBlockerDrills(): readonly BlockerDrillSpec[] {
  const templates: {
    id: string;
    board: readonly string[];
    heroCards: readonly string[];
    targetFamily: string;
    prompt: string;
    why: string;
  }[] = [
    {
      id: 'blk_01_ak_turn_kc',
      board: ['9s', '6d', '3c', 'Kc'],
      heroCards: [],
      targetFamily: 'AK',
      prompt: 'Sur le Turn K♣ (9♠ 6♦ 3♣ K♣), combien reste-t-il de combos d’AK chez Vilain ?',
      why: 'K♣ retire 1 Roi du paquet : 4 As × 3 Rois = 12 combos d’AK (3 AKs + 9 AKo).',
    },
    {
      id: 'blk_02_ak_kc_hero_kqs',
      board: ['9s', '6d', '3c', 'Kc'],
      heroCards: ['Kd', 'Qs'],
      targetFamily: 'AK',
      prompt: 'Sur Turn K♣ avec Hero tenant K♦ Q♠, combien de combos d’AK restent possibles ?',
      why: 'Deux Rois sont morts (K♣ et K♦) : 4 As × 2 Rois restants = 8 combos d’AK.',
    },
    {
      id: 'blk_03_ak_kc_hero_a5s',
      board: ['9s', '6d', '3c', 'Kc'],
      heroCards: ['As', '5s'],
      targetFamily: 'AK',
      prompt: 'Sur Turn K♣ avec votre bloqueur A♠ 5♠, combien reste-t-il de combos d’AK ?',
      why: 'A♠ et K♣ sont morts : 3 As × 3 Rois = 9 combos d’AK au lieu de 16.',
    },
    {
      id: 'blk_04_kjs_turn_kc',
      board: ['9s', '6d', '3c', 'Kc'],
      heroCards: [],
      targetFamily: 'KJs',
      prompt: 'Sur Turn K♣ (9♠ 6♦ 3♣ K♣), combien reste-t-il de combos exacts de KJs ?',
      why: 'K♣J♣ est impossible : il ne reste que K♠J♠, K♥J♥ et K♦J♦ (3 combos).',
    },
    {
      id: 'blk_05_aa_river_ah',
      board: ['9s', '6d', '3c', 'Kc', 'Ah'],
      heroCards: [],
      targetFamily: 'AA',
      prompt: 'À la River A♥ (9♠ 6♦ 3♣ K♣ A♥), combien de combos de brelan d’As (AA) existent ?',
      why: 'Avec A♥ au tableau, il reste 3 As : C(3,2) = 3 combos de AA.',
    },
    {
      id: 'blk_06_aa_river_ah_hero_as5s',
      board: ['9s', '6d', '3c', 'Kc', 'Ah'],
      heroCards: ['As', '5s'],
      targetFamily: 'AA',
      prompt: 'River A♥ et vous détenez A♠ 5♠ : combien de combos d’AA restent chez Vilain ?',
      why: 'Deux As sont morts (A♥ et A♠) : il ne reste qu’un seul combo (A♦A♣).',
    },
    {
      id: 'blk_07_ak_river_ah_kc',
      board: ['9s', '6d', '3c', 'Kc', 'Ah'],
      heroCards: ['Qd', 'Jh'],
      targetFamily: 'AK',
      prompt: 'River 9♠ 6♦ 3♣ K♣ A♥ (Hero Q♦ J♥) : combien de combos d’AK restent au total ?',
      why: '3 As × 3 Rois restants = 9 combos d’AK (2 AKs + 7 AKo).',
    },
    {
      id: 'blk_08_kq_flop_kc_hero_kdqs',
      board: ['9s', '6d', '3c', 'Kc'],
      heroCards: ['Kd', 'Qs'],
      targetFamily: 'KQ',
      prompt: 'Turn K♣ et vous avez K♦ Q♠ : combien de combos de KQ restent dans sa range ?',
      why: '2 Rois morts (K♣, K♦) et 1 Dame morte (Q♠) → 2 Rois × 3 Dames = 6 combos de KQ.',
    },
    {
      id: 'blk_09_qq_q94_hero_qs9h',
      board: ['Qh', '9s', '4d'],
      heroCards: ['Qs', '9h'],
      targetFamily: 'QQ',
      prompt: 'Sur Q♥ 9♠ 4♦ avec Q♠ 9♥ en main, combien reste-t-il de combos de brelan de Dames (QQ) ?',
      why: 'Deux Dames sont connues (Q♥, Q♠) → 1 seul combo de QQ (Q♦Q♣).',
    },
    {
      id: 'blk_10_kj_turn_kc_hero_jd9d',
      board: ['9s', '6d', '3c', 'Kc'],
      heroCards: ['Jd', '9d'],
      targetFamily: 'KJ',
      prompt: 'Turn K♣ avec Hero J♦ 9♦ : combien de combos de KJ (KJs + KJo) restent chez Vilain ?',
      why: '3 Rois restants × 3 Valets restants = 9 combos de KJ.',
    },
  ];

  return templates.map((t) => {
    const dead = [...t.board, ...t.heroCards];
    const counted = countFamilyUnblockedCombos(t.targetFamily, dead);
    return {
      id: t.id,
      board: t.board,
      heroCards: t.heroCards,
      targetFamily: t.targetFamily,
      prompt: t.prompt,
      correctCombos: counted.remaining,
      options: buildDrillOptions(counted.remaining, counted.base),
      explanation: `${t.why} (Calcul exact : ${counted.remaining}/${counted.base} combos non bloqués).`,
      provenance: 'computed',
    };
  });
}

export interface RiverArbitratorAnalysis {
  scenarioId: string;
  riverBoard: readonly string[];
  betPctPot: number;
  potOddsPct: number;
  valueCombos: number;
  bluffCombos: number;
  totalRiverCombos: number;
  valueSharePct: number;
  bluffSharePct: number;
  optimalDecision: 'call' | 'fold';
  evCallPotUnits: number;
  explanation: string;
  provenance: 'computed';
}

function classifyRiverComboRole(hand: string, riverBoard: readonly string[]): 'value' | 'bluff' {
  const boardRanks = Array.from(
    new Set(riverBoard.map((c) => c[0]?.toUpperCase() ?? '').filter(Boolean))
  ).sort((a, b) => rankOrderIdx(a) - rankOrderIdx(b));
  const r1 = hand[0]?.toUpperCase() ?? 'A';
  const r2 = hand[1]?.toUpperCase() ?? 'K';

  if (hand.length === 2 || r1 === r2) {
    if (boardRanks.includes(r1) || rankOrderIdx(r1) <= rankOrderIdx(boardRanks[1] ?? 'A')) {
      return 'value';
    }
    return 'bluff';
  }
  if (boardRanks.includes(r1) || boardRanks.includes(r2)) {
    return 'value';
  }
  if (hasStraightWithBoard(r1, r2, boardRanks)) {
    return 'value';
  }
  return 'bluff';
}

/** Mode 4 — L'Arbitre River : bilan Value/Bluff en fréquences naturelles, cote du pot et EV exacte. */
export function computeRiverArbitrator(
  scenario: EvolutionaryFunnelScenario
): RiverArbitratorAnalysis {
  const riverDiff = computeStreetMatrixDiff(scenario, 3);
  const riverBoard = riverDiff.node.board;

  let valueExact = 0;
  let bluffExact = 0;
  for (const cell of riverDiff.cells) {
    if (cell.activeCombos <= 0) continue;
    const role = classifyRiverComboRole(cell.hand, riverBoard);
    if (role === 'value') valueExact += cell.activeCombos;
    else bluffExact += cell.activeCombos;
  }

  const totalExact = valueExact + bluffExact;
  const round1 = (v: number) => Math.round(v * 10) / 10;
  const [valueSharePct, bluffSharePct] = hamiltonRoundPercent([valueExact, bluffExact]);

  const betPctPot = scenario.riverBetPctPot;
  const betFrac = betPctPot / 100;
  const potOddsPct = Math.round((betFrac / (1 + 2 * betFrac)) * 1000) / 10;
  const rawBluffEq = totalExact > 0 ? bluffExact / totalExact : 0;
  const evCallPotUnits =
    Math.round((rawBluffEq * (1 + 2 * betFrac) - betFrac) * 1000) / 1000;
  const optimalDecision: 'call' | 'fold' =
    rawBluffEq * 100 > potOddsPct ? 'call' : 'fold';

  return {
    scenarioId: scenario.id,
    riverBoard,
    betPctPot,
    potOddsPct,
    valueCombos: round1(valueExact),
    bluffCombos: round1(bluffExact),
    totalRiverCombos: round1(totalExact),
    valueSharePct,
    bluffSharePct,
    optimalDecision,
    evCallPotUnits,
    explanation: `Face à une mise de ${betPctPot} % du pot, la cote demande ${potOddsPct.toFixed(
      1
    )} % d’équité (bluffs adverses). Avec ${round1(valueExact)} combos de Value (${valueSharePct} %) et ${round1(
      bluffExact
    )} combos de Bluffs manqués (${bluffSharePct} %), ${
      optimalDecision === 'call'
        ? `le bluff-catcher doit Payer (+${evCallPotUnits.toFixed(2)} pot d’EV).`
        : `il faut Folder disciplinément (${evCallPotUnits.toFixed(2)} pot d’EV).`
    }`,
    provenance: 'computed',
  };
}
