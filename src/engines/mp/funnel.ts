import type { CorpusTemplate } from '../../domain/types';
import { CLOCK_MS } from './config';
import { funnelPd } from './scoring';

export interface FunnelBlockDef {
  id: string;
  label: string;
}

export const FUNNEL_BLOCKS: readonly FunnelBlockDef[] = [
  { id: 'valeur_forte', label: 'Valeur forte (Sets / DP / Overpaires)' },
  { id: 'valeur_moyenne', label: 'Valeur moyenne (Top paire faible / 2e paire)' },
  { id: 'tirages_forts', label: 'Tirages forts (FD / OESD / Combo)' },
  { id: 'tirages_faibles', label: 'Tirages faibles (Gutshot / Backdoors)' },
  { id: 'bluff_catchers', label: 'Bluff-catchers / Paires moyennes' },
  { id: 'air', label: 'Air total / Overcards pures' },
] as const;

export interface FunnelStreetSpec {
  street: 'Flop' | 'Turn' | 'River';
  observedAction: string;
  board: string[];
  referenceWeights: Record<string, number>;
  peerInitialWeights: Record<string, number>;
  explanation: string;
}

export interface FunnelCaseSpec {
  id: string;
  title: string;
  assumptions: string[];
  streets: readonly FunnelStreetSpec[];
}

/** Détectives (Entonnoir) : toujours non classé car la référence dépend d'un modèle de profil (Bible p.19). */
export function funnelRankedEligible(_template: CorpusTemplate): false {
  return false;
}

export function scoreFunnelStreet(
  playerWeights: Record<string, number>,
  referenceWeights: Record<string, number>
): number {
  return funnelPd(playerWeights, referenceWeights);
}

/** Contre-enquête [Ajout Bible p.19] : permet une révision unique après inspection des poids du pair. */
export function scoreFunnelWithCounterInquiry(
  initialWeights: Record<string, number>,
  revisedWeights: Record<string, number>,
  referenceWeights: Record<string, number>
): { initialPd: number; revisedPd: number; improved: boolean } {
  const initialPd = funnelPd(initialWeights, referenceWeights);
  const revisedPd = funnelPd(revisedWeights, referenceWeights);
  return {
    initialPd,
    revisedPd,
    improved: revisedPd < initialPd,
  };
}

export const FUNNEL_CASES: readonly FunnelCaseSpec[] = [
  {
    id: 'funnel_reg_tag_btn_vs_bb',
    title: 'Enquête #1 — Reg TAG BB (Check-Call Flop → Donk/Lead River)',
    assumptions: [
      'Profil Vilain : Régulier TAG (VPIP 24 / PFR 20 / AF 2.8)',
      'Pot SRP BTN (Hero) vs BB (Vilain), 100bb effectifs',
      `Horloge pédagogique : ${CLOCK_MS.funnel / 1000}s par rue`,
    ],
    streets: [
      {
        street: 'Flop',
        observedAction: 'Vilain (BB) check-call un C-Bet 33% sur Qh 9s 4d',
        board: ['Qh', '9s', '4d'],
        referenceWeights: {
          valeur_forte: 10,
          valeur_moyenne: 35,
          tirages_forts: 25,
          tirages_faibles: 15,
          bluff_catchers: 10,
          air: 5,
        },
        peerInitialWeights: {
          valeur_forte: 15,
          valeur_moyenne: 30,
          tirages_forts: 25,
          tirages_faibles: 10,
          bluff_catchers: 15,
          air: 5,
        },
        explanation:
          'Au flop, un Reg check-raise souvent ses brelans (99/44), donc il reste surtout des Qx moyens, des JTs/KTs et des gutshots.',
      },
      {
        street: 'Turn',
        observedAction: 'Turn 2s — Vilain check-call encore une mise 66% pot',
        board: ['Qh', '9s', '4d', '2s'],
        referenceWeights: {
          valeur_forte: 15,
          valeur_moyenne: 40,
          tirages_forts: 30,
          tirages_faibles: 5,
          bluff_catchers: 10,
          air: 0,
        },
        peerInitialWeights: {
          valeur_forte: 20,
          valeur_moyenne: 35,
          tirages_forts: 25,
          tirages_faibles: 10,
          bluff_catchers: 10,
          air: 0,
        },
        explanation:
          'Le 2s ouvre un tirage couleur backdoor mais n’aide pas les paires faibles. L’entonnoir se resserre sur Qx + tirages forts.',
      },
      {
        street: 'River',
        observedAction: 'River Js (complète QT/KTs et pique) — Vilain donk-bet 75% pot',
        board: ['Qh', '9s', '4d', '2s', 'Js'],
        referenceWeights: {
          valeur_forte: 65,
          valeur_moyenne: 10,
          tirages_forts: 0,
          tirages_faibles: 0,
          bluff_catchers: 5,
          air: 20,
        },
        peerInitialWeights: {
          valeur_forte: 55,
          valeur_moyenne: 15,
          tirages_forts: 0,
          tirages_faibles: 0,
          bluff_catchers: 10,
          air: 20,
        },
        explanation:
          'Les tirages ont soit touché (quintes/couleurs en valeur forte) soit raté (transformés en bluff avec bloqueurs KT/AT).',
      },
    ],
  },
];
