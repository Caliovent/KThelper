export type Room = 'winamax' | 'pokerstars' | 'live';
export type FormatKind = 'cash' | 'mtt' | 'pko' | 'mystery' | 'expresso';
export type GameVariant = 'NLHE'; // extensible (PLO hors périmètre V2)
export type Position = 'UTG' | 'UTG1' | 'MP' | 'LJ' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB';
export type Action = 'fold' | 'check' | 'call' | 'limp' | 'bet' | 'raise' | '3bet' | '4bet' | 'allin';

export interface GameContext {
  variant: GameVariant;
  format: FormatKind;
  venue: 'online' | 'live';
  tableSize: 2 | 3 | 4 | 5 | 6 | 8 | 9;
  effectiveStackBb: number;
  anteTotalBb: number;
  rake?: { rate: number; capBb: number; noFlopNoDrop: boolean };
  payouts?: number[];
  stacksBb?: number[];
  openSizeBb?: number;
  limpers?: number;
}

export interface Provenance {
  origin: 'solver_export' | 'computed' | 'heuristic' | 'user';
  tool?: string;
  note?: string;
  confidence: 'high' | 'medium' | 'low';
}

export type FreqVector = Partial<Record<Action, number>>; // somme = 1 ; main absente = fold

export interface RangeSpec {
  id: string;
  context: GameContext;
  hero: Position;
  line: Action[];
  hands: Record<string, FreqVector>;
  evBb?: Record<string, FreqVector>;
  provenance: Provenance;
  version: number;
}

export interface FsrsCardState {
  due: string;
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  state: number;
  lastReview?: string;
  raw: unknown;
}

export interface SkillState {
  skillId: string;
  card: FsrsCardState;
  successes: number;
  failures: number;
  fastShare: number;
  transferShare: number;
}

export interface ReviewEvent {
  id: string;
  skillId: string;
  at: string;
  grade: 1 | 2 | 3 | 4;
  ms: number;
  evLossBb: number | null;
  variantSeed: string;
  source: 'game' | 'warmup' | 'boss' | 'leak' | 'multiplayer';
}

export interface ReviewEventV3 extends Omit<ReviewEvent, 'source'> {
  source: ReviewEvent['source'] | 'multiplayer';
  matchId?: string;
  pd?: number;
  confirmation?: 'provisional' | 'confirmed';
}

export type MatchMode = 'ranked_1v1' | 'ghost_duel' | 'daily_top' | 'team_raid';
export type League = 'cash' | 'mtt_icm' | 'expresso' | 'maths_icm' | 'all_rounder';
export type Integrity = 'L0' | 'L1';
export type GameType =
  | 'paint'
  | 'chrono'
  | 'depth'
  | 'leak_drill'
  | 'texture'
  | 'icm'
  | 'rafale3max'
  | 'funnel'
  | 'boss';

export type SpotState =
  | {
      kind: 'decision';
      hero: Position;
      heroCards: [string, string];
      board: string[];
      history: { actor: Position; action: Action; sizeBb?: number }[];
      options: { id: string; label: string }[];
      villainModel?: string;
    }
  | {
      kind: 'estimate';
      question: string;
      min: number;
      max: number;
      step: number;
      data: Record<string, unknown>;
      assumptions: string[];
    }
  | {
      kind: 'texture';
      board: string[];
      positions: Position[];
      potType: string;
      options: { id: string; label: string }[];
    }
  | {
      kind: 'funnel';
      steps: { street: string; observed: string }[];
      blocks: string[];
    }
  | { kind: 'paint'; lineIds: string[] };

export interface SpotPublic {
  spotIndex: number;
  templateId: string;
  skillId: string;
  family: string;
  gameType: GameType;
  context: GameContext;
  limitMs: number;
  state: SpotState;
}

