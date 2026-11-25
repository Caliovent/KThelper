# AGENTS.md — Constitution Technique de Pro Poker Suite V2

Ce document régit toutes les interventions agentiques et humaines sur le dépôt **KThelper / Pro Poker Suite V2**. Toute nouvelle fonctionnalité ou refactorisation doit respecter ces règles sans exception.

---

## 1. Vision Produit & Philosophie Pédagogique (« Anti-Boîte-à-Outils Froide »)

Pro Poker Suite V2 étend la suite Kill Tilt V1 vers l'ensemble des formats modernes (**Cash Game 5/6-Max Deep**, **MTT**, **PKO / Mystery Bounty**, **Expresso / Spin & Go**, **Live**).

**Règle impérative — Aucun outil froid isolé :**
- Chaque nouveau module analytique (calculateur ICM, tableur de sessions, solveur postflop, matrice de push/fold, analyseur de bounty) **doit être couplé à une mécanique de Serious Game**.
- Les mécaniques obligatoires sont :
  1. **Chunking visuel** : décomposition des grilles 13×13 par familles logiques (Paires, Broadways, Suited Aces, Connecteurs) et seuils mémorisables.
  2. **Répétition Espacée (SRS)** unifiée : tout leak détecté en jeu ou à l'import est suivi jusqu'à maîtrise validée (graduation après réussites consécutives).
  3. **Pression ou narration ludique** : Chrono Blitz, *Daily Warm-up* (5 min), ou *Boss Fight* rue par rue (Préflop → Flop → Turn → River).

---

## 2. État Actuel du Dépôt (Audit V1)

- `index.html` (~7 773 lignes) : monolithe HTML/JS vanilla contenant les modules Ranges 13×13, Quiz XP, Jeux de Ranges, Parcours Vidéos Kill Tilt (30 vidéos séquentielles via `killtilt_videos.txt`), Décodeur HUD & Outs, Tableur Bankroll, Équité Monte-Carlo 7 cartes et Simulateur 4-Bet.
- `src/components/CoachIAPoker.tsx` + `src/types/coach.ts` : module React 19 + TypeScript monté dans `#coach-ia-root`.
- `server.ts` : serveur Express + Vite middleware exposant `POST /api/coach/scenario` et `POST /api/coach/review` (modèle `gemini-2.5-flash`).

### Clés `localStorage` V1 à préserver impérativement
Ne jamais renommer, écraser ou supprimer silencieusement ces clés existantes :
1. `killtilt_nl2_ranges_v1` — Ranges personnalisées par spot
2. `killtilt_quiz_xp_v1` — Score XP global et palier joueur
3. `killtilt_watched_videos_v1` — Liste des `videoId` Kill Tilt visionnées
4. `killtilt_nl2_sessions_v1` — Sessions du tableur Bankroll
5. `killtilt_nl2_start_br_v1` — Bankroll initiale (€)
6. `killtilt_range_mastery_v1` — Scores Recall/Blitz, stats par spot et `weakHands` SRS
7. `killtilt_coach_reviews_v1` — Historique des reviews de mains IA

---

## 3. Architecture Cible & Règles de Refactoring

### Arborescence cible V2
```text
src/
├── engines/     # Logique métier & mathématiques pures (0 dépendance DOM/React)
├── workers/     # Web Workers (Monte-Carlo, ICM Malmuth-Harville, parseur .txt)
├── stores/      # État unifié ProPokerSuiteState + migration V1 + Export/Import JSON
├── modules/     # Modules fonctionnels par format (Cash, MTT/ICM, PKO, Expresso, SRS)
├── components/  # Composants UI React réutilisables (Matrice 13×13, Cartes, HUD)
└── types/       # Contrats TypeScript partagés
```

### Règles d'architecture impératives
1. **Migration incrémentale sans régression** : extraire les modules d'`index.html` un par un vers React + TypeScript via un pont d'événements/callbacks propre jusqu'à disparition complète du script inline (voir skill `monolith-to-react-migration`).
2. **Déport Web Workers (UI 60 FPS)** : tout calcul dépassant ~15 ms (simulation Monte-Carlo 7 cartes, calcul ICM Malmuth-Harville à 4–9 joueurs, parsing batch de Hand Histories `.txt`) **doit** tourner dans `src/workers/*.worker.ts`.
3. **Compatibilité ascendante & Migration JSON** : au premier chargement V2, un adaptateur en lecture seule lit les 7 clés `localStorage` V1 et hydrate `ProPokerSuiteState` (stocké sous `pro_poker_suite_v2`), tout en offrant un **Export / Import JSON** complet de la progression.
4. **Offline-First & Mode Dégradé IA** :
   - 100 % des moteurs mathématiques, matrices, jeux SRS, HUD, bankroll et parseurs fonctionnent **sans réseau ni backend**.
   - Si `GEMINI_API_KEY` est absente ou si `/api/coach/*` échoue, `CoachIAPoker` bascule automatiquement sur un moteur de règles local déterministe (zéro blocage utilisateur).
   - **Conformité anti-RTA (Winamax / PokerStars)** : outil d'étude strictement hors-table ; fermer l'application lorsque le client de poker est ouvert (les solveurs, calculateurs ICM, ranges dynamiques et calculateurs d'équité sont interdits en temps réel).
5. **Rôle strict de l'IA & Provenance** :
   - Gemini explique et reformule à partir des faits calculés par les moteurs TS : il ne calcule ni ne note.
   - Toute range ou arbre porte explicitement sa provenance (`solver_export | computed | heuristic | user`) et son niveau de confiance.

---

## 4. Conventions de Code, Langue & Validation

- **TypeScript strict** : activer `"strict": true` dans `tsconfig.json` ; **zéro `any` non justifié** ; typage explicite des entrées/sorties de tous les moteurs.
- **Séparation pureté / UI** : `src/engines/*.ts` ne doit jamais importer `react`, `window`, `document` ou `localStorage`.
- **Langue de l'interface** : **Français** uniquement, en conservant le vocabulaire poker authentique : *Open Raise, 3-Bet, 4-Bet, Squeeze, C-Bet, Check-Raise, Pot Control, Set Mining, ICM, Bubble Factor, Risk Premium, ChipEV, Bounty Equity, MDF, Alpha, SPR*.
- **Validation systématique après chaque tâche** :
  1. `npm run typecheck` (et/ou `npm run lint` — `tsc --noEmit`) : 0 erreur.
  2. `npm run build` : bundle Vite sans erreur.
  3. Tests unitaires **Vitest** sur tous les moteurs modifiés dans `src/engines/`.

---

## 5. Skills Spécialisés (`.agent/skills/`)

Charger systématiquement le skill correspondant avant toute implémentation :
- `poker-math-engines` — Évaluateur 7 cartes, Monte-Carlo, ICM Malmuth-Harville, PKO/Mystery Bounty, Expresso ChipEV, MDF/Alpha.
- `serious-game-pedagogy` — Chunking 13×13, barres mixtes GTO, moteur SRS unifié, *Daily Warm-up*, 5 nouveaux jeux pédagogiques.
- `hand-history-parser` — Parseur `.txt` Winamax & PokerStars (Cash, MTT, Expresso), extraction EV/cEV/leaks, alimentation Bankroll.
- `monolith-to-react-migration` — Protocole d'extraction progressive d'`index.html` vers React + Vite sans casser l'app entre deux commits.
- `gemini-coach-integration` — Contrat React ↔ SRS ↔ `server.ts` (`gemini-2.5-flash`) + mode dégradé hors-ligne.
