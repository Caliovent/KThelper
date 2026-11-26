export type SuiteTabId = 'ranges' | 'icm' | 'hud' | 'bankroll' | 'gto' | 'arena' | 'coach';
export type RangeAppMode = 'explore' | 'edit' | 'quiz' | 'games';

export interface TourStep {
  id: string;
  title: string;
  suiteTab: SuiteTabId;
  appMode?: RangeAppMode;
  targetSelector: string;
  summary: string;
  proTip: string;
  actionLabel?: string;
  actionTriggerSelector?: string;
}

export interface InteractiveTour {
  id: string;
  title: string;
  badge: string;
  duration: string;
  audience: string;
  description: string;
  steps: TourStep[];
}

export interface DocModuleGuide {
  id: string;
  title: string;
  badge: string;
  suiteTab?: SuiteTabId;
  actionTargetId?: string;
  summary: string;
  whenToUse: string;
  keyFeatures: string[];
  proTips: string[];
  keywords: string[];
}

export interface GlossaryEntry {
  term: string;
  category: 'Maths & EV' | 'Tournoi & ICM' | 'Postflop & Ranges' | 'Arène & Progression';
  formula?: string;
  definition: string;
  example: string;
}

export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
  keywords: string[];
}

export interface ProfileRoadmap {
  id: string;
  title: string;
  subtitle: string;
  steps: { label: string; detail: string; suiteTab: SuiteTabId; appMode?: RangeAppMode }[];
}

