import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Brain,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Flame,
  HelpCircle,
  Layers,
  LayoutGrid,
  Lock,
  Pin,
  RotateCcw,
  Scale,
  Scissors,
  SlidersHorizontal,
  Sparkles,
  Target,
  XCircle,
} from 'lucide-react';
import { PokerCardVisual } from '../../components/PokerCardVisual';
import {
  DRAWER_STEP_FREQS,
  EVOLUTIONARY_FUNNEL_SCENARIOS,
  buildBlockerDrills,
  computeDrawersForStreet,
  computeRiverArbitrator,
  computeStreetMatrixDiff,
  drawerFreqLabel,
  evaluateScalpelPruning,
  getScenarioById,
  inspectHandFunnelHistory,
  type CellDiffStatus,
  type DrawerStepFreq,
  type FunnelActionKind,
  type FunnelDrawerId,
  type MatrixCellDiff,
  type StreetMatrixDiffSummary,
} from '../../engines/evolutionaryFunnel';
import { gradeFunnelAttempt, type Grade } from '../../engines/srs';
import {
  getFunnelRetrievabilityPct,
  getScenarioProgress,
  recordFunnelFsrsReview,
  type FunnelScenarioProgress,
} from '../../stores/funnelFsrsStore';

type ViewMode = 'single' | 'compare' | 'sismographe' | 'scalpel' | 'blocker' | 'river';

const GRADE_BADGE: Record<Grade, { label: string; cls: string }> = {
  1: { label: 'Grade 1 — Again (À revoir)', cls: 'bg-rose-500/20 text-rose-200 border-rose-500/40' },
  2: { label: 'Grade 2 — Hard (Difficile)', cls: 'bg-amber-500/20 text-amber-200 border-amber-500/40' },
  3: { label: 'Grade 3 — Good (Maîtrisé)', cls: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40' },
  4: { label: 'Grade 4 — Easy (Réflexe ⚡)', cls: 'bg-sky-500/20 text-sky-200 border-sky-500/40' },
};

const ACTION_COLOR_META: Record<
  FunnelActionKind,
  {
    label: string;
    bgHex: string;
    borderClass: string;
    badgeClass: string;
    ghostBorderClass: string;
  }
> = {
  open: {
    label: 'Open / Bet',
    bgHex: '#ea580c',
    borderClass: 'border-orange-400/80',
    badgeClass: 'bg-orange-500/20 text-orange-200 border-orange-500/40',
    ghostBorderClass: 'border-orange-400/50',
  },
  cbet: {
    label: 'C-Bet',
    bgHex: '#d97706',
    borderClass: 'border-amber-400/80',
    badgeClass: 'bg-amber-500/20 text-amber-200 border-amber-500/40',
    ghostBorderClass: 'border-amber-400/50',
  },
  barrel: {
    label: 'Barrel Value/Bluff',
    bgHex: '#ea580c',
    borderClass: 'border-orange-400/80',
    badgeClass: 'bg-orange-500/20 text-orange-200 border-orange-500/40',
    ghostBorderClass: 'border-orange-400/50',
  },
  raise: {
    label: '3-Bet / Raise',
    bgHex: '#e11d48',
    borderClass: 'border-rose-400/80',
    badgeClass: 'bg-rose-500/20 text-rose-200 border-rose-500/40',
    ghostBorderClass: 'border-rose-400/50',
  },
  call: {
    label: 'Call / Défense',
    bgHex: '#059669',
    borderClass: 'border-emerald-400/80',
    badgeClass: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40',
    ghostBorderClass: 'border-emerald-400/50',
  },
  check: {
    label: 'Check',
    bgHex: '#0284c7',
    borderClass: 'border-sky-400/80',
    badgeClass: 'bg-sky-500/20 text-sky-200 border-sky-500/40',
    ghostBorderClass: 'border-sky-400/50',
  },
};

const SUIT_GLYPHS: Record<string, { sym: string; cls: string }> = {
  s: { sym: '♠', cls: 'text-slate-200' },
  h: { sym: '♥', cls: 'text-rose-400' },
  d: { sym: '♦', cls: 'text-sky-400' },
  c: { sym: '♣', cls: 'text-emerald-400' },
};

function formatCardText(card: string): string {
  if (!card || card.length < 2) return card;
  const r = card[0].toUpperCase();
  const s = SUIT_GLYPHS[card[1].toLowerCase()]?.sym ?? '';
  return `${r}${s}`;
}

function InlineCardPill({ card }: { card: string }) {
  if (!card || card.length < 2) return null;
  const r = card[0].toUpperCase();
  const suit = SUIT_GLYPHS[card[1].toLowerCase()] ?? SUIT_GLYPHS.s;
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 font-mono text-[11px] font-extrabold text-white">
      {r}
      <span className={suit.cls}>{suit.sym}</span>
    </span>
  );
}

function getActiveCellStyle(
  status: CellDiffStatus,
  action: FunnelActionKind | null,
  freqCurrent: number
): React.CSSProperties | undefined {
  if (status !== 'active' || !action) return undefined;
  const color = ACTION_COLOR_META[action].bgHex;
  if (freqCurrent >= 0.999) {
    return { backgroundColor: color };
  }
  const pct = Math.round(freqCurrent * 100);
  return {
    background: `linear-gradient(to right, ${color} 0%, ${color} ${pct}%, rgba(15, 23, 42, 0.94) ${pct}%, rgba(15, 23, 42, 0.94) 100%)`,
  };
}

function formatCombos(val: number): string {
  return Number.isInteger(val) ? String(val) : val.toFixed(1);
}

interface MemoFunnelCellProps {
  hand: string;
  status: CellDiffStatus;
  action: FunnelActionKind | null;
  preflopAction: FunnelActionKind | null;
  freqCurrent: number;
  baseCombos: number;
  activeCombos: number;
  blockedByBoard: number;
  blockingLabel: string;
  compact: boolean;
  showGhost: boolean;
  showComboCounts: boolean;
  isSelected: boolean;
  onHover: (hand: string | null) => void;
  onPin: (hand: string) => void;
}

