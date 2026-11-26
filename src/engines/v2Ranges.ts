import type { Action, FormatKind, Position, Provenance } from '../domain/types.ts';

export type V2ActionCode = 'mr' | 'shv' | '3b' | '4b' | 'c' | 'limp' | 'f';
export type V2FreqVector = Partial<Record<V2ActionCode, number>>;

export interface V2RangeGroup {
  hands: string[];
  freq: V2FreqVector;
}

export interface V2WeightedRangeSpec {
  id: string;
  format: 'cash_6max' | 'mtt_classic' | 'expresso_3max';
  formatKind: FormatKind;
  stackBB: number;
  anteBB: number;
  rakeProfile?: string;
  icmMode?: 'chipEV' | 'wta';
  position: Position;
  scenario: string;
  line: Action[];
  provenance: Provenance;
  summary: Record<string, number>;
  groups: V2RangeGroup[];
}

export const V2_ACTION_PALETTE: Record<V2ActionCode, { label: string; color: string }> = {
  mr: { label: 'Open / Min-Raise', color: '#22C55E' },
  shv: { label: 'All-In / Shove', color: '#9333EA' },
  '3b': { label: '3-Bet', color: '#EF4444' },
  '4b': { label: '4-Bet', color: '#A855F7' },
  c: { label: 'Call / Défense', color: '#38BDF8' },
  limp: { label: 'Limp (Trap/Stab)', color: '#F59E0B' },
  f: { label: 'Fold', color: '#1E293B' },
};

export function expandRangeGroups(groups: readonly V2RangeGroup[]): Record<string, V2FreqVector> {
  const out: Record<string, V2FreqVector> = {};
  for (const g of groups) {
    for (const hand of g.hands) {
      out[hand] = { ...g.freq };
    }
  }
  return out;
}

/** Arrondit à la volée les fréquences au multiple de 25% (pas de 0.25) en conservant la somme = 1. */
export function simplifyFreqVector25(vec: V2FreqVector): V2FreqVector {
  const entries = (Object.entries(vec) as [V2ActionCode, number][]).filter(([, v]) => v > 0);
  if (entries.length === 0) return { f: 1 };
  const rawUnits = entries.map(([k, v]) => ({ k, exact: v * 4, floor: Math.floor(v * 4) }));
  let remaining = 4 - rawUnits.reduce((s, u) => s + u.floor, 0);
  const byRemainder = [...rawUnits].sort((a, b) => b.exact - b.floor - (a.exact - a.floor));
  for (let i = 0; i < remaining && i < byRemainder.length; i++) {
    byRemainder[i].floor += 1;
  }
  const res: V2FreqVector = {};
  for (const u of rawUnits) {
    if (u.floor > 0) res[u.k] = u.floor / 4;
  }
  return res;
}

