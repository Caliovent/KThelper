---
name: poker-math-engines
description: Règles d'implémentation et formules exactes en TypeScript pur pour les moteurs mathématiques de Pro Poker Suite V2 (Évaluateur 7 cartes / Monte-Carlo, ICM Malmuth-Harville, PKO / Mystery Bounty, Expresso ChipEV, GTO Postflop MDF / Alpha / EV).
---

# Skill : Poker Math Engines (`src/engines/` & `src/workers/`)

## Règles Impératives
1. **Pureté totale** : Tous les moteurs vivent dans `src/engines/*.ts` sans aucune dépendance à React, `window`, `document` ou `localStorage`.
2. **Déport Web Worker** : Les simulations Monte-Carlo (≥ 10 000 itérations) et les résolutions ICM multi-joueurs (≥ 5 joueurs) doivent être appelées via `src/workers/math.worker.ts` avec support `AbortController` / `requestId` pour annuler les calculs obsolètes.
3. **Tests Vitest obligatoires** : Chaque formule ci-dessous doit être couverte par des tests déterministes (graine PRNG fixe pour Monte-Carlo, cas de référence connus pour ICM/PKO).

---

## 1. Évaluateur 7 Cartes & Simulation Monte-Carlo (`src/engines/equity.ts`)

### Encodage rapide des cartes
- Représenter chaque carte sur un entier `0..51` : `rank = card >> 2` (`0 = 2 .. 12 = A`), `suit = card & 3` (`0=s, 1=h, 2=d, 3=c`).
- Bitmask 13 bits par couleur + bitmask global des rangs pour détecter instantanément couleurs, quintes (y compris Wheel `A-2-3-4-5` = `0b1000000001111`), carrés, fulls, brelans et paires sans allocations d'objets dans la boucle chaude.

### Contrats TypeScript
```ts
export type CardCode = string; // ex: "As", "Kh", "Td"
export interface EquityRequest {
  hero: [CardCode, CardCode];
  board: CardCode[]; // 0, 3, 4 ou 5 cartes
  villainRange: CardCode[][]; // combos [c1, c2] autorisés
  iterations: number; // défaut: 10000
  seed?: number;
}
export interface EquityResult {
  winPct: number;
  tiePct: number;
  losePct: number;
  equityPct: number; // winPct + tiePct / 2
  iterationsRun: number;
  elapsedMs: number;
}
```

---

## 2. Modèle ICM — Malmuth-Harville par Masque de Bits (`src/engines/icm.ts`)

### Algorithme Bitmask DP Exact ($O(N \cdot 2^N)$, $N \le 16$) et Gestion des Éliminés (`icmWithBusts`)
**Attention (Audit V2)** : lorsqu'un joueur tombe à $0$ jeton dans un coup où la place d'élimination est payée (ex. Expresso Jackpot `80/12/8`), son $\$EV$ en cas de défaite **n'est pas $0$** mais le gain de la $3^{\text{e}}$ place (`payouts[alive.length]`). Toujours utiliser `icmWithBusts(endStacks, payouts, startStacks)`.

```ts
export function icm(stacks: readonly number[], payouts: readonly number[]): number[] {
  const n = stacks.length;
  if (n > 16 || stacks.some(s => !(s > 0))) throw new RangeError('1..16 tapis strictement positifs');
  const ev = new Array<number>(n).fill(0);
  const dp = new Float64Array(1 << n); dp[0] = 1;
  const total = stacks.reduce((a, b) => a + b, 0);
  for (let mask = 0; mask < (1 << n); mask++) {
    if (dp[mask] === 0) continue;
    let placed = 0, rem = total;
    for (let i = 0; i < n; i++) if (mask & (1 << i)) { placed++; rem -= stacks[i]; }
    if (placed >= Math.min(n, payouts.length)) continue;
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) continue;
      const p = dp[mask] * stacks[i] / rem;
      ev[i] += p * payouts[placed];
      dp[mask | (1 << i)] += p;
    }
  }
  return ev;
}

export function icmWithBusts(end: readonly number[], payouts: readonly number[], startStacks: readonly number[]): number[] {
  const alive = end.map((_, i) => i).filter(i => end[i] > 0);
  const busted = end.map((_, i) => i).filter(i => end[i] <= 0).sort((a, b) => startStacks[b] - startStacks[a]);
  const out = new Array<number>(end.length).fill(0);
  const sub = icm(alive.map(i => end[i]), payouts);
  alive.forEach((i, k) => { out[i] = sub[k]; });
  busted.forEach((i, k) => { out[i] = payouts[alive.length + k] ?? 0; });
  return out;
}
```

