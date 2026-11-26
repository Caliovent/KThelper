import { parseHand } from '../parser';

/** Partage d'une main : reconstruction par LISTE BLANCHE. Rien n'est copié du texte brut. */
export interface SourceHand {
  bigBlind: number;
  playedAtMs: number;
  buttonSeat: number;
  hero: string;
  heroCards: string[];
  board: string[];
  seats: { seat: number; name: string; stack: number }[];
  actions: {
    street: string;
    player: string;
    type: string;
    amount: number;
    to?: number;
    allIn: boolean;
  }[];
}

export interface SharedHand {
  tableSize: number;
  heroLabel: string;
  heroCards: string[];
  board: string[];
  stacksBb: Record<string, number>;
  actions: {
    street: string;
    actor: string;
    type: string;
    amountBb: number;
    toBb?: number;
    allIn: boolean;
  }[];
}

export const MIN_AGE_MS = 24 * 3600e3;

const LABELS: Record<number, string[]> = {
  2: ['BTN', 'BB'],
  3: ['BTN', 'SB', 'BB'],
  4: ['BTN', 'SB', 'BB', 'CO'],
  5: ['BTN', 'SB', 'BB', 'UTG', 'CO'],
  6: ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'],
  7: ['BTN', 'SB', 'BB', 'UTG', 'LJ', 'HJ', 'CO'],
  8: ['BTN', 'SB', 'BB', 'UTG', 'UTG1', 'LJ', 'HJ', 'CO'],
  9: ['BTN', 'SB', 'BB', 'UTG', 'UTG1', 'MP', 'LJ', 'HJ', 'CO'],
};

export function toShared(h: SourceHand, nowMs: number): SharedHand {
  if (!(nowMs - h.playedAtMs >= MIN_AGE_MS)) {
    throw new Error('main trop récente pour être partagée');
  }
  const seats = [...h.seats].sort((a, b) => a.seat - b.seat);
  const btn = seats.findIndex((s) => s.seat === h.buttonSeat);
  if (btn < 0) throw new Error('bouton introuvable');
  const labels = LABELS[seats.length];
  if (!labels) throw new Error('taille de table non gérée');

  const label = new Map<string, string>();
  seats.forEach((_, k) => label.set(seats[(btn + k) % seats.length].name, labels[k]));
  const bb = (x: number) => Math.round((2 * x) / h.bigBlind) / 2; // arrondi à 0,5 bb
  const who = (n: string) => {
    const l = label.get(n);
    if (!l) throw new Error('joueur inconnu');
    return l;
  };
  const card = (c: string) => {
    if (!/^[2-9TJQKA][shdc]$/.test(c)) throw new Error('carte invalide');
    return c;
  };
  const word = (w: string, ok: string[]) => {
    if (!ok.includes(w)) throw new Error('valeur invalide');
    return w;
  };

  return {
    tableSize: seats.length,
    heroLabel: who(h.hero),
    heroCards: h.heroCards.map(card),
    board: h.board.map(card),
    stacksBb: Object.fromEntries(seats.map((s) => [who(s.name), bb(s.stack)])),
    actions: h.actions.map((a) => ({
      street: word(a.street, ['preflop', 'flop', 'turn', 'river']),
      actor: who(a.player),
      type: word(a.type, ['fold', 'check', 'call', 'bet', 'raise']),
      amountBb: bb(a.amount),
      ...(a.to === undefined ? {} : { toBb: bb(a.to) }),
      allIn: !!a.allIn,
    })),
  };
}

/** Parse une main Winamax / PokerStars brute et extrait uniquement la structure blanche anonymisable. */
export function parseRawToSourceHand(raw: string, playedAtMs?: number): SourceHand {
  const norm = parseHand(raw);
  if (!norm.hero || !norm.heroCards || norm.heroCards.length !== 2) {
    throw new Error('cartes du joueur Hero introuvables');
  }
  const btnMatch = raw.match(/Seat #(\d+) is the button/i);
  if (!btnMatch) throw new Error('bouton (Seat #N is the button) introuvable');
  const buttonSeat = Number(btnMatch[1]);

  let resolvedTs = playedAtMs;
  if (resolvedTs === undefined) {
    const dtMatch = raw.match(/(\d{4})[\/-](\d{2})[\/-](\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
    if (!dtMatch) throw new Error('horodatage de la main introuvable');
    resolvedTs = Date.UTC(
      Number(dtMatch[1]),
      Number(dtMatch[2]) - 1,
      Number(dtMatch[3]),
      Number(dtMatch[4]),
      Number(dtMatch[5]),
      Number(dtMatch[6])
    );
  }

  return {
    bigBlind: norm.bigBlind,
    playedAtMs: resolvedTs,
    buttonSeat,
    hero: norm.hero,
    heroCards: norm.heroCards,
    board: norm.board,
    seats: norm.seats,
    actions: norm.actions,
  };
}
