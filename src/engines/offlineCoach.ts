import type { CoachScenario, HandReview, StreetAnalysis } from '../types/coach';
import { parseHand } from './parser';
import { texture } from './postflop';

const OFFLINE_SCENARIO_BANK: CoachScenario[] = [
  {
    title: 'Cash 6-Max — C-Bet sur Board Sec vs Fish Passif',
    limit: 'NL2',
    street: 'Flop',
    heroPosition: 'BTN',
    heroStackBb: 100,
    heroCards: ['As', 'Qd'],
    boardCards: ['Kd', '7c', '2s'],
    potBb: 6.5,
    villainPosition: 'BB',
    villainStackBb: 97,
    villainProfileName: 'Fish Passif (42/9/2)',
    villainHud: { vpip: 42, pfr: 9, threeBet: 2, af: 1.1, hands: 165 },
    actionHistory: [
      'Hero (BTN) open à 3bb avec A♠ Q♦.',
      'SB fold. Villain (BB) paie 2bb.',
      'Flop (6.5bb) : K♦ 7♣ 2♠. BB check.',
    ],
    question: 'Quelle est la meilleure décision au Flop en position ?',
    options: [
      { label: 'A', text: 'Check back pour abandonner sans équité' },
      { label: 'B', text: 'C-Bet 1/3 pot (~2.2bb) avec votre avantage de range' },
      { label: 'C', text: 'Overbet 150% pot pour le faire coucher tout de suite' },
      { label: 'D', text: 'Min-bet 1bb pour voir où vous en êtes' },
    ],
    correctIndex: 1,
    hint: 'Board sec (broadway rainbow, connectivité 0) : la range de défense de BB a très souvent raté.',
    explanation:
      'Moteur local V2 : Sur K-7-2 rainbow (connectivité 0), BTN possède un fort avantage de range. Un petit C-Bet à 33 % (MDF adverse ~75 %, Alpha 25 %) prend le pot très souvent et garde l’équité d’As-Dame (6 outs vs 7x/2x).',
    keyConcept: 'C-Bet 1/3 pot sur board dry',
    xpReward: 20,
  },
  {
    title: 'MTT Bulle 4-Max — Pression ICM Extrême (BB 25bb vs SB 40bb)',
    limit: 'MTT',
    street: 'Préflop',
    heroPosition: 'BB',
    heroStackBb: 25,
    heroCards: ['Ac', 'Jc'],
    boardCards: [],
    potBb: 26.5,
    villainPosition: 'SB',
    villainStackBb: 40,
    villainProfileName: 'Chip Leader Aggro (Bulle 50/30/20/0)',
    villainHud: { vpip: 36, pfr: 30, threeBet: 12, af: 3.4, hands: 110 },
    actionHistory: [
      '4 joueurs restants (3 places payées : 50% / 30% / 20% / 0%). Tapis : 40 / 25 / 20 / 15 bb.',
      'SB (Chip Leader, 40bb) pousse tapis directement pour mettre la pression.',
      'Hero est en BB (25bb) avec A♣ J♣ (blindes 0.5/1bb).',
    ],
    question: 'Sachant que votre Bubble Factor vs Chip Leader est de 2,38 (+20,4 pp de Risk Premium), quelle est l’action ?',
    options: [
      { label: 'A', text: 'Call automatique car AJs bat une range de shove large en ChipEV' },
      { label: 'B', text: 'Fold discipliné : il faut ~68,9 % d’équité sous ICM ici' },
      { label: 'C', text: 'Call uniquement si deux autres joueurs sont en train de parler' },
      { label: 'D', text: 'Timer jusqu’à la dernière seconde puis payer' },
    ],
    correctIndex: 1,
    hint: 'Avec deux tapis plus courts (20bb et 15bb) encore en vie à la bulle, sauter avant eux détruit énormément de $EV.',
    explanation:
      'Calcul exact Malmuth-Harville : même face à une range très large du Chip Leader, l’équité requise passe de 48,0 % (ChipEV) à 68,9 % (ICM, BF 2,38). Seules les toutes meilleures mains (QQ+, AK/AQs selon range) peuvent payer.',
    keyConcept: 'ICM Bulle & Bubble Factor 2,38',
    xpReward: 25,
  },
  {
    title: 'Expresso 3-Max (25bb) — SB vs BB Limp-Trap ou Raise ?',
    limit: 'Expresso',
    street: 'Préflop',
    heroPosition: 'SB',
    heroStackBb: 25,
    heroCards: ['9h', '7h'],
    boardCards: [],
    potBb: 1.5,
    villainPosition: 'BB',
    villainStackBb: 25,
    villainProfileName: 'Régulier Expresso (BB)',
    villainHud: { vpip: 58, pfr: 24, threeBet: 11, af: 2.6, hands: 240 },
    actionHistory: [
      'Expresso 3-Max (25bb effectifs, multiplicateur x3 Winner-Takes-All).',
      'BTN fold. Hero est en SB avec 9♥ 7♥.',
    ],
    question: 'Quelle est la fréquence de jeu recommandée en SB à 25bb avec 97s (vs 6-Max Cash) ?',
    options: [
      { label: 'A', text: 'Fold systématique car 97s est trop faible hors de position' },
      { label: 'B', text: 'Limp majoritaire (85% Limp / 15% Raise) protégé par des limp-traps' },
      { label: 'C', text: 'Open-Shove 25bb directement' },
      { label: 'D', text: 'Min-raise 100% pour éviter le rake' },
    ],
    correctIndex: 1,
    hint: 'Il n’y a aucun rake par coup en Expresso, et 25bb BvB privilégie un large éventail de limps jouables.',
    explanation:
      'En Expresso 25bb SB vs BB, le solveur/modèle V2 recommande un limp mergé large (~40 %) incluant 97s (85 % Limp / 15 % Raise), protégé par des limp-traps avec AA/KK afin d’empêcher la BB d’iso-relancer trop souvent.',
    keyConcept: 'Expresso 25bb SB Limp Mergé',
    xpReward: 20,
  },
  {
    title: 'PKO Mid-Stage — Calcul du Bounty Power (BB Couvrant)',
    limit: 'PKO',
    street: 'Préflop',
    heroPosition: 'BB',
    heroStackBb: 28,
    heroCards: ['Kc', 'Ts'],
    boardCards: [],
    potBb: 25.5,
    villainPosition: 'BTN',
    villainStackBb: 12,
    villainProfileName: 'Short Stack PKO (12bb, Prime 5bb)',
    villainHud: { vpip: 26, pfr: 22, threeBet: 8, af: 2.3, hands: 95 },
    actionHistory: [
      'Tournoi PKO 50/50. Hero en BB (28bb) couvre BTN (12bb).',
      'SB fold (0.5bb), BB ante 1bb. BTN shove 12bb.',
      'Hero doit ajouter 11bb dans un pot final de 25.5bb ; prime encaissable = 5bb en Bounty Power.',
    ],
    question: 'Comment la prime encaissable de 5bb modifie-t-elle l’équité requise pour payer ?',
    options: [
      { label: 'A', text: 'Elle passe de 43,1 % (ChipEV) à ~36,1 % (Remise de -7 pp)' },
      { label: 'B', text: 'Elle augmente à 52 % à cause de la pression ICM' },
      { label: 'C', text: 'Elle ne change rien tant que vous n’avez pas AK+' },
      { label: 'D', text: 'Il faut diviser la prime par le Regular Prize Pool uniquement' },
    ],
    correctIndex: 0,
    hint: 'Formule Bounty Adjusted : Call / (PotFinal + BountyChips) = 11 / (25.5 + 5).',
    explanation:
      'Lorsqu’Hero couvre Vilain, la prime encaissable (convertie via le Bounty Power proportionnel RPP+BPP) s’ajoute au dénominateur : 11 / 30,5 = 36,07 % au lieu de 43,14 % en ChipEV. KTo call largement profitable.',
    keyConcept: 'PKO Bounty Power & Equity Drop',
    xpReward: 25,
  },
  {
    title: 'Turn 2nd Barrel — Overpaire sur Board Connecté vs Check-Raise Passif',
    limit: 'NL5',
    street: 'Turn',
    heroPosition: 'UTG',
    heroStackBb: 100,
    heroCards: ['Ah', 'Ad'],
    boardCards: ['8s', '9s', '6c', '4h'],
    potBb: 32,
    villainPosition: 'BB',
    villainStackBb: 85,
    villainProfileName: 'Calling Station Passive (39/7/2, AF 0.9)',
    villainHud: { vpip: 39, pfr: 7, threeBet: 2, af: 0.9, hands: 310 },
    actionHistory: [
      'Hero (UTG) open 3bb avec A♥ A♦. BB paie.',
      'Flop (6.5bb) : 8♠ 9♠ 6♣. BB check, Hero C-Bet 4.5bb, BB paie.',
      'Turn (15.5bb) : 4♥. BB check, Hero mise 11bb, BB check-raise à 32bb.',
    ],
    question: 'Face au check-raise d’un profil très passif (AF 0.9) sur 8-9-6-4, que faites-vous ?',
    options: [
      { label: 'A', text: '3-bet All-In car Paire d’As est une overpaire max' },
      { label: 'B', text: 'Fold discipliné : un joueur à AF 0.9 a presque toujours deux paires, brelan ou quinte' },
      { label: 'C', text: 'Payer la Turn puis payer n’importe quelle River' },
      { label: 'D', text: 'Min-relancer pour obtenir une information' },
    ],
    correctIndex: 1,
    hint: 'Relisez l’Erreur #2 de Pe4nuts : ne tombez pas amoureux d’une simple paire face à une relance passive.',
    explanation:
      'Sur un board très connecté (connectivité 2) qui touche massivement la range de défense de BB (66, 88, 99, 89, 75s, T7s), un check-raise Turn d’un profil à AF 0.9 est quasiment 100 % en value qui bat une simple paire.',
    keyConcept: 'Réévaluer son Overpaire (Erreur #2)',
    xpReward: 25,
  },
  {
    title: 'River Thin Value — Extraire face à une Calling Station',
    limit: 'NL2',
    street: 'River',
    heroPosition: 'CO',
    heroStackBb: 100,
    heroCards: ['Kd', 'Js'],
    boardCards: ['Kc', '9h', '4s', '2d', '7c'],
    potBb: 22,
    villainPosition: 'BB',
    villainStackBb: 88,
    villainProfileName: 'Récréatif Collant (48/11/3, AF 0.8)',
    villainHud: { vpip: 48, pfr: 11, threeBet: 3, af: 0.8, hands: 220 },
    actionHistory: [
      'Hero (CO) open 3bb K♦ J♠, BB paie.',
      'Flop K♣ 9♥ 4♠ : BB check, Hero bet 3bb, BB call.',
      'Turn 2♦ : BB check, Hero bet 7bb, BB call.',
      'River 7♣ (pot 22bb) : BB check.',
    ],
    question: 'Quelle est la ligne la plus rentable à la River contre ce profil ?',
    options: [
      { label: 'A', text: 'Check back par peur qu’il ait KQ ou AK' },
      { label: 'B', text: 'Thin Value Bet ~1/2 pot (11bb) pour vous faire payer par 9x, K8–KT et 55–88' },
      { label: 'C', text: 'Overbet 200% pot pour faire folder un Roi meilleur' },
      { label: 'D', text: 'Min-bet 1bb' },
    ],
    correctIndex: 1,
    hint: 'Un joueur 48/11 qui a seulement check-call deux fois n’a presque jamais AK/KQ (il aurait 3-bet) mais paie très large ses secondes paires.',
    explanation:
      'En NL2/NL5 face à un profil passif, la thin value à 1/2 pot contre des mains comme 9x, K5–KT ou paires moyennes est l’une des plus grosses sources de bb/100. S’il relance cette river, vous pouvez folder sereinement.',
    keyConcept: 'Thin Value River vs Calling Station',
    xpReward: 20,
  },
];

