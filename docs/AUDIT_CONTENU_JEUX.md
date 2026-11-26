# Audit Complet du Contenu Pédagogique & des Jeux — Kill Tilt Poker Suite

> Généré automatiquement le `2026-11-26T20:44:26.442Z` via `npm run export:audit`.
> Destiné à la relecture poker (EV, ICM, PKO, ChipEV, MDF, Alpha, textures, ranges) par un joueur pro, un coach ou un analyseur externe.

## 1. Synthèse & Vérifications Automatiques

- **Règles Arène** : `mp-rules-1` | **Corpus Local** : `mp-corpus-maths-v1` (162 spots calibrés + 1 heuristiques) | **Corpus Classé L1** : `mp-l1-maths-v1` (162 spots)
- **Validation `validateCorpus(MP_CORPUS)`** : ✅ OK
- **Validation `verifyL1CorpusTruth()`** : ✅ OK

| Jeu / Module | Volume | Éligibilité Classé | Barème / Règle |
| :--- | :--- | :--- | :--- |
| **Duel Libre & Warm-up du Jour** | 162 spots calibrés (+ 1 amicaux) | Maths & ICM uniquement | PD (1000 PD = 1 bb ou 1% PP), marge ±1.5 pt sur estimations |
| **Arène Classée, Heads-Up Live & Défi du Jour** | 162 spots serveur | ✅ Classé officiel | Solutions jamais envoyées avant fin de match / clôture UTC |
| **Peins ta Range** | 2 sets (12 lignes) | ❌ Amical uniquement | Frontière ±1 case ×2, pondérée combos (6/4/12), 25 s/ligne |
| **Sprint Expresso & 3-Max** | 15 spots (12 + 3 Mort Subite) | Modèle affiché | ChipEV `mbb` & Jackpot 80/12/8 `ppm_pp`, 4 s/spot |
| **Lecture de Board** | 4 flops jumeaux | ❌ Hors classement | Étape 1 (Range/Nuts) + Étape 2 (Fréq/Sizing) |
| **Hand Reading — Entonnoir** | 1 cas (3 rues) | ❌ Hors classement | 6 blocs par rue + comparaison pair, PD = 1000 × (1 − recouvrement) |
| **Table des Boss & Raids 72h** | 4 Bosses, 10 mains multi-streets | Hors classement (Raid Club) | Solo < 500 PD/main & pic ≤ 500 PD ; Raid Équipe ≤ 80 PD/décision |
| **Catalogue Ranges V2** | 7 ranges multi-formats | N/A | Cash 6-Max, MTT 15-20bb, Expresso 25bb |
| **Scénarios Coach hors-ligne** | 6 scénarios | N/A | Quiz multi-streets avec calcul EV / MDF / ICM |

---

## 2. Sprint Expresso & 3-Max (`salve.ts`)

### 1. `salve_01_jackpot_3eq` — Reg Expresso 80/12/8 (Modèle équilibré) 
- **Format** : 3max | Tapis eff. 25 bb | Pot avant héro 1.5 bb | Coût call/shove 25 bb
- **Hypothèses affichées** : Fold adverse = 82% | Équité héro si payé = 45% | Fréq affichées : Jackpot 80/12/8 • Fold combiné 82% • Call 18% (AQs = 45% vs call)
- **EV calculée (`computeSalveSpotEv`)** : `ppm_pp` -> Action = `6432` vs Fold = `0` (Risk Premium ICM = 1.35%)
- **Explication** : Reg Expresso 80/12/8 (Modèle équilibré) : EV(Push All-in 25bb) = 6432 ppm_pp vs Fold = 0 ppm_pp. En Expresso 80/12/8 à trois tapis égaux, son Risk Premium n’est que de 1.35 point (+6432 ppm_pp).

### 2. `salve_02_sb_vs_bb_nit` — Nit Passif BB 
- **Format** : hu | Tapis eff. 14 bb | Pot avant héro 1.5 bb | Coût call/shove 13.5 bb
- **Hypothèses affichées** : Fold adverse = 64% | Équité héro si payé = 36% | Fréq affichées : Fold to Shove 64% • Call 36% (77+, A8+, KQ)
- **EV calculée (`computeSalveSpotEv`)** : `mbb` -> Action = `-206` vs Fold = `0`
- **Explication** : Nit Passif BB : EV(Open Shove 14bb) = -206 mbb vs Fold = 0 mbb.

### 3. `salve_03_hu_cs_shove` — Calling Station HU 
- **Format** : hu | Tapis eff. 12 bb | Pot avant héro 1.5 bb | Coût call/shove 11.5 bb
- **Hypothèses affichées** : Fold adverse = 28% | Équité héro si payé = 34% | Fréq affichées : Fold to Shove 28% • Call très large 72%
- **EV calculée (`computeSalveSpotEv`)** : `mbb` -> Action = `-1862` vs Fold = `0`
- **Explication** : Calling Station HU : EV(Open Shove 12bb) = -1862 mbb vs Fold = 0 mbb.

### 4. `salve_04_bb_call_aggro` — Maniac SB 11bb (Shove 75%) 
- **Format** : hu | Tapis eff. 11 bb | Pot avant héro 1.5 bb | Coût call/shove 10 bb
- **Hypothèses affichées** : Fold adverse = 0% | Équité héro si payé = 56.4% | Fréq affichées : Shove 75% (tous Ax, Kx, Qx, SC) • A8o a 56,4% d’équité
- **EV calculée (`computeSalveSpotEv`)** : `mbb` -> Action = `2126` vs Fold = `0`
- **Explication** : Maniac SB 11bb (Shove 75%) : EV(Call Shove 11bb) = 2126 mbb vs Fold = 0 mbb.

### 5. `salve_05_3max_btn_18bb` — Blindes Serrées 3-Max 
- **Format** : 3max | Tapis eff. 18 bb | Pot avant héro 1.5 bb | Coût call/shove 18 bb
- **Hypothèses affichées** : Fold adverse = 72% | Équité héro si payé = 38% | Fréq affichées : Fold combiné SB+BB 72% • Call 28% (QTs = 38%)
- **EV calculée (`computeSalveSpotEv`)** : `mbb` -> Action = `30` vs Fold = `0`
- **Explication** : Blindes Serrées 3-Max : EV(Open Shove 18bb) = 30 mbb vs Fold = 0 mbb.

### 6. `salve_06_bb_vs_iso_nit` — Nit 3-Max Shove 10bb (18%) 
- **Format** : 3max | Tapis eff. 10 bb | Pot avant héro 1.5 bb | Coût call/shove 9 bb
- **Hypothèses affichées** : Fold adverse = 0% | Équité héro si payé = 34.2% | Fréq affichées : Shove ultra serré 18% (55+, A9+, KQ) • K9o = 34,2% vs cette range
- **EV calculée (`computeSalveSpotEv`)** : `mbb` -> Action = `-2331` vs Fold = `0`
- **Explication** : Nit 3-Max Shove 10bb (18%) : EV(Call Shove 10bb) = -2331 mbb vs Fold = 0 mbb.

### 7. `salve_07_hu_9bb_ace` — Reg Équilibré HU 9bb 
- **Format** : hu | Tapis eff. 9 bb | Pot avant héro 1.5 bb | Coût call/shove 8.5 bb
- **Hypothèses affichées** : Fold adverse = 48% | Équité héro si payé = 45.2% | Fréq affichées : Fold to Shove 48% • Call 52% (A3o = 45,2%)
- **EV calculée (`computeSalveSpotEv`)** : `mbb` -> Action = `648` vs Fold = `0`
- **Explication** : Reg Équilibré HU 9bb : EV(Open Shove 9bb) = 648 mbb vs Fold = 0 mbb.

### 8. `salve_08_btn_15bb_trap` — Trap Reg BB (Call 55%) 
- **Format** : 3max | Tapis eff. 15 bb | Pot avant héro 1.5 bb | Coût call/shove 15 bb
- **Hypothèses affichées** : Fold adverse = 45% | Équité héro si payé = 31.8% | Fréq affichées : Fold 45% • Call large 55% (T6o = 31,8%)
- **EV calculée (`computeSalveSpotEv`)** : `mbb` -> Action = `-2066` vs Fold = `0`
- **Explication** : Trap Reg BB (Call 55%) : EV(Open Shove 15bb) = -2066 mbb vs Fold = 0 mbb.

### 9. `salve_09_hu_6bb_su` — Reg HU 6bb 
- **Format** : hu | Tapis eff. 6 bb | Pot avant héro 1.5 bb | Coût call/shove 5.5 bb
- **Hypothèses affichées** : Fold adverse = 42% | Équité héro si payé = 40.5% | Fréq affichées : Fold 42% • Call 58% (86s = 40,5%)
- **EV calculée (`computeSalveSpotEv`)** : `mbb` -> Action = `376` vs Fold = `0`
- **Explication** : Reg HU 6bb : EV(Open Shove 6bb) = 376 mbb vs Fold = 0 mbb.

### 10. `salve_10_bb_8bb_call` — Reg Aggro SB 8bb (Shove 62%) 
- **Format** : hu | Tapis eff. 8 bb | Pot avant héro 1.5 bb | Coût call/shove 7 bb
- **Hypothèses affichées** : Fold adverse = 0% | Équité héro si payé = 52.8% | Fréq affichées : Shove 62% • QJo = 52,8% vs range de shove
- **EV calculée (`computeSalveSpotEv`)** : `mbb` -> Action = `1184` vs Fold = `0`
- **Explication** : Reg Aggro SB 8bb (Shove 62%) : EV(Call Shove 8bb) = 1184 mbb vs Fold = 0 mbb.

### 11. `salve_11_3max_13bb_fold` — BB Récréatif Call 60% 
- **Format** : 3max | Tapis eff. 13 bb | Pot avant héro 1.5 bb | Coût call/shove 12.5 bb
- **Hypothèses affichées** : Fold adverse = 40% | Équité héro si payé = 29.5% | Fréq affichées : Fold 40% • Call 60% (72o = 29,5%)
- **EV calculée (`computeSalveSpotEv`)** : `mbb` -> Action = `-2209` vs Fold = `0`
- **Explication** : BB Récréatif Call 60% : EV(Open Shove 13bb) = -2209 mbb vs Fold = 0 mbb.

### 12. `salve_12_hu_16bb_kjs` — Reg Passif HU 16bb 
- **Format** : hu | Tapis eff. 16 bb | Pot avant héro 1.5 bb | Coût call/shove 15.5 bb
- **Hypothèses affichées** : Fold adverse = 58% | Équité héro si payé = 46.1% | Fréq affichées : Fold 58% • Call 42% (KJs = 46,1%)
- **EV calculée (`computeSalveSpotEv`)** : `mbb` -> Action = `653` vs Fold = `0`
- **Explication** : Reg Passif HU 16bb : EV(Open Shove 16bb) = 653 mbb vs Fold = 0 mbb.

### 13. `salve_13_sd_jackpot_7bb` — Mort Subite — Nit HU 7bb 🔥 (Mort Subite)
- **Format** : hu | Tapis eff. 7 bb | Pot avant héro 1.5 bb | Coût call/shove 6.5 bb
- **Hypothèses affichées** : Fold adverse = 56% | Équité héro si payé = 42.8% | Fréq affichées : Fold 56% • Call 44% (A2o = 42,8%)
- **EV calculée (`computeSalveSpotEv`)** : `mbb` -> Action = `711` vs Fold = `0`
- **Explication** : Mort Subite — Nit HU 7bb : EV(Open Shove 7bb) = 711 mbb vs Fold = 0 mbb.

### 14. `salve_14_sd_bb_call_12bb` — Mort Subite — Reg Shove 55% 🔥 (Mort Subite)
- **Format** : hu | Tapis eff. 12 bb | Pot avant héro 1.5 bb | Coût call/shove 11 bb
- **Hypothèses affichées** : Fold adverse = 0% | Équité héro si payé = 54.1% | Fréq affichées : Shove 55% en SB • 55 possède 54,1% d’équité
- **EV calculée (`computeSalveSpotEv`)** : `mbb` -> Action = `1714` vs Fold = `0`
- **Explication** : Mort Subite — Reg Shove 55% : EV(Call Shove 12bb) = 1714 mbb vs Fold = 0 mbb.

### 15. `salve_15_sd_jackpot_3max` — Mort Subite — Expresso 80/12/8 (25/25/25) 🔥 (Mort Subite)
- **Format** : 3max | Tapis eff. 14 bb | Pot avant héro 1.5 bb | Coût call/shove 14 bb
- **Hypothèses affichées** : Fold adverse = 70% | Équité héro si payé = 44.5% | Fréq affichées : Jackpot 80/12/8 (tapis égaux 25/25/25) • Fold 70% • KQo = 44,5% vs call
- **EV calculée (`computeSalveSpotEv`)** : `ppm_pp` -> Action = `262` vs Fold = `0` (Risk Premium ICM = 1.35%)
- **Explication** : Mort Subite — Expresso 80/12/8 (25/25/25) : EV(Push 14bb (Jackpot 80/12/8)) = 262 ppm_pp vs Fold = 0 ppm_pp. En Expresso 80/12/8 à trois tapis égaux, son Risk Premium n’est que de 1.35 point (+262 ppm_pp).

---

## 3. Peins ta Range (`fresque.ts`)

### Open Raise CO 6-Max 100bb (Heuristique Kill Tilt) (`fresque_co_open_100bb` — CO)
- **Provenance** : Heuristique pédagogique non classée — hors classement L1
- **Paires (AA → 22)** : Référence = `AA, KK, QQ, JJ, TT, 99, 88, 77, 66, 55, 44, 33, 22` — *En 6-Max au CO, toutes les paires 22+ sont ouvertes pour set-miner avec position.*
- **As assortis (AKs → A2s)** : Référence = `AKs, AQs, AJs, ATs, A9s, A8s, A7s, A6s, A5s, A4s, A3s, A2s` — *Tous les As assortis jouent très bien IP grâce aux tirages couleur max et bloqueurs.*
- **Rois assortis (KQs → K2s)** : Référence = `KQs, KJs, KTs, K9s, K8s, K7s, K6s` — *Plancher standard autour de K6s+ (K5s/K4s en option selon les blindes).*
- **Dames assorties (QJs → Q2s)** : Référence = `QJs, QTs, Q9s, Q8s` — *Q8s+ reste jouable IP ; Q7s- devient souvent trop dominé contre BTN/BB.*
- **As dépareillés (AKo → A2o)** : Référence = `AKo, AQo, AJo, ATo, A9o + îlots: A6o` — *Plancher ATo+ (A9o frontière) + îlot A5o pour la jouabilité quinte/bloqueur.*
- **Rois dépareillés (KQo → K2o)** : Référence = `KQo, KJo, KTo` — *KTo+ suffit ; K9o- perd trop d’EV hors-équité face aux 3-bets du BTN.*

### Open Raise BTN 6-Max 100bb (Contraste vs CO) (`fresque_btn_open_100bb` — BTN)
- **Provenance** : Heuristique pédagogique non classée — hors classement L1
- **Paires (AA → 22)** : Référence = `AA, KK, QQ, JJ, TT, 99, 88, 77, 66, 55, 44, 33, 22` — *Identique au CO : toutes les paires 22+.*
- **As assortis (AKs → A2s)** : Référence = `AKs, AQs, AJs, ATs, A9s, A8s, A7s, A6s, A5s, A4s, A3s, A2s` — *Tous les Axs sont des opens automatiques au Bouton.*
- **Rois assortis (KQs → K2s)** : Référence = `KQs, KJs, KTs, K9s, K8s, K7s, K6s, K5s, K4s, K3s, K2s` — *Au BTN, on descend jusqu’à K2s pour attaquer les blindes.*
- **Dames assorties (QJs → Q2s)** : Référence = `QJs, QTs, Q9s, Q8s, Q7s, Q6s, Q5s` — *On élargit de Q8s à Q5s au Bouton.*
- **As dépareillés (AKo → A2o)** : Référence = `AKo, AQo, AJo, ATo, A9o, A8o, A7o, A6o` — *Au Bouton on ouvre directement A7o+ sans trou.*
- **Rois dépareillés (KQo → K2o)** : Référence = `KQo, KJo, KTo, K9o, K8o` — *K8o+ s’ajoute grâce à l’avantage de position absolu postflop.*

---

## 4. Lecture de Board (`texture.ts`)

### 1. `tex_twin_1a_ak4r` — Paire 1 — High Dry IP vs Low Connecté OOP (BTN vs BB SRP) (`As Kd 4c`)
- **Attendu Étape 1** : Avantage Range = `IP` | Avantage Nuts = `IP`
- **Attendu Étape 2** : Fréquence = `75%` | Sizing = `33%`
- **Explication** : Sur A-K-4 rainbow BTN vs BB, IP domine massivement en range et en nuts (AA, KK, AK). Petit sizing haute fréquence (33%).

### 2. `tex_twin_1b_654tt` — Paire 1 — High Dry IP vs Low Connecté OOP (BTN vs BB SRP) (`6h 5h 4d`)
- **Attendu Étape 1** : Avantage Range = `OOP` | Avantage Nuts = `OOP`
- **Attendu Étape 2** : Fréquence = `25%` | Sizing = `75%`
- **Explication** : Sur 6-5-4 two-tone, BB possède bien plus de doubles paires, brelans et quintes floppées (87s, 73s). On check souvent IP ou polarise gros.

### 3. `tex_twin_2a_q83mono` — Paire 2 — Monotone vs Board Pairé (CO vs BB SRP) (`Qs 8s 3s`)
- **Attendu Étape 1** : Avantage Range = `neutre` | Avantage Nuts = `neutre`
- **Attendu Étape 2** : Fréquence = `50%` | Sizing = `33%`
- **Explication** : Sur Q-8-3 monotone, les couleurs sont partagées entre CO et BB : petit sizing (33%) ou check pour contrôler la taille du pot.

### 4. `tex_twin_2b_kk5r` — Paire 2 — Monotone vs Board Pairé (CO vs BB SRP) (`Kh Kd 5c`)
- **Attendu Étape 1** : Avantage Range = `IP` | Avantage Nuts = `IP`
- **Attendu Étape 2** : Fréquence = `100%` | Sizing = `33%`
- **Explication** : Sur K-K-5 rainbow, CO détient un avantage de range écrasant (AK, KQ, AA, QQ). C-Bet quasi 100% à 33% du pot.

---

## 5. Hand Reading — Entonnoir de Range (`funnel.ts`)

### Enquête #1 — Reg TAG BB (Check-Call Flop → Donk/Lead River) (`funnel_reg_tag_btn_vs_bb`)
- **Hypothèses** : Profil Vilain : Régulier TAG (VPIP 24 / PFR 20 / AF 2.8) ; Pot SRP BTN (Hero) vs BB (Vilain), 100bb effectifs ; Horloge pédagogique : 20s par rue
- **Flop [Qh 9s 4d] (Vilain (BB) check-call un C-Bet 33% sur Qh 9s 4d)**
  - Référence (%) : {"valeur_forte":10,"valeur_moyenne":35,"tirages_forts":25,"tirages_faibles":15,"bluff_catchers":10,"air":5}
  - Pair affiché (%) : {"valeur_forte":15,"valeur_moyenne":30,"tirages_forts":25,"tirages_faibles":10,"bluff_catchers":15,"air":5}
  - Explication : Au flop, un Reg check-raise souvent ses brelans (99/44), donc il reste surtout des Qx moyens, des JTs/KTs et des gutshots.
- **Turn [Qh 9s 4d 2s] (Turn 2s — Vilain check-call encore une mise 66% pot)**
  - Référence (%) : {"valeur_forte":15,"valeur_moyenne":40,"tirages_forts":30,"tirages_faibles":5,"bluff_catchers":10,"air":0}
  - Pair affiché (%) : {"valeur_forte":20,"valeur_moyenne":35,"tirages_forts":25,"tirages_faibles":10,"bluff_catchers":10,"air":0}
  - Explication : Le 2s ouvre un tirage couleur backdoor mais n’aide pas les paires faibles. L’entonnoir se resserre sur Qx + tirages forts.
- **River [Qh 9s 4d 2s Js] (River Js (complète QT/KTs et pique) — Vilain donk-bet 75% pot)**
  - Référence (%) : {"valeur_forte":65,"valeur_moyenne":10,"tirages_forts":0,"tirages_faibles":0,"bluff_catchers":5,"air":20}
  - Pair affiché (%) : {"valeur_forte":55,"valeur_moyenne":15,"tirages_forts":0,"tirages_faibles":0,"bluff_catchers":10,"air":20}
  - Explication : Les tirages ont soit touché (quintes/couleurs en valeur forte) soit raté (transformés en bluff avec bloqueurs KT/AT).

---

## 6. Table des Boss & Raids 72h (`boss.ts`)

### 1. `boss_h01_nit_overpair` (nit) — Main #1 — Overpaire KK face au check-raise du Nit
- **Décision 1 (Préflop (CO 100bb) / preflop)** : Héro `[Ks Kd]` Board `[]` — CO open 2.5bb avec KK, le Nit défend en BB.
  - Ligne de référence : *Open 2.5bb (ligne de référence)* | EV exactes -> raise: 1850 | limp: 750 | fold: 0
  - Explication : KK est un open en value obligatoire pour bâtir le pot.
- **Décision 2 (Flop Js 7d 2c (Pot 5.5bb) / postflop)** : Héro `[Ks Kd]` Board `[Js 7d 2c]` — Le Nit check. Sur J72 rainbow, quelle fréquence / ligne ?
  - Ligne de référence : *C-Bet 50% pot (ligne de référence)* | EV exactes -> bet: 1420 | check: 1080
  - Explication : Contre la range cappée du Nit qui paye ses Jx/88-TT, C-Bet value est supérieur.
- **Décision 3 (Turn 4h (Le Nit check-raise 3.5x) / pression)** : Héro `[Ks Kd]` Board `[Js 7d 2c 4h]` — Turn 4h : vous bettez 6bb, le Nit check-raise à 21bb (3% bluff). Décision ?
  - Ligne de référence : *Disciplined Fold face au x/r Nit* | EV exactes -> fold: 0 | call: -780 | allin: -1450
  - Explication : Un Nit (AF bas) en x/r turn représente JJ/77/22/44 : KK n’a presque aucun bluff en face.

### 2. `boss_h02_nit_steal` (nit) — Main #2 — Pression sur les blindes du Nit
- **Décision 1 (Préflop (BTN 100bb) / preflop)** : Héro `[Ks 9s]` Board `[]` — Le Nit est en BB (fold to steal élevé). K9s au BTN ?
  - Ligne de référence : *Open 2.5bb BTN* | EV exactes -> raise: 620 | fold: 0
  - Explication : K9s imprime de la fold equity contre un Nit en blinde.
- **Décision 2 (Flop Ac 8d 3h (Pot 5.5bb) / postflop)** : Héro `[Ks 9s]` Board `[Ac 8d 3h]` — Le Nit check sur A-8-3 rainbow.
  - Ligne de référence : *C-Bet 33% (range advantage)* | EV exactes -> bet: 480 | check: 120
  - Explication : Sur board A-high dry, le Nit fold toutes ses pocket pairs sous-As et broadways ratés.
- **Décision 3 (Turn Tc (Le Nit lead 75% pot) / pression)** : Héro `[Ks 9s]` Board `[Ac 8d 3h Tc]` — Sur le donk-bet 75% pot du Nit au Turn Tc, vous avez K9s (roi hauteur).
  - Ligne de référence : *Fold immédiat* | EV exactes -> fold: 0 | call: -640
  - Explication : Un donk 75% d’un joueur Nit signifie Ax fort ou brelan : aucune cote pour float K-high.

### 3. `boss_h03_cs_value` (calling_station) — Main #3 — Triple barrel thin value contre Calling Station
- **Décision 1 (Préflop (CO 100bb vs limp) / preflop)** : Héro `[As Qh]` Board `[]` — La Calling Station limp MP. Vous isolez AQo au CO ?
  - Ligne de référence : *Iso-Raise 4bb* | EV exactes -> raise: 1150 | call: 390 | fold: 0
  - Explication : Contre un limp passif, isoler à 4bb en position extrait un maximum de value avec AQo.
- **Décision 2 (Flop Qs 9d 4c (Pot 9.5bb) / postflop)** : Héro `[As Qh]` Board `[Qs 9d 4c]` — Top paire top kicker contre Calling Station (fold to C-Bet 24%).
  - Ligne de référence : *C-Bet Cher 75% pot* | EV exactes -> bet_big: 1680 | bet_small: 1210 | check: 720
  - Explication : Une Calling Station ne fold pas Qx/9x/tirages : il faut sizer cher dès le flop.
- **Décision 3 (River 2h (Pot 38bb) / pression)** : Héro `[As Qh]` Board `[Qs 9d 4c 6s 2h]` — Brique river. Vilain check encore. Value bet ou pot control ?
  - Ligne de référence : *Value Bet 66% pot* | EV exactes -> bet: 940 | check: 210
  - Explication : Contre une Calling Station (46% VPIP), AQ est largement devant toutes les Qx moins bonnes et 9x.

### 4. `boss_h04_cs_nobluff` (calling_station) — Main #4 — Zéro bluff river contre Calling Station
- **Décision 1 (Préflop (BTN 100bb) / preflop)** : Héro `[Kd Jd]` Board `[]` — Calling Station complète sa BB. Open standard BTN ?
  - Ligne de référence : *Open 2.5bb BTN* | EV exactes -> raise: 740 | fold: 0
  - Explication : KJs domine la range de défense très large d’une Calling Station.
- **Décision 2 (Flop 9d 6c 2d (Pot 5.5bb) / postflop)** : Héro `[Kd Jd]` Board `[9d 6c 2d]` — Vous avez tirage couleur max + deux overcards.
  - Ligne de référence : *Semi-bluff C-Bet 66%* | EV exactes -> bet: 680 | check: 410
  - Explication : Tirage couleur max + 2 overs garde une énorme équité même payé.
- **Décision 3 (River 4s (Tirage raté, Vilain check) / pression)** : Héro `[Kd Jd]` Board `[9d 6c 2d Th 4s]` — Tout a raté. Vilain ne lâche aucune paire. Faut-il bluffer river ?
  - Ligne de référence : *Check back (abandonner le bluff)* | EV exactes -> check: 150 | bet: -890
  - Explication : Règle d’or Kill Tilt : on ne bluffe jamais une Calling Station river quand on a K-high.

### 5. `boss_h05_aggro_3bet` (reg_aggro) — Main #5 — Défendre IP face au 3-Bet du Reg Aggro
- **Décision 1 (Préflop (CO vs 3-Bet SB 11.5%) / preflop)** : Héro `[Ac Qc]` Board `[]` — CO open 2.5bb, le Reg Aggro 3-bet à 10bb en SB. AQs ?
  - Ligne de référence : *Call IP 10bb* | EV exactes -> call: 610 | 4bet: 380 | fold: 0
  - Explication : Contre un Reg Aggro (3-bet 11.5%), call AQs IP garde ses bluffs et domine son AQ/KQ.
- **Décision 2 (Flop Qh 8c 3d (Pot 21bb) / postflop)** : Héro `[Ac Qc]` Board `[Qh 8c 3d]` — Vilain C-Bet 33% en pot 3-bet. Votre ligne ?
  - Ligne de référence : *Call pour garder ses bluffs* | EV exactes -> call: 1180 | raise: 740 | fold: -350
  - Explication : Top paire top kicker sur board sec bloque les Qx et veut laisser Vilain continuer à bluffer.
- **Décision 3 (River 7s (Vilain 3-barrel 75% pot) / pression)** : Héro `[Ac Qc]` Board `[Qh 8c 3d 2s 7s]` — Board sans tirage complété, le Reg Aggro envoie un 3e barrel à 75%.
  - Ligne de référence : *Call (bluff-catch optimal)* | EV exactes -> call: 920 | fold: 0
  - Explication : AQs est tout en haut de votre range de call face aux nombreux bluffs manqués d’un Reg LAG.

### 6. `boss_h06_aggro_4betbluff` (reg_aggro) — Main #6 — 4-Bet Light avec bloqueur A5s vs Reg LAG
- **Décision 1 (Préflop (BTN vs BB 3-Bet 13%) / preflop)** : Héro `[As 5s]` Board `[]` — BTN open 2.5bb, le Reg Aggro 3-bet à 11bb en BB. A5s ?
  - Ligne de référence : *4-Bet bluff à 24bb* | EV exactes -> 4bet: 420 | call: 290 | fold: 0
  - Explication : A5s bloque AA/AK et possède une excellente équité si callé par JJ/QQ/KQ.
- **Décision 2 (Flop Kd 9s 4c (Pot 48bb, si callé) / postflop)** : Héro `[As 5s]` Board `[Kd 9s 4c]` — Vilain check en pot 4-bet sur K-9-4 rainbow.
  - Ligne de référence : *C-Bet 25% pot (avantage Kx)* | EV exactes -> bet: 510 | check: 180
  - Explication : Un petit C-Bet 25% met une pression maximale sur ses TT-QQ et ses broadways sans K.
- **Décision 3 (Turn Jh (Vilain x/shove après C-Bet) / pression)** : Héro `[As 5s]` Board `[Kd 9s 4c Jh]` — Vilain check-call flop puis donk-shove Turn.
  - Ligne de référence : *Fold immédiat (hauteur As)* | EV exactes -> fold: 0 | call: -1150
  - Explication : A-high sans tirage est battu même par ses semi-bluffs QT/JT.

### 7. `boss_h07_icm_bubble_call` (chip_leader_icm) — Main #7 — Call à la bulle 4-Max (40/25/20/15)
- **Décision 1 (Préflop Bulle 4-Max (Tapis 40/25/20/15, 50/30/20) / preflop)** : Héro `[Ad Jc]` Board `[]` — Le Chip Leader (40bb) open shove en SB sur Hero en BB (25bb) avec AJo. Risk Premium énorme (68.9% requis vs range serrée ou call ?). Contre range 45% shove AJo a 59%.
  - Ligne de référence : *Fold ICM discipliné* | EV exactes -> fold: 0 | call: -4200
  - Explication : Malgré 59% d’équité contre sa range large, le seuil Malmuth-Harville (40/25/20/15 -> 68,9%) rend le call négatif en $EV !
