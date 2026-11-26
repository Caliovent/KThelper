import type { CorpusTemplate, Position } from '../../domain/types.ts';
import { bubbleFactor, icm, icmWithBusts } from '../icm.ts';
import { CLOCK_MS, SALVE_CONFIG } from './config.ts';

export interface SalveVillainModel {
  name: string;
  format: '3max' | 'hu';
  effectiveBb: number;
  foldToActionPct: number;
  heroEqWhenCalledPct: number;
  potBeforeBb: number;
  heroCostBb: number;
  isJackpot80128?: boolean;
  stacksBb?: [number, number, number];
  heroIndex?: number;
  villainIndex?: number;
  displayedFreqs: string;
}

export interface SalveSpotSpec {
  template: CorpusTemplate;
  model: SalveVillainModel;
  suddenDeath: boolean;
  explanation: string;
}

const ROUND0 = (n: number) => Math.round(n);

/**
 * Calcule l'EV exacte d'un spot Salve (Rafale 3-Max) contre le modèle adverse affiché :
 * - En ChipEV standard : unité `mbb` (1 bb = 1000 mbb).
 * - En Jackpot 80/12/8 Expresso : unité `ppm_pp` (1% du prize pool = 10 000 ppm_pp) via Malmuth-Harville exact.
 */
export function computeSalveSpotEv(model: SalveVillainModel): {
  unit: 'mbb' | 'ppm_pp';
  evShoveOrCall: number;
  evFold: number;
  riskPremiumPct: number | null;
} {
  if (model.isJackpot80128 && model.stacksBb) {
    const payouts = [80, 12, 8];
    const h = model.heroIndex ?? 0;
    const v = model.villainIndex ?? 1;
    const stacks = [...model.stacksBb];
    const eff = Math.min(stacks[h], stacks[v]);
    const dead = Math.max(0, model.potBeforeBb - 1); // hors investissement héro

    const icmBefore = icm(stacks, payouts)[h];
    const ifFold = [...stacks];
    const evFoldVal = icm(ifFold, payouts)[h];

    const fPct = model.foldToActionPct / 100;
    const eqCall = model.heroEqWhenCalledPct / 100;
    const vSum = model.potBeforeBb / Math.max(1, stacks.length - 1);
    const ifFoldVillain = stacks.map((s, i) =>
      i === h ? s + model.potBeforeBb : Math.max(0.1, s - vSum)
    );
    const ifWin = stacks.map((s, i) => (i === h ? s + eff + dead : i === v ? Math.max(0, s - eff) : s));
    const ifLose = stacks.map((s, i) => (i === h ? Math.max(0, s - eff) : i === v ? s + eff : s));

    const eqFoldVillain = icm(ifFoldVillain, payouts)[h];
    const eqWin = icmWithBusts(ifWin, payouts, stacks)[h];
    const eqLose = icmWithBusts(ifLose, payouts, stacks)[h];

    const evPushIcm = fPct * eqFoldVillain + (1 - fPct) * (eqWin * eqCall + eqLose * (1 - eqCall));
    const bf = bubbleFactor(stacks, payouts, h, v);

    // 1 point de prize pool (sur 100) = 1% = 10 000 ppm_pp
    const deltaPushPpm = ROUND0((evPushIcm - icmBefore) * 10000);
    const deltaFoldPpm = ROUND0((evFoldVal - icmBefore) * 10000);
    return {
      unit: 'ppm_pp',
      evShoveOrCall: deltaPushPpm,
      evFold: deltaFoldPpm,
      riskPremiumPct: Math.round(bf.riskPremium * 10000) / 100,
    };
  }

  const fPct = model.foldToActionPct / 100;
  const eq = model.heroEqWhenCalledPct / 100;
  const totalPotWhenCalled = model.potBeforeBb + 2 * model.heroCostBb;
  const evIfCalledBb = eq * totalPotWhenCalled - model.heroCostBb;
  const evActBb = fPct * model.potBeforeBb + (1 - fPct) * evIfCalledBb;

  return {
    unit: 'mbb',
    evShoveOrCall: ROUND0(evActBb * 1000),
    evFold: 0,
    riskPremiumPct: null,
  };
}

interface RawSalveCase {
  id: string;
  hero: Position;
  cards: [string, string];
  actionId: 'allin' | 'call';
  actionLabel: string;
  model: SalveVillainModel;
  suddenDeath: boolean;
}

