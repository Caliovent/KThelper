import { z } from 'zod';
import { RULES_VERSION } from './config';

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

export function parseGhostChallengeV2(raw: unknown) {
  return GhostChallengeV2Schema.parse(raw);
}