const MemoFunnelCell = React.memo<MemoFunnelCellProps>(function MemoFunnelCell({
  hand,
  status,
  action,
  preflopAction,
  freqCurrent,
  baseCombos,
  activeCombos,
  blockedByBoard,
  blockingLabel,
  compact,
  showGhost,
  showComboCounts,
  isSelected,
  onHover,
  onPin,
}) {
  const actionMeta = action ? ACTION_COLOR_META[action] : null;
  const preMeta = preflopAction ? ACTION_COLOR_META[preflopAction] : null;

  let className =
    'hand-cell relative rounded-[4px] sm:rounded-md flex flex-col items-center justify-center font-mono font-bold border transition-all select-none overflow-hidden ';
  className += compact
    ? 'text-[8px] sm:text-[9px] leading-none '
    : 'text-[9px] sm:text-[11px] leading-tight ';

  let style: React.CSSProperties | undefined;

  if (status === 'active' && actionMeta) {
    className += `text-white ${actionMeta.borderClass} `;
    style = getActiveCellStyle(status, action, freqCurrent);
  } else if (status === 'eliminated_prev' && showGhost) {
    className += `funnel-cell-ghost text-slate-200 ${preMeta ? preMeta.ghostBorderClass : 'border-slate-500/60'} `;
  } else if (status === 'eliminated_earlier' && showGhost) {
    className += 'funnel-cell-ghost-old text-slate-400 border-slate-700/60 ';
  } else {
    className += 'bg-slate-950/90 text-slate-600 border-slate-800/70 ';
  }

  if (isSelected) {
    className += ' ring-2 ring-sky-400 z-20 scale-[1.04] ';
  }

  const titleText = `${hand} — ${formatCombos(activeCombos)}/${baseCombos} combos (${Math.round(freqCurrent * 100)}%)${
    blockedByBoard > 0 ? ` • -${blockedByBoard} bloqué(s) par ${blockingLabel}` : ''
  }`;

  return (
    <button
      type="button"
      data-hand={hand}
      data-status={status}
      onMouseEnter={() => onHover(hand)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(hand)}
      onClick={() => onPin(hand)}
      style={style}
      title={titleText}
      aria-label={titleText}
      className={className}
    >
      <span className="drop-shadow-sm">{hand}</span>
      {!compact && showComboCounts && status === 'active' && (
        <span
          className={`text-[8px] sm:text-[9px] font-mono leading-none mt-0.5 ${
            blockedByBoard > 0 ? 'text-sky-200 font-extrabold' : 'text-white/80'
          }`}
        >
          {formatCombos(activeCombos)}
          {blockedByBoard > 0 ? '✦' : ''}
        </span>
      )}
      {!compact && status === 'eliminated_prev' && showGhost && (
        <span className="text-[7px] sm:text-[8px] text-slate-300/90 leading-none">fold</span>
      )}
    </button>
  );
});

