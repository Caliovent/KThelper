import type { SpotSolution } from '../../domain/types.ts';
import { BOSS_CONFIG, RAID_CONFIG } from './config.ts';
import { scoreSolution } from './scoring.ts';

export type BossId = 'nit' | 'calling_station' | 'reg_aggro' | 'chip_leader_icm';
export type BossPhase = 'preflop' | 'postflop' | 'pression';

export interface BossProfile {
  id: BossId;
  name: string;
  emblem: string;
  tagline: string;
  freqSheet: {
    vpip: number;
    pfr: number;
    threeBet: number;
    foldToCbet: number;
    aggressionNote: string;
  };
  quotes: readonly [string, string, string];
}

export interface BossDecisionStep {
  phase: BossPhase;
  streetLabel: string;
  heroCards: [string, string];
  board: string[];
  prompt: string;
  referenceRailActionLabel: string;
  options: { id: string; label: string }[];
  solution: Extract<SpotSolution, { kind: 'ev' }>;
  explanation: string;
}

export interface BossHandSpec {
  id: string;
  bossId: BossId;
  title: string;
  railNotice: 'La main continue sur la ligne de référence';
  steps: readonly BossDecisionStep[];
}

export const BOSS_PROFILES: Record<BossId, BossProfile> = {
  nit: {
    id: 'nit',
    name: 'Le Roc Sévère (Nit)',
    emblem: '🪨',
    tagline: 'Ne 4-bet et ne check-raise qu’avec les nuts absolues.',
    freqSheet: { vpip: 14, pfr: 11, threeBet: 3.5, foldToCbet: 62, aggressionNote: 'Ultra tight postflop' },
    quotes: [
      '« Je n’entre qu’avec du béton armé. »',
      '« Si je relance au turn, ton overpaire est morte. »',
      '« Respecte ma range de value, ou donne tes jetons. »',
    ],
  },
  calling_station: {
    id: 'calling_station',
    name: 'Le Mur Passif (Calling Station)',
    emblem: '🧱',
    tagline: 'Ne lâche aucune paire ni aucun tirage, ne bluffe jamais river.',
    freqSheet: { vpip: 46, pfr: 8, threeBet: 2.0, foldToCbet: 24, aggressionNote: 'Call large, bluff ~0%' },
    quotes: [
      '« Je paye pour voir ce qui tombe ! »',
      '« Tu ne me feras pas fold deuxième paire. »',
      '« Si je mise cher river, j’ai touché mon jeu. »',
    ],
  },
  reg_aggro: {
    id: 'reg_aggro',
    name: 'Le Requin Aggressif (Reg LAG)',
    emblem: '🦈',
    tagline: '3-Bet polarisé et pression multi-barrel dès qu’il sent de la faiblesse.',
    freqSheet: { vpip: 28, pfr: 24, threeBet: 11.5, foldToCbet: 41, aggressionNote: 'Haute pression 2-3 barrels' },
    quotes: [
      '« Je vais tester ton courage sur trois rues. »',
      '« Tes checks moyens seront attaqués sans pitié. »',
      '« Sais-tu défendre tes bluff-catchers au bon seuil ? »',
    ],
  },
  chip_leader_icm: {
    id: 'chip_leader_icm',
    name: 'Le Tyran de Bulle (Chip Leader ICM)',
    emblem: '👑',
    tagline: 'Abuse de son stack en TF/bulle face aux tapis moyens sous Risk Premium.',
    freqSheet: { vpip: 36, pfr: 31, threeBet: 14.0, foldToCbet: 35, aggressionNote: 'Shoves larges sous pression ICM' },
    quotes: [
      '« Un bust ici te coûte la table finale. »',
      '« Ton seuil ChipEV ne te sauvera pas sous ICM. »',
      '« Calcule ton Risk Premium avant de payer ! »',
    ],
  },
};

function makeDecision(params: {
  phase: BossPhase;
  streetLabel: string;
  heroCards: [string, string];
  board: string[];
  prompt: string;
  referenceRailActionLabel: string;
  options: { id: string; label: string }[];
  unit: 'mbb' | 'ppm_pp';
  ev: Record<string, number>;
  defaultAction: string;
  explanation: string;
}): BossDecisionStep {
  return {
    phase: params.phase,
    streetLabel: params.streetLabel,
    heroCards: params.heroCards,
    board: params.board,
    prompt: params.prompt,
    referenceRailActionLabel: params.referenceRailActionLabel,
    options: params.options,
    solution: {
      kind: 'ev',
      unit: params.unit,
      ev: params.ev,
      defaultAction: params.defaultAction,
      trivial: false,
    },
    explanation: params.explanation,
  };
}

