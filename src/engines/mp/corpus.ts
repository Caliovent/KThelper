import type {
  CorpusTemplate,
  GameContext,
  League,
  Provenance,
  SeriesRef,
  SpotPublic,
} from '../../domain/types';
import { bubbleFactor, requiredEquityIcm } from '../icm';
import { bountyAdjusted } from '../formats';
import { blockerImpact, comboCount } from '../chunk';
import { CLOCK_MS, LEAGUE_OPEN_THRESHOLD, RULES_VERSION } from './config';
import { dayKey } from './daily';
import { int, rngFrom, shuffle } from './rng';
import { scoreSolution, totals, type SpotScore } from './scoring';
import { selectSeries, type Bucket } from './series';

export const CORPUS_VERSION = 'mp-corpus-maths-v1';
export const GENERATOR_VERSION = 'mp-gen-v1';

const P_COMPUTED: Provenance = {
  origin: 'computed',
  tool: 'ProPokerV2 Exact Math Engines',
  note: 'Vérité numérique calculée exactement à la génération (aucune valeur inventée)',
  confidence: 'high',
};

const P_HEURISTIC_FRIENDLY: Provenance = {
  origin: 'heuristic',
  tool: 'Guide Kill Tilt NL2 (entraînement amical uniquement)',
  note: 'Heuristique non classée — exclue du classé',
  confidence: 'medium',
};

export type CorpusTemplateWithMeta = CorpusTemplate & {
  explanationText: string;
  unitLabel: string;
};

const ROUND2 = (n: number) => Math.round(n * 100) / 100;

function makeMathTemplate(params: {
  id: string;
  skillId: string;
  family: string;
  bucket: Bucket;
  context: GameContext;
  question: string;
  data: Record<string, unknown>;
  assumptions: string[];
  truthPct: number;
  explanationText: string;
}): CorpusTemplateWithMeta {
  return {
    id: params.id,
    skillId: params.skillId,
    family: params.family,
    bucket: params.bucket,
    ranked: true,
    league: 'maths_icm',
    public: {
      templateId: params.id,
      skillId: params.skillId,
      family: params.family,
      gameType: 'icm',
      context: params.context,
      limitMs: CLOCK_MS.estimate,
      state: {
        kind: 'estimate',
        question: params.question,
        min: 0,
        max: 100,
        step: 0.5,
        data: params.data,
        assumptions: params.assumptions,
      },
    },
    solution: {
      kind: 'estimate',
      truthPct: ROUND2(params.truthPct),
      tolerance: 1.5,
      zeroAt: 15,
    },
    provenance: P_COMPUTED,
    explanationId: `exp.${params.id}`,
    explanationText: params.explanationText,
    unitLabel: '%',
  };
}