- **Décision 2 (Scénario référence : Pot limped SB vs BB (Board A94) / postflop)** : Héro `[Ad Jc]` Board `[Ah 9s 4c]` — Si le pot était joué postflop à la bulle : le CL c-bet 33%.
  - Ligne de référence : *Call avec Top Paire* | EV exactes -> call: 2400 | fold: 0
  - Explication : Pour 33% du pot sans engager tout le tapis, TP bon kicker défend facilement.
- **Décision 3 (River Kd — CL met tapis pour vos derniers 18bb / pression)** : Héro `[Ad Jc]` Board `[Ah 9s 4c 2h Kd]` — Le CL vous met à tapis pour votre survie sur le K river.
  - Ligne de référence : *Fold ICM (15bb encore derrière)* | EV exactes -> fold: 0 | call: -3100
  - Explication : Tant qu’un short stack à 15bb survit à table, payer tout son stack avec une paire demande un Bubble Factor > 2.3.

### 8. `boss_h08_icm_resteal` (chip_leader_icm) — Main #8 — Resteal 20bb contre Chip Leader ICM
- **Décision 1 (Préflop TF (Stacks 45/20/18/17) / preflop)** : Héro `[As Qs]` Board `[]` — Le Chip Leader (45bb) min-raise CO (PFR 31%). Hero (20bb) en BB avec AQs.
  - Ligne de référence : *3-Bet All-in 20bb (Fold Equity + Value)* | EV exactes -> allin: 3600 | call: 1100 | fold: 0
  - Explication : Contre un open très large (31%) du Chip Leader, AQs a une fold equity massive + ~45% contre sa range de call.
- **Décision 2 (Si call OOP — Flop Qs 7c 2h / postflop)** : Héro `[As Qs]` Board `[Qs 7c 2h]` — Vous avez check-call et touchez Top Paire Top Kicker. Check pour laisser c-bet ?
  - Ligne de référence : *Check au Chip Leader agressif* | EV exactes -> check: 1900 | bet: 1100
  - Explication : Laisser le Tyran c-better sa fréquence élevée maximise la value.
- **Décision 3 (Turn 5s — CL part à tapis 18bb / pression)** : Héro `[As Qs]` Board `[Qs 7c 2h 5s]` — Sur 5s, vous avez TPTK + tirage couleur max ! Le CL shove.
  - Ligne de référence : *Snap Call (équité écrasante)* | EV exactes -> call: 8200 | fold: 0
  - Explication : TPTK + tirage couleur max dépasse très largement le seuil ICM même sous forte pression.

### 9. `boss_h09_nit_setmining` (nit) — Main #9 — Set Mining IP 100bb vs Open du Nit
- **Décision 1 (Préflop (BTN vs Nit UTG Open 3bb) / preflop)** : Héro `[6s 6h]` Board `[]` — Le Nit open 3bb UTG (100bb effectifs). Call pour Set Mining ?
  - Ligne de référence : *Call 3bb IP (cotes implicites)* | EV exactes -> call: 410 | fold: 0 | 3bet: -520
  - Explication : 100bb deep IP contre une range UTG serrée (QQ+/AK), les cotes implicites valident le set mining.
- **Décision 2 (Flop Kh 6d 2c (Brelan touché !) / postflop)** : Héro `[6s 6h]` Board `[Kh 6d 2c]` — Le Nit c-bet 50% pot sur K-6-2 rainbow. Raise tout de suite ou slowplay ?
  - Ligne de référence : *Call flop pour garder AA/AK/KQ* | EV exactes -> call: 3200 | raise: 2550
  - Explication : Sur board sec K-6-2, laisser le Nit 2-barreller AA/AK rapporte plus que raise flop.
- **Décision 3 (River 9s (Pot 32bb — Nit mise 20bb) / pression)** : Héro `[6s 6h]` Board `[Kh 6d 2c Td 9s]` — River 9s. Vous avez 666, le Nit bet 20bb (il reste 50bb derrière).
  - Ligne de référence : *Raise All-in Value* | EV exactes -> allin: 4100 | call: 2100
  - Explication : La range de 3-barrel d’un Nit sur K-high est composée d’AK/AA/KK : il faut tout prendre river.

### 10. `boss_h10_aggro_rivercheck` (reg_aggro) — Main #10 — Check-Call vs Check-Raise avec quinte contre Reg LAG
- **Décision 1 (Préflop (BB vs BTN Reg Aggro 2.5bb) / preflop)** : Héro `[8d 7d]` Board `[]` — Le Reg LAG open 2.5bb au BTN. Défense en BB avec 87s ?
  - Ligne de référence : *Call 1.5bb en BB* | EV exactes -> call: 520 | fold: 0
  - Explication : 87s se défend à 100% en BB contre un open large BTN.
- **Décision 2 (Flop 6c 5s 2h (OESD) / postflop)** : Héro `[8d 7d]` Board `[6c 5s 2h]` — Tirage quinte par les deux bouts face à C-Bet 50%. Check-raise semi-bluff ?
  - Ligne de référence : *Check-Raise 3.2x* | EV exactes -> raise: 980 | call: 640
  - Explication : Sur board bas favorable à la BB, 87s est un excellent combo de check-raise semi-bluff.
- **Décision 3 (Turn 9c (Quinte max touchée !) / pression)** : Héro `[8d 7d]` Board `[6c 5s 2h 9c]` — Turn 9c complète votre quinte (87). Vilain a callé le x/r. Bet 75% ou Check ?
  - Ligne de référence : *Bet Value 75% pot* | EV exactes -> bet: 2800 | check: 1450
  - Explication : Un Reg LAG float beaucoup flop : il faut continuer la pression en value sur sa range large.

---

## 7. Catalogue Ranges V2 (`v2Ranges.ts`)

### `cash_6max_100bb_bb_vs_btn_3bet_polar` — Cash 6-Max 100bb — BB vs BTN Open 2.5x (3-Bet Polarisé) (cash_6max, 100bb, BB)
- **Provenance** : `computed` (medium) — Table mixte pondérée sur 1 326 combos (heuristique de référence V2, hors solveur complet)
- **Mains couvertes** : 85 mains 13×13 • Synthèse : {"3bPct":9.47,"callPct":30.8,"defendTotalPct":40.27,"combos3b":125.6,"combosCall":408.4}
  - {"3b":1} : `AA, KK, QQ, JJ, TT, AKs, AQs, AJs, AKo, AQo, KQs`
  - {"3b":0.5,"c":0.5} : `99, AJo, KJs, QJs`
  - {"3b":0.75,"c":0.25} : `A5s, A4s, K6s, K5s, 75s, 65s, 54s`
  - {"3b":0.4,"c":0.6} : `A3s, A2s, K7s, Q6s, 86s, 76s`
  - {"3b":0.25,"c":0.75} : `A9o, A8o, KTo, QTo`
  - {"c":1} : `88, 77, 66, 55, 44, 33, 22, ATs, A9s, A8s, A7s, A6s, KTs, K9s, K8s, K4s, K3s, K2s, QTs, Q9s, Q8s, Q7s, Q5s, Q4s, Q3s, Q2s, JTs, J9s, J8s, J7s, T9s, T8s, T7s, 98s, 97s, 87s, 64s, 53s, 43s, ATo, KQo, KJo, QJo, JTo, T9o, 98o, A7o, A6o, A5o, A4o, K9o, Q9o, J9o`

### `cash_6max_100bb_co_vs_btn_3bet_4bet_polar` — Cash 6-Max 100bb — CO vs BTN 3-Bet 7.5bb (4-Bet Polarisé) (cash_6max, 100bb, CO)
- **Provenance** : `computed` (medium) — Table mixte pondérée sur l’éventail d’ouverture CO (54 combos 4-Bet / 77 combos Call)
- **Mains couvertes** : 26 mains 13×13 • Synthèse : {"4bOfOpenPct":15,"callOfOpenPct":21.4,"foldOfOpenPct":63.6,"combos4b":54,"combosCall":77}
  - {"4b":1} : `AA, KK, QQ, AKs, AKo`
  - {"4b":0.65,"f":0.35} : `A5s, A4s, KQo`
  - {"4b":0.35,"c":0.65} : `AQo, KJs, QJs`
  - {"c":1} : `JJ, TT, 99, 88, AQs, AJs, ATs, KQs, JTs, T9s`
  - {"c":0.5,"f":0.5} : `77, 66, 98s, 87s, AJo`

### `mtt_8max_20bb_bba_btn_rfi` — MTT 8-Max 20bb (BBA 1bb) — BTN RFI Mix Min-Raise / Open-Shove (mtt_classic, 20bb, BTN)
- **Provenance** : `heuristic` (medium) — Heuristique MTT 20bb avec BBA 1bb (386 combos Min-Raise / 84 combos Shove)
- **Mains couvertes** : 77 mains 13×13 • Synthèse : {"mrPct":29.11,"shvPct":6.33,"totalPlayPct":35.44,"combosMr":386,"combosShv":84}
  - {"mr":1} : `AA, KK, QQ, JJ, TT, AKs, AQs, AJs, ATs, KQs, KJs, KTs, K9s, QJs, QTs, Q9s, JTs, J9s, J8s, T9s, T8s, 98s, 97s, 87s, 76s, 65s, AKo, AQo, AJo, KQo, KJo, QJo`
  - {"mr":0.65,"shv":0.35} : `99, 88, 77, 66, A9s, A8s, A7s, A6s, ATo, KTo, QTo, JTo`
  - {"shv":0.7,"mr":0.3} : `55, 44, 33, 22, A5s, A4s, A3s, A2s, A9o, A8o, A7o`
  - {"mr":0.75,"f":0.25} : `K8s, K7s, K6s, K5s, Q8s, Q7s, Q6s, J7s, T7s, 86s, 75s, 64s, 54s, A6o, A5o, A4o, A3o, A2o, K9o, Q9o, J9o, T9o`

### `mtt_8max_15bb_bba_btn_nash_push` — MTT 8-Max 15bb (BBA 1bb) — BTN Push/Fold (564 combos) (mtt_classic, 15bb, BTN)
- **Provenance** : `heuristic` (medium) — Range push/fold heuristique vérifiée à 564 combos (42,53%)
- **Mains couvertes** : 88 mains 13×13 • Synthèse : {"shvPct":42.53,"combosShv":564}
  - {"shv":1} : `AA, KK, QQ, JJ, TT, 99, 88, 77, 66, 55, 44, 33, 22, AKs, AQs, AJs, ATs, A9s, A8s, A7s, A6s, A5s, A4s, A3s, A2s, AKo, AQo, AJo, ATo, A9o, A8o, A7o, A6o, A5o, A4o, A3o, A2o, KQs, KJs, KTs, K9s, K8s, K7s, K6s, K5s, K4s, K3s, K2s, KQo, KJo, KTo, K9o, K8o, QJs, QTs, Q9s, Q8s, Q7s, Q6s, Q5s, QJo, QTo, Q9o, JTs, J9s, J8s, J7s, JTo, J9o, T9s, T8s, T7s, T9o, 98s, 97s, 87s, 86s, 76s, 75s, 65s, 54s`
  - {"shv":0.5,"f":0.5} : `K7o, Q8o, J8o, T8o, 96s, 85s, 64s`

### `expresso_3max_25bb_btn_rfi` — Expresso 3-Max 25bb — BTN Open Min-Raise 2x (36,05%) (expresso_3max, 25bb, BTN)
- **Provenance** : `heuristic` (medium) — Heuristique Expresso 3-Max WTA 25bb (478 combos)
- **Mains couvertes** : 83 mains 13×13 • Synthèse : {"mrPct":36.05,"combosMr":478}
  - {"mr":1} : `AA, KK, QQ, JJ, TT, 99, 88, 77, 66, 55, 44, 33, 22, AKs, AQs, AJs, ATs, A9s, A8s, A7s, A6s, A5s, A4s, A3s, A2s, KQs, KJs, KTs, K9s, K8s, K7s, K6s, K5s, K4s, QJs, QTs, Q9s, Q8s, Q7s, Q6s, JTs, J9s, J8s, J7s, T9s, T8s, T7s, 98s, 97s, 87s, 86s, 76s, 75s, 65s, 54s, AKo, AQo, AJo, ATo, A9o, A8o, A7o, KQo, KJo, KTo, K9o, QJo, QTo, JTo`
  - {"mr":0.5,"f":0.5} : `A6o, A5o, A4o, A3o, A2o, K8o, Q9o, J9o, T9o, K3s, K2s, Q5s, 96s, 64s`

### `expresso_3max_25bb_sb_vs_bb` — Expresso 3-Max 25bb — SB vs BB (Mix Raise 2.5–3x / Limp-Trap / Limp-Stab) (expresso_3max, 25bb, SB)
- **Provenance** : `computed` (medium) — Bataille de blindes Expresso 25bb (208,7 combos Raise / 529,3 combos Limp)
- **Mains couvertes** : 106 mains 13×13 • Synthèse : {"mrPct":15.74,"limpPct":39.92,"totalVpipPct":55.66,"combosMr":208.7,"combosLimp":529.3}
  - {"mr":0.65,"limp":0.35} : `AA, KK`
  - {"mr":0.85,"limp":0.15} : `QQ, JJ, TT, 99, AKs, AQs, AJs, ATs, AKo, AQo, AJo, KQs, KJs, KTs, KQo, QJs`
  - {"mr":0.45,"limp":0.55} : `A5s, A4s, A3s, A2s, K6s, K5s, K4s, Q5s, Q4s, J6s, J5s, T6s, 96s, 85s, 74s, 64s`
  - {"limp":0.85,"mr":0.15} : `88, 77, 66, 55, 44, 33, 22, A9s, A8s, A7s, A6s, K9s, K8s, K7s, K3s, K2s, QTs, Q9s, Q8s, Q7s, Q6s, Q3s, Q2s, JTs, J9s, J8s, J7s, T9s, T8s, T7s, 98s, 97s, 87s, 86s, 76s, 75s, 65s, 54s, 53s, 43s, ATo, A9o, A8o, A7o, A6o, A5o, A4o, A3o, A2o, KJo, KTo, K9o, K8o, K7o, K6o, K5o, QJo, QTo, Q9o, Q8o, Q7o, JTo, J9o, J8o, J7o, T9o, T8o, T7o, 98o, 97o, 87o, 76o`

### `expresso_3max_25bb_bb_vs_btn_2x` — Expresso 3-Max 25bb — Défense BB vs BTN Min-Raise 2x (61,38%) (expresso_3max, 25bb, BB)
- **Provenance** : `computed` (medium) — Défense large BB vs Min-Raise 2x en Expresso 25bb (814 combos défendus)
- **Mains couvertes** : 120 mains 13×13 • Synthèse : {"3bPct":5.81,"shvPct":2.42,"callPct":53.15,"defendTotalPct":61.38,"combos3b":77.1,"combosShv":32.1,"combosCall":704.8}
  - {"3b":0.85,"shv":0.15} : `AA, KK, QQ, AKs, AKo, AQs`
  - {"3b":0.5,"c":0.5} : `JJ, TT, 99, AJs, ATs, AQo, KQs`
  - {"shv":0.4,"c":0.6} : `88, 77, 66, 55, 44, A9s, A8s, A7s, AJo, ATo`
  - {"3b":0.35,"c":0.65} : `A5s, A4s, A3s, A2s, K7s, K6s, K5s, K4s, Q7s, Q6s, Q5s, J7s, T7s, 86s, 75s, 65s, 54s`
  - {"c":1} : `33, 22, A6s, KJs, KTs, K9s, K8s, K3s, K2s, QJs, QTs, Q9s, Q8s, Q4s, Q3s, Q2s, JTs, J9s, J8s, J6s, J5s, J4s, J3s, J2s, T9s, T8s, T6s, T5s, T4s, T3s, T2s, 98s, 97s, 96s, 95s, 87s, 85s, 84s, 76s, 74s, 64s, 63s, 53s, 52s, 43s, 42s, 32s, A9o, A8o, A7o, A6o, A5o, A4o, A3o, A2o, KQo, KJo, KTo, K9o, K8o, K7o, K6o, K5o, QJo, QTo, Q9o, Q8o, Q7o, JTo, J9o, J8o, J7o, T9o, T8o, T7o, 98o, 97o, 87o, 86o, 76o`

---

## 8. Scénarios Coach Hors-Ligne (`offlineCoach.ts`)

### 1. Cash 6-Max — C-Bet sur Board Sec vs Fish Passif (NL2 • Flop)
- **Setup** : BTN (100bb) `[As Qd]` vs BB (Fish Passif (42/9/2)) • Board `[Kd 7c 2s]` • Pot 6.5bb
- **Question** : Quelle est la meilleure décision au Flop en position ?
- **Bonne option** : `B` — C-Bet 1/3 pot (~2.2bb) avec votre avantage de range
- **Explication** : Moteur local V2 : Sur K-7-2 rainbow (connectivité 0), BTN possède un fort avantage de range. Un petit C-Bet à 33 % (MDF adverse ~75 %, Alpha 25 %) prend le pot très souvent et garde l’équité d’As-Dame (6 outs vs 7x/2x).

### 2. MTT Bulle 4-Max — Pression ICM Extrême (BB 25bb vs SB 40bb) (MTT • Préflop)
- **Setup** : BB (25bb) `[Ac Jc]` vs SB (Chip Leader Aggro (Bulle 50/30/20/0)) • Board `[]` • Pot 26.5bb
- **Question** : Sachant que votre Bubble Factor vs Chip Leader est de 2,38 (+20,4 pp de Risk Premium), quelle est l’action ?
- **Bonne option** : `B` — Fold discipliné : il faut ~68,9 % d’équité sous ICM ici
- **Explication** : Calcul exact Malmuth-Harville : même face à une range très large du Chip Leader, l’équité requise passe de 48,0 % (ChipEV) à 68,9 % (ICM, BF 2,38). Seules les toutes meilleures mains (QQ+, AK/AQs selon range) peuvent payer.

### 3. Expresso 3-Max (25bb) — SB vs BB Limp-Trap ou Raise ? (Expresso • Préflop)
- **Setup** : SB (25bb) `[9h 7h]` vs BB (Régulier Expresso (BB)) • Board `[]` • Pot 1.5bb
- **Question** : Quelle est la fréquence de jeu recommandée en SB à 25bb avec 97s (vs 6-Max Cash) ?
- **Bonne option** : `B` — Limp majoritaire (85% Limp / 15% Raise) protégé par des limp-traps
- **Explication** : En Expresso 25bb SB vs BB, le solveur/modèle V2 recommande un limp mergé large (~40 %) incluant 97s (85 % Limp / 15 % Raise), protégé par des limp-traps avec AA/KK afin d’empêcher la BB d’iso-relancer trop souvent.

### 4. PKO Mid-Stage — Calcul du Bounty Power (BB Couvrant) (PKO • Préflop)
- **Setup** : BB (28bb) `[Kc Ts]` vs BTN (Short Stack PKO (12bb, Prime 5bb)) • Board `[]` • Pot 25.5bb
- **Question** : Comment la prime encaissable de 5bb modifie-t-elle l’équité requise pour payer ?
- **Bonne option** : `A` — Elle passe de 43,1 % (ChipEV) à ~36,1 % (Remise de -7 pp)
- **Explication** : Lorsqu’Hero couvre Vilain, la prime encaissable (convertie via le Bounty Power proportionnel RPP+BPP) s’ajoute au dénominateur : 11 / 30,5 = 36,07 % au lieu de 43,14 % en ChipEV. KTo call largement profitable.

### 5. Turn 2nd Barrel — Overpaire sur Board Connecté vs Check-Raise Passif (NL5 • Turn)
- **Setup** : UTG (100bb) `[Ah Ad]` vs BB (Calling Station Passive (39/7/2, AF 0.9)) • Board `[8s 9s 6c 4h]` • Pot 32bb
- **Question** : Face au check-raise d’un profil très passif (AF 0.9) sur 8-9-6-4, que faites-vous ?
- **Bonne option** : `B` — Fold discipliné : un joueur à AF 0.9 a presque toujours deux paires, brelan ou quinte
- **Explication** : Sur un board très connecté (connectivité 2) qui touche massivement la range de défense de BB (66, 88, 99, 89, 75s, T7s), un check-raise Turn d’un profil à AF 0.9 est quasiment 100 % en value qui bat une simple paire.

### 6. River Thin Value — Extraire face à une Calling Station (NL2 • River)
- **Setup** : CO (100bb) `[Kd Js]` vs BB (Récréatif Collant (48/11/3, AF 0.8)) • Board `[Kc 9h 4s 2d 7c]` • Pot 22bb
- **Question** : Quelle est la ligne la plus rentable à la River contre ce profil ?
- **Bonne option** : `B` — Thin Value Bet ~1/2 pot (11bb) pour vous faire payer par 9x, K8–KT et 55–88
- **Explication** : En NL2/NL5 face à un profil passif, la thin value à 1/2 pot contre des mains comme 9x, K5–KT ou paires moyennes est l’une des plus grosses sources de bb/100. S’il relance cette river, vous pouvez folder sereinement.

---

## 9. Corpus Arène Classée Serveur (`mp-l1-maths-v1` — 162 spots)

#### 1. `l1_math_icmeq_01` — Famille `icm_equity` | mtt (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 40/25/20/15, paiements 50/30/20). J1 (40bb) shove en SB (0.5) sur Hero J2 (25bb) en BB (1). Quelle équité minimale (%) pour call ?
- **Hypothèses** : Modèle Malmuth-Harville exact, partages ignorés ; Blindes : SB 0.5bb / BB 1bb ; En ChipEV pur ce call demanderait 48%
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 68.87% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Par Malmuth-Harville exact : équité requise = 68.9% (contre 48.0% en ChipEV, soit +20.9 pt de prime ICM).

#### 2. `l1_math_icmeq_02` — Famille `icm_equity` | mtt (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 40/25/20/15, paiements 50/30/20). J1 (40bb) shove en SB (0.5) sur Hero J3 (20bb) en BB (1). Quelle équité minimale (%) pour call ?
- **Hypothèses** : Modèle Malmuth-Harville exact, partages ignorés ; Blindes : SB 0.5bb / BB 1bb ; En ChipEV pur ce call demanderait 47.5%
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 66.24% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Par Malmuth-Harville exact : équité requise = 66.2% (contre 47.5% en ChipEV, soit +18.7 pt de prime ICM).

#### 3. `l1_math_icmeq_03` — Famille `icm_equity` | mtt (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 40/25/20/15, paiements 50/30/20). J1 (40bb) shove en SB (0.5) sur Hero J4 (15bb) en BB (1). Quelle équité minimale (%) pour call ?
- **Hypothèses** : Modèle Malmuth-Harville exact, partages ignorés ; Blindes : SB 0.5bb / BB 1bb ; En ChipEV pur ce call demanderait 46.67%
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 61.69% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Par Malmuth-Harville exact : équité requise = 61.7% (contre 46.7% en ChipEV, soit +15.0 pt de prime ICM).

#### 4. `l1_math_icmeq_04` — Famille `icm_equity` | mtt (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 45/28/17/10, paiements 50/30/20). J1 (45bb) shove en SB (0.5) sur Hero J2 (28bb) en BB (1). Quelle équité minimale (%) pour call ?
- **Hypothèses** : Modèle Malmuth-Harville exact, partages ignorés ; Blindes : SB 0.5bb / BB 1bb ; En ChipEV pur ce call demanderait 48.21%
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 72.59% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Par Malmuth-Harville exact : équité requise = 72.6% (contre 48.2% en ChipEV, soit +24.4 pt de prime ICM).

#### 5. `l1_math_icmeq_05` — Famille `icm_equity` | mtt (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 45/28/17/10, paiements 50/30/20). J2 (28bb) shove en SB (0.5) sur Hero J3 (17bb) en BB (1). Quelle équité minimale (%) pour call ?
- **Hypothèses** : Modèle Malmuth-Harville exact, partages ignorés ; Blindes : SB 0.5bb / BB 1bb ; En ChipEV pur ce call demanderait 47.06%
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 65% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Par Malmuth-Harville exact : équité requise = 65.0% (contre 47.1% en ChipEV, soit +17.9 pt de prime ICM).

#### 6. `l1_math_icmeq_06` — Famille `icm_equity` | mtt (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 50/22/18/10, paiements 50/30/20). J1 (50bb) shove en SB (0.5) sur Hero J2 (22bb) en BB (1). Quelle équité minimale (%) pour call ?
- **Hypothèses** : Modèle Malmuth-Harville exact, partages ignorés ; Blindes : SB 0.5bb / BB 1bb ; En ChipEV pur ce call demanderait 47.73%
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 71.62% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Par Malmuth-Harville exact : équité requise = 71.6% (contre 47.7% en ChipEV, soit +23.9 pt de prime ICM).

#### 7. `l1_math_icmeq_07` — Famille `icm_equity` | mtt (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 50/22/18/10, paiements 50/30/20). J1 (50bb) shove en SB (0.5) sur Hero J3 (18bb) en BB (1). Quelle équité minimale (%) pour call ?
- **Hypothèses** : Modèle Malmuth-Harville exact, partages ignorés ; Blindes : SB 0.5bb / BB 1bb ; En ChipEV pur ce call demanderait 47.22%
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 69.41% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Par Malmuth-Harville exact : équité requise = 69.4% (contre 47.2% en ChipEV, soit +22.2 pt de prime ICM).

#### 8. `l1_math_icmeq_08` — Famille `icm_equity` | mtt (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 36/30/22/12, paiements 50/30/20). J1 (36bb) shove en SB (0.5) sur Hero J2 (30bb) en BB (1). Quelle équité minimale (%) pour call ?
- **Hypothèses** : Modèle Malmuth-Harville exact, partages ignorés ; Blindes : SB 0.5bb / BB 1bb ; En ChipEV pur ce call demanderait 48.33%
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 70.19% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Par Malmuth-Harville exact : équité requise = 70.2% (contre 48.3% en ChipEV, soit +21.9 pt de prime ICM).

#### 9. `l1_math_icmeq_09` — Famille `icm_equity` | mtt (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 36/30/22/12, paiements 50/30/20). J2 (30bb) shove en SB (0.5) sur Hero J3 (22bb) en BB (1). Quelle équité minimale (%) pour call ?
- **Hypothèses** : Modèle Malmuth-Harville exact, partages ignorés ; Blindes : SB 0.5bb / BB 1bb ; En ChipEV pur ce call demanderait 47.73%
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 66.13% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Par Malmuth-Harville exact : équité requise = 66.1% (contre 47.7% en ChipEV, soit +18.4 pt de prime ICM).

#### 10. `l1_math_icmeq_10` — Famille `icm_equity` | mtt (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 38/26/21/15, paiements 55/28/17). J1 (38bb) shove en SB (0.5) sur Hero J2 (26bb) en BB (1). Quelle équité minimale (%) pour call ?
- **Hypothèses** : Modèle Malmuth-Harville exact, partages ignorés ; Blindes : SB 0.5bb / BB 1bb ; En ChipEV pur ce call demanderait 48.08%
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 65.71% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Par Malmuth-Harville exact : équité requise = 65.7% (contre 48.1% en ChipEV, soit +17.6 pt de prime ICM).

#### 11. `l1_math_icmeq_11` — Famille `icm_equity` | mtt (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 38/26/21/15, paiements 55/28/17). J1 (38bb) shove en SB (0.5) sur Hero J3 (21bb) en BB (1). Quelle équité minimale (%) pour call ?
- **Hypothèses** : Modèle Malmuth-Harville exact, partages ignorés ; Blindes : SB 0.5bb / BB 1bb ; En ChipEV pur ce call demanderait 47.62%
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 63.69% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Par Malmuth-Harville exact : équité requise = 63.7% (contre 47.6% en ChipEV, soit +16.1 pt de prime ICM).

#### 12. `l1_math_icmeq_12` — Famille `icm_equity` | mtt (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 42/27/19/12, paiements 45/33/22). J1 (42bb) shove en SB (0.5) sur Hero J2 (27bb) en BB (1). Quelle équité minimale (%) pour call ?
- **Hypothèses** : Modèle Malmuth-Harville exact, partages ignorés ; Blindes : SB 0.5bb / BB 1bb ; En ChipEV pur ce call demanderait 48.15%
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 74.19% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Par Malmuth-Harville exact : équité requise = 74.2% (contre 48.1% en ChipEV, soit +26.0 pt de prime ICM).

#### 13. `l1_math_icmeq_13` — Famille `icm_equity` | mtt (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 42/27/19/12, paiements 45/33/22). J1 (42bb) shove en SB (0.5) sur Hero J3 (19bb) en BB (1). Quelle équité minimale (%) pour call ?
- **Hypothèses** : Modèle Malmuth-Harville exact, partages ignorés ; Blindes : SB 0.5bb / BB 1bb ; En ChipEV pur ce call demanderait 47.37%
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 69.55% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Par Malmuth-Harville exact : équité requise = 69.5% (contre 47.4% en ChipEV, soit +22.2 pt de prime ICM).

#### 14. `l1_math_icmeq_14` — Famille `icm_equity` | mtt (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 35/32/23/10, paiements 50/30/20). J3 (23bb) shove en SB (0.5) sur Hero J2 (32bb) en BB (1). Quelle équité minimale (%) pour call ?
- **Hypothèses** : Modèle Malmuth-Harville exact, partages ignorés ; Blindes : SB 0.5bb / BB 1bb ; En ChipEV pur ce call demanderait 47.83%
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 59.29% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Par Malmuth-Harville exact : équité requise = 59.3% (contre 47.8% en ChipEV, soit +11.5 pt de prime ICM).

#### 15. `l1_math_icmeq_15` — Famille `icm_equity` | mtt (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 48/24/16/12, paiements 50/30/20). J1 (48bb) shove en SB (0.5) sur Hero J2 (24bb) en BB (1). Quelle équité minimale (%) pour call ?
- **Hypothèses** : Modèle Malmuth-Harville exact, partages ignorés ; Blindes : SB 0.5bb / BB 1bb ; En ChipEV pur ce call demanderait 47.92%
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 71.51% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Par Malmuth-Harville exact : équité requise = 71.5% (contre 47.9% en ChipEV, soit +23.6 pt de prime ICM).

