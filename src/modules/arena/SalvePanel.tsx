import React, { useEffect, useRef, useState } from 'react';
import { Flame, Play, Zap } from 'lucide-react';
import {
  SALVE_CONFIG,
  SALVE_SPOTS,
  scoreSolution,
  totals,
  type SpotScore,
} from '../../engines/mp';

export const SalvePanel: React.FC = () => {
  const [running, setRunning] = useState(false);
  const [idx, setIdx] = useState(0);
  const [remainingMs, setRemainingMs] = useState<number>(SALVE_CONFIG.limitMs);
  const [choices, setChoices] = useState<(string | null)[]>([]);
  const [scores, setScores] = useState<SpotScore[]>([]);
  const [done, setDone] = useState(false);
  const openedAtRef = useRef<number>(0);

  const currentSpec = SALVE_SPOTS[idx];

  const startSalve = () => {
    setRunning(true);
    setDone(false);
    setIdx(0);
    setChoices([]);
    setScores([]);
    openedAtRef.current = performance.now();
    setRemainingMs(SALVE_CONFIG.limitMs);
  };

  const lockChoice = (action: string | null) => {
    if (!running || !currentSpec) return;
    const elapsed =
      action === null
        ? SALVE_CONFIG.limitMs + 50
        : Math.min(SALVE_CONFIG.limitMs, Math.max(50, performance.now() - openedAtRef.current));
    const scored = scoreSolution(
      currentSpec.template.solution,
      action,
      elapsed,
      SALVE_CONFIG.limitMs,
      false,
      false
    ).score;

    const nextChoices = [...choices, action];
    const nextScores = [...scores, scored];

    if (idx + 1 >= SALVE_SPOTS.length) {
      setRunning(false);
      setDone(true);
      setChoices(nextChoices);
      setScores(nextScores);
      return;
    }

    setChoices(nextChoices);
    setScores(nextScores);
    setIdx(idx + 1);
    openedAtRef.current = performance.now();
    setRemainingMs(SALVE_CONFIG.limitMs);
  };

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const elapsed = performance.now() - openedAtRef.current;
      const rem = Math.max(0, SALVE_CONFIG.limitMs - elapsed);
      setRemainingMs(rem);
      if (rem <= 0) {
        window.clearInterval(id);
        lockChoice(null);
      }
    }, 80);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, idx]);

  useEffect(() => {
    if (!running || !currentSpec) return;
    const state = currentSpec.template.public.state;
    if (state.kind !== 'decision') return;
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'f') {
        e.preventDefault();
        lockChoice('fold');
      } else if (k === 'r' || k === 'c') {
        const primary = state.options.find((o) => o.id !== 'fold');
        if (primary) {
          e.preventDefault();
          lockChoice(primary.id);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, idx, currentSpec]);

  const sumTotals = totals(scores);

  return (
    <div className="bg-slate-900/95 border border-slate-700 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              Sprint Expresso &amp; 3-Max — Rafale 15 Spots
            </h3>
            <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold">
              Solutions Push/Fold exactes (ChipEV &amp; Jackpot)
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            12 décisions en rafale + 3 spots « Mort Subite » • 4 s/spot • Inclut un spot Jackpot 80/12/8 (Risk Premium 1,35 pt).
          </p>
        </div>
      </div>

      {!running && !done && (
        <div className="space-y-3">
          <p className="text-xs text-slate-300">
            Raccourcis clavier pendant le sprint : <code className="px-1.5 py-0.5 bg-slate-800 rounded">R</code> ou{' '}
            <code className="px-1.5 py-0.5 bg-slate-800 rounded">C</code> (Push / Call),{' '}
            <code className="px-1.5 py-0.5 bg-slate-800 rounded">F</code> (Fold).
          </p>
          <button
            type="button"
            onClick={startSalve}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-extrabold flex items-center gap-2 shadow-lg"
          >
            <Play className="w-4 h-4" />
            Démarrer le Sprint 3-Max (15 spots)
          </button>
        </div>
      )}

      {running && currentSpec && currentSpec.template.public.state.kind === 'decision' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-white">
                Spot {idx + 1} / {SALVE_SPOTS.length}
              </span>
              {currentSpec.suddenDeath && (
                <span className="px-2 py-0.5 rounded-lg bg-rose-600/30 border border-rose-500 text-rose-200 font-extrabold flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5" /> Mort Subite (même barème PD)
                </span>
              )}
            </div>
            <span className="font-mono font-extrabold text-amber-300">{(remainingMs / 1000).toFixed(1)}s / 4.0s</span>
          </div>

          <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="text-xs text-sky-300 font-bold">
              Modèle adverse : {currentSpec.template.public.state.villainModel}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
              <span>
                Position : <strong className="text-white">{currentSpec.template.public.state.hero}</strong>
              </span>
              <span>
                Tapis effectif :{' '}
                <strong className="text-white">{currentSpec.template.public.context.effectiveStackBb} bb</strong>
              </span>
              <div className="flex items-center gap-1.5 font-mono font-extrabold">
                {currentSpec.template.public.state.heroCards.map((c) => (
                  <span key={c} className="px-2 py-1 rounded bg-white text-slate-900 border border-slate-300">
                    {c}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
              {currentSpec.template.public.state.options.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => lockChoice(opt.id)}
                  className="min-h-[44px] px-4 py-3 rounded-xl bg-slate-900 hover:bg-amber-600/25 border border-slate-700 text-sm font-extrabold text-white"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {done && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950 border border-slate-800 rounded-xl p-3">
            <div className="text-xs sm:text-sm font-extrabold text-white">
              Bilan Sprint 3-Max : {sumTotals.pd} PD • {sumTotals.perfects}/{SALVE_SPOTS.length} Perfects •{' '}
              {(sumTotals.ms / 1000).toFixed(1)}s
            </div>
            <button
              type="button"
              onClick={startSalve}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200"
            >
              Rejouer
            </button>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {SALVE_SPOTS.map((sp, i) => {
              const sc = scores[i];
              return (
                <div key={sp.template.id} className="bg-slate-950/90 border border-slate-800 rounded-xl p-2.5 text-xs space-y-1">
                  <div className="flex justify-between gap-2 font-bold">
                    <span className="text-white">
                      #{i + 1} {sp.suddenDeath ? '🔥 Mort Subite' : sp.model.format.toUpperCase()} — {sp.model.name}
                    </span>
                    <span className={sc?.pd === 0 ? 'text-emerald-400 font-mono' : 'text-rose-300 font-mono'}>
                      {sc?.pd ?? 0} PD (choix: {choices[i] ?? 'timeout'})
                    </span>
                  </div>
                  <div className="text-slate-300">{sp.explanation}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