/**
 * 10 variantes distinctes de mains Boss sur rails (>= 8 requis par Bible p.19 & MP-25).
 * Chaque décision a sa propre solution EV contre le modèle du Boss affiché.
 */
export const BOSS_HAND_VARIANTS: readonly BossHandSpec[] = [
  {
    id: 'boss_h01_nit_overpair',
    bossId: 'nit',
    title: 'Main #1 — Overpaire KK face au check-raise du Nit',
    railNotice: 'La main continue sur la ligne de référence',
    steps: [
      makeDecision({
        phase: 'preflop',
        streetLabel: 'Préflop (CO 100bb)',
        heroCards: ['Ks', 'Kd'],
        board: [],
        prompt: 'CO open 2.5bb avec KK, le Nit défend en BB.',
        referenceRailActionLabel: 'Open 2.5bb (ligne de référence)',
        options: [
          { id: 'raise', label: 'Open Raise 2.5bb' },
          { id: 'limp', label: 'Limp' },
          { id: 'fold', label: 'Fold' },
        ],
        unit: 'mbb',
        ev: { raise: 1850, limp: 750, fold: 0 },
        defaultAction: 'fold',
        explanation: 'KK est un open en value obligatoire pour bâtir le pot.',
      }),
      makeDecision({
        phase: 'postflop',
        streetLabel: 'Flop Js 7d 2c (Pot 5.5bb)',
        heroCards: ['Ks', 'Kd'],
        board: ['Js', '7d', '2c'],
        prompt: 'Le Nit check. Sur J72 rainbow, quelle fréquence / ligne ?',
        referenceRailActionLabel: 'C-Bet 50% pot (ligne de référence)',
        options: [
          { id: 'bet', label: 'C-Bet Value 50%' },
          { id: 'check', label: 'Check back' },
        ],
        unit: 'mbb',
        ev: { bet: 1420, check: 1080 },
        defaultAction: 'check',
        explanation: 'Contre la range cappée du Nit qui paye ses Jx/88-TT, C-Bet value est supérieur.',
      }),
      makeDecision({
        phase: 'pression',
        streetLabel: 'Turn 4h (Le Nit check-raise 3.5x)',
        heroCards: ['Ks', 'Kd'],
        board: ['Js', '7d', '2c', '4h'],
        prompt: 'Turn 4h : vous bettez 6bb, le Nit check-raise à 21bb (3% bluff). Décision ?',
        referenceRailActionLabel: 'Disciplined Fold face au x/r Nit',
        options: [
          { id: 'fold', label: 'Fold discipliné' },
          { id: 'call', label: 'Hero Call' },
          { id: 'allin', label: 'Shove 90bb' },
        ],
        unit: 'mbb',
        ev: { fold: 0, call: -780, allin: -1450 },
        defaultAction: 'fold',
        explanation: 'Un Nit (AF bas) en x/r turn représente JJ/77/22/44 : KK n’a presque aucun bluff en face.',
      }),
    ],
  },
  {
    id: 'boss_h02_nit_steal',
    bossId: 'nit',
    title: 'Main #2 — Pression sur les blindes du Nit',
    railNotice: 'La main continue sur la ligne de référence',
    steps: [
      makeDecision({
        phase: 'preflop',
        streetLabel: 'Préflop (BTN 100bb)',
        heroCards: ['Ks', '9s'],
        board: [],
        prompt: 'Le Nit est en BB (fold to steal élevé). K9s au BTN ?',
        referenceRailActionLabel: 'Open 2.5bb BTN',
        options: [
          { id: 'raise', label: 'Open 2.5bb' },
          { id: 'fold', label: 'Fold' },
        ],
        unit: 'mbb',
        ev: { raise: 620, fold: 0 },
        defaultAction: 'fold',
        explanation: 'K9s imprime de la fold equity contre un Nit en blinde.',
      }),
      makeDecision({
        phase: 'postflop',
        streetLabel: 'Flop Ac 8d 3h (Pot 5.5bb)',
        heroCards: ['Ks', '9s'],
        board: ['Ac', '8d', '3h'],
        prompt: 'Le Nit check sur A-8-3 rainbow.',
        referenceRailActionLabel: 'C-Bet 33% (range advantage)',
        options: [
          { id: 'bet', label: 'C-Bet 33%' },
          { id: 'check', label: 'Check back' },
        ],
        unit: 'mbb',
        ev: { bet: 480, check: 120 },
        defaultAction: 'check',
        explanation: 'Sur board A-high dry, le Nit fold toutes ses pocket pairs sous-As et broadways ratés.',
      }),
      makeDecision({
        phase: 'pression',
        streetLabel: 'Turn Tc (Le Nit lead 75% pot)',
        heroCards: ['Ks', '9s'],
        board: ['Ac', '8d', '3h', 'Tc'],
        prompt: 'Sur le donk-bet 75% pot du Nit au Turn Tc, vous avez K9s (roi hauteur).',
        referenceRailActionLabel: 'Fold immédiat',
        options: [
          { id: 'fold', label: 'Fold' },
          { id: 'call', label: 'Float Call' },
        ],
        unit: 'mbb',
        ev: { fold: 0, call: -640 },
        defaultAction: 'fold',
        explanation: 'Un donk 75% d’un joueur Nit signifie Ax fort ou brelan : aucune cote pour float K-high.',
      }),
    ],
  },
  {
    id: 'boss_h03_cs_value',
    bossId: 'calling_station',
    title: 'Main #3 — Triple barrel thin value contre Calling Station',
    railNotice: 'La main continue sur la ligne de référence',
    steps: [
      makeDecision({
        phase: 'preflop',
        streetLabel: 'Préflop (CO 100bb vs limp)',
        heroCards: ['As', 'Qh'],
        board: [],
        prompt: 'La Calling Station limp MP. Vous isolez AQo au CO ?',
        referenceRailActionLabel: 'Iso-Raise 4bb',
        options: [
          { id: 'raise', label: 'Iso-Raise 4bb' },
          { id: 'call', label: 'Overlimp 1bb' },
          { id: 'fold', label: 'Fold' },
        ],
        unit: 'mbb',
        ev: { raise: 1150, call: 390, fold: 0 },
        defaultAction: 'fold',
        explanation: 'Contre un limp passif, isoler à 4bb en position extrait un maximum de value avec AQo.',
      }),
      makeDecision({
        phase: 'postflop',
        streetLabel: 'Flop Qs 9d 4c (Pot 9.5bb)',
        heroCards: ['As', 'Qh'],
        board: ['Qs', '9d', '4c'],
        prompt: 'Top paire top kicker contre Calling Station (fold to C-Bet 24%).',
        referenceRailActionLabel: 'C-Bet Cher 75% pot',
        options: [
          { id: 'bet_big', label: 'Bet Value 75%' },
          { id: 'bet_small', label: 'Bet 25%' },
          { id: 'check', label: 'Check' },
        ],
        unit: 'mbb',
        ev: { bet_big: 1680, bet_small: 1210, check: 720 },
        defaultAction: 'check',
        explanation: 'Une Calling Station ne fold pas Qx/9x/tirages : il faut sizer cher dès le flop.',
      }),
      makeDecision({
        phase: 'pression',
        streetLabel: 'River 2h (Pot 38bb)',
        heroCards: ['As', 'Qh'],
        board: ['Qs', '9d', '4c', '6s', '2h'],
        prompt: 'Brique river. Vilain check encore. Value bet ou pot control ?',
        referenceRailActionLabel: 'Value Bet 66% pot',
        options: [
          { id: 'bet', label: 'Value Bet 66%' },
          { id: 'check', label: 'Check back prudent' },
        ],
        unit: 'mbb',
        ev: { bet: 940, check: 210 },
        defaultAction: 'check',
        explanation: 'Contre une Calling Station (46% VPIP), AQ est largement devant toutes les Qx moins bonnes et 9x.',
      }),
    ],
  },
  {
    id: 'boss_h04_cs_nobluff',
    bossId: 'calling_station',
    title: 'Main #4 — Zéro bluff river contre Calling Station',
    railNotice: 'La main continue sur la ligne de référence',
    steps: [
      makeDecision({
        phase: 'preflop',
        streetLabel: 'Préflop (BTN 100bb)',
        heroCards: ['Kd', 'Jd'],
        board: [],
        prompt: 'Calling Station complète sa BB. Open standard BTN ?',
        referenceRailActionLabel: 'Open 2.5bb BTN',
        options: [
          { id: 'raise', label: 'Open 2.5bb' },
          { id: 'fold', label: 'Fold' },
        ],
        unit: 'mbb',
        ev: { raise: 740, fold: 0 },
        defaultAction: 'fold',
        explanation: 'KJs domine la range de défense très large d’une Calling Station.',
      }),
      makeDecision({
        phase: 'postflop',
        streetLabel: 'Flop 9d 6c 2d (Pot 5.5bb)',
        heroCards: ['Kd', 'Jd'],
        board: ['9d', '6c', '2d'],
        prompt: 'Vous avez tirage couleur max + deux overcards.',
        referenceRailActionLabel: 'Semi-bluff C-Bet 66%',
        options: [
          { id: 'bet', label: 'Bet 66% (semi-bluff / value equity)' },
          { id: 'check', label: 'Check back' },
        ],
        unit: 'mbb',
        ev: { bet: 680, check: 410 },
        defaultAction: 'check',
        explanation: 'Tirage couleur max + 2 overs garde une énorme équité même payé.',
      }),
      makeDecision({
        phase: 'pression',
        streetLabel: 'River 4s (Tirage raté, Vilain check)',
        heroCards: ['Kd', 'Jd'],
        board: ['9d', '6c', '2d', 'Th', '4s'],
        prompt: 'Tout a raté. Vilain ne lâche aucune paire. Faut-il bluffer river ?',
        referenceRailActionLabel: 'Check back (abandonner le bluff)',
        options: [
          { id: 'check', label: 'Check back (ne pas bluffer CS)' },
          { id: 'bet', label: 'Bluff 80% pot' },
        ],
        unit: 'mbb',
        ev: { check: 150, bet: -890 },
        defaultAction: 'check',
        explanation: 'Règle d’or Kill Tilt : on ne bluffe jamais une Calling Station river quand on a K-high.',
      }),
    ],
  },
  {
    id: 'boss_h05_aggro_3bet',
    bossId: 'reg_aggro',
    title: 'Main #5 — Défendre IP face au 3-Bet du Reg Aggro',
    railNotice: 'La main continue sur la ligne de référence',
    steps: [
      makeDecision({
        phase: 'preflop',
        streetLabel: 'Préflop (CO vs 3-Bet SB 11.5%)',
        heroCards: ['Ac', 'Qc'],
        board: [],
        prompt: 'CO open 2.5bb, le Reg Aggro 3-bet à 10bb en SB. AQs ?',
        referenceRailActionLabel: 'Call IP 10bb',
        options: [
          { id: 'call', label: 'Call en position' },
          { id: '4bet', label: '4-Bet 22bb' },
          { id: 'fold', label: 'Fold' },
        ],
        unit: 'mbb',
        ev: { call: 610, '4bet': 380, fold: 0 },
        defaultAction: 'fold',
        explanation: 'Contre un Reg Aggro (3-bet 11.5%), call AQs IP garde ses bluffs et domine son AQ/KQ.',
      }),
      makeDecision({
        phase: 'postflop',
        streetLabel: 'Flop Qh 8c 3d (Pot 21bb)',
        heroCards: ['Ac', 'Qc'],
        board: ['Qh', '8c', '3d'],
        prompt: 'Vilain C-Bet 33% en pot 3-bet. Votre ligne ?',
        referenceRailActionLabel: 'Call pour garder ses bluffs',
        options: [
          { id: 'call', label: 'Call 7bb' },
          { id: 'raise', label: 'Raise 21bb' },
          { id: 'fold', label: 'Fold' },
        ],
        unit: 'mbb',
        ev: { call: 1180, raise: 740, fold: -350 },
        defaultAction: 'fold',
        explanation: 'Top paire top kicker sur board sec bloque les Qx et veut laisser Vilain continuer à bluffer.',
      }),
      makeDecision({
        phase: 'pression',
        streetLabel: 'River 7s (Vilain 3-barrel 75% pot)',
        heroCards: ['Ac', 'Qc'],
        board: ['Qh', '8c', '3d', '2s', '7s'],
        prompt: 'Board sans tirage complété, le Reg Aggro envoie un 3e barrel à 75%.',
        referenceRailActionLabel: 'Call (bluff-catch optimal)',
        options: [
          { id: 'call', label: 'Call 75%' },
          { id: 'fold', label: 'Fold' },
        ],
        unit: 'mbb',
        ev: { call: 920, fold: 0 },
        defaultAction: 'fold',
        explanation: 'AQs est tout en haut de votre range de call face aux nombreux bluffs manqués d’un Reg LAG.',
      }),
    ],
  },
  {
    id: 'boss_h06_aggro_4betbluff',
    bossId: 'reg_aggro',
    title: 'Main #6 — 4-Bet Light avec bloqueur A5s vs Reg LAG',
    railNotice: 'La main continue sur la ligne de référence',
    steps: [
      makeDecision({
        phase: 'preflop',
        streetLabel: 'Préflop (BTN vs BB 3-Bet 13%)',
        heroCards: ['As', '5s'],
        board: [],
        prompt: 'BTN open 2.5bb, le Reg Aggro 3-bet à 11bb en BB. A5s ?',
        referenceRailActionLabel: '4-Bet bluff à 24bb',
        options: [
          { id: '4bet', label: '4-Bet 24bb' },
          { id: 'call', label: 'Call 11bb' },
          { id: 'fold', label: 'Fold' },
        ],
        unit: 'mbb',
        ev: { '4bet': 420, call: 290, fold: 0 },
        defaultAction: 'fold',
        explanation: 'A5s bloque AA/AK et possède une excellente équité si callé par JJ/QQ/KQ.',
      }),
      makeDecision({
        phase: 'postflop',
        streetLabel: 'Flop Kd 9s 4c (Pot 48bb, si callé)',
        heroCards: ['As', '5s'],
        board: ['Kd', '9s', '4c'],
        prompt: 'Vilain check en pot 4-bet sur K-9-4 rainbow.',
        referenceRailActionLabel: 'C-Bet 25% pot (avantage Kx)',
        options: [
          { id: 'bet', label: 'C-Bet 25% (12bb)' },
          { id: 'check', label: 'Check back' },
        ],
        unit: 'mbb',
        ev: { bet: 510, check: 180 },
        defaultAction: 'check',
        explanation: 'Un petit C-Bet 25% met une pression maximale sur ses TT-QQ et ses broadways sans K.',
      }),
      makeDecision({
        phase: 'pression',
        streetLabel: 'Turn Jh (Vilain x/shove après C-Bet)',
        heroCards: ['As', '5s'],
        board: ['Kd', '9s', '4c', 'Jh'],
        prompt: 'Vilain check-call flop puis donk-shove Turn.',
        referenceRailActionLabel: 'Fold immédiat (hauteur As)',
        options: [
          { id: 'fold', label: 'Fold' },
          { id: 'call', label: 'Hero Call A-high' },
        ],
        unit: 'mbb',
        ev: { fold: 0, call: -1150 },
        defaultAction: 'fold',
        explanation: 'A-high sans tirage est battu même par ses semi-bluffs QT/JT.',
      }),
    ],
  },
  {
    id: 'boss_h07_icm_bubble_call',
    bossId: 'chip_leader_icm',
    title: 'Main #7 — Call à la bulle 4-Max (40/25/20/15)',
    railNotice: 'La main continue sur la ligne de référence',
    steps: [
      makeDecision({
        phase: 'preflop',
        streetLabel: 'Préflop Bulle 4-Max (Tapis 40/25/20/15, 50/30/20)',
        heroCards: ['Ad', 'Jc'],
        board: [],
        prompt: 'Le Chip Leader (40bb) open shove en SB sur Hero en BB (25bb) avec AJo. Risk Premium énorme (68.9% requis vs range serrée ou call ?). Contre range 45% shove AJo a 59%.',
        referenceRailActionLabel: 'Fold ICM discipliné',
        options: [
          { id: 'fold', label: 'Fold ICM' },
          { id: 'call', label: 'Call 25bb' },
        ],
        unit: 'ppm_pp',
        ev: { fold: 0, call: -4200 },
        defaultAction: 'fold',
        explanation: 'Malgré 59% d’équité contre sa range large, le seuil Malmuth-Harville (40/25/20/15 -> 68,9%) rend le call négatif en $EV !',
      }),
      makeDecision({
        phase: 'postflop',
        streetLabel: 'Scénario référence : Pot limped SB vs BB (Board A94)',
        heroCards: ['Ad', 'Jc'],
        board: ['Ah', '9s', '4c'],
        prompt: 'Si le pot était joué postflop à la bulle : le CL c-bet 33%.',
        referenceRailActionLabel: 'Call avec Top Paire',
        options: [
          { id: 'call', label: 'Call' },
          { id: 'fold', label: 'Fold' },
        ],
        unit: 'ppm_pp',
        ev: { call: 2400, fold: 0 },
        defaultAction: 'fold',
        explanation: 'Pour 33% du pot sans engager tout le tapis, TP bon kicker défend facilement.',
      }),
      makeDecision({
        phase: 'pression',
        streetLabel: 'River Kd — CL met tapis pour vos derniers 18bb',
        heroCards: ['Ad', 'Jc'],
        board: ['Ah', '9s', '4c', '2h', 'Kd'],
        prompt: 'Le CL vous met à tapis pour votre survie sur le K river.',
        referenceRailActionLabel: 'Fold ICM (15bb encore derrière)',
        options: [
          { id: 'fold', label: 'Fold ICM' },
          { id: 'call', label: 'Call All-in' },
        ],
        unit: 'ppm_pp',
        ev: { fold: 0, call: -3100 },
        defaultAction: 'fold',
        explanation: 'Tant qu’un short stack à 15bb survit à table, payer tout son stack avec une paire demande un Bubble Factor > 2.3.',
      }),
    ],
  },
  {
    id: 'boss_h08_icm_resteal',
    bossId: 'chip_leader_icm',
    title: 'Main #8 — Resteal 20bb contre Chip Leader ICM',
    railNotice: 'La main continue sur la ligne de référence',
    steps: [
      makeDecision({
        phase: 'preflop',
        streetLabel: 'Préflop TF (Stacks 45/20/18/17)',
        heroCards: ['As', 'Qs'],
        board: [],
        prompt: 'Le Chip Leader (45bb) min-raise CO (PFR 31%). Hero (20bb) en BB avec AQs.',
        referenceRailActionLabel: '3-Bet All-in 20bb (Fold Equity + Value)',
        options: [
          { id: 'allin', label: '3-Bet Shove 20bb' },
          { id: 'call', label: 'Call 2bb OOP' },
          { id: 'fold', label: 'Fold' },
        ],
        unit: 'ppm_pp',
        ev: { allin: 3600, call: 1100, fold: 0 },
        defaultAction: 'fold',
        explanation: 'Contre un open très large (31%) du Chip Leader, AQs a une fold equity massive + ~45% contre sa range de call.',
      }),
      makeDecision({
        phase: 'postflop',
        streetLabel: 'Si call OOP — Flop Qs 7c 2h',
        heroCards: ['As', 'Qs'],
        board: ['Qs', '7c', '2h'],
        prompt: 'Vous avez check-call et touchez Top Paire Top Kicker. Check pour laisser c-bet ?',
        referenceRailActionLabel: 'Check au Chip Leader agressif',
        options: [
          { id: 'check', label: 'Check (induce C-bet)' },
          { id: 'bet', label: 'Donk-bet' },
        ],
        unit: 'ppm_pp',
        ev: { check: 1900, bet: 1100 },
        defaultAction: 'check',
        explanation: 'Laisser le Tyran c-better sa fréquence élevée maximise la value.',
      }),
      makeDecision({
        phase: 'pression',
        streetLabel: 'Turn 5s — CL part à tapis 18bb',
        heroCards: ['As', 'Qs'],
        board: ['Qs', '7c', '2h', '5s'],
        prompt: 'Sur 5s, vous avez TPTK + tirage couleur max ! Le CL shove.',
        referenceRailActionLabel: 'Snap Call (équité écrasante)',
        options: [
          { id: 'call', label: 'Call All-in' },
          { id: 'fold', label: 'Fold' },
        ],
        unit: 'ppm_pp',
        ev: { call: 8200, fold: 0 },
        defaultAction: 'fold',
        explanation: 'TPTK + tirage couleur max dépasse très largement le seuil ICM même sous forte pression.',
      }),
    ],
  },
  {
    id: 'boss_h09_nit_setmining',
    bossId: 'nit',
    title: 'Main #9 — Set Mining IP 100bb vs Open du Nit',
    railNotice: 'La main continue sur la ligne de référence',
    steps: [
      makeDecision({
        phase: 'preflop',
        streetLabel: 'Préflop (BTN vs Nit UTG Open 3bb)',
        heroCards: ['6s', '6h'],
        board: [],
        prompt: 'Le Nit open 3bb UTG (100bb effectifs). Call pour Set Mining ?',
        referenceRailActionLabel: 'Call 3bb IP (cotes implicites)',
        options: [
          { id: 'call', label: 'Call 3bb IP' },
          { id: '3bet', label: '3-Bet 9bb' },
          { id: 'fold', label: 'Fold' },
        ],
        unit: 'mbb',
        ev: { call: 410, fold: 0, '3bet': -520 },
        defaultAction: 'fold',
        explanation: '100bb deep IP contre une range UTG serrée (QQ+/AK), les cotes implicites valident le set mining.',
      }),
      makeDecision({
        phase: 'postflop',
        streetLabel: 'Flop Kh 6d 2c (Brelan touché !)',
        heroCards: ['6s', '6h'],
        board: ['Kh', '6d', '2c'],
        prompt: 'Le Nit c-bet 50% pot sur K-6-2 rainbow. Raise tout de suite ou slowplay ?',
        referenceRailActionLabel: 'Call flop pour garder AA/AK/KQ',
        options: [
          { id: 'call', label: 'Call 50%' },
          { id: 'raise', label: 'Raise 3x flop' },
        ],
        unit: 'mbb',
        ev: { call: 3200, raise: 2550 },
        defaultAction: 'call',
        explanation: 'Sur board sec K-6-2, laisser le Nit 2-barreller AA/AK rapporte plus que raise flop.',
      }),
      makeDecision({
        phase: 'pression',
        streetLabel: 'River 9s (Pot 32bb — Nit mise 20bb)',
        heroCards: ['6s', '6h'],
        board: ['Kh', '6d', '2c', 'Td', '9s'],
        prompt: 'River 9s. Vous avez 666, le Nit bet 20bb (il reste 50bb derrière).',
        referenceRailActionLabel: 'Raise All-in Value',
        options: [
          { id: 'allin', label: 'Raise All-in Value' },
          { id: 'call', label: 'Just Call' },
        ],
        unit: 'mbb',
        ev: { allin: 4100, call: 2100 },
        defaultAction: 'call',
        explanation: 'La range de 3-barrel d’un Nit sur K-high est composée d’AK/AA/KK : il faut tout prendre river.',
      }),
    ],
  },
  {
    id: 'boss_h10_aggro_rivercheck',
    bossId: 'reg_aggro',
    title: 'Main #10 — Check-Call vs Check-Raise avec quinte contre Reg LAG',
    railNotice: 'La main continue sur la ligne de référence',
    steps: [
      makeDecision({
        phase: 'preflop',
        streetLabel: 'Préflop (BB vs BTN Reg Aggro 2.5bb)',
        heroCards: ['8d', '7d'],
        board: [],
        prompt: 'Le Reg LAG open 2.5bb au BTN. Défense en BB avec 87s ?',
        referenceRailActionLabel: 'Call 1.5bb en BB',
        options: [
          { id: 'call', label: 'Call BB' },
          { id: 'fold', label: 'Fold' },
        ],
        unit: 'mbb',
        ev: { call: 520, fold: 0 },
        defaultAction: 'fold',
        explanation: '87s se défend à 100% en BB contre un open large BTN.',
      }),
      makeDecision({
        phase: 'postflop',
        streetLabel: 'Flop 6c 5s 2h (OESD)',
        heroCards: ['8d', '7d'],
        board: ['6c', '5s', '2h'],
        prompt: 'Tirage quinte par les deux bouts face à C-Bet 50%. Check-raise semi-bluff ?',
        referenceRailActionLabel: 'Check-Raise 3.2x',
        options: [
          { id: 'raise', label: 'Check-Raise 3.2x' },
          { id: 'call', label: 'Check-Call' },
        ],
        unit: 'mbb',
        ev: { raise: 980, call: 640 },
        defaultAction: 'call',
        explanation: 'Sur board bas favorable à la BB, 87s est un excellent combo de check-raise semi-bluff.',
      }),
      makeDecision({
        phase: 'pression',
        streetLabel: 'Turn 9c (Quinte max touchée !)',
        heroCards: ['8d', '7d'],
        board: ['6c', '5s', '2h', '9c'],
        prompt: 'Turn 9c complète votre quinte (87). Vilain a callé le x/r. Bet 75% ou Check ?',
        referenceRailActionLabel: 'Bet Value 75% pot',
        options: [
          { id: 'bet', label: 'Bet 75%' },
          { id: 'check', label: 'Check' },
        ],
        unit: 'mbb',
        ev: { bet: 2800, check: 1450 },
        defaultAction: 'check',
        explanation: 'Un Reg LAG float beaucoup flop : il faut continuer la pression en value sur sa range large.',
      }),
    ],
  },
];