const RAW_SALVE_CASES: readonly RawSalveCase[] = [
  {
    id: 'salve_01_jackpot_3eq',
    hero: 'BTN',
    cards: ['As', 'Qs'],
    actionId: 'allin',
    actionLabel: 'Push All-in 25bb',
    suddenDeath: false,
    model: {
      name: 'Reg Expresso 80/12/8 (Modèle équilibré)',
      format: '3max',
      effectiveBb: 25,
      foldToActionPct: 82,
      heroEqWhenCalledPct: 45,
      potBeforeBb: 1.5,
      heroCostBb: 25,
      isJackpot80128: true,
      stacksBb: [25, 25, 25],
      heroIndex: 0,
      villainIndex: 1,
      displayedFreqs: 'Jackpot 80/12/8 • Fold combiné 82% • Call 18% (AQs = 45% vs call)',
    },
  },
  {
    id: 'salve_02_sb_vs_bb_nit',
    hero: 'SB',
    cards: ['Kd', '7s'],
    actionId: 'allin',
    actionLabel: 'Open Shove 14bb',
    suddenDeath: false,
    model: {
      name: 'Nit Passif BB',
      format: 'hu',
      effectiveBb: 14,
      foldToActionPct: 64,
      heroEqWhenCalledPct: 36,
      potBeforeBb: 1.5,
      heroCostBb: 13.5,
      displayedFreqs: 'Fold to Shove 64% • Call 36% (77+, A8+, KQ)',
    },
  },
  {
    id: 'salve_03_hu_cs_shove',
    hero: 'SB',
    cards: ['Jh', '4c'],
    actionId: 'allin',
    actionLabel: 'Open Shove 12bb',
    suddenDeath: false,
    model: {
      name: 'Calling Station HU',
      format: 'hu',
      effectiveBb: 12,
      foldToActionPct: 28,
      heroEqWhenCalledPct: 34,
      potBeforeBb: 1.5,
      heroCostBb: 11.5,
      displayedFreqs: 'Fold to Shove 28% • Call très large 72%',
    },
  },
  {
    id: 'salve_04_bb_call_aggro',
    hero: 'BB',
    cards: ['Ad', '8c'],
    actionId: 'call',
    actionLabel: 'Call Shove 11bb',
    suddenDeath: false,
    model: {
      name: 'Maniac SB 11bb (Shove 75%)',
      format: 'hu',
      effectiveBb: 11,
      foldToActionPct: 0,
      heroEqWhenCalledPct: 56.4,
      potBeforeBb: 1.5,
      heroCostBb: 10,
      displayedFreqs: 'Shove 75% (tous Ax, Kx, Qx, SC) • A8o a 56,4% d’équité',
    },
  },
  {
    id: 'salve_05_3max_btn_18bb',
    hero: 'BTN',
    cards: ['Qs', 'Ts'],
    actionId: 'allin',
    actionLabel: 'Open Shove 18bb',
    suddenDeath: false,
    model: {
      name: 'Blindes Serrées 3-Max',
      format: '3max',
      effectiveBb: 18,
      foldToActionPct: 72,
      heroEqWhenCalledPct: 38,
      potBeforeBb: 1.5,
      heroCostBb: 18,
      displayedFreqs: 'Fold combiné SB+BB 72% • Call 28% (QTs = 38%)',
    },
  },
  {
    id: 'salve_06_bb_vs_iso_nit',
    hero: 'BB',
    cards: ['Kh', '9c'],
    actionId: 'call',
    actionLabel: 'Call Shove 10bb',
    suddenDeath: false,
    model: {
      name: 'Nit 3-Max Shove 10bb (18%)',
      format: '3max',
      effectiveBb: 10,
      foldToActionPct: 0,
      heroEqWhenCalledPct: 34.2,
      potBeforeBb: 1.5,
      heroCostBb: 9,
      displayedFreqs: 'Shove ultra serré 18% (55+, A9+, KQ) • K9o = 34,2% vs cette range',
    },
  },
  {
    id: 'salve_07_hu_9bb_ace',
    hero: 'SB',
    cards: ['Ac', '3d'],
    actionId: 'allin',
    actionLabel: 'Open Shove 9bb',
    suddenDeath: false,
    model: {
      name: 'Reg Équilibré HU 9bb',
      format: 'hu',
      effectiveBb: 9,
      foldToActionPct: 48,
      heroEqWhenCalledPct: 45.2,
      potBeforeBb: 1.5,
      heroCostBb: 8.5,
      displayedFreqs: 'Fold to Shove 48% • Call 52% (A3o = 45,2%)',
    },
  },
  {
    id: 'salve_08_btn_15bb_trap',
    hero: 'BTN',
    cards: ['Tc', '6s'],
    actionId: 'allin',
    actionLabel: 'Open Shove 15bb',
    suddenDeath: false,
    model: {
      name: 'Trap Reg BB (Call 55%)',
      format: '3max',
      effectiveBb: 15,
      foldToActionPct: 45,
      heroEqWhenCalledPct: 31.8,
      potBeforeBb: 1.5,
      heroCostBb: 15,
      displayedFreqs: 'Fold 45% • Call large 55% (T6o = 31,8%)',
    },
  },
  {
    id: 'salve_09_hu_6bb_su',
    hero: 'SB',
    cards: ['8h', '6h'],
    actionId: 'allin',
    actionLabel: 'Open Shove 6bb',
    suddenDeath: false,
    model: {
      name: 'Reg HU 6bb',
      format: 'hu',
      effectiveBb: 6,
      foldToActionPct: 42,
      heroEqWhenCalledPct: 40.5,
      potBeforeBb: 1.5,
      heroCostBb: 5.5,
      displayedFreqs: 'Fold 42% • Call 58% (86s = 40,5%)',
    },
  },
  {
    id: 'salve_10_bb_8bb_call',
    hero: 'BB',
    cards: ['Qd', 'Js'],
    actionId: 'call',
    actionLabel: 'Call Shove 8bb',
    suddenDeath: false,
    model: {
      name: 'Reg Aggro SB 8bb (Shove 62%)',
      format: 'hu',
      effectiveBb: 8,
      foldToActionPct: 0,
      heroEqWhenCalledPct: 52.8,
      potBeforeBb: 1.5,
      heroCostBb: 7,
      displayedFreqs: 'Shove 62% • QJo = 52,8% vs range de shove',
    },
  },
  {
    id: 'salve_11_3max_13bb_fold',
    hero: 'SB',
    cards: ['7d', '2s'],
    actionId: 'allin',
    actionLabel: 'Open Shove 13bb',
    suddenDeath: false,
    model: {
      name: 'BB Récréatif Call 60%',
      format: '3max',
      effectiveBb: 13,
      foldToActionPct: 40,
      heroEqWhenCalledPct: 29.5,
      potBeforeBb: 1.5,
      heroCostBb: 12.5,
      displayedFreqs: 'Fold 40% • Call 60% (72o = 29,5%)',
    },
  },
  {
    id: 'salve_12_hu_16bb_kjs',
    hero: 'SB',
    cards: ['Ks', 'Js'],
    actionId: 'allin',
    actionLabel: 'Open Shove 16bb',
    suddenDeath: false,
    model: {
      name: 'Reg Passif HU 16bb',
      format: 'hu',
      effectiveBb: 16,
      foldToActionPct: 58,
      heroEqWhenCalledPct: 46.1,
      potBeforeBb: 1.5,
      heroCostBb: 15.5,
      displayedFreqs: 'Fold 58% • Call 42% (KJs = 46,1%)',
    },
  },
  // 3 spots de Mort Subite (13..15)
  {
    id: 'salve_13_sd_jackpot_7bb',
    hero: 'SB',
    cards: ['As', '2c'],
    actionId: 'allin',
    actionLabel: 'Open Shove 7bb',
    suddenDeath: true,
    model: {
      name: 'Mort Subite — Nit HU 7bb',
      format: 'hu',
      effectiveBb: 7,
      foldToActionPct: 56,
      heroEqWhenCalledPct: 42.8,
      potBeforeBb: 1.5,
      heroCostBb: 6.5,
      displayedFreqs: 'Fold 56% • Call 44% (A2o = 42,8%)',
    },
  },
  {
    id: 'salve_14_sd_bb_call_12bb',
    hero: 'BB',
    cards: ['5s', '5c'],
    actionId: 'call',
    actionLabel: 'Call Shove 12bb',
    suddenDeath: true,
    model: {
      name: 'Mort Subite — Reg Shove 55%',
      format: 'hu',
      effectiveBb: 12,
      foldToActionPct: 0,
      heroEqWhenCalledPct: 54.1,
      potBeforeBb: 1.5,
      heroCostBb: 11,
      displayedFreqs: 'Shove 55% en SB • 55 possède 54,1% d’équité',
    },
  },
  {
    id: 'salve_15_sd_jackpot_3max',
    hero: 'BTN',
    cards: ['Kd', 'Qc'],
    actionId: 'allin',
    actionLabel: 'Push 14bb (Jackpot 80/12/8)',
    suddenDeath: true,
    model: {
      name: 'Mort Subite — Expresso 80/12/8 (25/25/25)',
      format: '3max',
      effectiveBb: 14,
      foldToActionPct: 70,
      heroEqWhenCalledPct: 44.5,
      potBeforeBb: 1.5,
      heroCostBb: 14,
      isJackpot80128: true,
      stacksBb: [25, 25, 25],
      heroIndex: 0,
      villainIndex: 2,
      displayedFreqs: 'Jackpot 80/12/8 (tapis égaux 25/25/25) • Fold 70% • KQo = 44,5% vs call',
    },
  },
];