#### 16. `l1_math_icmeq_16` — Famille `icm_equity` | mtt (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 44/23/20/13, paiements 50/30/20). J1 (44bb) shove en SB (0.5) sur Hero J3 (20bb) en BB (1). Quelle équité minimale (%) pour call ?
- **Hypothèses** : Modèle Malmuth-Harville exact, partages ignorés ; Blindes : SB 0.5bb / BB 1bb ; En ChipEV pur ce call demanderait 47.5%
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 67.86% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Par Malmuth-Harville exact : équité requise = 67.9% (contre 47.5% en ChipEV, soit +20.4 pt de prime ICM).

#### 17. `l1_math_icmeq_17` — Famille `icm_equity` | mtt (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 40/25/20/15, paiements 65/35/0). J1 (40bb) shove en SB (0.5) sur Hero J2 (25bb) en BB (1). Quelle équité minimale (%) pour call ?
- **Hypothèses** : Modèle Malmuth-Harville exact, partages ignorés ; Blindes : SB 0.5bb / BB 1bb ; En ChipEV pur ce call demanderait 48%
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 58.12% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Par Malmuth-Harville exact : équité requise = 58.1% (contre 48.0% en ChipEV, soit +10.1 pt de prime ICM).

#### 18. `l1_math_icmeq_18` — Famille `icm_equity` | mtt (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 40/25/20/15, paiements 65/35/0). J1 (40bb) shove en SB (0.5) sur Hero J3 (20bb) en BB (1). Quelle équité minimale (%) pour call ?
- **Hypothèses** : Modèle Malmuth-Harville exact, partages ignorés ; Blindes : SB 0.5bb / BB 1bb ; En ChipEV pur ce call demanderait 47.5%
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 55.58% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Par Malmuth-Harville exact : équité requise = 55.6% (contre 47.5% en ChipEV, soit +8.1 pt de prime ICM).

#### 19. `l1_math_icmeq_19` — Famille `icm_equity` | mtt (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 52/26/14/8, paiements 60/25/15). J1 (52bb) shove en SB (1) sur Hero J2 (26bb) en BB (2). Quelle équité minimale (%) pour call ?
- **Hypothèses** : Modèle Malmuth-Harville exact, partages ignorés ; Blindes : SB 1bb / BB 2bb ; En ChipEV pur ce call demanderait 46.15%
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 66.33% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Par Malmuth-Harville exact : équité requise = 66.3% (contre 46.1% en ChipEV, soit +20.2 pt de prime ICM).

#### 20. `l1_math_icmeq_20` — Famille `icm_equity` | mtt (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 30/28/24/18, paiements 50/30/20). J1 (30bb) shove en SB (1) sur Hero J3 (24bb) en BB (2). Quelle équité minimale (%) pour call ?
- **Hypothèses** : Modèle Malmuth-Harville exact, partages ignorés ; Blindes : SB 1bb / BB 2bb ; En ChipEV pur ce call demanderait 45.83%
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 63.3% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Par Malmuth-Harville exact : équité requise = 63.3% (contre 45.8% en ChipEV, soit +17.5 pt de prime ICM).

#### 21. `l1_math_icmeq_21` — Famille `icm_equity` | mtt (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 55/20/15/10, paiements 50/30/20). J3 (15bb) shove en SB (0.5) sur Hero J2 (20bb) en BB (1). Quelle équité minimale (%) pour call ?
- **Hypothèses** : Modèle Malmuth-Harville exact, partages ignorés ; Blindes : SB 0.5bb / BB 1bb ; En ChipEV pur ce call demanderait 46.67%
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 57.15% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Par Malmuth-Harville exact : équité requise = 57.1% (contre 46.7% en ChipEV, soit +10.5 pt de prime ICM).

#### 22. `l1_math_icmeq_22` — Famille `icm_equity` | mtt (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 33/31/21/15, paiements 50/30/20). J2 (31bb) shove en SB (0.5) sur Hero J1 (33bb) en BB (1). Quelle équité minimale (%) pour call ?
- **Hypothèses** : Modèle Malmuth-Harville exact, partages ignorés ; Blindes : SB 0.5bb / BB 1bb ; En ChipEV pur ce call demanderait 48.39%
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 67.15% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Par Malmuth-Harville exact : équité requise = 67.2% (contre 48.4% en ChipEV, soit +18.8 pt de prime ICM).

#### 23. `l1_math_icmeq_23` — Famille `icm_equity` | mtt (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 46/25/18/11, paiements 70/30/0). J1 (46bb) shove en SB (0.5) sur Hero J2 (25bb) en BB (1). Quelle équité minimale (%) pour call ?
- **Hypothèses** : Modèle Malmuth-Harville exact, partages ignorés ; Blindes : SB 0.5bb / BB 1bb ; En ChipEV pur ce call demanderait 48%
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 58.13% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Par Malmuth-Harville exact : équité requise = 58.1% (contre 48.0% en ChipEV, soit +10.1 pt de prime ICM).

#### 24. `l1_math_icmeq_24` — Famille `icm_equity` | mtt (mixed)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 29/27/24/20, paiements 50/30/20). J1 (29bb) shove en SB (0.5) sur Hero J2 (27bb) en BB (1). Quelle équité minimale (%) pour call ?
- **Hypothèses** : Modèle Malmuth-Harville exact, partages ignorés ; Blindes : SB 0.5bb / BB 1bb ; En ChipEV pur ce call demanderait 48.15%
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 65.89% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Par Malmuth-Harville exact : équité requise = 65.9% (contre 48.1% en ChipEV, soit +17.7 pt de prime ICM).

#### 25. `l1_math_icmeq_25` — Famille `icm_equity` | mtt (mixed)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 34/26/22/18, paiements 50/30/20). J2 (26bb) shove en SB (0.5) sur Hero J3 (22bb) en BB (1). Quelle équité minimale (%) pour call ?
- **Hypothèses** : Modèle Malmuth-Harville exact, partages ignorés ; Blindes : SB 0.5bb / BB 1bb ; En ChipEV pur ce call demanderait 47.73%
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 63.17% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Par Malmuth-Harville exact : équité requise = 63.2% (contre 47.7% en ChipEV, soit +15.4 pt de prime ICM).

#### 26. `l1_math_icmeq_26` — Famille `icm_equity` | mtt (mixed)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 41/25/19/15, paiements 52/30/18). J4 (15bb) shove en SB (0.5) sur Hero J2 (25bb) en BB (1). Quelle équité minimale (%) pour call ?
- **Hypothèses** : Modèle Malmuth-Harville exact, partages ignorés ; Blindes : SB 0.5bb / BB 1bb ; En ChipEV pur ce call demanderait 46.67%
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 53.32% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Par Malmuth-Harville exact : équité requise = 53.3% (contre 46.7% en ChipEV, soit +6.6 pt de prime ICM).

#### 27. `l1_math_icmeq_27` — Famille `icm_equity` | mtt (mixed)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 39/28/19/14, paiements 50/30/20). J3 (19bb) shove en SB (0.5) sur Hero J4 (14bb) en BB (1). Quelle équité minimale (%) pour call ?
- **Hypothèses** : Modèle Malmuth-Harville exact, partages ignorés ; Blindes : SB 0.5bb / BB 1bb ; En ChipEV pur ce call demanderait 46.43%
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 55.11% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Par Malmuth-Harville exact : équité requise = 55.1% (contre 46.4% en ChipEV, soit +8.7 pt de prime ICM).

#### 28. `l1_math_bf_01` — Famille `icm_bubble_factor` | mtt (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 40/25/20/15, paiements 50/30/20/0). En confrontation symétrique sans argent mort, J2 (25bb) joue son tapis effectif contre J1 (40bb). Quelle équité minimale (%) requise ?
- **Hypothèses** : Confrontation symétrique sans argent mort (BF / (1 + BF)) ; Bubble Factor = 2.377 • Risk Premium = +20.38 pt
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 70.38% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Bubble Factor = 2.377, soit un Risk Premium de +20.38 pt au-dessus de 50 %. Équité requise = 70.4 %.

#### 29. `l1_math_bf_02` — Famille `icm_bubble_factor` | mtt (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 40/25/20/15, paiements 50/30/20/0). En confrontation symétrique sans argent mort, J3 (20bb) joue son tapis effectif contre J1 (40bb). Quelle équité minimale (%) requise ?
- **Hypothèses** : Confrontation symétrique sans argent mort (BF / (1 + BF)) ; Bubble Factor = 2.152 • Risk Premium = +18.27 pt
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 68.27% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Bubble Factor = 2.152, soit un Risk Premium de +18.27 pt au-dessus de 50 %. Équité requise = 68.3 %.

#### 30. `l1_math_bf_03` — Famille `icm_bubble_factor` | mtt (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 40/25/20/15, paiements 50/30/20/0). En confrontation symétrique sans argent mort, J4 (15bb) joue son tapis effectif contre J1 (40bb). Quelle équité minimale (%) requise ?
- **Hypothèses** : Confrontation symétrique sans argent mort (BF / (1 + BF)) ; Bubble Factor = 1.830 • Risk Premium = +14.67 pt
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 64.67% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Bubble Factor = 1.830, soit un Risk Premium de +14.67 pt au-dessus de 50 %. Équité requise = 64.7 %.

#### 31. `l1_math_bf_04` — Famille `icm_bubble_factor` | mtt (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 40/25/20/15, paiements 50/30/20/0). En confrontation symétrique sans argent mort, J3 (20bb) joue son tapis effectif contre J2 (25bb). Quelle équité minimale (%) requise ?
- **Hypothèses** : Confrontation symétrique sans argent mort (BF / (1 + BF)) ; Bubble Factor = 1.869 • Risk Premium = +15.14 pt
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 65.14% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Bubble Factor = 1.869, soit un Risk Premium de +15.14 pt au-dessus de 50 %. Équité requise = 65.1 %.

#### 32. `l1_math_bf_05` — Famille `icm_bubble_factor` | mtt (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max asym. (tapis 50/25/15/10, paiements 50/30/20/0). En confrontation symétrique sans argent mort, J2 (25bb) joue son tapis effectif contre J1 (50bb). Quelle équité minimale (%) requise ?
- **Hypothèses** : Confrontation symétrique sans argent mort (BF / (1 + BF)) ; Bubble Factor = 2.905 • Risk Premium = +24.39 pt
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 74.39% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Bubble Factor = 2.905, soit un Risk Premium de +24.39 pt au-dessus de 50 %. Équité requise = 74.4 %.

#### 33. `l1_math_bf_06` — Famille `icm_bubble_factor` | mtt (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max asym. (tapis 50/25/15/10, paiements 50/30/20/0). En confrontation symétrique sans argent mort, J3 (15bb) joue son tapis effectif contre J1 (50bb). Quelle équité minimale (%) requise ?
- **Hypothèses** : Confrontation symétrique sans argent mort (BF / (1 + BF)) ; Bubble Factor = 2.339 • Risk Premium = +20.05 pt
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 70.05% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Bubble Factor = 2.339, soit un Risk Premium de +20.05 pt au-dessus de 50 %. Équité requise = 70.0 %.

#### 34. `l1_math_bf_07` — Famille `icm_bubble_factor` | mtt (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle dominée (tapis 60/20/12/8, paiements 50/30/20/0). En confrontation symétrique sans argent mort, J2 (20bb) joue son tapis effectif contre J1 (60bb). Quelle équité minimale (%) requise ?
- **Hypothèses** : Confrontation symétrique sans argent mort (BF / (1 + BF)) ; Bubble Factor = 3.231 • Risk Premium = +26.36 pt
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 76.36% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Bubble Factor = 3.231, soit un Risk Premium de +26.36 pt au-dessus de 50 %. Équité requise = 76.4 %.

#### 35. `l1_math_bf_08` — Famille `icm_bubble_factor` | mtt (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle dominée (tapis 60/20/12/8, paiements 50/30/20/0). En confrontation symétrique sans argent mort, J3 (12bb) joue son tapis effectif contre J2 (20bb). Quelle équité minimale (%) requise ?
- **Hypothèses** : Confrontation symétrique sans argent mort (BF / (1 + BF)) ; Bubble Factor = 1.969 • Risk Premium = +16.32 pt
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 66.32% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Bubble Factor = 1.969, soit un Risk Premium de +16.32 pt au-dessus de 50 %. Équité requise = 66.3 %.

#### 36. `l1_math_bf_09` — Famille `icm_bubble_factor` | expresso (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Expresso 80/12/8 (tapis 25/25/25, paiements 80/12/8). En confrontation symétrique sans argent mort, J1 (25bb) joue son tapis effectif contre J2 (25bb). Quelle équité minimale (%) requise ?
- **Hypothèses** : Confrontation symétrique sans argent mort (BF / (1 + BF)) ; Bubble Factor = 1.056 • Risk Premium = +1.35 pt
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 51.35% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Bubble Factor = 1.056, soit un Risk Premium de +1.35 pt au-dessus de 50 %. Équité requise = 51.4 %.

#### 37. `l1_math_bf_10` — Famille `icm_bubble_factor` | expresso (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Expresso 80/12/8 (tapis 45/20/10, paiements 80/12/8). En confrontation symétrique sans argent mort, J2 (20bb) joue son tapis effectif contre J1 (45bb). Quelle équité minimale (%) requise ?
- **Hypothèses** : Confrontation symétrique sans argent mort (BF / (1 + BF)) ; Bubble Factor = 1.113 • Risk Premium = +2.68 pt
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 52.68% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Bubble Factor = 1.113, soit un Risk Premium de +2.68 pt au-dessus de 50 %. Équité requise = 52.7 %.

#### 38. `l1_math_bf_11` — Famille `icm_bubble_factor` | expresso (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Expresso 80/12/8 (tapis 45/20/10, paiements 80/12/8). En confrontation symétrique sans argent mort, J3 (10bb) joue son tapis effectif contre J1 (45bb). Quelle équité minimale (%) requise ?
- **Hypothèses** : Confrontation symétrique sans argent mort (BF / (1 + BF)) ; Bubble Factor = 1.067 • Risk Premium = +1.62 pt
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 51.62% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Bubble Factor = 1.067, soit un Risk Premium de +1.62 pt au-dessus de 50 %. Équité requise = 51.6 %.

#### 39. `l1_math_bf_12` — Famille `icm_bubble_factor` | expresso (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Expresso 80/12/8 (tapis 45/20/10, paiements 80/12/8). En confrontation symétrique sans argent mort, J1 (45bb) joue son tapis effectif contre J2 (20bb). Quelle équité minimale (%) requise ?
- **Hypothèses** : Confrontation symétrique sans argent mort (BF / (1 + BF)) ; Bubble Factor = 1.012 • Risk Premium = +0.30 pt
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 50.3% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Bubble Factor = 1.012, soit un Risk Premium de +0.30 pt au-dessus de 50 %. Équité requise = 50.3 %.

#### 40. `l1_math_bf_13` — Famille `icm_bubble_factor` | mtt (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 35/30/20/15, paiements 50/30/20/0). En confrontation symétrique sans argent mort, J2 (30bb) joue son tapis effectif contre J1 (35bb). Quelle équité minimale (%) requise ?
- **Hypothèses** : Confrontation symétrique sans argent mort (BF / (1 + BF)) ; Bubble Factor = 2.406 • Risk Premium = +20.64 pt
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 70.64% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Bubble Factor = 2.406, soit un Risk Premium de +20.64 pt au-dessus de 50 %. Équité requise = 70.6 %.

#### 41. `l1_math_bf_14` — Famille `icm_bubble_factor` | mtt (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 35/30/20/15, paiements 50/30/20/0). En confrontation symétrique sans argent mort, J3 (20bb) joue son tapis effectif contre J2 (30bb). Quelle équité minimale (%) requise ?
- **Hypothèses** : Confrontation symétrique sans argent mort (BF / (1 + BF)) ; Bubble Factor = 1.950 • Risk Premium = +16.10 pt
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 66.1% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Bubble Factor = 1.950, soit un Risk Premium de +16.10 pt au-dessus de 50 %. Équité requise = 66.1 %.

#### 42. `l1_math_bf_15` — Famille `icm_bubble_factor` | mtt (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : TF 6-Max (tapis 55/42/30/24/15/9, paiements 35/24/17/11/7.5/5.5). En confrontation symétrique sans argent mort, J3 (30bb) joue son tapis effectif contre J1 (55bb). Quelle équité minimale (%) requise ?
- **Hypothèses** : Confrontation symétrique sans argent mort (BF / (1 + BF)) ; Bubble Factor = 2.060 • Risk Premium = +17.32 pt
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 67.32% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Bubble Factor = 2.060, soit un Risk Premium de +17.32 pt au-dessus de 50 %. Équité requise = 67.3 %.

#### 43. `l1_math_bf_16` — Famille `icm_bubble_factor` | mtt (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : TF 6-Max (tapis 55/42/30/24/15/9, paiements 35/24/17/11/7.5/5.5). En confrontation symétrique sans argent mort, J4 (24bb) joue son tapis effectif contre J1 (55bb). Quelle équité minimale (%) requise ?
- **Hypothèses** : Confrontation symétrique sans argent mort (BF / (1 + BF)) ; Bubble Factor = 1.916 • Risk Premium = +15.71 pt
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 65.71% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Bubble Factor = 1.916, soit un Risk Premium de +15.71 pt au-dessus de 50 %. Équité requise = 65.7 %.

#### 44. `l1_math_bf_17` — Famille `icm_bubble_factor` | mtt (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : TF 6-Max (tapis 55/42/30/24/15/9, paiements 35/24/17/11/7.5/5.5). En confrontation symétrique sans argent mort, J5 (15bb) joue son tapis effectif contre J1 (55bb). Quelle équité minimale (%) requise ?
- **Hypothèses** : Confrontation symétrique sans argent mort (BF / (1 + BF)) ; Bubble Factor = 1.640 • Risk Premium = +12.12 pt
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 62.12% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Bubble Factor = 1.640, soit un Risk Premium de +12.12 pt au-dessus de 50 %. Équité requise = 62.1 %.

#### 45. `l1_math_bf_18` — Famille `icm_bubble_factor` | mtt (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : TF 6-Max (tapis 55/42/30/24/15/9, paiements 35/24/17/11/7.5/5.5). En confrontation symétrique sans argent mort, J2 (42bb) joue son tapis effectif contre J1 (55bb). Quelle équité minimale (%) requise ?
- **Hypothèses** : Confrontation symétrique sans argent mort (BF / (1 + BF)) ; Bubble Factor = 2.283 • Risk Premium = +19.54 pt
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 69.54% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Bubble Factor = 2.283, soit un Risk Premium de +19.54 pt au-dessus de 50 %. Équité requise = 69.5 %.

#### 46. `l1_math_bf_19` — Famille `icm_bubble_factor` | mtt (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Sat Top-2 (tapis 40/35/25, paiements 65/35/0). En confrontation symétrique sans argent mort, J2 (35bb) joue son tapis effectif contre J1 (40bb). Quelle équité minimale (%) requise ?
- **Hypothèses** : Confrontation symétrique sans argent mort (BF / (1 + BF)) ; Bubble Factor = 1.754 • Risk Premium = +13.69 pt
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 63.69% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Bubble Factor = 1.754, soit un Risk Premium de +13.69 pt au-dessus de 50 %. Équité requise = 63.7 %.

#### 47. `l1_math_bf_20` — Famille `icm_bubble_factor` | mtt (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Sat Top-2 (tapis 40/35/25, paiements 65/35/0). En confrontation symétrique sans argent mort, J3 (25bb) joue son tapis effectif contre J1 (40bb). Quelle équité minimale (%) requise ?
- **Hypothèses** : Confrontation symétrique sans argent mort (BF / (1 + BF)) ; Bubble Factor = 1.471 • Risk Premium = +9.53 pt
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 59.53% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Bubble Factor = 1.471, soit un Risk Premium de +9.53 pt au-dessus de 50 %. Équité requise = 59.5 %.

#### 48. `l1_math_bf_21` — Famille `icm_bubble_factor` | mtt (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 30/30/20/20, paiements 50/30/20/0). En confrontation symétrique sans argent mort, J1 (30bb) joue son tapis effectif contre J2 (30bb). Quelle équité minimale (%) requise ?
- **Hypothèses** : Confrontation symétrique sans argent mort (BF / (1 + BF)) ; Bubble Factor = 2.207 • Risk Premium = +18.82 pt
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 68.82% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Bubble Factor = 2.207, soit un Risk Premium de +18.82 pt au-dessus de 50 %. Équité requise = 68.8 %.

#### 49. `l1_math_bf_22` — Famille `icm_bubble_factor` | expresso (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Expresso 80/12/8 (tapis 50/20/5, paiements 80/12/8). En confrontation symétrique sans argent mort, J2 (20bb) joue son tapis effectif contre J1 (50bb). Quelle équité minimale (%) requise ?
- **Hypothèses** : Confrontation symétrique sans argent mort (BF / (1 + BF)) ; Bubble Factor = 1.153 • Risk Premium = +3.56 pt
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 53.56% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Bubble Factor = 1.153, soit un Risk Premium de +3.56 pt au-dessus de 50 %. Équité requise = 53.6 %.

#### 50. `l1_math_bf_23` — Famille `icm_bubble_factor` | expresso (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Expresso 80/12/8 (tapis 50/20/5, paiements 80/12/8). En confrontation symétrique sans argent mort, J3 (5bb) joue son tapis effectif contre J2 (20bb). Quelle équité minimale (%) requise ?
- **Hypothèses** : Confrontation symétrique sans argent mort (BF / (1 + BF)) ; Bubble Factor = 1.011 • Risk Premium = +0.28 pt
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 50.28% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Bubble Factor = 1.011, soit un Risk Premium de +0.28 pt au-dessus de 50 %. Équité requise = 50.3 %.

#### 51. `l1_math_bf_24` — Famille `icm_bubble_factor` | mtt (mixed)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle serrée (tapis 34/24/22/20, paiements 50/30/20/0). En confrontation symétrique sans argent mort, J2 (24bb) joue son tapis effectif contre J1 (34bb). Quelle équité minimale (%) requise ?
- **Hypothèses** : Confrontation symétrique sans argent mort (BF / (1 + BF)) ; Bubble Factor = 2.096 • Risk Premium = +17.70 pt
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 67.7% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Bubble Factor = 2.096, soit un Risk Premium de +17.70 pt au-dessus de 50 %. Équité requise = 67.7 %.

#### 52. `l1_math_bf_25` — Famille `icm_bubble_factor` | mtt (mixed)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle co-CL (tapis 32/32/20/16, paiements 50/30/20/0). En confrontation symétrique sans argent mort, J1 (32bb) joue son tapis effectif contre J2 (32bb). Quelle équité minimale (%) requise ?
- **Hypothèses** : Confrontation symétrique sans argent mort (BF / (1 + BF)) ; Bubble Factor = 2.363 • Risk Premium = +20.27 pt
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 70.27% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Bubble Factor = 2.363, soit un Risk Premium de +20.27 pt au-dessus de 50 %. Équité requise = 70.3 %.

#### 53. `l1_math_bf_26` — Famille `icm_bubble_factor` | expresso (mixed)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Expresso 80/12/8 (tapis 30/25/20, paiements 80/12/8). En confrontation symétrique sans argent mort, J2 (25bb) joue son tapis effectif contre J1 (30bb). Quelle équité minimale (%) requise ?
- **Hypothèses** : Confrontation symétrique sans argent mort (BF / (1 + BF)) ; Bubble Factor = 1.067 • Risk Premium = +1.61 pt
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 51.61% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Bubble Factor = 1.067, soit un Risk Premium de +1.61 pt au-dessus de 50 %. Équité requise = 51.6 %.

#### 54. `l1_math_bf_27` — Famille `icm_bubble_factor` | mtt (mixed)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : TF 6-Max (tapis 48/36/28/22/16/10, paiements 35/24/17/11/7.5/5.5). En confrontation symétrique sans argent mort, J3 (28bb) joue son tapis effectif contre J2 (36bb). Quelle équité minimale (%) requise ?
- **Hypothèses** : Confrontation symétrique sans argent mort (BF / (1 + BF)) ; Bubble Factor = 1.895 • Risk Premium = +15.46 pt
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 65.46% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Bubble Factor = 1.895, soit un Risk Premium de +15.46 pt au-dessus de 50 %. Équité requise = 65.5 %.

#### 55. `l1_math_pko_01` — Famille `pko_bounty_call` | pko (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Tournoi PKO : vous couvrez Vilain. Vous devez payer 12000 jetons pour un pot final de 28000 jetons, avec une prime encaissable de 5 €. Jetons en jeu : 2.5 M pour 2500 € restants au total. Quelle équité minimale (%) ajustée par la prime ?
- **Hypothèses** : Héros couvre Vilain (prime encaissable immédiatement) ; Approximation ChipEV hors ICM ; Bounty Power = 1000 jetons/€ (+5000 jetons)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 36.36% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Sans bounty = 42.9 %. Avec +5000 jetons de prime (Bounty Power 1000 j/€), le seuil descend à 36.4 %.

#### 56. `l1_math_pko_02` — Famille `pko_bounty_call` | pko (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Tournoi PKO : vous couvrez Vilain. Vous devez payer 15000 jetons pour un pot final de 36000 jetons, avec une prime encaissable de 10 €. Jetons en jeu : 3.0 M pour 3000 € restants au total. Quelle équité minimale (%) ajustée par la prime ?
- **Hypothèses** : Héros couvre Vilain (prime encaissable immédiatement) ; Approximation ChipEV hors ICM ; Bounty Power = 1000 jetons/€ (+10000 jetons)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 32.61% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Sans bounty = 41.7 %. Avec +10000 jetons de prime (Bounty Power 1000 j/€), le seuil descend à 32.6 %.

#### 57. `l1_math_pko_03` — Famille `pko_bounty_call` | pko (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Tournoi PKO : vous couvrez Vilain. Vous devez payer 18000 jetons pour un pot final de 44000 jetons, avec une prime encaissable de 15 €. Jetons en jeu : 3.5 M pour 2500 € restants au total. Quelle équité minimale (%) ajustée par la prime ?
- **Hypothèses** : Héros couvre Vilain (prime encaissable immédiatement) ; Approximation ChipEV hors ICM ; Bounty Power = 1400 jetons/€ (+21000 jetons)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 27.69% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Sans bounty = 40.9 %. Avec +21000 jetons de prime (Bounty Power 1400 j/€), le seuil descend à 27.7 %.

#### 58. `l1_math_pko_04` — Famille `pko_bounty_call` | pko (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Tournoi PKO : vous couvrez Vilain. Vous devez payer 20000 jetons pour un pot final de 50000 jetons, avec une prime encaissable de 20 €. Jetons en jeu : 2.5 M pour 3000 € restants au total. Quelle équité minimale (%) ajustée par la prime ?
- **Hypothèses** : Héros couvre Vilain (prime encaissable immédiatement) ; Approximation ChipEV hors ICM ; Bounty Power = 833 jetons/€ (+16667 jetons)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 30% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Sans bounty = 40.0 %. Avec +16667 jetons de prime (Bounty Power 833 j/€), le seuil descend à 30.0 %.

#### 59. `l1_math_pko_05` — Famille `pko_bounty_call` | pko (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Tournoi PKO : vous couvrez Vilain. Vous devez payer 22000 jetons pour un pot final de 48000 jetons, avec une prime encaissable de 25 €. Jetons en jeu : 3.0 M pour 2500 € restants au total. Quelle équité minimale (%) ajustée par la prime ?
- **Hypothèses** : Héros couvre Vilain (prime encaissable immédiatement) ; Approximation ChipEV hors ICM ; Bounty Power = 1200 jetons/€ (+30000 jetons)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 28.21% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Sans bounty = 45.8 %. Avec +30000 jetons de prime (Bounty Power 1200 j/€), le seuil descend à 28.2 %.

#### 60. `l1_math_pko_06` — Famille `pko_bounty_call` | pko (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Tournoi PKO : vous couvrez Vilain. Vous devez payer 24000 jetons pour un pot final de 54000 jetons, avec une prime encaissable de 30 €. Jetons en jeu : 3.5 M pour 3000 € restants au total. Quelle équité minimale (%) ajustée par la prime ?
- **Hypothèses** : Héros couvre Vilain (prime encaissable immédiatement) ; Approximation ChipEV hors ICM ; Bounty Power = 1167 jetons/€ (+35000 jetons)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 26.97% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Sans bounty = 44.4 %. Avec +35000 jetons de prime (Bounty Power 1167 j/€), le seuil descend à 27.0 %.

#### 61. `l1_math_pko_07` — Famille `pko_bounty_call` | pko (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Tournoi PKO : vous couvrez Vilain. Vous devez payer 14000 jetons pour un pot final de 36000 jetons, avec une prime encaissable de 5 €. Jetons en jeu : 2.5 M pour 2500 € restants au total. Quelle équité minimale (%) ajustée par la prime ?
- **Hypothèses** : Héros couvre Vilain (prime encaissable immédiatement) ; Approximation ChipEV hors ICM ; Bounty Power = 1000 jetons/€ (+5000 jetons)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 34.15% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Sans bounty = 38.9 %. Avec +5000 jetons de prime (Bounty Power 1000 j/€), le seuil descend à 34.1 %.

#### 62. `l1_math_pko_08` — Famille `pko_bounty_call` | pko (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Tournoi PKO : vous couvrez Vilain. Vous devez payer 16000 jetons pour un pot final de 42000 jetons, avec une prime encaissable de 10 €. Jetons en jeu : 3.0 M pour 3000 € restants au total. Quelle équité minimale (%) ajustée par la prime ?
- **Hypothèses** : Héros couvre Vilain (prime encaissable immédiatement) ; Approximation ChipEV hors ICM ; Bounty Power = 1000 jetons/€ (+10000 jetons)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 30.77% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Sans bounty = 38.1 %. Avec +10000 jetons de prime (Bounty Power 1000 j/€), le seuil descend à 30.8 %.

#### 63. `l1_math_pko_09` — Famille `pko_bounty_call` | pko (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Tournoi PKO : vous couvrez Vilain. Vous devez payer 25000 jetons pour un pot final de 54000 jetons, avec une prime encaissable de 15 €. Jetons en jeu : 3.5 M pour 2500 € restants au total. Quelle équité minimale (%) ajustée par la prime ?
- **Hypothèses** : Héros couvre Vilain (prime encaissable immédiatement) ; Approximation ChipEV hors ICM ; Bounty Power = 1400 jetons/€ (+21000 jetons)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 33.33% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Sans bounty = 46.3 %. Avec +21000 jetons de prime (Bounty Power 1400 j/€), le seuil descend à 33.3 %.

