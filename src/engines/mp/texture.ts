import type { CorpusTemplate } from '../../domain/types';
import { CLOCK_MS } from './config';
import { scoreSolution, type SpotScore } from './scoring';

export type AdvantageAxis = 'IP' | 'neutre' | 'OOP';

export interface TexturePhase1Answer {
  rangeAdv: AdvantageAxis;
  nutsAdv: AdvantageAxis;
}

export interface TexturePhase2Answer {
  freqPct: 0 | 25 | 50 | 75 | 100;
  sizingPct: 33 | 50 | 75 | 125;
  actionId: string;
}

export interface TextureSpotSpec {
  twinPairId: string;
  twinLabel: string;
  template: CorpusTemplate;
  expectedPhase1: TexturePhase1Answer;
  expectedPhase2: { freqPct: number; sizingPct: number };
  explanation: string;
}

export interface TextureScoreResult {
  actionScore: SpotScore;
  gaugesCorrect: number;
  rangeMatch: boolean;
  nutsMatch: boolean;
  freqDiffPct: number;
  sizingMatch: boolean;
}

/**
 * Règle MP-22 (Bible p.16, 18, 35) :
 * Sans solution EV vérifiée/sourcée (provenance solver_export | computed + confidence high),
 * Radar de Board est STRICTEMENT non éligible au classé.
 */
export function textureRankedEligible(template: CorpusTemplate): boolean {
  return (
    template.public.gameType === 'texture' &&
    template.solution.kind === 'ev' &&
    (template.provenance.origin === 'solver_export' || template.provenance.origin === 'computed') &&
    template.provenance.confidence === 'high'
  );
}

/**
 * Note un spot Radar de Board :
 * - Lève une erreur si `ranked === true` et que le template n'a pas de solution EV vérifiée.
 * - En mode classé, seule l'action liée à une EV compte dans les PD ; les jauges Phase 1 sont corrigées à part.
 */
export function scoreTextureSpot(
  spec: TextureSpotSpec,
  phase1: TexturePhase1Answer | null,
  phase2: TexturePhase2Answer | null,
  elapsedMs: number,
  ranked: boolean
): TextureScoreResult {
  if (ranked && !textureRankedEligible(spec.template)) {
    throw new Error('Radar de Board sans EV vérifiée non éligible au classé (MP-22).');
  }

  const actionScore = scoreSolution(
    spec.template.solution,
    phase2 ? phase2.actionId : null,
    elapsedMs,
    spec.template.public.limitMs,
    false,
    ranked
  ).score;

  const rangeMatch = phase1 ? phase1.rangeAdv === spec.expectedPhase1.rangeAdv : false;
  const nutsMatch = phase1 ? phase1.nutsAdv === spec.expectedPhase1.nutsAdv : false;
  const gaugesCorrect = (rangeMatch ? 1 : 0) + (nutsMatch ? 1 : 0);
  const freqDiffPct = phase2 ? Math.abs(phase2.freqPct - spec.expectedPhase2.freqPct) : 100;
  const sizingMatch = phase2 ? phase2.sizingPct === spec.expectedPhase2.sizingPct : false;

  return {
    actionScore,
    gaugesCorrect,
    rangeMatch,
    nutsMatch,
    freqDiffPct,
    sizingMatch,
  };
}

/**
 * 3 paires de Boards jumeaux contrastés (6 spots, heuristiques non classés — 0 EV inventée, Bible p.18).
 */
