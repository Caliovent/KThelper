import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  BOSS_HAND_VARIANTS,
  evaluateRaidOutcome,
  evaluateSoloBossValidation,
  parseRawToSourceHand,
  toShared,
} from '../../src/engines/mp';
import { parseHand } from '../../src/engines/parser';
import { MpHttpError, MpService } from '../../src/server/mp/service';

async function registerPlayer(svc: MpService, email: string, pseudo: string) {
  const l = svc.requestAuthLink({ email, pseudo, adultAttested: true });
  return svc.exchangeAuthLink(l.devLinkToken!);
}

const OLD_WINAMAX_RAW = `Winamax Poker - CashGame - HandId: #20261120-9911 - Holdem no limit (0.01€/0.02€) - 2026/11/20 20:14:00 UTC
Table: 'TableSecrete' 5-max Seat #2 is the button
Seat 1: VraiPseudoA (2.14€)
Seat 2: VraiPseudoB (1.95€)
Seat 3: VraiPseudoC (2.48€)
*** ANTE/BLINDS ***
VraiPseudoC posts small blind 0.01€
VraiPseudoA posts big blind 0.02€
Dealt to VraiPseudoA [As Kh]
*** PRE-FLOP ***
VraiPseudoB raises 0.03€ to 0.05€
VraiPseudoC folds
VraiPseudoA raises 0.13€ to 0.18€
VraiPseudoB calls 0.13€
*** FLOP *** [Ks 7d 2c]
VraiPseudoA bets 0.18€
VraiPseudoB folds
*** SUMMARY ***`;

