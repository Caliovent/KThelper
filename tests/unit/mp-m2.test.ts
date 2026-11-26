import crypto from 'node:crypto';
import http from 'node:http';
import { describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import {
  FUNNEL_CASES,
  TEXTURE_TWIN_BOARDS,
  evaluateIntegritySignals,
  funnelRankedEligible,
  scoreFunnelWithCounterInquiry,
  scoreTextureSpot,
  textureRankedEligible,
} from '../../src/engines/mp';
import { MpService } from '../../src/server/mp/service';
import { attachMpWsServer } from '../../src/server/mp/wsServer';

async function registerPlayer(svc: MpService, email: string, pseudo: string) {
  const l = svc.requestAuthLink({ email, pseudo, adultAttested: true });
  return svc.exchangeAuthLink(l.devLinkToken!);
}

function connectWs(url: string): Promise<{
  ws: WebSocket;
  messages: Record<string, unknown>[];
  nextMsg: (predicate?: (m: Record<string, unknown>) => boolean, timeoutMs?: number) => Promise<Record<string, unknown>>;
}> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const messages: Record<string, unknown>[] = [];
    const waiters: { pred: (m: Record<string, unknown>) => boolean; res: (m: Record<string, unknown>) => void }[] = [];

    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString()) as Record<string, unknown>;
      messages.push(msg);
      for (let i = waiters.length - 1; i >= 0; i--) {
        if (waiters[i].pred(msg)) {
          const w = waiters.splice(i, 1)[0];
          w.res(msg);
        }
      }
    });

    const nextMsg = (pred: (m: Record<string, unknown>) => boolean = () => true, timeoutMs = 4000) => {
      const existing = messages.find(pred);
      if (existing) {
        messages.splice(messages.indexOf(existing), 1);
        return Promise.resolve(existing);
      }
      return new Promise<Record<string, unknown>>((res, rej) => {
        const t = setTimeout(() => rej(new Error('WS timeout waiting for message')), timeoutMs);
        waiters.push({
          pred,
          res: (m) => {
            clearTimeout(t);
            const idx = messages.indexOf(m);
            if (idx >= 0) messages.splice(idx, 1);
            res(m);
          },
        });
      });
    };

    ws.once('open', () => resolve({ ws, messages, nextMsg }));
    ws.once('error', reject);
  });
}