export const TEXTURE_TWIN_BOARDS: readonly TextureSpotSpec[] = [
  {
    twinPairId: 'pair_high_vs_low',
    twinLabel: 'Paire 1 — High Dry IP vs Low Connecté OOP (BTN vs BB SRP)',
    template: {
      id: 'tex_twin_1a_ak4r',
      skillId: 'post.texture.high_dry',
      family: 'texture_high_dry',
      bucket: 'frontier',
      ranked: false,
      league: 'cash',
      public: {
        templateId: 'tex_twin_1a_ak4r',
        skillId: 'post.texture.high_dry',
        family: 'texture_high_dry',
        gameType: 'texture',
        context: { variant: 'NLHE', format: 'cash', venue: 'online', tableSize: 6, effectiveStackBb: 100, anteTotalBb: 0 },
        limitMs: CLOCK_MS.texture,
        state: {
          kind: 'texture',
          board: ['As', 'Kd', '4c'],
          positions: ['BTN', 'BB'],
          potType: 'SRP BTN vs BB',
          options: [
            { id: 'cbet_small', label: 'C-Bet 33% (haute fréquence)' },
            { id: 'cbet_big', label: 'C-Bet 75% (polarisé)' },
            { id: 'check', label: 'Check back' },
          ],
        },
      },
      solution: { kind: 'weights', reference: { cbet_small: 0.75, cbet_big: 0.15, check: 0.1 } },
      provenance: { origin: 'heuristic', tool: 'Heuristique Kill Tilt Postflop', confidence: 'medium' },
      explanationId: 'exp.tex_twin_1a',
    },
    expectedPhase1: { rangeAdv: 'IP', nutsAdv: 'IP' },
    expectedPhase2: { freqPct: 75, sizingPct: 33 },
    explanation: 'Sur A-K-4 rainbow BTN vs BB, IP domine massivement en range et en nuts (AA, KK, AK). Petit sizing haute fréquence (33%).',
  },
  {
    twinPairId: 'pair_high_vs_low',
    twinLabel: 'Paire 1 — High Dry IP vs Low Connecté OOP (BTN vs BB SRP)',
    template: {
      id: 'tex_twin_1b_654tt',
      skillId: 'post.texture.low_connected',
      family: 'texture_low_connected',
      bucket: 'frontier',
      ranked: false,
      league: 'cash',
      public: {
        templateId: 'tex_twin_1b_654tt',
        skillId: 'post.texture.low_connected',
        family: 'texture_low_connected',
        gameType: 'texture',
        context: { variant: 'NLHE', format: 'cash', venue: 'online', tableSize: 6, effectiveStackBb: 100, anteTotalBb: 0 },
        limitMs: CLOCK_MS.texture,
        state: {
          kind: 'texture',
          board: ['6h', '5h', '4d'],
          positions: ['BTN', 'BB'],
          potType: 'SRP BTN vs BB',
          options: [
            { id: 'cbet_small', label: 'C-Bet 33% (haute fréquence)' },
            { id: 'cbet_big', label: 'C-Bet 75% (polarisé)' },
            { id: 'check', label: 'Check back' },
          ],
        },
      },
      solution: { kind: 'weights', reference: { check: 0.55, cbet_big: 0.35, cbet_small: 0.1 } },
      provenance: { origin: 'heuristic', tool: 'Heuristique Kill Tilt Postflop', confidence: 'medium' },
      explanationId: 'exp.tex_twin_1b',
    },
    expectedPhase1: { rangeAdv: 'OOP', nutsAdv: 'OOP' },
    expectedPhase2: { freqPct: 25, sizingPct: 75 },
    explanation: 'Sur 6-5-4 two-tone, BB possède bien plus de doubles paires, brelans et quintes floppées (87s, 73s). On check souvent IP ou polarise gros.',
  },
  {
    twinPairId: 'pair_monotone_vs_paired',
    twinLabel: 'Paire 2 — Monotone vs Board Pairé (CO vs BB SRP)',
    template: {
      id: 'tex_twin_2a_q83mono',
      skillId: 'post.texture.monotone',
      family: 'texture_monotone',
      bucket: 'transfer',
      ranked: false,
      league: 'cash',
      public: {
        templateId: 'tex_twin_2a_q83mono',
        skillId: 'post.texture.monotone',
        family: 'texture_monotone',
        gameType: 'texture',
        context: { variant: 'NLHE', format: 'cash', venue: 'online', tableSize: 6, effectiveStackBb: 100, anteTotalBb: 0 },
        limitMs: CLOCK_MS.texture,
        state: {
          kind: 'texture',
          board: ['Qs', '8s', '3s'],
          positions: ['CO', 'BB'],
          potType: 'SRP CO vs BB',
          options: [
            { id: 'cbet_small', label: 'C-Bet 33% sélectif' },
            { id: 'cbet_big', label: 'C-Bet 75%' },
            { id: 'check', label: 'Check élevé' },
          ],
        },
      },
      solution: { kind: 'weights', reference: { cbet_small: 0.5, check: 0.5 } },
      provenance: { origin: 'heuristic', tool: 'Heuristique Kill Tilt Postflop', confidence: 'medium' },
      explanationId: 'exp.tex_twin_2a',
    },
    expectedPhase1: { rangeAdv: 'neutre', nutsAdv: 'neutre' },
    expectedPhase2: { freqPct: 50, sizingPct: 33 },
    explanation: 'Sur Q-8-3 monotone, les couleurs sont partagées entre CO et BB : petit sizing (33%) ou check pour contrôler la taille du pot.',
  },
  {
    twinPairId: 'pair_monotone_vs_paired',
    twinLabel: 'Paire 2 — Monotone vs Board Pairé (CO vs BB SRP)',
    template: {
      id: 'tex_twin_2b_kk5r',
      skillId: 'post.texture.paired',
      family: 'texture_paired',
      bucket: 'transfer',
      ranked: false,
      league: 'cash',
      public: {
        templateId: 'tex_twin_2b_kk5r',
        skillId: 'post.texture.paired',
        family: 'texture_paired',
        gameType: 'texture',
        context: { variant: 'NLHE', format: 'cash', venue: 'online', tableSize: 6, effectiveStackBb: 100, anteTotalBb: 0 },
        limitMs: CLOCK_MS.texture,
        state: {
          kind: 'texture',
          board: ['Kh', 'Kd', '5c'],
          positions: ['CO', 'BB'],
          potType: 'SRP CO vs BB',
          options: [
            { id: 'cbet_small', label: 'C-Bet 33% (haute fréquence)' },
            { id: 'cbet_big', label: 'C-Bet 75%' },
            { id: 'check', label: 'Check back' },
          ],
        },
      },
      solution: { kind: 'weights', reference: { cbet_small: 0.9, check: 0.1 } },
      provenance: { origin: 'heuristic', tool: 'Heuristique Kill Tilt Postflop', confidence: 'medium' },
      explanationId: 'exp.tex_twin_2b',
    },
    expectedPhase1: { rangeAdv: 'IP', nutsAdv: 'IP' },
    expectedPhase2: { freqPct: 100, sizingPct: 33 },
    explanation: 'Sur K-K-5 rainbow, CO détient un avantage de range écrasant (AK, KQ, AA, QQ). C-Bet quasi 100% à 33% du pot.',
  },
];