### Valeurs de Non-Régression Obligatoires (Audit V2)
- **Bulle 4-Max `40/25/20/15` payée `50/30/20/0`** : Bubble Factors exacts = `2,38` (25 vs 40, $+20,4\text{ pp}$), `1,87` (20 vs 25), `1,83` (15 vs 40), `1,49` (40 vs 25). Avec blindes `0,5/1` (SB 40 shove, BB 25 call), `requiredEquityIcm` = `68,9 %` (vs `48,0 %` ChipEV).
- **Expresso Jackpot `80/12/8`** :
  - `25 vs 25` (tapis `25/25/25`) : `BF = 1,056`, `RP = +1,35 pt`
  - `10 vs 45` (tapis `45/20/10`) : `BF = 1,067`, `RP = +1,62 pt`
  - `20 vs 45` (tapis `45/20/10`) : `BF = 1,113`, `RP = +2,68 pts`
  - `45 vs 20` (tapis `45/20/10`) : `BF = 1,012`, `RP = +0,30 pt`

---

## 3. PKO & Mystery Bounty (`src/engines/formats.ts`)

### Formule Bounty Power Proportionnelle (RPP + BPP)
Ne jamais diviser uniquement par le Regular Prize Pool (erreur de sur-valorisation $\times 2$). Toujours inclure la cagnotte de primes restante :
$$BP = \frac{C_{\text{total}}}{RPP_{\text{rem}} + BPP_{\text{rem}}}, \qquad B_{\text{chips}} = B_{\text{cash}} \cdot BP, \qquad e_{\text{bounty}} = \frac{\text{Call}}{\text{Pot}_{\text{final}} + B_{\text{chips}}}$$
*(Cas de test Mystery Bounty : $C = 50\,000\,000$, $RPP = 100\,000$, $BPP = 100\,000$, $B_{\text{cash}} = 1\,000 \implies B_{\text{chips}} = 250\,000$ jetons).*

---

## 4. Expresso / Spin & Go, Rake & Risque de Ruine (`src/engines/formats.ts`)

- **Winner-Takes-All ($99,88\%$ des parties)** avec tapis initial $S$ (`500` Standard, `300` Nitro) et rake $r$ (`0.07` nominal, `0.0867` hors jackpots $\ge \times 1000$) :
  $$\text{evITM} = \frac{S + \text{cEV}}{3S}, \qquad \text{evROI} = \left(1 + \frac{\text{cEV}}{S}\right)(1 - r) - 1, \qquad \text{cEV}_{\text{breakeven}} = S\left(\frac{1}{1 - r} - 1\right)$$
  *(Seuils d'équilibre : `37,63 cEV` en 500c à 7%, `22,58 cEV` en 300c à 7%, `47,45 cEV` en 500c hors jackpots $\ge \times 1000$).*
- **Risque de Ruine (RoR) & Intervalle de confiance à 95 %** ($\mu, \sigma$ en bb/100, bankroll $B$ en bb) :
  $$\text{RoR} = \exp\!\left(\frac{-2 \mu B}{\sigma^2}\right), \qquad \text{IC}_{95\%} = \mu \pm 1,96 \frac{\sigma}{\sqrt{N_{\text{mains}} / 100}}$$

---

## 5. GTO Postflop & Mathématiques de Mise (`src/engines/postflopMath.ts`)

- **Minimum Defense Frequency (MDF)** face à une mise $B$ dans un pot $P$ :
  $$\text{MDF} = \frac{P}{P + B}$$
- **Alpha (fréquence de fold requise pour un bluff pur EV0)** :
  $$\alpha = \frac{B}{P + B} = 1 - \text{MDF}$$
- **SPR (Stack-to-Pot Ratio)** au flop :
  $$\text{SPR} = \frac{\text{Stack effectif}}{\text{Pot au flop}}$$
  *(Seuils pédagogiques : $\text{SPR} \le 3$ engagement facile Top Paire+, $3 < \text{SPR} \le 7$ prudence avec simple paire, $\text{SPR} > 10$ privilégier brelans/quintes/couleurs max.)*