export const INTERACTIVE_TOURS: InteractiveTour[] = [
  {
    id: 'suite-overview',
    title: '🚀 Tour complet de la Suite',
    badge: 'Recommandé pour démarrer',
    duration: '5 min',
    audience: 'Tous joueurs',
    description:
      'Découvrez les 6 piliers de la suite en situation réelle : ranges préflop, mini-jeux anti-leaks, labo ICM/PKO, bankroll, solveur GTO et Arène 1v1.',
    steps: [
      {
        id: 'overview-ranges',
        title: '1. La Matrice 13×13 & le Catalogue Multi-Formats',
        suiteTab: 'ranges',
        appMode: 'explore',
        targetSelector: '#hand-matrix',
        summary:
          'Visualisez vos fréquences d’Open, 3-Bet, Call et 4-Bet sur toute la grille 13×13. Basculez en 1 clic entre les tables Cash NL2, MTT, Expresso, le mode GTO Simplifié 25 % et le Calque Bloqueurs.',
        proTip:
          'Ne retenez pas 169 cases une par une : mémorisez la frontière de chaque famille (Paires, Broadways, As suités, Connecteurs).',
      },
      {
        id: 'overview-games',
        title: '2. Drills & Mini-Jeux Pédagogiques',
        suiteTab: 'ranges',
        appMode: 'games',
        targetSelector: '#btn-mode-games',
        summary:
          'Passez directement de la théorie au réflexe de table : Daily Warm-up de 5 minutes, Défi Recall/Blitz chronométré, Chunking visuel et Répétition Espacée sur vos vrais leaks.',
        proTip:
          'Une erreur répétée remonte automatiquement en priorité pour être travaillée jusqu’à validation complète à froid.',
      },
      {
        id: 'overview-icm',
        title: '3. Labo ICM, Bulle & Bounties PKO',
        suiteTab: 'icm',
        targetSelector: '#v2-icm-bf',
        summary:
          'Mesurez instantanément la pression financière d’une bulle ou d’une table finale grâce au modèle Malmuth-Harville : Bubble Factor, Risk Premium et valeur réelle d’un Bounty PKO/Mystery.',
        proTip:
          'À la bulle d’un 4-Max, votre Bubble Factor dépasse souvent 2,3 : vous avez besoin de beaucoup plus d’équité pour payer un tapis que pour mettre all-in.',
        actionLabel: 'Tester le scénario Bulle 4-Max',
        actionTriggerSelector: '#suite-tab-icm button[onclick*="bubble"]',
      },
      {
        id: 'overview-bankroll',
        title: '4. Tableur Bankroll & Import Winamax / PokerStars',
        suiteTab: 'bankroll',
        targetSelector: '#suite-tab-bankroll',
        summary:
          'Suivez votre courbe de gains, votre winrate en bb/100 ou ChipEV et importez vos fichiers .txt Winamax/PokerStars hors-ligne pour détecter automatiquement vos fuites d’EV.',
        proTip:
          'Regroupez vos sessions par format (Cash, MTT, Expresso) pour savoir exactement où vous dégagez votre meilleur ROI ou bb/100.',
      },
      {
        id: 'overview-gto',
        title: '5. Solveur Postflop, MDF & Équité Monte-Carlo',
        suiteTab: 'gto',
        targetSelector: '#suite-tab-gto',
        summary:
          'Estimez votre équité main vs range en temps réel (Web Worker fluide sans figer l’écran) et vérifiez les seuils MDF / Alpha face aux sizings adverses au flop, turn et river.',
        proTip:
          'Face à une mise 100 % pot river, votre Minimum Defense Frequency tombe à 50 % : inutile de hero-call vos pires bluff-catchers.',
      },
      {
        id: 'overview-arena',
        title: '6. Arène Poker : Duels, Classé & Clubs',
        suiteTab: 'arena',
        targetSelector: '#suite-tab-arena',
        summary:
          'Affrontez d’autres grinders sans variance de tirage (Duel Libre, Arène Classée, Heads-Up Live, Peins ta Range, Sprint 3-Max, Table des Boss et Hand Reviews de Club anonymisées).',
        proTip:
          'Activez l’engagement hors-table (rooms fermées) avant chaque duel : ici seule votre précision EV & ICM compte.',
      },
    ],
  },
  {
    id: 'arena-mastery',
    title: '⚔️ Maîtriser l’Arène Poker & le score PD',
    badge: 'Multijoueur & Classé',
    duration: '3 min',
    audience: 'Compétiteurs',
    description:
      'Comprenez le système de Points de Déviation (PD), la différence entre Duel Libre et Arène Classée, et comment progresser en Club sans variance.',
    steps: [
      {
        id: 'arena-pd',
        title: '1. Zéro variance : le score en Points de Déviation (PD)',
        suiteTab: 'arena',
        targetSelector: '#suite-tab-arena',
        summary:
          'Les deux joueurs jouent exactement la même série de spots. Chaque décision est mesurée en Points de Déviation (PD) : 0 PD = réponse parfaite, plus le score est bas, plus votre EV est précise.',
        proTip:
          'Vous pouvez lancer un échauffement de 6 spots ou partager un Défi Fantôme avec un ami sans impacter votre classement officiel.',
      },
      {
        id: 'arena-ranked',
        title: '2. Arène Classée, Heads-Up Live & Défi du Jour',
        suiteTab: 'arena',
        targetSelector: '#suite-tab-arena',
        summary:
          'Créez votre Profil Classé gratuit pour affronter des adversaires sur le même tirage officiel, en différé (Duel Fantôme) ou en direct (Heads-Up Live 15 spots). Le Défi du Jour révèle sa correction à minuit UTC.',
        proTip:
          'En mode Classé, toutes les corrections sont masquées jusqu’à la fin du duel et les outils de calcul restent strictement verrouillés.',
      },
      {
        id: 'arena-divisions',
        title: '3. Divisions & Confirmation à Froid (+7 jours)',
        suiteTab: 'arena',
        targetSelector: '#suite-tab-arena',
        summary:
          'Votre division dépend de deux critères : votre Score de précision en duel ET votre Score de Maîtrise M confirmé à froid 7 jours plus tard en révision solo.',
        proTip:
          'La double exigence empêche le bachotage à court terme : un concept n’est validé que si vous le maîtrisez encore une semaine après.',
      },
      {
        id: 'arena-club',
        title: '4. Table des Boss, Clubs & Hand Reviews ≥ 24h',
        suiteTab: 'arena',
        targetSelector: '#suite-tab-arena',
        summary:
          'Testez-vous sur des mains complètes Préflop → River contre des Boss typés (Nit, Calling Station, LAG, Tyran ICM), formez un Club (4–20 joueurs) et partagez vos mains jouées depuis plus de 24 h.',
        proTip:
          'Sur les Hand Reviews du Club, pseudos, numéros de main et horaires exacts sont automatiquement masqués et les votes restent cachés tant que vous n’avez pas voté.',
      },
    ],
  },
  {
    id: 'icm-pko-mastery',
    title: '🏆 Dominer l’ICM, la Bulle & les Bounties PKO',
    badge: 'MTT & Expresso',
    duration: '3 min',
    audience: 'Joueurs MTT / Spin',
    description:
      'Apprenez à lire le Bubble Factor, adapter vos ranges de call à la bulle et convertir un bounty progressif ou Mystery en jetons réels.',
    steps: [
      {
        id: 'icm-model',
        title: '1. Pourquoi les jetons perdent de la valeur en MTT',
        suiteTab: 'icm',
        targetSelector: '#suite-tab-icm',
        summary:
          'En tournoi, doubler son tapis ne double jamais son espérance de gain ($EV). Le labo ICM calcule votre équité financière exacte à partir des tapis et des paliers de paiement.',
        proTip:
          'Comparez toujours votre risque d’élimination à la valeur des jetons gagnés : un tapis moyen doit éviter les confrontations marginales face au chip leader.',
      },
      {
        id: 'icm-bf',
        title: '2. Lire le Bubble Factor et le Risk Premium',
        suiteTab: 'icm',
        targetSelector: '#v2-icm-bf',
        summary:
          'Le Bubble Factor (BF) mesure combien un coup perdu vous coûte plus cher en $EV qu’un coup gagné. Plus le BF monte, plus votre Risk Premium (équité supplémentaire requise pour payer) explose.',
        proTip:
          'Cliquez sur le scénario Bulle 4-Max (40/25/20/15 bb) : le Bubble Factor grimpe à 2.377, obligeant un resserrement massif en défense.',
        actionLabel: 'Appliquer le scénario Bulle 4-Max',
        actionTriggerSelector: '#suite-tab-icm button[onclick*="bubble"]',
      },
      {
        id: 'icm-pko',
        title: '3. PKO & Mystery Bounty : ajuster la cote de call',
        suiteTab: 'icm',
        targetSelector: '#suite-tab-icm',
        summary:
          'Couvrir un joueur avec une prime réduit votre équité requise pour payer un all-in. Renseignez le bounty adverse et le tapis moyen de départ pour obtenir la cote exacte ajustée.',
        proTip:
          'Ne surestimez pas un petit bounty de début de tournoi : sa vraie valeur vient des jetons qu’il représente en % du stack moyen.',
      },
    ],
  },
  {
    id: 'daily-routine',
    title: '🎯 Routine Grinder 15 min / jour',
    badge: 'Méthode Kill Tilt',
    duration: '2 min',
    audience: 'Progression régulière',
    description:
      'La routine recommandée avant d’ouvrir vos tables pour échauffer votre lecture EV, corriger vos leaks préflop et débriefer une main.',
    steps: [
      {
        id: 'routine-warmup',
        title: 'Minutes 1–5 : Échauffement Cotes, Combos & ICM',
        suiteTab: 'arena',
        targetSelector: '#suite-tab-arena',
        summary:
          'Lancez un Warm-up du Jour ou un Sprint Expresso 3-Max avant de lancer votre session afin de calibrer votre calcul mental (outs, bloqueurs, Risk Premium) à froid.',
        proTip:
          'Un cerveau froid prend de meilleures décisions dès la première orbit : évitez d’utiliser les 15 premières minutes de grind comme échauffement payant.',
      },
      {
        id: 'routine-ranges',
        title: 'Minutes 6–10 : Mini-Jeux Ranges sur vos spots faibles',
        suiteTab: 'ranges',
        appMode: 'games',
        targetSelector: '#btn-mode-games',
        summary:
          'Enchaînez un round de Blitz ou d’Open vs 3-Bet pour ancrer vos fréquences sur les positions où vous doutez le plus (SB vs BB, CO vs BTN, Défense BB).',
        proTip:
          'Activez l’affichage GTO Simplifié 25 % pour retenir facilement les mains mixtes sans paralyser votre prise de décision.',
      },
      {
        id: 'routine-coach',
        title: 'Minutes 11–15 : Review d’une main douteuse avec le Coach IA',
        suiteTab: 'coach',
        targetSelector: '#suite-tab-coach',
        summary:
          'Collez une main jouée la veille dans le Coach IA (ou générez un scénario ciblé sur vos erreurs récentes) pour valider votre ligne Flop/Turn/River avant de jouer.',
        proTip:
          'Même sans connexion ou sans clé Gemini, le mode hors-ligne analyse automatiquement votre hand history et vous donne les repères EV essentiels.',
      },
    ],
  },
];