function buildMathsIcmCorpus(): CorpusTemplateWithMeta[] {
  const out: CorpusTemplateWithMeta[] = [];

  // 1. Famille `icm_equity` (27 gabarits: 16 frontier, 7 transfer, 4 mixed)
  // Inclut l'exemple exact de la Bible p.18 : 40/25/20/15, payouts 50/30/20, SB 0.5, BB 1, shove SB 25 -> BB 25 => 68.9%
  const icmConfigs: {
    stacks: [number, number, number, number];
    payouts: [number, number, number, number];
    hero: number;
    shover: number;
    sb: number;
    bb: number;
    bucket: Bucket;
  }[] = [
    { stacks: [40, 25, 20, 15], payouts: [50, 30, 20, 0], hero: 1, shover: 0, sb: 0.5, bb: 1, bucket: 'frontier' },
    { stacks: [40, 25, 20, 15], payouts: [50, 30, 20, 0], hero: 2, shover: 0, sb: 0.5, bb: 1, bucket: 'frontier' },
    { stacks: [40, 25, 20, 15], payouts: [50, 30, 20, 0], hero: 3, shover: 0, sb: 0.5, bb: 1, bucket: 'frontier' },
    { stacks: [45, 28, 17, 10], payouts: [50, 30, 20, 0], hero: 1, shover: 0, sb: 0.5, bb: 1, bucket: 'frontier' },
    { stacks: [45, 28, 17, 10], payouts: [50, 30, 20, 0], hero: 2, shover: 1, sb: 0.5, bb: 1, bucket: 'frontier' },
    { stacks: [50, 22, 18, 10], payouts: [50, 30, 20, 0], hero: 1, shover: 0, sb: 0.5, bb: 1, bucket: 'frontier' },
    { stacks: [50, 22, 18, 10], payouts: [50, 30, 20, 0], hero: 2, shover: 0, sb: 0.5, bb: 1, bucket: 'frontier' },
    { stacks: [36, 30, 22, 12], payouts: [50, 30, 20, 0], hero: 1, shover: 0, sb: 0.5, bb: 1, bucket: 'frontier' },
    { stacks: [36, 30, 22, 12], payouts: [50, 30, 20, 0], hero: 2, shover: 1, sb: 0.5, bb: 1, bucket: 'frontier' },
    { stacks: [38, 26, 21, 15], payouts: [55, 28, 17, 0], hero: 1, shover: 0, sb: 0.5, bb: 1, bucket: 'frontier' },
    { stacks: [38, 26, 21, 15], payouts: [55, 28, 17, 0], hero: 2, shover: 0, sb: 0.5, bb: 1, bucket: 'frontier' },
    { stacks: [42, 27, 19, 12], payouts: [45, 33, 22, 0], hero: 1, shover: 0, sb: 0.5, bb: 1, bucket: 'frontier' },
    { stacks: [42, 27, 19, 12], payouts: [45, 33, 22, 0], hero: 2, shover: 0, sb: 0.5, bb: 1, bucket: 'frontier' },
    { stacks: [35, 32, 23, 10], payouts: [50, 30, 20, 0], hero: 1, shover: 2, sb: 0.5, bb: 1, bucket: 'frontier' },
    { stacks: [48, 24, 16, 12], payouts: [50, 30, 20, 0], hero: 1, shover: 0, sb: 0.5, bb: 1, bucket: 'frontier' },
    { stacks: [44, 23, 20, 13], payouts: [50, 30, 20, 0], hero: 2, shover: 0, sb: 0.5, bb: 1, bucket: 'frontier' },
    // 7 transfer
    { stacks: [40, 25, 20, 15], payouts: [65, 35, 0, 0], hero: 1, shover: 0, sb: 0.5, bb: 1, bucket: 'transfer' },
    { stacks: [40, 25, 20, 15], payouts: [65, 35, 0, 0], hero: 2, shover: 0, sb: 0.5, bb: 1, bucket: 'transfer' },
    { stacks: [52, 26, 14, 8], payouts: [60, 25, 15, 0], hero: 1, shover: 0, sb: 1, bb: 2, bucket: 'transfer' },
    { stacks: [30, 28, 24, 18], payouts: [50, 30, 20, 0], hero: 2, shover: 0, sb: 1, bb: 2, bucket: 'transfer' },
    { stacks: [55, 20, 15, 10], payouts: [50, 30, 20, 0], hero: 1, shover: 2, sb: 0.5, bb: 1, bucket: 'transfer' },
    { stacks: [33, 31, 21, 15], payouts: [50, 30, 20, 0], hero: 0, shover: 1, sb: 0.5, bb: 1, bucket: 'transfer' },
    { stacks: [46, 25, 18, 11], payouts: [70, 30, 0, 0], hero: 1, shover: 0, sb: 0.5, bb: 1, bucket: 'transfer' },
    // 4 mixed
    { stacks: [29, 27, 24, 20], payouts: [50, 30, 20, 0], hero: 1, shover: 0, sb: 0.5, bb: 1, bucket: 'mixed' },
    { stacks: [34, 26, 22, 18], payouts: [50, 30, 20, 0], hero: 2, shover: 1, sb: 0.5, bb: 1, bucket: 'mixed' },
    { stacks: [41, 25, 19, 15], payouts: [52, 30, 18, 0], hero: 1, shover: 3, sb: 0.5, bb: 1, bucket: 'mixed' },
    { stacks: [39, 28, 19, 14], payouts: [50, 30, 20, 0], hero: 3, shover: 2, sb: 0.5, bb: 1, bucket: 'mixed' },
  ];

  icmConfigs.forEach((cfg, idx) => {
    const start = [...cfg.stacks];
    const duel = Math.min(start[cfg.hero], start[cfg.shover]);
    const ifFold = start.map((s, i) =>
      i === cfg.hero ? Math.max(0.01, s - cfg.bb) : i === cfg.shover ? s + cfg.bb : s
    );
    const ifWin = start.map((s, i) =>
      i === cfg.hero ? s + duel : i === cfg.shover ? Math.max(0, s - duel) : s
    );
    const ifLose = start.map((s, i) =>
      i === cfg.hero ? Math.max(0, s - duel) : i === cfg.shover ? s + duel : s
    );
    const req = requiredEquityIcm({
      start,
      ifFold,
      ifWin,
      ifLose,
      hero: cfg.hero,
      payouts: [...cfg.payouts],
    });
    const reqPct = ROUND2(req * 100);
    const chipPot = 2 * duel;
    const chipReqPct = ROUND2(((duel - cfg.bb) / chipPot) * 100);
    const id = `math_icmeq_${String(idx + 1).padStart(2, '0')}`;
    out.push(
      makeMathTemplate({
        id,
        skillId: `icm.eq.s${idx + 1}`,
        family: 'icm_equity',
        bucket: cfg.bucket,
        context: {
          variant: 'NLHE',
          format: 'mtt',
          venue: 'online',
          tableSize: 4,
          effectiveStackBb: start[cfg.hero],
          anteTotalBb: 0,
          payouts: [...cfg.payouts],
          stacksBb: start,
        },
        question: `Bulle 4-Max (tapis ${start.join('/')}, paiements ${cfg.payouts.slice(0, 3).join('/')}). J${cfg.shover + 1} (${start[cfg.shover]}bb) shove en SB (${cfg.sb}) sur Hero J${cfg.hero + 1} (${start[cfg.hero]}bb) en BB (${cfg.bb}). Quelle équité minimale (%) pour call ?`,
        data: { stacks: start, payouts: cfg.payouts, hero: cfg.hero, shover: cfg.shover, sb: cfg.sb, bb: cfg.bb },
        assumptions: [
          'Modèle Malmuth-Harville exact, partages ignorés',
          `Blindes : SB ${cfg.sb}bb / BB ${cfg.bb}bb`,
          `En ChipEV pur ce call demanderait ${chipReqPct}%`,
        ],
        truthPct: reqPct,
        explanationText: `Par Malmuth-Harville exact : équité requise = ${reqPct.toFixed(1)}% (contre ${chipReqPct.toFixed(1)}% en ChipEV, soit +${(reqPct - chipReqPct).toFixed(1)} pt de prime ICM).`,
      })
    );
  });

  // 2. Famille `icm_bubble_factor` (27 gabarits: 16 frontier, 7 transfer, 4 mixed)
  const bfConfigs: {
    stacks: number[];
    payouts: number[];
    hero: number;
    villain: number;
    label: string;
    bucket: Bucket;
  }[] = [
    { stacks: [40, 25, 20, 15], payouts: [50, 30, 20, 0], hero: 1, villain: 0, label: 'Bulle 4-Max', bucket: 'frontier' },
    { stacks: [40, 25, 20, 15], payouts: [50, 30, 20, 0], hero: 2, villain: 0, label: 'Bulle 4-Max', bucket: 'frontier' },
    { stacks: [40, 25, 20, 15], payouts: [50, 30, 20, 0], hero: 3, villain: 0, label: 'Bulle 4-Max', bucket: 'frontier' },
    { stacks: [40, 25, 20, 15], payouts: [50, 30, 20, 0], hero: 2, villain: 1, label: 'Bulle 4-Max', bucket: 'frontier' },
    { stacks: [50, 25, 15, 10], payouts: [50, 30, 20, 0], hero: 1, villain: 0, label: 'Bulle 4-Max asym.', bucket: 'frontier' },
    { stacks: [50, 25, 15, 10], payouts: [50, 30, 20, 0], hero: 2, villain: 0, label: 'Bulle 4-Max asym.', bucket: 'frontier' },
    { stacks: [60, 20, 12, 8], payouts: [50, 30, 20, 0], hero: 1, villain: 0, label: 'Bulle dominée', bucket: 'frontier' },
    { stacks: [60, 20, 12, 8], payouts: [50, 30, 20, 0], hero: 2, villain: 1, label: 'Bulle dominée', bucket: 'frontier' },
    { stacks: [25, 25, 25], payouts: [80, 12, 8], hero: 0, villain: 1, label: 'Expresso 80/12/8', bucket: 'frontier' },
    { stacks: [45, 20, 10], payouts: [80, 12, 8], hero: 1, villain: 0, label: 'Expresso 80/12/8', bucket: 'frontier' },
    { stacks: [45, 20, 10], payouts: [80, 12, 8], hero: 2, villain: 0, label: 'Expresso 80/12/8', bucket: 'frontier' },
    { stacks: [45, 20, 10], payouts: [80, 12, 8], hero: 0, villain: 1, label: 'Expresso 80/12/8', bucket: 'frontier' },
    { stacks: [35, 30, 20, 15], payouts: [50, 30, 20, 0], hero: 1, villain: 0, label: 'Bulle 4-Max', bucket: 'frontier' },
    { stacks: [35, 30, 20, 15], payouts: [50, 30, 20, 0], hero: 2, villain: 1, label: 'Bulle 4-Max', bucket: 'frontier' },
    { stacks: [55, 42, 30, 24, 15, 9], payouts: [35, 24, 17, 11, 7.5, 5.5], hero: 2, villain: 0, label: 'TF 6-Max', bucket: 'frontier' },
    { stacks: [55, 42, 30, 24, 15, 9], payouts: [35, 24, 17, 11, 7.5, 5.5], hero: 3, villain: 0, label: 'TF 6-Max', bucket: 'frontier' },
    // 7 transfer
    { stacks: [55, 42, 30, 24, 15, 9], payouts: [35, 24, 17, 11, 7.5, 5.5], hero: 4, villain: 0, label: 'TF 6-Max', bucket: 'transfer' },
    { stacks: [55, 42, 30, 24, 15, 9], payouts: [35, 24, 17, 11, 7.5, 5.5], hero: 1, villain: 0, label: 'TF 6-Max', bucket: 'transfer' },
    { stacks: [40, 35, 25], payouts: [65, 35, 0], hero: 1, villain: 0, label: 'Sat Top-2', bucket: 'transfer' },
    { stacks: [40, 35, 25], payouts: [65, 35, 0], hero: 2, villain: 0, label: 'Sat Top-2', bucket: 'transfer' },
    { stacks: [30, 30, 20, 20], payouts: [50, 30, 20, 0], hero: 0, villain: 1, label: 'Bulle 4-Max', bucket: 'transfer' },
    { stacks: [50, 20, 5], payouts: [80, 12, 8], hero: 1, villain: 0, label: 'Expresso 80/12/8', bucket: 'transfer' },
    { stacks: [50, 20, 5], payouts: [80, 12, 8], hero: 2, villain: 1, label: 'Expresso 80/12/8', bucket: 'transfer' },
    // 4 mixed
    { stacks: [34, 24, 22, 20], payouts: [50, 30, 20, 0], hero: 1, villain: 0, label: 'Bulle serrée', bucket: 'mixed' },
    { stacks: [32, 32, 20, 16], payouts: [50, 30, 20, 0], hero: 0, villain: 1, label: 'Bulle co-CL', bucket: 'mixed' },
    { stacks: [30, 25, 20], payouts: [80, 12, 8], hero: 1, villain: 0, label: 'Expresso 80/12/8', bucket: 'mixed' },
    { stacks: [48, 36, 28, 22, 16, 10], payouts: [35, 24, 17, 11, 7.5, 5.5], hero: 2, villain: 1, label: 'TF 6-Max', bucket: 'mixed' },
  ];

  bfConfigs.forEach((cfg, idx) => {
    const res = bubbleFactor(cfg.stacks, cfg.payouts, cfg.hero, cfg.villain);
    const reqPct = ROUND2(res.requiredEquity * 100);
    const id = `math_bf_${String(idx + 1).padStart(2, '0')}`;
    out.push(
      makeMathTemplate({
        id,
        skillId: `icm.bf.s${idx + 1}`,
        family: 'icm_bubble_factor',
        bucket: cfg.bucket,
        context: {
          variant: 'NLHE',
          format: cfg.payouts[0] === 80 ? 'expresso' : 'mtt',
          venue: 'online',
          tableSize: cfg.stacks.length === 3 ? 3 : cfg.stacks.length === 6 ? 6 : 5,
          effectiveStackBb: Math.min(cfg.stacks[cfg.hero], cfg.stacks[cfg.villain]),
          anteTotalBb: 0,
          payouts: cfg.payouts,
          stacksBb: cfg.stacks,
        },
        question: `${cfg.label} (tapis ${cfg.stacks.join('/')}, paiements ${cfg.payouts.join('/')}). En confrontation symétrique sans argent mort, J${cfg.hero + 1} (${cfg.stacks[cfg.hero]}bb) joue son tapis effectif contre J${cfg.villain + 1} (${cfg.stacks[cfg.villain]}bb). Quelle équité minimale (%) requise ?`,
        data: { stacks: cfg.stacks, payouts: cfg.payouts, hero: cfg.hero, villain: cfg.villain },
        assumptions: [
          'Confrontation symétrique sans argent mort (BF / (1 + BF))',
          `Bubble Factor = ${res.bf.toFixed(3)} • Risk Premium = +${(res.riskPremium * 100).toFixed(2)} pt`,
        ],
        truthPct: reqPct,
        explanationText: `Bubble Factor = ${res.bf.toFixed(3)}, soit un Risk Premium de +${(res.riskPremium * 100).toFixed(2)} pt au-dessus de 50 %. Équité requise = ${reqPct.toFixed(1)} %.`,
      })
    );
  });

  // 3. Famille `pko_bounty_call` (27 gabarits: 16 frontier, 7 transfer, 4 mixed)
  const pkoCalls = [
    12000, 15000, 18000, 20000, 22000, 24000, 14000, 16000, 25000, 30000, 10000, 19000, 21000, 27000, 32000, 17500,
    8000, 11000, 28000, 35000, 40000, 13500, 26000,
    16500, 20500, 23500, 29000,
  ];
  pkoCalls.forEach((call, idx) => {
    const bucket: Bucket = idx < 16 ? 'frontier' : idx < 23 ? 'transfer' : 'mixed';
    const finalPot = call * 2 + 4000 + (idx % 4) * 2000;
    const bountyCash = 5 + (idx % 6) * 5;
    const chipsInPlay = 2500000 + (idx % 3) * 500000;
    const remainingRegularPool = 1250 + (idx % 2) * 250;
    const remainingBountyPool = remainingRegularPool;
    const res = bountyAdjusted({
      call,
      finalPot,
      bountyCash,
      chipsInPlay,
      remainingRegularPool,
      remainingBountyPool,
    });
    const reqPct = ROUND2(res.withBounty * 100);
    const id = `math_pko_${String(idx + 1).padStart(2, '0')}`;
    out.push(
      makeMathTemplate({
        id,
        skillId: `icm.pko.s${idx + 1}`,
        family: 'pko_bounty_call',
        bucket,
        context: {
          variant: 'NLHE',
          format: 'pko',
          venue: 'online',
          tableSize: 6,
          effectiveStackBb: 25,
          anteTotalBb: 0.75,
        },
        question: `Tournoi PKO : vous couvrez Vilain. Vous devez payer ${call} jetons pour un pot final de ${finalPot} jetons, avec une prime encaissable de ${bountyCash} €. Jetons en jeu : ${(chipsInPlay / 1e6).toFixed(1)} M pour ${remainingRegularPool + remainingBountyPool} € restants au total. Quelle équité minimale (%) ajustée par la prime ?`,
        data: { call, finalPot, bountyCash, chipsInPlay, remainingRegularPool, remainingBountyPool },
        assumptions: [
          'Héros couvre Vilain (prime encaissable immédiatement)',
          'Approximation ChipEV hors ICM',
          `Bounty Power = ${Math.round(res.bountyPower)} jetons/€ (+${Math.round(res.bountyChips)} jetons)`,
        ],
        truthPct: reqPct,
        explanationText: `Sans bounty = ${(res.chipEv * 100).toFixed(1)} %. Avec +${Math.round(res.bountyChips)} jetons de prime (Bounty Power ${Math.round(res.bountyPower)} j/€), le seuil descend à ${reqPct.toFixed(1)} %.`,
      })
    );
  });

  // 4. Famille `pot_odds_exact` (27 gabarits: 16 frontier, 7 transfer, 4 mixed)
  const potOddsPairs: [number, number][] = [
    [10, 3.3], [10, 5], [10, 6.7], [10, 7.5], [10, 10], [10, 12.5], [10, 15], [12, 4],
    [12, 6], [12, 9], [15, 5], [15, 10], [20, 5], [20, 10], [20, 15], [24, 18],
    [18, 6], [18, 12], [25, 12.5], [30, 10], [30, 20], [40, 30], [50, 25],
    [14, 7], [16, 12], [22, 11], [28, 21],
  ];
  potOddsPairs.forEach(([potBefore, bet], idx) => {
    const bucket: Bucket = idx < 16 ? 'frontier' : idx < 23 ? 'transfer' : 'mixed';
    const pct = ROUND2((bet / (potBefore + 2 * bet)) * 100);
    const id = `math_odds_${String(idx + 1).padStart(2, '0')}`;
    out.push(
      makeMathTemplate({
        id,
        skillId: `pre.odds.s${idx + 1}`,
        family: 'pot_odds_exact',
        bucket,
        context: { variant: 'NLHE', format: 'cash', venue: 'online', tableSize: 6, effectiveStackBb: 100, anteTotalBb: 0 },
        question: `Pot avant mise : ${potBefore} bb. Vilain mise ${bet} bb à la river (vous devez payer ${bet} bb pour un pot final de ${(potBefore + 2 * bet).toFixed(1)} bb). Quelle équité minimale (%) faut-il pour un call strictement break-even ?`,
        data: { potBefore, bet, finalPot: potBefore + 2 * bet },
        assumptions: ['River (aucune carte à venir, aucun rake additionnel)', 'Call pur face à cette mise'],
        truthPct: pct,
        explanationText: `${bet} / (${potBefore} + 2 × ${bet}) = ${pct.toFixed(2)} %.`,
      })
    );
  });

  // 5. Famille `outs_turn_river` (27 gabarits: 16 frontier, 7 transfer, 4 mixed)
  const outCases: { outs: number; street: 'flop_turn' | 'turn_river' | 'flop_river'; drawLabel: string; bucket: Bucket }[] = [
    { outs: 4, street: 'flop_turn', drawLabel: 'Quinte ventrale (4 outs) Flop → Turn', bucket: 'frontier' },
    { outs: 4, street: 'turn_river', drawLabel: 'Quinte ventrale (4 outs) Turn → River', bucket: 'frontier' },
    { outs: 4, street: 'flop_river', drawLabel: 'Quinte ventrale (4 outs) Flop → River', bucket: 'frontier' },
    { outs: 8, street: 'flop_turn', drawLabel: 'OESD (8 outs) Flop → Turn', bucket: 'frontier' },
    { outs: 8, street: 'turn_river', drawLabel: 'OESD (8 outs) Turn → River', bucket: 'frontier' },
    { outs: 8, street: 'flop_river', drawLabel: 'OESD (8 outs) Flop → River', bucket: 'frontier' },
    { outs: 9, street: 'flop_turn', drawLabel: 'Tirage couleur (9 outs) Flop → Turn', bucket: 'frontier' },
    { outs: 9, street: 'turn_river', drawLabel: 'Tirage couleur (9 outs) Turn → River', bucket: 'frontier' },
    { outs: 9, street: 'flop_river', drawLabel: 'Tirage couleur (9 outs) Flop → River', bucket: 'frontier' },
    { outs: 12, street: 'flop_turn', drawLabel: 'Couleur + gutshot (12 outs) Flop → Turn', bucket: 'frontier' },
    { outs: 12, street: 'turn_river', drawLabel: 'Couleur + gutshot (12 outs) Turn → River', bucket: 'frontier' },
    { outs: 12, street: 'flop_river', drawLabel: 'Couleur + gutshot (12 outs) Flop → River', bucket: 'frontier' },
    { outs: 15, street: 'flop_turn', drawLabel: 'Combo Draw (15 outs) Flop → Turn', bucket: 'frontier' },
    { outs: 15, street: 'turn_river', drawLabel: 'Combo Draw (15 outs) Turn → River', bucket: 'frontier' },
    { outs: 15, street: 'flop_river', drawLabel: 'Combo Draw (15 outs) Flop → River', bucket: 'frontier' },
    { outs: 6, street: 'flop_river', drawLabel: '2 overcards (6 outs) Flop → River', bucket: 'frontier' },
    // 7 transfer
    { outs: 2, street: 'flop_river', drawLabel: 'Paire vers brelan (2 outs) Flop → River', bucket: 'transfer' },
    { outs: 5, street: 'turn_river', drawLabel: 'Paire vers DP/brelan (5 outs) Turn → River', bucket: 'transfer' },
    { outs: 7, street: 'flop_river', drawLabel: 'Brelan vers full/carré (7 outs) Flop → River', bucket: 'transfer' },
    { outs: 10, street: 'turn_river', drawLabel: 'Brelan vers full/carré (10 outs) Turn → River', bucket: 'transfer' },
    { outs: 11, street: 'flop_river', drawLabel: 'OESD + 1 overcard (11 outs) Flop → River', bucket: 'transfer' },
    { outs: 14, street: 'turn_river', drawLabel: 'Couleur + 2 overcards propres (14 outs) Turn → River', bucket: 'transfer' },
    { outs: 17, street: 'flop_river', drawLabel: 'Mega Combo Draw (17 outs) Flop → River', bucket: 'transfer' },
    // 4 mixed
    { outs: 3, street: 'flop_turn', drawLabel: 'Une overcard propre (3 outs) Flop → Turn', bucket: 'mixed' },
    { outs: 6, street: 'turn_river', drawLabel: '2 overcards (6 outs) Turn → River', bucket: 'mixed' },
    { outs: 10, street: 'flop_turn', drawLabel: 'Double DP + gutshot (10 outs) Flop → Turn', bucket: 'mixed' },
    { outs: 13, street: 'flop_turn', drawLabel: 'Couleur + backdoor/pair (13 outs) Flop → Turn', bucket: 'mixed' },
  ];
  outCases.forEach((c, idx) => {
    const pct =
      c.street === 'flop_turn'
        ? (c.outs / 47) * 100
        : c.street === 'turn_river'
          ? (c.outs / 46) * 100
          : (1 - ((47 - c.outs) / 47) * ((46 - c.outs) / 46)) * 100;
    const id = `math_outs_${String(idx + 1).padStart(2, '0')}`;
    out.push(
      makeMathTemplate({
        id,
        skillId: `post.outs.s${idx + 1}`,
        family: 'outs_turn_river',
        bucket: c.bucket,
        context: { variant: 'NLHE', format: 'cash', venue: 'online', tableSize: 6, effectiveStackBb: 100, anteTotalBb: 0 },
        question: `Calcul exact de probabilité d'outs : ${c.drawLabel}. Quelle est la probabilité exacte (%) de toucher au moins un de ces ${c.outs} outs ?`,
        data: { outs: c.outs, street: c.street },
        assumptions: [
          c.street === 'flop_turn'
            ? '47 cartes inconnues au flop'
            : c.street === 'turn_river'
              ? '46 cartes inconnues au turn'
              : '47 puis 46 cartes inconnues (tapis au flop)',
          'Outs supposés tous vivants (clean)',
        ],
        truthPct: ROUND2(pct),
        explanationText: `Probabilité combinatoire exacte : ${ROUND2(pct).toFixed(2)} % (la règle 2×/4× sert uniquement d'estimation mentale rapide).`,
      })
    );
  });

  // 6. Famille `combos_blockers` (27 gabarits: 16 frontier, 7 transfer, 4 mixed)
  const blockerHands = [
    'AKs', 'AQs', 'A5s', 'KQs', 'QQ', 'AA', 'KK', 'AKo', 'AJo', 'KJs',
    'QJs', 'ATs', 'KQo', 'A4s', 'A9s', 'JJ',
    'A8o', 'KTs', 'QTs', 'JTs', 'TT', 'AQo', 'K9s',
    'A2s', 'A3s', 'KQo', '99',
  ];
  blockerHands.forEach((h, idx) => {
    const bucket: Bucket = idx < 16 ? 'frontier' : idx < 23 ? 'transfer' : 'mixed';
    const imp = blockerImpact(h);
    const totalBase = 6 + 6 + 16; // AA(6) + KK(6) + AK(16) = 28 combos premium
    const rem = imp.AA + imp.KK + imp.AK;
    const pctRemaining = ROUND2((rem / totalBase) * 100);
    const id = `math_blk_${String(idx + 1).padStart(2, '0')}`;
    out.push(
      makeMathTemplate({
        id,
        skillId: `pre.blk.s${idx + 1}`,
        family: 'combos_blockers',
        bucket,
        context: { variant: 'NLHE', format: 'cash', venue: 'online', tableSize: 6, effectiveStackBb: 100, anteTotalBb: 0 },
        question: `Vous tenez ${h} (${comboCount(h)} combos). Sur la range de 4-Bet value adverse {AA, KK, AK} (28 combos sans bloqueur), quel pourcentage (%) des combos reste-t-il réellement disponible chez Vilain ?`,
        data: { heroHand: h, remaining: imp, baseTotal: totalBase, remainingTotal: rem },
        assumptions: [
          'Sans bloqueurs : AA = 6, KK = 6, AK = 16 (total 28 combos)',
          `Avec ${h} : il reste AA=${imp.AA}, KK=${imp.KK}, AK=${imp.AK} (${rem}/28 combos)`,
        ],
        truthPct: pctRemaining,
        explanationText: `Votre main ${h} réduit {AA, KK, AK} de 28 à ${rem} combos, soit ${pctRemaining.toFixed(1)} % restant (${(100 - pctRemaining).toFixed(1)} % bloqués).`,
      })
    );
  });

  return out;
}

