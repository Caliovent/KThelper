---
name: hand-history-parser
description: Spécifications du parseur local (Regex/AST en TypeScript pur) pour importer les fichiers .txt bruts Winamax et PokerStars (Cash Game, MTT, Expresso) dans un Web Worker, calculer Net/bb/100/cEV et détecter automatiquement les leaks.
---

# Skill : Hand History Parser (`src/engines/hhParser.ts` & `src/workers/hh.worker.ts`)

## Règles Impératives
1. **100 % Client-Side** : Aucun fichier `.txt` ne doit être envoyé vers un serveur externe.
2. **Web Worker obligatoire** pour les fichiers > 50 mains afin de maintenir l'UI fluide avec progression en % (`onProgress`).
3. **Tolérance aux formats** : Gérer les retours ligne CRLF/LF, les devises `€`, `$` ou jetons (`chips` en MTT/Expresso), et les noms de joueurs contenant espaces ou caractères spéciaux.

---

## 1. Formats Supportés (Winamax & PokerStars)

### Winamax
- **En-tête** : `Winamax Poker - CashGame - HandId: #... - Holdem no limit (0.01€/0.02€) - YYYY/MM/DD HH:MM:SS UTC`
  - Variantes : `CashGame`, `Tournament "..." buyIn: ...`, `Expresso ...`
- **Table & Bouton** : `Table '...' 5-max Seat #3 is the button` (ou `6-max`, `3-max`, `9-max`).
- **Sièges** : `Seat 1: PlayerName (2.00€)` ou `(1500)` + optionnel `bounty` en PKO.
- **Cartes Hero** : `Dealt to HeroName [As Qd]`.
- **Rues** : `*** PRE-FLOP ***`, `*** FLOP *** [Ah 9d 4c]`, `*** TURN *** [Ah 9d 4c] [7s]`, `*** RIVER *** [...] [2d]`, `*** SHOW DOWN ***`, `*** SUMMARY ***`.

### PokerStars
- **En-tête** : `PokerStars Hand #...: Hold'em No Limit ($0.01/$0.02 USD) - ...` ou `Tournament #..., ... Hold'em No Limit - Level I (10/20)`
- **Cartes Hero** : `Dealt to HeroName [Ac Kh]`
- **Rues** : `*** HOLE CARDS ***`, `*** FLOP ***`, `*** TURN ***`, `*** RIVER ***`, `*** SUMMARY ***`.

---

## 2. Modèle de Données Canonique (`src/types/handHistory.ts`)

```ts
export type RoomName = 'winamax' | 'pokerstars' | 'unknown';
export type GameFormat = 'cash' | 'mtt' | 'expresso';

export interface ParsedAction {
  street: 'preflop' | 'flop' | 'turn' | 'river';
  player: string;
  type: 'post_sb' | 'post_bb' | 'ante' | 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin';
  amount: number; // en devise ou jetons
  isHero: boolean;
}

export interface ParsedHand {
  handId: string;
  room: RoomName;
  format: GameFormat;
  playedAt: string; // ISO
  tableSize: number; // 3, 5, 6, 9
  smallBlind: number;
  bigBlind: number;
  currency: 'EUR' | 'USD' | 'CHIPS';
  heroName: string;
  heroPosition: 'UTG' | 'MP' | 'CO' | 'BTN' | 'SB' | 'BB';
  heroCards: [string, string] | null;
  heroStackBb: number;
  board: string[];
  actions: ParsedAction[];
  netWon: number; // Net Hero (collecté - investi)
  netBb: number;
  sawFlop: boolean;
  isAllInShowdown: boolean;
}
```

---

## 3. Pipeline Canonique (`src/engines/parser.ts`) & Détection Statistique des Leaks

1. **API pure (`NormalizedHand`, `splitHands`, `detectSite`, `parseHand`, `importFile`)** :
   - Découpage BOM-safe (`splitHands`) supportant Winamax (`HandId: #...`) et PokerStars (`Hand #` / `Game #`).
   - Extraction des sièges, blindes (`bigBlind`), format (`isTournament`), `hero`, `heroCards`, `board` et actions par rue (`preflop`, `flop`, `turn`, `river`, `allIn`).
   - Déduplication stricte via clé canonique `${site}:${handId}` (`importFile(text, knownSet)`), avec rapport `duplicates` et `errors` / `warnings` non silencieux.
2. **Détection Bayésienne des Leaks par Opportunité** :
   - Compter `k` actions pour `n` opportunités réelles (`VPIP`, `PFR`, `3-bet`, `Fold to 3-bet`, `C-bet flop`, `WTSD`) et évaluer via `leakProbability({ k, n, low, high })` (seuil *Suspect* $\ge 0,80$, *Confirmé* $\ge 0,95$ avec $n \ge 30$).
   - **Anonymisation IA** : toujours remplacer les pseudos par des positions (`Hero`, `Villain CO`) avant tout envoi vers Gemini.