export const PROFILE_ROADMAPS: ProfileRoadmap[] = [
  {
    id: 'cash',
    title: 'Cash Game 5/6-Max (NL2 – NL50)',
    subtitle: 'Solidité préflop, défense de BB et sizing postflop',
    steps: [
      {
        label: '1. Calibrer les Open & 3-Bet',
        detail: 'Maîtrisez les grilles 13×13 et les sizings (3bb + limpers, 3-Bet IP/OOP).',
        suiteTab: 'ranges',
        appMode: 'explore',
      },
      {
        label: '2. Travailler textures Flop & MDF',
        detail: 'Utilisez Lecture de Board et le Solveur Postflop (MDF / Alpha / SPR).',
        suiteTab: 'gto',
      },
      {
        label: '3. Suivre le bb/100 & vos leaks',
        detail: 'Importez vos mains .txt Winamax / PokerStars dans le Tableur Bankroll.',
        suiteTab: 'bankroll',
      },
    ],
  },
  {
    id: 'mtt',
    title: 'Tournois MTT & PKO / Mystery',
    subtitle: 'Survie ICM, bulles, tables finales et chasse aux primes',
    steps: [
      {
        label: '1. Quantifier le Bubble Factor',
        detail: 'Testez vos spots 15–40 bb sous pression ICM dans le Labo ICM & PKO.',
        suiteTab: 'icm',
      },
      {
        label: '2. Ajuster vos calls Bounty',
        detail: 'Convertissez la prime adverse en % d’équité gagnée quand vous couvrez Vilain.',
        suiteTab: 'icm',
      },
      {
        label: '3. Affronter le Tyran de Bulle',
        detail: 'Jouez la Table des Boss ICM multi-streets dans l’Arène Poker.',
        suiteTab: 'arena',
      },
    ],
  },
  {
    id: 'expresso',
    title: 'Expresso / Spin & Go 3-Max',
    subtitle: 'Décisions rapides < 25 bb, ChipEV et Jackpots',
    steps: [
      {
        label: '1. Sprint Push/Fold 3-Max',
        detail: 'Entraînez vos réflexes à 4 s/spot avec raccourcis R / C / F dans l’Arène.',
        suiteTab: 'arena',
      },
      {
        label: '2. Ranges 3-Max & BB vs SB',
        detail: 'Explorez le catalogue V2 Expresso 25bb/15bb/10bb dans Ranges & Quiz.',
        suiteTab: 'ranges',
        appMode: 'explore',
      },
      {
        label: '3. Analyser le ChipEV / partie',
        detail: 'Suivez votre EV ajustée et votre ROI par multiplicateur en Bankroll.',
        suiteTab: 'bankroll',
      },
    ],
  },
];

