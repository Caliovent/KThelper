import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Layers, Play, ShieldAlert, Sparkles } from 'lucide-react';
import {
  FRESQUE_CONFIG,
  FRESQUE_DRILL_SETS,
  fresqueContrastMap,
  includedHandIndices,
  scoreFresqueDuel,
  type FresqueDuelScore,
  type FresqueLineAnswer,
} from '../../engines/mp';

export const FresqueDuelPanel: React.FC = () => {
  const [setIdx, setSetIdx] = useState<number>(0);
  const [contrastMode, setContrastMode] = useState<boolean>(false);
  const [active, setActive] = useState<boolean>(false);
  const [lineIdx, setLineIdx] = useState<number>(0);
  const [floorIndex, setFloorIndex] = useState<number | null>(null);
  const [islands, setIslands] = useState<number[]>([]);
  const [answers, setAnswers] = useState<{ answer: FresqueLineAnswer | null; elapsedMs: number }[]>([]);
  const [remainingMs, setRemainingMs] = useState<number>(FRESQUE_CONFIG.lineLimitMs);
  const [debrief, setDebrief] = useState<FresqueDuelScore | null>(null);
  const openedAtRef = useRef<number>(0);

  const selectedSet = FRESQUE_DRILL_SETS[setIdx];
  const contrastSet = FRESQUE_DRILL_SETS[setIdx === 0 ? 1 : 0];
  const contrastMap = useMemo(
    () => fresqueContrastMap(FRESQUE_DRILL_SETS[0], FRESQUE_DRILL_SETS[1]),
    []
  );

  // Adversaire de référence déterministe pour la superposition 3 fresques (Moi / Adversaire / Référence)
  const opponentAnswers = useMemo<FresqueLineAnswer[]>(
    () =>
      selectedSet.lines.map((l, idx) => ({
        floorIndex:
          l.reference.floorIndex !== null
            ? Math.max(0, l.reference.floorIndex + (idx % 2 === 0 ? -1 : 0))
            : null,
        islands: [],
      })),
    [selectedSet]
  );

  useEffect(() => {
    if (!active) return;
    openedAtRef.current = performance.now();
    setRemainingMs(FRESQUE_CONFIG.lineLimitMs);
    const id = window.setInterval(() => {
      const elapsed = performance.now() - openedAtRef.current;
      const rem = Math.max(0, FRESQUE_CONFIG.lineLimitMs - elapsed);
      setRemainingMs(rem);
      if (rem <= 0) {
        window.clearInterval(id);
        commitLine(null, FRESQUE_CONFIG.lineLimitMs);
      }
    }, 100);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, lineIdx]);

  const startDuel = () => {
    setActive(true);
    setDebrief(null);
    setLineIdx(0);
    setFloorIndex(null);
    setIslands([]);
    setAnswers([]);
  };

  const commitLine = (ans: FresqueLineAnswer | null, forcedElapsed?: number) => {
    const elapsedMs = forcedElapsed ?? Math.min(FRESQUE_CONFIG.lineLimitMs, performance.now() - openedAtRef.current);
    const nextAnswers = [...answers, { answer: ans, elapsedMs }];
    if (lineIdx + 1 >= selectedSet.lines.length) {
      setActive(false);
      setAnswers(nextAnswers);
      setDebrief(scoreFresqueDuel(selectedSet, nextAnswers, false));
      return;
    }
    setAnswers(nextAnswers);
    setLineIdx(lineIdx + 1);
    setFloorIndex(null);
    setIslands([]);
  };

  const toggleHand = (handIdx: number) => {
    // Clic sur une main : si <= plancher actuel -> déplace le plancher, sinon bascule un îlot ou étend le plancher
    if (floorIndex === null) {
      setFloorIndex(handIdx);
      setIslands((prev) => prev.filter((x) => x > handIdx));
      return;
    }
    if (handIdx <= floorIndex) {
      setFloorIndex(handIdx === floorIndex ? (handIdx === 0 ? null : handIdx - 1) : handIdx);
      return;
    }
    setIslands((prev) => (prev.includes(handIdx) ? prev.filter((x) => x !== handIdx) : [...prev, handIdx]));
  };

  const currentLine = selectedSet.lines[lineIdx];
  const heroIncluded = currentLine
    ? includedHandIndices(currentLine.hands.length, { floorIndex, islands })
    : new Set<number>();

  return (
    <div className="bg-slate-900/95 border border-slate-700 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-violet-400" />
              Fresque Duel — Peins la Range (MP-19)
            </h3>
            <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[11px] font-bold">
              Amical L0 uniquement — Fresque impossible en classé
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            6 lignes de la matrice 13×13 • 25 s/ligne • Frontière (±1 case) comptée ×2 • Pondération combos (6/4/12).
          </p>
        </div>
      </div>

      {!active && !debrief && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {FRESQUE_DRILL_SETS.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSetIdx(idx)}
                className={`text-left p-3.5 rounded-xl border transition ${
                  setIdx === idx
                    ? 'bg-violet-600/20 border-violet-400 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-300'
                }`}
              >
                <div className="font-bold text-sm">{s.title}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">{s.provenanceNote}</div>
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={contrastMode}
              onChange={(e) => setContrastMode(e.target.checked)}
              className="accent-violet-500 w-4 h-4"
            />
            <span>
              Mode Contraste (CO vs BTN) : mettre en avant les cases qui changent entre {selectedSet.position} et{' '}
              {contrastSet.position}
            </span>
          </label>

          <button
            type="button"
            onClick={startDuel}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-extrabold flex items-center gap-2 shadow-lg"
          >
            <Play className="w-4 h-4" />
            Lancer Fresque Duel (6 lignes • Amical)
          </button>
        </div>
      )}

      {active && currentLine && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-bold text-violet-300">
              Ligne {lineIdx + 1} / {selectedSet.lines.length} — {currentLine.label}
            </span>
            <span className="font-mono font-extrabold text-amber-300">
              {(remainingMs / 1000).toFixed(1)}s / 25.0s
            </span>
          </div>

          <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
              <span>
                Plancher :{' '}
                <strong className="text-emerald-300">
                  {floorIndex !== null ? `${currentLine.hands[0]} → ${currentLine.hands[floorIndex]}` : 'Aucun'}
                </strong>{' '}
                • Îlots :{' '}
                <strong className="text-sky-300">
                  {islands.length ? islands.map((i) => currentLine.hands[i]).join(', ') : 'Aucun'}
                </strong>
              </span>
              <input
                type="range"
                aria-label="Curseur plancher"
                min={-1}
                max={currentLine.hands.length - 1}
                value={floorIndex ?? -1}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setFloorIndex(v < 0 ? null : v);
                  setIslands((prev) => prev.filter((x) => x > v));
                }}
                className="w-48 accent-violet-500"
              />
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-13 gap-1.5">
              {currentLine.hands.map((h, hIdx) => {
                const isInc = heroIncluded.has(hIdx);
                const isFloor = floorIndex !== null && hIdx <= floorIndex;
                const isContrastChanged = contrastMode && (contrastMap[currentLine.id] ?? []).includes(h);
                return (
                  <button
                    key={h}
                    type="button"
                    onClick={() => toggleHand(hIdx)}
                    className={`min-h-[44px] rounded-lg border text-xs font-mono font-bold transition ${
                      isFloor
                        ? 'bg-emerald-600/35 border-emerald-400 text-white'
                        : isInc
                          ? 'bg-sky-600/35 border-sky-400 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-600'
                    } ${isContrastChanged ? 'ring-2 ring-amber-400/70' : ''}`}
                  >
                    {h}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap justify-between items-center gap-2 pt-2">
              <span className="text-[11px] text-slate-400">
                Cliquez pour placer le plancher ou ajouter un îlot isolé.
              </span>
              <button
                type="button"
                onClick={() => commitLine({ floorIndex, islands })}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold"
              >
                Valider cette ligne ({lineIdx + 1}/{selectedSet.lines.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {debrief && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950 border border-slate-800 rounded-xl p-3">
            <div className="text-xs sm:text-sm font-extrabold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              Score Fresque Duel (Amical L0) : {debrief.totalPd} PD • {debrief.perfectLines}/6 lignes parfaites
            </div>
            <button
              type="button"
              onClick={() => setDebrief(null)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200"
            >
              Rejouer / Changer
            </button>
          </div>

          <div className="space-y-2.5">
            {selectedSet.lines.map((line, i) => {
              const sc = debrief.lineScores[i];
              const mine = answers[i]?.answer ?? null;
              const mineSet = mine ? includedHandIndices(line.hands.length, mine) : new Set<number>();
              const oppSet = includedHandIndices(line.hands.length, opponentAnswers[i]);
              const refSet = includedHandIndices(line.hands.length, line.reference);
              return (
                <div key={line.id} className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 space-y-2 text-xs">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="font-bold text-white">{line.label}</span>
                    <span className={`font-mono font-bold ${sc.pd === 0 ? 'text-emerald-400' : 'text-amber-300'}`}>
                      {sc.pd} PD ({sc.weightedErrors}/{sc.weightedTotal} combos pondérés)
                    </span>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-13 gap-1">
                    {line.hands.map((h, hIdx) => {
                      const inM = mineSet.has(hIdx);
                      const inO = oppSet.has(hIdx);
                      const inR = refSet.has(hIdx);
                      const match = inM === inR;
                      return (
                        <div
                          key={h}
                          className={`p-1.5 rounded border text-center font-mono text-[10px] ${
                            match
                              ? inR
                                ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                                : 'bg-slate-900 border-slate-800 text-slate-500'
                              : 'bg-rose-950/50 border-rose-500 text-rose-200 animate-pulse'
                          }`}
                        >
                          <div className="font-bold">{h}</div>
                          <div className="text-[9px]">
                            M:{inM ? '✓' : '·'} A:{inO ? '✓' : '·'} R:{inR ? '✓' : '·'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="text-[11px] text-slate-400">{line.note}</div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-2 text-[11px] text-amber-300">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            Rappel : Fresque Duel repose sur des seuils heuristiques (aucun classement MMR).
          </div>
        </div>
      )}
    </div>
  );
};