export const MP_CORPUS: readonly CorpusTemplateWithMeta[] = buildMathsIcmCorpus();

/** Gabarits d'entraînement amical uniquement (non éligibles au classé, Bible p.11 & p.34). */
export const FRIENDLY_HEURISTIC_TEMPLATES: readonly CorpusTemplateWithMeta[] = [
  {
    id: 'friendly_depth_a9o_100bb',
    skillId: 'pre.cash6.100bb.CO.A9o',
    family: 'rfi_friendly',
    bucket: 'frontier',
    ranked: false,
    league: 'cash',
    public: {
      templateId: 'friendly_depth_a9o_100bb',
      skillId: 'pre.cash6.100bb.CO.A9o',
      family: 'rfi_friendly',
      gameType: 'depth',
      context: { variant: 'NLHE', format: 'cash', venue: 'online', tableSize: 6, effectiveStackBb: 100, anteTotalBb: 0 },
      limitMs: CLOCK_MS.depth,
      state: {
        kind: 'decision',
        hero: 'CO',
        heroCards: ['As', '9d'],
        board: [],
        history: [{ actor: 'UTG', action: 'fold' }, { actor: 'MP', action: 'fold' }],
        options: [{ id: 'raise', label: 'Open Raise 2.5x' }, { id: 'fold', label: 'Fold' }],
        villainModel: 'Table NL2/NL10 standard (entraînement non classé)',
      },
    },
    solution: { kind: 'weights', reference: { raise: 1, fold: 0 } },
    provenance: P_HEURISTIC_FRIENDLY,
    explanationId: 'exp.friendly.co.a9o',
    explanationText: 'En heuristique Kill Tilt 100bb au CO, A9o+ est ouvert en standard (hors mode classé tant qu’un corpus solveur sourcé n’est pas intégré).',
    unitLabel: 'amical',
  },
];

