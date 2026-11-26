import express from 'express';
import { z } from 'zod';
import { AUTH_LIMITS, RULES_VERSION } from '../../engines/mp/config';
import {
  AnswerSpotRequestSchema,
  AuthLinkRequestSchema,
  AuthSessionRequestSchema,
  CreateRaidSchema,
  CreateStableSchema,
  DailyStartRequestSchema,
  ForfeitRequestSchema,
  LeaderboardQuerySchema,
  LeagueSchema,
  OpenSpotRequestSchema,
  PrivateTournamentSchema,
  PublishSharedHandSchema,
  QueueJoinSchema,
  RaidDecisionSchema,
  RaidHighlightSchema,
  ReviewAppealSchema,
  ReviewDecisionSchema,
  TransferOwnerSchema,
  VoteSharedHandSchema,
} from '../../engines/mp/schemas';
import { L1_CORPUS_VERSION, L1_GENERATOR_VERSION } from './corpusL1';
import { MpHttpError, MpService } from './service';

function parseBody<T>(schema: z.ZodType<T>, raw: unknown): T {
  const res = schema.safeParse(raw);
  if (!res.success) {
    throw new MpHttpError(400, 'validation_error', res.error.issues.map((i) => i.message).join(' ; '));
  }
  return res.data;
}

function handleError(res: express.Response, err: unknown) {
  if (err instanceof MpHttpError) {
    return res.status(err.status).json({ error: err.code, message: err.message });
  }
  console.error('[/v1/*] unexpected error:', err);
  return res.status(500).json({ error: 'internal_error', message: 'Erreur interne serveur L1.' });
}

