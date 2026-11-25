import React, { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  ChevronRight,
  Clock,
  Dices,
  History,
  Lightbulb,
  Loader2,
  Lock,
  LogIn,
  LogOut,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  XCircle,
} from 'lucide-react';
import {
  auth,
  signInWithGoogleCoach,
  signOutCoach,
  syncCoachProfileToFirestore,
} from '../firebase';
import {
  CoachScenario,
  HandReview,
  QuizProgressInfo,
  SavedHandReview,
} from '../types/coach';
import { HiddenPokerCard, PokerCardVisual } from './PokerCardVisual';

const REVIEWS_STORAGE_KEY = 'killtilt_coach_reviews_v1';

const DEFAULT_PROGRESS: QuizProgressInfo = {
  xp: 0,
  level: 1,
  icon: '🌱',
  title: 'Niveau 1 — Apprenti NL2',
  desc: 'Fondations : Positions, Limp interdit, Sizings de base & Open Raise UTG/CO/BU',
  minXp: 0,
  maxXp: 100,
};

const SAMPLE_HANDS = [
  {
    id: 'aqo-co',
    label: 'NL2 : AQo au CO vs Fish BB',
    limit: 'NL2',
    format: 'Cash 6-Max',
    text: `NL2 6-Max (100bb effectif).
Je suis au Cutoff avec As Qd. Tout le monde fold, j'ouvre à 3bb (0.06€).
Le Bouton et la SB fold. La BB (Fish passif 45/10/2, AF 1.1 sur 180 mains) paie.
Flop (pot 6.5bb) : Ah 9d 4c.
BB check. Je C-Bet 2bb (1/3 pot). BB paie.
Turn (pot 10.5bb) : 7s.
BB check. Je check back pour pot control.
River (pot 10.5bb) : 2d.
BB mise 8bb (3/4 pot). Je paie et il montre A9o pour deux paires.`,
  },
  {
    id: 'winamax-jj',
    label: 'Winamax : Overpaire JJ sur flop drawy',
    limit: 'NL2',
    format: 'Cash 6-Max',
    text: `Winamax Poker - CashGame - HandId: #24819204 - Holdem no limit (0.01€/0.02€)
Table 'Paris 12' 5-max Seat #3 is the button
Hero (UTG) [2.00€] dealt [Jh Jd]
Villain (BB) [2.15€] — HUD: 26/21/8, AF 2.8 (420 mains)
Hero raises 0.06€ to 0.06€, CO folds, BTN folds, SB folds, Villain calls 0.04€.
*** FLOP *** [9s 8s 6c] (Pot 0.13€)
Villain checks, Hero bets 0.09€, Villain raises to 0.28€, Hero calls 0.19€.
*** TURN *** [9s 8s 6c] [Ts] (Pot 0.69€)
Villain bets 0.52€, Hero calls 0.52€.
*** RIVER *** [9s 8s 6c Ts] [2h] (Pot 1.73€)
Villain bets 1.29€ (All-in), Hero calls 1.14€ (All-in).`,
  },
  {
    id: 'ps-3bet-ako',
    label: 'PokerStars : 3-Bet Pot AKo OOP',
    limit: 'NL5',
    format: 'Zoom / GoFast',
    text: `NL5 GoFast 6-Max (100bb).
BTN (Reg serré 21/18/6 sur 300 mains) open à 2.5bb.
Je suis en SB avec Ac Kh et je 3-Bet à 8bb. BB fold, BTN call.
Flop (17bb) : Kd 7s 3d.
Je C-Bet 1/2 pot (8.5bb). BTN call.
Turn (34bb) : Qd.
Je check. BTN mise 22bb. Je paie.
River (78bb) : 4c.
Je check, BTN fait tapis pour mes 61.5bb restantes. J'hésite et je fold.`,
  },
];

function formatEurFromBb(bb: number, limit: string): string {
  const bbVal = limit === 'NL5' ? 0.05 : limit === 'NL10' ? 0.1 : 0.02;
  return `${(bb * bbVal).toFixed(2).replace('.', ',')} €`;
}

function getHudProfileStyle(vpip: number, pfr: number): string {
  if (vpip >= 45) return 'text-rose-300 border-rose-500/40 bg-rose-950/50';
  if (vpip >= 28 && pfr <= 14) return 'text-emerald-300 border-emerald-500/40 bg-emerald-950/50';
  if (vpip >= 28 && pfr >= 20) return 'text-amber-300 border-amber-500/40 bg-amber-950/50';
  if (vpip <= 18) return 'text-slate-300 border-slate-600 bg-slate-800/70';
  return 'text-sky-300 border-sky-500/40 bg-sky-950/50';
}