export interface LeagueAvailability {
  league: League;
  rankedOpen: boolean;
  eligibleCount: number;
  frontierCount: number;
  transferCount: number;
  mixedCount: number;
  familyCount: number;
  label: string;
}

export function getLeagueAvailability(
  league: League,
  corpus: readonly CorpusTemplate[] = MP_CORPUS
): LeagueAvailability {
  const pool =
    league === 'all_rounder'
      ? corpus.filter((t) => t.ranked && t.league !== 'maths_icm')
      : corpus.filter((t) => t.ranked && t.league === league);
  const frontierCount = pool.filter((t) => t.bucket === 'frontier').length;
  const transferCount = pool.filter((t) => t.bucket === 'transfer').length;
  const mixedCount = pool.filter((t) => t.bucket === 'mixed').length;
  const familyCount = new Set(pool.map((t) => t.family)).size;
  const rankedOpen =
    pool.length >= LEAGUE_OPEN_THRESHOLD.total &&
    frontierCount >= LEAGUE_OPEN_THRESHOLD.frontier &&
    transferCount >= LEAGUE_OPEN_THRESHOLD.transfer &&
    mixedCount >= LEAGUE_OPEN_THRESHOLD.mixed &&
    familyCount >= LEAGUE_OPEN_THRESHOLD.minFamilies;

  const names: Record<League, string> = {
    maths_icm: 'Maths & ICM (Réponses exactes)',
    cash: 'Cash Game 5/6-Max',
    mtt_icm: 'Tournois MTT & PKO',
    expresso: 'Expresso / Spin & Go',
    all_rounder: 'Polyvalent (Cash/Tournois/Expresso)',
  };

  return {
    league,
    rankedOpen,
    eligibleCount: pool.length,
    frontierCount,
    transferCount,
    mixedCount,
    familyCount,
    label: names[league],
  };
}

