import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Compass,
  ExternalLink,
  HelpCircle,
  Layers,
  Play,
  RotateCcw,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import {
  FAQ_ENTRIES,
  GLOSSARY_ENTRIES,
  INTERACTIVE_TOURS,
  MODULE_GUIDES,
  PROFILE_ROADMAPS,
  type GlossaryEntry,
  type InteractiveTour,
  type RangeAppMode,
  type SuiteTabId,
} from './guideData';

type GuideTab = 'tours' | 'modules' | 'glossary' | 'faq';

interface OpenGuideDetail {
  tab?: GuideTab;
  tourId?: string;
  query?: string;
}

declare global {
  interface Window {
    __proPokerArenaLocked?: boolean;
    switchSuiteTab?: (tab: SuiteTabId) => void;
    setAppMode?: (mode: RangeAppMode) => void;
    openCoachVideosModal?: (forcedTheme?: string) => void;
    openV2BackupModal?: () => void;
    showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
    isMpEnabledClient?: () => boolean;
  }
}

const GUIDE_PROGRESS_KEY = 'pro_poker_guide_progress_v1';
const HIGHLIGHT_CLASSES = [
  'ring-4',
  'ring-emerald-400',
  'ring-offset-2',
  'ring-offset-slate-950',
  'rounded-xl',
  'transition-all',
];

