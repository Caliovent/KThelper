import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Cloud,
  Copy,
  Download,
  Lock,
  Play,
  RefreshCw,
  Search,
  Trophy,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  MP_CORPUS,
  selectCorpusSeries,
  scoreSolution,
  type CorpusTemplateWithMeta,
} from '../../engines/mp';
import {
  createChallenge,
  getChallenge,
  getLeaderboard,
  getOrCreateKtpPlayerId,
  type KtpChallengeMeta,
  type KtpGameContext,
  type KtpLeaderboardResponse,
  type KtpLeague,
  type KtpSubmitResponse,
} from '../../services/ktpApi';
import {
  attachKtpOnlineSync,
  flushQueue,
  getQueuedSubmissions,
  syncSubmit,
} from '../../services/ktpSync';

interface AwsCloudPanelProps {
  roomClosedAttested: boolean;
  onRunLockChange: (locked: boolean) => void;
  onRequireAttestation: () => void;
}

interface ActiveAwsRun {
  challengeId: string;
  seed: string;
  variant: KtpLeague;
  templates: CorpusTemplateWithMeta[];
  spotIdx: number;
  estimateValue: number;
  startedAtMs: number;
  scoresPd: number[];
  totalReactionMs: number;
}

const DEFAULT_GAME_CONTEXTS: Record<KtpLeague, KtpGameContext> = {
  cash: { stacksBb: [100, 100, 100], positions: ['BTN', 'SB', 'BB'], street: 'preflop', board: [] },
  mtt_icm: { stacksBb: [40, 25, 20, 15], positions: ['CO', 'BTN', 'SB', 'BB'], street: 'preflop', board: [] },
  expresso: { stacksBb: [25, 25, 25], positions: ['BTN', 'SB', 'BB'], street: 'preflop', board: [] },
  all_around: { stacksBb: [100, 80, 60], positions: ['BTN', 'SB', 'BB'], street: 'flop', board: ['Ah', 'Kd', '2c'] },
};

