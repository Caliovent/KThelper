import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Eye,
  EyeOff,
  Layers,
  LayoutGrid,
  Pin,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Target,
  XCircle,
} from 'lucide-react';
import { PokerCardVisual } from '../../components/PokerCardVisual';
import {
  EVOLUTIONARY_FUNNEL_SCENARIOS,
  computeStreetMatrixDiff,
  getScenarioById,
  inspectHandFunnelHistory,
  type FunnelActionKind,
  type MatrixCellDiff,
  type StreetMatrixDiffSummary,
} from '../../engines/evolutionaryFunnel';

type ViewMode = 'single' | 'compare' | 'quiz';

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

function getActiveCellStyle(cell: MatrixCellDiff): React.CSSProperties | undefined {
  if (cell.status !== 'active' || !cell.action) return undefined;
  const color = ACTION_COLOR_META[cell.action].bgHex;
  if (cell.freqCurrent >= 0.999) {
    return { backgroundColor: color };
  }
  const pct = Math.round(cell.freqCurrent * 100);
  return {
    background: `linear-gradient(to right, ${color} 0%, ${color} ${pct}%, rgba(15, 23, 42, 0.94) ${pct}%, rgba(15, 23, 42, 0.94) 100%)`,
  };
}

function formatCombos(val: number): string {
  return Number.isInteger(val) ? String(val) : val.toFixed(1);
}

