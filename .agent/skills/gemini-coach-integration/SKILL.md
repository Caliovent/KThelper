---
name: gemini-coach-integration
description: Contrat d'interface entre le frontend React, les données de leaks SRS et server.ts (gemini-2.5-flash) pour générer des scénarios ciblés sur les faiblesses réelles du joueur, analyser des mains et assurer un fallback 100% hors-ligne.
---

# Skill : Gemini Coach Integration (`server.ts` ↔ `CoachIAPoker.tsx`)

## Contrats d'API Existants (`server.ts`)
1. `POST /api/coach/scenario`
   - **Requête actuelle** : `{ xp, level, levelTitle, levelDesc, streetFocus, limit, recentTopics }`
   - **Extension V2** : ajouter :
     - `format?: 'CASH' | 'MTT' | 'PKO' | 'EXPRESSO'`
     - `stackBb?: number`
     - `targetLeaks?: Array<{ spotLabel: string; handOrBoard: string; domain: string; misses: number }>` (issus du store SRS)
   - **Validation serveur obligatoire** (`validateScenario`) :
     - `heroCards` : exactement 2 cartes valides (`^[AKQJT98765432][shdc]$`), uniques.
     - `boardCards` : `0 | 3 | 4 | 5` cartes valides, aucune carte dupliquée avec `heroCards`.
     - `options` : exactement 4 choix, `correctIndex` entre `0` et `3`.
2. `POST /api/coach/review`
   - **Requête** : `{ handText, limit, format }`
   - **Réponse** : `{ review: HandReview }` (`score` 1..10, `detectedSpot`, `streets[]`, `strengths[]`, `mistakes[]`, `keyTakeaway`).
   - **Extension V2** : retourner optionnellement `suggestedLeaks?: Array<{ domain, spotLabel, handOrBoard, expectedAction }>` pour injecter directement les erreurs détectées dans le SRS du joueur.

---

## Règles de Prompting & Sécurité (`server.ts`)
- Modèle par défaut : `gemini-2.5-flash` avec `responseMimeType: 'application/json'` et `responseSchema` strict (`@google/genai`).
- **Injection ciblée des leaks SRS** : si `targetLeaks` est non vide, instruire Gemini de construire un spot qui teste prioritairement le premier leak non résolu (sans copier un exemple trivial).
- **Cohérence mathématique** : exiger que les tailles de pot et de tapis dans `actionHistory` soient cohérentes entre elles et avec `limit` (`NL2`, `NL5`, `MTT`, etc.).

---

## Fallback Hors-Ligne Obligatoire (Mode Dégradé)
Si `GEMINI_API_KEY` est absente, invalide, ou si l'appel `fetch('/api/coach/...')` échoue (erreur 500, timeout, mode offline) :
1. **Ne jamais bloquer l'interface** avec une erreur fatale : afficher un bandeau discret *« Mode Hors-Ligne actif (Moteur local) »*.
2. **Scénarios locaux (`src/engines/offlineCoach.ts`)** :
   - Sélectionner un spot déterministe depuis une banque locale enrichie + les `targetLeaks` SRS du joueur et les ranges `getContextualRange()`.
3. **Review locale** :
   - Utiliser `hhParser.ts` (si format Winamax/PokerStars reconnu) pour extraire automatiquement `heroPosition`, `heroCards`, `board`, `netBb` et produire une analyse structurée rue par rue basée sur les règles Kill Tilt (limp, domination, sizing 3-Bet/C-Bet, SPR, overpaire sur board connecté).
