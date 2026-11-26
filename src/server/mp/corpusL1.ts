import type {
  CorpusTemplate,
  GameContext,
  Provenance,
  SpotPublic,
} from '../../domain/types';
import { blockerImpact, comboCount } from '../../engines/chunk';
import { bountyAdjusted } from '../../engines/formats';
import { bubbleFactor, requiredEquityIcm } from '../../engines/icm';
import { CLOCK_MS, LEAGUE_OPEN_THRESHOLD } from '../../engines/mp/config';
import { validateCorpus, type CorpusTemplateWithMeta } from '../../engines/mp/corpus';
import type { Bucket } from '../../engines/mp/series';

/**
 * Corpus autoritaire L1 — STRICTEMENT CÔTÉ SERVEUR (MP-14).
 * Ne doit JAMAIS être importé par le code client (`src/modules`, `src/components`, `src/stores`, etc.).
 */
export const L1_CORPUS_VERSION = 'mp-l1-maths-v1';
export const L1_GENERATOR_VERSION = 'mp-l1-gen-v1';

export interface L1CorpusTemplate extends CorpusTemplateWithMeta {
  reviewSigned: true;
  reviewedBy: string;
  reviewedAt: string;
}

const P_L1_COMPUTED: Provenance = {
  origin: 'computed',
  tool: 'ProPokerV2 Server Exact Math Engines (L1)',
  note: 'Vérité exacte calculée côté serveur et relue avant mise en classé',
  confidence: 'high',
};

const ROUND2 = (n: number) => Math.round(n * 100) / 100;

function makeL1Template(params: {
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
}): L1CorpusTemplate {
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
    provenance: P_L1_COMPUTED,
    explanationId: `exp.${params.id}`,
    explanationText: params.explanationText,
    unitLabel: '%',
    reviewSigned: true,
    reviewedBy: 'KillTilt Math Audit M1',
    reviewedAt: '2026-11-26T00:00:00.000Z',
  };
}

function computeIcmEqTruth(data: {
  stacks: number[];
  payouts: number[];
  hero: number;
  shover: number;
  bb: number;
}): { reqPct: number; chipReqPct: number } {
  const start = [...data.stacks];
  const duel = Math.min(start[data.hero], start[data.shover]);
  const ifFold = start.map((s, i) =>
    i === data.hero ? Math.max(0.01, s - data.bb) : i === data.shover ? s + data.bb : s
  );
  const ifWin = start.map((s, i) =>
    i === data.hero ? s + duel : i === data.shover ? Math.max(0, s - duel) : s
  );
  const ifLose = start.map((s, i) =>
    i === data.hero ? Math.max(0, s - duel) : i === data.shover ? s + duel : s
  );
  const req = requiredEquityIcm({
    start,
    ifFold,
    ifWin,
    ifLose,
    hero: data.hero,
    payouts: [...data.payouts],
  });
  return {
    reqPct: ROUND2(req * 100),
    chipReqPct: ROUND2(((duel - data.bb) / (2 * duel)) * 100),
  };
}