export type SpotSolution =
  | { kind: 'ev'; unit: 'mbb' | 'ppm_pp'; ev: Record<string, number>; defaultAction: string; trivial: boolean }
  | { kind: 'estimate'; truthPct: number; tolerance: number; zeroAt: number }
  | { kind: 'weights'; reference: Record<string, number> };

export interface CorpusTemplate {
  id: string;
  skillId: string;
  family: string;
  bucket: 'frontier' | 'transfer' | 'mixed';
  ranked: boolean;
  league: League;
  public: Omit<SpotPublic, 'spotIndex'>;
  solution: SpotSolution;
  provenance: Provenance;
  explanationId: string;
}

export interface SeriesRef {
  seed: string;
  corpusVersion: string;
  generatorVersion: string;
  rulesVersion: string;
  templateIds: string[];
}

export interface PlayerAttemptRecord {
  spotIndex: number;
  actionChosen: string | null;
  elapsedMs: number;
  usedHint: boolean;
  loss: number | null;
  lossUnit: 'mbb' | 'ppm_pp' | null;
  pd: number;
  timeout: boolean;
}

export interface GhostChallengeV2 {
  schemaVersion: 2;
  challengeId: string;
  mode: 'ghost_duel';
  league: League;
  series: SeriesRef;
  createdAt: string;
  expiresAt?: string;
  creatorPseudo: string;
  creatorResults?: { records: PlayerAttemptRecord[] };
  integrity: 'L0';
}

export interface Money {
  cents: number;
  currency: 'EUR' | 'USD';
}

interface SessionBase {
  id: string;
  room: Room;
  startedAt: string;
  durationMin?: number;
  net: Money;
  rakeback?: Money;
}

export type Session =
  | (SessionBase & { format: 'cash'; bbCents: number; hands: number; netBb: number; allInEvBb?: number })
  | (SessionBase & {
      format: 'mtt' | 'pko' | 'mystery';
      entries: number;
      invested: Money;
      prizes: Money;
      bounties: Money;
      itm: number;
    })
  | (SessionBase & {
      format: 'expresso';
      games: number;
      buyIn: Money;
      startChips: number;
      allInAdjChips?: number;
      itm: number;
    });

export interface Leak {
  id: string;
  skillId: string;
  format: FormatKind;
  stat: string;
  k: number;
  n: number;
  low: number;
  high: number;
  probability: number;
  status: 'suspect' | 'confirmed' | 'resolved';
  handKeys: string[];
}

export interface AiReview {
  id: string;
  handKey?: string;
  model: string;
  promptVersion: string;
  createdAt: string;
  text: string;
}

export interface ProPokerSuiteState {
  schemaVersion: 2 | 3;
  exportedAt: string;
  appVersion: string;
  profile: {
    xp: number;
    level: 1 | 2 | 3 | 4 | 5;
    videosDone: string[];
    quizAnswered: Record<string, { correct: number; wrong: number }>;
  };
  settings: {
    locale: 'fr';
    desiredRetention: number;
    aiEnabled: boolean;
    geminiModel: string;
    mpEnabled?: boolean;
  };
  ranges: RangeSpec[];
  srs: {
    engine: 'ts-fsrs';
    parameters: unknown;
    skills: Record<string, SkillState>;
    log: (ReviewEvent | ReviewEventV3)[];
  };
  bankroll: {
    sessions: Session[];
    movements: { id: string; at: string; room: Room; amount: Money }[];
  };
  hands: {
    index: { key: string; importedAt: string }[];
    raw?: Record<string, string>;
  };
  leaks: Leak[];
  aiReviews: AiReview[];
  legacy?: Record<string, string>;
}

export interface ProPokerSuiteStateV3 extends Omit<ProPokerSuiteState, 'schemaVersion' | 'srs'> {
  schemaVersion: 3;
  srs: {
    engine: 'ts-fsrs';
    parameters: unknown;
    skills: Record<string, SkillState>;
    log: ReviewEventV3[];
  };
}
