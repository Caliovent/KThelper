import type { Provenance } from '../domain/types.ts';
import { RANKS, comboCount, blockerImpact } from './chunk.ts';
import { MATRIX_HANDS, hamiltonRoundPercent } from './evolutionaryFunnel.ts';

export type DefenseAction3Bet = 'fourbet_value' | 'fourbet_bluff' | 'call' | 'fold';
export type Villain3BetProfile = 'nit' | 'reg' | 'aggro';
export type SpotPositionKey = 'UTG' | 'MP' | 'CO' | 'BTN' | 'SB';

export interface Range3BetSpot {
  id: string;
  label: string;
  heroPos: SpotPositionKey;
  villainPos: string;
  isIP: boolean;
  openSizeBb: number;
  threeBetSizeBb: number;
  fourBetSizeBb: number;
  effectiveStackBb: number;
  villainProfile: Villain3BetProfile;
  openHands: Record<string, true>;
  defenseMap: Record<string, DefenseAction3Bet>;
  notes: string;
  provenance: Provenance;
  isCustom?: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export interface MdfVs3BetResult {
  potBeforeVillainBb: number;
  villainRiskBb: number;
  costToCallBb: number;
  potOddsPct: number;
  mdfPct: number;
  alphaPct: number;
}

export interface Range3BetStats {
  totalCombos: number;
  openCombos: number;
  openPct: number;
  fourbetValueCombos: number;
  fourbetBluffCombos: number;
  fourBetTotalCombos: number;
  callCombos: number;
  foldCombos: number;
  defendCombos: number;
  fourbetValuePct: number;
  fourbetBluffPct: number;
  callPct: number;
  foldPct: number;
  defendPct: number;
  foldTo3BetPct: number;
  fourBetPctOfOpen: number;
  fourBetValueToBluffRatio: number;
  bluffShareOfFourBetPct: number;
  mdf: MdfVs3BetResult;
  mdfDeltaPct: number;
  statusLabel: 'equilibre' | 'overfold' | 'overdefend';
}

export interface DefenseDrillQuestion {
  id: string;
  hand: string;
  expectedAction: DefenseAction3Bet;
  combos: number;
  blockers: ReturnType<typeof blockerImpact>;
  explanation: string;
}

const VALID_HAND_SET = new Set<string>(MATRIX_HANDS.map((m) => m.hand));

export const DEFENSE_ACTION_META: Record<
  DefenseAction3Bet,
  { label: string; shortLabel: string; badgeClass: string; cellClass: string }
> = {
  fourbet_value: {
    label: '4-Bet Value',
    shortLabel: '4B Val',
    badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/50',
    cellClass: 'bg-rose-600/85 text-white border-rose-400',
  },
  fourbet_bluff: {
    label: '4-Bet Bluff / Bloqueur',
    shortLabel: '4B Bluff',
    badgeClass: 'bg-violet-500/20 text-violet-300 border-violet-500/50',
    cellClass: 'bg-violet-600/85 text-white border-violet-400',
  },
  call: {
    label: 'Call 3-Bet',
    shortLabel: 'Call',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50',
    cellClass: 'bg-emerald-600/85 text-white border-emerald-400',
  },
  fold: {
    label: 'Fold vs 3-Bet',
    shortLabel: 'Fold',
    badgeClass: 'bg-slate-700/60 text-slate-300 border-slate-600',
    cellClass: 'bg-slate-800/85 text-slate-300 border-slate-600',
  },
};

export const VILLAIN_PROFILE_META: Record<
  Villain3BetProfile,
  { label: string; threeBetFreq: string; summary: string }
> = {
  nit: {
    label: 'Nit (3-Bet 3-4 %)',
    threeBetFreq: '3–4 %',
    summary: 'Zéro 4-bet bluff : on resserre à AA/KK en value, on call les cotes implicites et on fold les bloqueurs.',
  },
  reg: {
    label: 'Reg Standard (3-Bet 7-9 %)',
    threeBetFreq: '7–9 %',
    summary: 'Défense équilibrée proche de la MDF : 4-Bet Value (QQ+, AK), 4-Bet Bluff (A5s/A4s/KQo), Call jouable.',
  },
  aggro: {
    label: 'LAG / Aggro (3-Bet 11-15 %)',
    threeBetFreq: '11–15 %',
    summary: 'On élargit la value (JJ/AQs), on ajoute des 4-Bet bluffs à bloqueurs et on call plus large IP.',
  },
};

function canonicalizeSingleHand(raw: string): string | null {
  const token = raw.trim();
  if (token.length < 2 || token.length > 3) return null;
  const r1 = token[0].toUpperCase();
  const r2 = token[1].toUpperCase();
  const i1 = RANKS.indexOf(r1);
  const i2 = RANKS.indexOf(r2);
  if (i1 === -1 || i2 === -1) return null;

  const hi = i1 <= i2 ? r1 : r2;
  const lo = i1 <= i2 ? r2 : r1;
  if (hi === lo) {
    return `${hi}${lo}`;
  }
  const suffix = token[2]?.toLowerCase();
  if (suffix !== 's' && suffix !== 'o') return null;
  const hand = `${hi}${lo}${suffix}`;
  return VALID_HAND_SET.has(hand) ? hand : null;
}

function expandToken(token: string): string[] {
  const clean = token.trim();
  if (!clean) return [];

  // Pair or non-pair with trailing + (e.g. 77+, ATs+, KTo+, AQ+)
  if (clean.endsWith('+')) {
    const base = clean.slice(0, -1);
    if (base.length === 2) {
      const r1 = base[0].toUpperCase();
      const r2 = base[1].toUpperCase();
      const i1 = RANKS.indexOf(r1);
      const i2 = RANKS.indexOf(r2);
      if (i1 === -1 || i2 === -1) return [];
      if (i1 === i2) {
        const res: string[] = [];
        for (let i = 0; i <= i1; i++) res.push(`${RANKS[i]}${RANKS[i]}`);
        return res;
      }
      const hiIdx = Math.min(i1, i2);
      const loIdx = Math.max(i1, i2);
      const res: string[] = [];
      for (let j = hiIdx + 1; j <= loIdx; j++) {
        res.push(`${RANKS[hiIdx]}${RANKS[j]}s`, `${RANKS[hiIdx]}${RANKS[j]}o`);
      }
      return res;
    }
    if (base.length === 3) {
      const r1 = base[0].toUpperCase();
      const r2 = base[1].toUpperCase();
      const s = base[2].toLowerCase();
      if (s !== 's' && s !== 'o') return [];
      const i1 = RANKS.indexOf(r1);
      const i2 = RANKS.indexOf(r2);
      if (i1 === -1 || i2 === -1 || i1 === i2) return [];
      const hiIdx = Math.min(i1, i2);
      const loIdx = Math.max(i1, i2);
      const res: string[] = [];
      for (let j = hiIdx + 1; j <= loIdx; j++) {
        res.push(`${RANKS[hiIdx]}${RANKS[j]}${s}`);
      }
      return res;
    }
    return [];
  }

  // Range with dash (e.g. TT-77, A5s-A2s, KQo-KTo, T9s-76s)
  if (clean.includes('-')) {
    const parts = clean.split('-');
    if (parts.length !== 2) return [];
    const [leftRaw, rightRaw] = parts;
    // Handle unspecified suitedness on dash like AQ-AT -> expand s and o
    if (leftRaw.length === 2 && rightRaw.length === 2 && leftRaw[0].toUpperCase() !== leftRaw[1].toUpperCase()) {
      return [...expandToken(`${leftRaw}s-${rightRaw}s`), ...expandToken(`${leftRaw}o-${rightRaw}o`)];
    }
    const left = canonicalizeSingleHand(leftRaw);
    const right = canonicalizeSingleHand(rightRaw);
    if (!left || !right) return [];

    // Pocket pairs range
    if (left.length === 2 && right.length === 2) {
      const a = RANKS.indexOf(left[0]);
      const b = RANKS.indexOf(right[0]);
      const start = Math.min(a, b);
      const end = Math.max(a, b);
      const res: string[] = [];
      for (let i = start; i <= end; i++) res.push(`${RANKS[i]}${RANKS[i]}`);
      return res;
    }

    if (left.length === 3 && right.length === 3 && left[2] === right[2]) {
      const suit = left[2];
      const l1 = RANKS.indexOf(left[0]);
      const l2 = RANKS.indexOf(left[1]);
      const r1 = RANKS.indexOf(right[0]);
      const r2 = RANKS.indexOf(right[1]);

      // Same high card (e.g. A5s-A2s)
      if (l1 === r1) {
        const start = Math.min(l2, r2);
        const end = Math.max(l2, r2);
        const res: string[] = [];
        for (let j = start; j <= end; j++) {
          if (j > l1) res.push(`${RANKS[l1]}${RANKS[j]}${suit}`);
        }
        return res;
      }

      // Connector/gapper slide (e.g. T9s-65s or J9s-86s)
      if (l2 - l1 === r2 - r1) {
        const gap = l2 - l1;
        const start = Math.min(l1, r1);
        const end = Math.max(l1, r1);
        const res: string[] = [];
        for (let i = start; i <= end; i++) {
          if (i + gap < RANKS.length) {
            res.push(`${RANKS[i]}${RANKS[i + gap]}${suit}`);
          }
        }
        return res;
      }
    }
    return [];
  }

  // Unspecified non-pair token like AK or KQ -> AKs, AKo
  if (clean.length === 2) {
    const r1 = clean[0].toUpperCase();
    const r2 = clean[1].toUpperCase();
    const i1 = RANKS.indexOf(r1);
    const i2 = RANKS.indexOf(r2);
    if (i1 !== -1 && i2 !== -1 && i1 !== i2) {
      const hi = i1 < i2 ? r1 : r2;
      const lo = i1 < i2 ? r2 : r1;
      return [`${hi}${lo}s`, `${hi}${lo}o`];
    }
  }

  const single = canonicalizeSingleHand(clean);
  return single ? [single] : [];
}

/**
 * Parse Equilab/Flopzilla notation (e.g. "22+, ATs+, KJs+, AJo+, KQo, A5s-A2s")
 * into canonical matrix hand names ordered by MATRIX_HANDS.
 */
export function parseNotationIntoHands(input: string): string[] {
  const found = new Set<string>();
  const tokens = input
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  for (const token of tokens) {
    for (const hand of expandToken(token)) {
      if (VALID_HAND_SET.has(hand)) {
        found.add(hand);
      }
    }
  }

  return MATRIX_HANDS.filter((m) => found.has(m.hand)).map((m) => m.hand);
}

export function handsArrayToMap(hands: readonly string[]): Record<string, true> {
  const out: Record<string, true> = {};
  for (const h of hands) {
    if (VALID_HAND_SET.has(h)) {
      out[h] = true;
    }
  }
  return out;
}

/**
 * Condense a set/iterable of canonical hands back into clean Equilab notation.
 */
export function exportHandsToNotation(hands: Iterable<string>): string {
  const set = new Set<string>();
  for (const h of hands) {
    if (VALID_HAND_SET.has(h)) set.add(h);
  }
  if (set.size === 0) return '';

  const tokens: string[] = [];

  // 1. Pairs (indices 0..12 along RANKS)
  const pairIndices: number[] = [];
  for (let i = 0; i < RANKS.length; i++) {
    if (set.has(`${RANKS[i]}${RANKS[i]}`)) pairIndices.push(i);
  }
  let idx = 0;
  while (idx < pairIndices.length) {
    const start = pairIndices[idx];
    let end = start;
    while (idx + 1 < pairIndices.length && pairIndices[idx + 1] === end + 1) {
      idx++;
      end = pairIndices[idx];
    }
    if (start === 0 && end > start) {
      tokens.push(`${RANKS[end]}${RANKS[end]}+`);
    } else if (end > start) {
      tokens.push(`${RANKS[start]}${RANKS[start]}-${RANKS[end]}${RANKS[end]}`);
    } else {
      tokens.push(`${RANKS[start]}${RANKS[start]}`);
    }
    idx++;
  }

  // 2. Suited, then Offsuit grouped by high rank
  for (const suit of ['s', 'o'] as const) {
    for (let hi = 0; hi < RANKS.length - 1; hi++) {
      const kickers: number[] = [];
      for (let lo = hi + 1; lo < RANKS.length; lo++) {
        if (set.has(`${RANKS[hi]}${RANKS[lo]}${suit}`)) kickers.push(lo);
      }
      let k = 0;
      while (k < kickers.length) {
        const start = kickers[k];
        let end = start;
        while (k + 1 < kickers.length && kickers[k + 1] === end + 1) {
          k++;
          end = kickers[k];
        }
        if (start === hi + 1 && end > start) {
          tokens.push(`${RANKS[hi]}${RANKS[end]}${suit}+`);
        } else if (end > start) {
          tokens.push(`${RANKS[hi]}${RANKS[start]}${suit}-${RANKS[hi]}${RANKS[end]}${suit}`);
        } else {
          tokens.push(`${RANKS[hi]}${RANKS[start]}${suit}`);
        }
        k++;
      }
    }
  }

  return tokens.join(', ');
}

export function computeMdfVs3Bet(
  openSizeBb: number,
  threeBetSizeBb: number,
  deadBlindsBb = 1.5,
  villainPos = 'BTN',
): MdfVs3BetResult {
  const safeOpen = Math.max(2, openSizeBb);
  const safeThreeBet = Math.max(safeOpen + 0.5, threeBetSizeBb);
  const villainPostedBb = villainPos === 'BB' ? 1 : villainPos === 'SB' ? 0.5 : 0;
  const potBeforeVillainBb = Math.round((safeOpen + deadBlindsBb) * 100) / 100;
  const villainRiskBb = Math.max(0.5, Math.round((safeThreeBet - villainPostedBb) * 100) / 100);
  const totalAfterThreeBet = potBeforeVillainBb + villainRiskBb;

  const mdfPct = Math.round((potBeforeVillainBb / totalAfterThreeBet) * 1000) / 10;
  const alphaPct = Math.round((100 - mdfPct) * 10) / 10;
  const costToCallBb = Math.max(0, Math.round((safeThreeBet - safeOpen) * 100) / 100);
  const potAfterCallBb = totalAfterThreeBet + costToCallBb;
  const potOddsPct = potAfterCallBb > 0 ? Math.round((costToCallBb / potAfterCallBb) * 1000) / 10 : 0;

  return {
    potBeforeVillainBb,
    villainRiskBb,
    costToCallBb,
    potOddsPct,
    mdfPct,
    alphaPct,
  };
}

/**
 * Compute defense statistics strictly over openHands (never over all 1,326 combos).
 */
export function computeRange3BetStats(spot: Range3BetSpot): Range3BetStats {
  const totalCombos = 1326;
  let openCombos = 0;
  let fourbetValueCombos = 0;
  let fourbetBluffCombos = 0;
  let callCombos = 0;
  let foldCombos = 0;

  for (const m of MATRIX_HANDS) {
    if (!spot.openHands[m.hand]) continue;
    const c = comboCount(m.hand);
    openCombos += c;
    const action = spot.defenseMap[m.hand] ?? 'fold';
    if (action === 'fourbet_value') fourbetValueCombos += c;
    else if (action === 'fourbet_bluff') fourbetBluffCombos += c;
    else if (action === 'call') callCombos += c;
    else foldCombos += c;
  }

  const openPct = Math.round((openCombos / totalCombos) * 1000) / 10;
  const defendCombos = fourbetValueCombos + fourbetBluffCombos + callCombos;
  const fourBetTotalCombos = fourbetValueCombos + fourbetBluffCombos;

  const [fourbetValuePct, fourbetBluffPct, callPct, foldPct] =
    openCombos > 0
      ? hamiltonRoundPercent([
          (fourbetValueCombos / openCombos) * 100,
          (fourbetBluffCombos / openCombos) * 100,
          (callCombos / openCombos) * 100,
          (foldCombos / openCombos) * 100,
        ])
      : [0, 0, 0, 0];

  const defendPct = openCombos > 0 ? Math.round((defendCombos / openCombos) * 1000) / 10 : 0;
  const foldTo3BetPct = openCombos > 0 ? Math.round((foldCombos / openCombos) * 1000) / 10 : 0;
  const fourBetPctOfOpen = openCombos > 0 ? Math.round((fourBetTotalCombos / openCombos) * 1000) / 10 : 0;

  const fourBetValueToBluffRatio =
    fourbetBluffCombos > 0
      ? Math.round((fourbetValueCombos / fourbetBluffCombos) * 100) / 100
      : fourbetValueCombos > 0
        ? Infinity
        : 0;
  const bluffShareOfFourBetPct =
    fourBetTotalCombos > 0 ? Math.round((fourbetBluffCombos / fourBetTotalCombos) * 1000) / 10 : 0;

  const mdf = computeMdfVs3Bet(spot.openSizeBb, spot.threeBetSizeBb, 1.5, spot.villainPos);
  const mdfDeltaPct = Math.round((defendPct - mdf.mdfPct) * 10) / 10;
  const statusLabel: Range3BetStats['statusLabel'] =
    mdfDeltaPct < -6 ? 'overfold' : mdfDeltaPct > 6 ? 'overdefend' : 'equilibre';

  return {
    totalCombos,
    openCombos,
    openPct,
    fourbetValueCombos,
    fourbetBluffCombos,
    fourBetTotalCombos,
    callCombos,
    foldCombos,
    defendCombos,
    fourbetValuePct,
    fourbetBluffPct,
    callPct,
    foldPct,
    defendPct,
    foldTo3BetPct,
    fourBetPctOfOpen,
    fourBetValueToBluffRatio,
    bluffShareOfFourBetPct,
    mdf,
    mdfDeltaPct,
    statusLabel,
  };
}

/**
 * Adapt only hands within spot.openHands to the chosen Villain 3-Bet profile
 * (Kill Tilt Bases Cash Game #3).
 */
export function applyVillainProfileAdaptation(
  spot: Range3BetSpot,
  profile: Villain3BetProfile,
): Range3BetSpot {
  const nextDefense: Record<string, DefenseAction3Bet> = {};

  const nitValue = new Set(['AA', 'KK']);
  const nitCall = new Set(['QQ', 'JJ', 'TT', '99', '88', '77', 'AKs', 'AKo', 'AQs']);
  const nitCallIpExtra = new Set(['66', '55', 'AJs', 'KQs', 'QJs', 'JTs']);

  const regValueOop = new Set(['AA', 'KK', 'QQ', 'AKs', 'AKo']);
  const regValueIp = new Set(['AA', 'KK', 'QQ', 'JJ', 'AKs', 'AKo']);
  const regBluff = new Set(['A5s', 'A4s', 'KQo', 'AJo']);
  const regCallBase = new Set([
    'JJ',
    'TT',
    '99',
    '88',
    '77',
    'AQs',
    'AJs',
    'ATs',
    'KQs',
    'KJs',
    'QJs',
    'JTs',
    'T9s',
    'AQo',
  ]);
  const regCallIpExtra = new Set(['66', '55', 'A9s', 'KTs', 'QTs', '98s', '87s']);

  const aggroValue = new Set(['AA', 'KK', 'QQ', 'JJ', 'AKs', 'AKo', 'AQs']);
  const aggroBluff = new Set(['A5s', 'A4s', 'A3s', 'A2s', 'KQo', 'KJo', 'AJo', 'ATo', 'KTs']);
  const aggroCall = new Set([
    'TT',
    '99',
    '88',
    '77',
    '66',
    '55',
    '44',
    'AJs',
    'ATs',
    'A9s',
    'A8s',
    'KQs',
    'KJs',
    'QJs',
    'QTs',
    'JTs',
    'J9s',
    'T9s',
    '98s',
    '87s',
    '76s',
    'AQo',
  ]);

  for (const m of MATRIX_HANDS) {
    if (!spot.openHands[m.hand]) continue;
    const h = m.hand;

    if (profile === 'nit') {
      if (nitValue.has(h)) nextDefense[h] = 'fourbet_value';
      else if (nitCall.has(h) || (spot.isIP && nitCallIpExtra.has(h))) nextDefense[h] = 'call';
      else nextDefense[h] = 'fold';
    } else if (profile === 'reg') {
      const valueSet = spot.isIP ? regValueIp : regValueOop;
      if (valueSet.has(h)) nextDefense[h] = 'fourbet_value';
      else if (regBluff.has(h)) nextDefense[h] = 'fourbet_bluff';
      else if (regCallBase.has(h) || (spot.isIP && regCallIpExtra.has(h))) nextDefense[h] = 'call';
      else nextDefense[h] = 'fold';
    } else {
      if (aggroValue.has(h)) nextDefense[h] = 'fourbet_value';
      else if (aggroBluff.has(h)) nextDefense[h] = 'fourbet_bluff';
      else if (aggroCall.has(h)) nextDefense[h] = 'call';
      else nextDefense[h] = 'fold';
    }
  }

  return {
    ...spot,
    villainProfile: profile,
    defenseMap: nextDefense,
    updatedAt: Date.now(),
  };
}

function createRng(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function shuffleWithRng<T>(arr: T[], rng: () => number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildDrillExplanation(
  hand: string,
  action: DefenseAction3Bet,
  spot: Range3BetSpot,
  blockers: ReturnType<typeof blockerImpact>,
): string {
  const posText = `${spot.heroPos} vs 3-Bet ${spot.villainPos} (${spot.isIP ? 'IP' : 'OOP'})`;
  const profileLabel = VILLAIN_PROFILE_META[spot.villainProfile].label;

  if (action === 'fourbet_value') {
    return `${hand} est dans le haut de votre range d'Open (${posText}) : face à un profil ${profileLabel}, on 4-Bet Value pour construire un gros pot ou isoler les calls dominés.`;
  }
  if (action === 'fourbet_bluff') {
    return `${hand} possède d'excellents bloqueurs (AA: ${blockers.AA}, KK: ${blockers.KK}, AK: ${blockers.AK} combos restants) tout en étant trop faible pour call OOP/profitablement : candidat idéal de 4-Bet Bluff.`;
  }
  if (action === 'call') {
    return `${hand} retient très bien son équité postflop (${spot.isIP ? 'en position' : 'jouabilité connectée/paire'}) mais serait souvent dominée si on 4-Bet/call : le Call 3-Bet maximise son EV.`;
  }
  return `${hand} fait partie du bas de votre range d'Open (${posText}) : sans bloqueur premium ni bonne jouabilité face au 3-Bet (${spot.threeBetSizeBb} bb), le Fold discipliné évite de sur-défendre.`;
}

/**
 * Generate interactive defense drills drawing strictly from spot.openHands.
 */
export function buildDefenseDrillQuestions(
  spot: Range3BetSpot,
  count = 8,
  seed = 1,
): DefenseDrillQuestion[] {
  const openList = MATRIX_HANDS.filter((m) => spot.openHands[m.hand]).map((m) => m.hand);
  if (openList.length === 0) return [];

  const buckets: Record<DefenseAction3Bet, string[]> = {
    fourbet_value: [],
    fourbet_bluff: [],
    call: [],
    fold: [],
  };

  for (const h of openList) {
    const act = spot.defenseMap[h] ?? 'fold';
    buckets[act].push(h);
  }

  const rng = createRng(seed);
  const shuffledBuckets: Record<DefenseAction3Bet, string[]> = {
    fourbet_value: shuffleWithRng(buckets.fourbet_value, rng),
    fourbet_bluff: shuffleWithRng(buckets.fourbet_bluff, rng),
    call: shuffleWithRng(buckets.call, rng),
    fold: shuffleWithRng(buckets.fold, rng),
  };

  // Round-robin across non-empty buckets so drills cover all active compartments
  const order: DefenseAction3Bet[] = ['fourbet_value', 'fourbet_bluff', 'call', 'fold'];
  const picked: string[] = [];
  const used = new Set<string>();
  const targetCount = Math.min(count, openList.length);

  let round = 0;
  while (picked.length < targetCount) {
    let addedInRound = false;
    for (const act of order) {
      const candidate = shuffledBuckets[act][round];
      if (candidate && !used.has(candidate)) {
        used.add(candidate);
        picked.push(candidate);
        addedInRound = true;
        if (picked.length >= targetCount) break;
      }
    }
    if (!addedInRound) break;
    round++;
  }

  return picked.map((hand, idx) => {
    const expectedAction = spot.defenseMap[hand] ?? 'fold';
    const blockers = blockerImpact(hand);
    return {
      id: `${spot.id}_drill_${idx}_${hand}`,
      hand,
      expectedAction,
      combos: comboCount(hand),
      blockers,
      explanation: buildDrillExplanation(hand, expectedAction, spot, blockers),
    };
  });
}

function buildSpotFromNotations(params: {
  id: string;
  label: string;
  heroPos: SpotPositionKey;
  villainPos: string;
  isIP: boolean;
  openSizeBb: number;
  threeBetSizeBb: number;
  fourBetSizeBb: number;
  openNotation: string;
  fourBetValueNotation: string;
  fourBetBluffNotation: string;
  callNotation: string;
  notes: string;
}): Range3BetSpot {
  const openHands = handsArrayToMap(parseNotationIntoHands(params.openNotation));
  const defenseMap: Record<string, DefenseAction3Bet> = {};

  for (const h of Object.keys(openHands)) {
    defenseMap[h] = 'fold';
  }
  for (const h of parseNotationIntoHands(params.callNotation)) {
    if (openHands[h]) defenseMap[h] = 'call';
  }
  for (const h of parseNotationIntoHands(params.fourBetBluffNotation)) {
    if (openHands[h]) defenseMap[h] = 'fourbet_bluff';
  }
  for (const h of parseNotationIntoHands(params.fourBetValueNotation)) {
    if (openHands[h]) defenseMap[h] = 'fourbet_value';
  }

  return {
    id: params.id,
    label: params.label,
    heroPos: params.heroPos,
    villainPos: params.villainPos,
    isIP: params.isIP,
    openSizeBb: params.openSizeBb,
    threeBetSizeBb: params.threeBetSizeBb,
    fourBetSizeBb: params.fourBetSizeBb,
    effectiveStackBb: 100,
    villainProfile: 'reg',
    openHands,
    defenseMap,
    notes: params.notes,
    provenance: {
      origin: 'heuristic',
      tool: 'Kill Tilt Bases Cash Game #2 & #3',
      note: 'Ranges pédagogiques de référence (100bb 6-Max NLHE) : défense calculée strictement sur la range Open.',
      confidence: 'medium',
    },
  };
}

export const DEFAULT_3BET_SPOTS: readonly Range3BetSpot[] = [
  buildSpotFromNotations({
    id: 'preset_co_vs_btn_3bet',
    label: 'CO Open vs BTN 3-Bet (OOP)',
    heroPos: 'CO',
    villainPos: 'BTN',
    isIP: false,
    openSizeBb: 2.5,
    threeBetSizeBb: 8.5,
    fourBetSizeBb: 21,
    openNotation: '22+, A2s+, K9s+, Q9s+, J9s+, T8s+, 97s+, 87s, 76s, 65s, 54s, ATo+, KJo+, QJo',
    fourBetValueNotation: 'QQ+, AKs, AKo',
    fourBetBluffNotation: 'A5s, A4s, KQo',
    callNotation: 'JJ-77, AQs, AJs, KQs, QJs, JTs, T9s, AQo',
    notes:
      'Hors de position au Cutoff face au Bouton : privilégiez le 4-Bet ou Fold sur le bas de range et gardez les paires moyennes + broadways suités pour call.',
  }),
  buildSpotFromNotations({
    id: 'preset_btn_vs_bb_3bet',
    label: 'BTN Open vs BB 3-Bet (IP)',
    heroPos: 'BTN',
    villainPos: 'BB',
    isIP: true,
    openSizeBb: 2.5,
    threeBetSizeBb: 10,
    fourBetSizeBb: 22,
    openNotation:
      '22+, A2s+, K5s+, Q7s+, J7s+, T7s+, 97s+, 86s+, 75s+, 64s+, 54s, A7o+, K9o+, Q9o+, J9o+, T9o',
    fourBetValueNotation: 'JJ+, AKs, AKo',
    fourBetBluffNotation: 'A5s, A4s, KQo, AJo, KJo',
    callNotation:
      'TT-55, AQs-A8s, KQs-KTs, QJs-QTs, JTs-J9s, T9s, 98s, 87s, 76s, AQo, ATo, KQo',
    notes:
      'Au Bouton en position face à la BB : on défend plus largement en call grâce à l’avantage de position et on ajoute des bloqueurs Kx/Ax en 4-Bet Bluff.',
  }),
  buildSpotFromNotations({
    id: 'preset_utg_vs_btn_3bet',
    label: 'UTG/LJ Open vs BTN 3-Bet (OOP)',
    heroPos: 'UTG',
    villainPos: 'BTN',
    isIP: false,
    openSizeBb: 2.5,
    threeBetSizeBb: 8,
    fourBetSizeBb: 20,
    openNotation: '55+, AJs+, A5s-A4s, KQs, KJs, QJs, JTs, T9s, 98s, AQo+, KQo',
    fourBetValueNotation: 'QQ+, AKs, AKo',
    fourBetBluffNotation: 'A5s, A4s',
    callNotation: 'JJ-77, AQs, AJs, KQs, QJs, JTs',
    notes:
      'Range UTG déjà serrée (~16 %) : face à un 3-Bet IP du Bouton, votre proportion de défense est naturellement élevée sur cette range forte (JJ-77 et broadways suités en call).',
  }),
  buildSpotFromNotations({
    id: 'preset_sb_vs_bb_3bet',
    label: 'SB Open vs BB 3-Bet (OOP)',
    heroPos: 'SB',
    villainPos: 'BB',
    isIP: false,
    openSizeBb: 3,
    threeBetSizeBb: 9.5,
    fourBetSizeBb: 22,
    openNotation:
      '22+, A2s+, K6s+, Q8s+, J8s+, T8s+, 97s+, 86s+, 75s+, 65s, 54s, A8o+, KTo+, QTo+, JTo',
    fourBetValueNotation: 'JJ+, AKs, AKo, AQs',
    fourBetBluffNotation: 'A5s, A4s, A3s, KQo, AJo, KJo',
    callNotation: 'TT-66, AJs-A9s, KQs-KTs, QJs-QTs, JTs, T9s, 98s, AQo',
    notes:
      'Bataille de blindes (SB 3bb vs BB) : OOP mais ranges très larges. Mixez 4-Bet Value étendu (JJ+/AQs) et 4-Bet bluffs polarisés à bloqueurs.',
  }),
];