/** Validateur impératif au build (MP-06) : échoue si un spot heuristique est classé ou si FAKE_ fuit en production. */
export function validateCorpus(
  corpus: readonly CorpusTemplate[],
  options: { isProduction: boolean }
): void {
  for (const t of corpus) {
    if (
      options.isProduction &&
      (t.id.startsWith('FAKE_') || t.skillId.startsWith('FAKE_') || t.family.startsWith('FAKE_'))
    ) {
      throw new Error(`Données factices FAKE_ interdites en production (${t.id})`);
    }
    if (t.ranked) {
      if (t.provenance.origin !== 'solver_export' && t.provenance.origin !== 'computed') {
        throw new Error(`Gabarit classé avec provenance invalide (${t.id}: ${t.provenance.origin})`);
      }
      if (t.provenance.confidence !== 'high') {
        throw new Error(`Gabarit classé sans confiance high (${t.id})`);
      }
      if (t.solution.kind !== 'ev' && t.solution.kind !== 'estimate') {
        throw new Error(`Gabarit classé sans solution ev/estimate (${t.id}: ${t.solution.kind})`);
      }
    }
  }
}

export async function selectCorpusSeries(
  league: League,
  n: number,
  seed: string,
  rankedOnly: boolean,
  corpus: readonly CorpusTemplateWithMeta[] = MP_CORPUS
): Promise<{ templates: CorpusTemplateWithMeta[]; seriesRef: SeriesRef }> {
  const pool = corpus.filter((t) => t.league === league);
  const picked = await selectSeries(pool, n, seed, CORPUS_VERSION, GENERATOR_VERSION, rankedOnly);
  return {
    templates: picked,
    seriesRef: {
      seed,
      corpusVersion: CORPUS_VERSION,
      generatorVersion: GENERATOR_VERSION,
      rulesVersion: RULES_VERSION,
      templateIds: picked.map((t) => t.id),
    },
  };
}