export const EvolutionaryFunnelLab: React.FC = () => {
  const [scenarioId, setScenarioId] = useState<string>(EVOLUTIONARY_FUNNEL_SCENARIOS[0].id);
  const [streetIndex, setStreetIndex] = useState<0 | 1 | 2 | 3>(2);
  const [viewMode, setViewMode] = useState<ViewMode>('single');
  const [showGhost, setShowGhost] = useState<boolean>(true);
  const [showComboCounts, setShowComboCounts] = useState<boolean>(true);
  const [hoveredHand, setHoveredHand] = useState<string | null>(null);
  const [pinnedHand, setPinnedHand] = useState<string>('KJs');
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});

  const lastWheelTsRef = useRef<number>(0);
  const scenario = useMemo(() => getScenarioById(scenarioId), [scenarioId]);

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
    setQuizAnswers({});
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
    if (viewMode !== 'single') return;
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

  const quizScore = useMemo(() => {
    let answered = 0;
    let correct = 0;
    for (const q of scenario.quizQuestions) {
      if (q.id in quizAnswers) {
        answered += 1;
        if (quizAnswers[q.id] === q.correctIndex) correct += 1;
      }
    }
    return { answered, correct, total: scenario.quizQuestions.length };
  }, [scenario, quizAnswers]);

  const renderMatrixCell = (cell: MatrixCellDiff, compact = false) => {
    const isSelected = inspectedHand === cell.hand;
    const actionMeta = cell.action ? ACTION_COLOR_META[cell.action] : null;
    const preMeta = cell.preflopAction ? ACTION_COLOR_META[cell.preflopAction] : null;

    let className =
      'hand-cell relative rounded-[4px] sm:rounded-md flex flex-col items-center justify-center font-mono font-bold border transition-all select-none overflow-hidden ';
    if (compact) {
      className += 'text-[8px] sm:text-[9px] leading-none ';
    } else {
      className += 'text-[9px] sm:text-[11px] leading-tight ';
    }

    let style: React.CSSProperties | undefined;

    if (cell.status === 'active' && actionMeta) {
      className += `text-white ${actionMeta.borderClass} `;
      style = getActiveCellStyle(cell);
    } else if (cell.status === 'eliminated_prev' && showGhost) {
      className += `funnel-cell-ghost text-slate-200 ${preMeta ? preMeta.ghostBorderClass : 'border-slate-500/60'} `;
    } else if (cell.status === 'eliminated_earlier' && showGhost) {
      className += 'funnel-cell-ghost-old text-slate-400 border-slate-700/60 ';
    } else {
      className += 'bg-slate-950/90 text-slate-600 border-slate-800/70 ';
    }

    if (isSelected) {
      className += ' ring-2 ring-sky-400 z-20 scale-[1.04] ';
    }

    const titleText = `${cell.hand} — ${formatCombos(cell.activeCombos)}/${cell.baseCombos} combos (${Math.round(cell.freqCurrent * 100)}%)${
      cell.blockedByBoard > 0 ? ` • -${cell.blockedByBoard} bloqué(s) par ${cell.blockingCards.join(', ')}` : ''
    }`;

    return (
      <button
        key={cell.hand}
        type="button"
        data-hand={cell.hand}
        data-status={cell.status}
        onMouseEnter={() => setHoveredHand(cell.hand)}
        onMouseLeave={() => setHoveredHand(null)}
        onFocus={() => setHoveredHand(cell.hand)}
        onClick={() => setPinnedHand(cell.hand)}
        style={style}
        title={titleText}
        aria-label={titleText}
        className={className}
      >
        <span className="drop-shadow-sm">{cell.hand}</span>
        {!compact && showComboCounts && cell.status === 'active' && (
          <span
            className={`text-[8px] sm:text-[9px] font-mono leading-none mt-0.5 ${
              cell.blockedByBoard > 0 ? 'text-sky-200 font-extrabold' : 'text-white/80'
            }`}
          >
            {formatCombos(cell.activeCombos)}
            {cell.blockedByBoard > 0 ? '✦' : ''}
          </span>
        )}
        {!compact && cell.status === 'eliminated_prev' && showGhost && (
          <span className="text-[7px] sm:text-[8px] text-slate-300/90 leading-none">fold</span>
        )}
      </button>
    );
  };

  return (
    <div id="evolutionary-funnel-lab" className="space-y-4">
      {/* Header & Controls */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Range Évolutif &amp; Matrix Diff
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30">
                {scenario.format} • {scenario.actorLabel}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                Heuristique Kill Tilt • Card Removal exact
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

        {/* Mode Switcher & Overlay Toggles */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
          <div className="flex flex-wrap items-center bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1">
            <button
              id="funnel-view-single-btn"
              type="button"
              onClick={() => setViewMode('single')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition inline-flex items-center gap-1.5 ${
                viewMode === 'single'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> Vue Évolutive (1 grille)
            </button>
            <button
              id="funnel-view-compare-btn"
              type="button"
              onClick={() => setViewMode('compare')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition inline-flex items-center gap-1.5 ${
                viewMode === 'compare'
                  ? 'bg-sky-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Vue Entonnoir (4 mini-matrices)
            </button>
            <button
              id="funnel-view-quiz-btn"
              type="button"
              onClick={() => setViewMode('quiz')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition inline-flex items-center gap-1.5 ${
                viewMode === 'quiz'
                  ? 'bg-amber-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Target className="w-3.5 h-3.5" /> Défi Entonnoir ({quizScore.correct}/{quizScore.total})
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
              Combos exacts {showComboCounts ? 'ON' : 'OFF'}
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
                  if (viewMode === 'quiz') setViewMode('single');
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
                      {formatCombos(diff.deltaCombosFromPrev)}
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
                    {diff.rangePct.toFixed(1)}% ({formatCombos(diff.totalActiveCombos)} c.)
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

      {/* VIEW 1: VUE ÉVOLUTIVE (1 GRILLE DIFFÉRENTIELLE + INSPECTEUR) */}
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
                  {formatCombos(currentDiff.totalActiveCombos)}
                </strong>{' '}
                / {currentDiff.deckCombos} combos ({currentDiff.rangePct.toFixed(1)}%)
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

            {/* Matrix Legend */}
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
                  Éliminé à cette rue (Fantôme)
                </span>
                <span className="inline-flex items-center gap-1.5 text-sky-300 font-mono">
                  ✦ Bloqué partiellement par le board
                </span>
              </div>
            </div>
          </div>

          {/* Right: Hand Inspector & Combinatorial Funnel */}
          <div className="lg:col-span-5 space-y-4">
            {/* Inspected Hand Card */}
            <div
              id="funnel-hand-inspector"
              className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4"
            >
              <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-sky-400">
                      Inspecteur de Main
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
                        ? 'Paire (6 combos base)'
                        : handInspection.handType === 'suited'
                          ? 'Assortie (4 combos base)'
                          : 'Dépareillée (12 combos base)'}
                    </span>
                  </div>
                </div>

                <div className="text-right font-mono">
                  <div className="text-[10px] uppercase text-slate-400">Rue actuelle</div>
                  <div
                    id="funnel-inspected-active-combos"
                    className="text-lg font-extrabold text-emerald-400"
                  >
                    {formatCombos(handInspection.history[streetIndex].activeCombos)} combos
                  </div>
                  <div className="text-[10px] text-slate-400">
                    ({handInspection.history[streetIndex].unblockedCombos}/
                    {handInspection.history[streetIndex].baseCombos} non bloqués)
                  </div>
                </div>
              </div>

              {/* Family Combined Counter (e.g. KJ = KJs + KJo) */}
              {familySummary && (
                <div
                  id="funnel-family-summary"
                  className="bg-sky-950/35 border border-sky-500/30 rounded-xl px-3 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2"
                >
                  <span className="text-sky-200 font-semibold">
                    Famille <strong>{familySummary.familyName}</strong> ({familySummary.suitedHand}{' '}
                    + {familySummary.offsuitHand}) :
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
              )}

              {/* 4-Street Combinatorial Timeline */}
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

            {/* Narrative, Filtering Breakdown & Range Composition */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3">
              <div className="text-xs font-extrabold uppercase tracking-wider text-emerald-400">
                Lecture stratégique &amp; Filtrage
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">{currentDiff.node.narrative}</p>

              {streetIndex > 0 && (
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-2.5">
                    <div className="text-[10px] uppercase font-bold text-slate-400">
                      Éliminés par l&apos;action
                    </div>
                    <div className="font-mono text-sm font-extrabold text-amber-300 mt-0.5">
                      -{formatCombos(currentDiff.eliminatedByActionCombos)} combos
                    </div>
                  </div>
                  <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-2.5">
                    <div className="text-[10px] uppercase font-bold text-slate-400">
                      Card Removal ({currentDiff.node.newCards.map(formatCardText).join(' ')})
                    </div>
                    <div className="font-mono text-sm font-extrabold text-sky-300 mt-0.5">
                      -{formatCombos(currentDiff.eliminatedByCardRemovalCombos)} combos
                    </div>
                  </div>
                </div>
              )}

              {/* Range Composition */}
              <div className="space-y-2 pt-2 border-t border-slate-800/80 text-[11px]">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-300">Paires (Pocket Pairs)</span>
                    <span className="font-mono text-slate-300">
                      {formatCombos(currentDiff.composition.pairsCombos)} c. (
                      {currentDiff.composition.pairsPct}%)
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-950 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${currentDiff.composition.pairsPct}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-300">Mains Assorties (Suited)</span>
                    <span className="font-mono text-slate-300">
                      {formatCombos(currentDiff.composition.suitedCombos)} c. (
                      {currentDiff.composition.suitedPct}%)
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-950 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sky-500 rounded-full transition-all"
                      style={{ width: `${currentDiff.composition.suitedPct}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-300">Mains Dépareillées (Offsuit)</span>
                    <span className="font-mono text-slate-300">
                      {formatCombos(currentDiff.composition.offsuitCombos)} c. (
                      {currentDiff.composition.offsuitPct}%)
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-950 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all"
                      style={{ width: `${currentDiff.composition.offsuitPct}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: VUE ENTONNOIR (4 MINI-MATRICES CÔTE À CÔTE) */}
      {viewMode === 'compare' && (
        <div id="funnel-compare-grid" className="space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-sky-300">Comparateur 4 Rues — Main suivie :</span>
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
                  {['PF', 'F', 'T', 'R'][idx]}: {formatCombos(item.activeCombos)}/{item.baseCombos}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
            {allStreetDiffs.map((diff, idx) => (
              <div
                key={diff.node.street}
                className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 shadow-xl space-y-2.5"
              >
                <div className="flex items-center justify-between gap-1.5 border-b border-slate-800 pb-2">
                  <button
                    type="button"
                    onClick={() => {
                      setStreetIndex(idx as 0 | 1 | 2 | 3);
                      setViewMode('single');
                    }}
                    className="text-left hover:text-emerald-300 transition"
                    title="Ouvrir cette rue en grand format"
                  >
                    <div className="text-xs font-extrabold text-white">{diff.node.label}</div>
                    <div className="text-[10px] text-slate-400">{diff.node.actionLabel}</div>
                  </button>
                  <div className="text-right font-mono text-[11px]">
                    <div className="font-extrabold text-emerald-300">{diff.rangePct.toFixed(1)}%</div>
                    <div className="text-[10px] text-slate-400">
                      {formatCombos(diff.totalActiveCombos)} c.
                    </div>
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

      {/* VIEW 3: SERIOUS GAME — DÉFI ENTONNOIR */}
      {viewMode === 'quiz' && (
        <div
          id="funnel-quiz-workspace"
          className="bg-slate-900/90 border border-amber-500/30 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm sm:text-base font-extrabold text-white">
                  Défi Entonnoir — Card Removal &amp; Polarisation
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Validez votre lecture de range rue par rue puis vérifiez chaque réponse directement
                sur la matrice 13×13.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs font-bold text-emerald-300">
                Score : {quizScore.correct} / {quizScore.total}
              </span>
              <button
                type="button"
                onClick={() => setQuizAnswers({})}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 inline-flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Rejouer
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {scenario.quizQuestions.map((q, qIdx) => {
              const picked = quizAnswers[q.id];
              const isAnswered = picked !== undefined;
              const isRight = picked === q.correctIndex;
              const streetNode = scenario.streets[q.streetIndex];

              return (
                <div
                  key={q.id}
                  data-funnel-question={q.id}
                  className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 text-[11px] font-bold text-sky-300 font-mono">
                      Question {qIdx + 1} • {streetNode.label} • Focus : {q.focusHand}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setStreetIndex(q.streetIndex);
                        setPinnedHand(q.focusHand);
                        setViewMode('single');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-emerald-300 border border-slate-700"
                    >
                      👁️ Voir sur la matrice
                    </button>
                  </div>

                  <p className="text-xs sm:text-sm font-bold text-white leading-relaxed">
                    {q.prompt}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {q.options.map((opt, optIdx) => {
                      let btnCls =
                        'text-left rounded-xl px-3 py-2.5 text-xs font-bold border transition ';
                      if (!isAnswered) {
                        btnCls +=
                          'bg-slate-900 border-slate-700 text-slate-200 hover:border-amber-400 hover:bg-slate-800';
                      } else if (optIdx === q.correctIndex) {
                        btnCls += 'bg-emerald-950/70 border-emerald-400 text-emerald-200';
                      } else if (optIdx === picked) {
                        btnCls += 'bg-rose-950/70 border-rose-400 text-rose-200';
                      } else {
                        btnCls += 'bg-slate-900/50 border-slate-800 text-slate-500';
                      }

                      return (
                        <button
                          key={opt}
                          type="button"
                          disabled={isAnswered}
                          onClick={() =>
                            setQuizAnswers((prev) => ({
                              ...prev,
                              [q.id]: optIdx,
                            }))
                          }
                          className={btnCls}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>

                  {isAnswered && (
                    <div
                      className={`rounded-xl p-3 border text-xs leading-relaxed flex items-start gap-2 ${
                        isRight
                          ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-100'
                          : 'bg-rose-950/40 border-rose-500/40 text-rose-100'
                      }`}
                    >
                      {isRight ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      )}
                      <span>{q.explanation}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