export function createMpRouter(service: MpService): express.Router {
  const router = express.Router();
  router.use(express.json({ limit: `${AUTH_LIMITS.maxBodyBytes}b` }));

  router.get('/meta', (_req, res) => {
    return res.json({
      protocol: 1,
      rulesVersion: RULES_VERSION,
      corpusVersion: L1_CORPUS_VERSION,
      generatorVersion: L1_GENERATOR_VERSION,
      season: service.store.currentSeason,
      seasonTheme: service.store.seasonTheme,
      publicKeyPem: service.signer.publicKeyPem,
      serverNow: new Date().toISOString(),
    });
  });

  // Auth / Comptes (MP-12)
  router.post('/auth/link', (req, res) => {
    try {
      const body = parseBody(AuthLinkRequestSchema, req.body);
      return res.json(service.requestAuthLink(body));
    } catch (err) {
      return handleError(res, err);
    }
  });

  router.post('/auth/session', (req, res) => {
    try {
      const body = parseBody(AuthSessionRequestSchema, req.body);
      return res.json(service.exchangeAuthLink(body.linkToken));
    } catch (err) {
      return handleError(res, err);
    }
  });

  router.get('/me', (req, res) => {
    try {
      const player = service.authenticateBearer(req.headers.authorization);
      const mastery = req.query.mastery !== undefined ? Number(req.query.mastery) : undefined;
      const bossValidated = req.query.bossValidated === 'true';
      const retention7dVerified = req.query.retention7dVerified === 'true';
      return res.json(service.getMe(player.id, { mastery, bossValidated, retention7dVerified }));
    } catch (err) {
      return handleError(res, err);
    }
  });

  router.delete('/me', (req, res) => {
    try {
      const player = service.authenticateBearer(req.headers.authorization);
      return res.json(service.deleteMe(player.id));
    } catch (err) {
      return handleError(res, err);
    }
  });

  // Queue & Matches Ghost Classé (MP-16)
  router.post('/queue', async (req, res) => {
    try {
      const player = service.authenticateBearer(req.headers.authorization);
      const body = parseBody(QueueJoinSchema, req.body);
      const result = await service.enqueueGhostRanked(player.id, body.league, {
        targetMatchId: body.targetMatchId,
      });
      return res.json(result);
    } catch (err) {
      return handleError(res, err);
    }
  });

  router.delete('/queue/:id', (req, res) => {
    try {
      service.authenticateBearer(req.headers.authorization);
      return res.json({ cancelled: true, queueId: req.params.id });
    } catch (err) {
      return handleError(res, err);
    }
  });

  router.get('/matches/open', (req, res) => {
    try {
      const player = service.authenticateBearer(req.headers.authorization);
      const league = parseBody(LeagueSchema, req.query.league ?? 'maths_icm');
      return res.json({ matches: service.listAvailableGhosts(player.id, league) });
    } catch (err) {
      return handleError(res, err);
    }
  });

  router.post('/matches/:id/join', (req, res) => {
    try {
      const player = service.authenticateBearer(req.headers.authorization);
      return res.json(service.joinGhostMatch(player.id, req.params.id));
    } catch (err) {
      return handleError(res, err);
    }
  });

  router.get('/matches/:id/result', (req, res) => {
    try {
      const player = service.authenticateBearer(req.headers.authorization);
      return res.json(service.getMatchResult(player.id, req.params.id));
    } catch (err) {
      return handleError(res, err);
    }
  });

  // Runs autoritaires (MP-13)
  router.post('/runs/:id/spots/:i/open', (req, res) => {
    try {
      const player = service.authenticateBearer(req.headers.authorization);
      const spotIndex = Number(req.params.i);
      if (!Number.isInteger(spotIndex) || spotIndex < 0 || spotIndex >= 20) {
        throw new MpHttpError(400, 'invalid_spot_index', 'Index de spot invalide.');
      }
      const body = parseBody(OpenSpotRequestSchema, req.body);
      return res.json(service.openSpot(player.id, req.params.id, spotIndex, body.key));
    } catch (err) {
      return handleError(res, err);
    }
  });

  router.post('/runs/:id/spots/:i/answer', async (req, res) => {
    try {
      const player = service.authenticateBearer(req.headers.authorization);
      const spotIndex = Number(req.params.i);
      if (!Number.isInteger(spotIndex) || spotIndex < 0 || spotIndex >= 20) {
        throw new MpHttpError(400, 'invalid_spot_index', 'Index de spot invalide.');
      }
      const body = parseBody(AnswerSpotRequestSchema, req.body);
      const out = await service.answerSpot(player.id, req.params.id, spotIndex, body);
      return res.json(out);
    } catch (err) {
      return handleError(res, err);
    }
  });

  router.post('/runs/:id/forfeit', async (req, res) => {
    try {
      const player = service.authenticateBearer(req.headers.authorization);
      const body = parseBody(ForfeitRequestSchema, req.body);
      const out = await service.forfeitRun(player.id, req.params.id, body.key);
      return res.json(out);
    } catch (err) {
      return handleError(res, err);
    }
  });

  // Leaderboards & Saisons (MP-18)
  router.get('/leaderboards/:league', (req, res) => {
    try {
      const league = parseBody(LeagueSchema, req.params.league);
      const q = parseBody(LeaderboardQuerySchema, req.query);
      return res.json(service.getLeaderboard(league, q.page, q.limit, q.season));
    } catch (err) {
      return handleError(res, err);
    }
  });

  // Daily Top officiel (MP-17)
  router.get('/daily/current', async (req, res) => {
    try {
      let playerId: string | undefined;
      if (req.headers.authorization) {
        playerId = service.authenticateBearer(req.headers.authorization).id;
      }
      return res.json(await service.getDailyCurrent(playerId));
    } catch (err) {
      return handleError(res, err);
    }
  });

  router.post('/daily/current/start', async (req, res) => {
    try {
      const player = service.authenticateBearer(req.headers.authorization);
      const body = parseBody(DailyStartRequestSchema, req.body);
      return res.json(await service.startDailyRun(player.id, body.key));
    } catch (err) {
      return handleError(res, err);
    }
  });

  router.get('/daily/:key/review', (req, res) => {
    try {
      return res.json(service.getDailyReview(req.params.key));
    } catch (err) {
      return handleError(res, err);
    }
  });

  // Console de revue humaine & signaux d'intégrité (MP-21)
  router.get('/review/cases', (req, res) => {
    try {
      const reviewToken = req.header('X-Review-Token');
      const expectedAdmin = process.env.MP_REVIEW_TOKEN || 'dev-review-token';
      if (reviewToken === expectedAdmin) {
        return res.json({ cases: service.listReviewCases() });
      }
      const player = service.authenticateBearer(req.headers.authorization);
      return res.json({ cases: service.listReviewCases(player.id) });
    } catch (err) {
      return handleError(res, err);
    }
  });

  router.post('/review/cases/:id/appeal', (req, res) => {
    try {
      const player = service.authenticateBearer(req.headers.authorization);
      const body = parseBody(ReviewAppealSchema, req.body);
      return res.json({ reviewCase: service.submitReviewAppeal(req.params.id, player.id, body.appealNote) });
    } catch (err) {
      return handleError(res, err);
    }
  });

  router.post('/review/cases/:id/decide', async (req, res) => {
    try {
      const reviewToken = req.header('X-Review-Token');
      const expectedAdmin = process.env.MP_REVIEW_TOKEN || 'dev-review-token';
      if (reviewToken !== expectedAdmin) {
        throw new MpHttpError(403, 'forbidden', 'Jeton de modération X-Review-Token requis.');
      }
      const body = parseBody(ReviewDecisionSchema, req.body);
      return res.json(await service.decideReviewCase(req.params.id, body));
    } catch (err) {
      return handleError(res, err);
    }
  });

  router.get('/review/audit-log', (req, res) => {
    try {
      const reviewToken = req.header('X-Review-Token');
      const expectedAdmin = process.env.MP_REVIEW_TOKEN || 'dev-review-token';
      if (reviewToken !== expectedAdmin) {
        const player = service.authenticateBearer(req.headers.authorization);
        const myCaseIds = new Set(service.listReviewCases(player.id).map((c) => c.id));
        return res.json({ entries: service.getReviewAuditLog().filter((e) => myCaseIds.has(e.caseId)) });
      }
      return res.json({ entries: service.getReviewAuditLog() });
    } catch (err) {
      return handleError(res, err);
    }
  });

  // ===========================================================================
  // M3 Social : Écuries, Partages d'historiques >=24h & Raid Boss 72h (MP-23..25)
  // ===========================================================================
  router.get('/stables', (req, res) => {
    try {
      const player = service.authenticateBearer(req.headers.authorization);
      return res.json({
        stables: service.listAllStables(),
        myStable: service.getMyStable(player.id),
      });
    } catch (err) {
      return handleError(res, err);
    }
  });

  router.post('/stables', (req, res) => {
    try {
      const player = service.authenticateBearer(req.headers.authorization);
      const body = parseBody(CreateStableSchema, req.body);
      return res.json(service.createStable(player.id, body.name));
    } catch (err) {
      return handleError(res, err);
    }
  });

  router.post('/stables/:id/join', (req, res) => {
    try {
      const player = service.authenticateBearer(req.headers.authorization);
      return res.json({ member: service.joinStable(player.id, req.params.id) });
    } catch (err) {
      return handleError(res, err);
    }
  });

  router.post('/stables/:id/leave', (req, res) => {
    try {
      const player = service.authenticateBearer(req.headers.authorization);
      return res.json(service.leaveStable(player.id, req.params.id));
    } catch (err) {
      return handleError(res, err);
    }
  });

  router.post('/stables/:id/transfer', (req, res) => {
    try {
      const player = service.authenticateBearer(req.headers.authorization);
      const body = parseBody(TransferOwnerSchema, req.body);
      return res.json(service.transferStableOwnership(player.id, req.params.id, body.newOwnerId));
    } catch (err) {
      return handleError(res, err);
    }
  });

  router.post('/stables/:id/tournaments', async (req, res) => {
    try {
      const player = service.authenticateBearer(req.headers.authorization);
      const body = parseBody(PrivateTournamentSchema, req.body);
      return res.json({ tournament: await service.createPrivateTournament(player.id, req.params.id, body.name) });
    } catch (err) {
      return handleError(res, err);
    }
  });

  router.get('/shared-hands', (req, res) => {
    try {
      const player = service.authenticateBearer(req.headers.authorization);
      const stableId = String(req.query.stableId ?? '');
      if (!stableId) throw new MpHttpError(400, 'missing_stable', 'Paramètre stableId requis.');
      return res.json({ hands: service.listSharedHands(player.id, stableId) });
    } catch (err) {
      return handleError(res, err);
    }
  });

  router.post('/shared-hands', (req, res) => {
    try {
      const player = service.authenticateBearer(req.headers.authorization);
      const body = parseBody(PublishSharedHandSchema, req.body);
      return res.json({ sharedHand: service.publishSharedHand(player.id, body) });
    } catch (err) {
      return handleError(res, err);
    }
  });

  router.post('/shared-hands/:id/vote', (req, res) => {
    try {
      const player = service.authenticateBearer(req.headers.authorization);
      const body = parseBody(VoteSharedHandSchema, req.body);
      return res.json({ sharedHand: service.voteSharedHand(player.id, req.params.id, body.vote) });
    } catch (err) {
      return handleError(res, err);
    }
  });

  router.post('/raids', async (req, res) => {
    try {
      const player = service.authenticateBearer(req.headers.authorization);
      const body = parseBody(CreateRaidSchema, req.body);
      return res.json({ raid: await service.createRaid(player.id, body) });
    } catch (err) {
      return handleError(res, err);
    }
  });

  router.get('/raids/:id', (req, res) => {
    try {
      const player = service.authenticateBearer(req.headers.authorization);
      return res.json(service.getRaidStatus(player.id, req.params.id));
    } catch (err) {
      return handleError(res, err);
    }
  });

  router.post('/raids/:id/decision', (req, res) => {
    try {
      const player = service.authenticateBearer(req.headers.authorization);
      const body = parseBody(RaidDecisionSchema, req.body);
      return res.json(service.submitRaidDecision(player.id, req.params.id, body));
    } catch (err) {
      return handleError(res, err);
    }
  });

  router.post('/raids/:id/forfeit', (req, res) => {
    try {
      const player = service.authenticateBearer(req.headers.authorization);
      return res.json(service.forfeitRaidRun(player.id, req.params.id));
    } catch (err) {
      return handleError(res, err);
    }
  });

  router.post('/raids/:id/close', (req, res) => {
    try {
      const player = service.authenticateBearer(req.headers.authorization);
      return res.json(service.closeRaid(player.id, req.params.id));
    } catch (err) {
      return handleError(res, err);
    }
  });

  router.post('/raids/:id/highlight', (req, res) => {
    try {
      const player = service.authenticateBearer(req.headers.authorization);
      const body = parseBody(RaidHighlightSchema, req.body);
      return res.json({ highlights: service.tagRaidHighlight(player.id, req.params.id, body) });
    } catch (err) {
      return handleError(res, err);
    }
  });

  return router;
}
