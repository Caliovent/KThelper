import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Crown,
  Flame,
  Play,
  ShieldAlert,
  ShieldCheck,
  Swords,
  Users,
  Vote,
} from 'lucide-react';
import {
  BOSS_CONFIG,
  BOSS_HAND_VARIANTS,
  BOSS_PROFILES,
  evaluateSoloBossValidation,
  parseRawToSourceHand,
  scoreBossDecision,
  toShared,
  type BossHandSpec,
  type BossId,
  type SharedHand,
  type SoloBossHandResult,
} from '../../engines/mp';
import { loadMpSessionToken, mpApi } from '../../services/mpApi';

const SAMPLE_WINAMAX_24H = `Winamax Poker - CashGame - HandId: #20261120-9012 - Holdem no limit (0.01€/0.02€) - 2026/11/20 20:14:00 UTC
Table: 'Nice 04' 5-max Seat #1 is the button
Seat 1: PseudoHeroPrive (2.10€)
Seat 2: JoueurSBPrive (2.00€)
Seat 3: RegBBPrive (2.40€)
*** ANTE/BLINDS ***
JoueurSBPrive posts small blind 0.01€
RegBBPrive posts big blind 0.02€
Dealt to PseudoHeroPrive [Ah Qd]
*** PRE-FLOP ***
PseudoHeroPrive raises 0.03€ to 0.05€
JoueurSBPrive folds
RegBBPrive calls 0.03€
*** FLOP *** [As 8d 3c]
RegBBPrive checks
PseudoHeroPrive bets 0.04€
RegBBPrive folds
*** SUMMARY ***`;

interface MyStableData {
  stable: { id: string; name: string; createdAt: string };
  myRole: 'owner' | 'captain' | 'member';
  active: boolean;
  weeklyTarget: number;
  weeklyTotal: number;
  members: { playerId: string; pseudo: string; role: string; weeklyCappedRevisions: number }[];
  raids: { id: string; bossId: BossId; state: string; roster: string[] }[];
}

interface SharedHandServerItem {
  id: string;
  stableId: string;
  hand: SharedHand;
  tags: string[];
  question: string;
  createdDay: string;
  myVote: string | null;
  totalVotes: number;
  voteCounts: Record<string, number> | null;
}