export interface SoloBossHandResult {
  handId: string;
  decisionPds: number[];
  meanPd: number;
}

/** Validation solo Boss (Bible p.19) : 3 mains parmi >= 8 variantes, moyenne < 500 PD/main et aucune décision > 500 PD. */
export function evaluateSoloBossValidation(hands: readonly SoloBossHandResult[]): {
  passed: boolean;
  overallMeanPdPerHand: number;
  maxDecisionPd: number;
  reason: string;
} {
  if (hands.length < BOSS_CONFIG.soloHandsCount) {
    return {
      passed: false,
      overallMeanPdPerHand: 1000,
      maxDecisionPd: 1000,
      reason: `Il faut au moins ${BOSS_CONFIG.soloHandsCount} mains pour valider le Boss.`,
    };
  }
  const allDecisions = hands.flatMap((h) => h.decisionPds);
  const maxDecisionPd = allDecisions.length ? Math.max(...allDecisions) : 1000;
  const overallMeanPdPerHand = Math.round(
    hands.reduce((acc, h) => acc + h.meanPd, 0) / hands.length
  );
  const passed =
    overallMeanPdPerHand < BOSS_CONFIG.soloMaxMeanPdPerHand &&
    maxDecisionPd <= BOSS_CONFIG.soloCriticalDecisionPd;

  return {
    passed,
    overallMeanPdPerHand,
    maxDecisionPd,
    reason: passed
      ? `Boss vaincu (${overallMeanPdPerHand} PD/main < 500, pic décision ${maxDecisionPd} PD ≤ 500).`
      : `Échec validation (${overallMeanPdPerHand} PD/main, pic décision ${maxDecisionPd} PD).`,
  };
}