export function generateOfflineScenario(opts: {
  streetFocus: string;
  limit: 'NL2' | 'NL5';
  level: number;
  recentTopics: string[];
}): CoachScenario {
  const streetPool =
    opts.streetFocus !== 'AUTO'
      ? OFFLINE_SCENARIO_BANK.filter(
          (s) => s.street.toLowerCase() === opts.streetFocus.toLowerCase()
        )
      : OFFLINE_SCENARIO_BANK;

  const basePool = streetPool.length > 0 ? streetPool : OFFLINE_SCENARIO_BANK;
  const freshPool = basePool.filter((s) => !opts.recentTopics.includes(s.keyConcept));
  const pool = freshPool.length > 0 ? freshPool : basePool;
  const chosen = pool[Math.floor(Math.random() * pool.length)];

  return {
    ...chosen,
    limit: chosen.limit === 'NL2' || chosen.limit === 'NL5' ? opts.limit : chosen.limit,
    title: `[Hors-Ligne V2] ${chosen.title}`,
  };
}

export function reviewHandOffline(
  rawText: string,
  limit: string,
  format: string
): HandReview {
  const trimmed = rawText.trim();
  let heroPos = 'CO / IP';
  let heroCards: string[] = [];
  let boardCards: string[] = [];
  let flopDesc = '';
  let sawFlop = false;
  let hasLimp = false;
  let parsedInfoNote = 'Analyse heuristique sur texte libre';

  try {
    const parsed = parseHand(trimmed);
    heroCards = parsed.heroCards ?? [];
    boardCards = parsed.board;
    sawFlop = boardCards.length >= 3;
    parsedInfoNote = `Parseur local (${parsed.site} #${parsed.handId}, BB=${parsed.bigBlind})`;

    if (parsed.hero) {
      const heroPreflop = parsed.actions.filter(
        (a) => a.street === 'preflop' && a.player === parsed.hero
      );
      const firstRaise = parsed.actions.find(
        (a) => a.street === 'preflop' && a.type === 'raise'
      );
      if (
        heroPreflop.some((a) => a.type === 'call') &&
        (!firstRaise ||
          parsed.actions.indexOf(heroPreflop[0]) < parsed.actions.indexOf(firstRaise))
      ) {
        hasLimp = true;
      }
      const seatIdx = parsed.seats.findIndex((s) => s.name === parsed.hero);
      if (seatIdx >= 0) {
        heroPos = `Siège ${parsed.seats[seatIdx].seat}`;
      }
    }
  } catch {
    const cardMatches = trimmed.match(/\b([AKQJT98765432][shdc])\b/g) ?? [];
    const uniq = [...new Set(cardMatches)];
    heroCards = uniq.slice(0, 2);
    boardCards = uniq.slice(2, 7);
    sawFlop = boardCards.length >= 3;
    if (/\blimp/i.test(trimmed)) hasLimp = true;
    const posMatch = trimmed.match(/\b(UTG|MP|CO|BTN|BU|SB|BB)\b/i);
    if (posMatch) heroPos = posMatch[1].toUpperCase();
  }

  let textureLabel = 'Non applicable (préflop)';
  if (boardCards.length >= 3) {
    const flop = [boardCards[0], boardCards[1], boardCards[2]] as [string, string, string];
    const tex = texture(flop);
    textureLabel = `Hauteur ${tex.high}, ${tex.suits}, ${tex.paired ? 'pairé' : 'non pairé'}, connectivité ${tex.connectivity}/2`;
    flopDesc = `Texture exacte calculée (${flop.join(' ')}) : ${textureLabel}. `;
  }

  const streets: StreetAnalysis[] = [
    {
      street: 'Préflop',
      status: hasLimp ? 'warning' : 'good',
      actionSummary: hasLimp ? 'Open Limp ou call passif détecté' : 'Initiative / sélection standard',
      analysis: hasLimp
        ? 'Un open-limp abandonne l’initiative, empêche de gagner le pot immédiatement et expose au squeeze en plus du rake postflop.'
        : `Spot ${format} (${limit}) analysé (${parsedInfoNote}). Veillez à adapter la range à la profondeur effective (40/100/200bb).`,
      optimalLine: hasLimp
        ? 'Relancer à 3bb (+1bb par limper) ou jeter la main selon votre position.'
        : 'Conserver des sizings standards (2.5–3bb IP, 3x IP / +1-2bb OOP en 3-Bet).',
    },
  ];

  if (sawFlop) {
    const highConn = /connectivité 2/.test(textureLabel);
    streets.push({
      street: 'Flop',
      status: 'good',
      actionSummary: textureLabel,
      analysis: `${flopDesc}${
        highConn
          ? 'Board très connecté : avantage fréquent pour le défenseur en blindes, privilégiez la sélectivité en bluff et protégez vos mains faites.'
          : 'Board plutôt sec : avantage de range du relanceur préflop, un petit C-Bet (~33% pot) suffit à générer de la fold equity.'
      }`,
      optimalLine: highConn
        ? 'C-Bet polarisé ou check back avec mains moyennes (Pot Control).'
        : 'C-Bet mergé ~33% pot sur texture sèche (Alpha ~25%).',
    });
  }

  const hasRaiseAlert = /check-raise|raise to|all-in|tapis/i.test(trimmed);
  if (boardCards.length >= 4 || hasRaiseAlert) {
    streets.push({
      street: boardCards.length >= 5 ? 'Turn & River' : 'Turn',
      status: hasRaiseAlert ? 'warning' : 'good',
      actionSummary: hasRaiseAlert
        ? 'Forte agression détectée (Raise / All-In)'
        : 'Gestion de la Turn / River',
      analysis: hasRaiseAlert
        ? 'Face à une relance Turn/River ou un tapis en micro-limites, la range adverse est très polarisée vers brelans, quintes ou couleurs (surtout contre un profil passif AF < 1.5).'
        : 'Adaptez votre taille de mise à votre avantage de nuts et au SPR restant ; ne value-bettez thin que contre les Calling Stations.',
      optimalLine: hasRaiseAlert
        ? 'Réévaluer objectivement une simple Top Paire / Overpaire avant de payer tout son tapis.'
        : 'Prévoir le plan d’action Turn et River avant d’envoyer le 2nd barrel.',
    });
  }

  const score = hasLimp ? 6 : hasRaiseAlert ? 7 : 8;

  return {
    score,
    verdictLabel: 'Moteur Local Déterministe (Hors-Ligne)',
    summary: `Analyse locale effectuée sans serveur (${parsedInfoNote}). ${flopDesc}Vérifiez les écarts face à votre range de référence et vos cotes du pot (MDF / Alpha).`,
    detectedSpot: {
      limit,
      heroPosition: heroPos,
      heroCards,
      boardCards,
      villainProfile: format,
    },
    streets,
    strengths: [
      heroCards.length === 2
        ? `Main Hero identifiée (${heroCards.join(' ')})`
        : 'Contexte analysé hors-ligne sans blocage réseau',
      sawFlop
        ? `Texture Flop mesurée automatiquement : ${textureLabel}`
        : 'Analyse préflop instantanée disponible 100% hors-ligne',
    ],
    mistakes: hasLimp
      ? ['Open-limp ou entrée passive détectée préflop (à remplacer par Raise or Fold).']
      : hasRaiseAlert
        ? ['Attention à ne pas surjouer une simple paire face à une grosse relance Turn/River en micro-limites.']
        : ['Aucun leak critique flagrant détecté par les règles locales ; comparez avec la matrice 13×13.'],
    keyTakeaway:
      'Moteur local V2 : les calculs de texture, blindes et règles Kill Tilt sont vérifiés déterministement hors-ligne. Connectez Gemini (en ligne) pour un commentaire pédagogique rédigé supplémentaire.',
  };
}