export const MODULE_GUIDES: DocModuleGuide[] = [
  {
    id: 'mod-ranges',
    title: '📊 Ranges & Quiz (Matrice 13×13 & Mini-Jeux)',
    badge: 'Préflop • Cash / MTT / Expresso',
    suiteTab: 'ranges',
    summary:
      'Votre QG préflop : explorez les matrices 13×13 pondérées, éditez vos propres ranges, testez-vous en Quiz XP et corrigez vos leaks avec la répétition espacée.',
    whenToUse:
      'Avant une session pour réviser une position, ou après avoir douté sur un open/3-Bet/squeeze en review.',
    keyFeatures: [
      '4 sous-modes : Explorer, Éditeur personnalisé, Quiz XP et Jeux Ranges (Blitz, Recall, Warm-up).',
      'Catalogue Multi-Formats V2 (Cash 6-Max, MTT, Expresso) avec badge de provenance.',
      'Mode GTO Simplifié 25 % (arrondi lisible) et Calque Bloqueurs (impact sur AA/KK/AK).',
    ],
    proTips: [
      'En micro-limites, utilisez le mode Contraste entre CO et BTN pour repérer immédiatement les 15 combos marginaux qui changent.',
    ],
    keywords: ['range', '13x13', 'preflop', 'open', '3-bet', '4-bet', 'squeeze', 'quiz', 'bloqueur', 'gto'],
  },
  {
    id: 'mod-icm',
    title: '🏆 ICM & PKO Lab (Bulle, TF & Bounties)',
    badge: 'Tournois MTT • PKO • Mystery',
    suiteTab: 'icm',
    summary:
      'Calculateur exact Malmuth-Harville pour comprendre combien vos jetons valent réellement en argent selon les paliers de gain et les primes en jeu.',
    whenToUse:
      'Dès l’approche de la bulle, en demi-finale/table finale ou dès qu’un short stack part all-in avec une grosse prime sur la tête.',
    keyFeatures: [
      'Calcul du Bubble Factor (BF) et du Risk Premium pour chaque duel de stacks.',
      'Presets rapides dont Bulle 4-Max (BF = 2.377) et Table Finale.',
      'Module PKO & Mystery Bounty : ajustement exact de l’équité requise pour payer.',
    ],
    proTips: [
      'Plus vous couvrez la table en chip leader, plus vous pouvez mettre de pression sur les stacks moyens paralysés par un Risk Premium élevé.',
    ],
    keywords: ['icm', 'bubble factor', 'risk premium', 'pko', 'bounty', 'mystery', 'bulle', 'mtt', 'table finale'],
  },
  {
    id: 'mod-hud',
    title: '🎯 HUD, Outs & Cotes',
    badge: 'Profilage & Calcul Mental',
    suiteTab: 'hud',
    summary:
      'Décodez instantanément les profils adverses à partir de leurs statistiques HUD (VPIP, PFR, 3-Bet, AF, Fold to C-Bet) et maîtrisez la règle ×2 / ×4.',
    whenToUse:
      'Pour apprendre à classer rapidement un adversaire (Nit, CS, Reg TAG, LAG) et automatiser vos calculs d’équité et de cotes de pot.',
    keyFeatures: [
      'Diagnostic automatique du profil adverse et contre-stratégie exploitative claire.',
      'Calculateur d’Outs, cotes du pot (en % et en ratio) et cotes implicites.',
      'Repères prêts à l’emploi pour vos combos de tirages (OESD, Flush Draw, Combo Draw).',
    ],
    proTips: [
      'Ne regardez pas le 3-Bet sur 25 mains : attendez au moins 100+ mains avant de tirer une conclusion sur une stat rare.',
    ],
    keywords: ['hud', 'vpip', 'pfr', '3bet', 'outs', 'cote', 'pot odds', 'nit', 'fish', 'lag'],
  },
  {
    id: 'mod-bankroll',
    title: '📈 Tableur Bankroll & Import Hand Histories',
    badge: 'Winamax & PokerStars (.txt)',
    suiteTab: 'bankroll',
    summary:
      'Suivez votre bankroll en temps réel, calculez votre gestion de bankroll (BRM), et importez vos historiques bruts Winamax/PokerStars localement sans rien envoyer en ligne.',
    whenToUse:
      'En fin de session pour noter vos résultats, ou pour analyser un fichier .txt de mains et repérer vos plus grosses pertes évitables.',
    keyFeatures: [
      'Graphique d’évolution net (€), bb/100 Cash et ChipEV Expresso.',
      'Parseur local 100 % navigateur pour fichiers Winamax et PokerStars (.txt).',
      'Détection automatique des spots coûteux à envoyer en révision.',
    ],
    proTips: [
      'Séparez toujours les formats : un bon ROI en MTT peut masquer une fuite importante en Expresso ou en NL10.',
    ],
    keywords: ['bankroll', 'tableur', 'winamax', 'pokerstars', 'import', 'bb/100', 'cev', 'chipev', 'session'],
  },
  {
    id: 'mod-gto',
    title: '🧠 Solver GTO & Équité Monte-Carlo',
    badge: 'Postflop • 7 cartes',
    suiteTab: 'gto',
    summary:
      'Simulateur d’équité 7 cartes rapide (calculé en tâche de fond) et labo postflop pour calculer MDF, Alpha, SPR et géométrie de mise Flop/Turn/River.',
    whenToUse:
      'En review post-session pour vérifier si votre main avait assez d’équité contre une range précise ou si votre bluff devait passer assez souvent.',
    keyFeatures: [
      'Calculateur d’équité Monte-Carlo 7 cartes Main vs Range sans bloquer l’interface.',
      'Moteur Postflop : MDF (Minimum Defense Frequency), Alpha (Fold Equity nécessaire) et SPR.',
      'Analyse des textures de board (sec, connecté, bicolore, monotone) et avantage de nuts.',
    ],
    proTips: [
      'Vérifiez d’abord votre Alpha (Mise / (Pot + Mise)) avant de décider un 2-barrel ou 3-barrel bluff.',
    ],
    keywords: ['solver', 'gto', 'equite', 'monte-carlo', 'mdf', 'alpha', 'spr', 'postflop', 'board', 'cbet'],
  },
  {
    id: 'mod-arena',
    title: '⚔️ Arène Poker (Duels, Classé, Drills & Clubs)',
    badge: 'Zéro variance • Hors-table',
    suiteTab: 'arena',
    summary:
      'Affrontez d’autres joueurs ou des Boss sur exactement les mêmes mains : Duel Libre, Arène Classée, Heads-Up Live, Peins ta Range, Sprint 3-Max, Lecture de Board, Hand Reading et Clubs.',
    whenToUse:
      'Uniquement lorsque toutes vos rooms de poker sont fermées, pour vous mesurer sur des décisions pures et détecter vos biais sous chrono.',
    keyFeatures: [
      'Duel Libre & Défi Fantôme à partager par lien/fichier sans contrainte.',
      'Arène Classée, Heads-Up Live en direct et Défi du Jour Officiel (résultats à minuit UTC).',
      'Table des Boss multi-streets, Clubs d’entraide (4–20 joueurs) et Hand Reviews anonymisées (≥ 24h).',
    ],
    proTips: [
      'Utilisez les marqueurs de confiance (« Sûr de mon calcul » vs « Hésitant ») : une erreur faite en étant « Sûr » est votre leak n°1 à corriger.',
    ],
    keywords: ['arene', 'duel', 'fantome', 'classe', 'heads-up', 'live', 'boss', 'club', 'ecurie', 'hand review', 'peins ta range', 'sprint'],
  },
  {
    id: 'mod-coach',
    title: '🤖 Coach IA Poker (Scénarios & Hand Review)',
    badge: 'IA + Secours 100 % hors-ligne',
    suiteTab: 'coach',
    summary:
      'Générez des exercices adaptés à vos points faibles ou obtenez une critique rue par rue (Préflop, Flop, Turn, River) de vos mains jouées.',
    whenToUse:
      'Lorsque vous hésitez sur une line postflop ou voulez un plan de révision ciblé sur vos erreurs récentes.',
    keyFeatures: [
      'Générateur de scénarios interactifs relié à votre historique d’erreurs.',
      'Analyse complète d’une main Winamax/PokerStars rue par rue.',
      'Bascule automatique vers un moteur de règles déterministe si vous êtes hors-ligne.',
    ],
    proTips: [
      'Donnez le profil de Vilain (ex : « récréatif passif » ou « reg aggro ») avec votre main pour obtenir une exploitation réaliste.',
    ],
    keywords: ['coach', 'ia', 'gemini', 'scenario', 'review', 'analyse', 'hors-ligne'],
  },
  {
    id: 'mod-videos-backup',
    title: '📺 Parcours 30 Vidéos & 💾 Sauvegarde JSON',
    badge: 'Pédagogie & Portabilité',
    summary:
      'Suivez le cursus progressif des 30 vidéos Kill Tilt (statut visionné sauvegardé) et exportez/importez toute votre progression en un seul fichier JSON.',
    whenToUse:
      'Pour suivre un fil conducteur structuré ou sauvegarder vos ranges, sessions bankroll, vidéos vues et scores Arène avant de changer d’appareil.',
    keyFeatures: [
      'Progression 0/30 sauvegardée localement avec filtres par thème.',
      'Bouton 💾 JSON V2 dans le menu du haut : export complet et réimport sans perte.',
      'Compatibilité totale avec toutes vos anciennes données V1.',
    ],
    proTips: [
      'Faites un export JSON une fois par semaine ou avant de vider le cache de votre navigateur.',
    ],
    keywords: ['video', 'kill tilt', 'sauvegarde', 'json', 'export', 'import', 'backup'],
  },
];