describe('Jalon M3 Social — Critères MP-23 à MP-25', () => {
  it('MP-23 : Écuries (21e membre refusé, plafond 100 révisions L1/membre, cible 400 vs 500)', async () => {
    const svc = new MpService({ exposeDevAuthToken: true });
    const members: { id: string; sessionToken: string }[] = [];
    for (let i = 0; i < 21; i++) {
      const s = await registerPlayer(svc, `st${i}@test.fr`, `StableMem${i}`);
      members.push({ id: s.player.id, sessionToken: s.sessionToken });
    }

    const { stable } = svc.createStable(members[0].id, 'Ecurie Test M3');
    // Rejoindre jusqu'au 20e membre (index 1..19)
    for (let i = 1; i < 20; i++) {
      svc.joinStable(members[i].id, stable.id);
    }
    // 21e membre refusé (409 stable_full)
    expect(() => svc.joinStable(members[20].id, stable.id)).toThrowError(MpHttpError);
    try {
      svc.joinStable(members[20].id, stable.id);
    } catch (e) {
      expect((e as MpHttpError).status).toBe(409);
      expect((e as MpHttpError).code).toBe('stable_full');
    }

    // Plafond strict de 100 révisions L1 par membre : 120 envoyées -> seules 100 comptent
    for (let k = 0; k < 120; k++) {
      const r = svc.recordStableL1Revision(members[0].id, `icm.s${k}`, 3);
      if (k < 100) expect(r.counted).toBe(true);
      else expect(r.counted).toBe(false);
    }
    const info = svc.getMyStable(members[0].id)!;
    expect(info.weeklyTotal).toBe(100);
    expect(info.weeklyTarget).toBe(500);
  });

  it('MP-24 : Parseur étendu (buttonSeat + playedAtMs), main < 24h refusée, zéro fuite PII/ID/horodatage', async () => {
    const nowMs = Date.UTC(2026, 10, 26, 19, 0, 0);
    const parsed = parseHand(OLD_WINAMAX_RAW);
    expect(parsed.buttonSeat).toBe(2);
    expect(parsed.playedAtMs).toBe(Date.UTC(2026, 10, 20, 20, 14, 0));

    const svc = new MpService({ exposeDevAuthToken: true, now: () => nowMs });
    const pA = await registerPlayer(svc, 'shA@test.fr', 'ShareA');
    const pB = await registerPlayer(svc, 'shB@test.fr', 'ShareB');
    const { stable } = svc.createStable(pA.player.id, 'Ecurie Share');
    svc.joinStable(pB.player.id, stable.id);

    const srcOld = parseRawToSourceHand(OLD_WINAMAX_RAW);
    const shared = toShared(srcOld, nowMs);
    const jsonShared = JSON.stringify(shared);
    expect(jsonShared).not.toMatch(/VraiPseudoA|VraiPseudoB|VraiPseudoC|TableSecrete|20261120-9911|20:14:00/);

    // Main de moins de 24h -> refusée (400 hand_too_recent)
    expect(() =>
      svc.publishSharedHand(pA.player.id, {
        stableId: stable.id,
        playedAtMs: nowMs - 2 * 3600 * 1000,
        question: 'Main récente interdite',
        tags: ['flop'],
        hand: shared,
      })
    ).toThrowError(MpHttpError);

    // Main >= 24h -> publiée sans fuite, et vote masqué pour pB avant qu'il vote
    const published = svc.publishSharedHand(pA.player.id, {
      stableId: stable.id,
      playedAtMs: srcOld.playedAtMs,
      question: 'C-bet flop standard ?',
      tags: ['cbet', '3bet'],
      hand: shared,
    });
    expect(JSON.stringify(published)).not.toMatch(/VraiPseudo|TableSecrete|20261120-9911|ShareA/);

    svc.voteSharedHand(pA.player.id, published.id, 'bet');
    const listForB = svc.listSharedHands(pB.player.id, stable.id);
    expect(listForB[0].myVote).toBeNull();
    expect(listForB[0].voteCounts).toBeNull();

    const votedB = svc.voteSharedHand(pB.player.id, published.id, 'bet');
    expect(votedB.voteCounts).toEqual({ bet: 2 });
  });

  it('MP-25 : Boss sur rails solo & Raid Boss 72h complet simulé (roster figé 4/4, abandon compté, confidentialité)', async () => {
    expect(BOSS_HAND_VARIANTS.length).toBeGreaterThanOrEqual(8);

    // Validation solo Boss
    const soloOk = evaluateSoloBossValidation([
      { handId: 'h1', decisionPds: [0, 0, 50], meanPd: 17 },
      { handId: 'h2', decisionPds: [0, 120, 0], meanPd: 40 },
      { handId: 'h3', decisionPds: [0, 0, 0], meanPd: 0 },
    ]);
    expect(soloOk.passed).toBe(true);

    const svc = new MpService({ exposeDevAuthToken: true });
    const users: { id: string }[] = [];
    for (let i = 0; i < 5; i++) {
      const s = await registerPlayer(svc, `raid${i}@test.fr`, `RaidP${i}`);
      users.push({ id: s.player.id });
    }
    const { stable } = svc.createStable(users[0].id, 'Ecurie Raid');
    for (let i = 1; i < 4; i++) svc.joinStable(users[i].id, stable.id);

    // Lancer un Raid avec roster figé sur users[0..3] (4 membres)
    const raid = await svc.createRaid(users[0].id, {
      stableId: stable.id,
      bossId: 'nit',
      rosterPlayerIds: [users[0].id, users[1].id, users[2].id, users[3].id],
    });

    // Un 5e joueur rejoint l'écurie APRÈS l'ouverture -> interdit sur ce raid (403 roster_locked)
    svc.joinStable(users[4].id, stable.id);
    expect(() =>
      svc.submitRaidDecision(users[4].id, raid.id, {
        handIndex: 0,
        decisionIndex: 0,
        action: 'raise',
        clientMs: 1000,
        key: crypto.randomUUID(),
      })
    ).toThrowError(MpHttpError);

    // Les 3 premiers jouent parfaitement ; avec seulement 3/4 finis -> victoire IMPOSSIBLE
    for (let uIdx = 0; uIdx < 3; uIdx++) {
      const st = svc.getRaidStatus(users[uIdx].id, raid.id);
      const vIds = st.myRun!.variantOrderIds;
      for (let h = 0; h < vIds.length; h++) {
        const variant = BOSS_HAND_VARIANTS.find((v) => v.id === vIds[h])!;
        for (let d = 0; d < variant.steps.length; d++) {
          const bestAction = Object.entries(variant.steps[d].solution.ev).sort((a, b) => b[1] - a[1])[0][0];
          svc.submitRaidDecision(users[uIdx].id, raid.id, {
            handIndex: h,
            decisionIndex: d,
            action: bestAction,
            clientMs: 1500,
            key: crypto.randomUUID(),
          });
        }
      }
    }
    expect(svc.getRaidStatus(users[0].id, raid.id).outcome.victory).toBe(false);

    // Le 4e joue 2 mains avec des erreurs maximales puis abandonne : son run compte (finishedCount = 4/4) avec pénalités timeout -> moyenne > 80 PD -> pas de victoire
    const st3 = svc.getRaidStatus(users[3].id, raid.id);
    for (let h = 0; h < 2; h++) {
      const v3 = BOSS_HAND_VARIANTS.find((v) => v.id === st3.myRun!.variantOrderIds[h])!;
      for (let d = 0; d < v3.steps.length; d++) {
        const worstAction3 = Object.entries(v3.steps[d].solution.ev).sort((a, b) => a[1] - b[1])[0][0];
        svc.submitRaidDecision(users[3].id, raid.id, {
          handIndex: h,
          decisionIndex: d,
          action: worstAction3,
          clientMs: 2000,
          key: crypto.randomUUID(),
        });
      }
    }
    svc.forfeitRaidRun(users[3].id, raid.id);
    const closedAfterForfeit = svc.closeRaid(users[0].id, raid.id);
    expect(closedAfterForfeit.outcome.requiredFinishers).toBe(4);
    expect(closedAfterForfeit.outcome.finishedCount).toBe(4);
    expect(closedAfterForfeit.outcome.teamMeanDecisionPd).toBeGreaterThan(80);
    expect(closedAfterForfeit.outcome.victory).toBe(false);

    // Confidentialité : aucun détail des pertes des coéquipiers n'est retourné dans getRaidStatus
    expect(JSON.stringify(closedAfterForfeit)).not.toContain(users[3].id);

    // Vérifier aussi victoire lorsque 4/4 jouent avec <= 80 PD
    const winEval = evaluateRaidOutcome(4, [
      { playerId: '1', started: true, finished: true, forfeited: false, decisions: [{ phase: 'preflop', pd: 0 }], expectedDecisionCount: 1 },
      { playerId: '2', started: true, finished: true, forfeited: false, decisions: [{ phase: 'postflop', pd: 20 }], expectedDecisionCount: 1 },
      { playerId: '3', started: true, finished: true, forfeited: false, decisions: [{ phase: 'pression', pd: 40 }], expectedDecisionCount: 1 },
      { playerId: '4', started: true, finished: true, forfeited: false, decisions: [{ phase: 'preflop', pd: 20 }], expectedDecisionCount: 1 },
    ]);
    expect(winEval.victory).toBe(true);
    expect(winEval.teamMeanDecisionPd).toBe(20);
  });
});
