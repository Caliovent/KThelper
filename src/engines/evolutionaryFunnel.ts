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
}

export interface EvolutionaryFunnelScenario {
  id: string;
  title: string;
  subtitle: string;
  format: string;
  actorLabel: string;
  provenance: Provenance;
  streets: readonly [StreetNode, StreetNode, StreetNode, StreetNode];
  quizQuestions: readonly FunnelQuizQuestion[];
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
  totalActiveCombos: number;
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

/** Calcule le card removal exact d'une classe de main face aux cartes connues du board. */
export function countUnblockedCombos(
  handClass: string,
  board: readonly string[]
): {
  base: number;
  remaining: number;
  blocked: number;
  blockingCards: string[];
} {
  const concrete = enumerateConcreteCombos(handClass);
  const boardNorm = board.map(normalizeCard);
  const boardSet = new Set(boardNorm);
  let remaining = 0;
  const blockersUsed = new Set<string>();

  for (const [c1, c2] of concrete) {
    const hit1 = boardSet.has(c1);
    const hit2 = boardSet.has(c2);
    if (hit1) blockersUsed.add(c1);
    if (hit2) blockersUsed.add(c2);
    if (!hit1 && !hit2) remaining += 1;
  }

  return {
    base: concrete.length,
    remaining,
    blocked: concrete.length - remaining,
    blockingCards: boardNorm.filter((c) => blockersUsed.has(c)),
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
    quizQuestions: [
      {
        id: 'shishi_q1_kj_removal',
        streetIndex: 2,
        focusHand: 'KJs',
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
    quizQuestions: [
      {
        id: 'bb_q1_qjs',
        streetIndex: 3,
        focusHand: 'QJs',
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
    quizQuestions: [
      {
        id: 'tb_q1_ac_aa',
        streetIndex: 1,
        focusHand: 'AA',
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

  let totalActiveCombos = 0;
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

    const activeCombos = removalCurrent.remaining * freqCurrent;
    const prevCellCombos = prevNode ? removalPrev.remaining * freqPrev : activeCombos;

    let status: CellDiffStatus = 'never_in_range';
    if (freqCurrent > 0 && removalCurrent.remaining > 0) {
      status = 'active';
    } else if (streetIndex > 0 && freqPrev > 0) {
      status = 'eliminated_prev';
    } else if (freqPreflop > 0) {
      status = 'eliminated_earlier';
    }

    totalActiveCombos += activeCombos;
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
  const totalSafe = Math.max(0.0001, totalActiveCombos);

  return {
    streetIndex,
    node: currentNode,
    cells,
    totalActiveCombos: round1(totalActiveCombos),
    deckCombos,
    rangePct: Math.round((totalActiveCombos / deckCombos) * 1000) / 10,
    prevActiveCombos: round1(prevActiveCombos),
    deltaCombosFromPrev: streetIndex === 0 ? 0 : round1(totalActiveCombos - prevActiveCombos),
    eliminatedByActionCombos: round1(eliminatedByActionCombos),
    eliminatedByCardRemovalCombos: round1(eliminatedByCardRemovalCombos),
    composition: {
      pairsCombos: round1(pairsCombos),
      suitedCombos: round1(suitedCombos),
      offsuitCombos: round1(offsuitCombos),
      pairsPct: totalActiveCombos > 0 ? Math.round((pairsCombos / totalSafe) * 1000) / 10 : 0,
      suitedPct: totalActiveCombos > 0 ? Math.round((suitedCombos / totalSafe) * 1000) / 10 : 0,
      offsuitPct: totalActiveCombos > 0 ? Math.round((offsuitCombos / totalSafe) * 1000) / 10 : 0,
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