export const SocialM3Panel: React.FC = () => {
  const [token] = useState<string | null>(() => loadMpSessionToken());

  // === 1. BOSS SUR RAILS (SOLO VALIDATION V2, MP-25) ===
  const [selectedBoss, setSelectedBoss] = useState<BossId>('nit');
  const [bossSessionHands, setBossSessionHands] = useState<readonly BossHandSpec[]>([]);
  const [bossHandIdx, setBossHandIdx] = useState(0);
  const [bossStepIdx, setBossStepIdx] = useState(0);
  const [bossCurHandPds, setBossCurHandPds] = useState<number[]>([]);
  const [bossCompletedHands, setBossCompletedHands] = useState<SoloBossHandResult[]>([]);
  const [bossLastActionNote, setBossLastActionNote] = useState<string | null>(null);
  const [bossValidationResult, setBossValidationResult] = useState<ReturnType<
    typeof evaluateSoloBossValidation
  > | null>(null);

  const startBossSolo = () => {
    const bossHands = BOSS_HAND_VARIANTS.filter((h) => h.bossId === selectedBoss);
    const others = BOSS_HAND_VARIANTS.filter((h) => h.bossId !== selectedBoss);
    const picked = [...bossHands, ...others].slice(0, BOSS_CONFIG.soloHandsCount);
    setBossSessionHands(picked);
    setBossHandIdx(0);
    setBossStepIdx(0);
    setBossCurHandPds([]);
    setBossCompletedHands([]);
    setBossLastActionNote(null);
    setBossValidationResult(null);
  };

  const handleBossStepChoice = (actionId: string) => {
    const curHand = bossSessionHands[bossHandIdx];
    const curStep = curHand?.steps[bossStepIdx];
    if (!curHand || !curStep) return;

    const pd = scoreBossDecision(curStep, actionId, 3500);
    const nextPds = [...bossCurHandPds, pd];

    if (bossStepIdx + 1 < curHand.steps.length) {
      setBossCurHandPds(nextPds);
      setBossStepIdx(bossStepIdx + 1);
      setBossLastActionNote(
        `${curHand.railNotice} : « ${curStep.referenceRailActionLabel} » (votre choix : ${pd} PD).`
      );
      return;
    }

    const handMean = Math.round(nextPds.reduce((a, b) => a + b, 0) / nextPds.length);
    const nextCompleted: SoloBossHandResult[] = [
      ...bossCompletedHands,
      { handId: curHand.id, decisionPds: nextPds, meanPd: handMean },
    ];
    if (bossHandIdx + 1 < bossSessionHands.length) {
      setBossCompletedHands(nextCompleted);
      setBossHandIdx(bossHandIdx + 1);
      setBossStepIdx(0);
      setBossCurHandPds([]);
      setBossLastActionNote(`Main #${bossHandIdx + 1} terminée (${handMean} PD moyens).`);
      return;
    }

    setBossCompletedHands(nextCompleted);
    setBossSessionHands([]);
    setBossValidationResult(evaluateSoloBossValidation(nextCompleted));
  };

  // === 2. ÉCURIE L1 & PARTAGES >=24H (MP-23 & MP-24) ===
  const [myStable, setMyStable] = useState<MyStableData | null>(null);
  const [allStables, setAllStables] = useState<
    { id: string; name: string; memberCount: number; active: boolean; weeklyTarget: number; weeklyTotal: number }[]
  >([]);
  const [stableNameInput, setStableNameInput] = useState('Écurie Grinder FR');
  const [sharedHands, setSharedHands] = useState<SharedHandServerItem[]>([]);
  const [rawHandText, setRawHandText] = useState('');
  const [handQuestion, setHandQuestion] = useState('Quelle ligne optimale river ?');
  const [handTagsText, setHandTagsText] = useState('cbet, value');
  const [whitelistPreview, setWhitelistPreview] = useState<string | null>(null);
  const [socialBanner, setSocialBanner] = useState<string | null>(null);
  const [socialError, setSocialError] = useState<string | null>(null);

  const refreshSocial = useCallback(async () => {
    if (!token) return;
    try {
      const data = await mpApi.getStables(token);
      setAllStables(data.stables);
      setMyStable(data.myStable as MyStableData | null);
      if (data.myStable) {
        const handsRes = await mpApi.getSharedHands(token, data.myStable.stable.id);
        setSharedHands(handsRes.hands);
      } else {
        setSharedHands([]);
      }
    } catch {
      // Ignore offline/unauth gracefully
    }
  }, [token]);

  useEffect(() => {
    void refreshSocial();
  }, [refreshSocial]);

  const handleCreateStable = async () => {
    if (!token) return;
    setSocialError(null);
    try {
      await mpApi.createStable(token, stableNameInput.trim());
      setSocialBanner('Écurie L1 créée !');
      await refreshSocial();
    } catch (err) {
      setSocialError(err instanceof Error ? err.message : 'Erreur création écurie.');
    }
  };

  const handleJoinStable = async (id: string) => {
    if (!token) return;
    setSocialError(null);
    try {
      await mpApi.joinStable(token, id);
      setSocialBanner('Écurie rejointe !');
      await refreshSocial();
    } catch (err) {
      setSocialError(err instanceof Error ? err.message : 'Impossible de rejoindre cette écurie.');
    }
  };

  const handlePublishHand = async () => {
    if (!token || !myStable) return;
    setSocialError(null);
    setWhitelistPreview(null);
    try {
      const src = parseRawToSourceHand(rawHandText);
      const shared = toShared(src, Date.now());
      setWhitelistPreview(JSON.stringify(shared, null, 2));
      const tags = handTagsText
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 3);
      await mpApi.publishSharedHand(token, {
        stableId: myStable.stable.id,
        playedAtMs: src.playedAtMs,
        question: handQuestion.trim() || 'Analyse collective',
        tags,
        hand: shared,
      });
      setSocialBanner('Main pseudonymisée (>= 24h) publiée en discussion non notée !');
      await refreshSocial();
    } catch (err) {
      setSocialError(err instanceof Error ? err.message : 'Main invalide ou trop récente (< 24h).');
    }
  };

  const handleVoteHand = async (
    handId: string,
    vote: 'fold' | 'check' | 'call' | 'bet' | 'raise'
  ) => {
    if (!token) return;
    setSocialError(null);
    try {
      await mpApi.voteSharedHand(token, handId, vote);
      await refreshSocial();
    } catch (err) {
      setSocialError(err instanceof Error ? err.message : 'Erreur vote.');
    }
  };

  const activeBossProfile = BOSS_PROFILES[selectedBoss];
  const activeHand = bossSessionHands[bossHandIdx];
  const activeStep = activeHand?.steps[bossStepIdx];

  return (
    <div className="space-y-5">
      {socialBanner && (
        <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl px-4 py-2.5 text-xs text-emerald-200 flex justify-between">
          <span>{socialBanner}</span>
          <button type="button" onClick={() => setSocialBanner(null)}>✕</button>
        </div>
      )}
      {socialError && (
        <div className="bg-rose-950/40 border border-rose-500/40 rounded-xl px-4 py-2.5 text-xs text-rose-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{socialError}</span>
        </div>
      )}

      {/* 1. BOSS SUR RAILS (VALIDATION SOLO V2, MP-25) */}
      <div className="bg-slate-900/95 border border-rose-500/30 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <Crown className="w-4 h-4 text-rose-400" />
              Boss sur Rails (Validation Solo V2 • MP-25)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              3 mains tirées parmi {BOSS_HAND_VARIANTS.length} variantes • Moyenne &lt; 500 PD/main et aucune décision &gt; 500 PD.
            </p>
          </div>
          <span className="px-2.5 py-0.5 rounded bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[11px] font-bold">
            Hors MMR • Raid Coopératif 72h en Écurie
          </span>
        </div>

        {!activeHand && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {(Object.values(BOSS_PROFILES) as typeof BOSS_PROFILES[BossId][]).map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setSelectedBoss(b.id)}
                  className={`text-left p-3 rounded-xl border transition ${
                    selectedBoss === b.id
                      ? 'bg-rose-600/20 border-rose-400 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="font-extrabold text-sm">
                    {b.emblem} {b.name}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">{b.tagline}</div>
                  <div className="font-mono text-[10px] text-sky-300 mt-1.5">
                    VPIP {b.freqSheet.vpip}% • PFR {b.freqSheet.pfr}% • 3B {b.freqSheet.threeBet}%
                  </div>
                </button>
              ))}
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2">
              <span className="italic text-slate-300">{activeBossProfile.quotes[0]}</span>
              <button
                type="button"
                onClick={startBossSolo}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold inline-flex items-center gap-2"
              >
                <Swords className="w-4 h-4" /> Affronter ce Boss (3 mains sur rails)
              </button>
            </div>

            {bossValidationResult && (
              <div
                className={`rounded-xl border p-3 font-bold flex items-center gap-2 ${
                  bossValidationResult.passed
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                    : 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                }`}
              >
                <Award className="w-4 h-4 shrink-0" />
                <span>{bossValidationResult.reason}</span>
              </div>
            )}
          </div>
        )}

        {activeHand && activeStep && (
          <div className="bg-slate-950/90 border border-rose-500/40 rounded-xl p-4 space-y-3 text-xs">
            <div className="flex flex-wrap justify-between gap-2">
              <span className="font-extrabold text-white">
                Main {bossHandIdx + 1}/{bossSessionHands.length} — {activeHand.title}
              </span>
              <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold">
                {activeHand.railNotice}
              </span>
            </div>

            {bossLastActionNote && (
              <div className="text-[11px] text-amber-300 bg-amber-950/30 border border-amber-500/30 rounded-lg px-2.5 py-1.5">
                {bossLastActionNote}
              </div>
            )}

            <div className="text-slate-200 font-bold text-sm">{activeStep.streetLabel} — {activeStep.prompt}</div>

            <div className="flex flex-wrap gap-2 font-mono font-extrabold">
              <span className="text-slate-400">Héros :</span>
              {activeStep.heroCards.map((c) => (
                <span key={c} className="px-2 py-0.5 rounded bg-white text-slate-900">{c}</span>
              ))}
              {activeStep.board.length > 0 && (
                <>
                  <span className="text-slate-400 ml-2">Board :</span>
                  {activeStep.board.map((c) => (
                    <span key={c} className="px-2 py-0.5 rounded bg-amber-100 text-slate-900">{c}</span>
                  ))}
                </>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
              {activeStep.options.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleBossStepChoice(opt.id)}
                  className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-900 hover:bg-rose-600/25 border border-slate-700 text-white font-bold"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2. ÉCURIE L1 & PARTAGES D'HISTORIQUES >=24H (MP-23 & MP-24) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3 text-xs">
          <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-sky-400" />
            Écurie L1 (4–20 membres • Plafond 100/sem.)
          </h3>

          {!token ? (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-400">
              Connectez-vous dans l’onglet « Classé L1 » pour créer ou rejoindre une écurie persistante sur le serveur.
            </div>
          ) : !myStable ? (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  aria-label="Nom de l’écurie L1"
                  value={stableNameInput}
                  onChange={(e) => setStableNameInput(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold"
                />
                <button
                  type="button"
                  onClick={() => void handleCreateStable()}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-extrabold"
                >
                  Créer Écurie L1
                </button>
              </div>
              {allStables.length > 0 && (
                <div className="space-y-1.5">
                  <div className="font-bold text-slate-300">Écuries existantes :</div>
                  {allStables.map((s) => (
                    <div key={s.id} className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 flex justify-between items-center">
                      <span>{s.name} ({s.memberCount}/20)</span>
                      <button
                        type="button"
                        onClick={() => void handleJoinStable(s.id)}
                        className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-bold"
                      >
                        Rejoindre
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1.5">
                <div className="flex justify-between font-extrabold text-white">
                  <span>{myStable.stable.name} ({myStable.myRole})</span>
                  <span className="text-sky-300">{myStable.members.length}/20 membres</span>
                </div>
                <div className="text-slate-400">
                  Statut : {myStable.active ? 'Active (≥ 4 membres)' : `En attente (${myStable.members.length}/4 min)`} • Objectif L1 hebdo :{' '}
                  <strong className="text-emerald-300">{myStable.weeklyTotal}/{myStable.weeklyTarget}</strong> (zéro FSRS solo compté)
                </div>
              </div>
              <div className="space-y-1 max-h-36 overflow-y-auto">
                {myStable.members.map((m) => (
                  <div key={m.playerId} className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 flex justify-between font-mono">
                    <span className="text-slate-200">{m.pseudo} ({m.role})</span>
                    <span className="text-amber-300">{m.weeklyCappedRevisions}/100</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Défis d'historiques serveur (>= 24h, MP-24) */}
        <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3 text-xs">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Défis d’Historiques Serveur (Liste Blanche ≥ 24h • MP-24)
            </h3>
            <button
              type="button"
              onClick={() => setRawHandText(SAMPLE_WINAMAX_24H)}
              className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200 font-bold"
            >
              Charger exemple Winamax (&gt; 24h)
            </button>
          </div>

          <textarea
            rows={3}
            value={rawHandText}
            onChange={(e) => setRawHandText(e.target.value)}
            placeholder="Collez une main Winamax/PokerStars (>= 24h)…"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 font-mono text-[11px] text-white"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              value={handQuestion}
              onChange={(e) => setHandQuestion(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-white"
              placeholder="Question pour l’écurie…"
            />
            <input
              type="text"
              value={handTagsText}
              onChange={(e) => setHandTagsText(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 font-mono text-white"
              placeholder="Max 3 étiquettes"
            />
          </div>
          <button
            type="button"
            disabled={!token || !myStable || !rawHandText.trim()}
            onClick={() => void handlePublishHand()}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-extrabold inline-flex items-center gap-2"
          >
            <Play className="w-4 h-4" /> Publier en discussion non notée
          </button>

          {whitelistPreview && (
            <pre className="bg-slate-950 border border-emerald-500/30 rounded-xl p-2.5 text-[10px] font-mono text-emerald-300 max-h-32 overflow-auto">
              {whitelistPreview}
            </pre>
          )}

          {sharedHands.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-800">
              {sharedHands.map((sh) => (
                <div key={sh.id} className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
                  <div className="flex justify-between font-bold text-white">
                    <span>
                      [{sh.hand.heroLabel} {sh.hand.heroCards.join('')}] {sh.question}
                    </span>
                    <span className="text-slate-400 font-mono">{sh.tags.join(' • ')}</span>
                  </div>
                  {!sh.myVote ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-amber-300 flex items-center gap-1">
                        <Vote className="w-3.5 h-3.5" /> Votez avant de voir les avis :
                      </span>
                      {(['fold', 'check', 'call', 'bet', 'raise'] as const).map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => void handleVoteHand(sh.id, v)}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-sky-600 text-white font-bold uppercase"
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-emerald-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      Votre vote : <strong>{sh.myVote}</strong> • Totaux ({sh.totalVotes}) :{' '}
                      {JSON.stringify(sh.voteCounts)} (une majorité n’est pas une solution).
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Pseudonymisation stricte : aucun pseudo réel, identifiant de main ou horodatage conservé sur le serveur.</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <ShieldAlert className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span>Les Raids Boss 72h (10 mains/membre, Barre du Boss 3 phases, roster figé 4–20) s’ouvrent dès 4 membres.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
