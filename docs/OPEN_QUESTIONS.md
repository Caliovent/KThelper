# Questions Ouvertes & Arbitrages Appliqués (Mode Multijoueur — Bible V2)

Ce document consigne les décisions ouvertes de la Bible de développement (`MULTIPLAYER_BIBLE.md`) et les valeurs restrictives par défaut appliquées dès le jalon **M0 Local**.

## 1. Décisions ouvertes (Page 37) — Valeurs par défaut appliquées

| Sujet | Valeur par défaut appliquée | Alternative & impact |
| :--- | :--- | :--- |
| **Correction du Daily Top** | Différée à la clôture UTC (en M0, le Daily local L0 affiche son avertissement hors-ligne sans classement officiel). | Immédiate, expose au spoil multi-compte en L1. |
| **Source du corpus classé** | Uniquement **`maths_icm`** calculable exactement par nos moteurs purs (`requiredEquityIcm`, `bubbleFactor`, `bountyAdjusted`, cotes/outs/combos). Les ligues solveur (`cash`, `mtt_icm`, `expresso`) restent marquées « Bientôt en classé » tant qu'aucun export solveur relu et sourcé n'est fourni. | Exports solveur commerciaux (nécessite licence et relecture signée). |
| **Serveur (jalon M1+)** | Node + TypeScript + Fastify + WebSocket + PostgreSQL (contrat HTTP/WS spécifié). | Service managé si autorité serveur préservée. |
| **Bande de nul (`DRAW_BAND_PD`)** | `100 PD` (`config.ts`). À recalibrer après 500 duels L1 sous une nouvelle `rulesVersion`. | Plus étroite = plus de variance sur 15 spots. |
| **Plafonds de conversion en PD** | `1000 mbb` (`1 bb`) et `10000 ppm_pp` (`1 % prize pool`) dans `config.ts`. | Recalibrage empirique après bêta L1. |
| **Live Arena (jalon M2)** | Ouvert après le Ghost classé (M1), pour éviter les files vides au lancement. | File live immédiate. |
| **Chat / Réactions** | 6 réactions prédéfinies post-match uniquement, désactivables et bloquées pendant le run. Aucun chat libre. | Chat libre nécessitant modération. |

## 2. Points techniques tranchés en M0 (Page 1 & Page 38)

1. **Test runner unitaire (`npm test` / `tsx`)** : Le dépôt n'embarque pas encore Vitest dans `package.json` ; en attendant l'ajout éventuel de Vitest en CI, tous les critères d'acceptation MP-01..MP-11 tournent en assertions strictes via `npx tsx src/engines/mp/verifyMp.ts` (en plus du contrôle `npm run lint` et `npm run build`).
2. **Corpus `L'Échelle` (`depth`) et `Blitz` en M0** :
   - Les spots `maths_icm` sont classés (`ranked: true`, `provenance.origin === 'computed'`, `confidence: 'high'`).
   - Les variantes d'entraînement `chrono` / `depth` basées sur les ranges heuristiques NL2 sont marquées `ranked: false`, `provenance.origin: 'heuristic'` et sont explicitement exclues de tout classement et de `selectSeries(..., rankedOnly = true)`.
3. **Format `GhostChallengeV2` (`KT2.`)** :
   - Utilisation de `CompressionStream('deflate-raw')` / `DecompressionStream('deflate-raw')` natif (Node 22 + navigateurs Chromium/Firefox/Safari modernes) avec préfixe `KT2.`, validation Zod `.strict()`, plafond d'import `24 000` caractères avant décompression et `65 536` octets après décompression, et bascule proposée en fichier `.ktghost` au-delà de `2 000` caractères.
4. **Conformité Winamax / Anti-RTA** :
   - Aucune promesse de « conformité garantie ». Uniquement des mesures de réduction de risque : verrouillage des calculateurs/ranges/Coach IA pendant un run, case d'engagement à chaque session de fermer l'application pendant toute partie en argent réel sur une room, et délai minimal de 24h sur le partage de mains pseudonymisées (`share.ts`).
