import type { CorpusTemplate } from '../../domain/types';
import { comboCount, lines } from '../chunk';
import { FRESQUE_CONFIG } from './config';

export interface FresqueLineAnswer {
  /** Index 0..hands.length-1 de la dernière main incluse depuis le haut ; null = aucune main depuis le haut. */
  floorIndex: number | null;
  /** Index des îlots isolés cochés au-delà du plancher. */
  islands: number[];
}

export interface FresqueLineSpec {
  id: string;
  label: string;
  hands: readonly string[];
  reference: FresqueLineAnswer;
  note: string;
}

export interface FresqueDuelSet {
  id: string;
  title: string;
  position: string;
  ranked: false;
  provenanceNote: string;
  lines: readonly FresqueLineSpec[];
}

export interface FresqueLineScore {
  lineId: string;
  pd: number;
  weightedErrors: number;
  weightedTotal: number;
  misclassifiedHands: string[];
  timeout: boolean;
}

export interface FresqueDuelScore {
  lineScores: FresqueLineScore[];
  totalPd: number;
  perfectLines: number;
  totalMs: number;
}

const ALL_LINES = lines();
const LINE_BY_ID = new Map(ALL_LINES.map((l) => [l.id, l]));

function getLineHands(id: string): readonly string[] {
  const found = LINE_BY_ID.get(id);
  if (!found) throw new Error(`Ligne 13x13 inconnue: ${id}`);
  return found.hands;
}

/** Ensemble des mains incluses selon la définition plancher + îlots. */
export function includedHandIndices(lineLength: number, ans: FresqueLineAnswer): Set<number> {
  const set = new Set<number>();
  if (ans.floorIndex !== null && ans.floorIndex >= 0) {
    const cap = Math.min(lineLength - 1, ans.floorIndex);
    for (let i = 0; i <= cap; i++) set.add(i);
  }
  for (const idx of ans.islands) {
    if (idx >= 0 && idx < lineLength) set.add(idx);
  }
  return set;
}

/** Note UNE ligne de Fresque Duel (Bible p.17 & MP-19) : frontière (±1 case du seuil/îlot) comptée ×2, pondérée par combos (6/4/12). */
export function scoreFresqueLine(
  hands: readonly string[],
  answer: FresqueLineAnswer | null,
  ref: FresqueLineAnswer
): FresqueLineScore {
  const lineId = hands.join(',');
  if (answer === null) {
    let weightedTotal = 0;
    for (let i = 0; i < hands.length; i++) {
      const isFrontier =
        ref.floorIndex !== null ? Math.abs(i - ref.floorIndex) <= 1 : i === 0;
      weightedTotal += comboCount(hands[i]) * (isFrontier ? FRESQUE_CONFIG.frontierWeight : 1);
    }
    return {
      lineId,
      pd: 1000,
      weightedErrors: weightedTotal,
      weightedTotal,
      misclassifiedHands: [...hands],
      timeout: true,
    };
  }

  const refSet = includedHandIndices(hands.length, ref);
  const ansSet = includedHandIndices(hands.length, answer);

  const frontierIndices = new Set<number>();
  if (ref.floorIndex !== null) {
    frontierIndices.add(ref.floorIndex);
    if (ref.floorIndex + 1 < hands.length) frontierIndices.add(ref.floorIndex + 1);
  } else if (hands.length > 0) {
    frontierIndices.add(0);
  }
  for (const isl of ref.islands) {
    if (isl - 1 >= 0) frontierIndices.add(isl - 1);
    frontierIndices.add(isl);
    if (isl + 1 < hands.length) frontierIndices.add(isl + 1);
  }

  let weightedTotal = 0;
  let weightedErrors = 0;
  const misclassifiedHands: string[] = [];

  for (let i = 0; i < hands.length; i++) {
    const w = comboCount(hands[i]) * (frontierIndices.has(i) ? FRESQUE_CONFIG.frontierWeight : 1);
    weightedTotal += w;
    if (refSet.has(i) !== ansSet.has(i)) {
      weightedErrors += w;
      misclassifiedHands.push(hands[i]);
    }
  }

  const pd = weightedTotal > 0 ? Math.min(1000, Math.round((1000 * weightedErrors) / weightedTotal)) : 0;
  return {
    lineId,
    pd,
    weightedErrors,
    weightedTotal,
    misclassifiedHands,
    timeout: false,
  };
}

/** Fresque Duel : strictement impossible en mode classé (Bible p.16 & MP-19). */
export function fresqueRankedEligible(_template: CorpusTemplate): false {
  return false;
}

export function scoreFresqueDuel(
  set: FresqueDuelSet,
  answers: readonly { answer: FresqueLineAnswer | null; elapsedMs: number }[],
  ranked: boolean
): FresqueDuelScore {
  if (ranked) {
    throw new Error('Fresque Duel impossible en classé');
  }
  const lineScores: FresqueLineScore[] = set.lines.map((line, i) => {
    const a = answers[i] ?? { answer: null, elapsedMs: FRESQUE_CONFIG.lineLimitMs };
    const timedOut = a.answer === null || a.elapsedMs > FRESQUE_CONFIG.lineLimitMs;
    const sc = scoreFresqueLine(line.hands, timedOut ? null : a.answer, line.reference);
    return { ...sc, lineId: line.id, timeout: timedOut };
  });
  const totalPd = lineScores.reduce((acc, s) => acc + s.pd, 0);
  const perfectLines = lineScores.filter((s) => s.pd === 0).length;
  const totalMs = answers.reduce((acc, a) => acc + Math.min(FRESQUE_CONFIG.lineLimitMs, Math.max(0, a.elapsedMs)), 0);
  return { lineScores, totalPd, perfectLines, totalMs };
}