#### 64. `l1_math_pko_10` — Famille `pko_bounty_call` | pko (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Tournoi PKO : vous couvrez Vilain. Vous devez payer 30000 jetons pour un pot final de 66000 jetons, avec une prime encaissable de 20 €. Jetons en jeu : 2.5 M pour 3000 € restants au total. Quelle équité minimale (%) ajustée par la prime ?
- **Hypothèses** : Héros couvre Vilain (prime encaissable immédiatement) ; Approximation ChipEV hors ICM ; Bounty Power = 833 jetons/€ (+16667 jetons)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 36.29% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Sans bounty = 45.5 %. Avec +16667 jetons de prime (Bounty Power 833 j/€), le seuil descend à 36.3 %.

#### 65. `l1_math_pko_11` — Famille `pko_bounty_call` | pko (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Tournoi PKO : vous couvrez Vilain. Vous devez payer 10000 jetons pour un pot final de 28000 jetons, avec une prime encaissable de 25 €. Jetons en jeu : 3.0 M pour 2500 € restants au total. Quelle équité minimale (%) ajustée par la prime ?
- **Hypothèses** : Héros couvre Vilain (prime encaissable immédiatement) ; Approximation ChipEV hors ICM ; Bounty Power = 1200 jetons/€ (+30000 jetons)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 17.24% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Sans bounty = 35.7 %. Avec +30000 jetons de prime (Bounty Power 1200 j/€), le seuil descend à 17.2 %.

#### 66. `l1_math_pko_12` — Famille `pko_bounty_call` | pko (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Tournoi PKO : vous couvrez Vilain. Vous devez payer 19000 jetons pour un pot final de 48000 jetons, avec une prime encaissable de 30 €. Jetons en jeu : 3.5 M pour 3000 € restants au total. Quelle équité minimale (%) ajustée par la prime ?
- **Hypothèses** : Héros couvre Vilain (prime encaissable immédiatement) ; Approximation ChipEV hors ICM ; Bounty Power = 1167 jetons/€ (+35000 jetons)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 22.89% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Sans bounty = 39.6 %. Avec +35000 jetons de prime (Bounty Power 1167 j/€), le seuil descend à 22.9 %.

#### 67. `l1_math_pko_13` — Famille `pko_bounty_call` | pko (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Tournoi PKO : vous couvrez Vilain. Vous devez payer 21000 jetons pour un pot final de 46000 jetons, avec une prime encaissable de 5 €. Jetons en jeu : 2.5 M pour 2500 € restants au total. Quelle équité minimale (%) ajustée par la prime ?
- **Hypothèses** : Héros couvre Vilain (prime encaissable immédiatement) ; Approximation ChipEV hors ICM ; Bounty Power = 1000 jetons/€ (+5000 jetons)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 41.18% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Sans bounty = 45.7 %. Avec +5000 jetons de prime (Bounty Power 1000 j/€), le seuil descend à 41.2 %.

#### 68. `l1_math_pko_14` — Famille `pko_bounty_call` | pko (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Tournoi PKO : vous couvrez Vilain. Vous devez payer 27000 jetons pour un pot final de 60000 jetons, avec une prime encaissable de 10 €. Jetons en jeu : 3.0 M pour 3000 € restants au total. Quelle équité minimale (%) ajustée par la prime ?
- **Hypothèses** : Héros couvre Vilain (prime encaissable immédiatement) ; Approximation ChipEV hors ICM ; Bounty Power = 1000 jetons/€ (+10000 jetons)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 38.57% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Sans bounty = 45.0 %. Avec +10000 jetons de prime (Bounty Power 1000 j/€), le seuil descend à 38.6 %.

#### 69. `l1_math_pko_15` — Famille `pko_bounty_call` | pko (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Tournoi PKO : vous couvrez Vilain. Vous devez payer 32000 jetons pour un pot final de 72000 jetons, avec une prime encaissable de 15 €. Jetons en jeu : 3.5 M pour 2500 € restants au total. Quelle équité minimale (%) ajustée par la prime ?
- **Hypothèses** : Héros couvre Vilain (prime encaissable immédiatement) ; Approximation ChipEV hors ICM ; Bounty Power = 1400 jetons/€ (+21000 jetons)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 34.41% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Sans bounty = 44.4 %. Avec +21000 jetons de prime (Bounty Power 1400 j/€), le seuil descend à 34.4 %.

#### 70. `l1_math_pko_16` — Famille `pko_bounty_call` | pko (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Tournoi PKO : vous couvrez Vilain. Vous devez payer 17500 jetons pour un pot final de 45000 jetons, avec une prime encaissable de 20 €. Jetons en jeu : 2.5 M pour 3000 € restants au total. Quelle équité minimale (%) ajustée par la prime ?
- **Hypothèses** : Héros couvre Vilain (prime encaissable immédiatement) ; Approximation ChipEV hors ICM ; Bounty Power = 833 jetons/€ (+16667 jetons)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 28.38% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Sans bounty = 38.9 %. Avec +16667 jetons de prime (Bounty Power 833 j/€), le seuil descend à 28.4 %.

#### 71. `l1_math_pko_17` — Famille `pko_bounty_call` | pko (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Tournoi PKO : vous couvrez Vilain. Vous devez payer 8000 jetons pour un pot final de 20000 jetons, avec une prime encaissable de 25 €. Jetons en jeu : 3.0 M pour 2500 € restants au total. Quelle équité minimale (%) ajustée par la prime ?
- **Hypothèses** : Héros couvre Vilain (prime encaissable immédiatement) ; Approximation ChipEV hors ICM ; Bounty Power = 1200 jetons/€ (+30000 jetons)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 16% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Sans bounty = 40.0 %. Avec +30000 jetons de prime (Bounty Power 1200 j/€), le seuil descend à 16.0 %.

#### 72. `l1_math_pko_18` — Famille `pko_bounty_call` | pko (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Tournoi PKO : vous couvrez Vilain. Vous devez payer 11000 jetons pour un pot final de 28000 jetons, avec une prime encaissable de 30 €. Jetons en jeu : 3.5 M pour 3000 € restants au total. Quelle équité minimale (%) ajustée par la prime ?
- **Hypothèses** : Héros couvre Vilain (prime encaissable immédiatement) ; Approximation ChipEV hors ICM ; Bounty Power = 1167 jetons/€ (+35000 jetons)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 17.46% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Sans bounty = 39.3 %. Avec +35000 jetons de prime (Bounty Power 1167 j/€), le seuil descend à 17.5 %.

#### 73. `l1_math_pko_19` — Famille `pko_bounty_call` | pko (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Tournoi PKO : vous couvrez Vilain. Vous devez payer 28000 jetons pour un pot final de 64000 jetons, avec une prime encaissable de 5 €. Jetons en jeu : 2.5 M pour 2500 € restants au total. Quelle équité minimale (%) ajustée par la prime ?
- **Hypothèses** : Héros couvre Vilain (prime encaissable immédiatement) ; Approximation ChipEV hors ICM ; Bounty Power = 1000 jetons/€ (+5000 jetons)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 40.58% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Sans bounty = 43.8 %. Avec +5000 jetons de prime (Bounty Power 1000 j/€), le seuil descend à 40.6 %.

#### 74. `l1_math_pko_20` — Famille `pko_bounty_call` | pko (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Tournoi PKO : vous couvrez Vilain. Vous devez payer 35000 jetons pour un pot final de 80000 jetons, avec une prime encaissable de 10 €. Jetons en jeu : 3.0 M pour 3000 € restants au total. Quelle équité minimale (%) ajustée par la prime ?
- **Hypothèses** : Héros couvre Vilain (prime encaissable immédiatement) ; Approximation ChipEV hors ICM ; Bounty Power = 1000 jetons/€ (+10000 jetons)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 38.89% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Sans bounty = 43.8 %. Avec +10000 jetons de prime (Bounty Power 1000 j/€), le seuil descend à 38.9 %.

#### 75. `l1_math_pko_21` — Famille `pko_bounty_call` | pko (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Tournoi PKO : vous couvrez Vilain. Vous devez payer 40000 jetons pour un pot final de 84000 jetons, avec une prime encaissable de 15 €. Jetons en jeu : 3.5 M pour 2500 € restants au total. Quelle équité minimale (%) ajustée par la prime ?
- **Hypothèses** : Héros couvre Vilain (prime encaissable immédiatement) ; Approximation ChipEV hors ICM ; Bounty Power = 1400 jetons/€ (+21000 jetons)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 38.1% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Sans bounty = 47.6 %. Avec +21000 jetons de prime (Bounty Power 1400 j/€), le seuil descend à 38.1 %.

#### 76. `l1_math_pko_22` — Famille `pko_bounty_call` | pko (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Tournoi PKO : vous couvrez Vilain. Vous devez payer 13500 jetons pour un pot final de 33000 jetons, avec une prime encaissable de 20 €. Jetons en jeu : 2.5 M pour 3000 € restants au total. Quelle équité minimale (%) ajustée par la prime ?
- **Hypothèses** : Héros couvre Vilain (prime encaissable immédiatement) ; Approximation ChipEV hors ICM ; Bounty Power = 833 jetons/€ (+16667 jetons)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 27.18% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Sans bounty = 40.9 %. Avec +16667 jetons de prime (Bounty Power 833 j/€), le seuil descend à 27.2 %.

#### 77. `l1_math_pko_23` — Famille `pko_bounty_call` | pko (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Tournoi PKO : vous couvrez Vilain. Vous devez payer 26000 jetons pour un pot final de 60000 jetons, avec une prime encaissable de 25 €. Jetons en jeu : 3.0 M pour 2500 € restants au total. Quelle équité minimale (%) ajustée par la prime ?
- **Hypothèses** : Héros couvre Vilain (prime encaissable immédiatement) ; Approximation ChipEV hors ICM ; Bounty Power = 1200 jetons/€ (+30000 jetons)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 28.89% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Sans bounty = 43.3 %. Avec +30000 jetons de prime (Bounty Power 1200 j/€), le seuil descend à 28.9 %.

#### 78. `l1_math_pko_24` — Famille `pko_bounty_call` | pko (mixed)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Tournoi PKO : vous couvrez Vilain. Vous devez payer 16500 jetons pour un pot final de 43000 jetons, avec une prime encaissable de 30 €. Jetons en jeu : 3.5 M pour 3000 € restants au total. Quelle équité minimale (%) ajustée par la prime ?
- **Hypothèses** : Héros couvre Vilain (prime encaissable immédiatement) ; Approximation ChipEV hors ICM ; Bounty Power = 1167 jetons/€ (+35000 jetons)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 21.15% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Sans bounty = 38.4 %. Avec +35000 jetons de prime (Bounty Power 1167 j/€), le seuil descend à 21.1 %.

#### 79. `l1_math_pko_25` — Famille `pko_bounty_call` | pko (mixed)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Tournoi PKO : vous couvrez Vilain. Vous devez payer 20500 jetons pour un pot final de 45000 jetons, avec une prime encaissable de 5 €. Jetons en jeu : 2.5 M pour 2500 € restants au total. Quelle équité minimale (%) ajustée par la prime ?
- **Hypothèses** : Héros couvre Vilain (prime encaissable immédiatement) ; Approximation ChipEV hors ICM ; Bounty Power = 1000 jetons/€ (+5000 jetons)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 41% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Sans bounty = 45.6 %. Avec +5000 jetons de prime (Bounty Power 1000 j/€), le seuil descend à 41.0 %.

#### 80. `l1_math_pko_26` — Famille `pko_bounty_call` | pko (mixed)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Tournoi PKO : vous couvrez Vilain. Vous devez payer 23500 jetons pour un pot final de 53000 jetons, avec une prime encaissable de 10 €. Jetons en jeu : 3.0 M pour 3000 € restants au total. Quelle équité minimale (%) ajustée par la prime ?
- **Hypothèses** : Héros couvre Vilain (prime encaissable immédiatement) ; Approximation ChipEV hors ICM ; Bounty Power = 1000 jetons/€ (+10000 jetons)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 37.3% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Sans bounty = 44.3 %. Avec +10000 jetons de prime (Bounty Power 1000 j/€), le seuil descend à 37.3 %.

#### 81. `l1_math_pko_27` — Famille `pko_bounty_call` | pko (mixed)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Tournoi PKO : vous couvrez Vilain. Vous devez payer 29000 jetons pour un pot final de 66000 jetons, avec une prime encaissable de 15 €. Jetons en jeu : 3.5 M pour 2500 € restants au total. Quelle équité minimale (%) ajustée par la prime ?
- **Hypothèses** : Héros couvre Vilain (prime encaissable immédiatement) ; Approximation ChipEV hors ICM ; Bounty Power = 1400 jetons/€ (+21000 jetons)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 33.33% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Sans bounty = 43.9 %. Avec +21000 jetons de prime (Bounty Power 1400 j/€), le seuil descend à 33.3 %.

#### 82. `l1_math_odds_01` — Famille `pot_odds_exact` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Pot avant mise : 10 bb. Vilain mise 3.3 bb à la river (vous devez payer 3.3 bb pour un pot final de 16.6 bb). Quelle équité minimale (%) faut-il pour un call strictement break-even ?
- **Hypothèses** : River (aucune carte à venir, aucun rake additionnel) ; Call pur face à cette mise
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 19.88% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : 3.3 / (10 + 2 × 3.3) = 19.88 %.

#### 83. `l1_math_odds_02` — Famille `pot_odds_exact` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Pot avant mise : 10 bb. Vilain mise 5 bb à la river (vous devez payer 5 bb pour un pot final de 20.0 bb). Quelle équité minimale (%) faut-il pour un call strictement break-even ?
- **Hypothèses** : River (aucune carte à venir, aucun rake additionnel) ; Call pur face à cette mise
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 25% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : 5 / (10 + 2 × 5) = 25.00 %.

#### 84. `l1_math_odds_03` — Famille `pot_odds_exact` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Pot avant mise : 10 bb. Vilain mise 6.7 bb à la river (vous devez payer 6.7 bb pour un pot final de 23.4 bb). Quelle équité minimale (%) faut-il pour un call strictement break-even ?
- **Hypothèses** : River (aucune carte à venir, aucun rake additionnel) ; Call pur face à cette mise
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 28.63% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : 6.7 / (10 + 2 × 6.7) = 28.63 %.

#### 85. `l1_math_odds_04` — Famille `pot_odds_exact` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Pot avant mise : 10 bb. Vilain mise 7.5 bb à la river (vous devez payer 7.5 bb pour un pot final de 25.0 bb). Quelle équité minimale (%) faut-il pour un call strictement break-even ?
- **Hypothèses** : River (aucune carte à venir, aucun rake additionnel) ; Call pur face à cette mise
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 30% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : 7.5 / (10 + 2 × 7.5) = 30.00 %.

#### 86. `l1_math_odds_05` — Famille `pot_odds_exact` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Pot avant mise : 10 bb. Vilain mise 10 bb à la river (vous devez payer 10 bb pour un pot final de 30.0 bb). Quelle équité minimale (%) faut-il pour un call strictement break-even ?
- **Hypothèses** : River (aucune carte à venir, aucun rake additionnel) ; Call pur face à cette mise
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 33.33% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : 10 / (10 + 2 × 10) = 33.33 %.

#### 87. `l1_math_odds_06` — Famille `pot_odds_exact` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Pot avant mise : 10 bb. Vilain mise 12.5 bb à la river (vous devez payer 12.5 bb pour un pot final de 35.0 bb). Quelle équité minimale (%) faut-il pour un call strictement break-even ?
- **Hypothèses** : River (aucune carte à venir, aucun rake additionnel) ; Call pur face à cette mise
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 35.71% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : 12.5 / (10 + 2 × 12.5) = 35.71 %.

#### 88. `l1_math_odds_07` — Famille `pot_odds_exact` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Pot avant mise : 10 bb. Vilain mise 15 bb à la river (vous devez payer 15 bb pour un pot final de 40.0 bb). Quelle équité minimale (%) faut-il pour un call strictement break-even ?
- **Hypothèses** : River (aucune carte à venir, aucun rake additionnel) ; Call pur face à cette mise
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 37.5% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : 15 / (10 + 2 × 15) = 37.50 %.

#### 89. `l1_math_odds_08` — Famille `pot_odds_exact` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Pot avant mise : 12 bb. Vilain mise 4 bb à la river (vous devez payer 4 bb pour un pot final de 20.0 bb). Quelle équité minimale (%) faut-il pour un call strictement break-even ?
- **Hypothèses** : River (aucune carte à venir, aucun rake additionnel) ; Call pur face à cette mise
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 20% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : 4 / (12 + 2 × 4) = 20.00 %.

#### 90. `l1_math_odds_09` — Famille `pot_odds_exact` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Pot avant mise : 12 bb. Vilain mise 6 bb à la river (vous devez payer 6 bb pour un pot final de 24.0 bb). Quelle équité minimale (%) faut-il pour un call strictement break-even ?
- **Hypothèses** : River (aucune carte à venir, aucun rake additionnel) ; Call pur face à cette mise
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 25% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : 6 / (12 + 2 × 6) = 25.00 %.

#### 91. `l1_math_odds_10` — Famille `pot_odds_exact` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Pot avant mise : 12 bb. Vilain mise 9 bb à la river (vous devez payer 9 bb pour un pot final de 30.0 bb). Quelle équité minimale (%) faut-il pour un call strictement break-even ?
- **Hypothèses** : River (aucune carte à venir, aucun rake additionnel) ; Call pur face à cette mise
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 30% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : 9 / (12 + 2 × 9) = 30.00 %.

#### 92. `l1_math_odds_11` — Famille `pot_odds_exact` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Pot avant mise : 15 bb. Vilain mise 5 bb à la river (vous devez payer 5 bb pour un pot final de 25.0 bb). Quelle équité minimale (%) faut-il pour un call strictement break-even ?
- **Hypothèses** : River (aucune carte à venir, aucun rake additionnel) ; Call pur face à cette mise
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 20% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : 5 / (15 + 2 × 5) = 20.00 %.

#### 93. `l1_math_odds_12` — Famille `pot_odds_exact` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Pot avant mise : 15 bb. Vilain mise 10 bb à la river (vous devez payer 10 bb pour un pot final de 35.0 bb). Quelle équité minimale (%) faut-il pour un call strictement break-even ?
- **Hypothèses** : River (aucune carte à venir, aucun rake additionnel) ; Call pur face à cette mise
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 28.57% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : 10 / (15 + 2 × 10) = 28.57 %.

#### 94. `l1_math_odds_13` — Famille `pot_odds_exact` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Pot avant mise : 20 bb. Vilain mise 5 bb à la river (vous devez payer 5 bb pour un pot final de 30.0 bb). Quelle équité minimale (%) faut-il pour un call strictement break-even ?
- **Hypothèses** : River (aucune carte à venir, aucun rake additionnel) ; Call pur face à cette mise
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 16.67% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : 5 / (20 + 2 × 5) = 16.67 %.

#### 95. `l1_math_odds_14` — Famille `pot_odds_exact` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Pot avant mise : 20 bb. Vilain mise 10 bb à la river (vous devez payer 10 bb pour un pot final de 40.0 bb). Quelle équité minimale (%) faut-il pour un call strictement break-even ?
- **Hypothèses** : River (aucune carte à venir, aucun rake additionnel) ; Call pur face à cette mise
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 25% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : 10 / (20 + 2 × 10) = 25.00 %.

#### 96. `l1_math_odds_15` — Famille `pot_odds_exact` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Pot avant mise : 20 bb. Vilain mise 15 bb à la river (vous devez payer 15 bb pour un pot final de 50.0 bb). Quelle équité minimale (%) faut-il pour un call strictement break-even ?
- **Hypothèses** : River (aucune carte à venir, aucun rake additionnel) ; Call pur face à cette mise
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 30% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : 15 / (20 + 2 × 15) = 30.00 %.

#### 97. `l1_math_odds_16` — Famille `pot_odds_exact` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Pot avant mise : 24 bb. Vilain mise 18 bb à la river (vous devez payer 18 bb pour un pot final de 60.0 bb). Quelle équité minimale (%) faut-il pour un call strictement break-even ?
- **Hypothèses** : River (aucune carte à venir, aucun rake additionnel) ; Call pur face à cette mise
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 30% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : 18 / (24 + 2 × 18) = 30.00 %.

#### 98. `l1_math_odds_17` — Famille `pot_odds_exact` | cash (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Pot avant mise : 18 bb. Vilain mise 6 bb à la river (vous devez payer 6 bb pour un pot final de 30.0 bb). Quelle équité minimale (%) faut-il pour un call strictement break-even ?
- **Hypothèses** : River (aucune carte à venir, aucun rake additionnel) ; Call pur face à cette mise
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 20% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : 6 / (18 + 2 × 6) = 20.00 %.

#### 99. `l1_math_odds_18` — Famille `pot_odds_exact` | cash (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Pot avant mise : 18 bb. Vilain mise 12 bb à la river (vous devez payer 12 bb pour un pot final de 42.0 bb). Quelle équité minimale (%) faut-il pour un call strictement break-even ?
- **Hypothèses** : River (aucune carte à venir, aucun rake additionnel) ; Call pur face à cette mise
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 28.57% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : 12 / (18 + 2 × 12) = 28.57 %.

#### 100. `l1_math_odds_19` — Famille `pot_odds_exact` | cash (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Pot avant mise : 25 bb. Vilain mise 12.5 bb à la river (vous devez payer 12.5 bb pour un pot final de 50.0 bb). Quelle équité minimale (%) faut-il pour un call strictement break-even ?
- **Hypothèses** : River (aucune carte à venir, aucun rake additionnel) ; Call pur face à cette mise
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 25% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : 12.5 / (25 + 2 × 12.5) = 25.00 %.

#### 101. `l1_math_odds_20` — Famille `pot_odds_exact` | cash (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Pot avant mise : 30 bb. Vilain mise 10 bb à la river (vous devez payer 10 bb pour un pot final de 50.0 bb). Quelle équité minimale (%) faut-il pour un call strictement break-even ?
- **Hypothèses** : River (aucune carte à venir, aucun rake additionnel) ; Call pur face à cette mise
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 20% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : 10 / (30 + 2 × 10) = 20.00 %.

#### 102. `l1_math_odds_21` — Famille `pot_odds_exact` | cash (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Pot avant mise : 30 bb. Vilain mise 20 bb à la river (vous devez payer 20 bb pour un pot final de 70.0 bb). Quelle équité minimale (%) faut-il pour un call strictement break-even ?
- **Hypothèses** : River (aucune carte à venir, aucun rake additionnel) ; Call pur face à cette mise
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 28.57% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : 20 / (30 + 2 × 20) = 28.57 %.

#### 103. `l1_math_odds_22` — Famille `pot_odds_exact` | cash (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Pot avant mise : 40 bb. Vilain mise 30 bb à la river (vous devez payer 30 bb pour un pot final de 100.0 bb). Quelle équité minimale (%) faut-il pour un call strictement break-even ?
- **Hypothèses** : River (aucune carte à venir, aucun rake additionnel) ; Call pur face à cette mise
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 30% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : 30 / (40 + 2 × 30) = 30.00 %.

#### 104. `l1_math_odds_23` — Famille `pot_odds_exact` | cash (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Pot avant mise : 50 bb. Vilain mise 25 bb à la river (vous devez payer 25 bb pour un pot final de 100.0 bb). Quelle équité minimale (%) faut-il pour un call strictement break-even ?
- **Hypothèses** : River (aucune carte à venir, aucun rake additionnel) ; Call pur face à cette mise
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 25% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : 25 / (50 + 2 × 25) = 25.00 %.

#### 105. `l1_math_odds_24` — Famille `pot_odds_exact` | cash (mixed)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Pot avant mise : 14 bb. Vilain mise 7 bb à la river (vous devez payer 7 bb pour un pot final de 28.0 bb). Quelle équité minimale (%) faut-il pour un call strictement break-even ?
- **Hypothèses** : River (aucune carte à venir, aucun rake additionnel) ; Call pur face à cette mise
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 25% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : 7 / (14 + 2 × 7) = 25.00 %.

#### 106. `l1_math_odds_25` — Famille `pot_odds_exact` | cash (mixed)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Pot avant mise : 16 bb. Vilain mise 12 bb à la river (vous devez payer 12 bb pour un pot final de 40.0 bb). Quelle équité minimale (%) faut-il pour un call strictement break-even ?
- **Hypothèses** : River (aucune carte à venir, aucun rake additionnel) ; Call pur face à cette mise
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 30% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : 12 / (16 + 2 × 12) = 30.00 %.

#### 107. `l1_math_odds_26` — Famille `pot_odds_exact` | cash (mixed)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Pot avant mise : 22 bb. Vilain mise 11 bb à la river (vous devez payer 11 bb pour un pot final de 44.0 bb). Quelle équité minimale (%) faut-il pour un call strictement break-even ?
- **Hypothèses** : River (aucune carte à venir, aucun rake additionnel) ; Call pur face à cette mise
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 25% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : 11 / (22 + 2 × 11) = 25.00 %.

#### 108. `l1_math_odds_27` — Famille `pot_odds_exact` | cash (mixed)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Pot avant mise : 28 bb. Vilain mise 21 bb à la river (vous devez payer 21 bb pour un pot final de 70.0 bb). Quelle équité minimale (%) faut-il pour un call strictement break-even ?
- **Hypothèses** : River (aucune carte à venir, aucun rake additionnel) ; Call pur face à cette mise
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 30% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : 21 / (28 + 2 × 21) = 30.00 %.

