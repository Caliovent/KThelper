import React, { useEffect, useMemo, useState } from 'react';
import { blockerImpact, comboCount } from '../../engines/chunk.ts';
import { MATRIX_HANDS } from '../../engines/evolutionaryFunnel.ts';
import {
  applyVillainProfileAdaptation,
  buildDefenseDrillQuestions,
  computeRange3BetStats,
  DEFENSE_ACTION_META,
  exportHandsToNotation,
  handsArrayToMap,
  parseNotationIntoHands,
  VILLAIN_PROFILE_META,
  type DefenseAction3Bet,
  type DefenseDrillQuestion,
  type Range3BetSpot,
  type SpotPositionKey,
  type Villain3BetProfile,
} from '../../engines/rangeBuilder3Bet.ts';
import {
  createCustomSpot,
  loadRange3BetState,
  resetPresetSpot,
  saveRange3BetState,
  type CustomRange3BetStoreState,
} from '../../stores/customRange3BetStore.ts';

type BuilderStep = 'open' | 'defense' | 'drill';

const HERO_POSITIONS: SpotPositionKey[] = ['UTG', 'MP', 'CO', 'BTN', 'SB'];
const VILLAIN_POSITIONS = ['MP', 'CO', 'BTN', 'SB', 'BB'];
const DEFENSE_ACTIONS: DefenseAction3Bet[] = ['fourbet_value', 'fourbet_bluff', 'call', 'fold'];