describe('Jalon M2 Direct — Critères MP-20 à MP-22', () => {
  it('MP-20 : WebSocket Live Arena, reprise sur coupure, refus double connexion et zéro fuite score avant settled', async () => {
    const svc = new MpService({ exposeDevAuthToken: true });
    const server = http.createServer();
    const wsCtrl = attachMpWsServer(server, svc, { graceTotalMs: 5000 });
    await new Promise<void>((res) => server.listen(0, '127.0.0.1', () => res()));
    const addr = server.address() as { port: number };
    const wsUrl = `ws://127.0.0.1:${addr.port}/v1/ws`;

    const allPreSettledFrames: Record<string, unknown>[] = [];
    const checkNoScoreInProgress = (m: Record<string, unknown>) => {
      if (m.t === 'locked' || m.t === 'opponent_progress') {
        expect('pd' in m).toBe(false);
        expect('loss' in m).toBe(false);
        expect('score' in m).toBe(false);
        expect('solution' in m).toBe(false);
      }
      if (m.t !== 'settled') allPreSettledFrames.push(m);
    };

    try {
      const pA = await registerPlayer(svc, 'wsA@test.fr', 'LiveA');
      const pB = await registerPlayer(svc, 'wsB@test.fr', 'LiveB');

      const cA = await connectWs(wsUrl);
      const cB = await connectWs(wsUrl);
      cA.ws.on('message', (d) => checkNoScoreInProgress(JSON.parse(d.toString())));
      cB.ws.on('message', (d) => checkNoScoreInProgress(JSON.parse(d.toString())));

      cA.ws.send(JSON.stringify({ t: 'hello', protocol: 1, token: pA.sessionToken }));
      cB.ws.send(JSON.stringify({ t: 'hello', protocol: 1, token: pB.sessionToken }));
      await cA.nextMsg((m) => m.t === 'pong');
      await cB.nextMsg((m) => m.t === 'pong');

      cA.ws.send(JSON.stringify({ t: 'queue_live', league: 'maths_icm' }));
      cB.ws.send(JSON.stringify({ t: 'queue_live', league: 'maths_icm' }));

      const matchA = await cA.nextMsg((m) => m.t === 'matched');
      const matchB = await cB.nextMsg((m) => m.t === 'matched');
      const runAId = String(matchA.runId);
      const runBId = String(matchB.runId);

      // Refus de double connexion sur le même run
      const dup = await connectWs(wsUrl);
      dup.ws.send(JSON.stringify({ t: 'hello', protocol: 1, token: pA.sessionToken, resumeRunId: runAId }));
      const errDup = await dup.nextMsg((m) => m.t === 'error');
      expect(errDup.code).toBe('duplicate_connection');
      dup.ws.close();

      // Jouer spot 0 pour A puis couper sa WS brutalement et reprendre via resumeRunId
      cA.ws.send(JSON.stringify({ t: 'open', runId: runAId, i: 0, key: crypto.randomUUID() }));
      await cA.nextMsg((m) => m.t === 'spot');
      cA.ws.send(JSON.stringify({ t: 'answer', runId: runAId, i: 0, action: '50', clientMs: 800, key: crypto.randomUUID() }));
      await cA.nextMsg((m) => m.t === 'locked');
      const oppProg = await cB.nextMsg((m) => m.t === 'opponent_progress');
      expect(oppProg.done).toBe(1);
      expect(Object.keys(oppProg).sort()).toEqual(['done', 't']);

      // Coupure brutale de A
      cA.ws.close();
      await new Promise((r) => setTimeout(r, 80));

      // Reconnexion et reprise de A à spot 1..14
      const cA2 = await connectWs(wsUrl);
      cA2.ws.on('message', (d) => checkNoScoreInProgress(JSON.parse(d.toString())));
      cA2.ws.send(JSON.stringify({ t: 'hello', protocol: 1, token: pA.sessionToken, resumeRunId: runAId }));
      await cA2.nextMsg((m) => m.t === 'opponent_progress');

      for (let i = 1; i < 15; i++) {
        cA2.ws.send(JSON.stringify({ t: 'open', runId: runAId, i, key: crypto.randomUUID() }));
        await cA2.nextMsg((m) => m.t === 'spot' && m.i === i);
        cA2.ws.send(JSON.stringify({ t: 'answer', runId: runAId, i, action: '52', clientMs: 900, key: crypto.randomUUID() }));
        await cA2.nextMsg((m) => m.t === 'locked' && m.i === i);
      }

      for (let i = 0; i < 15; i++) {
        cB.ws.send(JSON.stringify({ t: 'open', runId: runBId, i, key: crypto.randomUUID() }));
        await cB.nextMsg((m) => m.t === 'spot' && m.i === i);
        cB.ws.send(JSON.stringify({ t: 'answer', runId: runBId, i, action: '45', clientMs: 950, key: crypto.randomUUID() }));
        await cB.nextMsg((m) => m.t === 'locked' && m.i === i);
      }

      const settledA = await cA2.nextMsg((m) => m.t === 'settled');
      const settledB = await cB.nextMsg((m) => m.t === 'settled');
      expect(settledA.matchId).toBe(matchA.matchId);
      expect(settledB.matchId).toBe(matchA.matchId);
      expect(allPreSettledFrames.length).toBeGreaterThan(0);

      cA2.ws.close();
      cB.ws.close();
    } finally {
      await wsCtrl.close();
      await new Promise<void>((res) => server.close(() => res()));
    }
  });

  it('MP-20 Critère de sortie Bible p.33 : 100 duels simulés avec coupures/forfaits -> 0 run bloqué ni double règlement', async () => {
    let simClock = Date.UTC(2026, 10, 1, 10, 0, 0);
    const svc = new MpService({ exposeDevAuthToken: true, now: () => simClock });
    // Pool de 40 joueurs pour respecter le plafond de 3 matchs / paire / 30 jours
    const players: { id: string; pseudo: string }[] = [];
    for (let i = 0; i < 40; i++) {
      const s = await registerPlayer(svc, `sim${i}@test.fr`, `SimPlayer${i}`);
      players.push({ id: s.player.id, pseudo: s.player.pseudo });
    }

    const matchIds: string[] = [];
    for (let d = 0; d < 100; d++) {
      simClock += 2 * 3600 * 1000;
      const idxA = d % 20;
      const idxB = 20 + ((d + Math.floor(d / 20)) % 20);
      const pA = players[idxA];
      const pB = players[idxB];

      const live = await svc.createLiveMatch(pA.id, pB.id, 'maths_icm');
      matchIds.push(live.matchId);

      const interruptMode = d % 5;
      for (let spot = 0; spot < live.spotCount; spot++) {
        // Simulation coupure/abandon à des moments variés
        if (interruptMode === 1 && spot === 4) {
          await svc.forfeitRun(pA.id, live.runAId, crypto.randomUUID());
          break;
        }
        svc.openSpot(pA.id, live.runAId, spot, crypto.randomUUID());
        await svc.answerSpot(pA.id, live.runAId, spot, {
          action: String(45 + (spot % 10)),
          clientMs: 700 + (spot * 80),
          key: crypto.randomUUID(),
        });
      }

      for (let spot = 0; spot < live.spotCount; spot++) {
        if (interruptMode === 2 && spot === 0) {
          await svc.forfeitRun(pB.id, live.runBId, crypto.randomUUID());
          break;
        }
        svc.openSpot(pB.id, live.runBId, spot, crypto.randomUUID());
        await svc.answerSpot(pB.id, live.runBId, spot, {
          action: String(50 + (spot % 8)),
          clientMs: 800 + (spot * 90),
          key: crypto.randomUUID(),
        });
      }

      // Tentatives concurrentes de double règlement -> toujours idempotent
      const m = svc.store.matches.get(live.matchId)!;
      if (m.state !== 'cancelled') {
        const [r1, r2] = await Promise.all([
          svc.settleMatchOnce(live.matchId),
          svc.settleMatchOnce(live.matchId),
        ]);
        expect(r1).toEqual(r2);
      }
    }

    expect(matchIds).toHaveLength(100);
    for (const mid of matchIds) {
      const m = svc.store.matches.get(mid)!;
      expect(['settled', 'cancelled']).toContain(m.state);
    }
    // Somme des matchs comptés sur les joueurs = exactement 2 * settledMatches (0 double règlement)
    const settledCount = matchIds.filter((id) => svc.store.matches.get(id)?.state === 'settled').length;
    const totalPlayerMatchCount = Array.from(svc.store.ratings.values()).reduce((sum, r) => sum + r.matches, 0);
    expect(totalPlayerMatchCount).toBe(settledCount * 2);
  });

  it('MP-21 : Console de revue & signaux (aucun signal ne modifie un MMR sans décision humaine journalisée)', async () => {
    const sigs = evaluateIntegritySignals(
      Array.from({ length: 6 }, (_, i) => ({
        matchId: `m-${i}`,
        opponentId: 'opp-1',
        totalPd: 0,
        forfeited: false,
        spots: Array.from({ length: 15 }, () => ({ elapsedMs: 7200, pd: 0 })),
      }))
    );
    expect(sigs.length).toBeGreaterThan(0);

    const svc = new MpService({ exposeDevAuthToken: true });
    const pA = await registerPlayer(svc, 'revA@test.fr', 'RevA');
    const pB = await registerPlayer(svc, 'revB@test.fr', 'RevB');
    const live = await svc.createLiveMatch(pA.player.id, pB.player.id, 'maths_icm');
    for (let i = 0; i < 15; i++) {
      svc.openSpot(pA.player.id, live.runAId, i, crypto.randomUUID());
      await svc.answerSpot(pA.player.id, live.runAId, i, { action: '50', clientMs: 1000, key: crypto.randomUUID() });
      svc.openSpot(pB.player.id, live.runBId, i, crypto.randomUUID());
      await svc.answerSpot(pB.player.id, live.runBId, i, { action: '10', clientMs: 1200, key: crypto.randomUUID() });
    }

    const mmrBeforeSignal = svc.getMe(pA.player.id).ratings.maths_icm.r;
    const c = svc.openReviewCase(pA.player.id, live.matchId, sigs);
    // Ouvrir un signal ne change JAMAIS le MMR
    expect(svc.getMe(pA.player.id).ratings.maths_icm.r).toBe(mmrBeforeSignal);

    svc.submitReviewAppeal(c.id, pA.player.id, 'Je calcule mentalement sans outil externe.');
    expect(svc.getMe(pA.player.id).ratings.maths_icm.r).toBe(mmrBeforeSignal);

    // Décision humaine journalisée d'annulation
    const decided = await svc.decideReviewCase(c.id, {
      decision: 'annul_match_recalc_mmr',
      actor: 'admin_pe4nuts',
      reason: 'Annulation confirmée après revue humaine complète.',
    });
    expect(decided.audit.mmrChanged).toBe(true);
    expect(svc.getMe(pA.player.id).ratings.maths_icm.r).toBe(1500);
    expect(svc.getReviewAuditLog().some((e) => e.actor === 'admin_pe4nuts' && e.action === 'annul_match_recalc_mmr')).toBe(true);
  });

  it('MP-22 : Radar de Board sans EV refusé au classé & Détectives (Entonnoir + Contre-enquête)', () => {
    const tex = TEXTURE_TWIN_BOARDS[0];
    expect(textureRankedEligible(tex.template)).toBe(false);
    expect(() =>
      scoreTextureSpot(
        tex,
        { rangeAdv: 'IP', nutsAdv: 'IP' },
        { freqPct: 75, sizingPct: 33, actionId: 'cbet_small' },
        2500,
        true
      )
    ).toThrowError(/non éligible au classé/i);

    const friendlyTex = scoreTextureSpot(
      tex,
      { rangeAdv: 'IP', nutsAdv: 'IP' },
      { freqPct: 75, sizingPct: 33, actionId: 'cbet_small' },
      2500,
      false
    );
    expect(friendlyTex.gaugesCorrect).toBe(2);

    const fCase = FUNNEL_CASES[0];
    expect(
      funnelRankedEligible({
        ...tex.template,
        public: {
          ...tex.template.public,
          gameType: 'funnel',
          state: { kind: 'funnel', steps: [], blocks: ['valeur_forte'] },
        },
      })
    ).toBe(false);

    const res = scoreFunnelWithCounterInquiry(
      { valeur_forte: 50, valeur_moyenne: 10, tirages_forts: 10, tirages_faibles: 10, bluff_catchers: 10, air: 10 },
      fCase.streets[0].referenceWeights,
      fCase.streets[0].referenceWeights
    );
    expect(res.initialPd).toBeGreaterThan(0);
    expect(res.revisedPd).toBe(0);
    expect(res.improved).toBe(true);
  });
});