export const V2_WEIGHTED_RANGES: V2WeightedRangeSpec[] = [
  {
    id: 'cash_6max_100bb_bb_vs_btn_3bet_polar',
    format: 'cash_6max',
    formatKind: 'cash',
    stackBB: 100,
    anteBB: 0,
    rakeProfile: 'NL50_NL100',
    position: 'BB',
    scenario: 'Cash 6-Max 100bb — BB vs BTN Open 2.5x (3-Bet Polarisé)',
    line: ['3bet', 'call', 'fold'],
    provenance: {
      origin: 'computed',
      note: 'Table mixte pondérée sur 1 326 combos (heuristique de référence V2, hors solveur complet)',
      confidence: 'medium',
    },
    summary: { '3bPct': 9.47, callPct: 30.8, defendTotalPct: 40.27, combos3b: 125.6, combosCall: 408.4 },
    groups: [
      { hands: ['AA', 'KK', 'QQ', 'JJ', 'TT', 'AKs', 'AQs', 'AJs', 'AKo', 'AQo', 'KQs'], freq: { '3b': 1.0 } },
      { hands: ['99', 'AJo', 'KJs', 'QJs'], freq: { '3b': 0.5, c: 0.5 } },
      { hands: ['A5s', 'A4s', 'K6s', 'K5s', '75s', '65s', '54s'], freq: { '3b': 0.75, c: 0.25 } },
      { hands: ['A3s', 'A2s', 'K7s', 'Q6s', '86s', '76s'], freq: { '3b': 0.4, c: 0.6 } },
      { hands: ['A9o', 'A8o', 'KTo', 'QTo'], freq: { '3b': 0.25, c: 0.75 } },
      {
        hands: [
          '88', '77', '66', '55', '44', '33', '22',
          'ATs', 'A9s', 'A8s', 'A7s', 'A6s',
          'KTs', 'K9s', 'K8s', 'K4s', 'K3s', 'K2s',
          'QTs', 'Q9s', 'Q8s', 'Q7s', 'Q5s', 'Q4s', 'Q3s', 'Q2s',
          'JTs', 'J9s', 'J8s', 'J7s',
          'T9s', 'T8s', 'T7s',
          '98s', '97s', '87s', '64s', '53s', '43s',
          'ATo', 'KQo', 'KJo', 'QJo', 'JTo', 'T9o', '98o',
          'A7o', 'A6o', 'A5o', 'A4o', 'K9o', 'Q9o', 'J9o',
        ],
        freq: { c: 1.0 },
      },
    ],
  },
  {
    id: 'cash_6max_100bb_co_vs_btn_3bet_4bet_polar',
    format: 'cash_6max',
    formatKind: 'cash',
    stackBB: 100,
    anteBB: 0,
    rakeProfile: 'NL50_NL100',
    position: 'CO',
    scenario: 'Cash 6-Max 100bb — CO vs BTN 3-Bet 7.5bb (4-Bet Polarisé)',
    line: ['4bet', 'call', 'fold'],
    provenance: {
      origin: 'computed',
      note: 'Table mixte pondérée sur l’éventail d’ouverture CO (54 combos 4-Bet / 77 combos Call)',
      confidence: 'medium',
    },
    summary: { '4bOfOpenPct': 15.0, callOfOpenPct: 21.4, foldOfOpenPct: 63.6, combos4b: 54.0, combosCall: 77.0 },
    groups: [
      { hands: ['AA', 'KK', 'QQ', 'AKs', 'AKo'], freq: { '4b': 1.0 } },
      { hands: ['A5s', 'A4s', 'KQo'], freq: { '4b': 0.65, f: 0.35 } },
      { hands: ['AQo', 'KJs', 'QJs'], freq: { '4b': 0.35, c: 0.65 } },
      { hands: ['JJ', 'TT', '99', '88', 'AQs', 'AJs', 'ATs', 'KQs', 'JTs', 'T9s'], freq: { c: 1.0 } },
      { hands: ['77', '66', '98s', '87s', 'AJo'], freq: { c: 0.5, f: 0.5 } },
    ],
  },
  {
    id: 'mtt_8max_20bb_bba_btn_rfi',
    format: 'mtt_classic',
    formatKind: 'mtt',
    stackBB: 20,
    anteBB: 1.0,
    icmMode: 'chipEV',
    position: 'BTN',
    scenario: 'MTT 8-Max 20bb (BBA 1bb) — BTN RFI Mix Min-Raise / Open-Shove',
    line: ['raise', 'allin', 'fold'],
    provenance: {
      origin: 'heuristic',
      note: 'Heuristique MTT 20bb avec BBA 1bb (386 combos Min-Raise / 84 combos Shove)',
      confidence: 'medium',
    },
    summary: { mrPct: 29.11, shvPct: 6.33, totalPlayPct: 35.44, combosMr: 386.0, combosShv: 84.0 },
    groups: [
      {
        hands: [
          'AA', 'KK', 'QQ', 'JJ', 'TT',
          'AKs', 'AQs', 'AJs', 'ATs',
          'KQs', 'KJs', 'KTs', 'K9s',
          'QJs', 'QTs', 'Q9s',
          'JTs', 'J9s', 'J8s',
          'T9s', 'T8s', '98s', '97s', '87s', '76s', '65s',
          'AKo', 'AQo', 'AJo', 'KQo', 'KJo', 'QJo',
        ],
        freq: { mr: 1.0 },
      },
      { hands: ['99', '88', '77', '66', 'A9s', 'A8s', 'A7s', 'A6s', 'ATo', 'KTo', 'QTo', 'JTo'], freq: { mr: 0.65, shv: 0.35 } },
      { hands: ['55', '44', '33', '22', 'A5s', 'A4s', 'A3s', 'A2s', 'A9o', 'A8o', 'A7o'], freq: { shv: 0.7, mr: 0.3 } },
      {
        hands: [
          'K8s', 'K7s', 'K6s', 'K5s', 'Q8s', 'Q7s', 'Q6s', 'J7s', 'T7s', '86s', '75s', '64s', '54s',
          'A6o', 'A5o', 'A4o', 'A3o', 'A2o', 'K9o', 'Q9o', 'J9o', 'T9o',
        ],
        freq: { mr: 0.75, f: 0.25 },
      },
    ],
  },
  {
    id: 'mtt_8max_15bb_bba_btn_nash_push',
    format: 'mtt_classic',
    formatKind: 'mtt',
    stackBB: 15,
    anteBB: 1.0,
    icmMode: 'chipEV',
    position: 'BTN',
    scenario: 'MTT 8-Max 15bb (BBA 1bb) — BTN Push/Fold (564 combos)',
    line: ['allin', 'fold'],
    provenance: {
      origin: 'heuristic',
      note: 'Range push/fold heuristique vérifiée à 564 combos (42,53%)',
      confidence: 'medium',
    },
    summary: { shvPct: 42.53, combosShv: 564.0 },
    groups: [
      {
        hands: [
          'AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55', '44', '33', '22',
          'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s',
          'AKo', 'AQo', 'AJo', 'ATo', 'A9o', 'A8o', 'A7o', 'A6o', 'A5o', 'A4o', 'A3o', 'A2o',
          'KQs', 'KJs', 'KTs', 'K9s', 'K8s', 'K7s', 'K6s', 'K5s', 'K4s', 'K3s', 'K2s',
          'KQo', 'KJo', 'KTo', 'K9o', 'K8o',
          'QJs', 'QTs', 'Q9s', 'Q8s', 'Q7s', 'Q6s', 'Q5s', 'QJo', 'QTo', 'Q9o',
          'JTs', 'J9s', 'J8s', 'J7s', 'JTo', 'J9o',
          'T9s', 'T8s', 'T7s', 'T9o',
          '98s', '97s', '87s', '86s', '76s', '75s', '65s', '54s',
        ],
        freq: { shv: 1.0 },
      },
      { hands: ['K7o', 'Q8o', 'J8o', 'T8o', '96s', '85s', '64s'], freq: { shv: 0.5, f: 0.5 } },
    ],
  },
  {
    id: 'expresso_3max_25bb_btn_rfi',
    format: 'expresso_3max',
    formatKind: 'expresso',
    stackBB: 25,
    anteBB: 0,
    icmMode: 'wta',
    position: 'BTN',
    scenario: 'Expresso 3-Max 25bb — BTN Open Min-Raise 2x (36,05%)',
    line: ['raise', 'fold'],
    provenance: {
      origin: 'heuristic',
      note: 'Heuristique Expresso 3-Max WTA 25bb (478 combos)',
      confidence: 'medium',
    },
    summary: { mrPct: 36.05, combosMr: 478.0 },
    groups: [
      {
        hands: [
          'AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55', '44', '33', '22',
          'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s',
          'KQs', 'KJs', 'KTs', 'K9s', 'K8s', 'K7s', 'K6s', 'K5s', 'K4s',
          'QJs', 'QTs', 'Q9s', 'Q8s', 'Q7s', 'Q6s',
          'JTs', 'J9s', 'J8s', 'J7s',
          'T9s', 'T8s', 'T7s', '98s', '97s', '87s', '86s', '76s', '75s', '65s', '54s',
          'AKo', 'AQo', 'AJo', 'ATo', 'A9o', 'A8o', 'A7o',
          'KQo', 'KJo', 'KTo', 'K9o', 'QJo', 'QTo', 'JTo',
        ],
        freq: { mr: 1.0 },
      },
      { hands: ['A6o', 'A5o', 'A4o', 'A3o', 'A2o', 'K8o', 'Q9o', 'J9o', 'T9o', 'K3s', 'K2s', 'Q5s', '96s', '64s'], freq: { mr: 0.5, f: 0.5 } },
    ],
  },
  {
    id: 'expresso_3max_25bb_sb_vs_bb',
    format: 'expresso_3max',
    formatKind: 'expresso',
    stackBB: 25,
    anteBB: 0,
    icmMode: 'wta',
    position: 'SB',
    scenario: 'Expresso 3-Max 25bb — SB vs BB (Mix Raise 2.5–3x / Limp-Trap / Limp-Stab)',
    line: ['raise', 'limp', 'fold'],
    provenance: {
      origin: 'computed',
      note: 'Bataille de blindes Expresso 25bb (208,7 combos Raise / 529,3 combos Limp)',
      confidence: 'medium',
    },
    summary: { mrPct: 15.74, limpPct: 39.92, totalVpipPct: 55.66, combosMr: 208.7, combosLimp: 529.3 },
    groups: [
      { hands: ['AA', 'KK'], freq: { mr: 0.65, limp: 0.35 } },
      { hands: ['QQ', 'JJ', 'TT', '99', 'AKs', 'AQs', 'AJs', 'ATs', 'AKo', 'AQo', 'AJo', 'KQs', 'KJs', 'KTs', 'KQo', 'QJs'], freq: { mr: 0.85, limp: 0.15 } },
      { hands: ['A5s', 'A4s', 'A3s', 'A2s', 'K6s', 'K5s', 'K4s', 'Q5s', 'Q4s', 'J6s', 'J5s', 'T6s', '96s', '85s', '74s', '64s'], freq: { mr: 0.45, limp: 0.55 } },
      {
        hands: [
          '88', '77', '66', '55', '44', '33', '22',
          'A9s', 'A8s', 'A7s', 'A6s',
          'K9s', 'K8s', 'K7s', 'K3s', 'K2s',
          'QTs', 'Q9s', 'Q8s', 'Q7s', 'Q6s', 'Q3s', 'Q2s',
          'JTs', 'J9s', 'J8s', 'J7s',
          'T9s', 'T8s', 'T7s', '98s', '97s', '87s', '86s', '76s', '75s', '65s', '54s', '53s', '43s',
          'ATo', 'A9o', 'A8o', 'A7o', 'A6o', 'A5o', 'A4o', 'A3o', 'A2o',
          'KJo', 'KTo', 'K9o', 'K8o', 'K7o', 'K6o', 'K5o',
          'QJo', 'QTo', 'Q9o', 'Q8o', 'Q7o',
          'JTo', 'J9o', 'J8o', 'J7o', 'T9o', 'T8o', 'T7o', '98o', '97o', '87o', '76o',
        ],
        freq: { limp: 0.85, mr: 0.15 },
      },
    ],
  },
  {
    id: 'expresso_3max_25bb_bb_vs_btn_2x',
    format: 'expresso_3max',
    formatKind: 'expresso',
    stackBB: 25,
    anteBB: 0,
    icmMode: 'wta',
    position: 'BB',
    scenario: 'Expresso 3-Max 25bb — Défense BB vs BTN Min-Raise 2x (61,38%)',
    line: ['3bet', 'allin', 'call', 'fold'],
    provenance: {
      origin: 'computed',
      note: 'Défense large BB vs Min-Raise 2x en Expresso 25bb (814 combos défendus)',
      confidence: 'medium',
    },
    summary: { '3bPct': 5.81, shvPct: 2.42, callPct: 53.15, defendTotalPct: 61.38, combos3b: 77.1, combosShv: 32.1, combosCall: 704.8 },
    groups: [
      { hands: ['AA', 'KK', 'QQ', 'AKs', 'AKo', 'AQs'], freq: { '3b': 0.85, shv: 0.15 } },
      { hands: ['JJ', 'TT', '99', 'AJs', 'ATs', 'AQo', 'KQs'], freq: { '3b': 0.5, c: 0.5 } },
      { hands: ['88', '77', '66', '55', '44', 'A9s', 'A8s', 'A7s', 'AJo', 'ATo'], freq: { shv: 0.4, c: 0.6 } },
      { hands: ['A5s', 'A4s', 'A3s', 'A2s', 'K7s', 'K6s', 'K5s', 'K4s', 'Q7s', 'Q6s', 'Q5s', 'J7s', 'T7s', '86s', '75s', '65s', '54s'], freq: { '3b': 0.35, c: 0.65 } },
      {
        hands: [
          '33', '22', 'A6s',
          'KJs', 'KTs', 'K9s', 'K8s', 'K3s', 'K2s',
          'QJs', 'QTs', 'Q9s', 'Q8s', 'Q4s', 'Q3s', 'Q2s',
          'JTs', 'J9s', 'J8s', 'J6s', 'J5s', 'J4s', 'J3s', 'J2s',
          'T9s', 'T8s', 'T6s', 'T5s', 'T4s', 'T3s', 'T2s',
          '98s', '97s', '96s', '95s', '87s', '85s', '84s', '76s', '74s', '64s', '63s', '53s', '52s', '43s', '42s', '32s',
          'A9o', 'A8o', 'A7o', 'A6o', 'A5o', 'A4o', 'A3o', 'A2o',
          'KQo', 'KJo', 'KTo', 'K9o', 'K8o', 'K7o', 'K6o', 'K5o',
          'QJo', 'QTo', 'Q9o', 'Q8o', 'Q7o',
          'JTo', 'J9o', 'J8o', 'J7o', 'T9o', 'T8o', 'T7o', '98o', '97o', '87o', '86o', '76o',
        ],
        freq: { c: 1.0 },
      },
    ],
  },
];