export function resolveTemplatesByIds(
  ids: readonly string[],
  corpus: readonly CorpusTemplateWithMeta[] = [...MP_CORPUS, ...FRIENDLY_HEURISTIC_TEMPLATES]
): CorpusTemplateWithMeta[] {
  const map = new Map(corpus.map((t) => [t.id, t]));
  return ids.map((id) => {
    const found = map.get(id);
    if (!found) throw new Error(`Gabarit inconnu: ${id}`);
    return found;
  });
}

export function toPublicSpots(templates: readonly CorpusTemplate[]): SpotPublic[] {
  return templates.map((t, spotIndex) => ({ ...t.public, spotIndex }));
}

export interface LocalDailyBundle {
  dayKey: string;
  isLocalOnly: true;
  label: string;
  templates: CorpusTemplateWithMeta[];
}

/** Daily local d'entraînement L0 (généré depuis la date UTC, sans classement ni fausses stats communauté, Bible p.23). */
export async function composeLocalDaily(utcMs: number): Promise<LocalDailyBundle> {
  const key = dayKey(utcMs);
  const rng = await rngFrom(key, CORPUS_VERSION, GENERATOR_VERSION, 'local-daily-l0');
  const b1 = shuffle(
    rng,
    MP_CORPUS.filter((t) => t.family === 'pot_odds_exact' || t.family === 'outs_turn_river')
  ).slice(0, 5);
  const b2 = shuffle(
    rng,
    MP_CORPUS.filter((t) => t.family === 'combos_blockers')
  ).slice(0, 5);
  const b3 = shuffle(
    rng,
    MP_CORPUS.filter(
      (t) => t.family === 'icm_equity' || t.family === 'icm_bubble_factor' || t.family === 'pko_bounty_call'
    )
  ).slice(0, 5);

  return {
    dayKey: key,
    isLocalOnly: true,
    label: `Daily local d'entraînement (${key}) — Hors-ligne L0, sans classement officiel`,
    templates: [...b1, ...b2, ...b3],
  };
}

