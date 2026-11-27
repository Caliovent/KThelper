import {
  DEFAULT_3BET_SPOTS,
  handsArrayToMap,
  parseNotationIntoHands,
  type DefenseAction3Bet,
  type Range3BetSpot,
  type SpotPositionKey,
  type Villain3BetProfile,
} from '../engines/rangeBuilder3Bet.ts';

export const STORAGE_KEY_RANGE_BUILDER_3BET = 'pro_poker_range_builder_3bet_v1';

export interface CustomRange3BetStoreState {
  version: 1;
  activeSpotId: string;
  spots: Range3BetSpot[];
}

function cloneSpot(spot: Range3BetSpot): Range3BetSpot {
  return {
    ...spot,
    openHands: { ...spot.openHands },
    defenseMap: { ...spot.defenseMap },
    provenance: { ...spot.provenance },
  };
}

export function createInitialRange3BetState(): CustomRange3BetStoreState {
  return {
    version: 1,
    activeSpotId: DEFAULT_3BET_SPOTS[0].id,
    spots: DEFAULT_3BET_SPOTS.map(cloneSpot),
  };
}

function sanitizeSpot(raw: unknown): Range3BetSpot | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.id !== 'string' || typeof obj.label !== 'string') return null;

  const validOpen: Record<string, true> = {};
  if (obj.openHands && typeof obj.openHands === 'object') {
    for (const [k, v] of Object.entries(obj.openHands as Record<string, unknown>)) {
      if (v === true) validOpen[k] = true;
    }
  }

  const validDefense: Record<string, DefenseAction3Bet> = {};
  if (obj.defenseMap && typeof obj.defenseMap === 'object') {
    for (const [k, v] of Object.entries(obj.defenseMap as Record<string, unknown>)) {
      if (validOpen[k] && (v === 'fourbet_value' || v === 'fourbet_bluff' || v === 'call' || v === 'fold')) {
        validDefense[k] = v;
      }
    }
  }

  const heroPos = (['UTG', 'MP', 'CO', 'BTN', 'SB'].includes(String(obj.heroPos))
    ? obj.heroPos
    : 'CO') as SpotPositionKey;
  const villainProfile = (['nit', 'reg', 'aggro'].includes(String(obj.villainProfile))
    ? obj.villainProfile
    : 'reg') as Villain3BetProfile;

  return {
    id: obj.id,
    label: obj.label,
    heroPos,
    villainPos: typeof obj.villainPos === 'string' ? obj.villainPos : 'BTN',
    isIP: Boolean(obj.isIP),
    openSizeBb: typeof obj.openSizeBb === 'number' && obj.openSizeBb >= 2 ? obj.openSizeBb : 2.5,
    threeBetSizeBb:
      typeof obj.threeBetSizeBb === 'number' && obj.threeBetSizeBb >= 4 ? obj.threeBetSizeBb : 8.5,
    fourBetSizeBb:
      typeof obj.fourBetSizeBb === 'number' && obj.fourBetSizeBb >= 12 ? obj.fourBetSizeBb : 21,
    effectiveStackBb:
      typeof obj.effectiveStackBb === 'number' && obj.effectiveStackBb >= 20 ? obj.effectiveStackBb : 100,
    villainProfile,
    openHands: validOpen,
    defenseMap: validDefense,
    notes: typeof obj.notes === 'string' ? obj.notes : '',
    provenance:
      obj.provenance && typeof obj.provenance === 'object'
        ? (obj.provenance as Range3BetSpot['provenance'])
        : { origin: 'user', tool: 'Constructeur 3-Bet / 4-Bet', confidence: 'medium' },
    isCustom: Boolean(obj.isCustom),
    createdAt: typeof obj.createdAt === 'number' ? obj.createdAt : undefined,
    updatedAt: typeof obj.updatedAt === 'number' ? obj.updatedAt : undefined,
  };
}