export const SALVE_SPOTS: readonly SalveSpotSpec[] = RAW_SALVE_CASES.map((c, idx) => {
  const computed = computeSalveSpotEv(c.model);
  const rpNote =
    computed.riskPremiumPct !== null
      ? ` En Expresso 80/12/8 à trois tapis égaux, son Risk Premium n’est que de ${computed.riskPremiumPct.toFixed(2)} point (${computed.evShoveOrCall >= computed.evFold ? '+' : ''}${computed.evShoveOrCall} ppm_pp).`
      : '';
  return {
    model: c.model,
    suddenDeath: c.suddenDeath,
    explanation: `${c.model.name} : EV(${c.actionLabel}) = ${computed.evShoveOrCall} ${computed.unit} vs Fold = ${computed.evFold} ${computed.unit}.${rpNote}`,
    template: {
      id: c.id,
      skillId: `exp.salve.s${idx + 1}`,
      family: c.model.isJackpot80128 ? 'expresso_jackpot_80128' : `expresso_${c.model.format}`,
      bucket: idx < 9 ? 'frontier' : idx < 13 ? 'transfer' : 'mixed',
      ranked: true,
      league: 'expresso',
      public: {
        templateId: c.id,
        skillId: `exp.salve.s${idx + 1}`,
        family: c.model.isJackpot80128 ? 'expresso_jackpot_80128' : `expresso_${c.model.format}`,
        gameType: 'rafale3max',
        context: {
          variant: 'NLHE',
          format: 'expresso',
          venue: 'online',
          tableSize: c.model.format === '3max' ? 3 : 2,
          effectiveStackBb: c.model.effectiveBb,
          anteTotalBb: 0,
          payouts: c.model.isJackpot80128 ? [80, 12, 8] : [100, 0, 0],
          stacksBb: c.model.stacksBb ? [...c.model.stacksBb] : undefined,
        },
        limitMs: CLOCK_MS.rafale3max ?? SALVE_CONFIG.limitMs,
        state: {
          kind: 'decision',
          hero: c.hero,
          heroCards: c.cards,
          board: [],
          history:
            c.actionId === 'call'
              ? [{ actor: 'SB', action: 'allin', sizeBb: c.model.effectiveBb }]
              : [],
          options: [
            { id: c.actionId, label: c.actionLabel },
            { id: 'fold', label: 'Fold' },
          ],
          villainModel: `${c.model.name} — ${c.model.displayedFreqs}`,
        },
      },
      solution: {
        kind: 'ev',
        unit: computed.unit,
        ev: {
          [c.actionId]: computed.evShoveOrCall,
          fold: computed.evFold,
        },
        defaultAction: 'fold',
        trivial: false,
      },
      provenance: {
        origin: 'computed',
        tool: 'ProPokerV2 Salve Best-Response Engine',
        note: 'Meilleure réponse exacte au modèle adverse nommé affiché (aucune exploitation libre)',
        confidence: 'high',
      },
      explanationId: `exp.${c.id}`,
    },
  };
});

/** Salve n'est éligible au classé que contre un modèle adverse nommé et avec solution EV calculée/sourcée (Bible p.17 & p.19). */
export function salveRankedEligible(template: CorpusTemplate): boolean {
  return (
    template.public.gameType === 'rafale3max' &&
    template.solution.kind === 'ev' &&
    (template.provenance.origin === 'computed' || template.provenance.origin === 'solver_export') &&
    template.provenance.confidence === 'high' &&
    template.public.state.kind === 'decision' &&
    Boolean(template.public.state.villainModel && template.public.state.villainModel.trim().length > 0)
  );
}