export interface RaidMemberTelemetry {
  playerId: string;
  started: boolean;
  finished: boolean;
  forfeited: boolean;
  /** Liste des décisions réellement prises ou marquées timeout. */
  decisions: readonly { phase: BossPhase; pd: number }[];
  expectedDecisionCount: number;
}

/**
 * Évalue un Raid Boss 72h (Bible p.26 & MP-25) :
 * - Liste figée (rosterSize 4..20).
 * - Pour 4 membres : max(4, ceil(0.8 * 4)) = 4 doivent finir.
 * - Un run commencé non fini ou abandonné compte avec ses décisions restantes en délai dépassé.
 * - Moyenne des moyennes par joueur à poids égal.
 */
export function evaluateRaidOutcome(
  rosterSize: number,
  memberRuns: readonly RaidMemberTelemetry[],
  timeoutPd = 300
): {
  requiredFinishers: number;
  finishedCount: number;
  countedPlayers: number;
  teamMeanDecisionPd: number;
  victory: boolean;
  phaseMeans: Record<BossPhase, number>;
} {
  const requiredFinishers = Math.max(
    RAID_CONFIG.minFinishCount,
    Math.ceil(rosterSize * RAID_CONFIG.minFinishRatio)
  );

  let finishedCount = 0;
  const playerMeans: number[] = [];
  const phaseSums: Record<BossPhase, { sum: number; count: number }> = {
    preflop: { sum: 0, count: 0 },
    postflop: { sum: 0, count: 0 },
    pression: { sum: 0, count: 0 },
  };

  for (const m of memberRuns) {
    if (!m.started && !m.finished && !m.forfeited) continue;
    if (m.finished || m.forfeited) finishedCount++;

    const pds = m.decisions.map((d) => d.pd);
    const missing = Math.max(0, m.expectedDecisionCount - pds.length);
    for (let k = 0; k < missing; k++) {
      pds.push(timeoutPd);
    }
    const meanPlayer = pds.length ? pds.reduce((a, b) => a + b, 0) / pds.length : timeoutPd;
    playerMeans.push(meanPlayer);

    for (const d of m.decisions) {
      phaseSums[d.phase].sum += d.pd;
      phaseSums[d.phase].count += 1;
    }
  }

  const teamMeanDecisionPd =
    playerMeans.length > 0
      ? Math.round((playerMeans.reduce((a, b) => a + b, 0) / playerMeans.length) * 100) / 100
      : 1000;

  const victory =
    finishedCount >= requiredFinishers && teamMeanDecisionPd <= RAID_CONFIG.victoryMaxMeanPd;

  const phaseMeans: Record<BossPhase, number> = {
    preflop: phaseSums.preflop.count ? Math.round(phaseSums.preflop.sum / phaseSums.preflop.count) : 0,
    postflop: phaseSums.postflop.count ? Math.round(phaseSums.postflop.sum / phaseSums.postflop.count) : 0,
    pression: phaseSums.pression.count ? Math.round(phaseSums.pression.sum / phaseSums.pression.count) : 0,
  };

  return {
    requiredFinishers,
    finishedCount,
    countedPlayers: playerMeans.length,
    teamMeanDecisionPd,
    victory,
    phaseMeans,
  };
}

export function scoreBossDecision(
  step: BossDecisionStep,
  action: string | null,
  elapsedMs: number
): number {
  return scoreSolution(step.solution, action, elapsedMs, BOSS_CONFIG.decisionLimitMs, false, false).score.pd;
}
