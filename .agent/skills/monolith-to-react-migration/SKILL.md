---
name: monolith-to-react-migration
description: Procédure étape par étape pour extraire les modules d'index.html (~7 773 lignes) vers des composants React + TypeScript dans src/ sans casser l'application ni perdre les données utilisateur entre deux commits.
---

# Skill : Monolith-to-React Migration

## Contexte
Actuellement, `index.html` contient 4 onglets en HTML/JS vanilla et un point de montage `#coach-ia-root` rendu par React (`src/main.tsx` → `src/App.tsx` → `CoachIAPoker.tsx`).
L'objectif V2 est de migrer progressivement chaque module vers React + TypeScript **tout en gardant l'application 100 % fonctionnelle après chaque PR/commit**.

---

## Ordre de Migration Recommandé (du plus isolé au plus central)
1. **État unifié & Adaptateur `localStorage`** (`src/stores/usePokerSuiteStore.ts`)
   - Lire les 7 clés V1 (`killtilt_nl2_ranges_v1`, `killtilt_quiz_xp_v1`, `killtilt_watched_videos_v1`, `killtilt_nl2_sessions_v1`, `killtilt_nl2_start_br_v1`, `killtilt_range_mastery_v1`, `killtilt_coach_reviews_v1`) sans les détruire.
   - Exposer les méthodes de lecture/écriture + Export/Import JSON.
2. **Module HUD, Outs & Cotes** (`src/modules/hud/`)
   - Logique de profiling pure dans `src/engines/hudProfiler.ts`, UI dans `HudModule.tsx`.
3. **Module Tableur & Bankroll** (`src/modules/bankroll/`)
   - Calculs KPI/CSV dans `src/engines/bankroll.ts`, UI + graphique SVG/Canvas dans `BankrollModule.tsx`.
4. **Module Solver GTO & Monte-Carlo** (`src/modules/gto/`)
   - Évaluateur 7 cartes & Simulateur 4-Bet dans `src/engines/` + `src/workers/math.worker.ts`.
5. **Module Ranges 13×13, Quiz XP, Jeux de Ranges & Vidéos** (`src/modules/ranges/`, `src/modules/games/`, `src/modules/videos/`)
   - Dernier bloc à basculer vers un `AppShell.tsx` React unique.

---

## Protocole Strangler Fig par Module (6 étapes obligatoires)
Pour **chaque** module migré :
1. **Extraire la logique pure** vers `src/engines/<module>.ts` et écrire les tests Vitest associés.
2. **Créer le composant React** dans `src/modules/<module>/<Module>View.tsx` avec Tailwind CSS et typage strict.
3. **Monter en îlot React** (ou via `App.tsx` multi-portails `createPortal` / racine dédiée `<div id="module-root">`) exactement comme `#coach-ia-root`.
4. **Synchroniser le pont XP & événements** : remplacer progressivement les appels `window.creditKillTiltCoachXp` / `killtilt-xp-updated` par le store partagé, tout en conservant le pont tant que l'ancien code coexiste.
5. **Supprimer le HTML/JS mort d'`index.html`** uniquement une fois que le nouveau composant React est monté, stylé et vérifié.
6. **Valider** : `npm run typecheck`, `npm run build`, tests Vitest, et vérification visuelle dans le navigateur (zéro erreur console).
