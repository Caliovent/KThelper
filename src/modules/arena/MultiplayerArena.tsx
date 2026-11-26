import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Copy,
  Download,
  Flame,
  History,
  Lock,
  Play,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Swords,
  Unlock,
  Upload,
  Users,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import type {
  GhostChallengeV2,
  League,
  PlayerAttemptRecord,
  ReviewEventV3,
  SeriesRef,
  SpotPublic,
} from '../../domain/types';
import {
  CLOCK_MS,
  DRAW_BAND_PD,
  FSRS_THRESHOLDS,
  GLICKO,
  MP_CORPUS,
  DIVISION_LABELS,
  DIVISIONS,
  division,
  newRun,
  reduce,
  scoreSolution,
  totals,
  ratedOutcome,
  turningPoints,
  gradeFromPd,
  detectTimingAnomaly,
  getLeagueAvailability,
  selectCorpusSeries,
  resolveTemplatesByIds,
  toPublicSpots,
  composeLocalDaily,
  buildReferenceBaseline,
  encodeGhostV2,
  decodeGhostV2,
  needsGhostFile,
  medals,
  parseRawToSourceHand,
  toShared,
  createMultiplayerReviewEvent,
  appendMultiplayerReviews,
  confirmProvisionalReviews,
  computeMasteryCountsFromReviews,
  type CorpusTemplateWithMeta,
  type LocalDailyBundle,
  type Run,
  type SpotScore,
} from '../../engines/mp';
import {
  applyArenaQuestEvents,
  createDefaultEcurie,
  DEFAULT_ARENA_QUESTS,
  isMpEnabled,
  loadArenaState,
  saveArenaState,
  setMpEnabledFlag,
  type ArenaState,
} from '../../stores/arenaStore';
import { AwsCloudPanel } from './AwsCloudPanel';
import { FresqueDuelPanel } from './FresqueDuelPanel';
import { RankedL1Panel } from './RankedL1Panel';
import { SalvePanel } from './SalvePanel';

type ArenaTab = 'duel' | 'aws' | 'l1' | 'daily' | 'elo' | 'quests' | 'games';
type CertaintyMark = 'sur' | 'hesitant';

const SUIT_SYMBOL: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };

const REACTION_CHOICES = [
  'Bien joué',
  'Spot difficile',
  "J'ai hésité",
  'On compare ?',
  'Merci',
  'Revanche ?',
] as const;

const SAMPLE_OLD_WINAMAX_HAND = `Winamax Poker - CashGame - HandId: #20261120-8421 - Holdem no limit (0.01€/0.02€) - 2026/11/20 20:14:00 UTC
Table: 'Cannes 03' 5-max Seat #1 is the button
Seat 1: MonPseudoReel (2.14€)
Seat 2: JoueurSB (1.95€)
Seat 3: RegBB (2.48€)
*** ANTE/BLINDS ***
JoueurSB posts small blind 0.01€
RegBB posts big blind 0.02€
Dealt to MonPseudoReel [As 5s]
*** PRE-FLOP ***
MonPseudoReel raises 0.03€ to 0.05€
JoueurSB folds
RegBB calls 0.03€
*** FLOP *** [Ks 7d 2c]
RegBB checks
MonPseudoReel bets 0.04€
RegBB folds
*** SUMMARY ***`;

function readMasteryApprox(): number {
  try {
    const raw = localStorage.getItem('killtilt_range_mastery_v1');
    if (!raw) return 50;
    const parsed = JSON.parse(raw) as { spotStats?: Record<string, { attempts: number; correct: number }> };
    const entries = Object.values(parsed.spotStats ?? {});
    if (!entries.length) return 55;
    let att = 0;
    let ok = 0;
    entries.forEach((e) => {
      att += e.attempts || 0;
      ok += e.correct || 0;
    });
    return att === 0 ? 55 : Math.min(96, Math.round((ok / att) * 100));
  } catch {
    return 55;
  }
}

function makeUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `mp-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

function formatPdInUnit(pd: number, lossUnit: 'mbb' | 'ppm_pp' | null): string {
  if (lossUnit === 'mbb') return `${pd} PD (≈ ${(pd / 1000).toFixed(3)} bb)`;
  if (lossUnit === 'ppm_pp') return `${pd} PD (≈ ${(pd / 1000).toFixed(2)} % PP)`;
  return `${pd} PD (estimation)`;
}

function PokerCardChip({ card }: { card: string }) {
  const rank = card[0] ?? '?';
  const suit = card[1] ?? 's';
  const isRed = suit === 'h' || suit === 'd';
  return (
    <div
      className={`w-10 h-14 rounded-xl bg-white border border-slate-300 shadow-md flex flex-col items-center justify-center font-mono font-extrabold text-sm leading-tight ${
        isRed ? 'text-rose-600' : 'text-slate-900'
      }`}
    >
      <span>{rank}</span>
      <span>{SUIT_SYMBOL[suit] ?? suit}</span>
    </div>
  );
}

interface ActiveRunSession {
  matchId: string;
  kind: 'duel_l0' | 'daily_l0' | 'onboarding_l0';
  league: League;
  seriesRef: SeriesRef;
  templates: CorpusTemplateWithMeta[];
  publicSpots: SpotPublic[];
  run: Run;
  hintsUsed: boolean[];
  certaintyMarks: (CertaintyMark | null)[];
  estimateValue: number;
  currentCertainty: CertaintyMark;
  lockedBanner: boolean;
  showHint: boolean;
  baselineLabel: string;
  baselineScores: SpotScore[];
  ghostCreatorPseudo: string | null;
  ghostCreatorRecords: PlayerAttemptRecord[] | null;
  dailyBundle: LocalDailyBundle | null;
  dailyCount: number;
}

interface DebriefView {
  matchId: string;
  kind: 'duel_l0' | 'daily_l0' | 'onboarding_l0';
  league: League;
  templates: CorpusTemplateWithMeta[];
  heroScores: SpotScore[];
  heroRecords: PlayerAttemptRecord[];
  heroTotals: { pd: number; perfects: number; ms: number };
  certaintyMarks: (CertaintyMark | null)[];
  baselineLabel: string;
  baselineScores: SpotScore[];
  baselineTotals: { pd: number; perfects: number; ms: number };
  outcome: 0 | 0.5 | 1;
  anomaly: { flagged: boolean; reason: string | null };
  ghostToken: string | null;
  ghostIsLarge: boolean;
  dailyMedals: string[];
  newlyCompletedQuests: string[];
  selectedReaction: string | null;
}

function EvCurveChart({
  heroScores,
  oppScores,
  oppLabel,
}: {
  heroScores: readonly SpotScore[];
  oppScores: readonly SpotScore[];
  oppLabel: string;
}) {
  const n = heroScores.length;
  const width = 560;
  const height = 150;
  const pad = 20;

  const heroCum: number[] = [0];
  const oppCum: number[] = [0];
  for (let i = 0; i < n; i++) {
    heroCum.push(heroCum[i] + (heroScores[i]?.pd ?? 0));
    oppCum.push(oppCum[i] + (oppScores[i]?.pd ?? 0));
  }
  const maxY = Math.max(300, ...heroCum, ...oppCum);
  const toX = (idx: number) => pad + (idx / Math.max(1, n)) * (width - pad * 2);
  const toY = (val: number) => height - pad - (val / maxY) * (height - pad * 2);

  const heroPoints = heroCum.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');
  const oppPoints = oppCum.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');

  return (
    <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <span className="font-bold uppercase tracking-wider text-slate-400">
          Courbe de perte cumulée (PD — plus bas = meilleur)
        </span>
        <div className="flex items-center gap-3 font-mono">
          <span className="text-emerald-400 font-bold">● Vous</span>
          <span className="text-amber-400 font-bold">┄ {oppLabel}</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-36 overflow-visible">
        <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="#334155" strokeWidth="1" />
        <line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke="#334155" strokeWidth="1" />
        <polyline fill="none" stroke="#f59e0b" strokeWidth="2.2" strokeDasharray="5 4" points={oppPoints} />
        <polyline fill="none" stroke="#10b981" strokeWidth="2.8" points={heroPoints} />
      </svg>
    </div>
  );
}

export const MultiplayerArena: React.FC = () => {
  const [mpActive, setMpActive] = useState<boolean>(() => isMpEnabled());
  const [arena, setArena] = useState<ArenaState>(() => loadArenaState());
  const [activeTab, setActiveTab] = useState<ArenaTab>('duel');

  const [league, setLeague] = useState<League>('maths_icm');
  const [spotCount, setSpotCount] = useState<12 | 15 | 20>(15);
  const [seedInput, setSeedInput] = useState<string>(() => `kt-${new Date().toISOString().slice(0, 10)}-01`);

  const [ghostInput, setGhostInput] = useState<string>('');
  const [decodedGhost, setDecodedGhost] = useState<GhostChallengeV2 | null>(null);
  const [ghostError, setGhostError] = useState<string | null>(null);

  const [session, setSession] = useState<ActiveRunSession | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => performance.now());
  const [debrief, setDebrief] = useState<DebriefView | null>(null);
  const [showAllTurningPoints, setShowAllTurningPoints] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const [dailyLocal, setDailyLocal] = useState<LocalDailyBundle | null>(null);
  const [ecurieNameInput, setEcurieNameInput] = useState<string>('Écurie Kill Tilt Entraide');
  const [rawHandInput, setRawHandInput] = useState<string>('');
  const [shareNoteInput, setShareNoteInput] = useState<string>('Main à débattre en discussion non notée');
  const [shareTagsInput, setShareTagsInput] = useState<string>('cbet, flop, position');
  const [shareError, setShareError] = useState<string | null>(null);
  const [sharedPreviewJson, setSharedPreviewJson] = useState<string | null>(null);
  const [l1RunLocked, setL1RunLocked] = useState<boolean>(false);

  const sessionRef = useRef<ActiveRunSession | null>(null);
  sessionRef.current = session;

  const masteryM = useMemo(() => readMasteryApprox(), [arena.reviewLog.length]);
  const reviewCounts = useMemo(() => computeMasteryCountsFromReviews(arena.reviewLog), [arena.reviewLog]);

  const leagueStatuses = useMemo(
    () =>
      (['maths_icm', 'cash', 'mtt_icm', 'expresso', 'all_rounder'] as League[]).map((lg) =>
        getLeagueAvailability(lg, MP_CORPUS)
      ),
    []
  );

  const updateArena = useCallback((updater: (prev: ArenaState) => ArenaState) => {
    setArena((prev) => {
      const next = updater(prev);
      saveArenaState(next);
      return next;
    });
  }, []);

  // Verrouillage Anti-RTA global pendant un run
  useEffect(() => {
    const locked = session !== null || l1RunLocked;
    window.dispatchEvent(
      new CustomEvent('propoker-arena-lock', {
        detail: {
          locked,
          reason: locked
            ? 'Run actif : calculateur ICM, explorateur de ranges et Coach IA désactivés dans cette application.'
            : '',
        },
      })
    );
    return () => {
      window.dispatchEvent(new CustomEvent('propoker-arena-lock', { detail: { locked: false, reason: '' } }));
    };
  }, [session !== null, l1RunLocked]);

  // Charger Daily local et ?challenge=KT2. éventuel
  useEffect(() => {
    composeLocalDaily(Date.now()).then(setDailyLocal).catch(() => {});
    const params = new URLSearchParams(window.location.search);
    const ch = params.get('challenge');
    if (ch) {
      setGhostInput(ch);
      decodeGhostV2(ch)
        .then((res) => {
          setDecodedGhost(res);
          setGhostError(null);
        })
        .catch((err: unknown) => {
          setGhostError(err instanceof Error ? err.message : 'Code Ghost invalide');
        });
    }
  }, []);

  const finalizeSession = useCallback(
    async (completed: ActiveRunSession, finalRun: Run) => {
      const heroScores: SpotScore[] = [];
      const heroRecords: PlayerAttemptRecord[] = [];
      const questEvents: {
        eventId: string;
        skillId: string;
        variantSeed: string;
        pd: number;
        usedHint: boolean;
        firstSeen: boolean;
      }[] = [];
      const newReviews: ReviewEventV3[] = [];
      const existingSeen = new Set(arena.seenSpotVariants);

      completed.templates.forEach((tpl, idx) => {
        const lk = finalRun.locked[idx] ?? { i: idx, action: null, elapsedMs: tpl.public.limitMs };
        const usedHint = !!completed.hintsUsed[idx];
        const scored = scoreSolution(
          tpl.solution,
          lk.action,
          lk.elapsedMs,
          tpl.public.limitMs,
          usedHint,
          false // Tous les runs M0 sont L0 locaux amicaux (jamais L1 serveur)
        );
        const variantSeed = `${completed.seriesRef.seed}:${tpl.id}`;
        const firstSeen = !existingSeen.has(variantSeed);

        heroScores.push(scored.score);
        heroRecords.push({
          spotIndex: idx,
          actionChosen: lk.action,
          elapsedMs: lk.elapsedMs,
          usedHint,
          loss: scored.score.loss,
          lossUnit: scored.lossUnit,
          pd: scored.score.pd,
          timeout: scored.score.timeout,
        });

        questEvents.push({
          eventId: `${completed.matchId}:${idx}`,
          skillId: tpl.skillId,
          variantSeed,
          pd: scored.score.pd,
          usedHint,
          firstSeen,
        });

        if (firstSeen) {
          const evLossBb =
            scored.lossUnit === 'mbb'
              ? scored.score.loss / 1000
              : scored.lossUnit === 'ppm_pp'
                ? scored.score.loss / 10000
                : null;
          newReviews.push(
            createMultiplayerReviewEvent({
              matchId: completed.matchId,
              spotIndex: idx,
              skillId: tpl.skillId,
              grade: gradeFromPd(scored.score, tpl.public.limitMs, usedHint),
              ms: scored.score.countedMs || lk.elapsedMs,
              evLossBb,
              pd: scored.score.pd,
              variantSeed,
            })
          );
        }
      });

      const heroTotals = totals(heroScores);
      const anomaly = detectTimingAnomaly(heroRecords.map((r) => ({ elapsedMs: r.elapsedMs, pd: r.pd })));

      let oppLabel = completed.baselineLabel;
      let oppScores = completed.baselineScores;
      if (completed.ghostCreatorRecords && completed.ghostCreatorPseudo) {
        oppLabel = `${completed.ghostCreatorPseudo} (Ghost L0 non vérifié)`;
        oppScores = completed.ghostCreatorRecords.map((rec, i) => ({
          loss: rec.loss ?? 0,
          pd: rec.pd,
          perfect: rec.pd === 0,
          timeout: rec.timeout,
          countedMs: Math.min(rec.elapsedMs, completed.templates[i]?.public.limitMs ?? 20000),
        }));
      }
      const oppTotals = totals(oppScores);
      const outcome = ratedOutcome(heroTotals, oppTotals);

      // Générer le jeton Ghost amical KT2. (zéro HMAC, zéro referenceHash, L0 explicite)
      let ghostToken: string | null = null;
      if (completed.kind === 'duel_l0' || completed.kind === 'onboarding_l0') {
        const ghostPayload: GhostChallengeV2 = {
          schemaVersion: 2,
          challengeId: completed.matchId,
          mode: 'ghost_duel',
          league: completed.league,
          series: completed.seriesRef,
          createdAt: new Date().toISOString(),
          creatorPseudo: arena.pseudo,
          creatorResults: { records: heroRecords },
          integrity: 'L0',
        };
        ghostToken = await encodeGhostV2(ghostPayload);
      }

      const earnedMedals =
        completed.kind === 'daily_l0' ? medals(heroScores, completed.templates.length) : [];

      let completedQuestNames: string[] = [];
      updateArena((prev) => {
        const questRes = applyArenaQuestEvents(prev.quests, questEvents);
        completedQuestNames = questRes.newlyCompleted.map((q) => q.title);
        const xpFromQuests = questRes.newlyCompleted.reduce((s, q) => s + q.xpReward, 0);
        // Rendement décroissant XP après 5 runs/jour (Bible p.27)
        const todayStr = new Date().toISOString().slice(0, 10);
        const todayRuns = prev.localRuns.filter((r) => r.at.startsWith(todayStr)).length;
        const baseXp = todayRuns >= 5 ? 8 : 25;
        window.dispatchEvent(new CustomEvent('propoker-award-xp', { detail: { amount: baseXp + xpFromQuests } }));

        const mergedReviews = appendMultiplayerReviews(
          prev.reviewLog,
          newReviews,
          new Set(prev.seenSpotVariants)
        );
        const nextSeen = [
          ...new Set([...prev.seenSpotVariants, ...questEvents.map((e) => e.variantSeed)]),
        ].slice(-1000);

        const nextDaily = { ...prev.dailyLocalRuns };
        if (completed.kind === 'daily_l0' && completed.dailyBundle) {
          const dk = completed.dailyBundle.dayKey;
          const cur = nextDaily[dk];
          nextDaily[dk] = {
            dayKey: dk,
            bestPd: cur ? Math.min(cur.bestPd, heroTotals.pd) : heroTotals.pd,
            bestPerfects: cur ? Math.max(cur.bestPerfects, heroTotals.perfects) : heroTotals.perfects,
            bestMs: cur ? Math.min(cur.bestMs, heroTotals.ms) : heroTotals.ms,
            medals: [...new Set([...(cur?.medals ?? []), ...earnedMedals])],
            runsCount: (cur?.runsCount ?? 0) + 1,
          };
        }

        const nextLosses = outcome === 0 ? prev.antiTilt.consecutiveLosses + 1 : 0;

        return {
          ...prev,
          // Aucun changement de ratings/MMR en M0 (L0 local, Bible p.5 & p.33)
          localRuns: [
            {
              id: completed.matchId,
              at: new Date().toISOString(),
              mode:
                completed.kind === 'onboarding_l0'
                  ? ('onboarding_l0' as const)
                  : completed.kind === 'daily_l0'
                    ? ('daily_top' as const)
                    : ('ghost_duel' as const),
              league: completed.league,
              seed: completed.seriesRef.seed,
              integrity: 'L0' as const,
              baselineLabel: oppLabel,
              heroPd: heroTotals.pd,
              baselinePd: oppTotals.pd,
              heroPerfects: heroTotals.perfects,
              heroMs: heroTotals.ms,
              outcome,
            },
            ...prev.localRuns,
          ].slice(0, 50),
          dailyLocalRuns: nextDaily,
          quests: questRes.nextQuests,
          reviewLog: mergedReviews.slice(0, 400),
          seenSpotVariants: nextSeen,
          antiTilt: {
            ...prev.antiTilt,
            consecutiveLosses: nextLosses,
            firstExperienceDone: prev.antiTilt.firstExperienceDone || completed.kind === 'onboarding_l0',
          },
        };
      });

      setShowAllTurningPoints(false);
      setDebrief({
        matchId: completed.matchId,
        kind: completed.kind,
        league: completed.league,
        templates: completed.templates,
        heroScores,
        heroRecords,
        heroTotals,
        certaintyMarks: completed.certaintyMarks,
        baselineLabel: oppLabel,
        baselineScores: oppScores,
        baselineTotals: oppTotals,
        outcome,
        anomaly,
        ghostToken,
        ghostIsLarge: ghostToken ? needsGhostFile(ghostToken) : false,
        dailyMedals: earnedMedals,
        newlyCompletedQuests: completedQuestNames,
        selectedReaction: null,
      });
      setSession(null);
    },
    [arena.pseudo, arena.seenSpotVariants, updateArena]
  );

  // Horloge stricte pilotée par la machine à états pure (match.ts)
  useEffect(() => {
    if (!session) return;
    const id = window.setInterval(() => {
      const now = performance.now();
      setNowMs(now);
      setSession((prev) => {
        if (!prev) return null;
        if (prev.run.phase.s === 'ready') {
          const opened = reduce(prev.run, { t: 'OPEN', i: prev.run.phase.i, now });
          return { ...prev, run: opened, lockedBanner: false, showHint: false };
        }
        if (prev.run.phase.s === 'open') {
          const ticked = reduce(prev.run, { t: 'TICK', now });
          if (ticked !== prev.run) {
            if (ticked.phase.s === 'done') {
              void finalizeSession(prev, ticked);
              return prev;
            }
            if (ticked.phase.s === 'ready') {
              const openedNext = reduce(ticked, { t: 'OPEN', i: ticked.phase.i, now });
              return { ...prev, run: openedNext, lockedBanner: false, showHint: false };
            }
          }
        }
        return prev;
      });
    }, 100);
    return () => window.clearInterval(id);
  }, [finalizeSession, session !== null]);

  const lockSpotAnswer = useCallback(
    (actionOrEstimate: string) => {
      const cur = sessionRef.current;
      if (!cur || cur.run.phase.s !== 'open') return;
      const now = performance.now();
      const idx = cur.run.phase.i;
      const nextRun = reduce(cur.run, { t: 'ANSWER', i: idx, action: actionOrEstimate, now });
      if (nextRun === cur.run) return;

      const nextCert = [...cur.certaintyMarks];
      nextCert[idx] = cur.currentCertainty;

      if (nextRun.phase.s === 'done') {
        void finalizeSession({ ...cur, certaintyMarks: nextCert }, nextRun);
        return;
      }
      const openedNext =
        nextRun.phase.s === 'ready' ? reduce(nextRun, { t: 'OPEN', i: nextRun.phase.i, now }) : nextRun;
      setSession({
        ...cur,
        run: openedNext,
        certaintyMarks: nextCert,
        estimateValue: 50,
        currentCertainty: 'sur',
        showHint: false,
      });
    },
    [finalizeSession]
  );

  const requireAttestation = (): boolean => {
    if (arena.antiTilt.roomClosedAttested) return true;
    setStatusBanner(
      '⚠️ Confirmez d’abord l’engagement ci-dessous (fermer votre logiciel Winamax/PokerStars avant de lancer un run).'
    );
    return false;
  };

  const getEffectiveLimitMs = (baseMs: number) => {
    if (arena.antiTilt.clockMultiplier === 0) return 120000; // plafond sécurité 2 min en "Sans limite"
    return Math.round(baseMs * arena.antiTilt.clockMultiplier);
  };

  const startMathsDuelL0 = async (countOverride?: number, kind: ActiveRunSession['kind'] = 'duel_l0') => {
    if (!requireAttestation()) return;
    setStatusBanner(null);
    setDebrief(null);
    const seed = kind === 'onboarding_l0' ? 'premiere-experience-6' : seedInput.trim() || `kt-${Date.now()}`;
    const count = countOverride ?? spotCount;
    const { templates, seriesRef } = await selectCorpusSeries('maths_icm', count, seed, true);
    const publicSpots = toPublicSpots(templates).map((sp) => ({
      ...sp,
      limitMs: getEffectiveLimitMs(sp.limitMs),
    }));
    const base = await buildReferenceBaseline(templates, seed);
    const now = performance.now();
    const run = reduce(
      newRun(publicSpots.map((s) => s.limitMs)),
      { t: 'OPEN', i: 0, now }
    );
    setNowMs(now);
    setSession({
      matchId: makeUuid(),
      kind,
      league: 'maths_icm',
      seriesRef,
      templates,
      publicSpots,
      run,
      hintsUsed: new Array(templates.length).fill(false),
      certaintyMarks: new Array(templates.length).fill(null),
      estimateValue: 50,
      currentCertainty: 'sur',
      lockedBanner: false,
      showHint: false,
      baselineLabel: base.label,
      baselineScores: base.scores,
      ghostCreatorPseudo: null,
      ghostCreatorRecords: null,
      dailyBundle: null,
      dailyCount: 0,
    });
  };

  const startImportedGhostL0 = async () => {
    if (!requireAttestation()) return;
    if (!decodedGhost) {
      setGhostError('Importez un code KT2. ou fichier .ktghost valide.');
      return;
    }
    setStatusBanner(null);
    setDebrief(null);
    const templates = resolveTemplatesByIds(decodedGhost.series.templateIds);
    const publicSpots = toPublicSpots(templates).map((sp) => ({
      ...sp,
      limitMs: getEffectiveLimitMs(sp.limitMs),
    }));
    const now = performance.now();
    const run = reduce(
      newRun(publicSpots.map((s) => s.limitMs)),
      { t: 'OPEN', i: 0, now }
    );
    setNowMs(now);
    setSession({
      matchId: makeUuid(),
      kind: 'duel_l0',
      league: decodedGhost.league,
      seriesRef: decodedGhost.series,
      templates,
      publicSpots,
      run,
      hintsUsed: new Array(templates.length).fill(false),
      certaintyMarks: new Array(templates.length).fill(null),
      estimateValue: 50,
      currentCertainty: 'sur',
      lockedBanner: false,
      showHint: false,
      baselineLabel: `${decodedGhost.creatorPseudo} (Ghost L0 non vérifié)`,
      baselineScores: [],
      ghostCreatorPseudo: decodedGhost.creatorPseudo,
      ghostCreatorRecords: decodedGhost.creatorResults?.records ?? null,
      dailyBundle: null,
      dailyCount: 0,
    });
  };

  const startDailyLocalL0 = async () => {
    if (!requireAttestation()) return;
    setStatusBanner(null);
    setDebrief(null);
    const bundle = dailyLocal ?? (await composeLocalDaily(Date.now()));
    const publicSpots = toPublicSpots(bundle.templates).map((sp) => ({
      ...sp,
      limitMs: getEffectiveLimitMs(sp.limitMs),
    }));
    const base = await buildReferenceBaseline(bundle.templates, bundle.dayKey);
    const now = performance.now();
    const run = reduce(
      newRun(publicSpots.map((s) => s.limitMs)),
      { t: 'OPEN', i: 0, now }
    );
    setNowMs(now);
    setSession({
      matchId: makeUuid(),
      kind: 'daily_l0',
      league: 'maths_icm',
      seriesRef: {
        seed: bundle.dayKey,
        corpusVersion: 'mp-corpus-maths-v1',
        generatorVersion: 'mp-gen-v1',
        rulesVersion: 'mp-rules-1',
        templateIds: bundle.templates.map((t) => t.id),
      },
      templates: bundle.templates,
      publicSpots,
      run,
      hintsUsed: new Array(bundle.templates.length).fill(false),
      certaintyMarks: new Array(bundle.templates.length).fill(null),
      estimateValue: 50,
      currentCertainty: 'sur',
      lockedBanner: false,
      showHint: false,
      baselineLabel: base.label,
      baselineScores: base.scores,
      ghostCreatorPseudo: null,
      ghostCreatorRecords: null,
      dailyBundle: bundle,
      dailyCount: 0,
    });
  };

  const handleDecodeGhostText = async (textToDecode = ghostInput) => {
    try {
      const res = await decodeGhostV2(textToDecode);
      setDecodedGhost(res);
      setGhostError(null);
    } catch (err: unknown) {
      setDecodedGhost(null);
      setGhostError(err instanceof Error ? err.message : 'Code KT2. invalide');
    }
  };

  const handleKtghostFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    void file.text().then((content) => {
      setGhostInput(content);
      void handleDecodeGhostText(content);
    });
  };

  const downloadKtghostFile = (token: string) => {
    const blob = new Blob([token], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `defi-${new Date().toISOString().slice(0, 10)}.ktghost`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePreviewAndShareHand = () => {
    try {
      const src = parseRawToSourceHand(rawHandInput);
      const clean = toShared(src, Date.now());
      const tags = shareTagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 3);
      setSharedPreviewJson(JSON.stringify({ tags, hand: clean }, null, 2));
      setShareError(null);

      if (!arena.ecurie) {
        setShareError('Créez d’abord votre écurie pour publier cette main.');
        return;
      }
      updateArena((prev) => ({
        ...prev,
        ecurie: prev.ecurie
          ? {
              ...prev.ecurie,
              sharedHands: [
                {
                  id: makeUuid(),
                  sharedAt: new Date().toISOString(),
                  note: shareNoteInput.trim() || 'Discussion technique non notée',
                  tags,
                  hand: clean,
                },
                ...prev.ecurie.sharedHands,
              ].slice(0, 20),
            }
          : null,
      }));
      setStatusBanner('✅ Main vérifiée (> 24h), pseudonymisée par liste blanche et ajoutée au mur de l’écurie.');
    } catch (err: unknown) {
      setSharedPreviewJson(null);
      setShareError(err instanceof Error ? err.message : 'Main invalide ou jouée il y a moins de 24 h.');
    }
  };

  // Drapeau mpEnabled coupé (MP-01) : n'altère rien de la V2 solo
  if (!mpActive) {
    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 text-center space-y-3">
        <h2 className="text-base font-extrabold text-white">Mode Multijoueur désactivé (`mpEnabled = false`)</h2>
        <p className="text-xs text-slate-400">
          La suite solo V1/V2 fonctionne de manière inchangée. Vous pouvez réactiver le jalon M0 Local à tout moment.
        </p>
        <button
          type="button"
          onClick={() => {
            setMpEnabledFlag(true);
            setMpActive(true);
          }}
          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold"
        >
          Réactiver le mode multijoueur (M0 Local)
        </button>
      </div>
    );
  }

  // =========================================================================
  // RENDER: ACTIVE RUN (M0 LOCAL — AUCUNE CORRECTION AVANT LA FIN)
  // =========================================================================
  if (session && session.run.phase.s === 'open') {
    const idx = session.run.phase.i;
    const spot = session.publicSpots[idx];
    const remainingMs = Math.max(0, Math.round(session.run.phase.deadline - nowMs));
    const pct = Math.min(100, Math.round((remainingMs / spot.limitMs) * 100));
    const lastQuarter = pct <= 25;

    return (
      <div className="space-y-4">
        <div className="bg-amber-950/40 border border-amber-500/40 rounded-2xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-200">
          <div className="flex items-center gap-2 font-semibold">
            <Lock className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Run en cours (L0 local) — Calculateurs, explorateur de ranges et Coach IA verrouillés. Aucune correction avant la fin.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              reduce(session.run, { t: 'FORFEIT' });
              setSession(null);
              setStatusBanner('Série abandonnée.');
            }}
            className="min-h-[36px] px-3 py-1 rounded-lg bg-slate-900 hover:bg-rose-950 border border-slate-700 text-rose-300 font-bold"
          >
            Abandonner
          </button>
        </div>

        <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-5 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono text-xs font-extrabold">
                Spot {idx + 1} / {session.publicSpots.length}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 text-xs font-mono">
                {spot.family}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-sky-500/15 text-sky-300 border border-sky-500/30 text-[11px] font-bold">
                L0 Hors-ligne
              </span>
            </div>
            <span
              className={`px-3 py-1 rounded-xl font-mono text-xs font-extrabold transition ${
                lastQuarter
                  ? 'bg-rose-950 border-2 border-rose-400 text-rose-200'
                  : 'bg-slate-950 border border-slate-700 text-white'
              }`}
            >
              ⏱ {(remainingMs / 1000).toFixed(1)}s {lastQuarter ? '• Dernier quart !' : ''}
            </span>
          </div>

          <div className="w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800 h-2.5">
            <div
              className={`h-full transition-all duration-100 ${lastQuarter ? 'bg-rose-500' : 'bg-emerald-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>

          {spot.state.kind === 'estimate' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              <div className="lg:col-span-7 space-y-3">
                <p className="text-sm sm:text-base font-bold text-white leading-relaxed">
                  {spot.state.question}
                </p>
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-1">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-sky-400">
                    Hypothèses explicites
                  </div>
                  <ul className="list-disc list-inside text-xs text-slate-300 space-y-0.5">
                    {spot.state.assumptions.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="lg:col-span-5 bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-300">Votre estimation (%)</span>
                  <button
                    type="button"
                    onClick={() => {
                      const nextHints = [...session.hintsUsed];
                      nextHints[idx] = true;
                      setSession({ ...session, hintsUsed: nextHints, showHint: true });
                    }}
                    className="px-2 py-1 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-bold"
                  >
                    💡 Indice (+150 PD amical)
                  </button>
                </div>

                {session.showHint && (
                  <div className="text-xs text-amber-200 bg-amber-950/40 border border-amber-500/30 rounded-xl p-2.5">
                    Formule de repère : comparez vos cotes de pot ou bloqueurs à la référence sans calculatrice (marge ±1,5 pt = 0 PD).
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={spot.state.min}
                      max={spot.state.max}
                      step={spot.state.step}
                      value={session.estimateValue}
                      onChange={(e) => setSession({ ...session, estimateValue: Number(e.target.value) })}
                      className="flex-1 accent-emerald-500"
                    />
                    <input
                      type="number"
                      min={spot.state.min}
                      max={spot.state.max}
                      step={spot.state.step}
                      value={session.estimateValue}
                      onChange={(e) => setSession({ ...session, estimateValue: Number(e.target.value) })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          lockSpotAnswer(String(session.estimateValue));
                        }
                      }}
                      className="w-24 bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-sm font-mono font-extrabold text-emerald-300 text-right"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold text-slate-400">
                    Marqueur de certitude (sans effet sur le score, Bible p.18)
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSession({ ...session, currentCertainty: 'sur' })}
                      className={`min-h-[44px] rounded-xl border text-xs font-bold ${
                        session.currentCertainty === 'sur'
                          ? 'bg-emerald-600/30 border-emerald-400 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      ✓ Sûr de mon calcul
                    </button>
                    <button
                      type="button"
                      onClick={() => setSession({ ...session, currentCertainty: 'hesitant' })}
                      className={`min-h-[44px] rounded-xl border text-xs font-bold ${
                        session.currentCertainty === 'hesitant'
                          ? 'bg-amber-600/30 border-amber-400 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      ? Hésitant
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => lockSpotAnswer(String(session.estimateValue))}
                  className="w-full min-h-[44px] py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-extrabold transition shadow-lg"
                >
                  Verrouiller {session.estimateValue}% (Entrée)
                </button>
              </div>
            </div>
          )}

          {spot.state.kind === 'decision' && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {spot.state.heroCards.map((c) => (
                  <PokerCardChip key={c} card={c} />
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {spot.state.options.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => lockSpotAnswer(opt.id)}
                    className="min-h-[44px] px-4 py-3 rounded-xl bg-slate-950 hover:bg-emerald-600/20 border border-slate-700 text-sm font-bold text-white"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER: DEBRIEFING (MP-08)
  // =========================================================================
  const renderDebrief = () => {
    if (!debrief) return null;
    const tpAll = turningPoints(debrief.heroScores, debrief.baselineScores);
    const tpShown = showAllTurningPoints ? tpAll : tpAll.slice(0, 3);
    const fullUrl =
      debrief.ghostToken && !debrief.ghostIsLarge && typeof window !== 'undefined'
        ? `${window.location.origin}${window.location.pathname}?challenge=${debrief.ghostToken}`
        : '';

    const rankedPairs = debrief.templates
      .map((t, i) => ({
        t,
        i,
        sc: debrief.heroScores[i],
        rec: debrief.heroRecords[i],
        cert: debrief.certaintyMarks[i],
      }))
      .sort((a, b) => a.sc.pd - b.sc.pd);

    const bestChoice = rankedPairs[0];
    const worstMistakes = [...rankedPairs]
      .filter((x) => x.sc.pd > 0)
      .sort((a, b) => {
        const aSure = a.cert === 'sur' ? 1 : 0;
        const bSure = b.cert === 'sur' ? 1 : 0;
        return bSure - aSure || b.sc.pd - a.sc.pd;
      });
    const ruleToRework = worstMistakes[0] ?? rankedPairs[rankedPairs.length - 1];

    const verdictLabel =
      debrief.outcome === 1
        ? 'Meilleure précision que la référence (L0 hors MMR)'
        : debrief.outcome === 0.5
          ? `Égalité dans la bande de nul (≤ ${DRAW_BAND_PD} PD)`
          : 'En dessous de la référence sur cette série (L0 hors MMR)';

    return (
      <div className="bg-slate-900/95 border border-slate-700 rounded-2xl p-4 sm:p-6 space-y-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-xl bg-sky-500/15 text-sky-300 border border-sky-500/30 text-xs font-extrabold">
              L0 Local Hors-Ligne (sans effet MMR)
            </span>
            <span className="text-sm font-extrabold text-white">
              Total : {debrief.heroTotals.pd} PD • {debrief.heroTotals.perfects}/{debrief.templates.length} Perfects •{' '}
              {(debrief.heroTotals.ms / 1000).toFixed(1)}s
            </span>
          </div>
          <button
            type="button"
            onClick={() => setDebrief(null)}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200"
          >
            Fermer
          </button>
        </div>

        {/* 3 blocs obligatoires du verdict (Bible p.27) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 space-y-1">
            <div className="text-[10px] font-bold uppercase text-sky-400">1. Résultat</div>
            <div className="font-bold text-white">{verdictLabel}</div>
            <div className="font-mono text-slate-400">
              Vous : {debrief.heroTotals.pd} PD vs {debrief.baselineTotals.pd} PD
            </div>
          </div>

          <div className="bg-emerald-950/25 border border-emerald-500/30 rounded-xl p-3 space-y-1">
            <div className="text-[10px] font-bold uppercase text-emerald-400">2. Une décision réussie</div>
            <div className="font-bold text-white">Spot #{bestChoice.i + 1} ({bestChoice.t.family})</div>
            <div className="text-slate-300">
              {formatPdInUnit(bestChoice.sc.pd, bestChoice.rec.lossUnit)} — {bestChoice.t.explanationText}
            </div>
          </div>

          <div className="bg-rose-950/25 border border-rose-500/30 rounded-xl p-3 space-y-1">
            <div className="text-[10px] font-bold uppercase text-rose-400">3. Une règle à retravailler</div>
            <div className="font-bold text-white">
              Spot #{ruleToRework.i + 1} ({ruleToRework.cert === 'sur' ? '⚠️ Erreur avec certitude « Sûr »' : ruleToRework.t.family})
            </div>
            <div className="text-slate-300">
              {formatPdInUnit(ruleToRework.sc.pd, ruleToRework.rec.lossUnit)} — {ruleToRework.t.explanationText}
            </div>
          </div>
        </div>

        {arena.antiTilt.consecutiveLosses >= 3 && (
          <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-3 text-xs text-amber-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Protection anti-tilt : 3 séries en dessous de la référence d’affilée. Prenez 2 minutes de pause ou révisez vos erreurs avant de relancer.
            </span>
          </div>
        )}

        {debrief.anomaly.flagged && (
          <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-200">
            ℹ️ {debrief.anomaly.reason} (signal informatif uniquement, aucune sanction automatique).
          </div>
        )}

        <EvCurveChart
          heroScores={debrief.heroScores}
          oppScores={debrief.baselineScores}
          oppLabel={debrief.baselineLabel}
        />

        {debrief.dailyMedals.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 bg-amber-950/30 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-200">
            <Award className="w-4 h-4 text-amber-400" />
            <span>Médailles (Daily local) :</span>
            {debrief.dailyMedals.map((m) => (
              <span key={m} className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 font-bold">
                {m === 'chirurgien' ? '🩺 Chirurgien (0 PD)' : '⚡ Éclair (< 50 PD & < 2.5s)'}
              </span>
            ))}
          </div>
        )}

        {debrief.newlyCompletedQuests.length > 0 && (
          <div className="text-xs font-bold text-amber-300 bg-amber-950/20 border border-amber-500/30 rounded-xl p-2.5">
            🎯 Quête(s) validée(s) : {debrief.newlyCompletedQuests.join(', ')} (aucun changement direct sur vos leaks importés).
          </div>
        )}

        {/* Turning Points strict > 100 PD (3 plus grands puis liste complète) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Turning Points (écart strict &gt; 100 PD • {tpAll.length} détecté(s))
            </h4>
            {tpAll.length > 3 && (
              <button
                type="button"
                onClick={() => setShowAllTurningPoints((v) => !v)}
                className="text-xs font-bold text-sky-400 hover:text-sky-300"
              >
                {showAllTurningPoints ? 'Réduire aux 3 plus grands' : `Voir les ${tpAll.length} Turning Points`}
              </button>
            )}
          </div>
          {tpShown.length === 0 ? (
            <div className="text-xs text-slate-400 bg-slate-950/70 border border-slate-800 rounded-xl p-3">
              Aucun Turning Point supérieur à 100 PD sur cette série.
            </div>
          ) : (
            <div className="space-y-2">
              {tpShown.map((tp) => {
                const t = debrief.templates[tp.spotIndex];
                const sol = t.solution;
                const refTxt = sol.kind === 'estimate' ? `${sol.truthPct}% (±${sol.tolerance})` : t.unitLabel;
                return (
                  <div
                    key={t.id}
                    className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 text-xs space-y-1"
                  >
                    <div className="flex flex-wrap justify-between gap-2 font-bold">
                      <span className="text-white">
                        Spot #{tp.spotIndex + 1} • {t.family} (Δ {tp.diff} PD)
                      </span>
                      <span className="font-mono text-amber-300">
                        Vous : {tp.heroPd} PD | Adv : {tp.oppPd} PD
                      </span>
                    </div>
                    <div className="text-slate-300">{t.explanationText}</div>
                    <div className="text-[10px] text-slate-500">
                      Référence : {refTxt} • Provenance : {t.provenance.origin} ({t.provenance.confidence})
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Ghost amical KT2. + .ktghost */}
        {debrief.ghostToken && (
          <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-sky-300">
                👻 Ghost Amical KT2. — Non vérifié (L0 hors-ligne, spoil/falsification possibles)
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(debrief.ghostToken!);
                    setStatusBanner('Code KT2. copié dans le presse-papiers !');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white inline-flex items-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5" /> Copier code KT2.
                </button>
                {!debrief.ghostIsLarge ? (
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(fullUrl);
                      setStatusBanner('Lien ?challenge=KT2... copié !');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-bold text-white inline-flex items-center gap-1"
                  >
                    <Share2 className="w-3.5 h-3.5" /> Copier URL
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => downloadKtghostFile(debrief.ghostToken!)}
                    className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-xs font-bold text-white inline-flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" /> Télécharger .ktghost (&gt; 2000 car.)
                  </button>
                )}
              </div>
            </div>
            <input
              type="text"
              readOnly
              value={debrief.ghostToken}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[10px] font-mono text-slate-400"
            />
          </div>
        )}

        {/* 6 réactions prédéfinies post-match uniquement (désactivables) */}
        {arena.antiTilt.reactionsEnabled && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] text-slate-400 mr-1">Réaction post-match :</span>
            {REACTION_CHOICES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setDebrief({ ...debrief, selectedReaction: r })}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                  debrief.selectedReaction === r
                    ? 'bg-emerald-600/30 border-emerald-400 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  // =========================================================================
  // MAIN M0 LOCAL ARENA VIEW
  // =========================================================================
  return (
    <div className="space-y-6">
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
                <Swords className="w-5 h-5 text-emerald-400" />
                Arène Multijoueur — Jalon M0 Local
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30">
                L0 Hors-ligne • Sans serveur • Sans MMR
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Sans variance de tirage entre adversaires. Toutes les vérités de la ligue Maths &amp; ICM sont calculées exactement par les moteurs purs V2.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={arena.pseudo}
              maxLength={24}
              onChange={(e) => updateArena((p) => ({ ...p, pseudo: e.target.value }))}
              className="bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-white w-36"
              aria-label="Pseudo du joueur"
            />
            <button
              type="button"
              onClick={() =>
                updateArena((p) => ({
                  ...p,
                  antiTilt: { ...p.antiTilt, soundEnabled: !p.antiTilt.soundEnabled },
                }))
              }
              className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:text-white"
              title="Activer / couper le son"
            >
              {arena.antiTilt.soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => {
                setMpEnabledFlag(false);
                setMpActive(false);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-bold text-slate-400 hover:text-white"
            >
              Couper MP
            </button>
          </div>
        </div>

        {/* Engagement Anti-RTA (Bible p.14 & p.32 — sans promesse de conformité garantie) */}
        <label className="flex items-start gap-2.5 bg-slate-950/80 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-200/90 cursor-pointer">
          <input
            type="checkbox"
            checked={arena.antiTilt.roomClosedAttested}
            onChange={(e) =>
              updateArena((p) => ({
                ...p,
                antiTilt: { ...p.antiTilt, roomClosedAttested: e.target.checked },
              }))
            }
            className="mt-0.5 accent-amber-500"
          />
          <span>
            <strong>Engagement d’étude hors session :</strong> je m’engage à fermer cette application lorsqu’un client de poker (Winamax, PokerStars…) est ouvert. Les calculateurs et le Coach IA restent bloqués pendant tout run (mesure de réduction du risque, sans garantie réglementaire automatique).
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/90 border border-slate-800 rounded-2xl p-1.5">
          {(
            [
              ['duel', '⚔️ Duel & Ghost Amical (L0)'],
              ['aws', '☁️ Cloud AWS (L0)'],
              ['l1', '🌐 Classé L1 & Daily Officiel'],
              ['games', '🎨 Fresque & Salve (MP-19)'],
              ['daily', '🏆 Daily Local (L0)'],
              ['elo', '📊 Ligues & Journal FSRS V3'],
              ['quests', '🎯 Quêtes & Écuries'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${
                activeTab === id ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {statusBanner && (
          <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl px-3 py-2 text-xs text-emerald-200 flex items-center justify-between">
            <span>{statusBanner}</span>
            <button type="button" onClick={() => setStatusBanner(null)} className="text-slate-400 hover:text-white">
              ✕
            </button>
          </div>
        )}
      </div>

      {renderDebrief()}

      {/* TAB 1: DUEL & GHOST L0 */}
      {activeTab === 'duel' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
            {!arena.antiTilt.firstExperienceDone && (
              <div className="bg-sky-950/40 border border-sky-500/40 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div>
                  <div className="font-extrabold text-sky-200">🎓 Première expérience guidée (6 spots)</div>
                  <div className="text-slate-300">
                    Testez les Points de Déviation (PD) contre un adversaire de référence étiqueté, sans MMR.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void startMathsDuelL0(6, 'onboarding_l0')}
                  className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-extrabold"
                >
                  Démarrer (6 spots)
                </button>
              </div>
            )}

            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <Play className="w-4 h-4 text-emerald-400" />
              Série Déterministe &amp; Ghost Amical KT2. (L0 Hors-ligne)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">Ligue</label>
                <select
                  value={league}
                  onChange={(e) => setLeague(e.target.value as League)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs font-bold text-white"
                >
                  {leagueStatuses.map((ls) => (
                    <option key={ls.league} value={ls.league} disabled={!ls.rankedOpen}>
                      {ls.label} {ls.rankedOpen ? `(${ls.eligibleCount} gabarits)` : '— Bientôt'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">Spots (60/25/15%)</label>
                <select
                  value={spotCount}
                  onChange={(e) => setSpotCount(Number(e.target.value) as 12 | 15 | 20)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs font-bold text-white"
                >
                  <option value={12}>12 spots (7/3/2)</option>
                  <option value={15}>15 spots (9/4/2)</option>
                  <option value={20}>20 spots (12/5/3)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">Horloge (Accessibilité)</label>
                <select
                  value={arena.antiTilt.clockMultiplier}
                  onChange={(e) =>
                    updateArena((p) => ({
                      ...p,
                      antiTilt: { ...p.antiTilt, clockMultiplier: Number(e.target.value) as 1 | 1.5 | 0 },
                    }))
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs font-bold text-white"
                >
                  <option value={1}>×1 Standard (20s)</option>
                  <option value={1.5}>×1.5 Confort (30s)</option>
                  <option value={0}>Sans limite (amical)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">Graine (Seed)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={seedInput}
                  onChange={(e) => setSeedInput(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white"
                />
                <button
                  type="button"
                  onClick={() => setSeedInput(`kt-${Date.now().toString(36)}`)}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200"
                >
                  🎲 Aléatoire
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void startMathsDuelL0()}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-extrabold shadow-lg transition flex items-center justify-center gap-2"
            >
              <Swords className="w-4 h-4" />
              Lancer une série L0 Maths &amp; ICM ({spotCount} spots)
            </button>

            <div className="border-t border-slate-800 pt-4 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-sky-300">
                  Importer un Ghost Amical (`KT2.` ou fichier `.ktghost`)
                </span>
                <div className="flex gap-2">
                  <label className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 cursor-pointer inline-flex items-center gap-1">
                    <Upload className="w-3.5 h-3.5" /> .ktghost
                    <input type="file" accept=".ktghost,.txt" onChange={handleKtghostFileUpload} className="hidden" />
                  </label>
                  <button
                    type="button"
                    onClick={() => void handleDecodeGhostText()}
                    className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-bold text-white"
                  >
                    Valider Zod
                  </button>
                </div>
              </div>
              <textarea
                rows={2}
                value={ghostInput}
                onChange={(e) => setGhostInput(e.target.value)}
                placeholder="Collez ici un code KT2.... ou chargez un fichier .ktghost"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-[11px] font-mono text-white"
              />
              {ghostError && <div className="text-xs text-rose-400">{ghostError}</div>}
              {decodedGhost && (
                <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 text-emerald-200">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      Défi L0 de <strong>{decodedGhost.creatorPseudo}</strong> ({decodedGhost.series.templateIds.length} spots) —{' '}
                      <strong>Non vérifié (L0 hors-ligne)</strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void startImportedGhostL0()}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold"
                  >
                    Relever ce Ghost
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
            <h3 className="text-sm font-extrabold text-white">Statut des Ligues (Seuil : 150 gabarits sourcés)</h3>
            <div className="space-y-2 text-xs">
              {leagueStatuses.map((ls) => (
                <div
                  key={ls.league}
                  className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between gap-2"
                >
                  <div>
                    <div className="font-bold text-white">{ls.label}</div>
                    <div className="text-[10px] font-mono text-slate-400">
                      {ls.eligibleCount} éligibles ({ls.frontierCount}F/{ls.transferCount}T/{ls.mixedCount}M • {ls.familyCount} familles)
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      ls.rankedOpen
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {ls.rankedOpen ? 'Prête (L1 en M1)' : 'Bientôt'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB AWS : CLOUD AMICAL L0 (AWS ktp-backend + IndexedDB) */}
      {activeTab === 'aws' && (
        <AwsCloudPanel
          roomClosedAttested={arena.antiTilt.roomClosedAttested}
          onRunLockChange={setL1RunLocked}
          onRequireAttestation={() =>
            setStatusBanner(
              'Confirmez d’abord l’engagement d’étude hors session (room de poker fermée) avant de démarrer un défi Cloud AWS.'
            )
          }
        />
      )}

      {/* TAB L1 : CLASSE L1 & DAILY OFFICIEL (MP-12..MP-18) */}
      {activeTab === 'l1' && (
        <RankedL1Panel
          roomClosedAttested={arena.antiTilt.roomClosedAttested}
          masteryM={masteryM}
          onRunLockChange={setL1RunLocked}
          onRequireAttestation={() =>
            setStatusBanner(
              'Confirmez d’abord l’engagement d’étude hors session (room de poker fermée) avant de démarrer en L1.'
            )
          }
        />
      )}

      {/* TAB GAMES : FRESQUE DUEL & SALVE 3-MAX (MP-19) */}
      {activeTab === 'games' && (
        <div className="space-y-5">
          <FresqueDuelPanel />
          <SalvePanel />
        </div>
      )}

      {/* TAB 2: DAILY LOCAL L0 */}
      {activeTab === 'daily' && dailyLocal && (
        <div className="bg-slate-900/90 border border-amber-500/30 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Flame className="w-5 h-5 text-amber-400" />
                {dailyLocal.label}
              </h3>
              <p className="text-xs text-slate-400">
                15 spots exacts (cotes/outs, bloqueurs/combos, ICM/PKO). En M0 hors-ligne : aucun leaderboard officiel ni fausse statistique communautaire ; Spot Piège masqué sous 30 réponses serveur.
              </p>
            </div>
            {arena.dailyLocalRuns[dailyLocal.dayKey] && (
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-xs font-mono text-emerald-300">
                Meilleur local : {arena.dailyLocalRuns[dailyLocal.dayKey].bestPd} PD ({arena.dailyLocalRuns[dailyLocal.dayKey].bestPerfects}/15)
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => void startDailyLocalL0()}
            className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-extrabold shadow-lg transition flex items-center justify-center gap-2"
          >
            <Zap className="w-4 h-4" />
            Lancer le Daily local d’entraînement (15 spots)
          </button>
        </div>
      )}

      {/* TAB 3: LIGUES, FSRS V3 & HISTORIQUE L0 */}
      {activeTab === 'elo' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
            <h3 className="text-sm font-extrabold text-white">Intégration FSRS V3 &amp; Score M ({masteryM}%)</h3>
            <div className="grid grid-cols-3 gap-2 text-center font-mono text-xs">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                <div className="text-[10px] text-amber-400 font-bold">PROVISIONAL</div>
                <div className="text-lg font-extrabold text-white mt-0.5">{reviewCounts.provisionalSuccesses}</div>
                <div className="text-[9px] text-slate-500">Hors M (&lt;7j)</div>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                <div className="text-[10px] text-emerald-400 font-bold">CONFIRMED</div>
                <div className="text-lg font-extrabold text-white mt-0.5">{reviewCounts.confirmedSuccesses}</div>
                <div className="text-[9px] text-slate-500">Validés à froid</div>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                <div className="text-[10px] text-rose-400 font-bold">ÉCHECS</div>
                <div className="text-lg font-extrabold text-white mt-0.5">{reviewCounts.failures}</div>
                <div className="text-[9px] text-slate-500">Comptés direct</div>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Conformément à la Bible (p.8), toute réussite multijoueur met à jour FSRS mais reste <code className="text-amber-300">provisional</code> sans compter dans M avant une confirmation solo à froid à +7 jours.
            </p>
            <div className="pt-1 space-y-1.5 text-xs">
              {DIVISIONS.map((d) => {
                const cur = division(arena.ratings.maths_icm.r, {
                  mastery: masteryM,
                  bossValidated: arena.gates.bossValidated,
                  retention7dVerified: arena.gates.retention7dVerified,
                });
                return (
                  <div
                    key={d.id}
                    className={`flex justify-between px-3 py-1.5 rounded-lg border ${
                      cur === d.id
                        ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                        : 'bg-slate-950/70 border-slate-800 text-slate-400'
                    }`}
                  >
                    <span className="font-bold">{DIVISION_LABELS[d.id]}</span>
                    <span className="font-mono text-[11px]">
                      {d.min === -Infinity ? '< 1100' : `≥ ${d.min}`} • M ≥ {d.mastery}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="text-[10px] text-slate-500">
              MMR de départ : {GLICKO.r0} ± {GLICKO.rd0}. Aucun match L0 ne modifie le MMR avant le serveur L1 (jalon M1).
            </div>
          </div>

          <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <History className="w-4 h-4 text-sky-400" />
                Historique Local L0 ({arena.localRuns.length}) &amp; Journal V3 ({arena.reviewLog.length})
              </h3>
              <button
                type="button"
                onClick={() => {
                  const targetSkill = arena.reviewLog.find((e) => e.confirmation === 'provisional')?.skillId;
                  if (!targetSkill) return;
                  updateArena((p) => ({
                    ...p,
                    reviewLog: confirmProvisionalReviews(
                      p.reviewLog,
                      targetSkill,
                      Date.now() + FSRS_THRESHOLDS.confirmDelayMs
                    ),
                  }));
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-200"
                title="Simuler une confirmation solo à froid à J+7 pour le contrôle M0"
              >
                Vérifier confirmation +7j
              </button>
            </div>
            {arena.localRuns.length === 0 ? (
              <div className="text-xs text-slate-400 bg-slate-950/70 border border-slate-800 rounded-xl p-4">
                Aucune série locale jouée pour le moment.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1 text-xs font-mono">
                {arena.localRuns.map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-wrap justify-between gap-2 bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2"
                  >
                    <span className="text-slate-200">
                      [{r.integrity}] {r.league} • {r.seed}
                    </span>
                    <span className="text-emerald-300">
                      {r.heroPd} PD ({r.heroPerfects} perf.) • {(r.heroMs / 1000).toFixed(1)}s
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: QUETES & ECURIES (ZERO STAKING / ZERO ARGENT) */}
      {activeTab === 'quests' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              3 Quêtes Actives Anti-Leaks (sans expiration)
            </h3>
            <div className="space-y-2.5">
              {DEFAULT_ARENA_QUESTS.map((q) => {
                const prog = arena.quests[q.id] ?? { seen: [], window: [], done: false };
                const pct = prog.done ? 100 : Math.min(100, Math.round((prog.window.length / q.target) * 100));
                const meanPd = prog.window.length
                  ? Math.round(prog.window.reduce((a, b) => a + b, 0) / prog.window.length)
                  : 0;
                return (
                  <div
                    key={q.id}
                    className={`rounded-xl border p-3 space-y-1.5 ${
                      prog.done ? 'bg-emerald-950/30 border-emerald-500/40' : 'bg-slate-950/80 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-extrabold text-white flex items-center gap-1.5">
                        {prog.done && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                        {q.title}
                      </span>
                      <span className="font-mono text-[11px] text-amber-300">+{q.xpReward} XP</span>
                    </div>
                    <p className="text-[11px] text-slate-400">{q.description}</p>
                    <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex justify-between text-[10px] font-mono text-slate-400">
                      <span>{prog.done ? 'Validée !' : `${prog.window.length}/${q.target} spots`}</span>
                      <span>Moy. fenêtre : {meanPd} PD (max {q.maxMeanPd})</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-7 space-y-5">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-sky-400" />
                Écurie d’Entraide (4–20 membres • sans argent ni mise)
              </h3>
              {!arena.ecurie ? (
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={ecurieNameInput}
                    onChange={(e) => setEcurieNameInput(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      updateArena((p) => ({
                        ...p,
                        ecurie: createDefaultEcurie(p.pseudo, 'apprenti', ecurieNameInput),
                      }))
                    }
                    className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-extrabold"
                  >
                    Créer mon Écurie
                  </button>
                </div>
              ) : (
                <div className="space-y-2 text-xs">
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex justify-between">
                    <span className="font-extrabold text-white">{arena.ecurie.name}</span>
                    <span className="font-mono text-slate-400">
                      {arena.ecurie.members.length}/20 membres • Cible L1 (en M3) : 100×N révisions
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-extrabold text-white">
                    🛡️ Partage de Main par Liste Blanche (`share.ts` • ≥ 24h)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Pseudonymisation uniquement (non anonymisation absolue) : remplace les noms par BTN/SB/BB, arrondit à 0,5 bb et bloque toute main datant de moins de 24 h.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRawHandInput(SAMPLE_OLD_WINAMAX_HAND)}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200"
                >
                  📋 Exemple Winamax (&gt; 24h)
                </button>
              </div>

              <textarea
                rows={4}
                value={rawHandInput}
                onChange={(e) => setRawHandInput(e.target.value)}
                placeholder="Collez une main Winamax/PokerStars jouée depuis au moins 24 h..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-[11px] font-mono text-slate-200"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={shareNoteInput}
                  onChange={(e) => setShareNoteInput(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white"
                  placeholder="Question ou thème..."
                />
                <input
                  type="text"
                  value={shareTagsInput}
                  onChange={(e) => setShareTagsInput(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-mono text-white"
                  placeholder="Max 3 étiquettes (ex: cbet, flop)"
                />
              </div>
              <button
                type="button"
                onClick={handlePreviewAndShareHand}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold"
              >
                Vérifier Aperçu &amp; Publier (Discussion non notée)
              </button>

              {shareError && (
                <div className="text-xs text-rose-400 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{shareError}</span>
                </div>
              )}

              {sharedPreviewJson && (
                <pre className="bg-slate-950 border border-emerald-500/30 rounded-xl p-2.5 text-[10px] font-mono text-emerald-300 overflow-x-auto max-h-40">
                  {sharedPreviewJson}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