export const Range3BetBuilder: React.FC = () => {
  const [storeState, setStoreState] = useState<CustomRange3BetStoreState>(() => loadRange3BetState());
  const [step, setStep] = useState<BuilderStep>('open');
  const [openPaintMode, setOpenPaintMode] = useState<'add' | 'remove'>('add');
  const [defenseBrush, setDefenseBrush] = useState<DefenseAction3Bet>('fourbet_bluff');
  const [hoveredHand, setHoveredHand] = useState<string>('A5s');
  const [isPainting, setIsPainting] = useState(false);

  // Spot creation / rename / notation inputs
  const [showNewForm, setShowNewForm] = useState(false);
  const [newLabel, setNewLabel] = useState('CO vs BB 3-Bet Custom');
  const [newHeroPos, setNewHeroPos] = useState<SpotPositionKey>('CO');
  const [newVillainPos, setNewVillainPos] = useState<string>('BB');
  const [newIsIP, setNewIsIP] = useState<boolean>(true);

  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [notationInput, setNotationInput] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Serious Game Step 3 Drill State
  const [drillSeed, setDrillSeed] = useState<number>(101);
  const [drillIdx, setDrillIdx] = useState<number>(0);
  const [selectedAnswer, setSelectedAnswer] = useState<DefenseAction3Bet | null>(null);
  const [drillScore, setDrillScore] = useState<{ correct: number; total: number }>({
    correct: 0,
    total: 0,
  });

  useEffect(() => {
    saveRange3BetState(storeState);
  }, [storeState]);

  useEffect(() => {
    if (!isPainting) return;
    const stop = () => setIsPainting(false);
    window.addEventListener('pointerup', stop);
    return () => window.removeEventListener('pointerup', stop);
  }, [isPainting]);

  const activeSpot = useMemo(
    () =>
      storeState.spots.find((s) => s.id === storeState.activeSpotId) ?? storeState.spots[0],
    [storeState],
  );

  const stats = useMemo(() => computeRange3BetStats(activeSpot), [activeSpot]);

  const drillQuestions = useMemo<DefenseDrillQuestion[]>(
    () => buildDefenseDrillQuestions(activeSpot, 8, drillSeed),
    [activeSpot, drillSeed],
  );

  const currentQuestion = drillQuestions[drillIdx] ?? null;

  const blockers = useMemo(() => blockerImpact(hoveredHand), [hoveredHand]);

  const notations = useMemo(() => {
    const openList: string[] = [];
    const valList: string[] = [];
    const bluffList: string[] = [];
    const callList: string[] = [];
    const foldList: string[] = [];

    for (const m of MATRIX_HANDS) {
      if (!activeSpot.openHands[m.hand]) continue;
      openList.push(m.hand);
      const act = activeSpot.defenseMap[m.hand] ?? 'fold';
      if (act === 'fourbet_value') valList.push(m.hand);
      else if (act === 'fourbet_bluff') bluffList.push(m.hand);
      else if (act === 'call') callList.push(m.hand);
      else foldList.push(m.hand);
    }

    return {
      open: exportHandsToNotation(openList),
      fourbet_value: exportHandsToNotation(valList),
      fourbet_bluff: exportHandsToNotation(bluffList),
      call: exportHandsToNotation(callList),
      fold: exportHandsToNotation(foldList),
    };
  }, [activeSpot]);

  const updateActiveSpot = (updater: (spot: Range3BetSpot) => Range3BetSpot) => {
    setStoreState((prev) => ({
      ...prev,
      spots: prev.spots.map((s) => (s.id === prev.activeSpotId ? updater(s) : s)),
    }));
  };

  const resetDrillSession = (nextSeed?: number) => {
    setDrillSeed(nextSeed ?? Date.now());
    setDrillIdx(0);
    setSelectedAnswer(null);
    setDrillScore({ correct: 0, total: 0 });
  };

  const handleSelectSpot = (spotId: string) => {
    setStoreState((prev) => ({ ...prev, activeSpotId: spotId }));
    setIsRenaming(false);
    setStatusMessage(null);
    resetDrillSession(101);
  };

  const handleCreateSpot = (e: React.FormEvent) => {
    e.preventDefault();
    const created = createCustomSpot({
      label: newLabel,
      heroPos: newHeroPos,
      villainPos: newVillainPos,
      isIP: newIsIP,
    });
    setStoreState((prev) => ({
      ...prev,
      activeSpotId: created.id,
      spots: [created, ...prev.spots],
    }));
    setShowNewForm(false);
    setStatusMessage(`Spot « ${created.label} » créé.`);
    resetDrillSession(101);
  };

  const handleDuplicateSpot = () => {
    const duplicated = createCustomSpot({
      label: `${activeSpot.label} (Copie)`,
      heroPos: activeSpot.heroPos,
      villainPos: activeSpot.villainPos,
      isIP: activeSpot.isIP,
      openSizeBb: activeSpot.openSizeBb,
      threeBetSizeBb: activeSpot.threeBetSizeBb,
      fourBetSizeBb: activeSpot.fourBetSizeBb,
      seedFromSpot: activeSpot,
    });
    setStoreState((prev) => ({
      ...prev,
      activeSpotId: duplicated.id,
      spots: [duplicated, ...prev.spots],
    }));
    setStatusMessage(`Spot dupliqué sous « ${duplicated.label} ».`);
    resetDrillSession(101);
  };

  const handleConfirmRename = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = renameValue.trim();
    if (!trimmed) return;
    updateActiveSpot((s) => ({ ...s, label: trimmed, updatedAt: Date.now() }));
    setIsRenaming(false);
    setStatusMessage(`Spot renommé en « ${trimmed} ».`);
  };

  const handleResetOrDelete = () => {
    if (activeSpot.isCustom) {
      setStoreState((prev) => {
        const remaining = prev.spots.filter((s) => s.id !== prev.activeSpotId);
        return {
          ...prev,
          activeSpotId: remaining[0]?.id ?? '',
          spots: remaining,
        };
      });
      setStatusMessage(`Spot personnalisé supprimé.`);
      resetDrillSession(101);
      return;
    }
    const fresh = resetPresetSpot(activeSpot.id);
    if (!fresh) return;
    updateActiveSpot(() => fresh);
    setStatusMessage(`Preset réinitialisé aux valeurs Kill Tilt.`);
    resetDrillSession(101);
  };

  const paintOpenHand = (hand: string, mode: 'add' | 'remove') => {
    updateActiveSpot((spot) => {
      const nextOpen = { ...spot.openHands };
      const nextDefense = { ...spot.defenseMap };
      if (mode === 'add') {
        nextOpen[hand] = true;
        if (!nextDefense[hand]) nextDefense[hand] = 'fold';
      } else {
        delete nextOpen[hand];
        delete nextDefense[hand];
      }
      return { ...spot, openHands: nextOpen, defenseMap: nextDefense, updatedAt: Date.now() };
    });
  };

  const paintDefenseHand = (hand: string, action: DefenseAction3Bet) => {
    updateActiveSpot((spot) => {
      if (!spot.openHands[hand]) return spot;
      return {
        ...spot,
        defenseMap: { ...spot.defenseMap, [hand]: action },
        updatedAt: Date.now(),
      };
    });
  };

  const handleImportOpenNotation = () => {
    const parsed = parseNotationIntoHands(notationInput);
    if (parsed.length === 0) {
      setStatusMessage('Aucune main valide détectée (ex: 66+, ATs+, KQo).');
      return;
    }
    const nextOpen = handsArrayToMap(parsed);
    updateActiveSpot((spot) => {
      const nextDefense: Record<string, DefenseAction3Bet> = {};
      for (const h of parsed) {
        nextDefense[h] = spot.defenseMap[h] ?? 'fold';
      }
      return { ...spot, openHands: nextOpen, defenseMap: nextDefense, updatedAt: Date.now() };
    });
    setStatusMessage(`${parsed.length} mains importées dans la range Open.`);
    setNotationInput('');
  };

  const handleImportDefenseNotation = () => {
    const parsed = parseNotationIntoHands(notationInput);
    if (parsed.length === 0) {
      setStatusMessage('Aucune main valide détectée.');
      return;
    }
    let applied = 0;
    updateActiveSpot((spot) => {
      const nextDefense = { ...spot.defenseMap };
      for (const h of parsed) {
        if (spot.openHands[h]) {
          nextDefense[h] = defenseBrush;
          applied++;
        }
      }
      return { ...spot, defenseMap: nextDefense, updatedAt: Date.now() };
    });
    setStatusMessage(
      `${applied} main(s) présente(s) dans l'Open assignées à « ${DEFENSE_ACTION_META[defenseBrush].shortLabel} ».`,
    );
    setNotationInput('');
  };

  const handleAdaptToProfile = (profile: Villain3BetProfile) => {
    updateActiveSpot((spot) => applyVillainProfileAdaptation(spot, profile));
    setStatusMessage(`Défense adaptée au profil ${VILLAIN_PROFILE_META[profile].label}.`);
    resetDrillSession(101);
  };

  const handleCopyText = async (key: string, text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    } catch {
      setStatusMessage('Copie presse-papier indisponible dans ce navigateur.');
    }
  };

  const handleAnswerDrill = (answer: DefenseAction3Bet) => {
    if (!currentQuestion || selectedAnswer !== null) return;
    setSelectedAnswer(answer);
    const isOk = answer === currentQuestion.expectedAction;
    setDrillScore((prev) => ({
      correct: prev.correct + (isOk ? 1 : 0),
      total: prev.total + 1,
    }));
  };

  return (
    <div
      data-testid="range-3bet-builder"
      className="space-y-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-3 sm:p-5 text-slate-100 min-w-0"
    >
      {/* Header + Kill Tilt Video Correlation */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
              🎯 Constructeur Open &amp; Défense vs 3-Bet / 4-Bet
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
              Provenance : {activeSpot.provenance.origin}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 max-w-3xl">
            Construisez votre <strong className="text-emerald-300">range d’Open (Étape 1)</strong>, puis peignez votre{' '}
            <strong className="text-rose-300">4-Bet Value</strong>,{' '}
            <strong className="text-violet-300">4-Bet Bluff (bloqueurs)</strong>,{' '}
            <strong className="text-emerald-300">Call</strong> et <strong className="text-slate-200">Fold</strong>{' '}
            strictement sur les mains que vous avez ouvertes (Étape 2).
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <a
              href="https://www.youtube.com/watch?v=ba8aJzFIWy4"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 hover:border-emerald-500/60 text-[11px] font-semibold text-emerald-300 transition"
            >
              🎬 Bases Cash Game #2 : Quelles mains ouvrir
            </a>
            <a
              href="https://www.youtube.com/watch?v=8CNioOWy1fQ"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 hover:border-violet-500/60 text-[11px] font-semibold text-violet-300 transition"
            >
              🎬 Bases Cash Game #3 : Défense vs 3-Bet &amp; 4-Bet
            </a>
          </div>
        </div>

        {/* Step Switcher */}
        <div className="flex flex-wrap gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 shrink-0">
          <button
            type="button"
            data-testid="tab-step-open"
            onClick={() => setStep('open')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              step === 'open'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            1. Étape 1 : Range d&apos;Open
          </button>
          <button
            type="button"
            data-testid="tab-step-defense"
            onClick={() => setStep('defense')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              step === 'defense'
                ? 'bg-violet-600 text-white shadow'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            2. Étape 2 : Défense vs 3-Bet &amp; 4-Bet
          </button>
          <button
            type="button"
            data-testid="tab-step-drill"
            onClick={() => {
              setStep('drill');
              resetDrillSession(101);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              step === 'drill'
                ? 'bg-amber-600 text-white shadow'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            3. Étape 3 : Tester ma Défense
          </button>
        </div>
      </div>

      {/* Spot Selector + Custom Spot CRUD */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
            <label htmlFor="builder-spot-select" className="text-xs font-bold text-slate-400">
              Spot actif :
            </label>
            <select
              id="builder-spot-select"
              data-testid="spot-selector"
              value={activeSpot.id}
              onChange={(e) => handleSelectSpot(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm font-semibold text-white max-w-full"
            >
              {storeState.spots.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.isCustom ? `★ ${s.label}` : s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              data-testid="btn-new-spot"
              onClick={() => setShowNewForm((v) => !v)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/30 transition"
            >
              + Nouveau spot
            </button>
            <button
              type="button"
              data-testid="btn-duplicate-spot"
              onClick={handleDuplicateSpot}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 transition"
            >
              Dupliquer
            </button>
            <button
              type="button"
              data-testid="btn-rename-spot"
              onClick={() => {
                setRenameValue(activeSpot.label);
                setIsRenaming((v) => !v);
              }}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 transition"
            >
              Renommer
            </button>
            <button
              type="button"
              data-testid="btn-reset-or-delete-spot"
              onClick={handleResetOrDelete}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-950/60 text-rose-300 border border-rose-500/30 hover:bg-rose-900/50 transition"
            >
              {activeSpot.isCustom ? 'Supprimer' : 'Réinitialiser'}
            </button>
          </div>
        </div>

        {/* New Custom Spot Form */}
        {showNewForm && (
          <form
            onSubmit={handleCreateSpot}
            data-testid="new-spot-form"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 pt-2 border-t border-slate-800"
          >
            <input
              type="text"
              data-testid="input-new-spot-label"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Nom du spot (ex: CO vs BB 3-Bet)"
              className="sm:col-span-2 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
              required
            />
            <select
              value={newHeroPos}
              onChange={(e) => setNewHeroPos(e.target.value as SpotPositionKey)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
            >
              {HERO_POSITIONS.map((p) => (
                <option key={p} value={p}>
                  Hero {p}
                </option>
              ))}
            </select>
            <select
              value={newVillainPos}
              onChange={(e) => setNewVillainPos(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
            >
              {VILLAIN_POSITIONS.map((p) => (
                <option key={p} value={p}>
                  Vilain 3-Bet {p}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newIsIP}
                  onChange={(e) => setNewIsIP(e.target.checked)}
                />
                Hero IP
              </label>
              <button
                type="submit"
                data-testid="btn-create-spot-submit"
                className="ml-auto px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500"
              >
                Créer
              </button>
            </div>
          </form>
        )}

        {/* Rename Form */}
        {isRenaming && (
          <form onSubmit={handleConfirmRename} className="flex flex-wrap gap-2 pt-2 border-t border-slate-800">
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="flex-1 min-w-[200px] bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white"
            >
              Enregistrer
            </button>
          </form>
        )}

        {/* Sizings & Villain Profile Calibration */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pt-2 border-t border-slate-800/80">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <label className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1">
              <span className="text-slate-400">Open</span>
              <input
                type="number"
                step="0.5"
                min="2"
                max="6"
                value={activeSpot.openSizeBb}
                onChange={(e) =>
                  updateActiveSpot((s) => ({
                    ...s,
                    openSizeBb: Math.max(2, Number(e.target.value) || 2.5),
                  }))
                }
                className="w-12 bg-transparent text-white font-mono text-right focus:outline-none"
              />
              <span className="text-slate-400">bb</span>
            </label>
            <label className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1">
              <span className="text-slate-400">3-Bet</span>
              <input
                type="number"
                step="0.5"
                min="4"
                max="20"
                value={activeSpot.threeBetSizeBb}
                onChange={(e) =>
                  updateActiveSpot((s) => ({
                    ...s,
                    threeBetSizeBb: Math.max(4, Number(e.target.value) || 8.5),
                  }))
                }
                className="w-12 bg-transparent text-white font-mono text-right focus:outline-none"
              />
              <span className="text-slate-400">bb</span>
            </label>
            <label className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1">
              <span className="text-slate-400">4-Bet</span>
              <input
                type="number"
                step="0.5"
                min="12"
                max="40"
                value={activeSpot.fourBetSizeBb}
                onChange={(e) =>
                  updateActiveSpot((s) => ({
                    ...s,
                    fourBetSizeBb: Math.max(12, Number(e.target.value) || 21),
                  }))
                }
                className="w-12 bg-transparent text-white font-mono text-right focus:outline-none"
              />
              <span className="text-slate-400">bb</span>
            </label>
            <button
              type="button"
              onClick={() => updateActiveSpot((s) => ({ ...s, isIP: !s.isIP }))}
              className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs font-bold text-cyan-300"
            >
              {activeSpot.isIP ? 'Hero IP (En position)' : 'Hero OOP (Hors position)'}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-400 mr-1">Profil Vilain :</span>
            {(['nit', 'reg', 'aggro'] as Villain3BetProfile[]).map((p) => (
              <button
                key={p}
                type="button"
                data-testid={`btn-profile-${p}`}
                onClick={() => updateActiveSpot((s) => ({ ...s, villainProfile: p }))}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                  activeSpot.villainProfile === p
                    ? 'bg-cyan-600/30 border-cyan-400 text-cyan-200'
                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                }`}
              >
                {p === 'nit' ? 'Nit (3-4%)' : p === 'reg' ? 'Reg (7-9%)' : 'LAG Aggro (12%+)'}
              </button>
            ))}
            <button
              type="button"
              data-testid="btn-adapt-profile"
              onClick={() => handleAdaptToProfile(activeSpot.villainProfile)}
              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition"
            >
              ⚡ Adapter au profil
            </button>
          </div>
        </div>

        <p className="text-[11px] text-slate-400">
          {VILLAIN_PROFILE_META[activeSpot.villainProfile].summary}
        </p>

        {statusMessage && (
          <div
            data-testid="builder-status-msg"
            className="text-xs font-medium text-emerald-300 bg-emerald-950/50 border border-emerald-500/30 rounded-lg px-3 py-1.5"
          >
            {statusMessage}
          </div>
        )}
      </div>

      {/* Main Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4 min-w-0">
        {/* Left: Matrix or Serious Game Drill */}
        <div className="space-y-3 min-w-0">
          {step === 'open' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/60 border border-slate-800 rounded-xl p-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-400">Pinceau Open :</span>
                  <button
                    type="button"
                    data-testid="open-brush-add"
                    onClick={() => setOpenPaintMode('add')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                      openPaintMode === 'add'
                        ? 'bg-emerald-600 border-emerald-400 text-white'
                        : 'bg-slate-900 border-slate-700 text-slate-300'
                    }`}
                  >
                    + Ajouter à l&apos;Open
                  </button>
                  <button
                    type="button"
                    data-testid="open-brush-remove"
                    onClick={() => setOpenPaintMode('remove')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                      openPaintMode === 'remove'
                        ? 'bg-rose-600 border-rose-400 text-white'
                        : 'bg-slate-900 border-slate-700 text-slate-300'
                    }`}
                  >
                    − Retirer de l&apos;Open
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <input
                    type="text"
                    data-testid="input-import-open"
                    value={notationInput}
                    onChange={(e) => setNotationInput(e.target.value)}
                    placeholder="Notation (ex: 66+, ATs+, KQo)"
                    className="w-48 sm:w-56 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                  />
                  <button
                    type="button"
                    data-testid="btn-import-open"
                    onClick={handleImportOpenNotation}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700"
                  >
                    Importer Open
                  </button>
                </div>
              </div>

              <div
                data-testid="builder-matrix-open"
                className="matrix-grid select-none"
                style={{ touchAction: 'none' }}
              >
                {MATRIX_HANDS.map(({ hand, handType }) => {
                  const inOpen = Boolean(activeSpot.openHands[hand]);
                  const bgClass = inOpen
                    ? 'bg-emerald-600/85 text-white border-emerald-400'
                    : handType === 'pair'
                      ? 'bg-slate-900/90 text-slate-400 border-slate-800'
                      : 'bg-slate-950/90 text-slate-500 border-slate-800/80';

                  return (
                    <button
                      key={hand}
                      type="button"
                      data-hand={hand}
                      data-in-open={inOpen ? 'true' : 'false'}
                      onPointerDown={() => {
                        setIsPainting(true);
                        setHoveredHand(hand);
                        paintOpenHand(hand, openPaintMode);
                      }}
                      onPointerEnter={() => {
                        setHoveredHand(hand);
                        if (isPainting) paintOpenHand(hand, openPaintMode);
                      }}
                      className={`hand-cell border text-[9px] sm:text-[11px] font-bold transition ${bgClass}`}
                    >
                      {hand}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 'defense' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/60 border border-slate-800 rounded-xl p-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-400">Pinceau Défense :</span>
                  {DEFENSE_ACTIONS.map((act) => {
                    const meta = DEFENSE_ACTION_META[act];
                    const selected = defenseBrush === act;
                    return (
                      <button
                        key={act}
                        type="button"
                        data-testid={`brush-${act}`}
                        onClick={() => setDefenseBrush(act)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                          selected
                            ? `${meta.cellClass} ring-2 ring-white/40`
                            : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        {meta.shortLabel}
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <input
                    type="text"
                    data-testid="input-import-defense"
                    value={notationInput}
                    onChange={(e) => setNotationInput(e.target.value)}
                    placeholder={`Assigner à ${DEFENSE_ACTION_META[defenseBrush].shortLabel}`}
                    className="w-44 sm:w-52 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                  />
                  <button
                    type="button"
                    onClick={handleImportDefenseNotation}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-violet-300 border border-slate-700"
                  >
                    Appliquer
                  </button>
                </div>
              </div>

              <div className="text-[11px] text-slate-400">
                Les cases grisées sont hors de votre range d’Open et verrouillées : peignez uniquement vos{' '}
                <strong className="text-white">{stats.openCombos} combos</strong> ouverts.
              </div>

              <div
                data-testid="builder-matrix-defense"
                className="matrix-grid select-none"
                style={{ touchAction: 'none' }}
              >
                {MATRIX_HANDS.map(({ hand }) => {
                  const inOpen = Boolean(activeSpot.openHands[hand]);
                  const action: DefenseAction3Bet = activeSpot.defenseMap[hand] ?? 'fold';
                  const meta = DEFENSE_ACTION_META[action];

                  if (!inOpen) {
                    return (
                      <button
                        key={hand}
                        type="button"
                        disabled
                        data-hand={hand}
                        data-in-open="false"
                        title={`${hand} — Non ouverte à l'étape 1`}
                        className="hand-cell border border-slate-800/40 bg-slate-950/60 text-slate-600 opacity-25 cursor-not-allowed text-[9px] sm:text-[11px] font-semibold"
                      >
                        {hand}
                      </button>
                    );
                  }

                  return (
                    <button
                      key={hand}
                      type="button"
                      data-hand={hand}
                      data-in-open="true"
                      data-action={action}
                      onPointerDown={() => {
                        setIsPainting(true);
                        setHoveredHand(hand);
                        paintDefenseHand(hand, defenseBrush);
                      }}
                      onPointerEnter={() => {
                        setHoveredHand(hand);
                        if (isPainting) paintDefenseHand(hand, defenseBrush);
                      }}
                      title={`${hand} — ${meta.label}`}
                      className={`hand-cell border text-[9px] sm:text-[11px] font-bold transition ${meta.cellClass}`}
                    >
                      {hand}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 'drill' && (
            <div
              data-testid="defense-drill-panel"
              className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4"
            >
              {!currentQuestion ? (
                <div className="text-sm text-slate-300 space-y-2">
                  <p>Aucune main dans votre range d&apos;Open pour ce spot.</p>
                  <button
                    type="button"
                    onClick={() => setStep('open')}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold"
                  >
                    Retourner à l&apos;Étape 1
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-amber-300">
                        Serious Game — Drill Défense vs 3-Bet ({drillIdx + 1}/{drillQuestions.length})
                      </div>
                      <div className="text-xs text-slate-400">
                        {activeSpot.heroPos} Open {activeSpot.openSizeBb} bb vs {activeSpot.villainPos}{' '}
                        3-Bet {activeSpot.threeBetSizeBb} bb ({VILLAIN_PROFILE_META[activeSpot.villainProfile].label})
                      </div>
                    </div>
                    <div
                      data-testid="drill-score"
                      className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-emerald-300"
                    >
                      Score : {drillScore.correct}/{drillScore.total}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-slate-900/90 border border-slate-800 rounded-xl p-4">
                    <div className="flex flex-col items-center justify-center w-24 h-24 rounded-2xl bg-slate-950 border-2 border-amber-500/60 shrink-0 mx-auto sm:mx-0">
                      <span
                        data-testid="drill-hand-label"
                        className="text-2xl font-black tracking-tight text-white"
                      >
                        {currentQuestion.hand}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {currentQuestion.combos} combos
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-300 min-w-0">
                      <p className="font-semibold text-white">
                        Vous avez ouvert <span className="text-emerald-300">{currentQuestion.hand}</span>{' '}
                        depuis {activeSpot.heroPos}. {activeSpot.villainPos} vous 3-Bet à{' '}
                        {activeSpot.threeBetSizeBb} bb. Quelle est votre action planifiée ?
                      </p>
                      <div className="flex flex-wrap gap-2 text-[11px] text-slate-400">
                        <span>Bloqueurs restants :</span>
                        <span className="text-slate-200">AA: {currentQuestion.blockers.AA}/6</span>
                        <span className="text-slate-200">KK: {currentQuestion.blockers.KK}/6</span>
                        <span className="text-slate-200">AK: {currentQuestion.blockers.AK}/16</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {DEFENSE_ACTIONS.map((act) => {
                      const meta = DEFENSE_ACTION_META[act];
                      const isPicked = selectedAnswer === act;
                      const isRight = currentQuestion.expectedAction === act;
                      let stateClass =
                        'bg-slate-900 border-slate-700 text-slate-200 hover:border-slate-500';
                      if (selectedAnswer !== null) {
                        if (isRight) {
                          stateClass = 'bg-emerald-600/30 border-emerald-400 text-emerald-200';
                        } else if (isPicked) {
                          stateClass = 'bg-rose-600/30 border-rose-400 text-rose-200';
                        } else {
                          stateClass = 'bg-slate-900/50 border-slate-800 text-slate-500';
                        }
                      }

                      return (
                        <button
                          key={act}
                          type="button"
                          disabled={selectedAnswer !== null}
                          data-testid={`drill-answer-${act}`}
                          onClick={() => handleAnswerDrill(act)}
                          className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition ${stateClass}`}
                        >
                          {meta.label}
                        </button>
                      );
                    })}
                  </div>

                  {selectedAnswer !== null && (
                    <div
                      data-testid="drill-feedback"
                      className={`rounded-xl border p-3 text-xs space-y-2 ${
                        selectedAnswer === currentQuestion.expectedAction
                          ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
                          : 'bg-rose-950/50 border-rose-500/40 text-rose-200'
                      }`}
                    >
                      <div className="font-bold">
                        {selectedAnswer === currentQuestion.expectedAction
                          ? '✅ Exact !'
                          : `❌ Attendu : ${DEFENSE_ACTION_META[currentQuestion.expectedAction].label}`}
                      </div>
                      <p className="text-slate-200">{currentQuestion.explanation}</p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {drillIdx + 1 < drillQuestions.length ? (
                          <button
                            type="button"
                            data-testid="btn-drill-next"
                            onClick={() => {
                              setDrillIdx((i) => i + 1);
                              setSelectedAnswer(null);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold"
                          >
                            Main suivante →
                          </button>
                        ) : (
                          <button
                            type="button"
                            data-testid="btn-drill-restart"
                            onClick={() => resetDrillSession()}
                            className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold"
                          >
                            Nouvelle série (8 mains)
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Live Open-Based Math, MDF, Blockers & Equilab Export */}
        <aside className="space-y-3 min-w-0">
          {/* Open & MDF Panel */}
          <div
            data-testid="panel-open-stats"
            className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
                Jauge MDF &amp; Défense (sur l&apos;Open)
              </h3>
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                  stats.statusLabel === 'equilibre'
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : stats.statusLabel === 'overfold'
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-cyan-500/20 text-cyan-300'
                }`}
              >
                {stats.statusLabel === 'equilibre'
                  ? 'Équilibre ±6 %'
                  : stats.statusLabel === 'overfold'
                    ? `Overfold (${stats.mdfDeltaPct} %)`
                    : `Overdefend (+${stats.mdfDeltaPct} %)`}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2">
                <div className="text-slate-400 text-[11px]">Range d&apos;Open (RFI)</div>
                <div data-testid="stat-open-combos" className="text-sm font-black text-white">
                  {stats.openPct} % ({stats.openCombos} combos)
                </div>
              </div>
              <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2">
                <div className="text-slate-400 text-[11px]">MDF théorique vs 3-Bet</div>
                <div data-testid="stat-mdf-pct" className="text-sm font-black text-cyan-300">
                  {stats.mdf.mdfPct} %
                </div>
                <div className="text-[10px] text-slate-500">
                  Alpha : {stats.mdf.alphaPct} % · Call : {stats.mdf.potOddsPct} %
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-semibold">Défense réelle (sur vos {stats.openCombos} combos)</span>
                <span data-testid="stat-defend-pct" className="font-mono font-bold text-white">
                  {stats.defendPct} % ({stats.defendCombos}/{stats.openCombos})
                </span>
              </div>
              {/* Stacked Hamilton Bar === 100% */}
              <div className="h-3 w-full rounded-full overflow-hidden bg-slate-900 flex border border-slate-800">
                <div
                  style={{ width: `${stats.fourbetValuePct}%` }}
                  className="bg-rose-500 transition-all"
                  title={`4-Bet Value: ${stats.fourbetValuePct}%`}
                />
                <div
                  style={{ width: `${stats.fourbetBluffPct}%` }}
                  className="bg-violet-500 transition-all"
                  title={`4-Bet Bluff: ${stats.fourbetBluffPct}%`}
                />
                <div
                  style={{ width: `${stats.callPct}%` }}
                  className="bg-emerald-500 transition-all"
                  title={`Call: ${stats.callPct}%`}
                />
                <div
                  style={{ width: `${stats.foldPct}%` }}
                  className="bg-slate-700 transition-all"
                  title={`Fold: ${stats.foldPct}%`}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <div className="flex items-center justify-between bg-slate-900/70 px-2 py-1 rounded border border-rose-500/30">
                <span className="text-rose-300 font-semibold">4-Bet Value</span>
                <span data-testid="stat-4bet-value-combos" className="font-mono text-white">
                  {stats.fourbetValueCombos}c ({stats.fourbetValuePct}%)
                </span>
              </div>
              <div className="flex items-center justify-between bg-slate-900/70 px-2 py-1 rounded border border-violet-500/30">
                <span className="text-violet-300 font-semibold">4-Bet Bluff</span>
                <span data-testid="stat-4bet-bluff-combos" className="font-mono text-white">
                  {stats.fourbetBluffCombos}c ({stats.fourbetBluffPct}%)
                </span>
              </div>
              <div className="flex items-center justify-between bg-slate-900/70 px-2 py-1 rounded border border-emerald-500/30">
                <span className="text-emerald-300 font-semibold">Call 3-Bet</span>
                <span data-testid="stat-call-combos" className="font-mono text-white">
                  {stats.callCombos}c ({stats.callPct}%)
                </span>
              </div>
              <div className="flex items-center justify-between bg-slate-900/70 px-2 py-1 rounded border border-slate-700">
                <span className="text-slate-300 font-semibold">Fold</span>
                <span data-testid="stat-fold-combos" className="font-mono text-white">
                  {stats.foldCombos}c ({stats.foldPct}%)
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs bg-slate-900/90 border border-slate-800 rounded-lg px-2.5 py-2">
              <span className="text-slate-400">Ratio 4-Bet Value / Bluff :</span>
              <span data-testid="stat-4bet-ratio" className="font-mono font-bold text-violet-300">
                {stats.fourbetValueCombos} : {stats.fourbetBluffCombos} ({stats.bluffShareOfFourBetPct}% bluffs)
              </span>
            </div>
          </div>

          {/* Blocker & Card Removal Inspector */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
                Inspecteur Bloqueurs : {hoveredHand}
              </h3>
              <span className="text-[11px] font-mono text-slate-400">
                {comboCount(hoveredHand)} combos
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1 text-center text-[11px]">
              <div className="bg-slate-900 rounded p-1.5 border border-slate-800">
                <div className="text-slate-400">AA</div>
                <div className="font-bold text-white">{blockers.AA}/6</div>
              </div>
              <div className="bg-slate-900 rounded p-1.5 border border-slate-800">
                <div className="text-slate-400">KK</div>
                <div className="font-bold text-white">{blockers.KK}/6</div>
              </div>
              <div className="bg-slate-900 rounded p-1.5 border border-slate-800">
                <div className="text-slate-400">QQ</div>
                <div className="font-bold text-white">{blockers.QQ}/6</div>
              </div>
              <div className="bg-slate-900 rounded p-1.5 border border-slate-800">
                <div className="text-slate-400">AK</div>
                <div className="font-bold text-white">{blockers.AK}/16</div>
              </div>
              <div className="bg-slate-900 rounded p-1.5 border border-slate-800">
                <div className="text-slate-400">AQ</div>
                <div className="font-bold text-white">{blockers.AQ}/16</div>
              </div>
            </div>
            <p className="text-[11px] text-slate-400">{activeSpot.notes}</p>
          </div>

          {/* Export Equilab / Flopzilla */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
              Export Equilab / Flopzilla
            </h3>
            {(
              [
                { key: 'open', label: 'Open', text: notations.open },
                { key: 'fourbet_value', label: '4-Bet Value', text: notations.fourbet_value },
                { key: 'fourbet_bluff', label: '4-Bet Bluff', text: notations.fourbet_bluff },
                { key: 'call', label: 'Call 3-Bet', text: notations.call },
              ] as const
            ).map((item) => (
              <div key={item.key} className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-300">{item.label}</span>
                  <button
                    type="button"
                    onClick={() => handleCopyText(item.key, item.text)}
                    disabled={!item.text}
                    className="text-cyan-300 hover:text-cyan-200 disabled:text-slate-600 font-semibold"
                  >
                    {copiedKey === item.key ? 'Copié ✓' : 'Copier'}
                  </button>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[10px] font-mono text-slate-400 truncate">
                  {item.text || '—'}
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
};
