import React, { useState } from 'react';
import { Eye, Filter, Layers, Play, ShieldAlert } from 'lucide-react';
import {
  FUNNEL_BLOCKS,
  FUNNEL_CASES,
  TEXTURE_CONFIG,
  TEXTURE_TWIN_BOARDS,
  scoreFunnelWithCounterInquiry,
  scoreTextureSpot,
  type AdvantageAxis,
  type TexturePhase1Answer,
  type TexturePhase2Answer,
  type TextureScoreResult,
} from '../../engines/mp';

export const TextureFunnelPanel: React.FC = () => {
  // === RADAR DE BOARD (MP-22) ===
  const [texRunning, setTexRunning] = useState(false);
  const [texIdx, setTexIdx] = useState(0);
  const [texStep, setTexStep] = useState<'phase1' | 'phase2'>('phase1');
  const [rangeAdv, setRangeAdv] = useState<AdvantageAxis>('IP');
  const [nutsAdv, setNutsAdv] = useState<AdvantageAxis>('IP');
  const [freqPct, setFreqPct] = useState<0 | 25 | 50 | 75 | 100>(75);
  const [sizingPct, setSizingPct] = useState<33 | 50 | 75 | 125>(33);
  const [texResults, setTexResults] = useState<
    { phase1: TexturePhase1Answer; phase2: TexturePhase2Answer; scored: TextureScoreResult }[]
  >([]);
  const [texDone, setTexDone] = useState(false);

  const curTex = TEXTURE_TWIN_BOARDS[texIdx];

  const startTexture = () => {
    setTexRunning(true);
    setTexDone(false);
    setTexIdx(0);
    setTexStep('phase1');
    setRangeAdv('IP');
    setNutsAdv('IP');
    setTexResults([]);
  };

  const submitTexturePhase2 = (actionId: string) => {
    const p1: TexturePhase1Answer = { rangeAdv, nutsAdv };
    const p2: TexturePhase2Answer = { freqPct, sizingPct, actionId };
    const scored = scoreTextureSpot(curTex, p1, p2, 3200, false);
    const next = [...texResults, { phase1: p1, phase2: p2, scored }];
    if (texIdx + 1 >= TEXTURE_TWIN_BOARDS.length) {
      setTexResults(next);
      setTexRunning(false);
      setTexDone(true);
      return;
    }
    setTexResults(next);
    setTexIdx(texIdx + 1);
    setTexStep('phase1');
  };

  // === DÉTECTIVES / ENTONNOIR DE RANGE (MP-22) ===
  const funnelCase = FUNNEL_CASES[0];
  const [funActive, setFunActive] = useState(false);
  const [funStreetIdx, setFunStreetIdx] = useState(0);
  const [funSubStage, setFunSubStage] = useState<'initial' | 'counter_inquiry'>('initial');
  const [weights, setWeights] = useState<Record<string, number>>({
    valeur_forte: 20,
    valeur_moyenne: 25,
    tirages_forts: 20,
    tirages_faibles: 15,
    bluff_catchers: 10,
    air: 10,
  });
  const [initialWeightsSnapshot, setInitialWeightsSnapshot] = useState<Record<string, number> | null>(null);
  const [funHistory, setFunHistory] = useState<
    { street: string; initialPd: number; revisedPd: number; improved: boolean }[]
  >([]);
  const [funDone, setFunDone] = useState(false);

  const curFunStreet = funnelCase.streets[funStreetIdx];

  const startFunnel = () => {
    setFunActive(true);
    setFunDone(false);
    setFunStreetIdx(0);
    setFunSubStage('initial');
    setFunHistory([]);
    setInitialWeightsSnapshot(null);
  };

  const lockInitialFunnel = () => {
    setInitialWeightsSnapshot({ ...weights });
    setFunSubStage('counter_inquiry');
  };

  const lockRevisedFunnel = () => {
    const initW = initialWeightsSnapshot ?? weights;
    const res = scoreFunnelWithCounterInquiry(initW, weights, curFunStreet.referenceWeights);
    const nextHist = [
      ...funHistory,
      {
        street: curFunStreet.street,
        initialPd: res.initialPd,
        revisedPd: res.revisedPd,
        improved: res.improved,
      },
    ];
    if (funStreetIdx + 1 >= funnelCase.streets.length) {
      setFunHistory(nextHist);
      setFunActive(false);
      setFunDone(true);
      return;
    }
    setFunHistory(nextHist);
    setFunStreetIdx(funStreetIdx + 1);
    setFunSubStage('initial');
    setInitialWeightsSnapshot(null);
  };

  return (
    <div className="space-y-5">
      {/* 1. RADAR DE BOARD (TEXTURE SPRINT) */}
      <div className="bg-slate-900/95 border border-slate-700 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-sky-400" />
                Lecture de Board — Sprint Textures Flop
              </h3>
              <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[11px] font-bold">
                Entraînement tactique — Hors classement
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Étape 1 (3 s) : avantage de Range &amp; de Nuts • Étape 2 (5 s) : fréquence &amp; sizing de C-Bet • Débriefing sur flops jumeaux.
            </p>
          </div>
        </div>

        {!texRunning && !texDone && (
          <button
            type="button"
            onClick={startTexture}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-extrabold inline-flex items-center gap-2"
          >
            <Play className="w-4 h-4" /> Démarrer Lecture de Board ({TEXTURE_TWIN_BOARDS.length} flops)
          </button>
        )}

        {texRunning && curTex && curTex.template.public.state.kind === 'texture' && (
          <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 space-y-4 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-sky-300">
                Board {texIdx + 1} / {TEXTURE_TWIN_BOARDS.length} — {curTex.template.public.state.potType}
              </span>
              <span className="font-mono text-amber-300">
                {texStep === 'phase1' ? 'Étape 1 (3s) : Jauges' : 'Étape 2 (5s) : Action & Sizing'}
              </span>
            </div>

            <div className="flex gap-2">
              {curTex.template.public.state.board.map((c) => (
                <span key={c} className="px-3 py-2 rounded-xl bg-white text-slate-900 font-mono font-extrabold text-base">
                  {c}
                </span>
              ))}
            </div>

            {texStep === 'phase1' ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="font-bold text-slate-300 mb-1.5">Avantage de Range</div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['IP', 'neutre', 'OOP'] as const).map((ax) => (
                        <button
                          key={ax}
                          type="button"
                          onClick={() => setRangeAdv(ax)}
                          className={`min-h-[44px] rounded-lg border font-bold ${
                            rangeAdv === ax ? 'bg-sky-600 border-sky-400 text-white' : 'bg-slate-900 border-slate-800 text-slate-300'
                          }`}
                        >
                          {ax}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="font-bold text-slate-300 mb-1.5">Avantage de Nuts</div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['IP', 'neutre', 'OOP'] as const).map((ax) => (
                        <button
                          key={ax}
                          type="button"
                          onClick={() => setNutsAdv(ax)}
                          className={`min-h-[44px] rounded-lg border font-bold ${
                            nutsAdv === ax ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-slate-900 border-slate-800 text-slate-300'
                          }`}
                        >
                          {ax}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setTexStep('phase2')}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-sky-600 text-white font-extrabold"
                >
                  Passer à l’étape 2 (Fréquence &amp; Action)
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-3">
                  <div>
                    <div className="font-bold text-slate-300 mb-1">Fréquence</div>
                    <div className="flex gap-1">
                      {TEXTURE_CONFIG.freqSteps.map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setFreqPct(f)}
                          className={`px-2.5 py-1.5 rounded-lg border font-mono font-bold ${
                            freqPct === f ? 'bg-sky-600 border-sky-400 text-white' : 'bg-slate-900 border-slate-800 text-slate-300'
                          }`}
                        >
                          {f}%
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="font-bold text-slate-300 mb-1">Sizing</div>
                    <div className="flex gap-1">
                      {TEXTURE_CONFIG.sizingsPct.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSizingPct(s)}
                          className={`px-2.5 py-1.5 rounded-lg border font-mono font-bold ${
                            sizingPct === s ? 'bg-amber-600 border-amber-400 text-white' : 'bg-slate-900 border-slate-800 text-slate-300'
                          }`}
                        >
                          {s}%
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {curTex.template.public.state.options.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => submitTexturePhase2(opt.id)}
                      className="min-h-[44px] px-3 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/35 border border-emerald-500/40 text-white font-bold"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {texDone && (
          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center bg-slate-950 border border-slate-800 rounded-xl p-3">
              <span className="font-extrabold text-white">Débriefing Flops Jumeaux côte à côte</span>
              <button type="button" onClick={startTexture} className="px-3 py-1 rounded bg-slate-800 text-slate-200 font-bold">
                Rejouer
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {TEXTURE_TWIN_BOARDS.map((b, idx) => {
                const res = texResults[idx];
                const boardTxt = b.template.public.state.kind === 'texture' ? b.template.public.state.board.join(' ') : '';
                return (
                  <div key={b.template.id} className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1">
                    <div className="flex justify-between font-bold text-white">
                      <span>Board {boardTxt}</span>
                      <span className="text-sky-300">Jauges : {res?.scored.gaugesCorrect ?? 0}/2</span>
                    </div>
                    <div className="text-slate-300">{b.explanation}</div>
                    <div className="text-[10px] text-slate-500">
                      Attendu : Range {b.expectedPhase1.rangeAdv} / Nuts {b.expectedPhase1.nutsAdv} • Fréq {b.expectedPhase2.freqPct}% ({b.expectedPhase2.sizingPct}%)
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 2. DÉTECTIVES (ENTONNOIR DE RANGE + CONTRE-ENQUÊTE) */}
      <div className="bg-slate-900/95 border border-slate-700 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Filter className="w-4 h-4 text-amber-400" />
                Hand Reading — L’Entonnoir de Range
              </h3>
              <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[11px] font-bold">
                Lecture adverse — Hors classement
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Affinez la range de Vilain rue par rue (Flop → Turn → River), puis confrontez votre lecture à celle d’un autre joueur avant de verrouiller.
            </p>
          </div>
        </div>

        {!funActive && !funDone && (
          <div className="space-y-3 text-xs">
            <ul className="list-disc list-inside text-slate-300 space-y-0.5">
              {funnelCase.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
            <button
              type="button"
              onClick={startFunnel}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-extrabold inline-flex items-center gap-2"
            >
              <Play className="w-4 h-4" /> Analyser la main ({funnelCase.streets.length} rues)
            </button>
          </div>
        )}

        {funActive && curFunStreet && (
          <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 space-y-4 text-xs">
            <div className="flex flex-wrap justify-between gap-2">
              <span className="font-extrabold text-amber-300">
                {curFunStreet.street} ({funStreetIdx + 1}/{funnelCase.streets.length}) — {curFunStreet.observedAction}
              </span>
              <span className="font-mono text-sky-300">Board : {curFunStreet.board.join(' ')}</span>
            </div>

            {funSubStage === 'counter_inquiry' && (
              <div className="bg-sky-950/35 border border-sky-500/40 rounded-xl p-3 space-y-1.5">
                <div className="font-bold text-sky-200 flex items-center gap-1.5">
                  <Eye className="w-4 h-4" /> Comparaison : lecture d’un autre joueur (1 ajustement possible avant la correction)
                </div>
                <div className="flex flex-wrap gap-2 font-mono text-[11px] text-slate-300">
                  {FUNNEL_BLOCKS.map((b) => (
                    <span key={b.id} className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                      {b.label} : {curFunStreet.peerInitialWeights[b.id] ?? 0}%
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {FUNNEL_BLOCKS.map((b) => (
                <div key={b.id} className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 space-y-1">
                  <div className="flex justify-between font-bold text-slate-200">
                    <span>{b.label}</span>
                    <span className="font-mono text-amber-300">{weights[b.id] ?? 0}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={weights[b.id] ?? 0}
                    onChange={(e) => setWeights({ ...weights, [b.id]: Number(e.target.value) })}
                    className="w-full accent-amber-500"
                  />
                </div>
              ))}
            </div>

            {funSubStage === 'initial' ? (
              <button
                type="button"
                onClick={lockInitialFunnel}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-sky-600 text-white font-extrabold"
              >
                Verrouiller ma 1re lecture → Comparer
              </button>
            ) : (
              <button
                type="button"
                onClick={lockRevisedFunnel}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-600 text-white font-extrabold"
              >
                Valider ma lecture finale ({curFunStreet.street})
              </button>
            )}
          </div>
        )}

        {funDone && (
          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between items-center bg-slate-950 border border-slate-800 rounded-xl p-3">
              <span className="font-extrabold text-white">Bilan Hand Reading (Flop → River)</span>
              <button type="button" onClick={startFunnel} className="px-3 py-1 rounded bg-slate-800 text-slate-200 font-bold">
                Rejouer
              </button>
            </div>
            {funHistory.map((h, i) => (
              <div key={h.street} className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1">
                <div className="flex justify-between font-bold">
                  <span className="text-white">{h.street}</span>
                  <span className="font-mono text-emerald-300">
                    1re lecture : {h.initialPd} PD → Finale : {h.revisedPd} PD {h.improved ? '(affinée)' : ''}
                  </span>
                </div>
                <div className="text-slate-300">{funnelCase.streets[i]?.explanation}</div>
              </div>
            ))}
            <div className="flex items-center gap-2 text-[11px] text-amber-300">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              Les ateliers Lecture de Board et Hand Reading sont des entraînements tactiques hors classement officiel.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
