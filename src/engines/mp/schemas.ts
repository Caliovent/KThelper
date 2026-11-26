import { z } from 'zod';
import { RULES_VERSION } from './config.ts';

export const LeagueSchema = z.enum(['cash', 'mtt_icm', 'expresso', 'maths_icm', 'all_rounder']);

export const SeriesRefSchema = z
  .object({
    seed: z.string().min(1).max(128),
    corpusVersion: z.string().min(1).max(64),
    generatorVersion: z.string().min(1).max(64),
    rulesVersion: z.literal(RULES_VERSION),
    templateIds: z.array(z.string().min(1).max(64)).min(1).max(20),
  })
  .strict();

export const PlayerAttemptRecordSchema = z
  .object({
    spotIndex: z.number().int().min(0).max(19),
    actionChosen: z.string().min(1).max(64).nullable(),
    elapsedMs: z.number().min(0).max(120000),
    usedHint: z.boolean(),
    loss: z.number().min(0).nullable(),
    lossUnit: z.enum(['mbb', 'ppm_pp']).nullable(),
    pd: z.number().int().min(0).max(1000),
    timeout: z.boolean(),
  })
  .strict();

export const GhostChallengeV2Schema = z
  .object({
    schemaVersion: z.literal(2),
    challengeId: z.string().min(1).max(128),
    mode: z.literal('ghost_duel'),
    league: LeagueSchema,
    series: SeriesRefSchema,
    createdAt: z.string().min(10).max(64),
    expiresAt: z.string().min(10).max(64).optional(),
    creatorPseudo: z.string().min(1).max(32),
    creatorResults: z
      .object({
        records: z.array(PlayerAttemptRecordSchema).min(1).max(20),
      })
      .strict()
      .optional(),
    integrity: z.literal('L0'),
  })
  .strict();

export const ReviewEventV3Schema = z
  .object({
    id: z.string().min(1).max(160),
    skillId: z.string().min(1).max(160),
    at: z.string().min(10).max(64),
    grade: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
    ms: z.number().min(0).max(600000),
    evLossBb: z.number().nullable(),
    variantSeed: z.string().min(1).max(128),
    source: z.enum(['game', 'warmup', 'boss', 'leak', 'multiplayer']),
    matchId: z.string().min(1).max(128).optional(),
    pd: z.number().int().min(0).max(1000).optional(),
    confirmation: z.enum(['provisional', 'confirmed']).optional(),
  })
  .strict();

/** Contrats Zod stricts des frontières HTTP M1 (/v1/*). */
export const PseudoSchema = z
  .string()
  .trim()
  .min(3)
  .max(24)
  .regex(/^[a-zA-Z0-9_-]+$/, 'Pseudo : lettres, chiffres, _ ou - uniquement (3..24 car.)');

export const AuthLinkRequestSchema = z
  .object({
    email: z.string().trim().email().max(160),
    pseudo: PseudoSchema,
    adultAttested: z.literal(true),
  })
  .strict();

export const AuthSessionRequestSchema = z
  .object({
    linkToken: z.string().min(12).max(128),
  })
  .strict();

export const QueueJoinSchema = z
  .object({
    league: LeagueSchema,
    mode: z.literal('ghost_duel').default('ghost_duel'),
    targetMatchId: z.string().uuid().optional(),
  })
  .strict();

export const OpenSpotRequestSchema = z
  .object({
    key: z.string().uuid(),
  })
  .strict();

export const AnswerSpotRequestSchema = z
  .object({
    action: z.string().min(1).max(64),
    clientMs: z.number().finite().min(0).max(120000),
    key: z.string().uuid(),
  })
  .strict();

export const ForfeitRequestSchema = z
  .object({
    key: z.string().uuid(),
  })
  .strict();

export const DailyStartRequestSchema = z
  .object({
    key: z.string().uuid(),
  })
  .strict();

export const LeaderboardQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(200).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    season: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();

export const FresqueLineAnswerSchema = z
  .object({
    floorIndex: z.number().int().min(0).max(12).nullable(),
    islands: z.array(z.number().int().min(0).max(12)).max(13),
  })
  .strict();

export const SalveAnswerSchema = z
  .object({
    action: z.enum(['allin', 'call', 'fold']),
  })
  .strict();