#### 109. `l1_math_outs_01` — Famille `outs_turn_river` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Calcul exact de probabilité d'outs : Quinte ventrale (4 outs) Flop → Turn. Quelle est la probabilité exacte (%) de toucher au moins un de ces 4 outs ?
- **Hypothèses** : 47 cartes inconnues au flop ; Outs supposés tous vivants (clean)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 8.51% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Probabilité combinatoire exacte : 8.51 % (la règle 2×/4× sert uniquement d'estimation mentale rapide).

#### 110. `l1_math_outs_02` — Famille `outs_turn_river` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Calcul exact de probabilité d'outs : Quinte ventrale (4 outs) Turn → River. Quelle est la probabilité exacte (%) de toucher au moins un de ces 4 outs ?
- **Hypothèses** : 46 cartes inconnues au turn ; Outs supposés tous vivants (clean)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 8.7% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Probabilité combinatoire exacte : 8.70 % (la règle 2×/4× sert uniquement d'estimation mentale rapide).

#### 111. `l1_math_outs_03` — Famille `outs_turn_river` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Calcul exact de probabilité d'outs : Quinte ventrale (4 outs) Flop → River. Quelle est la probabilité exacte (%) de toucher au moins un de ces 4 outs ?
- **Hypothèses** : 47 puis 46 cartes inconnues (tapis au flop) ; Outs supposés tous vivants (clean)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 16.47% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Probabilité combinatoire exacte : 16.47 % (la règle 2×/4× sert uniquement d'estimation mentale rapide).

#### 112. `l1_math_outs_04` — Famille `outs_turn_river` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Calcul exact de probabilité d'outs : OESD (8 outs) Flop → Turn. Quelle est la probabilité exacte (%) de toucher au moins un de ces 8 outs ?
- **Hypothèses** : 47 cartes inconnues au flop ; Outs supposés tous vivants (clean)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 17.02% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Probabilité combinatoire exacte : 17.02 % (la règle 2×/4× sert uniquement d'estimation mentale rapide).

#### 113. `l1_math_outs_05` — Famille `outs_turn_river` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Calcul exact de probabilité d'outs : OESD (8 outs) Turn → River. Quelle est la probabilité exacte (%) de toucher au moins un de ces 8 outs ?
- **Hypothèses** : 46 cartes inconnues au turn ; Outs supposés tous vivants (clean)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 17.39% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Probabilité combinatoire exacte : 17.39 % (la règle 2×/4× sert uniquement d'estimation mentale rapide).

#### 114. `l1_math_outs_06` — Famille `outs_turn_river` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Calcul exact de probabilité d'outs : OESD (8 outs) Flop → River. Quelle est la probabilité exacte (%) de toucher au moins un de ces 8 outs ?
- **Hypothèses** : 47 puis 46 cartes inconnues (tapis au flop) ; Outs supposés tous vivants (clean)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 31.45% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Probabilité combinatoire exacte : 31.45 % (la règle 2×/4× sert uniquement d'estimation mentale rapide).

#### 115. `l1_math_outs_07` — Famille `outs_turn_river` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Calcul exact de probabilité d'outs : Tirage couleur (9 outs) Flop → Turn. Quelle est la probabilité exacte (%) de toucher au moins un de ces 9 outs ?
- **Hypothèses** : 47 cartes inconnues au flop ; Outs supposés tous vivants (clean)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 19.15% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Probabilité combinatoire exacte : 19.15 % (la règle 2×/4× sert uniquement d'estimation mentale rapide).

#### 116. `l1_math_outs_08` — Famille `outs_turn_river` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Calcul exact de probabilité d'outs : Tirage couleur (9 outs) Turn → River. Quelle est la probabilité exacte (%) de toucher au moins un de ces 9 outs ?
- **Hypothèses** : 46 cartes inconnues au turn ; Outs supposés tous vivants (clean)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 19.57% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Probabilité combinatoire exacte : 19.57 % (la règle 2×/4× sert uniquement d'estimation mentale rapide).

#### 117. `l1_math_outs_09` — Famille `outs_turn_river` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Calcul exact de probabilité d'outs : Tirage couleur (9 outs) Flop → River. Quelle est la probabilité exacte (%) de toucher au moins un de ces 9 outs ?
- **Hypothèses** : 47 puis 46 cartes inconnues (tapis au flop) ; Outs supposés tous vivants (clean)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 34.97% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Probabilité combinatoire exacte : 34.97 % (la règle 2×/4× sert uniquement d'estimation mentale rapide).

#### 118. `l1_math_outs_10` — Famille `outs_turn_river` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Calcul exact de probabilité d'outs : Couleur + gutshot (12 outs) Flop → Turn. Quelle est la probabilité exacte (%) de toucher au moins un de ces 12 outs ?
- **Hypothèses** : 47 cartes inconnues au flop ; Outs supposés tous vivants (clean)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 25.53% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Probabilité combinatoire exacte : 25.53 % (la règle 2×/4× sert uniquement d'estimation mentale rapide).

#### 119. `l1_math_outs_11` — Famille `outs_turn_river` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Calcul exact de probabilité d'outs : Couleur + gutshot (12 outs) Turn → River. Quelle est la probabilité exacte (%) de toucher au moins un de ces 12 outs ?
- **Hypothèses** : 46 cartes inconnues au turn ; Outs supposés tous vivants (clean)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 26.09% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Probabilité combinatoire exacte : 26.09 % (la règle 2×/4× sert uniquement d'estimation mentale rapide).

#### 120. `l1_math_outs_12` — Famille `outs_turn_river` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Calcul exact de probabilité d'outs : Couleur + gutshot (12 outs) Flop → River. Quelle est la probabilité exacte (%) de toucher au moins un de ces 12 outs ?
- **Hypothèses** : 47 puis 46 cartes inconnues (tapis au flop) ; Outs supposés tous vivants (clean)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 44.96% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Probabilité combinatoire exacte : 44.96 % (la règle 2×/4× sert uniquement d'estimation mentale rapide).

#### 121. `l1_math_outs_13` — Famille `outs_turn_river` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Calcul exact de probabilité d'outs : Combo Draw (15 outs) Flop → Turn. Quelle est la probabilité exacte (%) de toucher au moins un de ces 15 outs ?
- **Hypothèses** : 47 cartes inconnues au flop ; Outs supposés tous vivants (clean)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 31.91% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Probabilité combinatoire exacte : 31.91 % (la règle 2×/4× sert uniquement d'estimation mentale rapide).

#### 122. `l1_math_outs_14` — Famille `outs_turn_river` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Calcul exact de probabilité d'outs : Combo Draw (15 outs) Turn → River. Quelle est la probabilité exacte (%) de toucher au moins un de ces 15 outs ?
- **Hypothèses** : 46 cartes inconnues au turn ; Outs supposés tous vivants (clean)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 32.61% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Probabilité combinatoire exacte : 32.61 % (la règle 2×/4× sert uniquement d'estimation mentale rapide).

#### 123. `l1_math_outs_15` — Famille `outs_turn_river` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Calcul exact de probabilité d'outs : Combo Draw (15 outs) Flop → River. Quelle est la probabilité exacte (%) de toucher au moins un de ces 15 outs ?
- **Hypothèses** : 47 puis 46 cartes inconnues (tapis au flop) ; Outs supposés tous vivants (clean)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 54.12% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Probabilité combinatoire exacte : 54.12 % (la règle 2×/4× sert uniquement d'estimation mentale rapide).

#### 124. `l1_math_outs_16` — Famille `outs_turn_river` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Calcul exact de probabilité d'outs : 2 overcards (6 outs) Flop → River. Quelle est la probabilité exacte (%) de toucher au moins un de ces 6 outs ?
- **Hypothèses** : 47 puis 46 cartes inconnues (tapis au flop) ; Outs supposés tous vivants (clean)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 24.14% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Probabilité combinatoire exacte : 24.14 % (la règle 2×/4× sert uniquement d'estimation mentale rapide).

#### 125. `l1_math_outs_17` — Famille `outs_turn_river` | cash (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Calcul exact de probabilité d'outs : Paire vers brelan (2 outs) Flop → River. Quelle est la probabilité exacte (%) de toucher au moins un de ces 2 outs ?
- **Hypothèses** : 47 puis 46 cartes inconnues (tapis au flop) ; Outs supposés tous vivants (clean)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 8.42% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Probabilité combinatoire exacte : 8.42 % (la règle 2×/4× sert uniquement d'estimation mentale rapide).

#### 126. `l1_math_outs_18` — Famille `outs_turn_river` | cash (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Calcul exact de probabilité d'outs : Paire vers DP/brelan (5 outs) Turn → River. Quelle est la probabilité exacte (%) de toucher au moins un de ces 5 outs ?
- **Hypothèses** : 46 cartes inconnues au turn ; Outs supposés tous vivants (clean)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 10.87% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Probabilité combinatoire exacte : 10.87 % (la règle 2×/4× sert uniquement d'estimation mentale rapide).

#### 127. `l1_math_outs_19` — Famille `outs_turn_river` | cash (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Calcul exact de probabilité d'outs : Brelan vers full/carré (7 outs) Flop → River. Quelle est la probabilité exacte (%) de toucher au moins un de ces 7 outs ?
- **Hypothèses** : 47 puis 46 cartes inconnues (tapis au flop) ; Outs supposés tous vivants (clean)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 27.84% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Probabilité combinatoire exacte : 27.84 % (la règle 2×/4× sert uniquement d'estimation mentale rapide).

#### 128. `l1_math_outs_20` — Famille `outs_turn_river` | cash (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Calcul exact de probabilité d'outs : Brelan vers full/carré (10 outs) Turn → River. Quelle est la probabilité exacte (%) de toucher au moins un de ces 10 outs ?
- **Hypothèses** : 46 cartes inconnues au turn ; Outs supposés tous vivants (clean)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 21.74% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Probabilité combinatoire exacte : 21.74 % (la règle 2×/4× sert uniquement d'estimation mentale rapide).

#### 129. `l1_math_outs_21` — Famille `outs_turn_river` | cash (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Calcul exact de probabilité d'outs : OESD + 1 overcard (11 outs) Flop → River. Quelle est la probabilité exacte (%) de toucher au moins un de ces 11 outs ?
- **Hypothèses** : 47 puis 46 cartes inconnues (tapis au flop) ; Outs supposés tous vivants (clean)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 41.72% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Probabilité combinatoire exacte : 41.72 % (la règle 2×/4× sert uniquement d'estimation mentale rapide).

#### 130. `l1_math_outs_22` — Famille `outs_turn_river` | cash (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Calcul exact de probabilité d'outs : Couleur + 2 overcards propres (14 outs) Turn → River. Quelle est la probabilité exacte (%) de toucher au moins un de ces 14 outs ?
- **Hypothèses** : 46 cartes inconnues au turn ; Outs supposés tous vivants (clean)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 30.43% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Probabilité combinatoire exacte : 30.43 % (la règle 2×/4× sert uniquement d'estimation mentale rapide).

#### 131. `l1_math_outs_23` — Famille `outs_turn_river` | cash (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Calcul exact de probabilité d'outs : Mega Combo Draw (17 outs) Flop → River. Quelle est la probabilité exacte (%) de toucher au moins un de ces 17 outs ?
- **Hypothèses** : 47 puis 46 cartes inconnues (tapis au flop) ; Outs supposés tous vivants (clean)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 59.76% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Probabilité combinatoire exacte : 59.76 % (la règle 2×/4× sert uniquement d'estimation mentale rapide).

#### 132. `l1_math_outs_24` — Famille `outs_turn_river` | cash (mixed)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Calcul exact de probabilité d'outs : Une overcard propre (3 outs) Flop → Turn. Quelle est la probabilité exacte (%) de toucher au moins un de ces 3 outs ?
- **Hypothèses** : 47 cartes inconnues au flop ; Outs supposés tous vivants (clean)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 6.38% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Probabilité combinatoire exacte : 6.38 % (la règle 2×/4× sert uniquement d'estimation mentale rapide).

#### 133. `l1_math_outs_25` — Famille `outs_turn_river` | cash (mixed)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Calcul exact de probabilité d'outs : 2 overcards (6 outs) Turn → River. Quelle est la probabilité exacte (%) de toucher au moins un de ces 6 outs ?
- **Hypothèses** : 46 cartes inconnues au turn ; Outs supposés tous vivants (clean)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 13.04% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Probabilité combinatoire exacte : 13.04 % (la règle 2×/4× sert uniquement d'estimation mentale rapide).

#### 134. `l1_math_outs_26` — Famille `outs_turn_river` | cash (mixed)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Calcul exact de probabilité d'outs : Double DP + gutshot (10 outs) Flop → Turn. Quelle est la probabilité exacte (%) de toucher au moins un de ces 10 outs ?
- **Hypothèses** : 47 cartes inconnues au flop ; Outs supposés tous vivants (clean)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 21.28% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Probabilité combinatoire exacte : 21.28 % (la règle 2×/4× sert uniquement d'estimation mentale rapide).

#### 135. `l1_math_outs_27` — Famille `outs_turn_river` | cash (mixed)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Calcul exact de probabilité d'outs : Couleur + backdoor/pair (13 outs) Flop → Turn. Quelle est la probabilité exacte (%) de toucher au moins un de ces 13 outs ?
- **Hypothèses** : 47 cartes inconnues au flop ; Outs supposés tous vivants (clean)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 27.66% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Probabilité combinatoire exacte : 27.66 % (la règle 2×/4× sert uniquement d'estimation mentale rapide).

#### 136. `l1_math_blk_01` — Famille `combos_blockers` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Vous tenez AKs (4 combos). Sur la range de 4-Bet value adverse {AA, KK, AK} (28 combos sans bloqueur), quel pourcentage (%) des combos reste-t-il réellement disponible chez Vilain ?
- **Hypothèses** : Sans bloqueurs : AA = 6, KK = 6, AK = 16 (total 28 combos) ; Avec AKs : il reste AA=3, KK=3, AK=9 (15/28 combos)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 53.57% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Votre main AKs réduit {AA, KK, AK} de 28 à 15 combos, soit 53.6 % restant (46.4 % bloqués).

#### 137. `l1_math_blk_02` — Famille `combos_blockers` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Vous tenez AQs (4 combos). Sur la range de 4-Bet value adverse {AA, KK, AK} (28 combos sans bloqueur), quel pourcentage (%) des combos reste-t-il réellement disponible chez Vilain ?
- **Hypothèses** : Sans bloqueurs : AA = 6, KK = 6, AK = 16 (total 28 combos) ; Avec AQs : il reste AA=3, KK=6, AK=12 (21/28 combos)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 75% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Votre main AQs réduit {AA, KK, AK} de 28 à 21 combos, soit 75.0 % restant (25.0 % bloqués).

#### 138. `l1_math_blk_03` — Famille `combos_blockers` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Vous tenez A5s (4 combos). Sur la range de 4-Bet value adverse {AA, KK, AK} (28 combos sans bloqueur), quel pourcentage (%) des combos reste-t-il réellement disponible chez Vilain ?
- **Hypothèses** : Sans bloqueurs : AA = 6, KK = 6, AK = 16 (total 28 combos) ; Avec A5s : il reste AA=3, KK=6, AK=12 (21/28 combos)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 75% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Votre main A5s réduit {AA, KK, AK} de 28 à 21 combos, soit 75.0 % restant (25.0 % bloqués).

#### 139. `l1_math_blk_04` — Famille `combos_blockers` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Vous tenez KQs (4 combos). Sur la range de 4-Bet value adverse {AA, KK, AK} (28 combos sans bloqueur), quel pourcentage (%) des combos reste-t-il réellement disponible chez Vilain ?
- **Hypothèses** : Sans bloqueurs : AA = 6, KK = 6, AK = 16 (total 28 combos) ; Avec KQs : il reste AA=6, KK=3, AK=12 (21/28 combos)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 75% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Votre main KQs réduit {AA, KK, AK} de 28 à 21 combos, soit 75.0 % restant (25.0 % bloqués).

#### 140. `l1_math_blk_05` — Famille `combos_blockers` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Vous tenez QQ (6 combos). Sur la range de 4-Bet value adverse {AA, KK, AK} (28 combos sans bloqueur), quel pourcentage (%) des combos reste-t-il réellement disponible chez Vilain ?
- **Hypothèses** : Sans bloqueurs : AA = 6, KK = 6, AK = 16 (total 28 combos) ; Avec QQ : il reste AA=6, KK=6, AK=16 (28/28 combos)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 100% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Votre main QQ réduit {AA, KK, AK} de 28 à 28 combos, soit 100.0 % restant (0.0 % bloqués).

#### 141. `l1_math_blk_06` — Famille `combos_blockers` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Vous tenez AA (6 combos). Sur la range de 4-Bet value adverse {AA, KK, AK} (28 combos sans bloqueur), quel pourcentage (%) des combos reste-t-il réellement disponible chez Vilain ?
- **Hypothèses** : Sans bloqueurs : AA = 6, KK = 6, AK = 16 (total 28 combos) ; Avec AA : il reste AA=1, KK=6, AK=8 (15/28 combos)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 53.57% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Votre main AA réduit {AA, KK, AK} de 28 à 15 combos, soit 53.6 % restant (46.4 % bloqués).

#### 142. `l1_math_blk_07` — Famille `combos_blockers` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Vous tenez KK (6 combos). Sur la range de 4-Bet value adverse {AA, KK, AK} (28 combos sans bloqueur), quel pourcentage (%) des combos reste-t-il réellement disponible chez Vilain ?
- **Hypothèses** : Sans bloqueurs : AA = 6, KK = 6, AK = 16 (total 28 combos) ; Avec KK : il reste AA=6, KK=1, AK=8 (15/28 combos)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 53.57% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Votre main KK réduit {AA, KK, AK} de 28 à 15 combos, soit 53.6 % restant (46.4 % bloqués).

#### 143. `l1_math_blk_08` — Famille `combos_blockers` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Vous tenez AKo (12 combos). Sur la range de 4-Bet value adverse {AA, KK, AK} (28 combos sans bloqueur), quel pourcentage (%) des combos reste-t-il réellement disponible chez Vilain ?
- **Hypothèses** : Sans bloqueurs : AA = 6, KK = 6, AK = 16 (total 28 combos) ; Avec AKo : il reste AA=3, KK=3, AK=9 (15/28 combos)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 53.57% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Votre main AKo réduit {AA, KK, AK} de 28 à 15 combos, soit 53.6 % restant (46.4 % bloqués).

#### 144. `l1_math_blk_09` — Famille `combos_blockers` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Vous tenez AJo (12 combos). Sur la range de 4-Bet value adverse {AA, KK, AK} (28 combos sans bloqueur), quel pourcentage (%) des combos reste-t-il réellement disponible chez Vilain ?
- **Hypothèses** : Sans bloqueurs : AA = 6, KK = 6, AK = 16 (total 28 combos) ; Avec AJo : il reste AA=3, KK=6, AK=12 (21/28 combos)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 75% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Votre main AJo réduit {AA, KK, AK} de 28 à 21 combos, soit 75.0 % restant (25.0 % bloqués).

#### 145. `l1_math_blk_10` — Famille `combos_blockers` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Vous tenez KJs (4 combos). Sur la range de 4-Bet value adverse {AA, KK, AK} (28 combos sans bloqueur), quel pourcentage (%) des combos reste-t-il réellement disponible chez Vilain ?
- **Hypothèses** : Sans bloqueurs : AA = 6, KK = 6, AK = 16 (total 28 combos) ; Avec KJs : il reste AA=6, KK=3, AK=12 (21/28 combos)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 75% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Votre main KJs réduit {AA, KK, AK} de 28 à 21 combos, soit 75.0 % restant (25.0 % bloqués).

#### 146. `l1_math_blk_11` — Famille `combos_blockers` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Vous tenez QJs (4 combos). Sur la range de 4-Bet value adverse {AA, KK, AK} (28 combos sans bloqueur), quel pourcentage (%) des combos reste-t-il réellement disponible chez Vilain ?
- **Hypothèses** : Sans bloqueurs : AA = 6, KK = 6, AK = 16 (total 28 combos) ; Avec QJs : il reste AA=6, KK=6, AK=16 (28/28 combos)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 100% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Votre main QJs réduit {AA, KK, AK} de 28 à 28 combos, soit 100.0 % restant (0.0 % bloqués).

#### 147. `l1_math_blk_12` — Famille `combos_blockers` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Vous tenez ATs (4 combos). Sur la range de 4-Bet value adverse {AA, KK, AK} (28 combos sans bloqueur), quel pourcentage (%) des combos reste-t-il réellement disponible chez Vilain ?
- **Hypothèses** : Sans bloqueurs : AA = 6, KK = 6, AK = 16 (total 28 combos) ; Avec ATs : il reste AA=3, KK=6, AK=12 (21/28 combos)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 75% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Votre main ATs réduit {AA, KK, AK} de 28 à 21 combos, soit 75.0 % restant (25.0 % bloqués).

#### 148. `l1_math_blk_13` — Famille `combos_blockers` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Vous tenez KQo (12 combos). Sur la range de 4-Bet value adverse {AA, KK, AK} (28 combos sans bloqueur), quel pourcentage (%) des combos reste-t-il réellement disponible chez Vilain ?
- **Hypothèses** : Sans bloqueurs : AA = 6, KK = 6, AK = 16 (total 28 combos) ; Avec KQo : il reste AA=6, KK=3, AK=12 (21/28 combos)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 75% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Votre main KQo réduit {AA, KK, AK} de 28 à 21 combos, soit 75.0 % restant (25.0 % bloqués).

#### 149. `l1_math_blk_14` — Famille `combos_blockers` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Vous tenez A4s (4 combos). Sur la range de 4-Bet value adverse {AA, KK, AK} (28 combos sans bloqueur), quel pourcentage (%) des combos reste-t-il réellement disponible chez Vilain ?
- **Hypothèses** : Sans bloqueurs : AA = 6, KK = 6, AK = 16 (total 28 combos) ; Avec A4s : il reste AA=3, KK=6, AK=12 (21/28 combos)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 75% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Votre main A4s réduit {AA, KK, AK} de 28 à 21 combos, soit 75.0 % restant (25.0 % bloqués).

#### 150. `l1_math_blk_15` — Famille `combos_blockers` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Vous tenez A9s (4 combos). Sur la range de 4-Bet value adverse {AA, KK, AK} (28 combos sans bloqueur), quel pourcentage (%) des combos reste-t-il réellement disponible chez Vilain ?
- **Hypothèses** : Sans bloqueurs : AA = 6, KK = 6, AK = 16 (total 28 combos) ; Avec A9s : il reste AA=3, KK=6, AK=12 (21/28 combos)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 75% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Votre main A9s réduit {AA, KK, AK} de 28 à 21 combos, soit 75.0 % restant (25.0 % bloqués).

#### 151. `l1_math_blk_16` — Famille `combos_blockers` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Vous tenez JJ (6 combos). Sur la range de 4-Bet value adverse {AA, KK, AK} (28 combos sans bloqueur), quel pourcentage (%) des combos reste-t-il réellement disponible chez Vilain ?
- **Hypothèses** : Sans bloqueurs : AA = 6, KK = 6, AK = 16 (total 28 combos) ; Avec JJ : il reste AA=6, KK=6, AK=16 (28/28 combos)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 100% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Votre main JJ réduit {AA, KK, AK} de 28 à 28 combos, soit 100.0 % restant (0.0 % bloqués).

#### 152. `l1_math_blk_17` — Famille `combos_blockers` | cash (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Vous tenez A8o (12 combos). Sur la range de 4-Bet value adverse {AA, KK, AK} (28 combos sans bloqueur), quel pourcentage (%) des combos reste-t-il réellement disponible chez Vilain ?
- **Hypothèses** : Sans bloqueurs : AA = 6, KK = 6, AK = 16 (total 28 combos) ; Avec A8o : il reste AA=3, KK=6, AK=12 (21/28 combos)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 75% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Votre main A8o réduit {AA, KK, AK} de 28 à 21 combos, soit 75.0 % restant (25.0 % bloqués).

#### 153. `l1_math_blk_18` — Famille `combos_blockers` | cash (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Vous tenez KTs (4 combos). Sur la range de 4-Bet value adverse {AA, KK, AK} (28 combos sans bloqueur), quel pourcentage (%) des combos reste-t-il réellement disponible chez Vilain ?
- **Hypothèses** : Sans bloqueurs : AA = 6, KK = 6, AK = 16 (total 28 combos) ; Avec KTs : il reste AA=6, KK=3, AK=12 (21/28 combos)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 75% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Votre main KTs réduit {AA, KK, AK} de 28 à 21 combos, soit 75.0 % restant (25.0 % bloqués).

#### 154. `l1_math_blk_19` — Famille `combos_blockers` | cash (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Vous tenez QTs (4 combos). Sur la range de 4-Bet value adverse {AA, KK, AK} (28 combos sans bloqueur), quel pourcentage (%) des combos reste-t-il réellement disponible chez Vilain ?
- **Hypothèses** : Sans bloqueurs : AA = 6, KK = 6, AK = 16 (total 28 combos) ; Avec QTs : il reste AA=6, KK=6, AK=16 (28/28 combos)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 100% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Votre main QTs réduit {AA, KK, AK} de 28 à 28 combos, soit 100.0 % restant (0.0 % bloqués).

#### 155. `l1_math_blk_20` — Famille `combos_blockers` | cash (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Vous tenez JTs (4 combos). Sur la range de 4-Bet value adverse {AA, KK, AK} (28 combos sans bloqueur), quel pourcentage (%) des combos reste-t-il réellement disponible chez Vilain ?
- **Hypothèses** : Sans bloqueurs : AA = 6, KK = 6, AK = 16 (total 28 combos) ; Avec JTs : il reste AA=6, KK=6, AK=16 (28/28 combos)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 100% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Votre main JTs réduit {AA, KK, AK} de 28 à 28 combos, soit 100.0 % restant (0.0 % bloqués).

#### 156. `l1_math_blk_21` — Famille `combos_blockers` | cash (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Vous tenez TT (6 combos). Sur la range de 4-Bet value adverse {AA, KK, AK} (28 combos sans bloqueur), quel pourcentage (%) des combos reste-t-il réellement disponible chez Vilain ?
- **Hypothèses** : Sans bloqueurs : AA = 6, KK = 6, AK = 16 (total 28 combos) ; Avec TT : il reste AA=6, KK=6, AK=16 (28/28 combos)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 100% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Votre main TT réduit {AA, KK, AK} de 28 à 28 combos, soit 100.0 % restant (0.0 % bloqués).

#### 157. `l1_math_blk_22` — Famille `combos_blockers` | cash (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Vous tenez AQo (12 combos). Sur la range de 4-Bet value adverse {AA, KK, AK} (28 combos sans bloqueur), quel pourcentage (%) des combos reste-t-il réellement disponible chez Vilain ?
- **Hypothèses** : Sans bloqueurs : AA = 6, KK = 6, AK = 16 (total 28 combos) ; Avec AQo : il reste AA=3, KK=6, AK=12 (21/28 combos)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 75% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Votre main AQo réduit {AA, KK, AK} de 28 à 21 combos, soit 75.0 % restant (25.0 % bloqués).

#### 158. `l1_math_blk_23` — Famille `combos_blockers` | cash (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Vous tenez K9s (4 combos). Sur la range de 4-Bet value adverse {AA, KK, AK} (28 combos sans bloqueur), quel pourcentage (%) des combos reste-t-il réellement disponible chez Vilain ?
- **Hypothèses** : Sans bloqueurs : AA = 6, KK = 6, AK = 16 (total 28 combos) ; Avec K9s : il reste AA=6, KK=3, AK=12 (21/28 combos)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 75% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Votre main K9s réduit {AA, KK, AK} de 28 à 21 combos, soit 75.0 % restant (25.0 % bloqués).

#### 159. `l1_math_blk_24` — Famille `combos_blockers` | cash (mixed)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Vous tenez A2s (4 combos). Sur la range de 4-Bet value adverse {AA, KK, AK} (28 combos sans bloqueur), quel pourcentage (%) des combos reste-t-il réellement disponible chez Vilain ?
- **Hypothèses** : Sans bloqueurs : AA = 6, KK = 6, AK = 16 (total 28 combos) ; Avec A2s : il reste AA=3, KK=6, AK=12 (21/28 combos)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 75% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Votre main A2s réduit {AA, KK, AK} de 28 à 21 combos, soit 75.0 % restant (25.0 % bloqués).

#### 160. `l1_math_blk_25` — Famille `combos_blockers` | cash (mixed)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Vous tenez A3s (4 combos). Sur la range de 4-Bet value adverse {AA, KK, AK} (28 combos sans bloqueur), quel pourcentage (%) des combos reste-t-il réellement disponible chez Vilain ?
- **Hypothèses** : Sans bloqueurs : AA = 6, KK = 6, AK = 16 (total 28 combos) ; Avec A3s : il reste AA=3, KK=6, AK=12 (21/28 combos)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 75% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Votre main A3s réduit {AA, KK, AK} de 28 à 21 combos, soit 75.0 % restant (25.0 % bloqués).

#### 161. `l1_math_blk_26` — Famille `combos_blockers` | cash (mixed)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Vous tenez KQo (12 combos). Sur la range de 4-Bet value adverse {AA, KK, AK} (28 combos sans bloqueur), quel pourcentage (%) des combos reste-t-il réellement disponible chez Vilain ?
- **Hypothèses** : Sans bloqueurs : AA = 6, KK = 6, AK = 16 (total 28 combos) ; Avec KQo : il reste AA=6, KK=3, AK=12 (21/28 combos)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 75% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Votre main KQo réduit {AA, KK, AK} de 28 à 21 combos, soit 75.0 % restant (25.0 % bloqués).

#### 162. `l1_math_blk_27` — Famille `combos_blockers` | cash (mixed)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Server Exact Math Engines (L1)
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Vous tenez 99 (6 combos). Sur la range de 4-Bet value adverse {AA, KK, AK} (28 combos sans bloqueur), quel pourcentage (%) des combos reste-t-il réellement disponible chez Vilain ?
- **Hypothèses** : Sans bloqueurs : AA = 6, KK = 6, AK = 16 (total 28 combos) ; Avec 99 : il reste AA=6, KK=6, AK=16 (28/28 combos)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 100% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Votre main 99 réduit {AA, KK, AK} de 28 à 28 combos, soit 100.0 % restant (0.0 % bloqués).

---

## 10. Corpus Duel Libre Local (`mp-corpus-maths-v1` — 162 spots + 1 amicaux)

#### 1. `math_icmeq_01` — Famille `icm_equity` | mtt (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 40/25/20/15, paiements 50/30/20). J1 (40bb) shove en SB (0.5) sur Hero J2 (25bb) en BB (1). Quelle équité minimale (%) pour call ?
- **Hypothèses** : Modèle Malmuth-Harville exact, partages ignorés ; Blindes : SB 0.5bb / BB 1bb ; En ChipEV pur ce call demanderait 48%
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 68.87% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Par Malmuth-Harville exact : équité requise = 68.9% (contre 48.0% en ChipEV, soit +20.9 pt de prime ICM).

#### 2. `math_icmeq_02` — Famille `icm_equity` | mtt (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 40/25/20/15, paiements 50/30/20). J1 (40bb) shove en SB (0.5) sur Hero J3 (20bb) en BB (1). Quelle équité minimale (%) pour call ?
- **Hypothèses** : Modèle Malmuth-Harville exact, partages ignorés ; Blindes : SB 0.5bb / BB 1bb ; En ChipEV pur ce call demanderait 47.5%
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 66.24% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Par Malmuth-Harville exact : équité requise = 66.2% (contre 47.5% en ChipEV, soit +18.7 pt de prime ICM).

#### 3. `math_icmeq_03` — Famille `icm_equity` | mtt (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 40/25/20/15, paiements 50/30/20). J1 (40bb) shove en SB (0.5) sur Hero J4 (15bb) en BB (1). Quelle équité minimale (%) pour call ?
- **Hypothèses** : Modèle Malmuth-Harville exact, partages ignorés ; Blindes : SB 0.5bb / BB 1bb ; En ChipEV pur ce call demanderait 46.67%
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 61.69% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Par Malmuth-Harville exact : équité requise = 61.7% (contre 46.7% en ChipEV, soit +15.0 pt de prime ICM).

#### 4. `math_icmeq_04` — Famille `icm_equity` | mtt (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 45/28/17/10, paiements 50/30/20). J1 (45bb) shove en SB (0.5) sur Hero J2 (28bb) en BB (1). Quelle équité minimale (%) pour call ?
- **Hypothèses** : Modèle Malmuth-Harville exact, partages ignorés ; Blindes : SB 0.5bb / BB 1bb ; En ChipEV pur ce call demanderait 48.21%
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 72.59% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Par Malmuth-Harville exact : équité requise = 72.6% (contre 48.2% en ChipEV, soit +24.4 pt de prime ICM).

#### 5. `math_icmeq_05` — Famille `icm_equity` | mtt (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 45/28/17/10, paiements 50/30/20). J2 (28bb) shove en SB (0.5) sur Hero J3 (17bb) en BB (1). Quelle équité minimale (%) pour call ?
- **Hypothèses** : Modèle Malmuth-Harville exact, partages ignorés ; Blindes : SB 0.5bb / BB 1bb ; En ChipEV pur ce call demanderait 47.06%
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 65% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Par Malmuth-Harville exact : équité requise = 65.0% (contre 47.1% en ChipEV, soit +17.9 pt de prime ICM).

#### 6. `math_icmeq_06` — Famille `icm_equity` | mtt (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 50/22/18/10, paiements 50/30/20). J1 (50bb) shove en SB (0.5) sur Hero J2 (22bb) en BB (1). Quelle équité minimale (%) pour call ?
- **Hypothèses** : Modèle Malmuth-Harville exact, partages ignorés ; Blindes : SB 0.5bb / BB 1bb ; En ChipEV pur ce call demanderait 47.73%
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 71.62% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Par Malmuth-Harville exact : équité requise = 71.6% (contre 47.7% en ChipEV, soit +23.9 pt de prime ICM).

#### 7. `math_icmeq_07` — Famille `icm_equity` | mtt (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 50/22/18/10, paiements 50/30/20). J1 (50bb) shove en SB (0.5) sur Hero J3 (18bb) en BB (1). Quelle équité minimale (%) pour call ?
- **Hypothèses** : Modèle Malmuth-Harville exact, partages ignorés ; Blindes : SB 0.5bb / BB 1bb ; En ChipEV pur ce call demanderait 47.22%
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 69.41% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Par Malmuth-Harville exact : équité requise = 69.4% (contre 47.2% en ChipEV, soit +22.2 pt de prime ICM).

#### 8. `math_icmeq_08` — Famille `icm_equity` | mtt (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 36/30/22/12, paiements 50/30/20). J1 (36bb) shove en SB (0.5) sur Hero J2 (30bb) en BB (1). Quelle équité minimale (%) pour call ?
- **Hypothèses** : Modèle Malmuth-Harville exact, partages ignorés ; Blindes : SB 0.5bb / BB 1bb ; En ChipEV pur ce call demanderait 48.33%
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 70.19% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Par Malmuth-Harville exact : équité requise = 70.2% (contre 48.3% en ChipEV, soit +21.9 pt de prime ICM).

#### 9. `math_icmeq_09` — Famille `icm_equity` | mtt (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 36/30/22/12, paiements 50/30/20). J2 (30bb) shove en SB (0.5) sur Hero J3 (22bb) en BB (1). Quelle équité minimale (%) pour call ?
- **Hypothèses** : Modèle Malmuth-Harville exact, partages ignorés ; Blindes : SB 0.5bb / BB 1bb ; En ChipEV pur ce call demanderait 47.73%
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 66.13% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Par Malmuth-Harville exact : équité requise = 66.1% (contre 47.7% en ChipEV, soit +18.4 pt de prime ICM).

#### 10. `math_icmeq_10` — Famille `icm_equity` | mtt (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 38/26/21/15, paiements 55/28/17). J1 (38bb) shove en SB (0.5) sur Hero J2 (26bb) en BB (1). Quelle équité minimale (%) pour call ?
- **Hypothèses** : Modèle Malmuth-Harville exact, partages ignorés ; Blindes : SB 0.5bb / BB 1bb ; En ChipEV pur ce call demanderait 48.08%
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 65.71% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Par Malmuth-Harville exact : équité requise = 65.7% (contre 48.1% en ChipEV, soit +17.6 pt de prime ICM).

#### 11. `math_icmeq_11` — Famille `icm_equity` | mtt (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 38/26/21/15, paiements 55/28/17). J1 (38bb) shove en SB (0.5) sur Hero J3 (21bb) en BB (1). Quelle équité minimale (%) pour call ?
- **Hypothèses** : Modèle Malmuth-Harville exact, partages ignorés ; Blindes : SB 0.5bb / BB 1bb ; En ChipEV pur ce call demanderait 47.62%
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 63.69% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Par Malmuth-Harville exact : équité requise = 63.7% (contre 47.6% en ChipEV, soit +16.1 pt de prime ICM).

#### 12. `math_icmeq_12` — Famille `icm_equity` | mtt (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 42/27/19/12, paiements 45/33/22). J1 (42bb) shove en SB (0.5) sur Hero J2 (27bb) en BB (1). Quelle équité minimale (%) pour call ?
- **Hypothèses** : Modèle Malmuth-Harville exact, partages ignorés ; Blindes : SB 0.5bb / BB 1bb ; En ChipEV pur ce call demanderait 48.15%
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 74.19% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Par Malmuth-Harville exact : équité requise = 74.2% (contre 48.1% en ChipEV, soit +26.0 pt de prime ICM).

#### 13. `math_icmeq_13` — Famille `icm_equity` | mtt (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 42/27/19/12, paiements 45/33/22). J1 (42bb) shove en SB (0.5) sur Hero J3 (19bb) en BB (1). Quelle équité minimale (%) pour call ?
- **Hypothèses** : Modèle Malmuth-Harville exact, partages ignorés ; Blindes : SB 0.5bb / BB 1bb ; En ChipEV pur ce call demanderait 47.37%
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 69.55% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Par Malmuth-Harville exact : équité requise = 69.5% (contre 47.4% en ChipEV, soit +22.2 pt de prime ICM).

#### 14. `math_icmeq_14` — Famille `icm_equity` | mtt (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 35/32/23/10, paiements 50/30/20). J3 (23bb) shove en SB (0.5) sur Hero J2 (32bb) en BB (1). Quelle équité minimale (%) pour call ?
- **Hypothèses** : Modèle Malmuth-Harville exact, partages ignorés ; Blindes : SB 0.5bb / BB 1bb ; En ChipEV pur ce call demanderait 47.83%
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 59.29% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Par Malmuth-Harville exact : équité requise = 59.3% (contre 47.8% en ChipEV, soit +11.5 pt de prime ICM).

#### 15. `math_icmeq_15` — Famille `icm_equity` | mtt (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 48/24/16/12, paiements 50/30/20). J1 (48bb) shove en SB (0.5) sur Hero J2 (24bb) en BB (1). Quelle équité minimale (%) pour call ?
- **Hypothèses** : Modèle Malmuth-Harville exact, partages ignorés ; Blindes : SB 0.5bb / BB 1bb ; En ChipEV pur ce call demanderait 47.92%
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 71.51% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Par Malmuth-Harville exact : équité requise = 71.5% (contre 47.9% en ChipEV, soit +23.6 pt de prime ICM).

#### 16. `math_icmeq_16` — Famille `icm_equity` | mtt (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 44/23/20/13, paiements 50/30/20). J1 (44bb) shove en SB (0.5) sur Hero J3 (20bb) en BB (1). Quelle équité minimale (%) pour call ?
- **Hypothèses** : Modèle Malmuth-Harville exact, partages ignorés ; Blindes : SB 0.5bb / BB 1bb ; En ChipEV pur ce call demanderait 47.5%
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 67.86% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Par Malmuth-Harville exact : équité requise = 67.9% (contre 47.5% en ChipEV, soit +20.4 pt de prime ICM).

#### 17. `math_icmeq_17` — Famille `icm_equity` | mtt (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 40/25/20/15, paiements 65/35/0). J1 (40bb) shove en SB (0.5) sur Hero J2 (25bb) en BB (1). Quelle équité minimale (%) pour call ?
- **Hypothèses** : Modèle Malmuth-Harville exact, partages ignorés ; Blindes : SB 0.5bb / BB 1bb ; En ChipEV pur ce call demanderait 48%
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 58.12% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Par Malmuth-Harville exact : équité requise = 58.1% (contre 48.0% en ChipEV, soit +10.1 pt de prime ICM).

#### 18. `math_icmeq_18` — Famille `icm_equity` | mtt (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 40/25/20/15, paiements 65/35/0). J1 (40bb) shove en SB (0.5) sur Hero J3 (20bb) en BB (1). Quelle équité minimale (%) pour call ?
- **Hypothèses** : Modèle Malmuth-Harville exact, partages ignorés ; Blindes : SB 0.5bb / BB 1bb ; En ChipEV pur ce call demanderait 47.5%
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 55.58% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Par Malmuth-Harville exact : équité requise = 55.6% (contre 47.5% en ChipEV, soit +8.1 pt de prime ICM).

#### 19. `math_icmeq_19` — Famille `icm_equity` | mtt (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 52/26/14/8, paiements 60/25/15). J1 (52bb) shove en SB (1) sur Hero J2 (26bb) en BB (2). Quelle équité minimale (%) pour call ?
- **Hypothèses** : Modèle Malmuth-Harville exact, partages ignorés ; Blindes : SB 1bb / BB 2bb ; En ChipEV pur ce call demanderait 46.15%
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 66.33% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Par Malmuth-Harville exact : équité requise = 66.3% (contre 46.1% en ChipEV, soit +20.2 pt de prime ICM).

#### 20. `math_icmeq_20` — Famille `icm_equity` | mtt (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 30/28/24/18, paiements 50/30/20). J1 (30bb) shove en SB (1) sur Hero J3 (24bb) en BB (2). Quelle équité minimale (%) pour call ?
- **Hypothèses** : Modèle Malmuth-Harville exact, partages ignorés ; Blindes : SB 1bb / BB 2bb ; En ChipEV pur ce call demanderait 45.83%
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 63.3% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Par Malmuth-Harville exact : équité requise = 63.3% (contre 45.8% en ChipEV, soit +17.5 pt de prime ICM).

#### 21. `math_icmeq_21` — Famille `icm_equity` | mtt (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 55/20/15/10, paiements 50/30/20). J3 (15bb) shove en SB (0.5) sur Hero J2 (20bb) en BB (1). Quelle équité minimale (%) pour call ?
- **Hypothèses** : Modèle Malmuth-Harville exact, partages ignorés ; Blindes : SB 0.5bb / BB 1bb ; En ChipEV pur ce call demanderait 46.67%
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 57.15% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Par Malmuth-Harville exact : équité requise = 57.1% (contre 46.7% en ChipEV, soit +10.5 pt de prime ICM).

#### 22. `math_icmeq_22` — Famille `icm_equity` | mtt (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 33/31/21/15, paiements 50/30/20). J2 (31bb) shove en SB (0.5) sur Hero J1 (33bb) en BB (1). Quelle équité minimale (%) pour call ?
- **Hypothèses** : Modèle Malmuth-Harville exact, partages ignorés ; Blindes : SB 0.5bb / BB 1bb ; En ChipEV pur ce call demanderait 48.39%
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 67.15% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Par Malmuth-Harville exact : équité requise = 67.2% (contre 48.4% en ChipEV, soit +18.8 pt de prime ICM).

#### 23. `math_icmeq_23` — Famille `icm_equity` | mtt (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 46/25/18/11, paiements 70/30/0). J1 (46bb) shove en SB (0.5) sur Hero J2 (25bb) en BB (1). Quelle équité minimale (%) pour call ?
- **Hypothèses** : Modèle Malmuth-Harville exact, partages ignorés ; Blindes : SB 0.5bb / BB 1bb ; En ChipEV pur ce call demanderait 48%
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 58.13% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Par Malmuth-Harville exact : équité requise = 58.1% (contre 48.0% en ChipEV, soit +10.1 pt de prime ICM).

#### 24. `math_icmeq_24` — Famille `icm_equity` | mtt (mixed)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 29/27/24/20, paiements 50/30/20). J1 (29bb) shove en SB (0.5) sur Hero J2 (27bb) en BB (1). Quelle équité minimale (%) pour call ?
- **Hypothèses** : Modèle Malmuth-Harville exact, partages ignorés ; Blindes : SB 0.5bb / BB 1bb ; En ChipEV pur ce call demanderait 48.15%
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 65.89% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Par Malmuth-Harville exact : équité requise = 65.9% (contre 48.1% en ChipEV, soit +17.7 pt de prime ICM).

#### 25. `math_icmeq_25` — Famille `icm_equity` | mtt (mixed)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 34/26/22/18, paiements 50/30/20). J2 (26bb) shove en SB (0.5) sur Hero J3 (22bb) en BB (1). Quelle équité minimale (%) pour call ?
- **Hypothèses** : Modèle Malmuth-Harville exact, partages ignorés ; Blindes : SB 0.5bb / BB 1bb ; En ChipEV pur ce call demanderait 47.73%
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 63.17% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Par Malmuth-Harville exact : équité requise = 63.2% (contre 47.7% en ChipEV, soit +15.4 pt de prime ICM).

#### 26. `math_icmeq_26` — Famille `icm_equity` | mtt (mixed)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 41/25/19/15, paiements 52/30/18). J4 (15bb) shove en SB (0.5) sur Hero J2 (25bb) en BB (1). Quelle équité minimale (%) pour call ?
- **Hypothèses** : Modèle Malmuth-Harville exact, partages ignorés ; Blindes : SB 0.5bb / BB 1bb ; En ChipEV pur ce call demanderait 46.67%
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 53.32% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Par Malmuth-Harville exact : équité requise = 53.3% (contre 46.7% en ChipEV, soit +6.6 pt de prime ICM).

#### 27. `math_icmeq_27` — Famille `icm_equity` | mtt (mixed)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 39/28/19/14, paiements 50/30/20). J3 (19bb) shove en SB (0.5) sur Hero J4 (14bb) en BB (1). Quelle équité minimale (%) pour call ?
- **Hypothèses** : Modèle Malmuth-Harville exact, partages ignorés ; Blindes : SB 0.5bb / BB 1bb ; En ChipEV pur ce call demanderait 46.43%
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 55.11% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Par Malmuth-Harville exact : équité requise = 55.1% (contre 46.4% en ChipEV, soit +8.7 pt de prime ICM).

#### 28. `math_bf_01` — Famille `icm_bubble_factor` | mtt (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 40/25/20/15, paiements 50/30/20/0). En confrontation symétrique sans argent mort, J2 (25bb) joue son tapis effectif contre J1 (40bb). Quelle équité minimale (%) requise ?
- **Hypothèses** : Confrontation symétrique sans argent mort (BF / (1 + BF)) ; Bubble Factor = 2.377 • Risk Premium = +20.38 pt
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 70.38% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Bubble Factor = 2.377, soit un Risk Premium de +20.38 pt au-dessus de 50 %. Équité requise = 70.4 %.

#### 29. `math_bf_02` — Famille `icm_bubble_factor` | mtt (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 40/25/20/15, paiements 50/30/20/0). En confrontation symétrique sans argent mort, J3 (20bb) joue son tapis effectif contre J1 (40bb). Quelle équité minimale (%) requise ?
- **Hypothèses** : Confrontation symétrique sans argent mort (BF / (1 + BF)) ; Bubble Factor = 2.152 • Risk Premium = +18.27 pt
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 68.27% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Bubble Factor = 2.152, soit un Risk Premium de +18.27 pt au-dessus de 50 %. Équité requise = 68.3 %.

#### 30. `math_bf_03` — Famille `icm_bubble_factor` | mtt (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 40/25/20/15, paiements 50/30/20/0). En confrontation symétrique sans argent mort, J4 (15bb) joue son tapis effectif contre J1 (40bb). Quelle équité minimale (%) requise ?
- **Hypothèses** : Confrontation symétrique sans argent mort (BF / (1 + BF)) ; Bubble Factor = 1.830 • Risk Premium = +14.67 pt
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 64.67% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Bubble Factor = 1.830, soit un Risk Premium de +14.67 pt au-dessus de 50 %. Équité requise = 64.7 %.

#### 31. `math_bf_04` — Famille `icm_bubble_factor` | mtt (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 40/25/20/15, paiements 50/30/20/0). En confrontation symétrique sans argent mort, J3 (20bb) joue son tapis effectif contre J2 (25bb). Quelle équité minimale (%) requise ?
- **Hypothèses** : Confrontation symétrique sans argent mort (BF / (1 + BF)) ; Bubble Factor = 1.869 • Risk Premium = +15.14 pt
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 65.14% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Bubble Factor = 1.869, soit un Risk Premium de +15.14 pt au-dessus de 50 %. Équité requise = 65.1 %.

#### 32. `math_bf_05` — Famille `icm_bubble_factor` | mtt (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max asym. (tapis 50/25/15/10, paiements 50/30/20/0). En confrontation symétrique sans argent mort, J2 (25bb) joue son tapis effectif contre J1 (50bb). Quelle équité minimale (%) requise ?
- **Hypothèses** : Confrontation symétrique sans argent mort (BF / (1 + BF)) ; Bubble Factor = 2.905 • Risk Premium = +24.39 pt
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 74.39% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Bubble Factor = 2.905, soit un Risk Premium de +24.39 pt au-dessus de 50 %. Équité requise = 74.4 %.

#### 33. `math_bf_06` — Famille `icm_bubble_factor` | mtt (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max asym. (tapis 50/25/15/10, paiements 50/30/20/0). En confrontation symétrique sans argent mort, J3 (15bb) joue son tapis effectif contre J1 (50bb). Quelle équité minimale (%) requise ?
- **Hypothèses** : Confrontation symétrique sans argent mort (BF / (1 + BF)) ; Bubble Factor = 2.339 • Risk Premium = +20.05 pt
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 70.05% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Bubble Factor = 2.339, soit un Risk Premium de +20.05 pt au-dessus de 50 %. Équité requise = 70.0 %.

#### 34. `math_bf_07` — Famille `icm_bubble_factor` | mtt (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle dominée (tapis 60/20/12/8, paiements 50/30/20/0). En confrontation symétrique sans argent mort, J2 (20bb) joue son tapis effectif contre J1 (60bb). Quelle équité minimale (%) requise ?
- **Hypothèses** : Confrontation symétrique sans argent mort (BF / (1 + BF)) ; Bubble Factor = 3.231 • Risk Premium = +26.36 pt
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 76.36% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Bubble Factor = 3.231, soit un Risk Premium de +26.36 pt au-dessus de 50 %. Équité requise = 76.4 %.

#### 35. `math_bf_08` — Famille `icm_bubble_factor` | mtt (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle dominée (tapis 60/20/12/8, paiements 50/30/20/0). En confrontation symétrique sans argent mort, J3 (12bb) joue son tapis effectif contre J2 (20bb). Quelle équité minimale (%) requise ?
- **Hypothèses** : Confrontation symétrique sans argent mort (BF / (1 + BF)) ; Bubble Factor = 1.969 • Risk Premium = +16.32 pt
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 66.32% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Bubble Factor = 1.969, soit un Risk Premium de +16.32 pt au-dessus de 50 %. Équité requise = 66.3 %.

#### 36. `math_bf_09` — Famille `icm_bubble_factor` | expresso (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Expresso 80/12/8 (tapis 25/25/25, paiements 80/12/8). En confrontation symétrique sans argent mort, J1 (25bb) joue son tapis effectif contre J2 (25bb). Quelle équité minimale (%) requise ?
- **Hypothèses** : Confrontation symétrique sans argent mort (BF / (1 + BF)) ; Bubble Factor = 1.056 • Risk Premium = +1.35 pt
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 51.35% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Bubble Factor = 1.056, soit un Risk Premium de +1.35 pt au-dessus de 50 %. Équité requise = 51.4 %.

#### 37. `math_bf_10` — Famille `icm_bubble_factor` | expresso (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Expresso 80/12/8 (tapis 45/20/10, paiements 80/12/8). En confrontation symétrique sans argent mort, J2 (20bb) joue son tapis effectif contre J1 (45bb). Quelle équité minimale (%) requise ?
- **Hypothèses** : Confrontation symétrique sans argent mort (BF / (1 + BF)) ; Bubble Factor = 1.113 • Risk Premium = +2.68 pt
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 52.68% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Bubble Factor = 1.113, soit un Risk Premium de +2.68 pt au-dessus de 50 %. Équité requise = 52.7 %.

#### 38. `math_bf_11` — Famille `icm_bubble_factor` | expresso (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Expresso 80/12/8 (tapis 45/20/10, paiements 80/12/8). En confrontation symétrique sans argent mort, J3 (10bb) joue son tapis effectif contre J1 (45bb). Quelle équité minimale (%) requise ?
- **Hypothèses** : Confrontation symétrique sans argent mort (BF / (1 + BF)) ; Bubble Factor = 1.067 • Risk Premium = +1.62 pt
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 51.62% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Bubble Factor = 1.067, soit un Risk Premium de +1.62 pt au-dessus de 50 %. Équité requise = 51.6 %.

#### 39. `math_bf_12` — Famille `icm_bubble_factor` | expresso (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Expresso 80/12/8 (tapis 45/20/10, paiements 80/12/8). En confrontation symétrique sans argent mort, J1 (45bb) joue son tapis effectif contre J2 (20bb). Quelle équité minimale (%) requise ?
- **Hypothèses** : Confrontation symétrique sans argent mort (BF / (1 + BF)) ; Bubble Factor = 1.012 • Risk Premium = +0.30 pt
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 50.3% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Bubble Factor = 1.012, soit un Risk Premium de +0.30 pt au-dessus de 50 %. Équité requise = 50.3 %.

#### 40. `math_bf_13` — Famille `icm_bubble_factor` | mtt (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 35/30/20/15, paiements 50/30/20/0). En confrontation symétrique sans argent mort, J2 (30bb) joue son tapis effectif contre J1 (35bb). Quelle équité minimale (%) requise ?
- **Hypothèses** : Confrontation symétrique sans argent mort (BF / (1 + BF)) ; Bubble Factor = 2.406 • Risk Premium = +20.64 pt
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 70.64% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Bubble Factor = 2.406, soit un Risk Premium de +20.64 pt au-dessus de 50 %. Équité requise = 70.6 %.

#### 41. `math_bf_14` — Famille `icm_bubble_factor` | mtt (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 35/30/20/15, paiements 50/30/20/0). En confrontation symétrique sans argent mort, J3 (20bb) joue son tapis effectif contre J2 (30bb). Quelle équité minimale (%) requise ?
- **Hypothèses** : Confrontation symétrique sans argent mort (BF / (1 + BF)) ; Bubble Factor = 1.950 • Risk Premium = +16.10 pt
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 66.1% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Bubble Factor = 1.950, soit un Risk Premium de +16.10 pt au-dessus de 50 %. Équité requise = 66.1 %.

#### 42. `math_bf_15` — Famille `icm_bubble_factor` | mtt (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : TF 6-Max (tapis 55/42/30/24/15/9, paiements 35/24/17/11/7.5/5.5). En confrontation symétrique sans argent mort, J3 (30bb) joue son tapis effectif contre J1 (55bb). Quelle équité minimale (%) requise ?
- **Hypothèses** : Confrontation symétrique sans argent mort (BF / (1 + BF)) ; Bubble Factor = 2.060 • Risk Premium = +17.32 pt
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 67.32% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Bubble Factor = 2.060, soit un Risk Premium de +17.32 pt au-dessus de 50 %. Équité requise = 67.3 %.

#### 43. `math_bf_16` — Famille `icm_bubble_factor` | mtt (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : TF 6-Max (tapis 55/42/30/24/15/9, paiements 35/24/17/11/7.5/5.5). En confrontation symétrique sans argent mort, J4 (24bb) joue son tapis effectif contre J1 (55bb). Quelle équité minimale (%) requise ?
- **Hypothèses** : Confrontation symétrique sans argent mort (BF / (1 + BF)) ; Bubble Factor = 1.916 • Risk Premium = +15.71 pt
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 65.71% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Bubble Factor = 1.916, soit un Risk Premium de +15.71 pt au-dessus de 50 %. Équité requise = 65.7 %.

#### 44. `math_bf_17` — Famille `icm_bubble_factor` | mtt (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : TF 6-Max (tapis 55/42/30/24/15/9, paiements 35/24/17/11/7.5/5.5). En confrontation symétrique sans argent mort, J5 (15bb) joue son tapis effectif contre J1 (55bb). Quelle équité minimale (%) requise ?
- **Hypothèses** : Confrontation symétrique sans argent mort (BF / (1 + BF)) ; Bubble Factor = 1.640 • Risk Premium = +12.12 pt
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 62.12% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Bubble Factor = 1.640, soit un Risk Premium de +12.12 pt au-dessus de 50 %. Équité requise = 62.1 %.

#### 45. `math_bf_18` — Famille `icm_bubble_factor` | mtt (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : TF 6-Max (tapis 55/42/30/24/15/9, paiements 35/24/17/11/7.5/5.5). En confrontation symétrique sans argent mort, J2 (42bb) joue son tapis effectif contre J1 (55bb). Quelle équité minimale (%) requise ?
- **Hypothèses** : Confrontation symétrique sans argent mort (BF / (1 + BF)) ; Bubble Factor = 2.283 • Risk Premium = +19.54 pt
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 69.54% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Bubble Factor = 2.283, soit un Risk Premium de +19.54 pt au-dessus de 50 %. Équité requise = 69.5 %.

#### 46. `math_bf_19` — Famille `icm_bubble_factor` | mtt (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Sat Top-2 (tapis 40/35/25, paiements 65/35/0). En confrontation symétrique sans argent mort, J2 (35bb) joue son tapis effectif contre J1 (40bb). Quelle équité minimale (%) requise ?
- **Hypothèses** : Confrontation symétrique sans argent mort (BF / (1 + BF)) ; Bubble Factor = 1.754 • Risk Premium = +13.69 pt
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 63.69% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Bubble Factor = 1.754, soit un Risk Premium de +13.69 pt au-dessus de 50 %. Équité requise = 63.7 %.

#### 47. `math_bf_20` — Famille `icm_bubble_factor` | mtt (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Sat Top-2 (tapis 40/35/25, paiements 65/35/0). En confrontation symétrique sans argent mort, J3 (25bb) joue son tapis effectif contre J1 (40bb). Quelle équité minimale (%) requise ?
- **Hypothèses** : Confrontation symétrique sans argent mort (BF / (1 + BF)) ; Bubble Factor = 1.471 • Risk Premium = +9.53 pt
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 59.53% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Bubble Factor = 1.471, soit un Risk Premium de +9.53 pt au-dessus de 50 %. Équité requise = 59.5 %.

#### 48. `math_bf_21` — Famille `icm_bubble_factor` | mtt (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle 4-Max (tapis 30/30/20/20, paiements 50/30/20/0). En confrontation symétrique sans argent mort, J1 (30bb) joue son tapis effectif contre J2 (30bb). Quelle équité minimale (%) requise ?
- **Hypothèses** : Confrontation symétrique sans argent mort (BF / (1 + BF)) ; Bubble Factor = 2.207 • Risk Premium = +18.82 pt
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 68.82% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Bubble Factor = 2.207, soit un Risk Premium de +18.82 pt au-dessus de 50 %. Équité requise = 68.8 %.

#### 49. `math_bf_22` — Famille `icm_bubble_factor` | expresso (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Expresso 80/12/8 (tapis 50/20/5, paiements 80/12/8). En confrontation symétrique sans argent mort, J2 (20bb) joue son tapis effectif contre J1 (50bb). Quelle équité minimale (%) requise ?
- **Hypothèses** : Confrontation symétrique sans argent mort (BF / (1 + BF)) ; Bubble Factor = 1.153 • Risk Premium = +3.56 pt
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 53.56% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Bubble Factor = 1.153, soit un Risk Premium de +3.56 pt au-dessus de 50 %. Équité requise = 53.6 %.

#### 50. `math_bf_23` — Famille `icm_bubble_factor` | expresso (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Expresso 80/12/8 (tapis 50/20/5, paiements 80/12/8). En confrontation symétrique sans argent mort, J3 (5bb) joue son tapis effectif contre J2 (20bb). Quelle équité minimale (%) requise ?
- **Hypothèses** : Confrontation symétrique sans argent mort (BF / (1 + BF)) ; Bubble Factor = 1.011 • Risk Premium = +0.28 pt
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 50.28% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Bubble Factor = 1.011, soit un Risk Premium de +0.28 pt au-dessus de 50 %. Équité requise = 50.3 %.

#### 51. `math_bf_24` — Famille `icm_bubble_factor` | mtt (mixed)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle serrée (tapis 34/24/22/20, paiements 50/30/20/0). En confrontation symétrique sans argent mort, J2 (24bb) joue son tapis effectif contre J1 (34bb). Quelle équité minimale (%) requise ?
- **Hypothèses** : Confrontation symétrique sans argent mort (BF / (1 + BF)) ; Bubble Factor = 2.096 • Risk Premium = +17.70 pt
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 67.7% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Bubble Factor = 2.096, soit un Risk Premium de +17.70 pt au-dessus de 50 %. Équité requise = 67.7 %.

#### 52. `math_bf_25` — Famille `icm_bubble_factor` | mtt (mixed)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Bulle co-CL (tapis 32/32/20/16, paiements 50/30/20/0). En confrontation symétrique sans argent mort, J1 (32bb) joue son tapis effectif contre J2 (32bb). Quelle équité minimale (%) requise ?
- **Hypothèses** : Confrontation symétrique sans argent mort (BF / (1 + BF)) ; Bubble Factor = 2.363 • Risk Premium = +20.27 pt
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 70.27% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Bubble Factor = 2.363, soit un Risk Premium de +20.27 pt au-dessus de 50 %. Équité requise = 70.3 %.

#### 53. `math_bf_26` — Famille `icm_bubble_factor` | expresso (mixed)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Expresso 80/12/8 (tapis 30/25/20, paiements 80/12/8). En confrontation symétrique sans argent mort, J2 (25bb) joue son tapis effectif contre J1 (30bb). Quelle équité minimale (%) requise ?
- **Hypothèses** : Confrontation symétrique sans argent mort (BF / (1 + BF)) ; Bubble Factor = 1.067 • Risk Premium = +1.61 pt
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 51.61% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Bubble Factor = 1.067, soit un Risk Premium de +1.61 pt au-dessus de 50 %. Équité requise = 51.6 %.

#### 54. `math_bf_27` — Famille `icm_bubble_factor` | mtt (mixed)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : TF 6-Max (tapis 48/36/28/22/16/10, paiements 35/24/17/11/7.5/5.5). En confrontation symétrique sans argent mort, J3 (28bb) joue son tapis effectif contre J2 (36bb). Quelle équité minimale (%) requise ?
- **Hypothèses** : Confrontation symétrique sans argent mort (BF / (1 + BF)) ; Bubble Factor = 1.895 • Risk Premium = +15.46 pt
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 65.46% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Bubble Factor = 1.895, soit un Risk Premium de +15.46 pt au-dessus de 50 %. Équité requise = 65.5 %.

#### 55. `math_pko_01` — Famille `pko_bounty_call` | pko (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Tournoi PKO : vous couvrez Vilain. Vous devez payer 12000 jetons pour un pot final de 28000 jetons, avec une prime encaissable de 5 €. Jetons en jeu : 2.5 M pour 2500 € restants au total. Quelle équité minimale (%) ajustée par la prime ?
- **Hypothèses** : Héros couvre Vilain (prime encaissable immédiatement) ; Approximation ChipEV hors ICM ; Bounty Power = 1000 jetons/€ (+5000 jetons)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 36.36% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Sans bounty = 42.9 %. Avec +5000 jetons de prime (Bounty Power 1000 j/€), le seuil descend à 36.4 %.

#### 56. `math_pko_02` — Famille `pko_bounty_call` | pko (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Tournoi PKO : vous couvrez Vilain. Vous devez payer 15000 jetons pour un pot final de 36000 jetons, avec une prime encaissable de 10 €. Jetons en jeu : 3.0 M pour 3000 € restants au total. Quelle équité minimale (%) ajustée par la prime ?
- **Hypothèses** : Héros couvre Vilain (prime encaissable immédiatement) ; Approximation ChipEV hors ICM ; Bounty Power = 1000 jetons/€ (+10000 jetons)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 32.61% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Sans bounty = 41.7 %. Avec +10000 jetons de prime (Bounty Power 1000 j/€), le seuil descend à 32.6 %.

#### 57. `math_pko_03` — Famille `pko_bounty_call` | pko (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Tournoi PKO : vous couvrez Vilain. Vous devez payer 18000 jetons pour un pot final de 44000 jetons, avec une prime encaissable de 15 €. Jetons en jeu : 3.5 M pour 2500 € restants au total. Quelle équité minimale (%) ajustée par la prime ?
- **Hypothèses** : Héros couvre Vilain (prime encaissable immédiatement) ; Approximation ChipEV hors ICM ; Bounty Power = 1400 jetons/€ (+21000 jetons)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 27.69% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Sans bounty = 40.9 %. Avec +21000 jetons de prime (Bounty Power 1400 j/€), le seuil descend à 27.7 %.

#### 58. `math_pko_04` — Famille `pko_bounty_call` | pko (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Tournoi PKO : vous couvrez Vilain. Vous devez payer 20000 jetons pour un pot final de 50000 jetons, avec une prime encaissable de 20 €. Jetons en jeu : 2.5 M pour 3000 € restants au total. Quelle équité minimale (%) ajustée par la prime ?
- **Hypothèses** : Héros couvre Vilain (prime encaissable immédiatement) ; Approximation ChipEV hors ICM ; Bounty Power = 833 jetons/€ (+16667 jetons)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 30% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Sans bounty = 40.0 %. Avec +16667 jetons de prime (Bounty Power 833 j/€), le seuil descend à 30.0 %.

#### 59. `math_pko_05` — Famille `pko_bounty_call` | pko (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Tournoi PKO : vous couvrez Vilain. Vous devez payer 22000 jetons pour un pot final de 48000 jetons, avec une prime encaissable de 25 €. Jetons en jeu : 3.0 M pour 2500 € restants au total. Quelle équité minimale (%) ajustée par la prime ?
- **Hypothèses** : Héros couvre Vilain (prime encaissable immédiatement) ; Approximation ChipEV hors ICM ; Bounty Power = 1200 jetons/€ (+30000 jetons)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 28.21% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Sans bounty = 45.8 %. Avec +30000 jetons de prime (Bounty Power 1200 j/€), le seuil descend à 28.2 %.

#### 60. `math_pko_06` — Famille `pko_bounty_call` | pko (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Tournoi PKO : vous couvrez Vilain. Vous devez payer 24000 jetons pour un pot final de 54000 jetons, avec une prime encaissable de 30 €. Jetons en jeu : 3.5 M pour 3000 € restants au total. Quelle équité minimale (%) ajustée par la prime ?
- **Hypothèses** : Héros couvre Vilain (prime encaissable immédiatement) ; Approximation ChipEV hors ICM ; Bounty Power = 1167 jetons/€ (+35000 jetons)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 26.97% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Sans bounty = 44.4 %. Avec +35000 jetons de prime (Bounty Power 1167 j/€), le seuil descend à 27.0 %.

#### 61. `math_pko_07` — Famille `pko_bounty_call` | pko (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Tournoi PKO : vous couvrez Vilain. Vous devez payer 14000 jetons pour un pot final de 36000 jetons, avec une prime encaissable de 5 €. Jetons en jeu : 2.5 M pour 2500 € restants au total. Quelle équité minimale (%) ajustée par la prime ?
- **Hypothèses** : Héros couvre Vilain (prime encaissable immédiatement) ; Approximation ChipEV hors ICM ; Bounty Power = 1000 jetons/€ (+5000 jetons)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 34.15% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Sans bounty = 38.9 %. Avec +5000 jetons de prime (Bounty Power 1000 j/€), le seuil descend à 34.1 %.

#### 62. `math_pko_08` — Famille `pko_bounty_call` | pko (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Tournoi PKO : vous couvrez Vilain. Vous devez payer 16000 jetons pour un pot final de 42000 jetons, avec une prime encaissable de 10 €. Jetons en jeu : 3.0 M pour 3000 € restants au total. Quelle équité minimale (%) ajustée par la prime ?
- **Hypothèses** : Héros couvre Vilain (prime encaissable immédiatement) ; Approximation ChipEV hors ICM ; Bounty Power = 1000 jetons/€ (+10000 jetons)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 30.77% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Sans bounty = 38.1 %. Avec +10000 jetons de prime (Bounty Power 1000 j/€), le seuil descend à 30.8 %.

#### 63. `math_pko_09` — Famille `pko_bounty_call` | pko (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Tournoi PKO : vous couvrez Vilain. Vous devez payer 25000 jetons pour un pot final de 54000 jetons, avec une prime encaissable de 15 €. Jetons en jeu : 3.5 M pour 2500 € restants au total. Quelle équité minimale (%) ajustée par la prime ?
- **Hypothèses** : Héros couvre Vilain (prime encaissable immédiatement) ; Approximation ChipEV hors ICM ; Bounty Power = 1400 jetons/€ (+21000 jetons)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 33.33% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Sans bounty = 46.3 %. Avec +21000 jetons de prime (Bounty Power 1400 j/€), le seuil descend à 33.3 %.

#### 64. `math_pko_10` — Famille `pko_bounty_call` | pko (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Tournoi PKO : vous couvrez Vilain. Vous devez payer 30000 jetons pour un pot final de 66000 jetons, avec une prime encaissable de 20 €. Jetons en jeu : 2.5 M pour 3000 € restants au total. Quelle équité minimale (%) ajustée par la prime ?
- **Hypothèses** : Héros couvre Vilain (prime encaissable immédiatement) ; Approximation ChipEV hors ICM ; Bounty Power = 833 jetons/€ (+16667 jetons)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 36.29% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Sans bounty = 45.5 %. Avec +16667 jetons de prime (Bounty Power 833 j/€), le seuil descend à 36.3 %.

#### 65. `math_pko_11` — Famille `pko_bounty_call` | pko (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Tournoi PKO : vous couvrez Vilain. Vous devez payer 10000 jetons pour un pot final de 28000 jetons, avec une prime encaissable de 25 €. Jetons en jeu : 3.0 M pour 2500 € restants au total. Quelle équité minimale (%) ajustée par la prime ?
- **Hypothèses** : Héros couvre Vilain (prime encaissable immédiatement) ; Approximation ChipEV hors ICM ; Bounty Power = 1200 jetons/€ (+30000 jetons)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 17.24% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Sans bounty = 35.7 %. Avec +30000 jetons de prime (Bounty Power 1200 j/€), le seuil descend à 17.2 %.

#### 66. `math_pko_12` — Famille `pko_bounty_call` | pko (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Tournoi PKO : vous couvrez Vilain. Vous devez payer 19000 jetons pour un pot final de 48000 jetons, avec une prime encaissable de 30 €. Jetons en jeu : 3.5 M pour 3000 € restants au total. Quelle équité minimale (%) ajustée par la prime ?
- **Hypothèses** : Héros couvre Vilain (prime encaissable immédiatement) ; Approximation ChipEV hors ICM ; Bounty Power = 1167 jetons/€ (+35000 jetons)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 22.89% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Sans bounty = 39.6 %. Avec +35000 jetons de prime (Bounty Power 1167 j/€), le seuil descend à 22.9 %.

#### 67. `math_pko_13` — Famille `pko_bounty_call` | pko (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Tournoi PKO : vous couvrez Vilain. Vous devez payer 21000 jetons pour un pot final de 46000 jetons, avec une prime encaissable de 5 €. Jetons en jeu : 2.5 M pour 2500 € restants au total. Quelle équité minimale (%) ajustée par la prime ?
- **Hypothèses** : Héros couvre Vilain (prime encaissable immédiatement) ; Approximation ChipEV hors ICM ; Bounty Power = 1000 jetons/€ (+5000 jetons)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 41.18% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Sans bounty = 45.7 %. Avec +5000 jetons de prime (Bounty Power 1000 j/€), le seuil descend à 41.2 %.

#### 68. `math_pko_14` — Famille `pko_bounty_call` | pko (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Tournoi PKO : vous couvrez Vilain. Vous devez payer 27000 jetons pour un pot final de 60000 jetons, avec une prime encaissable de 10 €. Jetons en jeu : 3.0 M pour 3000 € restants au total. Quelle équité minimale (%) ajustée par la prime ?
- **Hypothèses** : Héros couvre Vilain (prime encaissable immédiatement) ; Approximation ChipEV hors ICM ; Bounty Power = 1000 jetons/€ (+10000 jetons)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 38.57% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Sans bounty = 45.0 %. Avec +10000 jetons de prime (Bounty Power 1000 j/€), le seuil descend à 38.6 %.

#### 69. `math_pko_15` — Famille `pko_bounty_call` | pko (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Tournoi PKO : vous couvrez Vilain. Vous devez payer 32000 jetons pour un pot final de 72000 jetons, avec une prime encaissable de 15 €. Jetons en jeu : 3.5 M pour 2500 € restants au total. Quelle équité minimale (%) ajustée par la prime ?
- **Hypothèses** : Héros couvre Vilain (prime encaissable immédiatement) ; Approximation ChipEV hors ICM ; Bounty Power = 1400 jetons/€ (+21000 jetons)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 34.41% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Sans bounty = 44.4 %. Avec +21000 jetons de prime (Bounty Power 1400 j/€), le seuil descend à 34.4 %.

#### 70. `math_pko_16` — Famille `pko_bounty_call` | pko (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Tournoi PKO : vous couvrez Vilain. Vous devez payer 17500 jetons pour un pot final de 45000 jetons, avec une prime encaissable de 20 €. Jetons en jeu : 2.5 M pour 3000 € restants au total. Quelle équité minimale (%) ajustée par la prime ?
- **Hypothèses** : Héros couvre Vilain (prime encaissable immédiatement) ; Approximation ChipEV hors ICM ; Bounty Power = 833 jetons/€ (+16667 jetons)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 28.38% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Sans bounty = 38.9 %. Avec +16667 jetons de prime (Bounty Power 833 j/€), le seuil descend à 28.4 %.

#### 71. `math_pko_17` — Famille `pko_bounty_call` | pko (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Tournoi PKO : vous couvrez Vilain. Vous devez payer 8000 jetons pour un pot final de 20000 jetons, avec une prime encaissable de 25 €. Jetons en jeu : 3.0 M pour 2500 € restants au total. Quelle équité minimale (%) ajustée par la prime ?
- **Hypothèses** : Héros couvre Vilain (prime encaissable immédiatement) ; Approximation ChipEV hors ICM ; Bounty Power = 1200 jetons/€ (+30000 jetons)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 16% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Sans bounty = 40.0 %. Avec +30000 jetons de prime (Bounty Power 1200 j/€), le seuil descend à 16.0 %.

#### 72. `math_pko_18` — Famille `pko_bounty_call` | pko (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Tournoi PKO : vous couvrez Vilain. Vous devez payer 11000 jetons pour un pot final de 28000 jetons, avec une prime encaissable de 30 €. Jetons en jeu : 3.5 M pour 3000 € restants au total. Quelle équité minimale (%) ajustée par la prime ?
- **Hypothèses** : Héros couvre Vilain (prime encaissable immédiatement) ; Approximation ChipEV hors ICM ; Bounty Power = 1167 jetons/€ (+35000 jetons)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 17.46% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Sans bounty = 39.3 %. Avec +35000 jetons de prime (Bounty Power 1167 j/€), le seuil descend à 17.5 %.

#### 73. `math_pko_19` — Famille `pko_bounty_call` | pko (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Tournoi PKO : vous couvrez Vilain. Vous devez payer 28000 jetons pour un pot final de 64000 jetons, avec une prime encaissable de 5 €. Jetons en jeu : 2.5 M pour 2500 € restants au total. Quelle équité minimale (%) ajustée par la prime ?
- **Hypothèses** : Héros couvre Vilain (prime encaissable immédiatement) ; Approximation ChipEV hors ICM ; Bounty Power = 1000 jetons/€ (+5000 jetons)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 40.58% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Sans bounty = 43.8 %. Avec +5000 jetons de prime (Bounty Power 1000 j/€), le seuil descend à 40.6 %.

#### 74. `math_pko_20` — Famille `pko_bounty_call` | pko (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Tournoi PKO : vous couvrez Vilain. Vous devez payer 35000 jetons pour un pot final de 80000 jetons, avec une prime encaissable de 10 €. Jetons en jeu : 3.0 M pour 3000 € restants au total. Quelle équité minimale (%) ajustée par la prime ?
- **Hypothèses** : Héros couvre Vilain (prime encaissable immédiatement) ; Approximation ChipEV hors ICM ; Bounty Power = 1000 jetons/€ (+10000 jetons)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 38.89% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Sans bounty = 43.8 %. Avec +10000 jetons de prime (Bounty Power 1000 j/€), le seuil descend à 38.9 %.

#### 75. `math_pko_21` — Famille `pko_bounty_call` | pko (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Tournoi PKO : vous couvrez Vilain. Vous devez payer 40000 jetons pour un pot final de 84000 jetons, avec une prime encaissable de 15 €. Jetons en jeu : 3.5 M pour 2500 € restants au total. Quelle équité minimale (%) ajustée par la prime ?
- **Hypothèses** : Héros couvre Vilain (prime encaissable immédiatement) ; Approximation ChipEV hors ICM ; Bounty Power = 1400 jetons/€ (+21000 jetons)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 38.1% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Sans bounty = 47.6 %. Avec +21000 jetons de prime (Bounty Power 1400 j/€), le seuil descend à 38.1 %.

#### 76. `math_pko_22` — Famille `pko_bounty_call` | pko (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Tournoi PKO : vous couvrez Vilain. Vous devez payer 13500 jetons pour un pot final de 33000 jetons, avec une prime encaissable de 20 €. Jetons en jeu : 2.5 M pour 3000 € restants au total. Quelle équité minimale (%) ajustée par la prime ?
- **Hypothèses** : Héros couvre Vilain (prime encaissable immédiatement) ; Approximation ChipEV hors ICM ; Bounty Power = 833 jetons/€ (+16667 jetons)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 27.18% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Sans bounty = 40.9 %. Avec +16667 jetons de prime (Bounty Power 833 j/€), le seuil descend à 27.2 %.

#### 77. `math_pko_23` — Famille `pko_bounty_call` | pko (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Tournoi PKO : vous couvrez Vilain. Vous devez payer 26000 jetons pour un pot final de 60000 jetons, avec une prime encaissable de 25 €. Jetons en jeu : 3.0 M pour 2500 € restants au total. Quelle équité minimale (%) ajustée par la prime ?
- **Hypothèses** : Héros couvre Vilain (prime encaissable immédiatement) ; Approximation ChipEV hors ICM ; Bounty Power = 1200 jetons/€ (+30000 jetons)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 28.89% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Sans bounty = 43.3 %. Avec +30000 jetons de prime (Bounty Power 1200 j/€), le seuil descend à 28.9 %.

#### 78. `math_pko_24` — Famille `pko_bounty_call` | pko (mixed)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Tournoi PKO : vous couvrez Vilain. Vous devez payer 16500 jetons pour un pot final de 43000 jetons, avec une prime encaissable de 30 €. Jetons en jeu : 3.5 M pour 3000 € restants au total. Quelle équité minimale (%) ajustée par la prime ?
- **Hypothèses** : Héros couvre Vilain (prime encaissable immédiatement) ; Approximation ChipEV hors ICM ; Bounty Power = 1167 jetons/€ (+35000 jetons)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 21.15% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Sans bounty = 38.4 %. Avec +35000 jetons de prime (Bounty Power 1167 j/€), le seuil descend à 21.1 %.

#### 79. `math_pko_25` — Famille `pko_bounty_call` | pko (mixed)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Tournoi PKO : vous couvrez Vilain. Vous devez payer 20500 jetons pour un pot final de 45000 jetons, avec une prime encaissable de 5 €. Jetons en jeu : 2.5 M pour 2500 € restants au total. Quelle équité minimale (%) ajustée par la prime ?
- **Hypothèses** : Héros couvre Vilain (prime encaissable immédiatement) ; Approximation ChipEV hors ICM ; Bounty Power = 1000 jetons/€ (+5000 jetons)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 41% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Sans bounty = 45.6 %. Avec +5000 jetons de prime (Bounty Power 1000 j/€), le seuil descend à 41.0 %.

#### 80. `math_pko_26` — Famille `pko_bounty_call` | pko (mixed)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Tournoi PKO : vous couvrez Vilain. Vous devez payer 23500 jetons pour un pot final de 53000 jetons, avec une prime encaissable de 10 €. Jetons en jeu : 3.0 M pour 3000 € restants au total. Quelle équité minimale (%) ajustée par la prime ?
- **Hypothèses** : Héros couvre Vilain (prime encaissable immédiatement) ; Approximation ChipEV hors ICM ; Bounty Power = 1000 jetons/€ (+10000 jetons)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 37.3% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Sans bounty = 44.3 %. Avec +10000 jetons de prime (Bounty Power 1000 j/€), le seuil descend à 37.3 %.

#### 81. `math_pko_27` — Famille `pko_bounty_call` | pko (mixed)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Tournoi PKO : vous couvrez Vilain. Vous devez payer 29000 jetons pour un pot final de 66000 jetons, avec une prime encaissable de 15 €. Jetons en jeu : 3.5 M pour 2500 € restants au total. Quelle équité minimale (%) ajustée par la prime ?
- **Hypothèses** : Héros couvre Vilain (prime encaissable immédiatement) ; Approximation ChipEV hors ICM ; Bounty Power = 1400 jetons/€ (+21000 jetons)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 33.33% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Sans bounty = 43.9 %. Avec +21000 jetons de prime (Bounty Power 1400 j/€), le seuil descend à 33.3 %.

#### 82. `math_odds_01` — Famille `pot_odds_exact` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Pot avant mise : 10 bb. Vilain mise 3.3 bb à la river (vous devez payer 3.3 bb pour un pot final de 16.6 bb). Quelle équité minimale (%) faut-il pour un call strictement break-even ?
- **Hypothèses** : River (aucune carte à venir, aucun rake additionnel) ; Call pur face à cette mise
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 19.88% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : 3.3 / (10 + 2 × 3.3) = 19.88 %.

#### 83. `math_odds_02` — Famille `pot_odds_exact` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Pot avant mise : 10 bb. Vilain mise 5 bb à la river (vous devez payer 5 bb pour un pot final de 20.0 bb). Quelle équité minimale (%) faut-il pour un call strictement break-even ?
- **Hypothèses** : River (aucune carte à venir, aucun rake additionnel) ; Call pur face à cette mise
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 25% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : 5 / (10 + 2 × 5) = 25.00 %.

#### 84. `math_odds_03` — Famille `pot_odds_exact` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Pot avant mise : 10 bb. Vilain mise 6.7 bb à la river (vous devez payer 6.7 bb pour un pot final de 23.4 bb). Quelle équité minimale (%) faut-il pour un call strictement break-even ?
- **Hypothèses** : River (aucune carte à venir, aucun rake additionnel) ; Call pur face à cette mise
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 28.63% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : 6.7 / (10 + 2 × 6.7) = 28.63 %.

#### 85. `math_odds_04` — Famille `pot_odds_exact` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Pot avant mise : 10 bb. Vilain mise 7.5 bb à la river (vous devez payer 7.5 bb pour un pot final de 25.0 bb). Quelle équité minimale (%) faut-il pour un call strictement break-even ?
- **Hypothèses** : River (aucune carte à venir, aucun rake additionnel) ; Call pur face à cette mise
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 30% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : 7.5 / (10 + 2 × 7.5) = 30.00 %.

#### 86. `math_odds_05` — Famille `pot_odds_exact` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Pot avant mise : 10 bb. Vilain mise 10 bb à la river (vous devez payer 10 bb pour un pot final de 30.0 bb). Quelle équité minimale (%) faut-il pour un call strictement break-even ?
- **Hypothèses** : River (aucune carte à venir, aucun rake additionnel) ; Call pur face à cette mise
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 33.33% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : 10 / (10 + 2 × 10) = 33.33 %.

#### 87. `math_odds_06` — Famille `pot_odds_exact` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Pot avant mise : 10 bb. Vilain mise 12.5 bb à la river (vous devez payer 12.5 bb pour un pot final de 35.0 bb). Quelle équité minimale (%) faut-il pour un call strictement break-even ?
- **Hypothèses** : River (aucune carte à venir, aucun rake additionnel) ; Call pur face à cette mise
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 35.71% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : 12.5 / (10 + 2 × 12.5) = 35.71 %.

#### 88. `math_odds_07` — Famille `pot_odds_exact` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Pot avant mise : 10 bb. Vilain mise 15 bb à la river (vous devez payer 15 bb pour un pot final de 40.0 bb). Quelle équité minimale (%) faut-il pour un call strictement break-even ?
- **Hypothèses** : River (aucune carte à venir, aucun rake additionnel) ; Call pur face à cette mise
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 37.5% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : 15 / (10 + 2 × 15) = 37.50 %.

#### 89. `math_odds_08` — Famille `pot_odds_exact` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Pot avant mise : 12 bb. Vilain mise 4 bb à la river (vous devez payer 4 bb pour un pot final de 20.0 bb). Quelle équité minimale (%) faut-il pour un call strictement break-even ?
- **Hypothèses** : River (aucune carte à venir, aucun rake additionnel) ; Call pur face à cette mise
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 20% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : 4 / (12 + 2 × 4) = 20.00 %.

#### 90. `math_odds_09` — Famille `pot_odds_exact` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Pot avant mise : 12 bb. Vilain mise 6 bb à la river (vous devez payer 6 bb pour un pot final de 24.0 bb). Quelle équité minimale (%) faut-il pour un call strictement break-even ?
- **Hypothèses** : River (aucune carte à venir, aucun rake additionnel) ; Call pur face à cette mise
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 25% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : 6 / (12 + 2 × 6) = 25.00 %.

#### 91. `math_odds_10` — Famille `pot_odds_exact` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Pot avant mise : 12 bb. Vilain mise 9 bb à la river (vous devez payer 9 bb pour un pot final de 30.0 bb). Quelle équité minimale (%) faut-il pour un call strictement break-even ?
- **Hypothèses** : River (aucune carte à venir, aucun rake additionnel) ; Call pur face à cette mise
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 30% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : 9 / (12 + 2 × 9) = 30.00 %.

#### 92. `math_odds_11` — Famille `pot_odds_exact` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Pot avant mise : 15 bb. Vilain mise 5 bb à la river (vous devez payer 5 bb pour un pot final de 25.0 bb). Quelle équité minimale (%) faut-il pour un call strictement break-even ?
- **Hypothèses** : River (aucune carte à venir, aucun rake additionnel) ; Call pur face à cette mise
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 20% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : 5 / (15 + 2 × 5) = 20.00 %.

#### 93. `math_odds_12` — Famille `pot_odds_exact` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Pot avant mise : 15 bb. Vilain mise 10 bb à la river (vous devez payer 10 bb pour un pot final de 35.0 bb). Quelle équité minimale (%) faut-il pour un call strictement break-even ?
- **Hypothèses** : River (aucune carte à venir, aucun rake additionnel) ; Call pur face à cette mise
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 28.57% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : 10 / (15 + 2 × 10) = 28.57 %.

#### 94. `math_odds_13` — Famille `pot_odds_exact` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Pot avant mise : 20 bb. Vilain mise 5 bb à la river (vous devez payer 5 bb pour un pot final de 30.0 bb). Quelle équité minimale (%) faut-il pour un call strictement break-even ?
- **Hypothèses** : River (aucune carte à venir, aucun rake additionnel) ; Call pur face à cette mise
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 16.67% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : 5 / (20 + 2 × 5) = 16.67 %.

#### 95. `math_odds_14` — Famille `pot_odds_exact` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Pot avant mise : 20 bb. Vilain mise 10 bb à la river (vous devez payer 10 bb pour un pot final de 40.0 bb). Quelle équité minimale (%) faut-il pour un call strictement break-even ?
- **Hypothèses** : River (aucune carte à venir, aucun rake additionnel) ; Call pur face à cette mise
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 25% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : 10 / (20 + 2 × 10) = 25.00 %.

#### 96. `math_odds_15` — Famille `pot_odds_exact` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Pot avant mise : 20 bb. Vilain mise 15 bb à la river (vous devez payer 15 bb pour un pot final de 50.0 bb). Quelle équité minimale (%) faut-il pour un call strictement break-even ?
- **Hypothèses** : River (aucune carte à venir, aucun rake additionnel) ; Call pur face à cette mise
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 30% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : 15 / (20 + 2 × 15) = 30.00 %.

#### 97. `math_odds_16` — Famille `pot_odds_exact` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Pot avant mise : 24 bb. Vilain mise 18 bb à la river (vous devez payer 18 bb pour un pot final de 60.0 bb). Quelle équité minimale (%) faut-il pour un call strictement break-even ?
- **Hypothèses** : River (aucune carte à venir, aucun rake additionnel) ; Call pur face à cette mise
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 30% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : 18 / (24 + 2 × 18) = 30.00 %.

#### 98. `math_odds_17` — Famille `pot_odds_exact` | cash (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Pot avant mise : 18 bb. Vilain mise 6 bb à la river (vous devez payer 6 bb pour un pot final de 30.0 bb). Quelle équité minimale (%) faut-il pour un call strictement break-even ?
- **Hypothèses** : River (aucune carte à venir, aucun rake additionnel) ; Call pur face à cette mise
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 20% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : 6 / (18 + 2 × 6) = 20.00 %.

#### 99. `math_odds_18` — Famille `pot_odds_exact` | cash (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Pot avant mise : 18 bb. Vilain mise 12 bb à la river (vous devez payer 12 bb pour un pot final de 42.0 bb). Quelle équité minimale (%) faut-il pour un call strictement break-even ?
- **Hypothèses** : River (aucune carte à venir, aucun rake additionnel) ; Call pur face à cette mise
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 28.57% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : 12 / (18 + 2 × 12) = 28.57 %.

#### 100. `math_odds_19` — Famille `pot_odds_exact` | cash (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Pot avant mise : 25 bb. Vilain mise 12.5 bb à la river (vous devez payer 12.5 bb pour un pot final de 50.0 bb). Quelle équité minimale (%) faut-il pour un call strictement break-even ?
- **Hypothèses** : River (aucune carte à venir, aucun rake additionnel) ; Call pur face à cette mise
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 25% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : 12.5 / (25 + 2 × 12.5) = 25.00 %.

#### 101. `math_odds_20` — Famille `pot_odds_exact` | cash (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Pot avant mise : 30 bb. Vilain mise 10 bb à la river (vous devez payer 10 bb pour un pot final de 50.0 bb). Quelle équité minimale (%) faut-il pour un call strictement break-even ?
- **Hypothèses** : River (aucune carte à venir, aucun rake additionnel) ; Call pur face à cette mise
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 20% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : 10 / (30 + 2 × 10) = 20.00 %.

#### 102. `math_odds_21` — Famille `pot_odds_exact` | cash (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Pot avant mise : 30 bb. Vilain mise 20 bb à la river (vous devez payer 20 bb pour un pot final de 70.0 bb). Quelle équité minimale (%) faut-il pour un call strictement break-even ?
- **Hypothèses** : River (aucune carte à venir, aucun rake additionnel) ; Call pur face à cette mise
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 28.57% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : 20 / (30 + 2 × 20) = 28.57 %.

#### 103. `math_odds_22` — Famille `pot_odds_exact` | cash (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Pot avant mise : 40 bb. Vilain mise 30 bb à la river (vous devez payer 30 bb pour un pot final de 100.0 bb). Quelle équité minimale (%) faut-il pour un call strictement break-even ?
- **Hypothèses** : River (aucune carte à venir, aucun rake additionnel) ; Call pur face à cette mise
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 30% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : 30 / (40 + 2 × 30) = 30.00 %.

#### 104. `math_odds_23` — Famille `pot_odds_exact` | cash (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Pot avant mise : 50 bb. Vilain mise 25 bb à la river (vous devez payer 25 bb pour un pot final de 100.0 bb). Quelle équité minimale (%) faut-il pour un call strictement break-even ?
- **Hypothèses** : River (aucune carte à venir, aucun rake additionnel) ; Call pur face à cette mise
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 25% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : 25 / (50 + 2 × 25) = 25.00 %.

#### 105. `math_odds_24` — Famille `pot_odds_exact` | cash (mixed)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Pot avant mise : 14 bb. Vilain mise 7 bb à la river (vous devez payer 7 bb pour un pot final de 28.0 bb). Quelle équité minimale (%) faut-il pour un call strictement break-even ?
- **Hypothèses** : River (aucune carte à venir, aucun rake additionnel) ; Call pur face à cette mise
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 25% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : 7 / (14 + 2 × 7) = 25.00 %.

#### 106. `math_odds_25` — Famille `pot_odds_exact` | cash (mixed)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Pot avant mise : 16 bb. Vilain mise 12 bb à la river (vous devez payer 12 bb pour un pot final de 40.0 bb). Quelle équité minimale (%) faut-il pour un call strictement break-even ?
- **Hypothèses** : River (aucune carte à venir, aucun rake additionnel) ; Call pur face à cette mise
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 30% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : 12 / (16 + 2 × 12) = 30.00 %.

#### 107. `math_odds_26` — Famille `pot_odds_exact` | cash (mixed)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Pot avant mise : 22 bb. Vilain mise 11 bb à la river (vous devez payer 11 bb pour un pot final de 44.0 bb). Quelle équité minimale (%) faut-il pour un call strictement break-even ?
- **Hypothèses** : River (aucune carte à venir, aucun rake additionnel) ; Call pur face à cette mise
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 25% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : 11 / (22 + 2 × 11) = 25.00 %.

#### 108. `math_odds_27` — Famille `pot_odds_exact` | cash (mixed)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Pot avant mise : 28 bb. Vilain mise 21 bb à la river (vous devez payer 21 bb pour un pot final de 70.0 bb). Quelle équité minimale (%) faut-il pour un call strictement break-even ?
- **Hypothèses** : River (aucune carte à venir, aucun rake additionnel) ; Call pur face à cette mise
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 30% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : 21 / (28 + 2 × 21) = 30.00 %.

#### 109. `math_outs_01` — Famille `outs_turn_river` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Calcul exact de probabilité d'outs : Quinte ventrale (4 outs) Flop → Turn. Quelle est la probabilité exacte (%) de toucher au moins un de ces 4 outs ?
- **Hypothèses** : 47 cartes inconnues au flop ; Outs supposés tous vivants (clean)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 8.51% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Probabilité combinatoire exacte : 8.51 % (la règle 2×/4× sert uniquement d'estimation mentale rapide).

#### 110. `math_outs_02` — Famille `outs_turn_river` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Calcul exact de probabilité d'outs : Quinte ventrale (4 outs) Turn → River. Quelle est la probabilité exacte (%) de toucher au moins un de ces 4 outs ?
- **Hypothèses** : 46 cartes inconnues au turn ; Outs supposés tous vivants (clean)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 8.7% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Probabilité combinatoire exacte : 8.70 % (la règle 2×/4× sert uniquement d'estimation mentale rapide).

#### 111. `math_outs_03` — Famille `outs_turn_river` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Calcul exact de probabilité d'outs : Quinte ventrale (4 outs) Flop → River. Quelle est la probabilité exacte (%) de toucher au moins un de ces 4 outs ?
- **Hypothèses** : 47 puis 46 cartes inconnues (tapis au flop) ; Outs supposés tous vivants (clean)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 16.47% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Probabilité combinatoire exacte : 16.47 % (la règle 2×/4× sert uniquement d'estimation mentale rapide).

#### 112. `math_outs_04` — Famille `outs_turn_river` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Calcul exact de probabilité d'outs : OESD (8 outs) Flop → Turn. Quelle est la probabilité exacte (%) de toucher au moins un de ces 8 outs ?
- **Hypothèses** : 47 cartes inconnues au flop ; Outs supposés tous vivants (clean)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 17.02% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Probabilité combinatoire exacte : 17.02 % (la règle 2×/4× sert uniquement d'estimation mentale rapide).

#### 113. `math_outs_05` — Famille `outs_turn_river` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Calcul exact de probabilité d'outs : OESD (8 outs) Turn → River. Quelle est la probabilité exacte (%) de toucher au moins un de ces 8 outs ?
- **Hypothèses** : 46 cartes inconnues au turn ; Outs supposés tous vivants (clean)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 17.39% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Probabilité combinatoire exacte : 17.39 % (la règle 2×/4× sert uniquement d'estimation mentale rapide).

#### 114. `math_outs_06` — Famille `outs_turn_river` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Calcul exact de probabilité d'outs : OESD (8 outs) Flop → River. Quelle est la probabilité exacte (%) de toucher au moins un de ces 8 outs ?
- **Hypothèses** : 47 puis 46 cartes inconnues (tapis au flop) ; Outs supposés tous vivants (clean)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 31.45% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Probabilité combinatoire exacte : 31.45 % (la règle 2×/4× sert uniquement d'estimation mentale rapide).

#### 115. `math_outs_07` — Famille `outs_turn_river` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Calcul exact de probabilité d'outs : Tirage couleur (9 outs) Flop → Turn. Quelle est la probabilité exacte (%) de toucher au moins un de ces 9 outs ?
- **Hypothèses** : 47 cartes inconnues au flop ; Outs supposés tous vivants (clean)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 19.15% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Probabilité combinatoire exacte : 19.15 % (la règle 2×/4× sert uniquement d'estimation mentale rapide).

#### 116. `math_outs_08` — Famille `outs_turn_river` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Calcul exact de probabilité d'outs : Tirage couleur (9 outs) Turn → River. Quelle est la probabilité exacte (%) de toucher au moins un de ces 9 outs ?
- **Hypothèses** : 46 cartes inconnues au turn ; Outs supposés tous vivants (clean)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 19.57% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Probabilité combinatoire exacte : 19.57 % (la règle 2×/4× sert uniquement d'estimation mentale rapide).

#### 117. `math_outs_09` — Famille `outs_turn_river` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Calcul exact de probabilité d'outs : Tirage couleur (9 outs) Flop → River. Quelle est la probabilité exacte (%) de toucher au moins un de ces 9 outs ?
- **Hypothèses** : 47 puis 46 cartes inconnues (tapis au flop) ; Outs supposés tous vivants (clean)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 34.97% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Probabilité combinatoire exacte : 34.97 % (la règle 2×/4× sert uniquement d'estimation mentale rapide).

#### 118. `math_outs_10` — Famille `outs_turn_river` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Calcul exact de probabilité d'outs : Couleur + gutshot (12 outs) Flop → Turn. Quelle est la probabilité exacte (%) de toucher au moins un de ces 12 outs ?
- **Hypothèses** : 47 cartes inconnues au flop ; Outs supposés tous vivants (clean)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 25.53% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Probabilité combinatoire exacte : 25.53 % (la règle 2×/4× sert uniquement d'estimation mentale rapide).

#### 119. `math_outs_11` — Famille `outs_turn_river` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Calcul exact de probabilité d'outs : Couleur + gutshot (12 outs) Turn → River. Quelle est la probabilité exacte (%) de toucher au moins un de ces 12 outs ?
- **Hypothèses** : 46 cartes inconnues au turn ; Outs supposés tous vivants (clean)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 26.09% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Probabilité combinatoire exacte : 26.09 % (la règle 2×/4× sert uniquement d'estimation mentale rapide).

#### 120. `math_outs_12` — Famille `outs_turn_river` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Calcul exact de probabilité d'outs : Couleur + gutshot (12 outs) Flop → River. Quelle est la probabilité exacte (%) de toucher au moins un de ces 12 outs ?
- **Hypothèses** : 47 puis 46 cartes inconnues (tapis au flop) ; Outs supposés tous vivants (clean)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 44.96% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Probabilité combinatoire exacte : 44.96 % (la règle 2×/4× sert uniquement d'estimation mentale rapide).

#### 121. `math_outs_13` — Famille `outs_turn_river` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Calcul exact de probabilité d'outs : Combo Draw (15 outs) Flop → Turn. Quelle est la probabilité exacte (%) de toucher au moins un de ces 15 outs ?
- **Hypothèses** : 47 cartes inconnues au flop ; Outs supposés tous vivants (clean)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 31.91% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Probabilité combinatoire exacte : 31.91 % (la règle 2×/4× sert uniquement d'estimation mentale rapide).

#### 122. `math_outs_14` — Famille `outs_turn_river` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Calcul exact de probabilité d'outs : Combo Draw (15 outs) Turn → River. Quelle est la probabilité exacte (%) de toucher au moins un de ces 15 outs ?
- **Hypothèses** : 46 cartes inconnues au turn ; Outs supposés tous vivants (clean)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 32.61% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Probabilité combinatoire exacte : 32.61 % (la règle 2×/4× sert uniquement d'estimation mentale rapide).

#### 123. `math_outs_15` — Famille `outs_turn_river` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Calcul exact de probabilité d'outs : Combo Draw (15 outs) Flop → River. Quelle est la probabilité exacte (%) de toucher au moins un de ces 15 outs ?
- **Hypothèses** : 47 puis 46 cartes inconnues (tapis au flop) ; Outs supposés tous vivants (clean)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 54.12% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Probabilité combinatoire exacte : 54.12 % (la règle 2×/4× sert uniquement d'estimation mentale rapide).

#### 124. `math_outs_16` — Famille `outs_turn_river` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Calcul exact de probabilité d'outs : 2 overcards (6 outs) Flop → River. Quelle est la probabilité exacte (%) de toucher au moins un de ces 6 outs ?
- **Hypothèses** : 47 puis 46 cartes inconnues (tapis au flop) ; Outs supposés tous vivants (clean)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 24.14% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Probabilité combinatoire exacte : 24.14 % (la règle 2×/4× sert uniquement d'estimation mentale rapide).

#### 125. `math_outs_17` — Famille `outs_turn_river` | cash (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Calcul exact de probabilité d'outs : Paire vers brelan (2 outs) Flop → River. Quelle est la probabilité exacte (%) de toucher au moins un de ces 2 outs ?
- **Hypothèses** : 47 puis 46 cartes inconnues (tapis au flop) ; Outs supposés tous vivants (clean)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 8.42% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Probabilité combinatoire exacte : 8.42 % (la règle 2×/4× sert uniquement d'estimation mentale rapide).

#### 126. `math_outs_18` — Famille `outs_turn_river` | cash (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Calcul exact de probabilité d'outs : Paire vers DP/brelan (5 outs) Turn → River. Quelle est la probabilité exacte (%) de toucher au moins un de ces 5 outs ?
- **Hypothèses** : 46 cartes inconnues au turn ; Outs supposés tous vivants (clean)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 10.87% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Probabilité combinatoire exacte : 10.87 % (la règle 2×/4× sert uniquement d'estimation mentale rapide).

#### 127. `math_outs_19` — Famille `outs_turn_river` | cash (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Calcul exact de probabilité d'outs : Brelan vers full/carré (7 outs) Flop → River. Quelle est la probabilité exacte (%) de toucher au moins un de ces 7 outs ?
- **Hypothèses** : 47 puis 46 cartes inconnues (tapis au flop) ; Outs supposés tous vivants (clean)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 27.84% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Probabilité combinatoire exacte : 27.84 % (la règle 2×/4× sert uniquement d'estimation mentale rapide).

#### 128. `math_outs_20` — Famille `outs_turn_river` | cash (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Calcul exact de probabilité d'outs : Brelan vers full/carré (10 outs) Turn → River. Quelle est la probabilité exacte (%) de toucher au moins un de ces 10 outs ?
- **Hypothèses** : 46 cartes inconnues au turn ; Outs supposés tous vivants (clean)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 21.74% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Probabilité combinatoire exacte : 21.74 % (la règle 2×/4× sert uniquement d'estimation mentale rapide).

#### 129. `math_outs_21` — Famille `outs_turn_river` | cash (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Calcul exact de probabilité d'outs : OESD + 1 overcard (11 outs) Flop → River. Quelle est la probabilité exacte (%) de toucher au moins un de ces 11 outs ?
- **Hypothèses** : 47 puis 46 cartes inconnues (tapis au flop) ; Outs supposés tous vivants (clean)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 41.72% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Probabilité combinatoire exacte : 41.72 % (la règle 2×/4× sert uniquement d'estimation mentale rapide).

#### 130. `math_outs_22` — Famille `outs_turn_river` | cash (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Calcul exact de probabilité d'outs : Couleur + 2 overcards propres (14 outs) Turn → River. Quelle est la probabilité exacte (%) de toucher au moins un de ces 14 outs ?
- **Hypothèses** : 46 cartes inconnues au turn ; Outs supposés tous vivants (clean)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 30.43% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Probabilité combinatoire exacte : 30.43 % (la règle 2×/4× sert uniquement d'estimation mentale rapide).

#### 131. `math_outs_23` — Famille `outs_turn_river` | cash (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Calcul exact de probabilité d'outs : Mega Combo Draw (17 outs) Flop → River. Quelle est la probabilité exacte (%) de toucher au moins un de ces 17 outs ?
- **Hypothèses** : 47 puis 46 cartes inconnues (tapis au flop) ; Outs supposés tous vivants (clean)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 59.76% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Probabilité combinatoire exacte : 59.76 % (la règle 2×/4× sert uniquement d'estimation mentale rapide).

#### 132. `math_outs_24` — Famille `outs_turn_river` | cash (mixed)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Calcul exact de probabilité d'outs : Une overcard propre (3 outs) Flop → Turn. Quelle est la probabilité exacte (%) de toucher au moins un de ces 3 outs ?
- **Hypothèses** : 47 cartes inconnues au flop ; Outs supposés tous vivants (clean)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 6.38% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Probabilité combinatoire exacte : 6.38 % (la règle 2×/4× sert uniquement d'estimation mentale rapide).

#### 133. `math_outs_25` — Famille `outs_turn_river` | cash (mixed)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Calcul exact de probabilité d'outs : 2 overcards (6 outs) Turn → River. Quelle est la probabilité exacte (%) de toucher au moins un de ces 6 outs ?
- **Hypothèses** : 46 cartes inconnues au turn ; Outs supposés tous vivants (clean)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 13.04% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Probabilité combinatoire exacte : 13.04 % (la règle 2×/4× sert uniquement d'estimation mentale rapide).

#### 134. `math_outs_26` — Famille `outs_turn_river` | cash (mixed)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Calcul exact de probabilité d'outs : Double DP + gutshot (10 outs) Flop → Turn. Quelle est la probabilité exacte (%) de toucher au moins un de ces 10 outs ?
- **Hypothèses** : 47 cartes inconnues au flop ; Outs supposés tous vivants (clean)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 21.28% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Probabilité combinatoire exacte : 21.28 % (la règle 2×/4× sert uniquement d'estimation mentale rapide).

#### 135. `math_outs_27` — Famille `outs_turn_river` | cash (mixed)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Calcul exact de probabilité d'outs : Couleur + backdoor/pair (13 outs) Flop → Turn. Quelle est la probabilité exacte (%) de toucher au moins un de ces 13 outs ?
- **Hypothèses** : 47 cartes inconnues au flop ; Outs supposés tous vivants (clean)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 27.66% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Probabilité combinatoire exacte : 27.66 % (la règle 2×/4× sert uniquement d'estimation mentale rapide).

#### 136. `math_blk_01` — Famille `combos_blockers` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Vous tenez AKs (4 combos). Sur la range de 4-Bet value adverse {AA, KK, AK} (28 combos sans bloqueur), quel pourcentage (%) des combos reste-t-il réellement disponible chez Vilain ?
- **Hypothèses** : Sans bloqueurs : AA = 6, KK = 6, AK = 16 (total 28 combos) ; Avec AKs : il reste AA=3, KK=3, AK=9 (15/28 combos)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 53.57% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Votre main AKs réduit {AA, KK, AK} de 28 à 15 combos, soit 53.6 % restant (46.4 % bloqués).

#### 137. `math_blk_02` — Famille `combos_blockers` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Vous tenez AQs (4 combos). Sur la range de 4-Bet value adverse {AA, KK, AK} (28 combos sans bloqueur), quel pourcentage (%) des combos reste-t-il réellement disponible chez Vilain ?
- **Hypothèses** : Sans bloqueurs : AA = 6, KK = 6, AK = 16 (total 28 combos) ; Avec AQs : il reste AA=3, KK=6, AK=12 (21/28 combos)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 75% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Votre main AQs réduit {AA, KK, AK} de 28 à 21 combos, soit 75.0 % restant (25.0 % bloqués).

#### 138. `math_blk_03` — Famille `combos_blockers` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Vous tenez A5s (4 combos). Sur la range de 4-Bet value adverse {AA, KK, AK} (28 combos sans bloqueur), quel pourcentage (%) des combos reste-t-il réellement disponible chez Vilain ?
- **Hypothèses** : Sans bloqueurs : AA = 6, KK = 6, AK = 16 (total 28 combos) ; Avec A5s : il reste AA=3, KK=6, AK=12 (21/28 combos)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 75% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Votre main A5s réduit {AA, KK, AK} de 28 à 21 combos, soit 75.0 % restant (25.0 % bloqués).

#### 139. `math_blk_04` — Famille `combos_blockers` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Vous tenez KQs (4 combos). Sur la range de 4-Bet value adverse {AA, KK, AK} (28 combos sans bloqueur), quel pourcentage (%) des combos reste-t-il réellement disponible chez Vilain ?
- **Hypothèses** : Sans bloqueurs : AA = 6, KK = 6, AK = 16 (total 28 combos) ; Avec KQs : il reste AA=6, KK=3, AK=12 (21/28 combos)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 75% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Votre main KQs réduit {AA, KK, AK} de 28 à 21 combos, soit 75.0 % restant (25.0 % bloqués).

#### 140. `math_blk_05` — Famille `combos_blockers` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Vous tenez QQ (6 combos). Sur la range de 4-Bet value adverse {AA, KK, AK} (28 combos sans bloqueur), quel pourcentage (%) des combos reste-t-il réellement disponible chez Vilain ?
- **Hypothèses** : Sans bloqueurs : AA = 6, KK = 6, AK = 16 (total 28 combos) ; Avec QQ : il reste AA=6, KK=6, AK=16 (28/28 combos)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 100% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Votre main QQ réduit {AA, KK, AK} de 28 à 28 combos, soit 100.0 % restant (0.0 % bloqués).

#### 141. `math_blk_06` — Famille `combos_blockers` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Vous tenez AA (6 combos). Sur la range de 4-Bet value adverse {AA, KK, AK} (28 combos sans bloqueur), quel pourcentage (%) des combos reste-t-il réellement disponible chez Vilain ?
- **Hypothèses** : Sans bloqueurs : AA = 6, KK = 6, AK = 16 (total 28 combos) ; Avec AA : il reste AA=1, KK=6, AK=8 (15/28 combos)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 53.57% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Votre main AA réduit {AA, KK, AK} de 28 à 15 combos, soit 53.6 % restant (46.4 % bloqués).

#### 142. `math_blk_07` — Famille `combos_blockers` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Vous tenez KK (6 combos). Sur la range de 4-Bet value adverse {AA, KK, AK} (28 combos sans bloqueur), quel pourcentage (%) des combos reste-t-il réellement disponible chez Vilain ?
- **Hypothèses** : Sans bloqueurs : AA = 6, KK = 6, AK = 16 (total 28 combos) ; Avec KK : il reste AA=6, KK=1, AK=8 (15/28 combos)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 53.57% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Votre main KK réduit {AA, KK, AK} de 28 à 15 combos, soit 53.6 % restant (46.4 % bloqués).

#### 143. `math_blk_08` — Famille `combos_blockers` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Vous tenez AKo (12 combos). Sur la range de 4-Bet value adverse {AA, KK, AK} (28 combos sans bloqueur), quel pourcentage (%) des combos reste-t-il réellement disponible chez Vilain ?
- **Hypothèses** : Sans bloqueurs : AA = 6, KK = 6, AK = 16 (total 28 combos) ; Avec AKo : il reste AA=3, KK=3, AK=9 (15/28 combos)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 53.57% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Votre main AKo réduit {AA, KK, AK} de 28 à 15 combos, soit 53.6 % restant (46.4 % bloqués).

#### 144. `math_blk_09` — Famille `combos_blockers` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Vous tenez AJo (12 combos). Sur la range de 4-Bet value adverse {AA, KK, AK} (28 combos sans bloqueur), quel pourcentage (%) des combos reste-t-il réellement disponible chez Vilain ?
- **Hypothèses** : Sans bloqueurs : AA = 6, KK = 6, AK = 16 (total 28 combos) ; Avec AJo : il reste AA=3, KK=6, AK=12 (21/28 combos)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 75% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Votre main AJo réduit {AA, KK, AK} de 28 à 21 combos, soit 75.0 % restant (25.0 % bloqués).

#### 145. `math_blk_10` — Famille `combos_blockers` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Vous tenez KJs (4 combos). Sur la range de 4-Bet value adverse {AA, KK, AK} (28 combos sans bloqueur), quel pourcentage (%) des combos reste-t-il réellement disponible chez Vilain ?
- **Hypothèses** : Sans bloqueurs : AA = 6, KK = 6, AK = 16 (total 28 combos) ; Avec KJs : il reste AA=6, KK=3, AK=12 (21/28 combos)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 75% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Votre main KJs réduit {AA, KK, AK} de 28 à 21 combos, soit 75.0 % restant (25.0 % bloqués).

#### 146. `math_blk_11` — Famille `combos_blockers` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Vous tenez QJs (4 combos). Sur la range de 4-Bet value adverse {AA, KK, AK} (28 combos sans bloqueur), quel pourcentage (%) des combos reste-t-il réellement disponible chez Vilain ?
- **Hypothèses** : Sans bloqueurs : AA = 6, KK = 6, AK = 16 (total 28 combos) ; Avec QJs : il reste AA=6, KK=6, AK=16 (28/28 combos)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 100% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Votre main QJs réduit {AA, KK, AK} de 28 à 28 combos, soit 100.0 % restant (0.0 % bloqués).

#### 147. `math_blk_12` — Famille `combos_blockers` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Vous tenez ATs (4 combos). Sur la range de 4-Bet value adverse {AA, KK, AK} (28 combos sans bloqueur), quel pourcentage (%) des combos reste-t-il réellement disponible chez Vilain ?
- **Hypothèses** : Sans bloqueurs : AA = 6, KK = 6, AK = 16 (total 28 combos) ; Avec ATs : il reste AA=3, KK=6, AK=12 (21/28 combos)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 75% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Votre main ATs réduit {AA, KK, AK} de 28 à 21 combos, soit 75.0 % restant (25.0 % bloqués).

#### 148. `math_blk_13` — Famille `combos_blockers` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Vous tenez KQo (12 combos). Sur la range de 4-Bet value adverse {AA, KK, AK} (28 combos sans bloqueur), quel pourcentage (%) des combos reste-t-il réellement disponible chez Vilain ?
- **Hypothèses** : Sans bloqueurs : AA = 6, KK = 6, AK = 16 (total 28 combos) ; Avec KQo : il reste AA=6, KK=3, AK=12 (21/28 combos)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 75% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Votre main KQo réduit {AA, KK, AK} de 28 à 21 combos, soit 75.0 % restant (25.0 % bloqués).

#### 149. `math_blk_14` — Famille `combos_blockers` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Vous tenez A4s (4 combos). Sur la range de 4-Bet value adverse {AA, KK, AK} (28 combos sans bloqueur), quel pourcentage (%) des combos reste-t-il réellement disponible chez Vilain ?
- **Hypothèses** : Sans bloqueurs : AA = 6, KK = 6, AK = 16 (total 28 combos) ; Avec A4s : il reste AA=3, KK=6, AK=12 (21/28 combos)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 75% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Votre main A4s réduit {AA, KK, AK} de 28 à 21 combos, soit 75.0 % restant (25.0 % bloqués).

#### 150. `math_blk_15` — Famille `combos_blockers` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Vous tenez A9s (4 combos). Sur la range de 4-Bet value adverse {AA, KK, AK} (28 combos sans bloqueur), quel pourcentage (%) des combos reste-t-il réellement disponible chez Vilain ?
- **Hypothèses** : Sans bloqueurs : AA = 6, KK = 6, AK = 16 (total 28 combos) ; Avec A9s : il reste AA=3, KK=6, AK=12 (21/28 combos)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 75% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Votre main A9s réduit {AA, KK, AK} de 28 à 21 combos, soit 75.0 % restant (25.0 % bloqués).

#### 151. `math_blk_16` — Famille `combos_blockers` | cash (frontier)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Vous tenez JJ (6 combos). Sur la range de 4-Bet value adverse {AA, KK, AK} (28 combos sans bloqueur), quel pourcentage (%) des combos reste-t-il réellement disponible chez Vilain ?
- **Hypothèses** : Sans bloqueurs : AA = 6, KK = 6, AK = 16 (total 28 combos) ; Avec JJ : il reste AA=6, KK=6, AK=16 (28/28 combos)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 100% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Votre main JJ réduit {AA, KK, AK} de 28 à 28 combos, soit 100.0 % restant (0.0 % bloqués).

#### 152. `math_blk_17` — Famille `combos_blockers` | cash (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Vous tenez A8o (12 combos). Sur la range de 4-Bet value adverse {AA, KK, AK} (28 combos sans bloqueur), quel pourcentage (%) des combos reste-t-il réellement disponible chez Vilain ?
- **Hypothèses** : Sans bloqueurs : AA = 6, KK = 6, AK = 16 (total 28 combos) ; Avec A8o : il reste AA=3, KK=6, AK=12 (21/28 combos)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 75% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Votre main A8o réduit {AA, KK, AK} de 28 à 21 combos, soit 75.0 % restant (25.0 % bloqués).

#### 153. `math_blk_18` — Famille `combos_blockers` | cash (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Vous tenez KTs (4 combos). Sur la range de 4-Bet value adverse {AA, KK, AK} (28 combos sans bloqueur), quel pourcentage (%) des combos reste-t-il réellement disponible chez Vilain ?
- **Hypothèses** : Sans bloqueurs : AA = 6, KK = 6, AK = 16 (total 28 combos) ; Avec KTs : il reste AA=6, KK=3, AK=12 (21/28 combos)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 75% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Votre main KTs réduit {AA, KK, AK} de 28 à 21 combos, soit 75.0 % restant (25.0 % bloqués).

#### 154. `math_blk_19` — Famille `combos_blockers` | cash (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Vous tenez QTs (4 combos). Sur la range de 4-Bet value adverse {AA, KK, AK} (28 combos sans bloqueur), quel pourcentage (%) des combos reste-t-il réellement disponible chez Vilain ?
- **Hypothèses** : Sans bloqueurs : AA = 6, KK = 6, AK = 16 (total 28 combos) ; Avec QTs : il reste AA=6, KK=6, AK=16 (28/28 combos)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 100% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Votre main QTs réduit {AA, KK, AK} de 28 à 28 combos, soit 100.0 % restant (0.0 % bloqués).

#### 155. `math_blk_20` — Famille `combos_blockers` | cash (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Vous tenez JTs (4 combos). Sur la range de 4-Bet value adverse {AA, KK, AK} (28 combos sans bloqueur), quel pourcentage (%) des combos reste-t-il réellement disponible chez Vilain ?
- **Hypothèses** : Sans bloqueurs : AA = 6, KK = 6, AK = 16 (total 28 combos) ; Avec JTs : il reste AA=6, KK=6, AK=16 (28/28 combos)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 100% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Votre main JTs réduit {AA, KK, AK} de 28 à 28 combos, soit 100.0 % restant (0.0 % bloqués).

#### 156. `math_blk_21` — Famille `combos_blockers` | cash (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Vous tenez TT (6 combos). Sur la range de 4-Bet value adverse {AA, KK, AK} (28 combos sans bloqueur), quel pourcentage (%) des combos reste-t-il réellement disponible chez Vilain ?
- **Hypothèses** : Sans bloqueurs : AA = 6, KK = 6, AK = 16 (total 28 combos) ; Avec TT : il reste AA=6, KK=6, AK=16 (28/28 combos)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 100% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Votre main TT réduit {AA, KK, AK} de 28 à 28 combos, soit 100.0 % restant (0.0 % bloqués).

#### 157. `math_blk_22` — Famille `combos_blockers` | cash (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Vous tenez AQo (12 combos). Sur la range de 4-Bet value adverse {AA, KK, AK} (28 combos sans bloqueur), quel pourcentage (%) des combos reste-t-il réellement disponible chez Vilain ?
- **Hypothèses** : Sans bloqueurs : AA = 6, KK = 6, AK = 16 (total 28 combos) ; Avec AQo : il reste AA=3, KK=6, AK=12 (21/28 combos)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 75% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Votre main AQo réduit {AA, KK, AK} de 28 à 21 combos, soit 75.0 % restant (25.0 % bloqués).

#### 158. `math_blk_23` — Famille `combos_blockers` | cash (transfer)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Vous tenez K9s (4 combos). Sur la range de 4-Bet value adverse {AA, KK, AK} (28 combos sans bloqueur), quel pourcentage (%) des combos reste-t-il réellement disponible chez Vilain ?
- **Hypothèses** : Sans bloqueurs : AA = 6, KK = 6, AK = 16 (total 28 combos) ; Avec K9s : il reste AA=6, KK=3, AK=12 (21/28 combos)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 75% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Votre main K9s réduit {AA, KK, AK} de 28 à 21 combos, soit 75.0 % restant (25.0 % bloqués).

#### 159. `math_blk_24` — Famille `combos_blockers` | cash (mixed)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Vous tenez A2s (4 combos). Sur la range de 4-Bet value adverse {AA, KK, AK} (28 combos sans bloqueur), quel pourcentage (%) des combos reste-t-il réellement disponible chez Vilain ?
- **Hypothèses** : Sans bloqueurs : AA = 6, KK = 6, AK = 16 (total 28 combos) ; Avec A2s : il reste AA=3, KK=6, AK=12 (21/28 combos)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 75% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Votre main A2s réduit {AA, KK, AK} de 28 à 21 combos, soit 75.0 % restant (25.0 % bloqués).

#### 160. `math_blk_25` — Famille `combos_blockers` | cash (mixed)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Vous tenez A3s (4 combos). Sur la range de 4-Bet value adverse {AA, KK, AK} (28 combos sans bloqueur), quel pourcentage (%) des combos reste-t-il réellement disponible chez Vilain ?
- **Hypothèses** : Sans bloqueurs : AA = 6, KK = 6, AK = 16 (total 28 combos) ; Avec A3s : il reste AA=3, KK=6, AK=12 (21/28 combos)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 75% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Votre main A3s réduit {AA, KK, AK} de 28 à 21 combos, soit 75.0 % restant (25.0 % bloqués).

#### 161. `math_blk_26` — Famille `combos_blockers` | cash (mixed)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Vous tenez KQo (12 combos). Sur la range de 4-Bet value adverse {AA, KK, AK} (28 combos sans bloqueur), quel pourcentage (%) des combos reste-t-il réellement disponible chez Vilain ?
- **Hypothèses** : Sans bloqueurs : AA = 6, KK = 6, AK = 16 (total 28 combos) ; Avec KQo : il reste AA=6, KK=3, AK=12 (21/28 combos)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 75% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Votre main KQo réduit {AA, KK, AK} de 28 à 21 combos, soit 75.0 % restant (25.0 % bloqués).

#### 162. `math_blk_27` — Famille `combos_blockers` | cash (mixed)
- **Provenance** : `computed` (confiance `high`) • outil: ProPokerV2 Exact Math Engines
- **Unité** : % (`estimate`) • Chrono: 20000 ms
- **Prompt** : Vous tenez 99 (6 combos). Sur la range de 4-Bet value adverse {AA, KK, AK} (28 combos sans bloqueur), quel pourcentage (%) des combos reste-t-il réellement disponible chez Vilain ?
- **Hypothèses** : Sans bloqueurs : AA = 6, KK = 6, AK = 16 (total 28 combos) ; Avec 99 : il reste AA=6, KK=6, AK=16 (28/28 combos)
- **Options** : Slider 0%..100% (pas 0.5)
- **Solution mathématique** : Estimation attendue = 100% (tolérance 0 PD ±1.5, zéro PD à ±15)
- **Explication** : Votre main 99 réduit {AA, KK, AK} de 28 à 28 combos, soit 100.0 % restant (0.0 % bloqués).

#### 163. `friendly_depth_a9o_100bb` — Famille `rfi_friendly` | cash (frontier)
- **Provenance** : `heuristic` (confiance `medium`) • outil: Guide Kill Tilt NL2 (entraînement amical uniquement)
- **Unité** : amical (`weights`) • Chrono: 6000 ms
- **Prompt** : Hero CO (As9d) vs Table NL2/NL10 standard (entraînement non classé)
- **Options** : raise: Open Raise 2.5x ; fold: Fold
- **Solution mathématique** : Solution heuristique (weights) : {"kind":"weights","reference":{"raise":1,"fold":0}}
- **Explication** : En heuristique Kill Tilt 100bb au CO, A9o+ est ouvert en standard (hors mode classé tant qu’un corpus solveur sourcé n’est pas intégré).