export function loadRange3BetState(): CustomRange3BetStoreState {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return createInitialRange3BetState();
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_RANGE_BUILDER_3BET);
    if (!raw) return createInitialRange3BetState();
    const parsed = JSON.parse(raw) as { activeSpotId?: unknown; spots?: unknown[] };
    const loadedSpots = Array.isArray(parsed.spots)
      ? parsed.spots.map(sanitizeSpot).filter((s): s is Range3BetSpot => s !== null)
      : [];

    if (loadedSpots.length === 0) {
      return createInitialRange3BetState();
    }

    // Ensure preset defaults exist if missing (preserves user overrides of presets + custom spots)
    const existingIds = new Set(loadedSpots.map((s) => s.id));
    for (const def of DEFAULT_3BET_SPOTS) {
      if (!existingIds.has(def.id)) {
        loadedSpots.push(cloneSpot(def));
      }
    }

    const activeSpotId =
      typeof parsed.activeSpotId === 'string' && loadedSpots.some((s) => s.id === parsed.activeSpotId)
        ? parsed.activeSpotId
        : loadedSpots[0].id;

    return {
      version: 1,
      activeSpotId,
      spots: loadedSpots,
    };
  } catch {
    return createInitialRange3BetState();
  }
}

export function saveRange3BetState(state: CustomRange3BetStoreState): void {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY_RANGE_BUILDER_3BET, JSON.stringify(state));
  } catch {
    // Ignore quota / private browsing storage errors cleanly
  }
}

export function createCustomSpot(params: {
  label: string;
  heroPos: SpotPositionKey;
  villainPos: string;
  isIP: boolean;
  openSizeBb?: number;
  threeBetSizeBb?: number;
  fourBetSizeBb?: number;
  seedFromSpot?: Range3BetSpot;
}): Range3BetSpot {
  const now = Date.now();
  const baseOpen = params.seedFromSpot
    ? { ...params.seedFromSpot.openHands }
    : handsArrayToMap(parseNotationIntoHands('66+, ATs+, KQs, QJs, JTs, AQo+'));
  const baseDefense: Record<string, DefenseAction3Bet> = {};
  for (const h of Object.keys(baseOpen)) {
    baseDefense[h] = params.seedFromSpot?.defenseMap[h] ?? 'fold';
  }
  if (!params.seedFromSpot) {
    for (const h of ['AA', 'KK', 'QQ', 'AKs', 'AKo']) {
      if (baseOpen[h]) baseDefense[h] = 'fourbet_value';
    }
    for (const h of ['JJ', 'TT', '99', 'AQs', 'KQs']) {
      if (baseOpen[h]) baseDefense[h] = 'call';
    }
  }

  return {
    id: `custom_3bet_${now}_${Math.random().toString(36).slice(2, 6)}`,
    label: params.label.trim() || `${params.heroPos} vs ${params.villainPos} Custom`,
    heroPos: params.heroPos,
    villainPos: params.villainPos,
    isIP: params.isIP,
    openSizeBb: params.openSizeBb ?? params.seedFromSpot?.openSizeBb ?? 2.5,
    threeBetSizeBb: params.threeBetSizeBb ?? params.seedFromSpot?.threeBetSizeBb ?? 8.5,
    fourBetSizeBb: params.fourBetSizeBb ?? params.seedFromSpot?.fourBetSizeBb ?? 21,
    effectiveStackBb: params.seedFromSpot?.effectiveStackBb ?? 100,
    villainProfile: params.seedFromSpot?.villainProfile ?? 'reg',
    openHands: baseOpen,
    defenseMap: baseDefense,
    notes: params.seedFromSpot
      ? `Spot dérivé de « ${params.seedFromSpot.label} ».`
      : 'Spot personnalisé : peignez votre range Open à l’étape 1 puis votre défense vs 3-Bet à l’étape 2.',
    provenance: {
      origin: 'user',
      tool: 'Constructeur Open & 4-Bet',
      note: 'Range créée et calibrée par l’utilisateur.',
      confidence: 'high',
    },
    isCustom: true,
    createdAt: now,
    updatedAt: now,
  };
}

export function resetPresetSpot(spotId: string): Range3BetSpot | null {
  const def = DEFAULT_3BET_SPOTS.find((s) => s.id === spotId);
  return def ? cloneSpot(def) : null;
}