/** Calcule les indices de cases qui changent entre deux sets de Fresque (mode Contraste, Bible p.17). */
export function fresqueContrastMap(
  setA: FresqueDuelSet,
  setB: FresqueDuelSet
): Record<string, string[]> {
  const diff: Record<string, string[]> = {};
  setA.lines.forEach((lineA, idx) => {
    const lineB = setB.lines[idx];
    if (!lineB || lineA.id !== lineB.id) return;
    const sA = includedHandIndices(lineA.hands.length, lineA.reference);
    const sB = includedHandIndices(lineB.hands.length, lineB.reference);
    diff[lineA.id] = lineA.hands.filter((_, hIdx) => sA.has(hIdx) !== sB.has(hIdx));
  });
  return diff;
}

/** Deux jeux d'entraînement amical non classés (6 lignes chacun, basés sur heuristiques Kill Tilt NL2/100bb). */
export const FRESQUE_DRILL_SETS: readonly FresqueDuelSet[] = [
  {
    id: 'fresque_co_open_100bb',
    title: 'Open Raise CO 6-Max 100bb (Heuristique Kill Tilt)',
    position: 'CO',
    ranked: false,
    provenanceNote: 'Heuristique pédagogique non classée — hors classement L1',
    lines: [
      {
        id: 'pairs',
        label: 'Paires (AA → 22)',
        hands: getLineHands('pairs'),
        reference: { floorIndex: 12, islands: [] }, // toutes les paires 22+
        note: 'En 6-Max au CO, toutes les paires 22+ sont ouvertes pour set-miner avec position.',
      },
      {
        id: 'Axs',
        label: 'As assortis (AKs → A2s)',
        hands: getLineHands('Axs'),
        reference: { floorIndex: 11, islands: [] }, // tous les A2s+
        note: 'Tous les As assortis jouent très bien IP grâce aux tirages couleur max et bloqueurs.',
      },
      {
        id: 'Kxs',
        label: 'Rois assortis (KQs → K2s)',
        hands: getLineHands('Kxs'),
        reference: { floorIndex: 6, islands: [] }, // KQs..K6s
        note: 'Plancher standard autour de K6s+ (K5s/K4s en option selon les blindes).',
      },
      {
        id: 'Qxs',
        label: 'Dames assorties (QJs → Q2s)',
        hands: getLineHands('Qxs'),
        reference: { floorIndex: 3, islands: [] }, // QJs..Q8s
        note: 'Q8s+ reste jouable IP ; Q7s- devient souvent trop dominé contre BTN/BB.',
      },
      {
        id: 'Axo',
        label: 'As dépareillés (AKo → A2o)',
        hands: getLineHands('Axo'),
        reference: { floorIndex: 4, islands: [7] }, // AKo..ATo + îlot A5o (exemple îlot pédagogique)
        note: 'Plancher ATo+ (A9o frontière) + îlot A5o pour la jouabilité quinte/bloqueur.',
      },
      {
        id: 'Kxo',
        label: 'Rois dépareillés (KQo → K2o)',
        hands: getLineHands('Kxo'),
        reference: { floorIndex: 2, islands: [] }, // KQo..KTo
        note: 'KTo+ suffit ; K9o- perd trop d’EV hors-équité face aux 3-bets du BTN.',
      },
    ],
  },
  {
    id: 'fresque_btn_open_100bb',
    title: 'Open Raise BTN 6-Max 100bb (Contraste vs CO)',
    position: 'BTN',
    ranked: false,
    provenanceNote: 'Heuristique pédagogique non classée — hors classement L1',
    lines: [
      {
        id: 'pairs',
        label: 'Paires (AA → 22)',
        hands: getLineHands('pairs'),
        reference: { floorIndex: 12, islands: [] },
        note: 'Identique au CO : toutes les paires 22+.',
      },
      {
        id: 'Axs',
        label: 'As assortis (AKs → A2s)',
        hands: getLineHands('Axs'),
        reference: { floorIndex: 11, islands: [] },
        note: 'Tous les Axs sont des opens automatiques au Bouton.',
      },
      {
        id: 'Kxs',
        label: 'Rois assortis (KQs → K2s)',
        hands: getLineHands('Kxs'),
        reference: { floorIndex: 10, islands: [] }, // K2s+
        note: 'Au BTN, on descend jusqu’à K2s pour attaquer les blindes.',
      },
      {
        id: 'Qxs',
        label: 'Dames assorties (QJs → Q2s)',
        hands: getLineHands('Qxs'),
        reference: { floorIndex: 6, islands: [] }, // Q5s+
        note: 'On élargit de Q8s à Q5s au Bouton.',
      },
      {
        id: 'Axo',
        label: 'As dépareillés (AKo → A2o)',
        hands: getLineHands('Axo'),
        reference: { floorIndex: 7, islands: [] }, // A7o+ (donc plus d'îlot isolé)
        note: 'Au Bouton on ouvre directement A7o+ sans trou.',
      },
      {
        id: 'Kxo',
        label: 'Rois dépareillés (KQo → K2o)',
        hands: getLineHands('Kxo'),
        reference: { floorIndex: 4, islands: [] }, // K8o+
        note: 'K8o+ s’ajoute grâce à l’avantage de position absolu postflop.',
      },
    ],
  },
];