export const EvolutionaryFunnelLab: React.FC = () => {
  const [scenarioId, setScenarioId] = useState<string>(EVOLUTIONARY_FUNNEL_SCENARIOS[0].id);
  const [streetIndex, setStreetIndex] = useState<0 | 1 | 2 | 3>(2);
  const [viewMode, setViewMode] = useState<ViewMode>('single');
  const [showGhost, setShowGhost] = useState<boolean>(true);
  const [showComboCounts, setShowComboCounts] = useState<boolean>(true);
  const [hoveredHand, setHoveredHand] = useState<string | null>(null);
  const [pinnedHand, setPinnedHand] = useState<string>('KJs');

  // FSRS Progress state
  const [fsrsProgress, setFsrsProgress] = useState<FunnelScenarioProgress>(() =>
    getScenarioProgress(EVOLUTIONARY_FUNNEL_SCENARIOS[0].id)
  );
  const [retrievabilityPct, setRetrievabilityPct] = useState<number>(() =>
    getFunnelRetrievabilityPct(EVOLUTIONARY_FUNNEL_SCENARIOS[0].id)
  );

  // Mode 1 : Sismographe de Contraste
  const [sismographeChoice, setSismographeChoice] = useState<number | null>(null);
  const [sismographeRevealed, setSismographeRevealed] = useState<boolean>(false);

  // Mode 2 : Scalpel par Tiroirs
  const [scalpelStreet, setScalpelStreet] = useState<1 | 2 | 3>(2);
  const [drawerFreqs, setDrawerFreqs] = useState<Partial<Record<FunnelDrawerId, DrawerStepFreq>>>({});
  const [scalpelHintUsed, setScalpelHintUsed] = useState<boolean>(false);
  const [scalpelSubmitted, setScalpelSubmitted] = useState<{
    grade: Grade;
    overlapPct: number;
    elapsedMs: number;
  } | null>(null);
  const [scalpelTimedMode, setScalpelTimedMode] = useState<boolean>(false);
  const [scalpelSecondsLeft, setScalpelSecondsLeft] = useState<number>(20);
  const scalpelStartRef = useRef<number>(Date.now());

  // Mode 3 : L'Œil du Bloqueur (10 drills x 5s)
  const blockerDrills = useMemo(() => buildBlockerDrills(), []);
  const [blockerIdx, setBlockerIdx] = useState<number>(0);
  const [blockerScore, setBlockerScore] = useState<number>(0);
  const [blockerAnswered, setBlockerAnswered] = useState<{
    picked: number | null;
    isCorrect: boolean;
    timedOut: boolean;
  } | null>(null);
  const [blockerMsLeft, setBlockerMsLeft] = useState<number>(5000);
  const blockerStartRef = useRef<number>(Date.now());

  // Mode 4 : L'Arbitre River
  const [riverChoice, setRiverChoice] = useState<'call' | 'fold' | null>(null);
  const [riverGrade, setRiverGrade] = useState<Grade | null>(null);
  const riverStartRef = useRef<number>(Date.now());

  const lastWheelTsRef = useRef<number>(0);
  const scenario = useMemo(() => getScenarioById(scenarioId), [scenarioId]);

  const refreshFsrs = useCallback((id: string) => {
    setFsrsProgress(getScenarioProgress(id));
    setRetrievabilityPct(getFunnelRetrievabilityPct(id));
  }, []);

  useEffect(() => {
    const onOpenScenario = (ev: Event) => {
      const detail = (ev as CustomEvent<{ scenarioId?: string }>).detail;
      if (detail?.scenarioId) {
        handleScenarioChange(detail.scenarioId);
        setViewMode('scalpel');
      }
    };
    window.addEventListener('propoker-open-funnel-scenario', onOpenScenario);
    return () => window.removeEventListener('propoker-open-funnel-scenario', onOpenScenario);
  }, []);

  const allStreetDiffs = useMemo<
    readonly [
      StreetMatrixDiffSummary,
      StreetMatrixDiffSummary,
      StreetMatrixDiffSummary,
      StreetMatrixDiffSummary,
    ]
  >(
    () => [
      computeStreetMatrixDiff(scenario, 0),
      computeStreetMatrixDiff(scenario, 1),
      computeStreetMatrixDiff(scenario, 2),
      computeStreetMatrixDiff(scenario, 3),
    ],
    [scenario]
  );

  const currentDiff = allStreetDiffs[streetIndex];
  const inspectedHand = hoveredHand ?? pinnedHand;
  const handInspection = useMemo(
    () => inspectHandFunnelHistory(scenario, inspectedHand),
    [scenario, inspectedHand]
  );
  const familySummary = useMemo(
    () => handInspection.familyAtStreet(streetIndex),
    [handInspection, streetIndex]
  );

  // Scalpel evaluation in real time (< 1ms)
  const scalpelEval = useMemo(
    () => evaluateScalpelPruning(scenario, scalpelStreet, drawerFreqs),
    [scenario, scalpelStreet, drawerFreqs]
  );

  const riverAnalysis = useMemo(() => computeRiverArbitrator(scenario), [scenario]);

  const resetScalpelForStreet = useCallback((scId: string, st: 1 | 2 | 3) => {
    const sc = getScenarioById(scId);
    const specs = computeDrawersForStreet(sc, st);
    const init: Partial<Record<FunnelDrawerId, DrawerStepFreq>> = {};
    specs.forEach((d) => {
      init[d.id] = 0.5;
    });
    setDrawerFreqs(init);
    setScalpelSubmitted(null);
    setScalpelHintUsed(false);
    setScalpelSecondsLeft(20);
    scalpelStartRef.current = Date.now();
  }, []);

  useEffect(() => {
    resetScalpelForStreet(scenarioId, scalpelStreet);
  }, [scenarioId, scalpelStreet, resetScalpelForStreet]);

  // Adaptive timer for Mode 2 Scalpel (only when unlocked & enabled)
  useEffect(() => {
    if (viewMode !== 'scalpel' || !scalpelTimedMode || scalpelSubmitted) return;
    const id = setInterval(() => {
      setScalpelSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [viewMode, scalpelTimedMode, scalpelSubmitted]);

  // Auto-submit if Scalpel timer hits 0
  useEffect(() => {
    if (viewMode === 'scalpel' && scalpelTimedMode && scalpelSecondsLeft === 0 && !scalpelSubmitted) {
      handleValidateScalpel();
    }
  }, [scalpelSecondsLeft, viewMode, scalpelTimedMode, scalpelSubmitted]);

  // Timer 5s for Mode 3 Blocker Drill
  useEffect(() => {
    if (viewMode !== 'blocker' || blockerAnswered || blockerIdx >= blockerDrills.length) return;
    blockerStartRef.current = Date.now();
    setBlockerMsLeft(5000);
    const id = setInterval(() => {
      const rem = Math.max(0, 5000 - (Date.now() - blockerStartRef.current));
      setBlockerMsLeft(rem);
      if (rem === 0) {
        clearInterval(id);
        setBlockerAnswered({ picked: null, isCorrect: false, timedOut: true });
      }
    }, 100);
    return () => clearInterval(id);
  }, [viewMode, blockerIdx, blockerAnswered, blockerDrills.length]);

  const stepStreet = useCallback((delta: -1 | 1) => {
    setStreetIndex((prev) => {
      const next = Math.max(0, Math.min(3, prev + delta));
      return next as 0 | 1 | 2 | 3;
    });
  }, []);

  const handleScenarioChange = (nextId: string) => {
    setScenarioId(nextId);
    setHoveredHand(null);
    const nextScenario = getScenarioById(nextId);
    setPinnedHand(nextScenario.quizQuestions[0]?.focusHand ?? 'KJs');
    setStreetIndex(nextId === 'shishi_triple_barrel_963r_kc_ah' ? 2 : 1);
    setSismographeChoice(null);
    setSismographeRevealed(false);
    setRiverChoice(null);
    setRiverGrade(null);
    riverStartRef.current = Date.now();
    refreshFsrs(nextId);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const ws = document.getElementById('evolutionary-funnel-workspace');
      const tab = document.getElementById('suite-tab-ranges');
      if (!ws || !tab || ws.classList.contains('hidden') || tab.classList.contains('hidden')) return;
      const activeTag = document.activeElement?.tagName;
      if (activeTag && ['INPUT', 'SELECT', 'TEXTAREA'].includes(activeTag)) return;

      e.preventDefault();
      stepStreet(e.key === 'ArrowRight' ? 1 : -1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [stepStreet]);

  const handleWheelStep = (e: React.WheelEvent<HTMLDivElement>) => {
    if (viewMode !== 'single' && viewMode !== 'scalpel') return;
    if (Math.abs(e.deltaY) < 16 && Math.abs(e.deltaX) < 16) return;
    const now = Date.now();
    if (now - lastWheelTsRef.current < 240) return;
    lastWheelTsRef.current = now;
    const dir = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    stepStreet(dir > 0 ? 1 : -1);
  };

  const openRangesGuide = () => {
    window.dispatchEvent(new CustomEvent('propoker-open-guide', { detail: { tourId: 'ranges-mastery' } }));
  };

  const handleSismographeAnswer = (idx: number) => {
    if (sismographeChoice !== null) return;
    setSismographeChoice(idx);
    setSismographeRevealed(true);
    const ok = idx === scenario.sismographe.correctIndex;
    const grade = gradeFunnelAttempt({
      overlapScore: ok ? 0.92 : 0.4,
      ms: 4000,
      limitMs: 15000,
      usedHint: false,
      missedMajorDrawer: !ok,
      minorDrawerImbalance: false,
    });
    recordFunnelFsrsReview({ scenarioId: scenario.id, grade });
    refreshFsrs(scenario.id);
  };

  const handleValidateScalpel = () => {
    const elapsedMs = Date.now() - scalpelStartRef.current;
    const limitMs = scalpelTimedMode ? 20000 : 120000;
    const grade = gradeFunnelAttempt({
      overlapScore: scalpelEval.overlapScore,
      ms: scalpelTimedMode ? elapsedMs : Math.min(elapsedMs, 10000),
      limitMs,
      usedHint: scalpelHintUsed,
      missedMajorDrawer: scalpelEval.missedMajorDrawer,
      minorDrawerImbalance: scalpelEval.minorDrawerImbalance,
    });
    recordFunnelFsrsReview({
      scenarioId: scenario.id,
      grade,
      untimedOverlapPct: scalpelTimedMode ? undefined : scalpelEval.overlapPct,
    });
    refreshFsrs(scenario.id);
    setScalpelSubmitted({
      grade,
      overlapPct: scalpelEval.overlapPct,
      elapsedMs,
    });
  };

  const handleBlockerAnswer = (choice: number) => {
    if (blockerAnswered) return;
    const cur = blockerDrills[blockerIdx];
    const ok = choice === cur.correctCombos;
    if (ok) setBlockerScore((s) => s + 1);
    setBlockerAnswered({ picked: choice, isCorrect: ok, timedOut: false });
  };

  const advanceBlockerDrill = () => {
    const nextIdx = blockerIdx + 1;
    if (nextIdx >= blockerDrills.length) {
      const ratio = blockerScore / blockerDrills.length;
      const grade = gradeFunnelAttempt({
        overlapScore: ratio,
        ms: 3000,
        limitMs: 5000,
        usedHint: false,
        missedMajorDrawer: ratio < 0.65,
        minorDrawerImbalance: ratio < 0.85,
      });
      recordFunnelFsrsReview({ scenarioId: scenario.id, grade });
      refreshFsrs(scenario.id);
    }
    setBlockerIdx(nextIdx);
    setBlockerAnswered(null);
  };

  const handleRiverDecision = (choice: 'call' | 'fold') => {
    if (riverChoice) return;
    setRiverChoice(choice);
    const ms = Date.now() - riverStartRef.current;
    const ok = choice === riverAnalysis.optimalDecision;
    const grade = gradeFunnelAttempt({
      overlapScore: ok ? 0.95 : 0.4,
      ms,
      limitMs: 15000,
      usedHint: false,
      missedMajorDrawer: !ok,
      minorDrawerImbalance: false,
    });
    setRiverGrade(grade);
    recordFunnelFsrsReview({ scenarioId: scenario.id, grade });
    refreshFsrs(scenario.id);
  };

  const handleCellHover = useCallback((hand: string | null) => {
    setHoveredHand(hand);
  }, []);

  const handleCellPin = useCallback((hand: string) => {
    setPinnedHand(hand);
  }, []);

  const renderMatrixCell = (cell: MatrixCellDiff, compact = false, onSelect?: (h: string) => void) => (
    <MemoFunnelCell
      key={cell.hand}
      hand={cell.hand}
      status={cell.status}
      action={cell.action}
      preflopAction={cell.preflopAction}
      freqCurrent={cell.freqCurrent}
      baseCombos={cell.baseCombos}
      activeCombos={cell.activeCombos}
      blockedByBoard={cell.blockedByBoard}
      blockingLabel={cell.blockingCards.join(', ')}
      compact={compact}
      showGhost={showGhost}
      showComboCounts={showComboCounts}
      isSelected={inspectedHand === cell.hand}
      onHover={handleCellHover}
      onPin={onSelect ?? handleCellPin}
    />
  );

  const isDueWarmup = retrievabilityPct < 85 || fsrsProgress.card.due.getTime() <= Date.now();
  const nextDueLabel = fsrsProgress.attemptsCount === 0
    ? 'À calibrer (nouvelle carte)'
    : fsrsProgress.card.due.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });

  return (
    <div id="evolutionary-funnel-lab" className="space-y-4">
      {/* Header, FSRS Status & PALM-Funnel 4-Mode Selector */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                PALM-Funnel • Matrix Diff
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30">
                {scenario.format} • {scenario.actorLabel}
              </span>
              <span
                data-provenance={scenario.provenanceKind}
                className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700"
              >
                provenance : {scenario.provenanceKind} (Card Removal : computed)
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-extrabold text-white">{scenario.title}</h2>
            <p className="text-xs text-slate-400">{scenario.subtitle}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Choisir un scénario d'entonnoir"
              value={scenarioId}
              onChange={(e) => handleScenarioChange(e.target.value)}
              className="w-full sm:w-auto max-w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
            >
              {EVOLUTIONARY_FUNNEL_SCENARIOS.map((sc) => (
                <option key={sc.id} value={sc.id}>
                  {sc.title}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={openRangesGuide}
              className="px-2.5 py-2 rounded-xl text-xs font-bold border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:text-white transition inline-flex items-center gap-1"
            >
              <BookOpen className="w-3.5 h-3.5" /> Tuto
            </button>
          </div>
        </div>

        {/* FSRS Memory Banner */}
        <div
          id="funnel-fsrs-banner"
          className="bg-slate-950/90 border border-slate-800 rounded-xl px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
        >
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 font-bold text-sky-300">
              <Brain className="w-3.5 h-3.5" /> FSRS Rétention :{' '}
              <strong className="font-mono text-white">{retrievabilityPct}%</strong>
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-300">
              Prochaine révision : <strong className="font-mono text-white">{nextDueLabel}</strong>
            </span>
            {fsrsProgress.lastGrade && (
              <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${GRADE_BADGE[fsrsProgress.lastGrade].cls}`}>
                {GRADE_BADGE[fsrsProgress.lastGrade].label}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isDueWarmup && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-200 text-[10px] font-bold">
                <Flame className="w-3 h-3" /> Injecté dans Daily Warm-up
              </span>
            )}
            <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-[10px] font-mono text-slate-300">
              Mode 2 Sans Chrono : {fsrsProgress.untimedBestOverlapPct}%{' '}
              {fsrsProgress.timedUnlocked ? '• ⏱️ Chrono 20s débloqué' : '• (80% requis pour chrono)'}
            </span>
          </div>
        </div>

        {/* Mode Switcher : Exploration + 4 Paliers Progressifs PALM-Funnel */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
          <div className="flex flex-wrap items-center bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1">
            <button
              id="funnel-view-single-btn"
              type="button"
              onClick={() => setViewMode('single')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition inline-flex items-center gap-1.5 ${
                viewMode === 'single' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> Vue Évolutive
            </button>
            <button
              id="funnel-view-compare-btn"
              type="button"
              onClick={() => setViewMode('compare')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition inline-flex items-center gap-1.5 ${
                viewMode === 'compare' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Vue Entonnoir (4 mini-matrices)
            </button>
            <button
              id="funnel-mode-sismographe-btn"
              type="button"
              onClick={() => setViewMode('sismographe')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition inline-flex items-center gap-1.5 ${
                viewMode === 'sismographe' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" /> 1. Sismographe
            </button>
            <button
              id="funnel-mode-scalpel-btn"
              type="button"
              onClick={() => setViewMode('scalpel')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition inline-flex items-center gap-1.5 ${
                viewMode === 'scalpel' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Scissors className="w-3.5 h-3.5" /> 2. Scalpel Tiroirs
            </button>
            <button
              id="funnel-mode-blocker-btn"
              type="button"
              onClick={() => {
                setViewMode('blocker');
                setBlockerIdx(0);
                setBlockerScore(0);
                setBlockerAnswered(null);
              }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition inline-flex items-center gap-1.5 ${
                viewMode === 'blocker' ? 'bg-rose-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Target className="w-3.5 h-3.5" /> 3. Œil du Bloqueur
            </button>
            <button
              id="funnel-mode-river-btn"
              type="button"
              onClick={() => {
                setViewMode('river');
                riverStartRef.current = Date.now();
              }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition inline-flex items-center gap-1.5 ${
                viewMode === 'river' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Scale className="w-3.5 h-3.5" /> 4. Arbitre River
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              id="funnel-ghost-toggle-btn"
              type="button"
              onClick={() => setShowGhost((v) => !v)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition inline-flex items-center gap-1.5 ${
                showGhost
                  ? 'bg-slate-800 border-sky-500/50 text-sky-200'
                  : 'bg-slate-950 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              {showGhost ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              Calque Fantôme {showGhost ? 'ON' : 'OFF'}
            </button>

            <button
              id="funnel-combos-toggle-btn"
              type="button"
              onClick={() => setShowComboCounts((v) => !v)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition inline-flex items-center gap-1.5 ${
                showComboCounts
                  ? 'bg-slate-800 border-emerald-500/50 text-emerald-200'
                  : 'bg-slate-950 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Combos {showComboCounts ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
      </div>

      {/* Stepper Temporel (4 Rues) */}
      <div
        id="funnel-temporal-stepper"
        onWheel={handleWheelStep}
        className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-xl space-y-3"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {allStreetDiffs.map((diff, idx) => {
            const isCurrent = streetIndex === idx;
            const actionMeta = ACTION_COLOR_META[diff.node.action];
            return (
              <button
                key={diff.node.street}
                type="button"
                data-street-step={idx}
                onClick={() => {
                  setStreetIndex(idx as 0 | 1 | 2 | 3);
                  if (viewMode !== 'single' && viewMode !== 'compare') setViewMode('single');
                }}
                className={`text-left rounded-xl p-3 border transition-all ${
                  isCurrent
                    ? 'bg-slate-800/95 border-emerald-400 shadow-lg shadow-emerald-950/30'
                    : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5 mb-1.5">
                  <span className="text-[11px] font-extrabold tracking-wide text-white">
                    {diff.node.label}
                  </span>
                  {diff.deltaCombosFromPrev < 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30 font-mono text-[10px] font-bold">
                      {formatCombos(diff.deltaCombosFromPrev)} c.
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${actionMeta.badgeClass}`}
                  >
                    {diff.node.actionLabel}
                  </span>
                  <span className="font-mono text-xs font-extrabold text-emerald-300">
                    {formatCombos(diff.totalActiveCombos)} combos ({diff.rangePct.toFixed(1)}%)
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Synchronized Horizontal Slider + Arrow Controls */}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            id="funnel-prev-street-btn"
            type="button"
            disabled={streetIndex === 0}
            onClick={() => stepStreet(-1)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-slate-200 hover:bg-slate-800 disabled:opacity-40 inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Préc.
          </button>

          <input
            id="funnel-street-slider"
            type="range"
            min={0}
            max={3}
            step={1}
            value={streetIndex}
            aria-label="Curseur temporel Préflop vers River"
            onChange={(e) => setStreetIndex(Number(e.target.value) as 0 | 1 | 2 | 3)}
            className="flex-1 min-w-[140px] accent-emerald-500"
          />

          <button
            id="funnel-next-street-btn"
            type="button"
            disabled={streetIndex === 3}
            onClick={() => stepStreet(1)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-slate-200 hover:bg-slate-800 disabled:opacity-40 inline-flex items-center gap-1"
          >
            Suiv. <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <span className="text-[11px] font-mono text-slate-400">
            Raccourcis : ← / → ou molette sur la grille
          </span>
        </div>
      </div>

      {/* VIEW: VUE ÉVOLUTIVE (1 GRILLE DIFFÉRENTIELLE + INSPECTEUR) */}
      {viewMode === 'single' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left: Matrix Diff */}
          <div
            onWheel={handleWheelStep}
            className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 sm:p-5 shadow-xl space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs sm:text-sm font-extrabold text-white">
                  {currentDiff.node.label}
                </span>
                <div className="flex items-center gap-1.5">
                  {currentDiff.node.board.length > 0 ? (
                    currentDiff.node.board.map((card) => (
                      <PokerCardVisual key={card} card={card} size="sm" />
                    ))
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-400 font-mono">
                      Aucun board (1 326 combos)
                    </span>
                  )}
                </div>
              </div>

              <div className="font-mono text-xs text-slate-300">
                <strong className="text-emerald-400">
                  {formatCombos(currentDiff.totalActiveCombos)} combos restants
                </strong>{' '}
                / {currentDiff.deckCombos} ({currentDiff.rangePct.toFixed(1)}%)
              </div>
            </div>

            <div
              id="funnel-diff-matrix"
              className="matrix-grid w-full"
              role="grid"
              aria-label={`Matrice différentielle ${currentDiff.node.label}`}
            >
              {currentDiff.cells.map((cell) => renderMatrixCell(cell, false))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-orange-600 inline-block border border-orange-400/70" />
                  Bet / Raise actif
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-emerald-600 inline-block border border-emerald-400/70" />
                  Call actif
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded funnel-cell-ghost inline-block border border-amber-400/60" />
                  Éliminé (Fantôme)
                </span>
                <span className="inline-flex items-center gap-1.5 text-sky-300 font-mono">
                  ✦ Bloqué partiellement par board
                </span>
              </div>
            </div>
          </div>

          {/* Right: Hand Inspector & Combinatorial Funnel */}
          <div className="lg:col-span-5 space-y-4">
            <div
              id="funnel-hand-inspector"
              className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4"
            >
              <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-sky-400">
                      Inspecteur de Cellule Exacte
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 text-[10px] font-semibold text-slate-300">
                      <Pin className="w-3 h-3 text-sky-400" />
                      {hoveredHand ? `Survol (${hoveredHand})` : `Épinglée (${pinnedHand})`}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2.5 mt-1">
                    <span
                      id="funnel-inspected-hand"
                      className="font-mono text-2xl font-extrabold text-white"
                    >
                      {handInspection.hand}
                    </span>
                    <span className="text-xs text-slate-400">
                      {handInspection.handType === 'pair'
                        ? 'Cellule Paire (6 combos base)'
                        : handInspection.handType === 'suited'
                          ? 'Cellule Assortie (4 combos base)'
                          : 'Cellule Dépareillée (12 combos base)'}
                    </span>
                  </div>
                </div>

                <div className="text-right font-mono">
                  <div className="text-[10px] uppercase text-slate-400">Cellule ({handInspection.hand})</div>
                  <div
                    id="funnel-inspected-active-combos"
                    className="text-lg font-extrabold text-emerald-400"
                  >
                    {formatCombos(handInspection.history[streetIndex].unblockedCombos)} combos dispo
                  </div>
                  <div className="text-[10px] text-slate-400">
                    actifs : {formatCombos(handInspection.history[streetIndex].activeCombos)} /{' '}
                    {handInspection.history[streetIndex].baseCombos}
                  </div>
                </div>
              </div>

              {familySummary && (
                <div
                  id="funnel-family-summary"
                  className="bg-sky-950/35 border border-sky-500/30 rounded-xl px-3 py-2.5 text-xs space-y-1"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sky-200 font-semibold">
                      Famille <strong>{familySummary.familyName} totale</strong> (
                      {familySummary.suitedHand} + {familySummary.offsuitHand}) :
                    </span>
                    <span className="font-mono font-extrabold text-white">
                      {familySummary.unblockedTotal} / {familySummary.baseTotal} combos
                      {familySummary.blockedTotal > 0 && (
                        <span className="text-rose-300 ml-1.5">
                          (-{familySummary.blockedTotal} card removal)
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="text-[10px] text-sky-300/80 font-mono">
                    Distinction : cellule {handInspection.hand} ({handInspection.history.map((h) => h.unblockedCombos).join(' → ')} combos) vs famille {familySummary.familyName} ({[0, 1, 2, 3].map((i) => handInspection.familyAtStreet(i as 0 | 1 | 2 | 3)?.unblockedTotal ?? 16).join(' → ')} combos).
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {handInspection.history.map((item) => {
                  const isCur = item.streetIndex === streetIndex;
                  return (
                    <div
                      key={item.street}
                      className={`rounded-xl px-3 py-2 border text-xs flex items-center justify-between gap-2 ${
                        isCur
                          ? 'bg-slate-800/90 border-sky-500/60'
                          : 'bg-slate-950/80 border-slate-800'
                      }`}
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-extrabold text-white">{item.label}</span>
                          {item.status === 'active' ? (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">
                              Actif ({Math.round(item.freq * 100)}%)
                            </span>
                          ) : item.status === 'eliminated_prev' ? (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold text-[10px]">
                              Éliminé ici (Fantôme)
                            </span>
                          ) : item.status === 'eliminated_earlier' ? (
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-bold text-[10px]">
                              Déjà couché
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-500 text-[10px]">
                              Hors range PF
                            </span>
                          )}
                        </div>
                        {item.blockingCards.length > 0 && (
                          <div className="text-[11px] text-rose-300 flex items-center gap-1 flex-wrap">
                            <span>Bloqué par :</span>
                            {item.blockingCards.map((bc) => (
                              <InlineCardPill key={bc} card={bc} />
                            ))}
                            <span>(-{item.blockedByBoard} combos)</span>
                          </div>
                        )}
                      </div>

                      <div className="text-right font-mono shrink-0">
                        <div className="font-extrabold text-white">
                          {item.unblockedCombos} / {item.baseCombos} c.
                        </div>
                        <div className="text-[10px] text-slate-400">
                          actif: {formatCombos(item.activeCombos)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400">
                  Conservation combinatoire &amp; Hamilton (100%)
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  PF : {currentDiff.preflopTotalCombos} c.
                </span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">{currentDiff.node.narrative}</p>

              <div className="grid grid-cols-3 gap-2 pt-1 text-center font-mono">
                <div className="bg-slate-950/90 border border-emerald-500/30 rounded-xl p-2">
                  <div className="text-[10px] text-slate-400">Actifs</div>
                  <div className="text-xs font-extrabold text-emerald-300">
                    {formatCombos(currentDiff.totalActiveCombos)} c.
                  </div>
                </div>
                <div className="bg-slate-950/90 border border-amber-500/30 rounded-xl p-2">
                  <div className="text-[10px] text-slate-400">Fantôme</div>
                  <div className="text-xs font-extrabold text-amber-300">
                    {formatCombos(currentDiff.totalGhostCombos)} c.
                  </div>
                </div>
                <div className="bg-slate-950/90 border border-sky-500/30 rounded-xl p-2">
                  <div className="text-[10px] text-slate-400">Bloqués Board</div>
                  <div className="text-xs font-extrabold text-sky-300">
                    {formatCombos(currentDiff.totalBlockedByBoardCombos)} c.
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800/80 text-[11px]">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-300">Paires ({formatCombos(currentDiff.composition.pairsCombos)} combos)</span>
                    <span className="font-mono text-slate-300">{currentDiff.composition.pairsPct}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-950 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${currentDiff.composition.pairsPct}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-300">Assorties ({formatCombos(currentDiff.composition.suitedCombos)} combos)</span>
                    <span className="font-mono text-slate-300">{currentDiff.composition.suitedPct}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-950 rounded-full overflow-hidden">
                    <div className="h-full bg-sky-500 rounded-full transition-all" style={{ width: `${currentDiff.composition.suitedPct}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-300">Dépareillées ({formatCombos(currentDiff.composition.offsuitCombos)} combos)</span>
                    <span className="font-mono text-slate-300">{currentDiff.composition.offsuitPct}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-950 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${currentDiff.composition.offsuitPct}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: VUE ENTONNOIR (4 MINI-MATRICES CÔTE À CÔTE) */}
      {viewMode === 'compare' && (
        <div id="funnel-compare-grid" className="space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-sky-300">Comparateur 4 Rues — Cellule :</span>
              <span className="px-2 py-0.5 rounded bg-slate-950 border border-sky-500/40 font-mono font-extrabold text-white">
                {handInspection.hand}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 font-mono">
              {handInspection.history.map((item, idx) => (
                <span
                  key={item.street}
                  className={`px-2 py-0.5 rounded border text-[11px] ${
                    item.status === 'active'
                      ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  {['PF', 'F', 'T', 'R'][idx]}: {item.unblockedCombos}/{item.baseCombos} c. (actif {formatCombos(item.activeCombos)})
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
            {allStreetDiffs.map((diff, idx) => (
              <div key={diff.node.street} className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 shadow-xl space-y-2.5">
                <div className="flex items-center justify-between gap-1.5 border-b border-slate-800 pb-2">
                  <button
                    type="button"
                    onClick={() => {
                      setStreetIndex(idx as 0 | 1 | 2 | 3);
                      setViewMode('single');
                    }}
                    className="text-left hover:text-emerald-300 transition"
                  >
                    <div className="text-xs font-extrabold text-white">{diff.node.label}</div>
                    <div className="text-[10px] text-slate-400">{diff.node.actionLabel}</div>
                  </button>
                  <div className="text-right font-mono text-[11px]">
                    <div className="font-extrabold text-emerald-300">{formatCombos(diff.totalActiveCombos)} c.</div>
                    <div className="text-[10px] text-slate-400">{diff.rangePct.toFixed(1)}%</div>
                  </div>
                </div>

                <div className="matrix-grid w-full">
                  {diff.cells.map((cell) => renderMatrixCell(cell, true))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODE 1 — LE SISMOGRAPHE DE CONTRASTE (Exemples résolus : 3 rues visibles, 1 rue masquée) */}
      {viewMode === 'sismographe' && (
        <div id="funnel-sismographe-workspace" className="space-y-4">
          <div className="bg-slate-900/90 border border-indigo-500/30 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-indigo-500/20 border border-indigo-500/40 text-indigo-200 text-[10px] font-extrabold uppercase">
                    Mode 1 • Sismographe de Contraste (Exemples Résolus)
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-300">
                    provenance : {scenario.sismographe.provenance}
                  </span>
                </div>
                <p className="text-xs sm:text-sm font-bold text-white mt-1.5">
                  {scenario.sismographe.prompt}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSismographeChoice(null);
                  setSismographeRevealed(false);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 inline-flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Rejouer
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {scenario.sismographe.options.map((opt, idx) => {
                const answered = sismographeChoice !== null;
                let cls = 'text-left rounded-xl px-3.5 py-3 text-xs font-bold border transition ';
                if (!answered) {
                  cls += 'bg-slate-950 border-slate-700 text-slate-200 hover:border-indigo-400 hover:bg-slate-800';
                } else if (idx === scenario.sismographe.correctIndex) {
                  cls += 'bg-emerald-950/70 border-emerald-400 text-emerald-100';
                } else if (idx === sismographeChoice) {
                  cls += 'bg-rose-950/70 border-rose-400 text-rose-100';
                } else {
                  cls += 'bg-slate-950/50 border-slate-800 text-slate-500';
                }
                return (
                  <button
                    key={opt}
                    type="button"
                    disabled={answered}
                    onClick={() => handleSismographeAnswer(idx)}
                    className={cls}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>

            {sismographeChoice !== null && (
              <div
                className={`rounded-xl p-3 border text-xs leading-relaxed flex items-start gap-2 ${
                  sismographeChoice === scenario.sismographe.correctIndex
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-100'
                    : 'bg-rose-950/40 border-rose-500/40 text-rose-100'
                }`}
              >
                {sismographeChoice === scenario.sismographe.correctIndex ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                )}
                <span>{scenario.sismographe.explanation}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
            {allStreetDiffs.map((diff, idx) => {
              const isMasked = idx === scenario.sismographe.maskedStreetIndex && !sismographeRevealed;
              return (
                <div
                  key={diff.node.street}
                  data-masked={isMasked ? 'true' : 'false'}
                  className="relative bg-slate-900/90 border border-slate-800 rounded-2xl p-3 shadow-xl space-y-2.5 overflow-hidden"
                >
                  <div className="flex items-center justify-between gap-1.5 border-b border-slate-800 pb-2">
                    <div>
                      <div className="text-xs font-extrabold text-white">{diff.node.label}</div>
                      <div className="text-[10px] text-slate-400">{diff.node.actionLabel}</div>
                    </div>
                    <div className="text-right font-mono text-[11px]">
                      <div className="font-extrabold text-emerald-300">
                        {isMasked ? '?? c.' : `${formatCombos(diff.totalActiveCombos)} c.`}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {isMasked ? 'Masquée' : `${diff.rangePct.toFixed(1)}%`}
                      </div>
                    </div>
                  </div>

                  <div className={`matrix-grid w-full transition ${isMasked ? 'blur-md opacity-25 pointer-events-none' : ''}`}>
                    {diff.cells.map((cell) => renderMatrixCell(cell, true))}
                  </div>

                  {isMasked && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-slate-950/60 backdrop-blur-[2px]">
                      <Lock className="w-6 h-6 text-indigo-300 mb-2" />
                      <div className="text-xs font-extrabold text-white">Rue masquée (Sismographe)</div>
                      <p className="text-[11px] text-slate-300 mt-1">
                        Identifiez le tiroir qui bascule en fantôme ci-dessus pour révéler la grille.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODE 2 — LE SCALPEL PAR TIROIRS (Élagage actif par blocs, 0 clic 169×) */}
      {viewMode === 'scalpel' && (
        <div id="funnel-scalpel-workspace" className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left: Live pruned matrix */}
          <div className="lg:col-span-7 bg-slate-900/90 border border-amber-500/30 rounded-2xl p-3.5 sm:p-5 shadow-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-200 text-[10px] font-extrabold uppercase">
                    Mode 2 • Scalpel par Tiroirs
                  </span>
                  <span className="text-xs font-extrabold text-white">
                    {scenario.streets[scalpelStreet].label}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Votre élagage : <strong className="font-mono text-emerald-300">{formatCombos(scalpelEval.userTotalCombos)} combos</strong> • Référence : <strong className="font-mono text-sky-300">{formatCombos(scalpelEval.refTotalCombos)} combos</strong>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {([1, 2, 3] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setScalpelStreet(st)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                      scalpelStreet === st
                        ? 'bg-amber-600 text-white border-amber-400'
                        : 'bg-slate-950 text-slate-300 border-slate-700 hover:bg-slate-800'
                    }`}
                  >
                    {['PF', 'Flop', 'Turn', 'River'][st]}
                  </button>
                ))}
              </div>
            </div>

            <div id="funnel-scalpel-matrix" className="matrix-grid w-full">
              {scalpelEval.cells.map((cell) => renderMatrixCell(cell, false))}
            </div>
          </div>

          {/* Right: 5-6 Drawer Frequency Controls + Adaptive Timer + FSRS */}
          <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-white">Élaguer par Tiroirs logiques</h3>
                <p className="text-[11px] text-slate-400">
                  Choisissez la fréquence naturelle (0% à 100%) sans cliquer 169 cases.
                </p>
              </div>

              <button
                id="funnel-scalpel-timer-btn"
                type="button"
                disabled={!fsrsProgress.timedUnlocked}
                onClick={() => {
                  setScalpelTimedMode((v) => !v);
                  resetScalpelForStreet(scenarioId, scalpelStreet);
                }}
                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border inline-flex items-center gap-1.5 ${
                  !fsrsProgress.timedUnlocked
                    ? 'bg-slate-950 border-slate-800 text-slate-500 cursor-not-allowed'
                    : scalpelTimedMode
                      ? 'bg-rose-600/20 border-rose-400 text-rose-200'
                      : 'bg-emerald-600/20 border-emerald-400 text-emerald-200'
                }`}
              >
                {fsrsProgress.timedUnlocked ? (
                  <>
                    <Clock className="w-3.5 h-3.5" />
                    {scalpelTimedMode ? `⏱️ ${scalpelSecondsLeft}s` : 'Activer Chrono 20s'}
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5" /> Chrono 20s (≥80% sans chrono)
                  </>
                )}
              </button>
            </div>

            <div className="space-y-3">
              {scalpelEval.drawers.map((drawer) => (
                <div
                  key={drawer.id}
                  data-drawer-id={drawer.id}
                  className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-extrabold text-white">{drawer.label}</span>
                    <span className="font-mono text-[11px] text-sky-300">
                      {formatCombos(drawer.userCombos)} / {formatCombos(drawer.incomingCombos)} combos
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-1">
                    {DRAWER_STEP_FREQS.map((step) => {
                      const active = drawer.userFreq === step;
                      return (
                        <button
                          key={step}
                          type="button"
                          onClick={() => {
                            setDrawerFreqs((prev) => ({ ...prev, [drawer.id]: step }));
                            setScalpelSubmitted(null);
                          }}
                          className={`py-1.5 px-1 rounded-lg text-[10px] font-extrabold border transition ${
                            active
                              ? 'bg-amber-600 text-white border-amber-400 shadow'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                          }`}
                        >
                          {Math.round(step * 100)}%
                        </button>
                      );
                    })}
                  </div>
                  {scalpelSubmitted && (
                    <div className="text-[10px] font-mono text-slate-400">
                      Cible Kill Tilt : <strong className="text-emerald-300">{drawerFreqLabel(drawer.referenceFreq)}</strong> ({formatCombos(drawer.referenceCombos)} combos)
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setScalpelHintUsed(true)}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-amber-300 border border-slate-700 inline-flex items-center gap-1"
              >
                <HelpCircle className="w-3.5 h-3.5" /> Indice
              </button>
              <button
                id="funnel-scalpel-validate-btn"
                type="button"
                onClick={handleValidateScalpel}
                className="flex-1 py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold transition"
              >
                Valider l&apos;élagage (FSRS)
              </button>
            </div>

            {scalpelHintUsed && (
              <div className="rounded-xl p-2.5 bg-amber-950/40 border border-amber-500/30 text-[11px] text-amber-200">
                💡 Astuce : gardez 75–100 % des Brelans/Overpaires, Top Paires et Tirages forts ; éliminez l&apos;Air pur (0 %).
              </div>
            )}

            {scalpelSubmitted && (
              <div id="funnel-scalpel-result" className="rounded-xl p-3 bg-slate-950 border border-emerald-500/40 space-y-1.5 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-extrabold text-white">
                    Recouvrement pondéré : <strong className="text-emerald-300">{scalpelSubmitted.overlapPct}%</strong>
                  </span>
                  <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${GRADE_BADGE[scalpelSubmitted.grade].cls}`}>
                    {GRADE_BADGE[scalpelSubmitted.grade].label}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Carte FSRS mise à jour automatiquement ({(scalpelSubmitted.elapsedMs / 1000).toFixed(1)} s).
                  {scalpelSubmitted.overlapPct >= 80 && !scalpelTimedMode && ' ⏱️ Chrono adaptatif 20s débloqué !'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODE 3 — L'ŒIL DU BLOQUEUR (10 micro-drills chronométrés 5s) */}
      {viewMode === 'blocker' && (
        <div id="funnel-blocker-workspace" className="bg-slate-900/90 border border-rose-500/30 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 text-rose-200 text-[10px] font-extrabold uppercase">
                  Mode 3 • L&apos;Œil du Bloqueur (Micro-Drills 5s)
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-emerald-300">
                  provenance : computed
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-extrabold text-white mt-1">
                Comptage instantané de combos restants avec Card Removal
              </h3>
            </div>
            <div className="font-mono text-xs flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-emerald-300 font-bold">
                Score : {blockerScore} / {blockerDrills.length}
              </span>
              {blockerIdx < blockerDrills.length && (
                <span className="px-2.5 py-1 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 font-extrabold">
                  ⏱️ {(blockerMsLeft / 1000).toFixed(1)}s
                </span>
              )}
            </div>
          </div>

          {blockerIdx >= blockerDrills.length ? (
            <div className="bg-slate-950 border border-emerald-500/30 rounded-2xl p-5 text-center space-y-3">
              <div className="text-lg font-extrabold text-white">
                Salve terminée : {blockerScore} / {blockerDrills.length} combos exacts !
              </div>
              <p className="text-xs text-slate-300">
                La révision FSRS a été enregistrée pour ce scénario.
              </p>
              <button
                type="button"
                onClick={() => {
                  setBlockerIdx(0);
                  setBlockerScore(0);
                  setBlockerAnswered(null);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold"
              >
                Rejouer les 10 drills
              </button>
            </div>
          ) : (
            (() => {
              const cur = blockerDrills[blockerIdx];
              return (
                <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-[11px] font-mono text-slate-400 uppercase">Board</div>
                      <div className="flex flex-wrap gap-1.5">
                        {cur.board.map((c) => (
                          <PokerCardVisual key={c} card={c} size="sm" />
                        ))}
                      </div>
                    </div>

                    {cur.heroCards.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-[11px] font-mono text-sky-300 uppercase">Vos cartes (Hero)</div>
                        <div className="flex flex-wrap gap-1.5">
                          {cur.heroCards.map((c) => (
                            <PokerCardVisual key={c} card={c} size="sm" />
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="text-right font-mono text-xs text-slate-400">
                      Question {blockerIdx + 1} / {blockerDrills.length}
                      <div className="text-sm font-extrabold text-amber-300">Cible : {cur.targetFamily}</div>
                    </div>
                  </div>

                  <p className="text-sm font-bold text-white">{cur.prompt}</p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {cur.options.map((optVal) => {
                      const done = blockerAnswered !== null;
                      let cls = 'py-3 px-3 rounded-xl font-mono text-sm font-extrabold border transition ';
                      if (!done) {
                        cls += 'bg-slate-900 border-slate-700 text-white hover:border-rose-400 hover:bg-slate-800';
                      } else if (optVal === cur.correctCombos) {
                        cls += 'bg-emerald-950/70 border-emerald-400 text-emerald-200';
                      } else if (optVal === blockerAnswered.picked) {
                        cls += 'bg-rose-950/70 border-rose-400 text-rose-200';
                      } else {
                        cls += 'bg-slate-900/40 border-slate-800 text-slate-500';
                      }
                      return (
                        <button
                          key={optVal}
                          type="button"
                          disabled={done}
                          onClick={() => handleBlockerAnswer(optVal)}
                          className={cls}
                        >
                          {optVal} combos
                        </button>
                      );
                    })}
                  </div>

                  {blockerAnswered && (
                    <div
                      className={`rounded-xl p-3 border text-xs flex flex-wrap items-center justify-between gap-2 ${
                        blockerAnswered.isCorrect
                          ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-100'
                          : 'bg-rose-950/40 border-rose-500/40 text-rose-100'
                      }`}
                    >
                      <span>
                        {blockerAnswered.timedOut ? '⏱️ Temps écoulé ! ' : ''}
                        {cur.explanation}
                      </span>
                      <button
                        type="button"
                        onClick={advanceBlockerDrill}
                        className="px-3 py-1.5 rounded-lg bg-white text-slate-950 font-extrabold"
                      >
                        {blockerIdx + 1 >= blockerDrills.length ? 'Terminer →' : 'Suivant →'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })()
          )}
        </div>
      )}

      {/* MODE 4 — L'ARBITRE RIVER (Ratio Value/Bluff en fréquences naturelles & Décision EV) */}
      {viewMode === 'river' && (
        <div id="funnel-river-workspace" className="bg-slate-900/90 border border-purple-500/30 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-purple-500/20 border border-purple-500/40 text-purple-200 text-[10px] font-extrabold uppercase">
                  Mode 4 • L&apos;Arbitre River (Décision EV &amp; Ratio Value/Bluff)
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-emerald-300">
                  provenance : {riverAnalysis.provenance}
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-extrabold text-white mt-1">
                Bilan combinatoire River en fréquences naturelles
              </h3>
            </div>

            <div className="flex items-center gap-1.5">
              {riverAnalysis.riverBoard.map((c) => (
                <PokerCardVisual key={c} card={c} size="sm" />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono">
            <div className="bg-slate-950 border border-emerald-500/30 rounded-xl p-3.5">
              <div className="text-[11px] font-sans font-bold text-slate-400">Combos de Value River</div>
              <div className="text-xl font-extrabold text-emerald-300 mt-1">
                {formatCombos(riverAnalysis.valueCombos)} combos
              </div>
              <div className="text-xs text-slate-400">{riverAnalysis.valueSharePct}% du range river</div>
            </div>
            <div className="bg-slate-950 border border-amber-500/30 rounded-xl p-3.5">
              <div className="text-[11px] font-sans font-bold text-slate-400">Bluffs manqués</div>
              <div className="text-xl font-extrabold text-amber-300 mt-1">
                {formatCombos(riverAnalysis.bluffCombos)} combos
              </div>
              <div className="text-xs text-slate-400">{riverAnalysis.bluffSharePct}% du range river</div>
            </div>
            <div className="bg-slate-950 border border-purple-500/30 rounded-xl p-3.5">
              <div className="text-[11px] font-sans font-bold text-slate-400">Sizing &amp; Cote du Pot</div>
              <div className="text-xl font-extrabold text-purple-300 mt-1">
                Mise {riverAnalysis.betPctPot}% pot
              </div>
              <div className="text-xs text-slate-300">Cote requise : {riverAnalysis.potOddsPct.toFixed(1)}%</div>
            </div>
          </div>

          <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-3">
            <p className="text-xs sm:text-sm font-bold text-white leading-relaxed">
              Il reste <strong className="text-emerald-300">{formatCombos(riverAnalysis.valueCombos)} combos de Value</strong> et{' '}
              <strong className="text-amber-300">{formatCombos(riverAnalysis.bluffCombos)} combos de Bluffs manqués</strong>.{' '}
              Vilain mise {riverAnalysis.betPctPot} % du pot (cote du pot = {riverAnalysis.potOddsPct.toFixed(1)} %). Avec votre Bluff-Catcher (qui ne bloque pas les tirages manqués), devez-vous Payer ou Folder ?
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(['call', 'fold'] as const).map((act) => {
                const label = act === 'call' ? '✅ Payer (Bluff-Catch EV+)' : '🛡️ Folder (Discipliné)';
                const done = riverChoice !== null;
                let cls = 'py-3 px-4 rounded-xl text-xs sm:text-sm font-extrabold border transition ';
                if (!done) {
                  cls += 'bg-slate-900 border-slate-700 text-white hover:border-purple-400 hover:bg-slate-800';
                } else if (act === riverAnalysis.optimalDecision) {
                  cls += 'bg-emerald-950/70 border-emerald-400 text-emerald-200';
                } else if (act === riverChoice) {
                  cls += 'bg-rose-950/70 border-rose-400 text-rose-200';
                } else {
                  cls += 'bg-slate-900/50 border-slate-800 text-slate-500';
                }
                return (
                  <button
                    key={act}
                    type="button"
                    disabled={done}
                    onClick={() => handleRiverDecision(act)}
                    className={cls}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {riverChoice && (
              <div
                id="funnel-river-feedback"
                className={`rounded-xl p-3 border text-xs space-y-1 ${
                  riverChoice === riverAnalysis.optimalDecision
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-100'
                    : 'bg-rose-950/40 border-rose-500/40 text-rose-100'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-extrabold">{riverAnalysis.explanation}</span>
                  {riverGrade && (
                    <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${GRADE_BADGE[riverGrade].cls}`}>
                      {GRADE_BADGE[riverGrade].label}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
