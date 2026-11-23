export interface QuizProgressInfo {
  xp: number;
  level: number;
  icon: string;
  title: string;
  desc: string;
  minXp: number;
  maxXp: number;
}

export interface VillainHud {
  vpip: number;
  pfr: number;
  threeBet: number;
  af: number;
  hands: number;
}

export interface ScenarioOption {
  label: string;
  text: string;
}

export interface CoachScenario {
  title: string;
  limit: string;
  street: string;
  heroPosition: string;
  heroStackBb: number;
  heroCards: string[];
  boardCards: string[];
  potBb: number;
  villainPosition: string;
  villainStackBb: number;
  villainProfileName: string;
  villainHud: VillainHud;
  actionHistory: string[];
  question: string;
  options: ScenarioOption[];
  correctIndex: number;
  hint: string;
  explanation: string;
  keyConcept: string;
  xpReward: number;
}

export interface StreetAnalysis {
  street: string;
  status: 'good' | 'warning' | 'error' | string;
  actionSummary: string;
  analysis: string;
  optimalLine: string;
}

export interface HandReview {
  score: number;
  verdictLabel: string;
  summary: string;
  detectedSpot: {
    limit: string;
    heroPosition: string;
    heroCards: string[];
    boardCards: string[];
    villainProfile: string;
  };
  streets: StreetAnalysis[];
  strengths: string[];
  mistakes: string[];
  keyTakeaway: string;
}

export interface SavedHandReview {
  id: number;
  createdAt: string;
  limit: string;
  format: string;
  rawInput: string;
  review: HandReview;
}

declare global {
  interface Window {
    getKillTiltQuizProgress?: () => QuizProgressInfo;
    creditKillTiltCoachXp?: (amount: number) => {
      xp: number;
      leveledUp: boolean;
      levelInfo: QuizProgressInfo;
    };
    showKillTiltToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
  }
}
