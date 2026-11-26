import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  FRESQUE_DRILL_SETS,
  GLICKO,
  SALVE_SPOTS,
  computeAllRounderRating,
  computeSalveSpotEv,
  displayDivision,
  expected,
  fresqueRankedEligible,
  hasRegularityMedal,
  inflateRdForInactivity,
  rolloverSeasonRating,
  salveRankedEligible,
  scoreFresqueDuel,
  scoreFresqueLine,
  scoreSolution,
  update,
} from '../../src/engines/mp';
import {
  FORBIDDEN_PRE_REVEAL_KEYS,
  FORBIDDEN_PRE_SETTLEMENT_RUN_KEYS,
  L1_MATHS_ICM_CORPUS,
  assertNoSolutionLeak,
  verifyL1CorpusTruth,
} from '../../src/server/mp/corpusL1';
import { MpHttpError, MpService } from '../../src/server/mp/service';

async function registerPlayer(service: MpService, email: string, pseudo: string) {
  const link = service.requestAuthLink({ email, pseudo, adultAttested: true });
  const tok = link.devLinkToken!;
  const session = service.exchangeAuthLink(tok);
  return session;
}

describe('Jalon M1 Asynchrone — Critères MP-12 à MP-19', () => {
  it('MP-14 : corpus L1 Maths & ICM >= 150 gabarits relus et chaque vérité recalculée exactement', () => {
    const res = verifyL1CorpusTruth(L1_MATHS_ICM_CORPUS);
    expect(res.total).toBeGreaterThanOrEqual(150);
    expect(res.families).toBeGreaterThanOrEqual(5);
    expect(L1_MATHS_ICM_CORPUS.every((t) => t.id.startsWith('l1_math_') && t.reviewSigned)).toBe(true);
  });

  it('MP-12 : accès au run d’autrui refusé (403) et suppression RGPD conforme à la table des données', async () => {
    const svc = new MpService({ exposeDevAuthToken: true });
    const pA = await registerPlayer(svc, 'alice@test.fr', 'AliceKT');
    const pB = await registerPlayer(svc, 'bob@test.fr', 'BobKT');

    const qA = await svc.enqueueGhostRanked(pA.player.id, 'maths_icm');
    // Bob tente d'ouvrir ou d'abandonner le run d'Alice -> 403
    expect(() => svc.openSpot(pB.player.id, qA.runId, 0, crypto.randomUUID())).toThrowError(MpHttpError);
    try {
      svc.openSpot(pB.player.id, qA.runId, 0, crypto.randomUUID());
    } catch (e) {
      expect((e as MpHttpError).status).toBe(403);
    }

    // Alice joue ses 15 spots et Bob la rejoint et joue aussi
    for (let i = 0; i < 15; i++) {
      svc.openSpot(pA.player.id, qA.runId, i, crypto.randomUUID());
      await svc.answerSpot(pA.player.id, qA.runId, i, { action: '50', clientMs: 1200, key: crypto.randomUUID() });
    }
    const qB = await svc.enqueueGhostRanked(pB.player.id, 'maths_icm');
    for (let i = 0; i < 15; i++) {
      svc.openSpot(pB.player.id, qB.runId, i, crypto.randomUUID());
      await svc.answerSpot(pB.player.id, qB.runId, i, { action: '45', clientMs: 1200, key: crypto.randomUUID() });
    }

    // Alice supprime son compte (MP-12 RGPD)
    const del = svc.deleteMe(pA.player.id);
    expect(del.deleted).toBe(true);
    expect(() => svc.authenticateBearer(`Bearer ${pA.sessionToken}`)).toThrowError(MpHttpError);

    // Le match reste consultable et anonymisé pour Bob (aucun email ni pseudo d'origine)
    const bobView = svc.getMatchResult(pB.player.id, qA.matchId);
    expect(bobView.opponentPseudo).toBe(del.anonymizedPseudo);
    expect(bobView.opponentPseudo).not.toContain('AliceKT');
  });

  it('MP-13 : rejeu idempotent des requêtes et aucune fuite de solution avant révélation', async () => {
    const svc = new MpService({ exposeDevAuthToken: true });
    const pA = await registerPlayer(svc, 'a13@test.fr', 'PlayerA13');
    const q = await svc.enqueueGhostRanked(pA.player.id, 'maths_icm');

    const openKey = crypto.randomUUID();
    const opened1 = svc.openSpot(pA.player.id, q.runId, 0, openKey);
    const opened2 = svc.openSpot(pA.player.id, q.runId, 0, openKey);
    expect(opened2).toEqual(opened1);
    assertNoSolutionLeak(opened1, FORBIDDEN_PRE_SETTLEMENT_RUN_KEYS);

    const ansKey = crypto.randomUUID();
    const ans1 = await svc.answerSpot(pA.player.id, q.runId, 0, { action: '55', clientMs: 1500, key: ansKey });
    const ans2 = await svc.answerSpot(pA.player.id, q.runId, 0, { action: '55', clientMs: 1500, key: ansKey });
    expect(ans2).toEqual(ans1);
    assertNoSolutionLeak(ans1, FORBIDDEN_PRE_SETTLEMENT_RUN_KEYS);

    // Une clé différente sur un spot déjà verrouillé doit échouer (409)
    await expect(
      svc.answerSpot(pA.player.id, q.runId, 0, { action: '55', clientMs: 1500, key: crypto.randomUUID() })
    ).rejects.toMatchObject({ status: 409, code: 'not_open' });

    // /v1/me ne doit pas fuiter de solution ni totalPd tant que le match n'est pas réglé
    const meBefore = svc.getMe(pA.player.id);
    assertNoSolutionLeak(meBefore, FORBIDDEN_PRE_SETTLEMENT_RUN_KEYS);
  });

  it('MP-15 : exemple Glickman exact à 0.02 près et deux règlements concurrents appliqués une seule fois', async () => {
    const glickman = update(
      { r: 1500, rd: 200, sigma: 0.06 },
      [
        { opp: { r: 1400, rd: 30, sigma: 0.06 }, score: 1 },
        { opp: { r: 1550, rd: 100, sigma: 0.06 }, score: 0 },
        { opp: { r: 1700, rd: 300, sigma: 0.06 }, score: 0 },
      ]
    );
    expect(Math.abs(glickman.r - 1464.05)).toBeLessThan(0.02);
    expect(Math.abs(glickman.rd - 151.52)).toBeLessThan(0.02);
    expect(expected({ r: 1500, rd: 200, sigma: 0.06 }, { r: 1400, rd: 30, sigma: 0.06 })).toBeGreaterThan(0.5);

    const svc = new MpService({ exposeDevAuthToken: true });
    const pA = await registerPlayer(svc, 'a15@test.fr', 'PlayerA15');
    const pB = await registerPlayer(svc, 'b15@test.fr', 'PlayerB15');
    const qA = await svc.enqueueGhostRanked(pA.player.id, 'maths_icm');
    for (let i = 0; i < 15; i++) {
      svc.openSpot(pA.player.id, qA.runId, i, crypto.randomUUID());
      await svc.answerSpot(pA.player.id, qA.runId, i, { action: '50', clientMs: 1000, key: crypto.randomUUID() });
    }
    const qB = await svc.enqueueGhostRanked(pB.player.id, 'maths_icm');
    for (let i = 0; i < 14; i++) {
      svc.openSpot(pB.player.id, qB.runId, i, crypto.randomUUID());
      await svc.answerSpot(pB.player.id, qB.runId, i, { action: '50', clientMs: 1000, key: crypto.randomUUID() });
    }
    svc.openSpot(pB.player.id, qB.runId, 14, crypto.randomUUID());
    await svc.answerSpot(pB.player.id, qB.runId, 14, { action: '50', clientMs: 1000, key: crypto.randomUUID() });

    // Deux appels concurrents à settleMatchOnce -> un seul règlement MMR
    const [r1, r2] = await Promise.all([svc.settleMatchOnce(qA.matchId), svc.settleMatchOnce(qA.matchId)]);
    expect(r1).toEqual(r2);
    expect(svc.signer.verifyReceipt(r1)).toBe(true);
    const meA = svc.getMe(pA.player.id);
    expect(meA.ratings.maths_icm.matches).toBe(1);
  });

  it('MP-16 : 4e match Ghost classé d’une paire en 30 jours refusé et expiration 48h sans effet MMR', async () => {
    let clock = Date.UTC(2026, 10, 1, 10, 0, 0);
    const svc = new MpService({ exposeDevAuthToken: true, now: () => clock });
    const pA = await registerPlayer(svc, 'a16@test.fr', 'PairA16');
    const pB = await registerPlayer(svc, 'b16@test.fr', 'PairB16');

    for (let m = 0; m < 3; m++) {
      const qA = await svc.enqueueGhostRanked(pA.player.id, 'maths_icm');
      for (let i = 0; i < 15; i++) {
        svc.openSpot(pA.player.id, qA.runId, i, crypto.randomUUID());
        await svc.answerSpot(pA.player.id, qA.runId, i, { action: '50', clientMs: 1000, key: crypto.randomUUID() });
      }
      const qB = await svc.enqueueGhostRanked(pB.player.id, 'maths_icm', { targetMatchId: qA.matchId });
      for (let i = 0; i < 15; i++) {
        svc.openSpot(pB.player.id, qB.runId, i, crypto.randomUUID());
        await svc.answerSpot(pB.player.id, qB.runId, i, { action: '50', clientMs: 1000, key: crypto.randomUUID() });
      }
      clock += 60 * 60 * 1000;
    }

    // 4e match entre la même paire ciblé -> refusé (409 pair_limit_reached)
    const qA4 = await svc.enqueueGhostRanked(pA.player.id, 'maths_icm');
    for (let i = 0; i < 15; i++) {
      svc.openSpot(pA.player.id, qA4.runId, i, crypto.randomUUID());
      await svc.answerSpot(pA.player.id, qA4.runId, i, { action: '50', clientMs: 1000, key: crypto.randomUUID() });
    }
    await expect(
      svc.enqueueGhostRanked(pB.player.id, 'maths_icm', { targetMatchId: qA4.matchId })
    ).rejects.toMatchObject({ status: 409, code: 'pair_limit_reached' });

    // Et qA4 expire à +48h sans modifier le MMR d'Alice
    const mmrBeforeExpiry = svc.getMe(pA.player.id).ratings.maths_icm.r;
    clock += 49 * 3600 * 1000;
    const expired = svc.expireStaleMatches();
    expect(expired).toBeGreaterThanOrEqual(1);
    expect(svc.getMe(pA.player.id).ratings.maths_icm.r).toBe(mmrBeforeExpiry);
  });

  it('MP-17 : Daily Top (2e essai refusé, empreinte vérifiable après révélation, Spot Piège masqué sous 30 réponses)', async () => {
    const dayUtc = Date.UTC(2026, 10, 26, 12, 0, 0);
    // Création de 29 joueurs qui jouent le Daily (< 30 => Spot Piège doit être null)
    let clock1 = dayUtc;
    const svc = new MpService({ exposeDevAuthToken: true, now: () => clock1 });
    const curBefore = await svc.getDailyCurrent();
    assertNoSolutionLeak(curBefore, FORBIDDEN_PRE_REVEAL_KEYS);

    let firstPlayerSession = '';
    for (let pIdx = 0; pIdx < 29; pIdx++) {
      const p = await registerPlayer(svc, `d${pIdx}@test.fr`, `DailyUser${pIdx}`);
      if (pIdx === 0) firstPlayerSession = p.player.id;
      const st = await svc.startDailyRun(p.player.id, crypto.randomUUID());
      for (let i = 0; i < 15; i++) {
        svc.openSpot(p.player.id, st.runId, i, crypto.randomUUID());
        clock1 += 800 + ((i % 4) * 250);
        await svc.answerSpot(p.player.id, st.runId, i, { action: '50', clientMs: 900, key: crypto.randomUUID() });
      }
    }

    // 2e essai du joueur 0 -> refusé (409 already_played)
    await expect(svc.startDailyRun(firstPlayerSession, crypto.randomUUID())).rejects.toMatchObject({
      status: 409,
      code: 'already_played',
    });

    // Review refusée avant clôture UTC (409 not_closed)
    expect(() => svc.getDailyReview(curBefore.dailyKey)).toThrowError(MpHttpError);

    // À 29 réponses -> clôture donne trapSpot === null
    const rev29 = svc.closeDaily(curBefore.dailyKey);
    expect(rev29.expectedCommitment).toBe(curBefore.seedCommitment);
    expect(rev29.trapSpot).toBeNull();

    // Un 30e joueur sur un autre jour -> trapSpot renseigné dès 30 réponses
    let clock2 = Date.UTC(2026, 10, 27, 12, 0, 0);
    const svc2 = new MpService({ exposeDevAuthToken: true, now: () => clock2 });
    const d2 = await svc2.getDailyCurrent();
    for (let pIdx = 0; pIdx < 30; pIdx++) {
      const p = await registerPlayer(svc2, `d2_${pIdx}@test.fr`, `DailyB${pIdx}`);
      const st = await svc2.startDailyRun(p.player.id, crypto.randomUUID());
      for (let i = 0; i < 15; i++) {
        svc2.openSpot(p.player.id, st.runId, i, crypto.randomUUID());
        clock2 += 800 + ((i % 4) * 250);
        await svc2.answerSpot(p.player.id, st.runId, i, { action: '10', clientMs: 900, key: crypto.randomUUID() });
      }
    }
    const rev30 = svc2.closeDaily(d2.dailyKey);
    expect(rev30.trapSpot).not.toBeNull();
    expect(rev30.trapSpot?.answers).toBe(30);

    // Médaille Régularité (5/7 jours)
    expect(
      hasRegularityMedal(
        ['daily-2026-11-26', 'daily-2026-11-25', 'daily-2026-11-23', 'daily-2026-11-21', 'daily-2026-11-20'],
        dayUtc
      )
    ).toBe(true);
  });

  it('MP-18 : Master MMR avec M=70 affiché Grinder Régulier, et MMR inchangé au changement de saison', () => {
    const div = displayDivision(1800, {
      mastery: 70,
      bossValidated: true,
      retention7dVerified: true,
    });
    expect(div.id).toBe('grinder');
    expect(div.label).toBe('Grinder Régulier');

    const svc = new MpService({ exposeDevAuthToken: true });
    const p = svc.requestAuthLink({ email: 's@test.fr', pseudo: 'SeasonPlayer', adultAttested: true });
    const sess = svc.exchangeAuthLink(p.devLinkToken!);
    const ratingRow = svc.store.ratings.get(svc.store.ratingKey(sess.player.id, 'maths_icm', 1))!;
    ratingRow.r = 1725.4;
    ratingRow.rd = 80;

    const seasonRes = svc.advanceSeason('Saison 2');
    expect(seasonRes.currentSeason).toBe(2);
    const nextRow = svc.store.ratings.get(svc.store.ratingKey(sess.player.id, 'maths_icm', 2))!;
    expect(nextRow.r).toBe(1725.4);
    expect(nextRow.rd).toBeCloseTo(Math.hypot(80, 100), 1);

    const rolled = rolloverSeasonRating({ r: 1900, rd: 340, sigma: GLICKO.sigma0 });
    expect(rolled.r).toBe(1900);
    expect(rolled.rd).toBe(350);

    expect(
      inflateRdForInactivity({ r: 1600, rd: 90, sigma: GLICKO.sigma0 }, 2 * GLICKO.periodMs).rd
    ).toBeGreaterThan(90);

    expect(
      computeAllRounderRating({
        cash: { r: 1500, rd: 90, sigma: 0.06 },
        mtt_icm: { r: 1600, rd: 100, sigma: 0.06 },
        expresso: { r: 1700, rd: 120, sigma: 0.06 }, // RD > 110
      }).eligible
    ).toBe(false);
    expect(
      computeAllRounderRating({
        cash: { r: 1500, rd: 90, sigma: 0.06 },
        mtt_icm: { r: 1600, rd: 100, sigma: 0.06 },
        expresso: { r: 1700, rd: 105, sigma: 0.06 },
      })
    ).toMatchObject({ eligible: true, r: 1600 });
  });

  it('MP-19 : barèmes Fresque Duel & Salve 3-Max (Jackpot 80/12/8 à 1,35 pt) et Fresque impossible en classé', () => {
    // Fresque Duel
    const coSet = FRESQUE_DRILL_SETS[0];
    expect(fresqueRankedEligible({
      id: 'f1',
      skillId: 's1',
      family: 'rfi',
      bucket: 'frontier',
      ranked: false,
      league: 'cash',
      public: {
        templateId: 'f1',
        skillId: 's1',
        family: 'rfi',
        gameType: 'paint',
        context: { variant: 'NLHE', format: 'cash', venue: 'online', tableSize: 6, effectiveStackBb: 100, anteTotalBb: 0 },
        limitMs: 25000,
        state: { kind: 'paint', lineIds: ['pairs'] },
      },
      solution: { kind: 'weights', reference: { pairs: 1 } },
      provenance: { origin: 'heuristic', confidence: 'medium' },
      explanationId: 'e1',
    })).toBe(false);

    const exactAnswers = coSet.lines.map((l) => ({ answer: l.reference, elapsedMs: 4000 }));
    expect(() => scoreFresqueDuel(coSet, exactAnswers, true)).toThrowError(/impossible en classé/i);
    const perfectFresque = scoreFresqueDuel(coSet, exactAnswers, false);
    expect(perfectFresque.totalPd).toBe(0);
    expect(perfectFresque.perfectLines).toBe(6);

    // Vérifier pondération frontière ×2
    const pairsLine = coSet.lines[0];
    const missFrontier = scoreFresqueLine(pairsLine.hands, { floorIndex: 11, islands: [] }, pairsLine.reference);
    expect(missFrontier.weightedErrors).toBe(12); // 22 = 6 combos × 2 (frontière) = 12

    // Salve 3-Max : 15 spots dont Jackpot 80/12/8 (tapis égaux 25/25/25) -> Risk Premium 1,35 pt
    expect(SALVE_SPOTS).toHaveLength(15);
    expect(SALVE_SPOTS.filter((s) => s.suddenDeath)).toHaveLength(3);
    expect(salveRankedEligible(SALVE_SPOTS[0].template)).toBe(true);
    const ev80128 = computeSalveSpotEv(SALVE_SPOTS[0].model);
    expect(ev80128.unit).toBe('ppm_pp');
    expect(ev80128.riskPremiumPct).toBeCloseTo(1.35, 1);

    const bestChoice = scoreSolution(
      SALVE_SPOTS[0].template.solution,
      'allin',
      1500,
      4000,
      false,
      true
    );
    expect(bestChoice.score.pd).toBe(0);
  });

  it('Sécurité build : aucune solution L1 (`l1_math_`) ni clé serveur ne fuit dans le bundle client `dist/`', () => {
    const assetsDir = path.resolve(process.cwd(), 'dist', 'assets');
    if (!fs.existsSync(assetsDir)) return;
    const files = fs.readdirSync(assetsDir).filter((f) => f.endsWith('.js'));
    for (const file of files) {
      const content = fs.readFileSync(path.join(assetsDir, file), 'utf8');
      expect(content).not.toContain('l1_math_');
      expect(content).not.toContain('mp-l1-maths-v1');
      expect(content).not.toContain('dev-local-mp-master-secret');
    }
  });
});
