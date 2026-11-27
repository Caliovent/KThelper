import {
  icm,
  icmWithBusts,
  requiredEquityIcm,
  bubbleFactor,
} from '../engines/icm';
import {
  bountyAdjusted,
  evItmWta,
  evRoiWta,
  breakevenCev,
  rake,
  riskOfRuin,
  winrateCi95,
} from '../engines/formats';
import { solvePushFold } from '../engines/nash';
import {
  RANKS,
  lines,
  describeLine,
  comboCount,
  blockerImpact,
} from '../engines/chunk';
import { texture } from '../engines/postflop';
import {
  gradeAttempt,
  gradeFunnelAttempt,
  createFunnelFsrsCard,
  reviewFunnelFsrsCard,
  getFunnelCardRetrievability,
  buildFunnelWarmupCandidates,
  masteryScore,
  betaCdfInt,
  leakProbability,
  buildWarmup,
} from '../engines/srs';
import {
  EVOLUTIONARY_FUNNEL_SCENARIOS,
  buildCardMask52,
  computeStreetMatrixDiff,
} from '../engines/evolutionaryFunnel';
import {
  getFunnelWarmupCandidatesFromStore,
  openFunnelScenarioInUi,
  recordFunnelFsrsReview,
} from '../stores/funnelFsrsStore';
import {
  splitHands,
  detectSite,
  parseHand,
  importFile,
} from '../engines/parser';
import {
  V2_ACTION_PALETTE,
  V2_WEIGHTED_RANGES,
  expandRangeGroups,
  simplifyFreqVector25,
} from '../engines/v2Ranges';
import * as mp from '../engines/mp';
import { isMpEnabled } from '../stores/arenaStore';

export const ProPokerV2 = {
  icm,
  icmWithBusts,
  requiredEquityIcm,
  bubbleFactor,
  bountyAdjusted,
  evItmWta,
  evRoiWta,
  breakevenCev,
  rake,
  riskOfRuin,
  winrateCi95,
  solvePushFold,
  RANKS,
  lines,
  describeLine,
  comboCount,
  blockerImpact,
  texture,
  gradeAttempt,
  gradeFunnelAttempt,
  createFunnelFsrsCard,
  reviewFunnelFsrsCard,
  getFunnelCardRetrievability,
  buildFunnelWarmupCandidates,
  getFunnelWarmupCandidatesFromStore,
  recordFunnelFsrsReview,
  openFunnelScenarioInUi,
  masteryScore,
  betaCdfInt,
  leakProbability,
  buildWarmup,
  splitHands,
  detectSite,
  parseHand,
  importFile,
  V2_ACTION_PALETTE,
  V2_WEIGHTED_RANGES,
  expandRangeGroups,
  simplifyFreqVector25,
  EVOLUTIONARY_FUNNEL_SCENARIOS,
  buildCardMask52,
  computeStreetMatrixDiff,
  mp,
  isMpEnabled,
} as const;

export type ProPokerV2Api = typeof ProPokerV2;

declare global {
  interface Window {
    ProPokerV2?: ProPokerV2Api;
  }
}

if (typeof window !== 'undefined') {
  window.ProPokerV2 = ProPokerV2;
  window.dispatchEvent(new CustomEvent('propoker-v2-ready', { detail: ProPokerV2 }));
}