export interface ReferenceBaselineRun {
  label: string;
  isHuman: false;
  scores: SpotScore[];
  totals: { pd: number; perfects: number; ms: number };
}

/** Adversaire de référence clairement étiqueté (jamais présenté comme humain, sans effet sur MMR, Bible p.22 & p.28). */
export async function buildReferenceBaseline(
  templates: readonly CorpusTemplateWithMeta[],
  seed: string
): Promise<ReferenceBaselineRun> {
  const rng = await rngFrom(seed, CORPUS_VERSION, 'reference-baseline-v1');
  const scores: SpotScore[] = templates.map((t) => {
    const elapsedMs = Math.min(t.public.limitMs - 500, 3200 + int(rng, 4500));
    if (t.solution.kind === 'estimate') {
      const sign = int(rng, 2) === 0 ? -1 : 1;
      const offset = (int(rng, 35) / 10) * sign; // 0..3.4 pts d'écart réaliste
      const val = Math.max(0, Math.min(100, ROUND2(t.solution.truthPct + offset)));
      return scoreSolution(t.solution, String(val), elapsedMs, t.public.limitMs, false, false).score;
    }
    if (t.solution.kind === 'ev') {
      const best = Object.entries(t.solution.ev).sort((a, b) => b[1] - a[1])[0]?.[0] ?? t.solution.defaultAction;
      return scoreSolution(t.solution, best, elapsedMs, t.public.limitMs, false, false).score;
    }
    return scoreSolution(t.solution, null, elapsedMs, t.public.limitMs, false, false).score;
  });

  return {
    label: 'Référence de calibration (non humain • hors MMR)',
    isHuman: false,
    scores,
    totals: totals(scores),
  };
}