export const CoachIAPoker: React.FC = () => {
  const [coachMode, setCoachMode] = useState<'scenario' | 'review'>('scenario');
  const [isCoachTabActive, setIsCoachTabActive] = useState(false);

  // Firebase Auth state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Synced XP Progress from Quiz tab
  const [progress, setProgress] = useState<QuizProgressInfo>(DEFAULT_PROGRESS);

  // Mode 1: Interactive Scenario State
  const [scenarioLimit, setScenarioLimit] = useState<'NL2' | 'NL5'>('NL2');
  const [streetFocus, setStreetFocus] = useState<string>('AUTO');
  const [scenario, setScenario] = useState<CoachScenario | null>(null);
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const [scenarioError, setScenarioError] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [lastXpGained, setLastXpGained] = useState<number>(0);
  const [recentTopics, setRecentTopics] = useState<string[]>([]);
  const [sessionStats, setSessionStats] = useState({ correct: 0, total: 0, streak: 0 });

  // Mode 2: Hand History Review State
  const [reviewLimit, setReviewLimit] = useState<string>('NL2');
  const [reviewFormat, setReviewFormat] = useState<string>('Cash 6-Max');
  const [handInput, setHandInput] = useState<string>('');
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [currentReview, setCurrentReview] = useState<HandReview | null>(null);
  const [savedReviews, setSavedReviews] = useState<SavedHandReview[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthReady(true);
      setAuthError(null);
      if (user) {
        const latestXp =
          typeof window.getKillTiltQuizProgress === 'function'
            ? window.getKillTiltQuizProgress().xp
            : 0;
        syncCoachProfileToFirestore(latestXp).catch(() => {
          // Handled by structured Firestore error logger
        });
      }
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      await signInWithGoogleCoach();
      if (typeof window.showKillTiltToast === 'function') {
        window.showKillTiltToast('Connecté au Coach IA Poker !', 'success');
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Impossible de finaliser la connexion Google.';
      setAuthError(msg);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutCoach();
      setScenario(null);
      setCurrentReview(null);
      if (typeof window.showKillTiltToast === 'function') {
        window.showKillTiltToast('Déconnecté du Coach IA Poker.', 'info');
      }
    } catch (err: unknown) {
      console.error('Sign out error:', err);
    }
  };

  // Load initial XP progress and saved reviews
  useEffect(() => {
    const syncProgress = () => {
      if (typeof window.getKillTiltQuizProgress === 'function') {
        setProgress(window.getKillTiltQuizProgress());
      }
    };
    syncProgress();
    // Retry once after DOMContentLoaded in case index.html init runs right after mount
    const timer = window.setTimeout(syncProgress, 150);

    const handleXpUpdated = (e: Event) => {
      const custom = e as CustomEvent<{ xp: number; level: QuizProgressInfo }>;
      if (custom.detail?.level) {
        setProgress({
          ...custom.detail.level,
          xp: custom.detail.xp,
        });
      } else {
        syncProgress();
      }
    };

    const handleTabChanged = (e: Event) => {
      const custom = e as CustomEvent<{ tab: string }>;
      setIsCoachTabActive(custom.detail?.tab === 'coach');
      if (custom.detail?.tab === 'coach') {
        syncProgress();
      }
    };

    window.addEventListener('killtilt-xp-updated', handleXpUpdated);
    window.addEventListener('killtilt-tab-changed', handleTabChanged);

    try {
      const raw = localStorage.getItem(REVIEWS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setSavedReviews(parsed);
      }
    } catch {
      // Ignore storage read errors
    }

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('killtilt-xp-updated', handleXpUpdated);
      window.removeEventListener('killtilt-tab-changed', handleTabChanged);
    };
  }, []);

  const persistReviews = (next: SavedHandReview[]) => {
    setSavedReviews(next);
    try {
      localStorage.setItem(REVIEWS_STORAGE_KEY, JSON.stringify(next.slice(0, 12)));
    } catch {
      // Ignore storage quota errors
    }
  };

  const generateScenario = useCallback(async () => {
    if (!auth.currentUser) {
      setScenarioError('Veuillez vous connecter avec votre compte Google pour générer une main.');
      return;
    }

    setScenarioLoading(true);
    setScenarioError(null);
    setSelectedOption(null);
    setShowHint(false);
    setLastXpGained(0);

    const latestProgress =
      typeof window.getKillTiltQuizProgress === 'function'
        ? window.getKillTiltQuizProgress()
        : progress;

    try {
      const idToken = await auth.currentUser.getIdToken();
      const resp = await fetch('/api/coach/scenario', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          xp: latestProgress.xp,
          level: latestProgress.level,
          levelTitle: latestProgress.title,
          levelDesc: latestProgress.desc,
          streetFocus,
          limit: scenarioLimit,
          recentTopics,
        }),
      });

      const payload = await resp.json();
      if (!resp.ok) {
        throw new Error(payload?.error || 'Impossible de générer le scénario.');
      }

      const generated = payload.scenario as CoachScenario;
      setScenario(generated);
      setRecentTopics((prev) => [generated.keyConcept || generated.title, ...prev].slice(0, 6));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur réseau avec le Coach IA.';
      setScenarioError(msg);
    } finally {
      setScenarioLoading(false);
    }
  }, [progress, recentTopics, scenarioLimit, streetFocus]);

  const handleSelectOption = useCallback(
    (idx: number) => {
      if (!scenario || selectedOption !== null) return;
      setSelectedOption(idx);

      const isCorrect = idx === scenario.correctIndex;
      const nextStreak = isCorrect ? sessionStats.streak + 1 : 0;

      setSessionStats((prev) => ({
        correct: prev.correct + (isCorrect ? 1 : 0),
        total: prev.total + 1,
        streak: isCorrect ? prev.streak + 1 : 0,
      }));

      if (isCorrect) {
        const baseXp = Math.min(40, Math.max(15, Number(scenario.xpReward) || 20));
        const streakBonus = Math.min(15, nextStreak * 3);
        const totalGain = baseXp + streakBonus;
        setLastXpGained(totalGain);

        if (typeof window.creditKillTiltCoachXp === 'function') {
          const updated = window.creditKillTiltCoachXp(totalGain);
          setProgress({ ...updated.levelInfo, xp: updated.xp });
          syncCoachProfileToFirestore(updated.xp).catch(() => {});
        }
      } else {
        setLastXpGained(0);
      }
    },
    [scenario, selectedOption, sessionStats.streak]
  );

  // Keyboard shortcuts when Coach IA Scenario mode is active
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isCoachTabActive || coachMode !== 'scenario') return;
      const activeTag = document.activeElement?.tagName;
      if (activeTag && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag)) return;

      const key = e.key.toLowerCase();
      if (scenario && selectedOption === null && !scenarioLoading) {
        const map: Record<string, number> = {
          a: 0,
          '1': 0,
          b: 1,
          '2': 1,
          c: 2,
          '3': 2,
          d: 3,
          '4': 3,
        };
        if (map[key] !== undefined) {
          e.preventDefault();
          handleSelectOption(map[key]);
        }
      } else if (selectedOption !== null && key === 'enter' && !scenarioLoading) {
        e.preventDefault();
        generateScenario();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [coachMode, generateScenario, handleSelectOption, isCoachTabActive, scenario, scenarioLoading, selectedOption]);

  const handleAnalyzeHand = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!auth.currentUser) {
      setReviewError('Veuillez vous connecter avec votre compte Google pour analyser une main.');
      return;
    }
    if (!handInput.trim()) {
      setReviewError('Collez un historique Winamax/PokerStars ou décrivez votre main avant de lancer l’analyse.');
      return;
    }

    setReviewLoading(true);
    setReviewError(null);

    try {
      const idToken = await auth.currentUser.getIdToken();
      const resp = await fetch('/api/coach/review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          handHistory: handInput,
          limit: reviewLimit,
          format: reviewFormat,
        }),
      });
      const payload = await resp.json();
      if (!resp.ok) {
        throw new Error(payload?.error || 'Impossible d’analyser cette main.');
      }

      const review = payload.review as HandReview;
      setCurrentReview(review);

      const savedEntry: SavedHandReview = {
        id: Date.now(),
        createdAt: new Date().toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }),
        limit: reviewLimit,
        format: reviewFormat,
        rawInput: handInput.trim(),
        review,
      };
      persistReviews([savedEntry, ...savedReviews]);

      if (typeof window.showKillTiltToast === 'function') {
        window.showKillTiltToast(`Analyse terminée — Note : ${review.score}/10`, 'success');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur réseau lors de l’analyse.';
      setReviewError(msg);
    } finally {
      setReviewLoading(false);
    }
  };

  const loadSampleHand = (sample: (typeof SAMPLE_HANDS)[number]) => {
    setReviewLimit(sample.limit);
    setReviewFormat(sample.format);
    setHandInput(sample.text);
    setReviewError(null);
  };

  const deleteSavedReview = (id: number) => {
    persistReviews(savedReviews.filter((r) => r.id !== id));
  };

  const xpSpan = Math.max(1, progress.maxXp - progress.minXp);
  const xpPct =
    progress.level >= 5
      ? 100
      : Math.min(100, Math.round(((progress.xp - progress.minXp) / xpSpan) * 100));

  const sessionAccuracy =
    sessionStats.total > 0
      ? Math.round((sessionStats.correct / sessionStats.total) * 100)
      : 100;

  if (!authReady) {
    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-10 text-center space-y-3">
        <Loader2 className="w-7 h-7 animate-spin text-emerald-400 mx-auto" />
        <p className="text-xs font-mono text-slate-400">
          Vérification de votre session d’authentification...
        </p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-10 shadow-2xl max-w-2xl mx-auto text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-950/50">
          <Lock className="w-8 h-8" />
        </div>

        <div className="space-y-2 max-w-lg mx-auto">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] font-mono font-bold">
            <ShieldCheck className="w-3.5 h-3.5" />
            Accès Réservé aux Membres Authentifiés
          </div>
          <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
            Connectez-vous pour accéder au Coach IA Poker
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            L’onglet <strong className="text-white">🤖 Coach IA Poker</strong> (générateur de mains interactives Gemini & analyseur d’historiques Winamax/PokerStars) est protégé par authentification Google afin de sécuriser l’accès à l’API.
          </p>
        </div>

        {authError && (
          <div className="bg-rose-950/50 border border-rose-500/40 rounded-xl p-3.5 text-xs text-rose-200 flex items-start gap-2.5 text-left max-w-md mx-auto">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span className="selectable-text">{authError}</span>
          </div>
        )}

        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={authLoading}
            className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-sm font-extrabold text-white shadow-lg shadow-emerald-950/60 transition inline-flex items-center gap-2.5"
          >
            {authLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Connexion Google en cours...
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                Se connecter avec Google
              </>
            )}
          </button>
          <p className="text-[11px] text-slate-500">
            Les autres modules (Ranges, Jeux, HUD, Tableur Bankroll et Solver GTO) restent librement accessibles sans connexion.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Top Coach Banner + Sub-Mode Switch */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
                Coach IA Poker — Pédagogie Kill Tilt NL2 / NL5
              </h2>
              <span className="text-xs font-mono text-emerald-400">
                · Gemini 4 Flash
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Entraînez-vous sur des spots inédits adaptés à votre niveau XP ou faites analyser vos mains Winamax / PokerStars rue par rue.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto shrink-0">
            {/* Authenticated User Badge & Sign Out */}
            <div className="flex items-center gap-2 bg-slate-950/90 border border-slate-800 rounded-xl px-2.5 py-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-xs font-semibold text-slate-200 max-w-[160px] truncate">
                {currentUser.displayName || currentUser.email}
              </span>
              <button
                type="button"
                onClick={handleSignOut}
                title="Se déconnecter du Coach IA"
                className="p-1 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-slate-800 transition"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Sub-mode Segmented Control */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setCoachMode('scenario')}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  coachMode === 'scenario'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Dices className="w-3.5 h-3.5" />
                Scénarios Interactifs
              </button>
              <button
                type="button"
                onClick={() => setCoachMode('review')}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  coachMode === 'review'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Search className="w-3.5 h-3.5" />
                Analyseur de Mains
              </button>
            </div>
          </div>
        </div>

        {/* Synced XP Progress Strip (linked directly to Quiz tab) */}
        <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-lg shrink-0">
              {progress.icon}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                <span className="font-extrabold text-white">{progress.title}</span>
                <span className="font-mono font-bold text-emerald-400 tabular-nums">
                  {progress.xp} XP
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">{progress.desc}</p>
            </div>
          </div>

          <div className="w-full md:w-64 shrink-0 space-y-1">
            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-sky-400 rounded-full transition-all duration-500"
                style={{ width: `${xpPct}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono text-slate-500 tabular-nums">
              <span>
                {progress.level < 5
                  ? `${progress.xp} / ${progress.maxXp} XP (Niv. ${progress.level + 1})`
                  : `${progress.xp} XP — Rang Max`}
              </span>
              <span>Synchronisé avec le Quiz</span>
            </div>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* MODE 1: INTERACTIVE SCENARIO GENERATOR (DYNAMIC QUIZ)               */}
      {/* =================================================================== */}
      {coachMode === 'scenario' && (
        <div className="space-y-5">
          {/* Controls & Session Scoreboard Bar */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1.5">
                <label htmlFor="coach-limit" className="text-xs font-semibold text-slate-400">
                  Limite :
                </label>
                <select
                  id="coach-limit"
                  value={scenarioLimit}
                  onChange={(e) => setScenarioLimit(e.target.value as 'NL2' | 'NL5')}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="NL2">NL2 (0.01/0.02€)</option>
                  <option value="NL5">NL5 (0.02/0.05€)</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <label htmlFor="coach-street" className="text-xs font-semibold text-slate-400">
                  Rue :
                </label>
                <select
                  id="coach-street"
                  value={streetFocus}
                  onChange={(e) => setStreetFocus(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="AUTO">Adaptée au niveau {progress.level}</option>
                  <option value="Préflop">Préflop uniquement</option>
                  <option value="Flop">Flop (C-Bet, Texture, Draws)</option>
                  <option value="Turn">Turn (2nd Barrel, Cotes)</option>
                  <option value="River">River (Value, Bluff-Catch)</option>
                </select>
              </div>

              <button
                type="button"
                onClick={generateScenario}
                disabled={scenarioLoading}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-xs sm:text-sm font-extrabold text-white shadow-lg shadow-emerald-950/60 transition flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                {scenarioLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Distribution en cours...
                  </>
                ) : (
                  <>
                    <Dices className="w-4 h-4" />
                    🎲 Générer une main interactive
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center gap-3 font-mono text-xs tabular-nums text-slate-300">
              <span>
                Score : <strong className="text-white">{sessionStats.correct}/{sessionStats.total}</strong>
              </span>
              <span className="text-slate-700">·</span>
              <span>
                Précision : <strong className="text-emerald-400">{sessionAccuracy}%</strong>
              </span>
              <span className="text-slate-700">·</span>
              <span>
                Série : <strong className="text-amber-400">{sessionStats.streak}</strong>
              </span>
            </div>
          </div>

          {/* Error Banner */}
          {scenarioError && (
            <div className="bg-rose-950/50 border border-rose-500/40 rounded-2xl p-4 flex items-start gap-3 text-xs text-rose-200">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold text-rose-300">Erreur Coach IA</div>
                <p className="selectable-text">{scenarioError}</p>
              </div>
            </div>
          )}

          {/* Empty / Welcome State */}
          {!scenario && !scenarioLoading && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-8 sm:p-10 text-center space-y-5">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Sparkles className="w-7 h-7" />
              </div>
              <div className="max-w-lg mx-auto space-y-2">
                <h3 className="text-lg font-extrabold text-white">
                  Prêt pour une session de coaching interactive ?
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                  Le Coach IA va créer un spot Cash Game 6-Max inédit calibré sur votre{' '}
                  <strong className="text-emerald-400">{progress.title}</strong>, avec la table visuelle, le profil HUD complet de Vilain et 4 décisions possibles. Chaque bonne réponse crédite directement vos XP !
                </p>
              </div>
              <button
                type="button"
                onClick={generateScenario}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-extrabold text-white shadow-lg shadow-emerald-950/60 transition inline-flex items-center gap-2"
              >
                <Dices className="w-4 h-4" />
                🎲 Générer une main interactive
              </button>
            </div>
          )}

          {/* Loading Skeleton */}
          {scenarioLoading && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-5 animate-pulse">
              <div className="h-5 w-2/5 bg-slate-800 rounded-lg" />
              <div className="h-56 w-full bg-emerald-950/40 border border-slate-800 rounded-3xl" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="h-14 bg-slate-950 border border-slate-800 rounded-xl" />
                <div className="h-14 bg-slate-950 border border-slate-800 rounded-xl" />
                <div className="h-14 bg-slate-950 border border-slate-800 rounded-xl" />
                <div className="h-14 bg-slate-950 border border-slate-800 rounded-xl" />
              </div>
            </div>
          )}

          {/* Active Interactive Scenario Stage */}
          {scenario && !scenarioLoading && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-2xl space-y-5">
              {/* Scenario Title Header */}
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-400">
                    <span className="text-emerald-400 font-bold">{scenario.limit} 6-Max</span>
                    <span>·</span>
                    <span className="text-amber-300 font-bold">Rue : {scenario.street}</span>
                    <span>·</span>
                    <span>Récompense : +{scenario.xpReward} XP</span>
                  </div>
                  <h3 className="text-base sm:text-lg font-extrabold text-white">
                    {scenario.title}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => setShowHint((h) => !h)}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-bold transition inline-flex items-center gap-1.5 shrink-0"
                >
                  <Lightbulb className="w-3.5 h-3.5" />
                  {showHint ? 'Masquer l’indice' : 'Indice du Coach'}
                </button>
              </div>

              {showHint && (
                <div className="rounded-xl bg-amber-950/40 border border-amber-500/30 px-4 py-3 text-xs text-amber-200 leading-relaxed selectable-text">
                  <strong className="text-amber-300">Conseil du Coach :</strong> {scenario.hint}
                </div>
              )}

              {/* Visual Poker Table Felt */}
              <div className="relative rounded-3xl bg-gradient-to-b from-emerald-950 via-emerald-900/85 to-slate-950 border-4 border-slate-800 p-4 sm:p-6 shadow-inner space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                  {/* Hero Seat */}
                  <div className="bg-slate-950/90 border-2 border-emerald-500/60 rounded-2xl p-3.5 text-center space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="font-extrabold uppercase tracking-wider text-emerald-400">
                        HERO ({scenario.heroPosition})
                      </span>
                      <span className="text-slate-300 tabular-nums">
                        {scenario.heroStackBb}bb ({formatEurFromBb(scenario.heroStackBb, scenario.limit)})
                      </span>
                    </div>
                    <div className="flex items-center justify-center gap-2 py-1">
                      {scenario.heroCards.map((card) => (
                        <PokerCardVisual key={card} card={card} size="lg" />
                      ))}
                    </div>
                    <div className="text-[11px] font-mono text-slate-400">
                      Main : <strong className="text-white">{scenario.heroCards.join(' ')}</strong>
                    </div>
                  </div>

                  {/* Center Pot & Community Board */}
                  <div className="flex flex-col items-center justify-center text-center space-y-3 py-1">
                    <div className="px-4 py-2 rounded-2xl bg-slate-950/90 border border-amber-500/40 shadow-lg">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                        Pot au milieu · {scenario.street}
                      </div>
                      <div className="font-mono text-xl sm:text-2xl font-extrabold text-white tabular-nums">
                        {scenario.potBb} bb
                      </div>
                      <div className="font-mono text-[11px] text-slate-400 tabular-nums">
                        ({formatEurFromBb(scenario.potBb, scenario.limit)})
                      </div>
                    </div>

                    {/* Board Cards */}
                    <div className="space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-200/70">
                        {scenario.boardCards.length > 0 ? 'Tableau (Board)' : 'Action Préflop'}
                      </div>
                      {scenario.boardCards.length > 0 ? (
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          {scenario.boardCards.map((card) => (
                            <PokerCardVisual key={card} card={card} size="md" />
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs font-mono text-emerald-200/70 bg-slate-950/60 border border-emerald-500/20 rounded-xl px-3 py-1.5">
                          Aucune carte au board
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Villain Seat & Live HUD */}
                  <div className="bg-slate-950/90 border-2 border-rose-500/60 rounded-2xl p-3.5 text-center space-y-2.5">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="font-extrabold uppercase tracking-wider text-rose-400">
                        VILAIN ({scenario.villainPosition})
                      </span>
                      <span className="text-slate-300 tabular-nums">
                        {scenario.villainStackBb}bb ({formatEurFromBb(scenario.villainStackBb, scenario.limit)})
                      </span>
                    </div>

                    <div className="flex items-center justify-center gap-2">
                      <HiddenPokerCard size="sm" />
                      <HiddenPokerCard size="sm" />
                    </div>

                    <div
                      className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${getHudProfileStyle(
                        scenario.villainHud.vpip,
                        scenario.villainHud.pfr
                      )}`}
                    >
                      {scenario.villainProfileName}
                    </div>

                    {/* Authentic Live HUD Strip */}
                    <div className="bg-black border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-[11px] font-bold tracking-wide tabular-nums">
                      <span className="text-emerald-400" title="VPIP">
                        {scenario.villainHud.vpip}
                      </span>
                      <span className="text-slate-600 mx-1">/</span>
                      <span className="text-sky-400" title="PFR">
                        {scenario.villainHud.pfr}
                      </span>
                      <span className="text-slate-600 mx-1">/</span>
                      <span className="text-rose-400" title="3-Bet">
                        {scenario.villainHud.threeBet}
                      </span>
                      <span className="text-slate-600 mx-1">/</span>
                      <span className="text-amber-400" title="AF">
                        AF {scenario.villainHud.af}
                      </span>
                      <span className="text-slate-600 mx-1">·</span>
                      <span className="text-slate-400">{scenario.villainHud.hands}h</span>
                    </div>
                  </div>
                </div>

                {/* Action History Narrative */}
                <div className="bg-slate-950/85 border border-slate-800/90 rounded-2xl p-3.5 space-y-1.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Déroulé du coup
                  </div>
                  <ul className="space-y-1 text-xs sm:text-sm text-slate-200 selectable-text">
                    {scenario.actionHistory.map((step, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="font-mono text-emerald-400 font-bold shrink-0">
                          {idx + 1}.
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Decision Prompt & 4 Options (A, B, C, D) */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm sm:text-base font-extrabold text-white">
                    {scenario.question}
                  </h4>
                  <span className="text-[11px] font-mono text-slate-500">
                    Raccourcis : A-D ou 1-4 · Entrée = Main suivante
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {scenario.options.map((opt, idx) => {
                    const isAnswered = selectedOption !== null;
                    const isSelected = selectedOption === idx;
                    const isCorrectOpt = idx === scenario.correctIndex;

                    let cardClass =
                      'bg-slate-950/90 hover:bg-slate-800 border-slate-800 hover:border-emerald-500/60 text-slate-200';
                    if (isAnswered) {
                      if (isCorrectOpt) {
                        cardClass =
                          'bg-emerald-950/80 border-2 border-emerald-500 text-white shadow-lg shadow-emerald-950/40';
                      } else if (isSelected && !isCorrectOpt) {
                        cardClass = 'bg-rose-950/80 border-2 border-rose-500 text-rose-100';
                      } else {
                        cardClass = 'bg-slate-950/60 border-slate-800/70 text-slate-400 opacity-50';
                      }
                    }

                    return (
                      <button
                        key={idx}
                        type="button"
                        disabled={isAnswered}
                        onClick={() => handleSelectOption(idx)}
                        className={`w-full text-left p-3.5 rounded-xl border text-xs sm:text-sm font-semibold transition flex items-start gap-3 ${cardClass}`}
                      >
                        <span className="shrink-0 w-7 h-7 rounded-lg bg-slate-800 text-emerald-400 font-mono text-xs font-extrabold flex items-center justify-center">
                          {opt.label || ['A', 'B', 'C', 'D'][idx]}
                        </span>
                        <span className="leading-snug pt-0.5 flex-1">{opt.text}</span>
                        {isAnswered && isCorrectOpt && (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                        )}
                        {isAnswered && isSelected && !isCorrectOpt && (
                          <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Instant Pedagogical Coaching Feedback */}
              {selectedOption !== null && (
                <div
                  className={`rounded-2xl p-4 sm:p-5 border space-y-3 ${
                    selectedOption === scenario.correctIndex
                      ? 'border-emerald-500/40 bg-emerald-950/35'
                      : 'border-rose-500/40 bg-rose-950/35'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm sm:text-base font-extrabold">
                      {selectedOption === scenario.correctIndex ? (
                        <>
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          <span className="text-emerald-300">
                            Excellente lecture ! Bonne décision Kill Tilt
                          </span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-5 h-5 text-rose-400" />
                          <span className="text-rose-300">
                            Pas optimal — La meilleure ligne était :{' '}
                            {scenario.options[scenario.correctIndex]?.label ||
                              ['A', 'B', 'C', 'D'][scenario.correctIndex]}
                          </span>
                        </>
                      )}
                    </div>

                    {lastXpGained > 0 && (
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono text-xs font-extrabold tabular-nums">
                        +{lastXpGained} XP crédités
                      </span>
                    )}
                  </div>

                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed selectable-text">
                    {scenario.explanation}
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
                    <div className="flex items-center gap-2 text-xs text-amber-300 font-semibold">
                      <Target className="w-4 h-4 shrink-0" />
                      <span>Notion clé : {scenario.keyConcept}</span>
                    </div>

                    <button
                      type="button"
                      onClick={generateScenario}
                      className="px-4 py-2 rounded-xl bg-white text-slate-950 hover:bg-slate-200 text-xs font-extrabold transition inline-flex items-center gap-1.5"
                    >
                      Main suivante
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* MODE 2: HAND HISTORY REVIEW (ANALYSEUR DE MAINS JOUÉES)             */}
      {/* =================================================================== */}
      {coachMode === 'review' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column: Input Form & Review History */}
          <div className="lg:col-span-5 space-y-5">
            <form
              onSubmit={handleAnalyzeHand}
              className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4"
            >
              <div className="space-y-1 border-b border-slate-800 pb-3">
                <h3 className="text-sm sm:text-base font-extrabold text-white">
                  Soumettre une main à analyser
                </h3>
                <p className="text-xs text-slate-400">
                  Collez un historique Winamax / PokerStars brut ou racontez votre coup en français simple.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label
                    htmlFor="review-limit"
                    className="block text-[11px] font-bold uppercase text-slate-400 mb-1"
                  >
                    Limite
                  </label>
                  <select
                    id="review-limit"
                    value={reviewLimit}
                    onChange={(e) => setReviewLimit(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="NL2">NL2 (0.01/0.02€)</option>
                    <option value="NL5">NL5 (0.02/0.05€)</option>
                    <option value="NL10">NL10 (0.05/0.10€)</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="review-format"
                    className="block text-[11px] font-bold uppercase text-slate-400 mb-1"
                  >
                    Format
                  </label>
                  <select
                    id="review-format"
                    value={reviewFormat}
                    onChange={(e) => setReviewFormat(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Cash 6-Max">Cash Game 6-Max</option>
                    <option value="Cash 5-Max">Cash Game 5-Max (Winamax)</option>
                    <option value="Zoom / GoFast">Zoom / GoFast</option>
                  </select>
                </div>
              </div>

              {/* Quick 1-click Sample Buttons */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-400">
                  Exemples rapides à tester :
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {SAMPLE_HANDS.map((sample) => (
                    <button
                      key={sample.id}
                      type="button"
                      onClick={() => loadSampleHand(sample)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-200 border border-slate-700 transition"
                    >
                      {sample.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="hand-history-textarea"
                  className="block text-[11px] font-bold uppercase text-slate-400 mb-1"
                >
                  Historique ou description de la main
                </label>
                <textarea
                  id="hand-history-textarea"
                  rows={8}
                  value={handInput}
                  onChange={(e) => setHandInput(e.target.value)}
                  placeholder={`Ex : NL2, j'ouvre AQo au CO à 3bb, la BB (45/10) paie. Flop A♠ 9♦ 4♣, je C-Bet 1/2 pot, il paie. Turn 7♠...`}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 leading-relaxed"
                />
              </div>

              {reviewError && (
                <div className="rounded-xl bg-rose-950/50 border border-rose-500/40 p-3 text-xs text-rose-200 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span className="selectable-text">{reviewError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={reviewLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-xs sm:text-sm font-extrabold text-white shadow-lg shadow-emerald-950/60 transition flex items-center justify-center gap-2"
              >
                {reviewLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyse rue par rue en cours...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Analyser ma main avec le Coach IA
                  </>
                )}
              </button>
            </form>

            {/* Saved History List */}
            {savedReviews.length > 0 && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5" />
                    Mains analysées ({savedReviews.length})
                  </h4>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {savedReviews.map((item) => (
                    <div
                      key={item.id}
                      className="bg-slate-950/90 border border-slate-800 hover:border-slate-700 rounded-xl p-2.5 flex items-center justify-between gap-2 transition"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentReview(item.review);
                          setHandInput(item.rawInput);
                          setReviewLimit(item.limit);
                          setReviewFormat(item.format);
                        }}
                        className="text-left flex-1 min-w-0"
                      >
                        <div className="flex items-center gap-2 text-xs font-bold text-white">
                          <span
                            className={`font-mono ${
                              item.review.score >= 8
                                ? 'text-emerald-400'
                                : item.review.score >= 5
                                  ? 'text-amber-400'
                                  : 'text-rose-400'
                            }`}
                          >
                            {item.review.score}/10
                          </span>
                          <span className="truncate">{item.review.verdictLabel}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5 font-mono">
                          <Clock className="w-3 h-3" />
                          <span>{item.createdAt}</span>
                          <span>·</span>
                          <span>{item.limit}</span>
                          {item.review.detectedSpot?.heroPosition && (
                            <>
                              <span>·</span>
                              <span>{item.review.detectedSpot.heroPosition}</span>
                            </>
                          )}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteSavedReview(item.id)}
                        title="Supprimer cette analyse"
                        className="p-1.5 text-slate-500 hover:text-rose-400 transition shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Street-by-Street Review Report */}
          <div className="lg:col-span-7">
            {!currentReview && !reviewLoading && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-8 sm:p-10 text-center space-y-4">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
                  <Award className="w-6 h-6" />
                </div>
                <div className="max-w-md mx-auto space-y-2">
                  <h3 className="text-base font-extrabold text-white">
                    Rapport d’analyse rue par rue
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                    Votre revue détaillée apparaîtra ici : évaluation Préflop, Flop, Turn et River, diagnostic des sizings, note sur 10 et règle concrète Kill Tilt à retenir.
                  </p>
                </div>
              </div>
            )}

            {reviewLoading && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-4 animate-pulse">
                <div className="flex justify-between items-center">
                  <div className="h-6 w-1/2 bg-slate-800 rounded-lg" />
                  <div className="h-10 w-20 bg-slate-800 rounded-xl" />
                </div>
                <div className="h-24 bg-slate-950 border border-slate-800 rounded-xl" />
                <div className="h-28 bg-slate-950 border border-slate-800 rounded-xl" />
                <div className="h-28 bg-slate-950 border border-slate-800 rounded-xl" />
              </div>
            )}

            {currentReview && !reviewLoading && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-5 selectable-text">
                {/* Score & Verdict Header */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                  <div className="space-y-1 flex-1 min-w-[200px]">
                    <div className="text-xs font-mono text-slate-400">
                      {currentReview.detectedSpot.limit} · Position{' '}
                      <span className="text-white font-bold">
                        {currentReview.detectedSpot.heroPosition}
                      </span>{' '}
                      · Vilain :{' '}
                      <span className="text-amber-300 font-semibold">
                        {currentReview.detectedSpot.villainProfile}
                      </span>
                    </div>
                    <h3 className="text-lg font-extrabold text-white">
                      {currentReview.verdictLabel}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                      {currentReview.summary}
                    </p>
                  </div>

                  {/* Score / 10 Badge */}
                  <div
                    className={`shrink-0 rounded-2xl px-4 py-3 border text-center min-w-[96px] ${
                      currentReview.score >= 8
                        ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                        : currentReview.score >= 5
                          ? 'bg-amber-950/60 border-amber-500/50 text-amber-300'
                          : 'bg-rose-950/60 border-rose-500/50 text-rose-300'
                    }`}
                  >
                    <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                      Note Coach
                    </div>
                    <div className="font-mono text-3xl font-extrabold tabular-nums">
                      {currentReview.score}
                      <span className="text-sm opacity-70">/10</span>
                    </div>
                  </div>
                </div>

                {/* Detected Cards Visual Row (if detected) */}
                {(currentReview.detectedSpot.heroCards.length > 0 ||
                  currentReview.detectedSpot.boardCards.length > 0) && (
                  <div className="flex flex-wrap items-center gap-6 bg-slate-950/90 border border-slate-800 rounded-xl p-3.5">
                    {currentReview.detectedSpot.heroCards.length > 0 && (
                      <div className="flex items-center gap-2.5">
                        <span className="text-[11px] font-bold uppercase text-emerald-400">
                          Hero
                        </span>
                        <div className="flex items-center gap-1.5">
                          {currentReview.detectedSpot.heroCards.map((c) => (
                            <PokerCardVisual key={c} card={c} size="sm" />
                          ))}
                        </div>
                      </div>
                    )}
                    {currentReview.detectedSpot.boardCards.length > 0 && (
                      <div className="flex items-center gap-2.5">
                        <span className="text-[11px] font-bold uppercase text-amber-400">
                          Board
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {currentReview.detectedSpot.boardCards.map((c) => (
                            <PokerCardVisual key={c} card={c} size="sm" />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Street-by-Street Breakdown */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Analyse Rue par Rue
                  </h4>
                  <div className="space-y-3">
                    {currentReview.streets.map((st, idx) => {
                      const statusCfg =
                        st.status === 'good'
                          ? {
                              label: 'Bien joué',
                              cls: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/40',
                              Icon: CheckCircle2,
                            }
                          : st.status === 'error'
                            ? {
                                label: 'Erreur',
                                cls: 'text-rose-300 bg-rose-500/15 border-rose-500/40',
                                Icon: XCircle,
                              }
                            : {
                                label: 'Améliorable',
                                cls: 'text-amber-300 bg-amber-500/15 border-amber-500/40',
                                Icon: AlertTriangle,
                              };
                      const StatusIcon = statusCfg.Icon;

                      return (
                        <div
                          key={idx}
                          className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 space-y-2.5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-extrabold uppercase text-white">
                                {st.street}
                              </span>
                              <span className="text-xs text-slate-400">
                                — {st.actionSummary}
                              </span>
                            </div>
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-bold ${statusCfg.cls}`}
                            >
                              <StatusIcon className="w-3.5 h-3.5" />
                              {statusCfg.label}
                            </span>
                          </div>
                          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                            {st.analysis}
                          </p>
                          <div className="text-xs bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-emerald-300">
                            <strong className="text-emerald-400">Ligne optimale :</strong>{' '}
                            <span className="text-slate-200">{st.optimalLine}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Strengths vs Mistakes Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-950/90 border border-emerald-500/30 rounded-xl p-3.5 space-y-2">
                    <div className="font-extrabold text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      Ce qui est bien joué
                    </div>
                    <ul className="list-disc list-inside space-y-1.5 text-slate-300 leading-relaxed">
                      {currentReview.strengths.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-slate-950/90 border border-rose-500/30 rounded-xl p-3.5 space-y-2">
                    <div className="font-extrabold text-rose-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" />
                      Points à corriger
                    </div>
                    <ul className="list-disc list-inside space-y-1.5 text-slate-300 leading-relaxed">
                      {currentReview.mistakes.length > 0 ? (
                        currentReview.mistakes.map((m, i) => <li key={i}>{m}</li>)
                      ) : (
                        <li>Aucune erreur majeure détectée sur cette main !</li>
                      )}
                    </ul>
                  </div>
                </div>

                {/* Key Concrete Takeaway */}
                <div className="rounded-2xl bg-emerald-950/40 border border-emerald-500/40 p-4 space-y-1">
                  <div className="text-xs font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <Target className="w-4 h-4" />
                    Conseil Kill Tilt à retenir pour votre prochaine session
                  </div>
                  <p className="text-xs sm:text-sm font-medium text-white leading-relaxed">
                    {currentReview.keyTakeaway}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