export const GLOSSARY_ENTRIES: GlossaryEntry[] = [
  {
    term: 'Points de Déviation (PD)',
    category: 'Arène & Progression',
    formula: '1 000 PD = 1 bb d’EV perdue (ou 1 % de Prize Pool en ICM)',
    definition:
      'Unité de mesure de précision dans l’Arène Poker. 0 PD signifie la décision exacte optimale ; plus votre PD total est bas, meilleur est votre jeu.',
    example: 'Un écart de 25 PD représente 0,025 bb — quasiment négligeable. Au-dessus de 100 PD, c’est un Turning Point majeur du duel.',
  },
  {
    term: 'MDF (Minimum Defense Frequency)',
    category: 'Postflop & Ranges',
    formula: 'MDF = Pot / (Pot + Mise adverse)',
    definition:
      'Part minimale de votre range que vous devez continuer (call ou raise) face à une mise pour empêcher Vilain de bluffer avec profit immédiat avec 100 % de ses airs.',
    example: 'Face à un C-Bet à 33 % du pot : MDF = 1 / (1 + 0,33) = 75 %. Face à un pot-bet (100 %) : MDF = 50 %.',
  },
  {
    term: 'Alpha (Seuil de Fold Equity)',
    category: 'Maths & EV',
    formula: 'Alpha = Mise / (Pot + Mise)',
    definition:
      'Fréquence à laquelle votre adversaire doit se coucher pour qu’un bluff pur (0 % d’équité) soit immédiatement rentable.',
    example: 'En misant 50 % du pot en bluff : Alpha = 0,5 / 1,5 = 33,3 %. S’il fold plus d’1 fois sur 3, le bluff gagne de l’argent.',
  },
  {
    term: 'SPR (Stack-to-Pot Ratio)',
    category: 'Postflop & Ranges',
    formula: 'SPR = Tapis effectif au Flop / Pot au Flop',
    definition:
      'Ratio entre le plus petit tapis restant et la taille du pot au flop. Détermine la valeur des mains faites (Top Pair vs Tirages / Set Mining).',
    example: 'En pot 3-Bet (SPR ≈ 3 à 4), Top Pair Top Kicker se joue souvent pour tout le tapis. À SPR > 10, il faut souvent deux paires+ pour partir à tapis.',
  },
  {
    term: 'Bubble Factor (BF)',
    category: 'Tournoi & ICM',
    formula: 'BF = |Δ$EV(perte)| / |Δ$EV(gain)|',
    definition:
      'Ratio ICM mesurant de combien perdre un all-in coûte plus cher en argent réel que de le gagner. Plus il est élevé, plus vous devez resserrer vos calls.',
    example: 'En Cash Game BF = 1,0. À la bulle d’un 4-Max (40/25/20/15 bb), un BF de 2,38 impose environ 69 % d’équité pour payer un shove de 25 bb.',
  },
  {
    term: 'Risk Premium (ICM)',
    category: 'Tournoi & ICM',
    formula: 'Risk Premium = Équité requise ICM − Équité requise ChipEV',
    definition:
      'Pourcentage d’équité supplémentaire exigé par l’ICM pour justifier un call all-in comparé à une partie en jetons purs (ChipEV).',
    example: 'Si la cote du pot ChipEV demande 48 % mais que l’ICM exige 60 %, votre Risk Premium est de +12 points.',
  },
  {
    term: 'Bounty Equity (PKO / Mystery)',
    category: 'Tournoi & ICM',
    formula: 'Valeur jetons ≈ Prime × Ratio jetons de départ / Bounty de départ',
    definition:
      'Bonus en équité obtenu lorsque votre tapis couvre l’adversaire et vous permet de capturer directement sa prime en cas d’élimination.',
    example: 'Un joueur très short avec un gros bounty peut rendre un call rentable avec 32–35 % d’équité au lieu de 45 %.',
  },
  {
    term: 'Combos & Bloqueurs (6 / 4 / 12)',
    category: 'Postflop & Ranges',
    formula: 'Paire = 6 combos • Suited = 4 combos • Offsuit = 12 combos',
    definition:
      'Nombre de combinaisons exactes d’une main. Détenir un As (As5s) supprime 25 % des combos de AA et AK possibles chez Vilain (effet bloqueur).',
    example: 'Une main offsuit (AKo) pèse 3 fois plus lourd dans une range qu’une main suitée (AKs) : 12 combos contre 4.',
  },
  {
    term: 'Règle ×2 / ×4 (Outs → Équité)',
    category: 'Maths & EV',
    formula: 'Turn seule ≈ Outs × 2 % • Turn + River ≈ Outs × 4 %',
    definition:
      'Approximation rapide à la table pour estimer vos chances de toucher votre tirage.',
    example: 'Avec 9 outs à couleur au flop : 9 × 4 = ~36 % d’équité sur 2 cartes (18 % sur la turn seule).',
  },
  {
    term: 'Score de Maîtrise M & Confirmation +7j',
    category: 'Arène & Progression',
    definition:
      'Les réussites obtenues en duel restent provisoires jusqu’à leur validation en révision solo à froid 7 jours plus tard. Votre Division Classée exige Score + Maîtrise M.',
    example: 'Pour débloquer Master en Arène Classée, il faut à la fois un Score ≥ 1700 ET une Maîtrise à froid M ≥ 85 %.',
  },
];

