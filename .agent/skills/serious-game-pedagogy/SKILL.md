---
name: serious-game-pedagogy
description: Blueprint pour concevoir et coder les mini-jeux pédagogiques de Pro Poker Suite V2 (Chunking visuel 13×13, fréquences mixtes GTO, algorithme SRS unifié, Daily Warm-up et 5 nouveaux jeux interactifs).
---

# Skill : Serious Game Pedagogy (`src/modules/games/` & `src/engines/srs.ts`)

## Principe Directeur
Ne jamais livrer un tableau de solver brut. Chaque concept stratégique doit passer par **mémorisation active + feedback immédiat + répétition espacée (SRS)**.

---

## 1. Décomposition Visuelle 13×13 (Chunking & Fréquences Mixtes)

### Chunking en 25 lignes (Plancher + Îlots) & Calque Bloqueurs (`src/engines/chunk.ts`)
La grille 13×13 se lit en **25 lignes** : 1 diagonale de paires, 12 lignes assorties (`Axs`..`3xs`) et 12 lignes dépareillées (`Axo`..`3xo`).
Chaque ligne se résume par un **plancher continu (`floor`)** et des **îlots isolés (`islands`)** via `describeLine(line, f, min = 0.5)` (ex. *« Ax assortis : plancher ATs, îlots A5s et A4s »*).
Le **calque bloqueurs** calcule l'impact combinatoire exact : détenir `A5s` réduit les combos `AA` adverses de `6` à `3` et `AK` de `16` à `12` (`KK` reste à `6`).

### Notation FSRS (`gradeAttempt`), Score de Maîtrise (0–100) & Détection Bayésienne des Leaks (`src/engines/srs.ts`)
- **Séparation Maîtrise / XP** : l'XP récompense le volume, tandis que le **Score de Maîtrise $M \in [0, 100]$** mesure la rétention réelle :
  $$M = \text{round}\!\left(100 \cdot (0,45 A + 0,25 R + 0,15 V + 0,15 T) \cdot \min\!\left(1, \frac{n}{12}\right)\right), \qquad A = \frac{s + 2}{n + 4}$$
- **Notation `gradeAttempt` (`1 Again | 2 Hard | 3 Good | 4 Easy`)** : basée sur la perte d'EV (`evLossBb > 0.10` → `1`, `> 0.03` → `2`), l'écart de fréquence (`freqError > 0.35` → `1`), l'usage d'indice et le temps de réponse.
- **Détection Bayésienne des Leaks (`betaCdfInt` & `leakProbability`)** : sur $k$ actions observées parmi $n$ opportunités face à une bande cible $[\text{low}, \text{high}]$, calcule $P(X < \text{low})$ et $P(X > \text{high})$ sous une loi $\text{Beta}(k+1, n-k+1)$ (*Suspect* dès $p \ge 0,80$, *Confirmé* dès $p \ge 0,95$ avec $n \ge 30$).
- **Daily Warm-up de 5 minutes (`buildWarmup`, budget 300s)** : `50 %` révisions dues, `25 %` leaks détectés, `15 %` nouveautés, `10 %` transfert (variante inédite), avec **entrelacement automatique des familles** (jamais deux familles identiques consécutives).

### Rendu des fréquences mixtes GTO
Pour toute cellule ayant une stratégie mixte (ex. `{ raise: 0.65, opencall: 0.35 }`) :
- Utiliser un rendu CSS `linear-gradient(to right, ...)` proportionnel aux fréquences exactes (barres bicolores ou tricolores nettes, sans flou) + tooltip affichant le % exact par action.

---

## 2. Algorithme SRS Unifié (`src/engines/srs.ts`)

Étendre le système `weakHands` de la V1 vers un moteur SRS multi-domaines (`preflop`, `postflop`, `icm`, `bounty`, `expresso`) :

```ts
export type LeakDomain = 'preflop' | 'postflop' | 'icm' | 'bounty' | 'expresso';

export interface SrsCard {
  id: string; // clé canonique ex: "icm|bubble_9max|BTN_12bb|A9o"
  domain: LeakDomain;
  spotLabel: string;
  handOrBoard: string;
  expectedAction: string;
  misses: number;
  streakRight: number;
  box: 1 | 2 | 3 | 4; // Boîte Leitner (1j, 3j, 7j, graduée)
  nextReviewAt: string; // ISO timestamp
  lastSeenAt: string;
}
```

### Règles de progression SRS
- **Erreur** : `misses += 1`, `streakRight = 0`, `box = 1`, `nextReviewAt = now`.
- **Réussite** : `streakRight += 1`, `box = min(4, box + 1)` ; si `streakRight >= 2` en drill ciblé (ou `box === 4`), la carte est marquée **maîtrisée** et crédite `+15 XP`.
- **Séance « Daily Warm-up » (5 minutes)** : pioche automatiquement 10 à 12 cartes arrivées à échéance (`nextReviewAt <= now`) en priorisant `misses` décroissant, complétées par des mains frontières si le backlog est vide.

---

## 3. Spécifications des 5 Nouveaux Jeux V2

1. **Lecture de Texture & C-Bet** (`src/modules/games/CbetTextureGame.tsx`)
   - Affiche un spot (Position IP/OOP, Pot Type SRP/3-Bet, Flop généré).
   - Le joueur identifie la texture (`Dry`, `Connecté / Drawy`, `Monotone`, `Pairé`) puis choisit la taille/fréquence de C-Bet (`Check`, `1/3 Pot`, `2/3 Pot`, `Overbet`).
2. **Push / Fold sous Pression ICM** (`src/modules/games/IcmPushFoldGame.tsx`)
   - Affiche les tapis en BB, le payout, le *Bubble Factor* calculé par `icm.ts` et une main frontière.
   - Contrainte chrono (8s par décision), comparaison directe entre la décision **ChipEV** et la décision **ICM** (montre l'écart en `$EV`).
3. **Iso & Expresso 3-Max** (`src/modules/games/ExpressoGame.tsx`)
   - Enchaînement rapide 3-Max / Heads-Up entre 8bb et 25bb : `Open Shove`, `Min-Raise`, `Limp-Trap`, `Iso-Raise`, `Fold`.
4. **Hand Reading Entonnoir** (`src/modules/games/HandReadingGame.tsx`)
   - Exercice interactif : partir de la range préflop adverse sur une matrice 13×13, puis **éliminer** les combos qui foldent/relancent au Flop et à la Turn pour deviner le % de bluffs vs value à la River.
5. **Boss Fights Rue par Rue** (`src/modules/games/BossFightGame.tsx`)
   - Scénario complet sur 4 rues (`Préflop → Flop → Turn → River`) contre un profil précis (`Nit`, `Calling Station`, `LAG`, `Reg`).
   - Barre de vie / stack de 100bb ; une erreur grave sur une rue inflige une perte d'EV, réussir les 4 rues débloque un badge + `+50 XP`.