/** Contrats Zod WebSocket Live Arena M2 (Bible p.30) & Console de Revue (MP-21). */
export const ClientMsgSchema = z.discriminatedUnion('t', [
  z
    .object({
      t: z.literal('hello'),
      protocol: z.literal(1),
      token: z.string().min(1).max(256),
      resumeRunId: z.string().uuid().optional(),
    })
    .strict(),
  z.object({ t: z.literal('ready'), matchId: z.string().uuid() }).strict(),
  z
    .object({
      t: z.literal('queue_live'),
      league: LeagueSchema.default('maths_icm'),
    })
    .strict(),
  z
    .object({
      t: z.literal('open'),
      runId: z.string().uuid(),
      i: z.number().int().min(0).max(19),
      key: z.string().uuid(),
    })
    .strict(),
  z
    .object({
      t: z.literal('answer'),
      runId: z.string().uuid(),
      i: z.number().int().min(0).max(19),
      action: z.string().min(1).max(64),
      clientMs: z.number().finite().min(0).max(120000),
      key: z.string().uuid(),
    })
    .strict(),
  z.object({ t: z.literal('forfeit'), runId: z.string().uuid(), key: z.string().uuid() }).strict(),
  z.object({ t: z.literal('ping'), at: z.number().finite().min(0) }).strict(),
]);

export const ReviewDecisionSchema = z
  .object({
    decision: z.enum(['dismiss', 'warn_player', 'annul_match_recalc_mmr']),
    actor: z.string().trim().min(2).max(64),
    reason: z.string().trim().min(5).max(500),
  })
  .strict();

export const ReviewAppealSchema = z
  .object({
    appealNote: z.string().trim().min(5).max(500),
  })
  .strict();

/** Contrats Zod M3 Social : Écuries, Défis d'historiques >= 24h & Raid Boss (MP-23..MP-25). */
export const CreateStableSchema = z
  .object({
    name: z.string().trim().min(3).max(48),
  })
  .strict();

export const TransferOwnerSchema = z
  .object({
    newOwnerId: z.string().uuid(),
  })
  .strict();

export const PrivateTournamentSchema = z
  .object({
    name: z.string().trim().min(3).max(64),
  })
  .strict();

export const SharedHandActionSchema = z
  .object({
    street: z.enum(['preflop', 'flop', 'turn', 'river']),
    actor: z.string().min(1).max(16),
    type: z.enum(['fold', 'check', 'call', 'bet', 'raise']),
    amountBb: z.number().min(0).max(10000),
    toBb: z.number().min(0).max(10000).optional(),
    allIn: z.boolean(),
  })
  .strict();

export const SharedHandPayloadSchema = z
  .object({
    tableSize: z.number().int().min(2).max(9),
    heroLabel: z.string().min(1).max(16),
    heroCards: z.array(z.string().regex(/^[2-9TJQKA][shdc]$/)).length(2),
    board: z.array(z.string().regex(/^[2-9TJQKA][shdc]$/)).max(5),
    stacksBb: z.record(z.string(), z.number().min(0).max(10000)),
    actions: z.array(SharedHandActionSchema).max(60),
  })
  .strict();

export const PublishSharedHandSchema = z
  .object({
    stableId: z.string().uuid(),
    playedAtMs: z.number().finite().positive(),
    question: z.string().trim().min(3).max(240),
    tags: z.array(z.string().trim().min(1).max(24)).max(3),
    hand: SharedHandPayloadSchema,
  })
  .strict();

export const VoteSharedHandSchema = z
  .object({
    vote: z.enum(['fold', 'check', 'call', 'bet', 'raise']),
  })
  .strict();

export const CreateRaidSchema = z
  .object({
    stableId: z.string().uuid(),
    bossId: z.enum(['nit', 'calling_station', 'reg_aggro', 'chip_leader_icm']),
    rosterPlayerIds: z.array(z.string().uuid()).min(4).max(20),
  })
  .strict();

export const RaidDecisionSchema = z
  .object({
    handIndex: z.number().int().min(0).max(9),
    decisionIndex: z.number().int().min(0).max(5),
    action: z.string().min(1).max(64),
    clientMs: z.number().finite().min(0).max(120000),
    key: z.string().uuid(),
  })
  .strict();

export const RaidHighlightSchema = z
  .object({
    handIndex: z.number().int().min(0).max(9),
    decisionIndex: z.number().int().min(0).max(5),
    label: z.string().trim().min(2).max(120),
  })
  .strict();

export function parseGhostChallengeV2(raw: unknown) {
  return GhostChallengeV2Schema.parse(raw);
}