export const FAQ_ENTRIES: FaqEntry[] = [
  {
    id: 'faq-rta',
    question: 'Pourquoi l’app bloque-t-elle les calculateurs pendant un duel et demande de fermer mes rooms ?',
    answer:
      'Les rooms comme Winamax et PokerStars interdisent strictement l’usage d’aides en temps réel (RTA) pendant que vous jouez de l’argent réel. Kill Tilt Poker Suite est un outil d’étude hors-table : il vous demande d’attester que vos clients de poker sont fermés et verrouille automatiquement matrices, ICM, solveur et Coach IA pendant chaque duel (mesure de réduction du risque, sans garantie réglementaire automatique).',
    keywords: ['rta', 'winamax', 'pokerstars', 'interdit', 'verrou', 'room', 'securite'],
  },
  {
    id: 'faq-free-vs-ranked',
    question: 'Quelle différence entre Duel Libre, Défis Rapides et Arène Classée ?',
    answer:
      '• Duel Libre : 100 % hors-ligne sur votre appareil, idéal pour vous échauffer ou envoyer un Défi Fantôme à un ami sans impact sur votre classement.\n• Défis Rapides : défis courts à partager avec un classement amical communautaire (distinct du classement officiel).\n• Arène Classée & Heads-Up Live : matchs officiels arbitrés sur tirage identique avec score de précision, Divisions et Défi du Jour.',
    keywords: ['duel libre', 'defis rapides', 'classe', 'difference', 'rang', 'division'],
  },
  {
    id: 'faq-zero-variance',
    question: 'Pourquoi dit-on qu’il n’y a « aucune variance de tirage » dans l’Arène ?',
    answer:
      'Contrairement à une table classique où un joueur peut gagner un flip avec chance, les deux adversaires jouent exactement la même séquence de spots et sont notés sur l’EV mathématique pure de chaque décision (Points de Déviation), jamais sur un runout chanceux.',
    keywords: ['variance', 'tirage', 'chance', 'pd', 'equite'],
  },
  {
    id: 'faq-hand-privacy',
    question: 'Pourquoi les Hand Reviews de Club bloquent les mains de moins de 24 h ?',
    answer:
      'Pour protéger tous les joueurs et éviter toute analyse à chaud sur des adversaires actuellement aux tables, seules les mains jouées depuis au moins 24 heures sont acceptées. Tous les pseudos sont remplacés par leur position (BTN, SB, BB…), les montants sont arrondis à 0,5 bb et l’horodatage exact n’est pas conservé sur le serveur.',
    keywords: ['24h', 'club', 'ecurie', 'hand review', 'anonymisation', 'pseudo', 'prive'],
  },
  {
    id: 'faq-offline',
    question: 'L’application fonctionne-t-elle hors-ligne sans connexion Internet ?',
    answer:
      'Oui. Les matrices 13×13, les mini-jeux, le labo ICM/PKO, le décodeur HUD, le tableur Bankroll, l’import .txt Winamax/PokerStars, le solveur Monte-Carlo, l’Arène Duel Libre, Peins ta Range, Sprint 3-Max et même le mode secours du Coach IA fonctionnent 100 % sans réseau.',
    keywords: ['hors-ligne', 'offline', 'internet', 'connexion', 'reseau'],
  },
  {
    id: 'faq-shortcuts',
    question: 'Quels sont les raccourcis clavier utiles pour jouer plus vite ?',
    answer:
      '• Dans les spots d’estimation (%) : tapez votre valeur puis appuyez sur Entrée pour valider instantanément.\n• Dans Sprint Expresso & 3-Max (rafale 4 s) : R ou C = Push / Call, F = Fold.\n• Touche Échap (Esc) : ferme les fenêtres de documentation ou vidéos.',
    keywords: ['raccourci', 'clavier', 'entree', 'sprint', 'rapide'],
  },
  {
    id: 'faq-backup',
    question: 'Comment ne pas perdre mes ranges, sessions Bankroll et vidéos vues ?',
    answer:
      'Tout est enregistré automatiquement dans votre navigateur, mais il est conseillé d’utiliser régulièrement le bouton « 💾 JSON V2 » en haut à droite pour exporter une sauvegarde complète (.json) que vous pourrez réimporter sur n’importe quel ordinateur.',
    keywords: ['sauvegarde', 'json', 'export', 'import', 'perdre', 'donnees'],
  },
];
