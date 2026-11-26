import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Lock,
  Radio,
  Scale,
  ShieldAlert,
  Swords,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type { SpotPublic } from '../../domain/types';
import { loadMpSessionToken, mpApi } from '../../services/mpApi';
import { MpLiveClient, type WsServerMsg } from '../../services/mpWs';

interface LiveArenaPanelProps {
  roomClosedAttested: boolean;
  onRunLockChange: (locked: boolean) => void;
  onRequireAttestation: () => void;
}

interface ReviewCaseItem {
  id: string;
  matchId: string;
  signals: { kind: string; severity: 'low' | 'medium'; summary: string }[];
  status: string;
  createdAt: string;
  appealNote: string | null;
  decision: string | null;
  decisionReason: string | null;
}

function makeUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ws-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

export const LiveArenaPanel: React.FC<LiveArenaPanelProps> = ({
  roomClosedAttested,
  onRunLockChange,
  onRequireAttestation,
}) => {
  const [token] = useState<string | null>(() => loadMpSessionToken());
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [rttMs, setRttMs] = useState<number | null>(null);
  const [inQueue, setInQueue] = useState(false);
  const [waitSec, setWaitSec] = useState(0);

  const [matchId, setMatchId] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [opponent, setOpponent] = useState<{ pseudo: string; mmr: number } | null>(null);
  const [spotCount, setSpotCount] = useState<number>(15);
  const [currentSpot, setCurrentSpot] = useState<{ i: number; spot: SpotPublic; deadline: string; serverNow: string } | null>(null);
  const [estimateVal, setEstimateVal] = useState<number>(50);
  const [remainingMs, setRemainingMs] = useState<number>(0);
  const [oppDone, setOppDone] = useState<number>(0);
  const [settledReceipt, setSettledReceipt] = useState<string | null>(null);
  const [wsError, setWsError] = useState<string | null>(null);

  const [reviewCases, setReviewCases] = useState<ReviewCaseItem[]>([]);
  const [appealInputs, setAppealInputs] = useState<Record<string, string>>({});
  const [reviewBanner, setReviewBanner] = useState<string | null>(null);

  const clientRef = useRef<MpLiveClient | null>(null);
  const openedPerfRef = useRef<number>(0);
  const runIdRef = useRef<string | null>(null);
  runIdRef.current = runId;

  useEffect(() => {
    onRunLockChange(Boolean(runId && !settledReceipt));
  }, [runId, settledReceipt, onRunLockChange]);

  const loadReviewCases = useCallback(async () => {
    if (!token) return;
    try {
      const res = await mpApi.getReviewCases(token);
      setReviewCases(res.cases);
    } catch {
      // Ignore offline/auth errors cleanly
    }
  }, [token]);

  useEffect(() => {
    void loadReviewCases();
  }, [loadReviewCases]);

  useEffect(() => {
    if (!token) return;
    const client = new MpLiveClient({
      token,
      onStatusChange: setWsStatus,
      onMessage: (msg: WsServerMsg) => {
        if (msg.t === 'pong') {
          setRttMs(Math.max(1, Date.now() - msg.at));
        } else if (msg.t === 'matched') {
          setInQueue(false);
          setMatchId(msg.matchId);
          setRunId(msg.runId);
          setOpponent(msg.opponent);
          setOppDone(0);
          setSettledReceipt(null);
          setWsError(null);
        } else if (msg.t === 'start') {
          setSpotCount(msg.spotCount);
          const rid = runIdRef.current;
          if (rid) {
            client.openSpot(rid, 0, makeUuid());
          }
        } else if (msg.t === 'spot') {
          setCurrentSpot(msg);
          setEstimateVal(50);
          const rem = Math.max(0, Date.parse(msg.deadline) - Date.parse(msg.serverNow));
          setRemainingMs(rem);
          openedPerfRef.current = performance.now();
        } else if (msg.t === 'locked') {
          const next = msg.i + 1;
          const rid = runIdRef.current;
          if (rid && next < spotCount) {
            setTimeout(() => client.openSpot(rid, next, makeUuid()), 300);
          } else {
            setCurrentSpot(null);
          }
        } else if (msg.t === 'opponent_progress') {
          setOppDone(msg.done);
        } else if (msg.t === 'settled') {
          setSettledReceipt(msg.receipt);
          setCurrentSpot(null);
          setRunId(null);
          void loadReviewCases();
        } else if (msg.t === 'error') {
          setWsError(`Erreur WS : ${msg.code}`);
        }
      },
    });
    clientRef.current = client;
    client.connect();
    const pingTimer = window.setInterval(() => client.ping(), 15000);
    return () => {
      window.clearInterval(pingTimer);
      client.close();
      clientRef.current = null;
    };
  }, [loadReviewCases, spotCount, token]);

  useEffect(() => {
    if (!inQueue) {
      setWaitSec(0);
      return;
    }
    const id = window.setInterval(() => setWaitSec((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [inQueue]);

  useEffect(() => {
    if (!currentSpot) return;
    const totalMs = Math.max(1000, Date.parse(currentSpot.deadline) - Date.parse(currentSpot.serverNow));
    const id = window.setInterval(() => {
      const rem = Math.max(0, totalMs - (performance.now() - openedPerfRef.current));
      setRemainingMs(rem);
    }, 100);
    return () => window.clearInterval(id);
  }, [currentSpot]);

  const handleJoinLive = () => {
    if (!roomClosedAttested) {
      onRequireAttestation();
      return;
    }
    setWsError(null);
    setInQueue(true);
    clientRef.current?.joinLiveQueue('maths_icm');
  };

  const handleSubmitWsAnswer = () => {
    if (!runId || !currentSpot) return;
    const elapsed = Math.round(performance.now() - openedPerfRef.current);
    clientRef.current?.answerSpot(runId, currentSpot.i, String(estimateVal), elapsed, makeUuid());
  };

  const handleSubmitAppeal = async (caseId: string) => {
    if (!token) return;
    const note = (appealInputs[caseId] ?? '').trim();
    if (note.length < 5) return;
    try {
      await mpApi.submitReviewAppeal(token, caseId, note);
      setReviewBanner('Recours enregistré dans le journal de revue.');
      await loadReviewCases();
    } catch (err) {
      setWsError(err instanceof Error ? err.message : 'Erreur recours.');
    }
  };

  const activeWindowLabel = waitSec < 10 ? '±75 MMR' : waitSec < 20 ? '±150 MMR' : waitSec < 40 ? '±300 MMR' : 'Fenêtre élargie (Ghost conseillé)';

  return (
    <div className="space-y-5">
      {/* Statut WebSocket Live Arena (MP-20) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-400" />
              Live Arena Synchrone (/v1/ws • MP-20)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Reprise automatique sur coupure (`resumeRunId`) • Barre de progression adverse seule (zéro score en direct).
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            {!token ? (
              <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 font-bold">
                Connectez un compte dans « Classé L1 » pour activer le WS
              </span>
            ) : wsStatus === 'connected' ? (
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-bold inline-flex items-center gap-1.5">
                <Wifi className="w-3.5 h-3.5" /> WebSocket Connecté {rttMs !== null ? `• ${rttMs} ms` : ''}
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-500/40 text-rose-300 font-bold inline-flex items-center gap-1.5">
                <WifiOff className="w-3.5 h-3.5" /> WebSocket {wsStatus === 'connecting' ? 'Connexion…' : 'Déconnecté'}
              </span>
            )}
          </div>
        </div>

        {wsError && (
          <div className="bg-rose-950/40 border border-rose-500/40 rounded-xl px-3 py-2 text-xs text-rose-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{wsError}</span>
          </div>
        )}

        {!currentSpot && !settledReceipt && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!token || wsStatus !== 'connected' || inQueue}
              onClick={handleJoinLive}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs sm:text-sm font-extrabold inline-flex items-center gap-2"
            >
              <Swords className="w-4 h-4" />
              {inQueue ? `Recherche d’adversaire… (${waitSec}s • ${activeWindowLabel})` : 'Entrer en File Live Arena (15 spots)'}
            </button>
            {inQueue && (
              <button
                type="button"
                onClick={() => setInQueue(false)}
                className="px-3 py-2 rounded-xl bg-slate-800 text-xs font-bold text-slate-200"
              >
                Quitter la file
              </button>
            )}
          </div>
        )}

        {currentSpot && (
          <div className="bg-slate-950/90 border border-emerald-500/40 rounded-2xl p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                  <Lock className="w-3 h-3 inline mr-1" /> Live vs {opponent?.pseudo ?? 'Adversaire'} ({opponent?.mmr ?? 1500})
                </span>
                <span className="font-bold text-white">
                  Spot {currentSpot.i + 1} / {spotCount}
                </span>
              </div>
              <div className="flex items-center gap-3 font-mono">
                <span className="text-sky-300">Progression adverse : {oppDone} / {spotCount} (score masqué)</span>
                <span className="text-amber-300 font-extrabold">{(remainingMs / 1000).toFixed(1)}s</span>
              </div>
            </div>

            {currentSpot.spot.state.kind === 'estimate' && (
              <div className="space-y-3">
                <p className="text-sm font-bold text-white">{currentSpot.spot.state.question}</p>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={currentSpot.spot.state.min}
                    max={currentSpot.spot.state.max}
                    step={currentSpot.spot.state.step}
                    value={estimateVal}
                    onChange={(e) => setEstimateVal(Number(e.target.value))}
                    className="flex-1 accent-emerald-500"
                  />
                  <input
                    type="number"
                    value={estimateVal}
                    onChange={(e) => setEstimateVal(Number(e.target.value))}
                    className="w-24 bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-sm font-mono text-emerald-300 text-right"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSubmitWsAnswer}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-extrabold"
                  >
                    Verrouiller Live ({estimateVal}%)
                  </button>
                  {runId && (
                    <button
                      type="button"
                      onClick={() => clientRef.current?.forfeitRun(runId, makeUuid())}
                      className="px-3 py-2 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs font-bold"
                    >
                      Abandonner
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {settledReceipt && (
          <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-xl p-3 text-xs text-emerald-200 space-y-1">
            <div className="font-extrabold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Match Live réglé (reçu Ed25519 reçu pour {matchId}) !
            </div>
            <div className="font-mono text-[10px] break-all text-slate-300">{settledReceipt.slice(0, 180)}…</div>
          </div>
        )}
      </div>

      {/* Console de Revue & Signaux d'intégrité (MP-21) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
            <Scale className="w-4 h-4 text-sky-400" />
            Console de Revue &amp; Signaux d’Intégrité (MP-21)
          </h3>
          <span className="px-2.5 py-0.5 rounded bg-sky-500/15 border border-sky-500/30 text-sky-300 font-bold">
            0 sanction automatique • Revue humaine journalisée uniquement
          </span>
        </div>

        <p className="text-slate-400">
          Conformément à la Bible (p. 32), aucun signal temporel ou statistique ne modifie jamais un MMR automatiquement : toute correction passe par une revue humaine journalisée avec droit de recours.
        </p>

        {reviewBanner && (
          <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-lg p-2 text-emerald-200">
            {reviewBanner}
          </div>
        )}

        {reviewCases.length === 0 ? (
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-400 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-emerald-400 shrink-0" />
            Aucun signal de revue ouvert sur votre compte.
          </div>
        ) : (
          <div className="space-y-2">
            {reviewCases.map((c) => (
              <div key={c.id} className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
                <div className="flex justify-between font-bold">
                  <span className="text-white">Dossier {c.id.slice(0, 8)} • Match {c.matchId.slice(0, 8)}</span>
                  <span className="font-mono text-amber-300">Statut : {c.status}</span>
                </div>
                <ul className="list-disc list-inside text-slate-300">
                  {c.signals.map((s, idx) => (
                    <li key={idx}>
                      [{s.kind}] {s.summary}
                    </li>
                  ))}
                </ul>
                {c.status === 'open' && !c.appealNote && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={appealInputs[c.id] ?? ''}
                      onChange={(e) => setAppealInputs({ ...appealInputs, [c.id]: e.target.value })}
                      placeholder="Ajouter une explication / recours…"
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                    />
                    <button
                      type="button"
                      onClick={() => void handleSubmitAppeal(c.id)}
                      className="px-3 py-1.5 rounded-lg bg-sky-600 text-white font-bold"
                    >
                      Déposer un recours
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