export const AwsCloudPanel: React.FC<AwsCloudPanelProps> = ({
  roomClosedAttested,
  onRunLockChange,
  onRequireAttestation,
}) => {
  const [playerId] = useState<string>(() => getOrCreateKtpPlayerId());
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine !== false
  );
  const [variant, setVariant] = useState<KtpLeague>('all_around');
  const [leaderboardLeague, setLeaderboardLeague] = useState<KtpLeague>('all_around');
  const [leaderboard, setLeaderboard] = useState<KtpLeaderboardResponse | null>(null);
  const [loadedChallenge, setLoadedChallenge] = useState<KtpChallengeMeta | null>(null);
  const [joinIdInput, setJoinIdInput] = useState<string>('');
  const [pendingCount, setPendingCount] = useState<number>(0);

  const [activeRun, setActiveRun] = useState<ActiveAwsRun | null>(null);
  const [lastSubmitOutcome, setLastSubmitOutcome] = useState<
    | null
    | { kind: 'submitted'; challengeId: string; evLossBb: number; reactionMs: number; res: KtpSubmitResponse }
    | { kind: 'queued'; challengeId: string; evLossBb: number; reactionMs: number }
  >(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);

  const spotOpenedPerfRef = useRef<number>(0);

  useEffect(() => {
    onRunLockChange(Boolean(activeRun));
  }, [activeRun, onRunLockChange]);

  const refreshQueueCount = useCallback(async () => {
    const q = await getQueuedSubmissions();
    setPendingCount(q.length);
  }, []);

  const refreshLeaderboard = useCallback(async (lg: KtpLeague = leaderboardLeague) => {
    try {
      const board = await getLeaderboard(lg, 50, playerId);
      setLeaderboard(board);
    } catch {
      // Garde l'état silencieux si hors-ligne
    }
  }, [leaderboardLeague, playerId]);

  useEffect(() => {
    void refreshQueueCount();
    void refreshLeaderboard(leaderboardLeague);

    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    const detachSync = attachKtpOnlineSync((summary) => {
      setPendingCount(summary.remaining);
      if (summary.flushed > 0) {
        setBanner(`${summary.flushed} soumission(s) hors-ligne synchronisée(s) vers AWS !`);
        void refreshLeaderboard(leaderboardLeague);
      }
    });

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      detachSync();
    };
  }, [leaderboardLeague, refreshLeaderboard, refreshQueueCount]);

  const handleCreateChallenge = async () => {
    setErrorMsg(null);
    setBanner(null);
    setBusy(true);
    try {
      const created = await createChallenge(
        { variant, gameContext: DEFAULT_GAME_CONTEXTS[variant] },
        playerId
      );
      setLoadedChallenge({
        challengeId: created.challengeId,
        seed: created.seed,
        variant: created.variant,
        gameContext: DEFAULT_GAME_CONTEXTS[variant],
        status: 'open',
        expiresAt: created.expiresAt,
      });
      setJoinIdInput(created.challengeId);
      setBanner(`Défi AWS créé : ID ${created.challengeId} (expire dans 24 h).`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur création défi AWS.');
    } finally {
      setBusy(false);
    }
  };

  const handleLoadChallenge = async () => {
    const id = joinIdInput.trim();
    if (!id) return;
    setErrorMsg(null);
    setBanner(null);
    setBusy(true);
    try {
      const meta = await getChallenge(id, playerId);
      setLoadedChallenge(meta);
      setBanner(`Défi ${meta.challengeId} chargé (graine déterministe prête).`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Défi introuvable sur AWS.');
    } finally {
      setBusy(false);
    }
  };

  const handleStartChallengeRun = async (challenge: KtpChallengeMeta) => {
    if (!roomClosedAttested) {
      onRequireAttestation();
      return;
    }
    setErrorMsg(null);
    setLastSubmitOutcome(null);
    const { templates } = await selectCorpusSeries('maths_icm', 6, challenge.seed, true, MP_CORPUS);
    spotOpenedPerfRef.current = performance.now();
    setActiveRun({
      challengeId: challenge.challengeId,
      seed: challenge.seed,
      variant: challenge.variant,
      templates,
      spotIdx: 0,
      estimateValue: 50,
      startedAtMs: performance.now(),
      scoresPd: [],
      totalReactionMs: 0,
    });
  };

  const handleLockAwsSpot = async () => {
    if (!activeRun) return;
    const tpl = activeRun.templates[activeRun.spotIdx];
    const elapsed = Math.min(
      tpl.public.limitMs,
      Math.max(100, Math.round(performance.now() - spotOpenedPerfRef.current))
    );
    const scored = scoreSolution(
      tpl.solution,
      String(activeRun.estimateValue),
      elapsed,
      tpl.public.limitMs,
      false,
      false
    ).score;

    const nextScoresPd = [...activeRun.scoresPd, scored.pd];
    const nextReactionMs = activeRun.totalReactionMs + elapsed;

    if (activeRun.spotIdx + 1 < activeRun.templates.length) {
      spotOpenedPerfRef.current = performance.now();
      setActiveRun({
        ...activeRun,
        spotIdx: activeRun.spotIdx + 1,
        estimateValue: 50,
        scoresPd: nextScoresPd,
        totalReactionMs: nextReactionMs,
      });
      return;
    }

    const totalPd = nextScoresPd.reduce((a, b) => a + b, 0);
    const evLossBb = Math.round((totalPd / 1000) * 1000) / 1000;
    const challengeId = activeRun.challengeId;
    const seed = activeRun.seed;

    setActiveRun(null);
    setBusy(true);
    try {
      const outcome = await syncSubmit(challengeId, seed, {
        playerId,
        evLossBb,
        reactionMs: nextReactionMs,
      });
      await refreshQueueCount();
      if (outcome.queued) {
        setLastSubmitOutcome({ kind: 'queued', challengeId, evLossBb, reactionMs: nextReactionMs });
        setBanner(`Hors-ligne : résultat (${evLossBb} bb) mis en file IndexedDB (${outcome.pendingCount} en attente).`);
      } else {
        setLastSubmitOutcome({
          kind: 'submitted',
          challengeId,
          evLossBb,
          reactionMs: nextReactionMs,
          res: outcome.result,
        });
        setBanner(`Score envoyé sur AWS ! ELO ${outcome.result.gtoElo} (${outcome.result.gtoEloDelta >= 0 ? '+' : ''}${outcome.result.gtoEloDelta}).`);
        await refreshLeaderboard(leaderboardLeague);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur soumission AWS.');
    } finally {
      setBusy(false);
    }
  };

  const handleManualFlush = async () => {
    setErrorMsg(null);
    setBusy(true);
    try {
      const summary = await flushQueue();
      setPendingCount(summary.remaining);
      if (summary.flushed > 0) {
        setBanner(`${summary.flushed} soumission(s) synchronisée(s) vers AWS !`);
        await refreshLeaderboard(leaderboardLeague);
      } else if (summary.errors.length > 0) {
        setErrorMsg(summary.errors[0]);
      } else {
        setBanner('File IndexedDB déjà vide.');
      }
    } finally {
      setBusy(false);
    }
  };

  if (activeRun) {
    const tpl = activeRun.templates[activeRun.spotIdx];
    const state = tpl.public.state;
    return (
      <div className="bg-slate-900 border-2 border-sky-500/50 rounded-2xl p-4 sm:p-6 space-y-4 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-sky-500/15 border border-sky-500/40 text-sky-300 text-xs font-extrabold">
              <Lock className="w-3.5 h-3.5 inline mr-1" />
              Défi AWS {activeRun.challengeId} (Cloud Amical L0)
            </span>
            <span className="text-xs font-bold text-white">
              Spot {activeRun.spotIdx + 1} / {activeRun.templates.length}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setActiveRun(null)}
            className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs font-bold text-slate-200"
          >
            Quitter
          </button>
        </div>

        {state.kind === 'estimate' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-7 space-y-3">
              <p className="text-sm sm:text-base font-bold text-white leading-relaxed">{state.question}</p>
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-1">
                <div className="text-[11px] font-bold uppercase text-sky-400">Hypothèses</div>
                <ul className="list-disc list-inside text-xs text-slate-300 space-y-0.5">
                  {state.assumptions.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="lg:col-span-5 bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-4">
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={state.min}
                  max={state.max}
                  step={state.step}
                  value={activeRun.estimateValue}
                  onChange={(e) => setActiveRun({ ...activeRun, estimateValue: Number(e.target.value) })}
                  className="flex-1 accent-sky-500"
                />
                <input
                  type="number"
                  min={state.min}
                  max={state.max}
                  step={state.step}
                  value={activeRun.estimateValue}
                  onChange={(e) => setActiveRun({ ...activeRun, estimateValue: Number(e.target.value) })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleLockAwsSpot();
                    }
                  }}
                  className="w-24 bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-sm font-mono font-extrabold text-sky-300 text-right"
                />
              </div>
              <button
                type="button"
                onClick={() => void handleLockAwsSpot()}
                className="w-full min-h-[44px] py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-extrabold"
              >
                Valider {activeRun.estimateValue}%
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* En-tête statut AWS + IndexedDB */}
      <div className="bg-slate-900/90 border border-sky-500/30 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-2.5 py-1 rounded-lg bg-sky-500/15 border border-sky-500/40 text-sky-300 font-extrabold inline-flex items-center gap-1.5">
            <Cloud className="w-4 h-4" />
            Cloud Amical L0 (AWS eu-north-1 • Calcul client — Hors Classé L1)
          </span>
          <span
            className={`px-2 py-0.5 rounded font-bold inline-flex items-center gap-1 ${
              isOnline ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'
            }`}
          >
            {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {isOnline ? 'En ligne' : 'Hors-ligne'}
          </span>
          <span className="font-mono text-slate-400">ID opaque : {playerId.slice(0, 12)}…</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 font-mono text-amber-300">
            IndexedDB : {pendingCount} en attente
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleManualFlush()}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Synchroniser la file
          </button>
        </div>
      </div>

      {banner && (
        <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl px-4 py-2.5 text-xs text-emerald-200 flex items-center justify-between">
          <span>{banner}</span>
          <button type="button" onClick={() => setBanner(null)} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>
      )}
      {errorMsg && (
        <div className="bg-rose-950/40 border border-rose-500/40 rounded-xl px-4 py-2.5 text-xs text-rose-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {lastSubmitOutcome && (
        <div className="bg-slate-950 border border-sky-500/40 rounded-2xl p-4 text-xs space-y-1">
          {lastSubmitOutcome.kind === 'submitted' ? (
            <>
              <div className="font-extrabold text-emerald-300">
                ✓ Soumission acceptée sur AWS (`{lastSubmitOutcome.challengeId}`)
              </div>
              <div className="font-mono text-slate-200">
                Perte : {lastSubmitOutcome.evLossBb} bb • Temps : {lastSubmitOutcome.reactionMs} ms • ELO Cloud :{' '}
                <strong>{lastSubmitOutcome.res.gtoElo}</strong> ({lastSubmitOutcome.res.gtoEloDelta >= 0 ? '+' : ''}
                {lastSubmitOutcome.res.gtoEloDelta}) • Rang #{lastSubmitOutcome.res.rank} ({lastSubmitOutcome.res.leagueId})
              </div>
            </>
          ) : (
            <div className="font-bold text-amber-300">
              <Download className="w-4 h-4 inline mr-1" />
              Mis en file IndexedDB hors-ligne (`{lastSubmitOutcome.challengeId}`, {lastSubmitOutcome.evLossBb} bb) — envoi automatique au retour réseau.
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Création / Chargement Défi Cloud */}
        <div className="lg:col-span-6 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 text-xs">
          <h3 className="text-sm font-extrabold text-white">Défis Cloud Partagés (ID court &amp; Graine AWS)</h3>

          <div className="flex flex-wrap gap-2">
            <select
              value={variant}
              onChange={(e) => setVariant(e.target.value as KtpLeague)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 font-bold text-white"
            >
              <option value="all_around">All-Around</option>
              <option value="cash">Cash Game</option>
              <option value="mtt_icm">MTT &amp; ICM</option>
              <option value="expresso">Expresso</option>
            </select>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleCreateChallenge()}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-extrabold"
            >
              Créer un défi AWS
            </button>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={joinIdInput}
              onChange={(e) => setJoinIdInput(e.target.value)}
              placeholder="Entrer un challengeId AWS (ex: 2Ds4kL...)"
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 font-mono text-white"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleLoadChallenge()}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold inline-flex items-center gap-1"
            >
              <Search className="w-3.5 h-3.5" /> Charger le défi
            </button>
          </div>

          {loadedChallenge && (
            <div className="bg-slate-950 border border-sky-500/30 rounded-xl p-3.5 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono font-bold text-sky-300">
                  ID : {loadedChallenge.challengeId} ({loadedChallenge.variant})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(loadedChallenge.challengeId);
                    setBanner(`ID ${loadedChallenge.challengeId} copié.`);
                  }}
                  className="px-2 py-1 rounded bg-slate-800 text-slate-200 font-bold inline-flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" /> Copier ID
                </button>
              </div>
              <div className="font-mono text-[10px] text-slate-400 break-all">
                Seed : {loadedChallenge.seed} • Statut : {loadedChallenge.status}
              </div>
              <button
                type="button"
                onClick={() => void handleStartChallengeRun(loadedChallenge)}
                className="w-full min-h-[44px] py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold inline-flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4" /> Jouer ce défi (6 spots déterministes)
              </button>
            </div>
          )}
        </div>

        {/* Leaderboard Cloud AWS */}
        <div className="lg:col-span-6 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              Classement Cloud Amical L0 (AWS)
            </h3>
            <div className="flex items-center gap-2">
              <select
                value={leaderboardLeague}
                onChange={(e) => setLeaderboardLeague(e.target.value as KtpLeague)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 font-bold text-white"
              >
                <option value="all_around">all_around</option>
                <option value="cash">cash</option>
                <option value="mtt_icm">mtt_icm</option>
                <option value="expresso">expresso</option>
              </select>
              <button
                type="button"
                onClick={() => void refreshLeaderboard(leaderboardLeague)}
                className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200 font-bold"
              >
                Actualiser
              </button>
            </div>
          </div>

          <p className="text-[11px] text-slate-400">
            Calculé côté client avec checksum SHA-256 et file hors-ligne IndexedDB (distinct du classement autoritaire L1).
          </p>

          {!leaderboard || leaderboard.entries.length === 0 ? (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-400">
              Aucune entrée ou serveur hors-ligne.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-60 overflow-y-auto font-mono">
              {leaderboard.entries.map((entry) => (
                <div
                  key={`${entry.rank}-${entry.playerId}`}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 flex items-center justify-between"
                >
                  <span className="text-white font-bold">
                    #{entry.rank} {entry.playerId.slice(0, 14)}
                  </span>
                  <span className="text-sky-300 font-extrabold">ELO {entry.gtoElo}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
