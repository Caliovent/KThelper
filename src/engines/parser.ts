export type Site = 'winamax' | 'pokerstars';

export interface ParsedAction {
  street: 'preflop' | 'flop' | 'turn' | 'river';
  player: string;
  type: 'fold' | 'check' | 'call' | 'bet' | 'raise';
  amount: number;
  to?: number;
  allIn: boolean;
}

export interface NormalizedHand {
  key: string;
  site: Site;
  handId: string;
  bigBlind: number;
  isTournament: boolean;
  playedAtMs?: number;
  buttonSeat?: number;
  seats: { seat: number; name: string; stack: number }[];
  hero?: string;
  heroCards?: string[];
  board: string[];
  actions: ParsedAction[];
  warnings: string[];
  raw: string;
}

export const splitHands = (file: string) =>
  file
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .split(/\n(?=(?:Winamax Poker - |PokerStars (?:Zoom )?(?:Hand|Game) #))/)
    .map((s) => s.trim())
    .filter(Boolean);

export const detectSite = (h: string): Site | null =>
  h.startsWith('Winamax Poker') ? 'winamax' : h.startsWith('PokerStars') ? 'pokerstars' : null;

const num = (s: string) => Number(s.replace(/[€$£\s]/g, '').replace(',', '.'));

const RE = {
  id: { winamax: /HandId: #([\d-]+)/, pokerstars: /(?:Hand|Game) #(\d+)/ },
  blinds: /\((?:[€$£]?[\d.,]+[€$£]?\/)?(?:[€$£]?[\d.,]+[€$£]?\/)?[€$£]?[\d.,]+[€$£]?\/([€$£]?[\d.,]+)[€$£]?(?:\s+[A-Z]{3})?\)/,
  blindsPs: /\([€$£]?[\d.,]+[€$£]?\/[€$£]?([\d.,]+)[€$£]?(?:\s+[A-Z]{3})?\)/,
  seat: /^Seat (\d+): (.+?) \(([€$£]?[\d.,]+[€$£]?)(?: in chips)?[^)]*\)/,
  dealt: /^Dealt to (.+?) \[(\S\S) (\S\S)\]/,
  street: /^\*\*\* (PRE-FLOP|HOLE CARDS|FLOP|TURN|RIVER|SHOW ?DOWN|SUMMARY) \*\*\*/,
  action:
    /^(.+?):? (folds|checks|calls|bets|raises)(?: ([€$£]?[\d.,]+[€$£]?))?(?: to ([€$£]?[\d.,]+[€$£]?))?( and is all-in)?\s*$/,
};

const TYPE = {
  folds: 'fold',
  checks: 'check',
  calls: 'call',
  bets: 'bet',
  raises: 'raise',
} as const;

export function parseHand(raw: string): NormalizedHand {
  const site = detectSite(raw);
  if (!site) throw new Error('site inconnu');
  const lines = raw.split('\n');
  const head = lines[0];
  const handId = head.match(RE.id[site])?.[1];
  if (!handId) throw new Error('identifiant introuvable');
  const bbm = head.match(site === 'winamax' ? RE.blinds : RE.blindsPs);
  if (!bbm) throw new Error('blindes introuvables');

  const dtMatch = raw.match(/(\d{4})[\/-](\d{2})[\/-](\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
  const playedAtMs = dtMatch
    ? Date.UTC(
        Number(dtMatch[1]),
        Number(dtMatch[2]) - 1,
        Number(dtMatch[3]),
        Number(dtMatch[4]),
        Number(dtMatch[5]),
        Number(dtMatch[6])
      )
    : undefined;
  const btnMatch = raw.match(/Seat #(\d+) is the button/i);
  const buttonSeat = btnMatch ? Number(btnMatch[1]) : undefined;

  const h: NormalizedHand = {
    key: `${site}:${handId}`,
    site,
    handId,
    bigBlind: num(bbm[1]),
    isTournament: /Tournament/i.test(head),
    ...(playedAtMs !== undefined ? { playedAtMs } : {}),
    ...(buttonSeat !== undefined ? { buttonSeat } : {}),
    seats: [],
    board: [],
    actions: [],
    warnings: [],
    raw,
  };

  let street: ParsedAction['street'] | null = null;
  let done = false;

  for (const l of lines.slice(1)) {
    const st = l.match(RE.street);
    if (st) {
      if (st[1] === 'SUMMARY' || st[1].startsWith('SHOW')) done = true;
      else {
        street =
          st[1] === 'FLOP'
            ? 'flop'
            : st[1] === 'TURN'
              ? 'turn'
              : st[1] === 'RIVER'
                ? 'river'
                : 'preflop';
      }
      const cards = [...l.matchAll(/\[([^\]]+)\]/g)].flatMap((m) => m[1].split(' '));
      if (cards.length && !done) h.board = cards;
      continue;
    }
    if (done) continue;
    const d = l.match(RE.dealt);
    if (d) {
      h.hero = d[1];
      h.heroCards = [d[2], d[3]];
      continue;
    }
    if (!street) {
      const s = l.match(RE.seat);
      if (s) h.seats.push({ seat: +s[1], name: s[2], stack: num(s[3]) });
      continue;
    }
    const a = l.match(RE.action);
    if (a && h.seats.some((s) => s.name === a[1])) {
      h.actions.push({
        street,
        player: a[1],
        type: TYPE[a[2] as keyof typeof TYPE],
        amount: a[3] ? num(a[3]) : 0,
        to: a[4] ? num(a[4]) : undefined,
        allIn: !!a[5],
      });
    } else if (/ (folds|checks|calls|bets|raises)\b/.test(l)) {
      h.warnings.push(l);
    }
  }

  return h;
}

export function importFile(text: string, known = new Set<string>()) {
  const hands: NormalizedHand[] = [];
  const errors: { index: number; reason: string }[] = [];
  let duplicates = 0;

  splitHands(text).forEach((raw, index) => {
    try {
      const h = parseHand(raw);
      if (known.has(h.key)) duplicates++;
      else {
        known.add(h.key);
        hands.push(h);
      }
    } catch (e) {
      errors.push({ index, reason: (e as Error).message });
    }
  });

  return { hands, duplicates, errors };
}
