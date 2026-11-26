# Questions Ouvertes & Arbitrages Appliqués (Mode Multijoueur — Bible V2)

Ce document consigne les décisions ouvertes de la Bible de développement (`MULTIPLAYER_BIBLE.md`) et les valeurs restrictives par défaut appliquées sur les jalons **M0 Local** et **M1 Asynchrone**.

## 1. Décisions ouvertes (Page 37) — Valeurs par défaut appliquées

| Sujet | Valeur par défaut appliquée | Alternative & impact |
| :--- | :--- | :--- |
| **Correction du Daily Top** | Différée à la clôture UTC (en M1, `GET /v1/daily/:key/review` retourne `409 not_closed` jusqu'à clôture ; en M0, le Daily local L0 reste sans classement officiel). | Immédiate, expose au spoil multi-compte en L1. |
| **Source du corpus classé** | Uniquement **`maths_icm`** calculable exactement par nos moteurs purs (`requiredEquityIcm`, `bubbleFactor`, `bountyAdjusted`, cotes/outs/combos), isolé côté serveur dans `src/server/mp/corpusL1.ts` (162 gabarits relus et recalculés au démarrage). Les ligues solveur (`cash`, `mtt_icm`, `expresso`) restent marquées « Bientôt » en classé tant qu'aucun export solveur relu et sourcé n'est fourni. | Exports solveur commerciaux (nécessite licence et relecture signée). |
| **Serveur (jalon M1+)** | Node + TypeScript + Express (`/v1/*` modulaire avec validation Zod stricte et verrous par `matchId`), accompagné du DDL PostgreSQL officiel (`src/server/mp/migrations/001_mp_schema.sql`), **et mode Hybride Cloud Amical L0 via AWS `ktp-backend` (`eu-north-1`)** + file IndexedDB native + proxy dev `/api/ktp-aws/*`. | Fastify + PostgreSQL géré ou portage Lambda/DynamoDB dès provisionnement L1 persistant. |
| **Bande de nul (`DRAW_BAND_PD`)** | `100 PD` (`config.ts`). À recalibrer après 500 duels L1 sous une nouvelle `rulesVersion`. | Plus étroite = plus de variance sur 15 spots. |
| **Plafonds de conversion en PD** | `1000 mbb` (`1 bb`) et `10000 ppm_pp` (`1 % prize pool`) dans `config.ts`. | Recalibrage empirique après bêta L1. |
| **Live Arena (jalon M2)** | Ouvert après le Ghost classé (M1), pour éviter les files vides au lancement. | File live immédiate. |
| **Chat / Réactions** | 6 réactions prédéfinies post-match uniquement, désactivables et bloquées pendant le run. Aucun chat libre. | Chat libre nécessitant modération. |

## 2. Points techniques tranchés en M0 & M1

1. **Test runners (Vitest + Playwright)** : Vitest (`tests/unit/*.test.ts`) couvre les moteurs V2, M0 (`mp-m0.test.ts`), M1 (`mp-m1.test.ts`) et l'inspection anti-fuite du bundle `dist/assets/*.js` ; Playwright (`tests/e2e/*.spec.ts`) lance le serveur réel (`npx tsx server.ts` en `NODE_ENV=production`) sur Chromium Desktop (`1280×800`) et Mobile (`390×844`).
2. **Corpus `L'Échelle` (`depth`), `Fresque Duel` et `Salve 3-Max`** :
   - Les spots `maths_icm` sont classés (`ranked: true`, `provenance.origin === 'computed'`, `confidence: 'high'`, corpus L1 strictement côté serveur `l1_math_*`).
   - **Fresque Duel (MP-19)** est strictement non éligible au classé (`fresqueRankedEligible === false`, exception levée si `ranked: true`).
   - **Salve 3-Max (MP-19)** n'est éligible que contre un modèle adverse nommé affiché et avec EV exacte calculée (incluant Expresso Jackpot `80/12/8` avec `Risk Premium = 1,35 pt` à 3 tapis égaux).
3. **Format `GhostChallengeV2` (`KT2.`) & Ghost Classé L1** :
   - L0 amical : `CompressionStream('deflate-raw')` + `KT2.` + Zod `.strict()`, mention « Non vérifié (L0 hors-ligne) ».
   - L1 classé : séries et réponses exclusivement côté serveur, expiration 48h sans effet MMR, plafond strict 3 matchs par paire sur 30 jours glissants, reçus signés **Ed25519**.
4. **Conformité Winamax / Anti-RTA & RGPD** :
   - Aucune promesse de « conformité garantie ». Verrouillage des calculateurs/ranges/Coach IA pendant tout run L0 ou L1, attestation de fermeture de room à chaque session, délai >= 24h sur le partage `share.ts`, hachage HMAC des e-mails et anonymisation `DELETE /v1/me` préservant l'intégrité des matchs des adversaires.