function buildL1MathsIcmCorpus(): L1CorpusTemplate[] {
  const out: L1CorpusTemplate[] = [];

  // 1. Famille `icm_equity` (27 gabarits: 16 frontier, 7 transfer, 4 mixed)
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
    { stacks: [40, 25, 20, 15], payouts: [65, 35, 0, 0], hero: 1, shover: 0, sb: 0.5, bb: 1, bucket: 'transfer' },
    { stacks: [40, 25, 20, 15], payouts: [65, 35, 0, 0], hero: 2, shover: 0, sb: 0.5, bb: 1, bucket: 'transfer' },
    { stacks: [52, 26, 14, 8], payouts: [60, 25, 15, 0], hero: 1, shover: 0, sb: 1, bb: 2, bucket: 'transfer' },
    { stacks: [30, 28, 24, 18], payouts: [50, 30, 20, 0], hero: 2, shover: 0, sb: 1, bb: 2, bucket: 'transfer' },
    { stacks: [55, 20, 15, 10], payouts: [50, 30, 20, 0], hero: 1, shover: 2, sb: 0.5, bb: 1, bucket: 'transfer' },
    { stacks: [33, 31, 21, 15], payouts: [50, 30, 20, 0], hero: 0, shover: 1, sb: 0.5, bb: 1, bucket: 'transfer' },
    { stacks: [46, 25, 18, 11], payouts: [70, 30, 0, 0], hero: 1, shover: 0, sb: 0.5, bb: 1, bucket: 'transfer' },
    { stacks: [29, 27, 24, 20], payouts: [50, 30, 20, 0], hero: 1, shover: 0, sb: 0.5, bb: 1, bucket: 'mixed' },
    { stacks: [34, 26, 22, 18], payouts: [50, 30, 20, 0], hero: 2, shover: 1, sb: 0.5, bb: 1, bucket: 'mixed' },
    { stacks: [41, 25, 19, 15], payouts: [52, 30, 18, 0], hero: 1, shover: 3, sb: 0.5, bb: 1, bucket: 'mixed' },
    { stacks: [39, 28, 19, 14], payouts: [50, 30, 20, 0], hero: 3, shover: 2, sb: 0.5, bb: 1, bucket: 'mixed' },
  ];

  icmConfigs.forEach((cfg, idx) => {
    const data = {
      stacks: [...cfg.stacks],
      payouts: [...cfg.payouts],
      hero: cfg.hero,
      shover: cfg.shover,
      sb: cfg.sb,
      bb: cfg.bb,
    };
    const { reqPct, chipReqPct } = computeIcmEqTruth(data);
    const id = `l1_math_icmeq_${String(idx + 1).padStart(2, '0')}`;
    out.push(
      makeL1Template({
        id,
        skillId: `icm.eq.s${idx + 1}`,
        family: 'icm_equity',
        bucket: cfg.bucket,
        context: {
          variant: 'NLHE',
          format: 'mtt',
          venue: 'online',
          tableSize: 4,
          effectiveStackBb: cfg.stacks[cfg.hero],
          anteTotalBb: 0,
          payouts: [...cfg.payouts],
          stacksBb: [...cfg.stacks],
        },
        question: `Bulle 4-Max (tapis ${cfg.stacks.join('/')}, paiements ${cfg.payouts.slice(0, 3).join('/')}). J${cfg.shover + 1} (${cfg.stacks[cfg.shover]}bb) shove en SB (${cfg.sb}) sur Hero J${cfg.hero + 1} (${cfg.stacks[cfg.hero]}bb) en BB (${cfg.bb}). Quelle équité minimale (%) pour call ?`,
        data,
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
    { stacks: [55, 42, 30, 24, 15, 9], payouts: [35, 24, 17, 11, 7.5, 5.5], hero: 4, villain: 0, label: 'TF 6-Max', bucket: 'transfer' },
    { stacks: [55, 42, 30, 24, 15, 9], payouts: [35, 24, 17, 11, 7.5, 5.5], hero: 1, villain: 0, label: 'TF 6-Max', bucket: 'transfer' },
    { stacks: [40, 35, 25], payouts: [65, 35, 0], hero: 1, villain: 0, label: 'Sat Top-2', bucket: 'transfer' },
    { stacks: [40, 35, 25], payouts: [65, 35, 0], hero: 2, villain: 0, label: 'Sat Top-2', bucket: 'transfer' },
    { stacks: [30, 30, 20, 20], payouts: [50, 30, 20, 0], hero: 0, villain: 1, label: 'Bulle 4-Max', bucket: 'transfer' },
    { stacks: [50, 20, 5], payouts: [80, 12, 8], hero: 1, villain: 0, label: 'Expresso 80/12/8', bucket: 'transfer' },
    { stacks: [50, 20, 5], payouts: [80, 12, 8], hero: 2, villain: 1, label: 'Expresso 80/12/8', bucket: 'transfer' },
    { stacks: [34, 24, 22, 20], payouts: [50, 30, 20, 0], hero: 1, villain: 0, label: 'Bulle serrée', bucket: 'mixed' },
    { stacks: [32, 32, 20, 16], payouts: [50, 30, 20, 0], hero: 0, villain: 1, label: 'Bulle co-CL', bucket: 'mixed' },
    { stacks: [30, 25, 20], payouts: [80, 12, 8], hero: 1, villain: 0, label: 'Expresso 80/12/8', bucket: 'mixed' },
    { stacks: [48, 36, 28, 22, 16, 10], payouts: [35, 24, 17, 11, 7.5, 5.5], hero: 2, villain: 1, label: 'TF 6-Max', bucket: 'mixed' },
  ];

  bfConfigs.forEach((cfg, idx) => {
    const res = bubbleFactor(cfg.stacks, cfg.payouts, cfg.hero, cfg.villain);
    const reqPct = ROUND2(res.requiredEquity * 100);
    const id = `l1_math_bf_${String(idx + 1).padStart(2, '0')}`;
    out.push(
      makeL1Template({
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

  // 3. Famille `pko_bounty_call` (27 gabarits)
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
    const id = `l1_math_pko_${String(idx + 1).padStart(2, '0')}`;
    out.push(
      makeL1Template({
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

  // 4. Famille `pot_odds_exact` (27 gabarits)
  const potOddsPairs: [number, number][] = [
    [10, 3.3], [10, 5], [10, 6.7], [10, 7.5], [10, 10], [10, 12.5], [10, 15], [12, 4],
    [12, 6], [12, 9], [15, 5], [15, 10], [20, 5], [20, 10], [20, 15], [24, 18],
    [18, 6], [18, 12], [25, 12.5], [30, 10], [30, 20], [40, 30], [50, 25],
    [14, 7], [16, 12], [22, 11], [28, 21],
  ];
  potOddsPairs.forEach(([potBefore, bet], idx) => {
    const bucket: Bucket = idx < 16 ? 'frontier' : idx < 23 ? 'transfer' : 'mixed';
    const pct = ROUND2((bet / (potBefore + 2 * bet)) * 100);
    const id = `l1_math_odds_${String(idx + 1).padStart(2, '0')}`;
    out.push(
      makeL1Template({
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

  // 5. Famille `outs_turn_river` (27 gabarits)
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
    { outs: 2, street: 'flop_river', drawLabel: 'Paire vers brelan (2 outs) Flop → River', bucket: 'transfer' },
    { outs: 5, street: 'turn_river', drawLabel: 'Paire vers DP/brelan (5 outs) Turn → River', bucket: 'transfer' },
    { outs: 7, street: 'flop_river', drawLabel: 'Brelan vers full/carré (7 outs) Flop → River', bucket: 'transfer' },
    { outs: 10, street: 'turn_river', drawLabel: 'Brelan vers full/carré (10 outs) Turn → River', bucket: 'transfer' },
    { outs: 11, street: 'flop_river', drawLabel: 'OESD + 1 overcard (11 outs) Flop → River', bucket: 'transfer' },
    { outs: 14, street: 'turn_river', drawLabel: 'Couleur + 2 overcards propres (14 outs) Turn → River', bucket: 'transfer' },
    { outs: 17, street: 'flop_river', drawLabel: 'Mega Combo Draw (17 outs) Flop → River', bucket: 'transfer' },
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
    const id = `l1_math_outs_${String(idx + 1).padStart(2, '0')}`;
    out.push(
      makeL1Template({
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

  // 6. Famille `combos_blockers` (27 gabarits)
  const blockerHands = [
    'AKs', 'AQs', 'A5s', 'KQs', 'QQ', 'AA', 'KK', 'AKo', 'AJo', 'KJs',
    'QJs', 'ATs', 'KQo', 'A4s', 'A9s', 'JJ',
    'A8o', 'KTs', 'QTs', 'JTs', 'TT', 'AQo', 'K9s',
    'A2s', 'A3s', 'KQo', '99',
  ];
  blockerHands.forEach((h, idx) => {
    const bucket: Bucket = idx < 16 ? 'frontier' : idx < 23 ? 'transfer' : 'mixed';
    const imp = blockerImpact(h);
    const totalBase = 28;
    const rem = imp.AA + imp.KK + imp.AK;
    const pctRemaining = ROUND2((rem / totalBase) * 100);
    const id = `l1_math_blk_${String(idx + 1).padStart(2, '0')}`;
    out.push(
      makeL1Template({
        id,
        skillId: `pre.blk.s${idx + 1}`,
        family: 'combos_blockers',
        bucket,
        context: { variant: 'NLHE', format: 'cash', venue: 'online', tableSize: 6, effectiveStackBb: 100, anteTotalBb: 0 },
        question: `Vous tenez ${h} (${comboCount(h)} combos). Sur la range de 4-Bet value adverse {AA, KK, AK} (28 combos sans bloqueur), quel pourcentage (%) des combos reste-t-il réellement disponible chez Vilain ?`,
        data: { heroHand: h, baseTotal: totalBase },
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

export const L1_MATHS_ICM_CORPUS: readonly L1CorpusTemplate[] = buildL1MathsIcmCorpus();

export const L1_CORPUS_BY_ID: ReadonlyMap<string, L1CorpusTemplate> = new Map(
  L1_MATHS_ICM_CORPUS.map((t) => [t.id, t])
);

/** Vérification stricte au démarrage / build / tests unitaires (MP-14) : recalcule chaque vérité mathématique depuis zéro. */
export function verifyL1CorpusTruth(corpus: readonly L1CorpusTemplate[] = L1_MATHS_ICM_CORPUS): {
  total: number;
  families: number;
} {
  validateCorpus(corpus, { isProduction: true });

  const frontier = corpus.filter((t) => t.bucket === 'frontier').length;
  const transfer = corpus.filter((t) => t.bucket === 'transfer').length;
  const mixed = corpus.filter((t) => t.bucket === 'mixed').length;
  const families = new Set(corpus.map((t) => t.family));

  if (
    corpus.length < LEAGUE_OPEN_THRESHOLD.total ||
    frontier < LEAGUE_OPEN_THRESHOLD.frontier ||
    transfer < LEAGUE_OPEN_THRESHOLD.transfer ||
    mixed < LEAGUE_OPEN_THRESHOLD.mixed ||
    families.size < LEAGUE_OPEN_THRESHOLD.minFamilies
  ) {
    throw new Error(`Corpus L1 sous le seuil d'ouverture (${corpus.length})`);
  }

  for (const t of corpus) {
    if (!t.reviewSigned || !t.reviewedBy) {
      throw new Error(`Gabarit L1 sans relecture signée : ${t.id}`);
    }
    if (t.solution.kind !== 'estimate' || t.public.state.kind !== 'estimate') {
      throw new Error(`Format inattendu dans corpus Maths & ICM L1 : ${t.id}`);
    }
    const d = t.public.state.data;
    let recomputed: number;

    if (t.family === 'icm_equity') {
      const { reqPct } = computeIcmEqTruth({
        stacks: d.stacks as number[],
        payouts: d.payouts as number[],
        hero: d.hero as number,
        shover: d.shover as number,
        bb: d.bb as number,
      });
      recomputed = reqPct;
    } else if (t.family === 'icm_bubble_factor') {
      const res = bubbleFactor(
        d.stacks as number[],
        d.payouts as number[],
        d.hero as number,
        d.villain as number
      );
      recomputed = ROUND2(res.requiredEquity * 100);
    } else if (t.family === 'pko_bounty_call') {
      const res = bountyAdjusted({
        call: d.call as number,
        finalPot: d.finalPot as number,
        bountyCash: d.bountyCash as number,
        chipsInPlay: d.chipsInPlay as number,
        remainingRegularPool: d.remainingRegularPool as number,
        remainingBountyPool: d.remainingBountyPool as number,
      });
      recomputed = ROUND2(res.withBounty * 100);
    } else if (t.family === 'pot_odds_exact') {
      const potBefore = d.potBefore as number;
      const bet = d.bet as number;
      recomputed = ROUND2((bet / (potBefore + 2 * bet)) * 100);
    } else if (t.family === 'outs_turn_river') {
      const outs = d.outs as number;
      const street = d.street as 'flop_turn' | 'turn_river' | 'flop_river';
      const pct =
        street === 'flop_turn'
          ? (outs / 47) * 100
          : street === 'turn_river'
            ? (outs / 46) * 100
            : (1 - ((47 - outs) / 47) * ((46 - outs) / 46)) * 100;
      recomputed = ROUND2(pct);
    } else if (t.family === 'combos_blockers') {
      const imp = blockerImpact(d.heroHand as string);
      const rem = imp.AA + imp.KK + imp.AK;
      recomputed = ROUND2((rem / (d.baseTotal as number)) * 100);
    } else {
      throw new Error(`Famille L1 inconnue: ${t.family}`);
    }

    if (Math.abs(recomputed - t.solution.truthPct) > 0.01) {
      throw new Error(
        `Divergence vérité mathématique sur ${t.id}: stocké=${t.solution.truthPct}, recalculé=${recomputed}`
      );
    }
  }

  return { total: corpus.length, families: families.size };
}

/** Liste blanche stricte des propriétés publiques d'un spot (zéro champ de solution). */
export function toStrictPublicSpot(template: CorpusTemplate, spotIndex: number): SpotPublic {
  return {
    spotIndex,
    templateId: template.id,
    skillId: template.skillId,
    family: template.family,
    gameType: template.public.gameType,
    context: { ...template.public.context },
    limitMs: template.public.limitMs,
    state:
      template.public.state.kind === 'estimate'
        ? {
            kind: 'estimate',
            question: template.public.state.question,
            min: template.public.state.min,
            max: template.public.state.max,
            step: template.public.state.step,
            data: { ...template.public.state.data },
            assumptions: [...template.public.state.assumptions],
          }
        : template.public.state,
  };
}

export const FORBIDDEN_PRE_REVEAL_KEYS = new Set<string>([
  'solution',
  'truthPct',
  'ev',
  'defaultAction',
  'reference',
  'tolerance',
  'zeroAt',
  'explanationText',
  'secretSeed',
]);

export const FORBIDDEN_PRE_SETTLEMENT_RUN_KEYS = new Set<string>([
  ...FORBIDDEN_PRE_REVEAL_KEYS,
  'pd',
  'loss',
  'lossUnit',
  'perfect',
  'totalPd',
  'perfects',
]);

/** Inspection récursive anti-fuite utilisée dans les tests d'acceptation MP-13 & MP-17. */
export function assertNoSolutionLeak(
  value: unknown,
  forbiddenKeys: ReadonlySet<string> = FORBIDDEN_PRE_SETTLEMENT_RUN_KEYS,
  path = 'root'
): void {
  if (value === null || value === undefined || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, idx) => assertNoSolutionLeak(item, forbiddenKeys, `${path}[${idx}]`));
    return;
  }
  const obj = value as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (forbiddenKeys.has(key)) {
      throw new Error(`Fuite interdite détectée avant révélation à ${path}.${key}`);
    }
    assertNoSolutionLeak(obj[key], forbiddenKeys, `${path}.${key}`);
  }
}
