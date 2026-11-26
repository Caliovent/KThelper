import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Download,
  Flame,
  Lock,
  LogOut,
  Play,
  RefreshCw,
  ShieldCheck,
  Swords,
  Trash2,
  Trophy,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  DIVISION_LABELS,
  GLICKO,
  SEASON_CONFIG,
  displayDivision,
  getLeagueAvailability,
  inflateRdForInactivity,
  rolloverSeasonRating,
  turningPoints,
} from '../../engines/mp';
import {
  MpApiClientError,
  loadMpSessionToken,
  mpApi,
  saveMpSessionToken,
  type MpDailyCurrentResponse,
  type MpLeaderboardResponse,
  type MpMatchResultResponse,
  type MpMeResponse,
  type MpMetaResponse,
  type MpOpenSpotResponse,
} from '../../services/mpApi';

interface RankedL1PanelProps {
  roomClosedAttested: boolean;
  masteryM: number;
  onRunLockChange: (locked: boolean) => void;
  onRequireAttestation: () => void;
}

interface ActiveL1RunState {
  kind: 'ghost_duel' | 'daily_top';
  matchId: string;
  runId: string;
  spotCount: number;
  opponentPseudo: string | null;
  currentSpotIndex: number;
  openedSpot: MpOpenSpotResponse | null;
  estimateValue: number;
  remainingMs: number;
  lockedBanner: boolean;
  submitting: boolean;
}

function makeUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `mp-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

export const RankedL1Panel: React.FC<RankedL1PanelProps> = ({
  roomClosedAttested,
  masteryM,
  onRunLockChange,
  onRequireAttestation,
}) => {
  const [token, setToken] = useState<string | null>(() => loadMpSessionToken());
  const [meta, setMeta] = useState<MpMetaResponse | null>(null);
  const [offlineMsg, setOfflineMsg] = useState<string | null>(null);
  const [me, setMe] = useState<MpMeResponse | null>(null);
  const [daily, setDaily] = useState<MpDailyCurrentResponse | null>(null);
  const [openMatches, setOpenMatches] = useState<
    { matchId: string; creatorPseudo: string; creatorMmr: number; createdAt: string }[]
  >([]);
  const [leaderboard, setLeaderboard] = useState<MpLeaderboardResponse | null>(null);

  // Auth form
  const [emailInput, setEmailInput] = useState('');
  const [pseudoInput, setPseudoInput] = useState('');
  const [adultChecked, setAdultChecked] = useState(true);
  const [pendingDevLink, setPendingDevLink] = useState<string | null>(null);
  const [manualTokenInput, setManualTokenInput] = useState('');

  // Run & Results
  const [activeRun, setActiveRun] = useState<ActiveL1RunState | null>(null);
  const [settledResult, setSettledResult] = useState<MpMatchResultResponse | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [simM, setSimM] = useState<number>(70);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const openedPerfRef = useRef<number>(0);
  const serverRemainingAtOpenRef = useRef<number>(0);
  const timeoutHandledRef = useRef<boolean>(false);

  useEffect(() => {
    onRunLockChange(Boolean(activeRun));
  }, [activeRun, onRunLockChange]);

  const refreshAll = useCallback(
    async (overrideToken?: string | null) => {
      const tok = overrideToken !== undefined ? overrideToken : token;
      try {
        const m = await mpApi.getMeta();
        setMeta(m);
        setOfflineMsg(null);
      } catch (err) {
        if (err instanceof MpApiClientError && err.offline) {
          setOfflineMsg(err.message);
        } else {
          setOfflineMsg('API L1 indisponible (mode hors-ligne L0 actif).');
        }
        return;
      }

      try {
        const [d, lb] = await Promise.all([
          mpApi.getDailyCurrent(tok),
          mpApi.getLeaderboard('maths_icm', 1),
        ]);
        setDaily(d);
        setLeaderboard(lb);
      } catch {
        // Ignore non-critical public fetch errors
      }

      if (tok) {
        try {
          const [meData, openList] = await Promise.all([
            mpApi.getMe(tok, { mastery: masteryM }),
            mpApi.listOpenMatches(tok, 'maths_icm'),
          ]);
          setMe(meData);
          setOpenMatches(openList.matches);
        } catch (err) {
          if (err instanceof MpApiClientError && err.status === 401) {
            saveMpSessionToken(null);
            setToken(null);
            setMe(null);
          }
        }
      } else {
        setMe(null);
        setOpenMatches([]);
      }
    },
    [masteryM, token]
  );

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  // Horloge autoritaire basée sur deadline - serverNow + performance.now() (Bible p.30)
  useEffect(() => {
    if (!activeRun?.openedSpot) return;
    const deadlineMs = Date.parse(activeRun.openedSpot.deadline);
    const serverNowMs = Date.parse(activeRun.openedSpot.serverNow);
    serverRemainingAtOpenRef.current = Math.max(0, deadlineMs - serverNowMs);
    openedPerfRef.current = performance.now();
    timeoutHandledRef.current = false;

    const id = window.setInterval(() => {
      const elapsed = performance.now() - openedPerfRef.current;
      const rem = Math.max(0, serverRemainingAtOpenRef.current - elapsed);
      setActiveRun((prev) => (prev ? { ...prev, remainingMs: rem } : null));
      if (rem <= 0 && !timeoutHandledRef.current) {
        timeoutHandledRef.current = true;
        window.clearInterval(id);
        void submitL1Answer(String(activeRun.estimateValue), true);
      }
    }, 100);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRun?.runId, activeRun?.openedSpot?.spotIndex]);

  const handleRequestLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setBanner(null);
    try {
      const res = await mpApi.requestAuthLink({
        email: emailInput.trim(),
        pseudo: pseudoInput.trim(),
        adultAttested: true,
      });
      if (res.devLinkToken) {
        setPendingDevLink(res.devLinkToken);
        setManualTokenInput(res.devLinkToken);
        setBanner('Lien de connexion généré (mode dev local prêt à valider en 1 clic).');
      } else {
        setBanner('Si l’e-mail est valide, un lien de connexion vient d’être préparé.');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur auth/link');
    }
  };

  const handleExchangeToken = async (tokToExchange: string) => {
    setErrorMsg(null);
    try {
      const res = await mpApi.exchangeAuthLink(tokToExchange.trim());
      saveMpSessionToken(res.sessionToken);
      setToken(res.sessionToken);
      setPendingDevLink(null);
      setManualTokenInput('');
      setBanner(`Connecté en L1 sous le pseudo ${res.player.pseudo}.`);
      await refreshAll(res.sessionToken);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Jeton invalide ou expiré.');
    }
  };

  const openSpotOnServer = async (
    tok: string,
    runMeta: Omit<ActiveL1RunState, 'openedSpot' | 'estimateValue' | 'remainingMs' | 'lockedBanner' | 'submitting'>
  ) => {
    const opened = await mpApi.openSpot(tok, runMeta.runId, runMeta.currentSpotIndex, makeUuid());
    const rem = Math.max(0, Date.parse(opened.deadline) - Date.parse(opened.serverNow));
    setActiveRun({
      ...runMeta,
      openedSpot: opened,
      estimateValue: 50,
      remainingMs: rem,
      lockedBanner: false,
      submitting: false,
    });
  };

  const startQueueGhost = async (targetMatchId?: string) => {
    if (!token) return;
    if (!roomClosedAttested) {
      onRequireAttestation();
      return;
    }
    setErrorMsg(null);
    setSettledResult(null);
    try {
      const q = await mpApi.enqueueGhost(token, 'maths_icm', targetMatchId);
      await openSpotOnServer(token, {
        kind: 'ghost_duel',
        matchId: q.matchId,
        runId: q.runId,
        spotCount: q.spotCount,
        opponentPseudo: q.opponent?.pseudo ?? null,
        currentSpotIndex: 0,
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Impossible de lancer le match L1.');
    }
  };

  const startOfficialDaily = async () => {
    if (!token) return;
    if (!roomClosedAttested) {
      onRequireAttestation();
      return;
    }
    setErrorMsg(null);
    setSettledResult(null);
    try {
      const started = await mpApi.startDailyRun(token, makeUuid());
      await openSpotOnServer(token, {
        kind: 'daily_top',
        matchId: started.matchId,
        runId: started.runId,
        spotCount: started.spotCount,
        opponentPseudo: null,
        currentSpotIndex: 0,
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Daily Top indisponible.');
    }
  };

  const submitL1Answer = async (action: string, isAutoTimeout = false) => {
    if (!token || !activeRun || !activeRun.openedSpot || activeRun.submitting) return;
    setActiveRun((prev) => (prev ? { ...prev, submitting: true } : null));
    const clientMs = isAutoTimeout
      ? activeRun.openedSpot.limitMs + 500
      : Math.round(performance.now() - openedPerfRef.current);

    try {
      const ans = await mpApi.answerSpot(token, activeRun.runId, activeRun.currentSpotIndex, {
        action,
        clientMs,
        key: makeUuid(),
      });

      if (ans.runPhase === 'done') {
        const matchId = activeRun.matchId;
        const kind = activeRun.kind;
        setActiveRun(null);
        await refreshAll(token);
        if (kind === 'ghost_duel' && ans.matchState === 'settled') {
          const res = await mpApi.getMatchResult(token, matchId);
          setSettledResult(res);
          setBanner('Match Ghost L1 réglé ! Reçu Ed25519 vérifié.');
        } else if (kind === 'ghost_duel') {
          setBanner(
            'Votre série Ghost L1 est enregistrée (awaiting_second_run, expire sous 48h). Aucun score révélé avant le second joueur.'
          );
        } else {
          setBanner('Daily Top L1 terminé ! Vos réponses restent masquées jusqu’à la clôture UTC.');
        }
        return;
      }

      const nextIdx = ans.nextSpotIndex ?? activeRun.currentSpotIndex + 1;
      setActiveRun((prev) => (prev ? { ...prev, lockedBanner: true } : null));
      await new Promise((r) => setTimeout(r, 150));
      await openSpotOnServer(token, {
        kind: activeRun.kind,
        matchId: activeRun.matchId,
        runId: activeRun.runId,
        spotCount: activeRun.spotCount,
        opponentPseudo: activeRun.opponentPseudo,
        currentSpotIndex: nextIdx,
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur lors du verrouillage.');
      setActiveRun(null);
    }
  };

  const handleForfeitL1 = async () => {
    if (!token || !activeRun) return;
    try {
      const res = await mpApi.forfeitRun(token, activeRun.runId, makeUuid());
      setActiveRun(null);
      setBanner(
        res.cancelledNoMmr
          ? 'Run annulé avant premier spot (aucun effet MMR).'
          : 'Run abandonné : forfait enregistré.'
      );
      await refreshAll(token);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur abandon.');
      setActiveRun(null);
    }
  };

  const handleExportRgpd = () => {
    if (!me) return;
    const blob = new Blob([JSON.stringify(me, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `killtilt-rgpd-${me.player.pseudo}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteAccount = async () => {
    if (!token) return;
    setErrorMsg(null);
    try {
      const res = await mpApi.deleteMe(token);
      saveMpSessionToken(null);
      setToken(null);
      setMe(null);
      setConfirmDelete(false);
      setBanner(
        `Compte supprimé (${res.anonymizedPseudo}). Vos données d’identité sont effacées et vos matchs restent anonymisés pour vos adversaires.`
      );
      await refreshAll(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Suppression impossible.');
    }
  };

  const openMatchResult = async (matchId: string) => {
    if (!token) return;
    setErrorMsg(null);
    try {
      const res = await mpApi.getMatchResult(token, matchId);
      setSettledResult(res);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Débriefing indisponible.');
    }
  };

  const mathsLeagueInfo = getLeagueAvailability('maths_icm');
  const simDiv = displayDivision(1800, { mastery: simM, bossValidated: true, retention7dVerified: true });
  const sampleSeasonRoll = rolloverSeasonRating({ r: 1620, rd: 85, sigma: GLICKO.sigma0 });
  const sampleInactive = inflateRdForInactivity({ r: 1620, rd: 85, sigma: GLICKO.sigma0 }, 2 * GLICKO.periodMs);

  // =========================================================================
  // RUN L1 ACTIF (MP-13 — Zéro correction, zéro solution côté client)
  // =========================================================================
  if (activeRun && activeRun.openedSpot) {
    const sp = activeRun.openedSpot.spot;
    const limitSec = activeRun.openedSpot.limitMs / 1000;
    const pct = Math.max(0, Math.min(100, (activeRun.remainingMs / activeRun.openedSpot.limitMs) * 100));
    const lastQuarter = pct <= 25;

    return (
      <div className="bg-slate-900 border-2 border-emerald-500/50 rounded-2xl p-4 sm:p-6 space-y-4 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-extrabold">
              <Lock className="w-3.5 h-3.5 inline mr-1" />
              Run Autoritaire L1 ({activeRun.kind === 'daily_top' ? 'Daily Top Officiel' : 'Ghost Classé'})
            </span>
            <span className="text-xs font-bold text-white">
              Spot {activeRun.currentSpotIndex + 1} / {activeRun.spotCount}
            </span>
            {activeRun.openedSpot.ghostProgressSpot !== null && (
              <span className="px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 text-[11px] font-mono">
                👻 {activeRun.opponentPseudo ?? 'Ghost'} au spot {activeRun.openedSpot.ghostProgressSpot} (sans réponses)
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className={`font-mono text-sm font-extrabold ${lastQuarter ? 'text-rose-400' : 'text-emerald-300'}`}>
              {(activeRun.remainingMs / 1000).toFixed(1)}s / {limitSec.toFixed(0)}s
            </span>
            <button
              type="button"
              onClick={() => void handleForfeitL1()}
              className="px-3 py-1.5 rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs font-bold"
            >
              Abandonner
            </button>
          </div>
        </div>

        <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-100 ${lastQuarter ? 'bg-rose-500' : 'bg-emerald-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>

        {activeRun.lockedBanner && (
          <div className="text-center text-xs font-bold text-sky-300 py-2">
            Verrouillé côté serveur — transition vers le spot suivant…
          </div>
        )}

        {sp.state.kind === 'estimate' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-7 space-y-3">
              <p className="text-sm sm:text-base font-bold text-white leading-relaxed">{sp.state.question}</p>
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-1">
                <div className="text-[11px] font-bold uppercase text-sky-400">Hypothèses serveur</div>
                <ul className="list-disc list-inside text-xs text-slate-300 space-y-0.5">
                  {sp.state.assumptions.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>
              <div className="text-[11px] text-amber-300/90">
                Mode classé L1 : aucun indice autorisé ; aucune correction avant règlement du match / clôture UTC.
              </div>
            </div>

            <div className="lg:col-span-5 bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-4">
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={sp.state.min}
                  max={sp.state.max}
                  step={sp.state.step}
                  value={activeRun.estimateValue}
                  onChange={(e) =>
                    setActiveRun((prev) => (prev ? { ...prev, estimateValue: Number(e.target.value) } : null))
                  }
                  className="flex-1 accent-emerald-500"
                />
                <input
                  type="number"
                  min={sp.state.min}
                  max={sp.state.max}
                  step={sp.state.step}
                  value={activeRun.estimateValue}
                  onChange={(e) =>
                    setActiveRun((prev) => (prev ? { ...prev, estimateValue: Number(e.target.value) } : null))
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void submitL1Answer(String(activeRun.estimateValue));
                    }
                  }}
                  className="w-24 bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-sm font-mono font-extrabold text-emerald-300 text-right"
                />
              </div>
              <button
                type="button"
                disabled={activeRun.submitting}
                onClick={() => void submitL1Answer(String(activeRun.estimateValue))}
                className="w-full min-h-[44px] py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-extrabold"
              >
                Verrouiller L1 ({activeRun.estimateValue}%)
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Statut serveur & Qualité réseau (Bible p.13) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {offlineMsg ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-500/40 text-rose-300 font-bold flex items-center gap-1.5">
                <WifiOff className="w-4 h-4" /> Hors-ligne ({offlineMsg})
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-sky-500/15 border border-sky-500/40 text-sky-200 font-bold">
                💡 Sans serveur dédié, utilisez l’onglet « ☁️ Cloud AWS (L0) » ou le mode hors-ligne L0.
              </span>
            </div>
          ) : (
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-bold flex items-center gap-1.5">
              <Wifi className="w-4 h-4" /> Serveur L1 connecté • Latence RTT {meta?.rttMs ?? 0} ms • Saison {meta?.season ?? SEASON_CONFIG.currentSeason}
            </span>
          )}
          <span className="text-slate-400">
            Corpus serveur L1 isolé (Maths &amp; ICM : {mathsLeagueInfo.eligibleCount} gabarits vérifiés).
          </span>
        </div>
        <button
          type="button"
          onClick={() => void refreshAll()}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold inline-flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Actualiser L1
        </button>
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

      {/* Débriefing L1 après règlement */}
      {settledResult && (
        <div className="bg-slate-900/95 border border-emerald-500/40 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-extrabold">
                {settledResult.receiptVerified ? '✓ Reçu Ed25519 vérifié' : 'Reçu non vérifié'}
              </span>
              <span className="text-sm font-extrabold text-white">
                Match L1 réglé vs {settledResult.opponentPseudo} : {settledResult.heroTotals.pd} PD vs{' '}
                {settledResult.oppTotals.pd} PD
              </span>
              {settledResult.heroRatingBefore && settledResult.heroRatingAfter && (
                <span className="text-xs font-mono text-sky-300">
                  Rating de précision : {Math.round(settledResult.heroRatingBefore.r)} →{' '}
                  {Math.round(settledResult.heroRatingAfter.r)}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSettledResult(null)}
              className="px-3 py-1 rounded-lg bg-slate-800 text-xs font-bold text-slate-200"
            >
              Fermer
            </button>
          </div>

          <div className="text-xs text-slate-300">
            Turning Points (&gt; 100 PD) : {settledResult.turningPoints.length} •{' '}
            {turningPoints(settledResult.heroScores, settledResult.oppScores)
              .slice(0, 3)
              .map((tp) => `Spot #${tp.spotIndex + 1} (Δ ${tp.diff} PD)`)
              .join(', ') || 'Aucun'}
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {settledResult.spots.map((s) => (
              <div key={s.spotIndex} className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs space-y-1">
                <div className="flex justify-between font-bold">
                  <span className="text-white">
                    Spot #{s.spotIndex + 1} ({s.family})
                  </span>
                  <span className="font-mono text-amber-300">
                    Vous : {s.heroAttempt.pd} PD | Adv : {s.oppAttempt.pd} PD
                  </span>
                </div>
                <div className="text-slate-300">{s.explanationText}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grille principale M1 : Compte + Ghost Classé + Daily Top + Classement */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Colonne gauche : Compte L1 & RGPD (MP-12) */}
        <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
          <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-sky-400" />
            Compte L1, Attestation 18+ &amp; RGPD (MP-12)
          </h3>

          {!me ? (
            <form onSubmit={handleRequestLink} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">E-mail (haché HMAC côté serveur)</label>
                <input
                  type="email"
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="joueur@exemple.fr"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">Pseudo unique (3..24 car.)</label>
                <input
                  type="text"
                  required
                  minLength={3}
                  maxLength={24}
                  value={pseudoInput}
                  onChange={(e) => setPseudoInput(e.target.value)}
                  placeholder="Shark_KT"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={adultChecked}
                  onChange={(e) => setAdultChecked(e.target.checked)}
                  className="accent-sky-500"
                />
                <span>J’atteste avoir 18 ans ou plus (sans droit d’entrée ni lot à valeur).</span>
              </label>
              <button
                type="submit"
                disabled={Boolean(offlineMsg)}
                className="w-full min-h-[44px] py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-extrabold"
              >
                Demander lien de connexion L1
              </button>

              {(pendingDevLink || manualTokenInput) && (
                <div className="bg-sky-950/40 border border-sky-500/40 rounded-xl p-3 space-y-2">
                  <div className="font-bold text-sky-200">Valider le jeton de connexion L1 :</div>
                  <input
                    type="text"
                    value={manualTokenInput}
                    onChange={(e) => setManualTokenInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 font-mono text-[11px] text-white"
                  />
                  <button
                    type="button"
                    onClick={() => void handleExchangeToken(manualTokenInput || pendingDevLink || '')}
                    className="w-full min-h-[44px] py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold"
                  >
                    Valider la connexion L1
                  </button>
                </div>
              )}
            </form>
          ) : (
            <div className="space-y-3 text-xs">
              <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-white text-sm">{me.player.pseudo}</span>
                  <button
                    type="button"
                    onClick={() => {
                      saveMpSessionToken(null);
                      setToken(null);
                      setMe(null);
                    }}
                    className="px-2 py-1 rounded bg-slate-800 text-slate-300 inline-flex items-center gap-1"
                  >
                    <LogOut className="w-3 h-3" /> Déconnexion
                  </button>
                </div>
                <div className="font-mono text-emerald-300">
                  Rating de précision (Maths &amp; ICM) : {Math.round(me.ratings.maths_icm.r)} ±{' '}
                  {Math.round(me.ratings.maths_icm.rd)} ({me.ratings.maths_icm.provisional ? 'provisoire' : 'classé'})
                </div>
                <div className="text-slate-400">
                  Division affichée : <strong className="text-white">{me.ratings.maths_icm.division.label}</strong> • Polyvalent :{' '}
                  {me.allRounder.eligible ? `${me.allRounder.r}` : 'Verrouillé (RD ≤ 110 sur Cash/MTT/Expresso)'}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleExportRgpd}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold inline-flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> Exporter RGPD
                </button>
                {!confirmDelete ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="px-3 py-1.5 rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-200 font-bold inline-flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Supprimer mon compte
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleDeleteAccount()}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-extrabold inline-flex items-center gap-1.5"
                  >
                    Confirmer suppression définitive
                  </button>
                )}
              </div>

              {me.matches.length > 0 && (
                <div className="space-y-1.5">
                  <div className="font-bold text-slate-300">Mes matchs L1 ({me.matches.length})</div>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {me.matches.map((m) => (
                      <div
                        key={m.matchId}
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 flex items-center justify-between gap-2"
                      >
                        <div>
                          <span className="font-bold text-white">{m.mode}</span> •{' '}
                          <span className="font-mono text-slate-400">{m.state}</span>
                          {m.opponentPseudo && <span> vs {m.opponentPseudo}</span>}
                        </div>
                        {m.state === 'settled' && (
                          <button
                            type="button"
                            onClick={() => void openMatchResult(m.matchId)}
                            className="px-2 py-1 rounded bg-emerald-600 text-white font-bold"
                          >
                            Débriefing ({m.totalPd} PD)
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Colonne droite : Ghost Classé L1 & Daily Top Officiel */}
        <div className="lg:col-span-7 space-y-5">
          {/* Ghost Classé L1 (MP-16) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <Swords className="w-4 h-4 text-emerald-400" />
                Ghost Classé L1 — Ligue Maths &amp; ICM (15 spots)
              </h3>
              <span className="text-[11px] font-mono text-slate-400">
                Max 3 matchs / paire / 30j • Expiration 48h
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!me}
                onClick={() => void startQueueGhost()}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs sm:text-sm font-extrabold inline-flex items-center gap-2"
              >
                <Play className="w-4 h-4" /> Lancer / Apparier un Ghost Classé L1
              </button>
            </div>

            {openMatches.length > 0 && (
              <div className="space-y-1.5 text-xs">
                <div className="font-bold text-sky-300">Ghosts en attente d’adversaire :</div>
                {openMatches.map((gm) => (
                  <div
                    key={gm.matchId}
                    className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between gap-2"
                  >
                    <span>
                      <strong>{gm.creatorPseudo}</strong> (Rating {gm.creatorMmr})
                    </span>
                    <button
                      type="button"
                      onClick={() => void startQueueGhost(gm.matchId)}
                      className="px-3 py-1 rounded-lg bg-sky-600 text-white font-bold"
                    >
                      Défier
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Daily Top Officiel L1 (MP-17) */}
          <div className="bg-slate-900/90 border border-amber-500/30 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-400" />
                Daily Top Officiel L1 ({daily?.dailyKey ?? 'UTC'})
              </h3>
              <span className="text-[11px] font-mono text-amber-300">
                {daily?.revealed ? 'Clôturé & Révélé' : 'Correction différée à la clôture UTC'}
              </span>
            </div>

            {daily && (
              <div className="space-y-2.5 text-xs">
                <div className="text-slate-300">{daily.compositionLabel}</div>
                <div className="font-mono text-[10px] text-slate-400 break-all bg-slate-950 border border-slate-800 rounded-lg p-2">
                  Empreinte graine (SHA-256) : {daily.seedCommitment}
                </div>

                {daily.myProvisionalSummary && (
                  <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-xl p-3 text-emerald-200 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      Essai enregistré : {daily.myProvisionalSummary.totalPd} PD • Rang provisoire #
                      {daily.myProvisionalSummary.provisionalRank ?? '-'} (réponses masquées jusqu’à clôture).
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  disabled={!me || daily.alreadyPlayed || daily.closed}
                  onClick={() => void startOfficialDaily()}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-xs font-extrabold"
                >
                  {daily.alreadyPlayed
                    ? 'Essai officiel du jour déjà consommé'
                    : 'Démarrer mon essai officiel Daily Top (15 spots)'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Classement L1 & Divisions / Saisons (MP-18) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-6 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
          <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            Classement Officiel L1 — {leaderboard?.ratingLabel ?? 'Rating de précision'}
          </h3>
          {!leaderboard || leaderboard.entries.length === 0 ? (
            <div className="text-xs text-slate-400 bg-slate-950 border border-slate-800 rounded-xl p-3">
              Aucun match classé L1 réglé pour cette saison pour l’instant.
            </div>
          ) : (
            <div className="space-y-1.5 text-xs font-mono">
              {leaderboard.entries.map((row) => (
                <div
                  key={row.playerId}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 flex items-center justify-between"
                >
                  <span className="text-white font-bold">
                    #{row.rank} {row.pseudo}
                  </span>
                  <span className="text-emerald-300">
                    {Math.round(row.r)} ± {Math.round(row.rd)} ({row.matches}m)
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-6 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3 text-xs">
          <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
            <Award className="w-4 h-4 text-sky-400" />
            Règles Divisions &amp; Saisons (MP-18)
          </h3>
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-300">
                Simulateur double seuil (exemple MMR 1800 avec M = {simM}%) :
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={simM}
                onChange={(e) => setSimM(Number(e.target.value))}
                className="w-32 accent-sky-500"
              />
            </div>
            <div className="text-sky-300 font-bold">
              Division affichée : {simDiv.label} (Master exige MMR ≥ 1700 ET M ≥ 85)
            </div>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-300 space-y-1">
            <div>
              • <strong>Changement de saison :</strong> MMR conservé (1620 → {sampleSeasonRoll.r}), RD = min(350, √(85² + 100²)) ={' '}
              <strong>{sampleSeasonRoll.rd.toFixed(1)}</strong>.
            </div>
            <div>
              • <strong>Inactivité (2 semaines sans match) :</strong> aucune perte de MMR (1620), RD passe de 85 à{' '}
              <strong>{sampleInactive.rd.toFixed(1)}</strong>.
            </div>
            <div>
              • <strong>Ligues solveur :</strong> {DIVISION_LABELS.master} / Cash / MTT / Expresso restent « Bientôt en classé » sans export relu.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