function loadCompletedTours(): string[] {
  try {
    const raw = localStorage.getItem(GUIDE_PROGRESS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function saveCompletedTours(ids: string[]): void {
  try {
    localStorage.setItem(GUIDE_PROGRESS_KEY, JSON.stringify([...new Set(ids)]));
  } catch {
    // Ignore storage quota issues cleanly
  }
}

function normalizeSearch(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export const GuidePortal: React.FC = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<GuideTab>('tours');
  const [searchQuery, setSearchQuery] = useState('');
  const [glossaryCategory, setGlossaryCategory] = useState<'Toutes' | GlossaryEntry['category']>('Toutes');
  const [completedTourIds, setCompletedTourIds] = useState<string[]>(() => loadCompletedTours());

  const [activeTour, setActiveTour] = useState<InteractiveTour | null>(null);
  const [stepIndex, setStepIndex] = useState(0);

  const currentStep = activeTour?.steps[stepIndex] ?? null;

  const isArenaLocked = () => Boolean(window.__proPokerArenaLocked);

  const navigateToModule = useCallback((suiteTab: SuiteTabId, appMode?: RangeAppMode) => {
    if (isArenaLocked() && suiteTab !== 'arena') {
      window.showToast?.('🔒 Terminez votre duel en cours avant d’ouvrir les autres modules.', 'error');
      return false;
    }
    if (suiteTab === 'arena' && window.isMpEnabledClient && !window.isMpEnabledClient()) {
      return false;
    }
    window.switchSuiteTab?.(suiteTab);
    if (suiteTab === 'ranges' && appMode) {
      window.setAppMode?.(appMode);
    }
    return true;
  }, []);

  const startTour = useCallback(
    (tourId: string) => {
      if (isArenaLocked()) {
        window.showToast?.('🔒 Terminez votre duel en cours avant de lancer un tutoriel.', 'error');
        return;
      }
      const found = INTERACTIVE_TOURS.find((t) => t.id === tourId);
      if (!found) return;
      setModalOpen(false);
      setActiveTour(found);
      setStepIndex(0);
    },
    []
  );

  useEffect(() => {
    const onOpenGuide = (ev: Event) => {
      if (isArenaLocked()) {
        window.showToast?.('🔒 Terminez ou abandonnez votre duel en cours avant d’ouvrir le Guide.', 'error');
        return;
      }
      const detail = (ev as CustomEvent<OpenGuideDetail | undefined>).detail ?? {};
      if (detail.tourId) {
        startTour(detail.tourId);
        return;
      }
      if (detail.tab) setActiveTab(detail.tab);
      if (typeof detail.query === 'string') setSearchQuery(detail.query);
      setModalOpen(true);
    };
    window.addEventListener('propoker-open-guide', onOpenGuide);
    return () => window.removeEventListener('propoker-open-guide', onOpenGuide);
  }, [startTour]);

  useEffect(() => {
    if (!modalOpen && !activeTour) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (modalOpen) setModalOpen(false);
        else if (activeTour) setActiveTour(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modalOpen, activeTour]);

  // Synchronise onglet + surbrillance visuelle sur l'étape active du tutoriel
  useEffect(() => {
    if (!currentStep) return;

    navigateToModule(currentStep.suiteTab, currentStep.appMode);

    let highlightedEl: HTMLElement | null = null;
    const timer = window.setTimeout(() => {
      try {
        const el = document.querySelector<HTMLElement>(currentStep.targetSelector);
        if (el) {
          highlightedEl = el;
          el.classList.add(...HIGHLIGHT_CLASSES);
          el.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
        }
      } catch {
        // Ignore invalid/unavailable selectors safely
      }
    }, 30);

    return () => {
      window.clearTimeout(timer);
      if (highlightedEl) {
        highlightedEl.classList.remove(...HIGHLIGHT_CLASSES);
      }
    };
  }, [currentStep, navigateToModule]);

  const finishTour = () => {
    if (!activeTour) return;
    const updated = [...new Set([...completedTourIds, activeTour.id])];
    setCompletedTourIds(updated);
    saveCompletedTours(updated);
    const title = activeTour.title;
    setActiveTour(null);
    setStepIndex(0);
    window.showToast?.(`🎉 Tutoriel terminé : ${title}`, 'success');
  };

  const normalizedQuery = normalizeSearch(searchQuery.trim());

  const filteredModules = useMemo(() => {
    if (!normalizedQuery) return MODULE_GUIDES;
    return MODULE_GUIDES.filter((m) =>
      normalizeSearch(`${m.title} ${m.badge} ${m.summary} ${m.whenToUse} ${m.keywords.join(' ')}`).includes(normalizedQuery)
    );
  }, [normalizedQuery]);

  const filteredGlossary = useMemo(() => {
    return GLOSSARY_ENTRIES.filter((g) => {
      if (glossaryCategory !== 'Toutes' && g.category !== glossaryCategory && !normalizedQuery) {
        return false;
      }
      if (!normalizedQuery) return true;
      return normalizeSearch(`${g.term} ${g.category} ${g.formula ?? ''} ${g.definition} ${g.example}`).includes(
        normalizedQuery
      );
    });
  }, [glossaryCategory, normalizedQuery]);

  const filteredFaq = useMemo(() => {
    if (!normalizedQuery) return FAQ_ENTRIES;
    return FAQ_ENTRIES.filter((f) =>
      normalizeSearch(`${f.question} ${f.answer} ${f.keywords.join(' ')}`).includes(normalizedQuery)
    );
  }, [normalizedQuery]);

  const arenaDisabledByFlag =
    currentStep?.suiteTab === 'arena' &&
    typeof window.isMpEnabledClient === 'function' &&
    !window.isMpEnabledClient();

  return (
    <>
      {/* MODALE DOCUMENTATION & CENTRE DE TUTORIELS */}
      {modalOpen && (
        <div
          id="guide-docs-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="guide-docs-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
          className="fixed inset-0 z-[90] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
        >
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-4 sm:px-6 py-4 border-b border-slate-800 bg-slate-950/80 flex flex-wrap items-start justify-between gap-3 shrink-0">
              <div>
                <h2 id="guide-docs-title" className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-emerald-400" />
                  Centre d’Aide &amp; Tutoriels Interactifs
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Guides pas-à-pas dans l’application, fiches modules et formules poker •{' '}
                  <strong className="text-emerald-300">
                    {completedTourIds.length}/{INTERACTIVE_TOURS.length} tutoriels complétés
                  </strong>
                </p>
              </div>

              <button
                type="button"
                aria-label="Fermer le Centre d’Aide"
                onClick={() => setModalOpen(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search & Navigation Tabs */}
            <div className="px-4 sm:px-6 py-3 border-b border-slate-800 bg-slate-950/50 space-y-3 shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  aria-label="Rechercher dans la documentation et le glossaire"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher un concept, une formule ou un module (ex : MDF, Bubble Factor, PKO, Winamax, PD…)"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-9 py-2 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    aria-label="Effacer la recherche"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>

              {!normalizedQuery && (
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      ['tours', '🚀 Tutoriels Interactifs'],
                      ['modules', '📘 Guide des Modules'],
                      ['glossary', '📐 Glossaire & Formules'],
                      ['faq', '❓ FAQ & Fair-Play'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setActiveTab(id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                        activeTab === id
                          ? 'bg-emerald-600 text-white shadow'
                          : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              {normalizedQuery ? (
                <div className="space-y-5">
                  <div className="text-xs text-slate-400">
                    Résultats pour <strong className="text-white">« {searchQuery} »</strong> :{' '}
                    {filteredModules.length} module(s), {filteredGlossary.length} définition(s), {filteredFaq.length} question(s).
                  </div>

                  {filteredModules.length === 0 && filteredGlossary.length === 0 && filteredFaq.length === 0 && (
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 text-center text-xs text-slate-400">
                      Aucun résultat trouvé. Essayez un autre terme (ex : <code>ICM</code>, <code>MDF</code>, <code>Winamax</code>, <code>PD</code>).
                    </div>
                  )}

                  {filteredGlossary.length > 0 && (
                    <div className="space-y-2.5">
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-sky-400">
                        📐 Glossaire &amp; Formules
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {filteredGlossary.map((g) => (
                          <div key={g.term} className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-1.5 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-extrabold text-white">{g.term}</span>
                              <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300">{g.category}</span>
                            </div>
                            {g.formula && (
                              <div className="px-2.5 py-1 rounded bg-emerald-950/40 border border-emerald-500/30 font-mono text-[11px] text-emerald-300">
                                {g.formula}
                              </div>
                            )}
                            <p className="text-slate-300">{g.definition}</p>
                            <p className="text-[11px] text-slate-400 italic">Exemple : {g.example}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {filteredModules.length > 0 && (
                    <div className="space-y-2.5">
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-emerald-400">
                        📘 Modules de la Suite
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {filteredModules.map((mod) => (
                          <div key={mod.id} className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-extrabold text-white">{mod.title}</span>
                              {mod.suiteTab && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (navigateToModule(mod.suiteTab!)) setModalOpen(false);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold shrink-0"
                                >
                                  Ouvrir →
                                </button>
                              )}
                            </div>
                            <p className="text-slate-300">{mod.summary}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {filteredFaq.length > 0 && (
                    <div className="space-y-2.5">
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-amber-400">
                        ❓ FAQ &amp; Règles
                      </h3>
                      <div className="space-y-2">
                        {filteredFaq.map((f) => (
                          <div key={f.id} className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-1 text-xs">
                            <div className="font-extrabold text-white">{f.question}</div>
                            <p className="text-slate-300 whitespace-pre-line">{f.answer}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* TAB 1: TUTORIELS INTERACTIFS & FEUILLES DE ROUTE */}
                  {activeTab === 'tours' && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {INTERACTIVE_TOURS.map((tour) => {
                          const done = completedTourIds.includes(tour.id);
                          return (
                            <div
                              key={tour.id}
                              className={`rounded-2xl border p-4 space-y-3 flex flex-col justify-between ${
                                done
                                  ? 'bg-emerald-950/20 border-emerald-500/40'
                                  : 'bg-slate-950/90 border-slate-800'
                              }`}
                            >
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="px-2 py-0.5 rounded bg-sky-500/15 border border-sky-500/30 text-sky-300 text-[10px] font-bold">
                                    {tour.badge} • {tour.duration}
                                  </span>
                                  {done && (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-300">
                                      <CheckCircle2 className="w-3.5 h-3.5" /> Terminé
                                    </span>
                                  )}
                                </div>
                                <h3 className="text-sm sm:text-base font-extrabold text-white">{tour.title}</h3>
                                <p className="text-xs text-slate-300 leading-relaxed">{tour.description}</p>
                              </div>

                              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
                                <span className="text-slate-400 font-mono">
                                  {tour.steps.length} étapes guidées • {tour.audience}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => startTour(tour.id)}
                                  className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold inline-flex items-center gap-1.5 shadow"
                                >
                                  {done ? <RotateCcw className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                                  {done ? 'Rejouer' : 'Démarrer le tuto'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Feuilles de route par format de jeu */}
                      <div className="space-y-3">
                        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                          <Compass className="w-4 h-4 text-sky-400" />
                          Par où commencer selon votre format principal ?
                        </h3>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                          {PROFILE_ROADMAPS.map((rm) => (
                            <div key={rm.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3 text-xs">
                              <div>
                                <div className="font-extrabold text-white text-sm">{rm.title}</div>
                                <div className="text-[11px] text-slate-400">{rm.subtitle}</div>
                              </div>
                              <div className="space-y-2">
                                {rm.steps.map((st) => (
                                  <button
                                    key={st.label}
                                    type="button"
                                    onClick={() => {
                                      if (navigateToModule(st.suiteTab, st.appMode)) setModalOpen(false);
                                    }}
                                    className="w-full text-left bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl p-2.5 transition space-y-0.5"
                                  >
                                    <div className="font-bold text-emerald-300 flex items-center justify-between">
                                      <span>{st.label}</span>
                                      <ExternalLink className="w-3 h-3 opacity-70" />
                                    </div>
                                    <div className="text-[11px] text-slate-400">{st.detail}</div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: GUIDE DES MODULES */}
                  {activeTab === 'modules' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {MODULE_GUIDES.map((mod) => (
                        <div
                          key={mod.id}
                          className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-3 flex flex-col justify-between text-xs"
                        >
                          <div className="space-y-2.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="px-2 py-0.5 rounded bg-slate-800 text-sky-300 font-bold text-[10px]">
                                {mod.badge}
                              </span>
                            </div>
                            <h3 className="text-sm font-extrabold text-white">{mod.title}</h3>
                            <p className="text-slate-300 leading-relaxed">{mod.summary}</p>
                            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5">
                              <span className="font-bold text-amber-300">Quand l’utiliser : </span>
                              <span className="text-slate-300">{mod.whenToUse}</span>
                            </div>
                            <ul className="list-disc list-inside text-slate-300 space-y-1">
                              {mod.keyFeatures.map((f) => (
                                <li key={f}>{f}</li>
                              ))}
                            </ul>
                            <div className="text-[11px] text-emerald-300 bg-emerald-950/25 border border-emerald-500/30 rounded-xl p-2.5">
                              💡 <strong>Conseil Pro :</strong> {mod.proTips[0]}
                            </div>
                          </div>

                          {mod.suiteTab ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (navigateToModule(mod.suiteTab!)) setModalOpen(false);
                              }}
                              className="w-full min-h-[40px] py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold inline-flex items-center justify-center gap-1.5"
                            >
                              Ouvrir ce module <ArrowRight className="w-4 h-4" />
                            </button>
                          ) : (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setModalOpen(false);
                                  window.openCoachVideosModal?.('all');
                                }}
                                className="flex-1 min-h-[40px] py-2 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-white font-bold"
                              >
                                Ouvrir Vidéos 📺
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setModalOpen(false);
                                  window.openV2BackupModal?.();
                                }}
                                className="flex-1 min-h-[40px] py-2 rounded-xl bg-sky-600/80 hover:bg-sky-600 text-white font-bold"
                              >
                                Sauvegarde JSON 💾
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* TAB 3: GLOSSAIRE & FORMULES */}
                  {activeTab === 'glossary' && (
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-1.5">
                        {(['Toutes', 'Maths & EV', 'Tournoi & ICM', 'Postflop & Ranges', 'Arène & Progression'] as const).map(
                          (cat) => (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => setGlossaryCategory(cat)}
                              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                                glossaryCategory === cat
                                  ? 'bg-sky-600 text-white'
                                  : 'bg-slate-950 border border-slate-800 text-slate-300 hover:text-white'
                              }`}
                            >
                              {cat}
                            </button>
                          )
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {filteredGlossary.map((g) => (
                          <div key={g.term} className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="text-sm font-extrabold text-white">{g.term}</h3>
                              <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-bold text-slate-300">
                                {g.category}
                              </span>
                            </div>
                            {g.formula && (
                              <div className="px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 font-mono text-[11px] text-emerald-300">
                                {g.formula}
                              </div>
                            )}
                            <p className="text-slate-300 leading-relaxed">{g.definition}</p>
                            <div className="text-[11px] text-slate-400 bg-slate-900 rounded-lg p-2">
                              <strong className="text-sky-300">À la table :</strong> {g.example}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TAB 4: FAQ & FAIR-PLAY */}
                  {activeTab === 'faq' && (
                    <div className="space-y-3">
                      {FAQ_ENTRIES.map((faq) => (
                        <div key={faq.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-1.5 text-xs">
                          <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                            <HelpCircle className="w-4 h-4 text-amber-400 shrink-0" />
                            {faq.question}
                          </h3>
                          <p className="text-slate-300 leading-relaxed whitespace-pre-line pl-6">{faq.answer}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* COACH INTERACTIF FLOTTANT (PAS-A-PAS SUR L'INTERFACE REELLE) */}
      {activeTour && currentStep && (
        <aside
          id="interactive-tour-card"
          aria-label="Tutoriel interactif guidé"
          className="fixed inset-x-3 bottom-3 mx-auto z-[80] w-auto max-w-xl bg-slate-900 border-2 border-emerald-500/60 rounded-2xl p-4 shadow-2xl space-y-3 text-xs"
          style={{ maxWidth: 'min(36rem, calc(100vw - 1.5rem))' }}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-[11px] font-extrabold text-emerald-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                {activeTour.title} • Étape {stepIndex + 1} / {activeTour.steps.length}
              </div>
              <h3 className="text-sm font-extrabold text-white mt-0.5">{currentStep.title}</h3>
            </div>
            <button
              type="button"
              aria-label="Quitter le tutoriel"
              onClick={() => setActiveTour(null)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${Math.round(((stepIndex + 1) / activeTour.steps.length) * 100)}%` }}
            />
          </div>

          <p className="text-slate-200 leading-relaxed">{currentStep.summary}</p>

          {arenaDisabledByFlag && (
            <div className="bg-amber-950/40 border border-amber-500/40 rounded-lg px-2.5 py-1.5 text-[11px] text-amber-200">
              Note : l’Arène Multijoueur est actuellement masquée par le paramètre Mode Solo (<code>?mp=0</code>).
            </div>
          )}

          <div className="bg-slate-950/90 border border-slate-800 rounded-xl px-3 py-2 text-[11px] text-amber-200">
            <strong className="text-amber-300">💡 Conseil Pro :</strong> {currentStep.proTip}
          </div>

          {currentStep.actionLabel && currentStep.actionTriggerSelector && (
            <button
              type="button"
              onClick={() => {
                try {
                  const target = document.querySelector<HTMLElement>(currentStep.actionTriggerSelector!);
                  target?.click();
                } catch {
                  // Ignore missing target gracefully
                }
              }}
              className="px-3 py-1.5 rounded-xl bg-sky-600/25 hover:bg-sky-600/40 border border-sky-400/50 text-sky-200 font-bold inline-flex items-center gap-1.5"
            >
              <Layers className="w-3.5 h-3.5" /> {currentStep.actionLabel}
            </button>
          )}

          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800">
            <button
              type="button"
              disabled={stepIndex === 0}
              onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-bold inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Précédent
            </button>

            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-400 hover:text-white"
            >
              Tous les tutos
            </button>

            {stepIndex + 1 < activeTour.steps.length ? (
              <button
                type="button"
                onClick={() => setStepIndex((i) => Math.min(activeTour.steps.length - 1, i + 1))}
                className="min-h-[38px] px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold inline-flex items-center gap-1"
              >
                Suivant <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={finishTour}
                className="min-h-[38px] px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold inline-flex items-center gap-1"
              >
                Terminer le tuto <CheckCircle2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </aside>
      )}
    </>
  );
};
