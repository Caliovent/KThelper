import { REVIEW_SIGNALS } from './config';

export type IntegritySignalKind =
  | 'timing_const'
  | 'slow_perfect'
  | 'level_jump'
  | 'collusion_forfeit';

export interface IntegritySignal {
  kind: IntegritySignalKind;
  severity: 'low' | 'medium';
  summary: string;
}

export interface PlayerRunTelemetry {
  matchId: string;
  opponentId: string | null;
  totalPd: number;
  forfeited: boolean;
  spots: readonly { elapsedMs: number; pd: number; trivial?: boolean }[];
}

/**
 * Détection purement déclarative de signaux de revue humaine (Bible p.31-32 & MP-21).
 * RÈGLE IMPÉRATIVE : Ne modifie JAMAIS aucun MMR ni aucune note ; ouvre uniquement un signal de revue humaine.
 */
export function evaluateIntegritySignals(history: readonly PlayerRunTelemetry[]): IntegritySignal[] {
  const signals: IntegritySignal[] = [];
  if (history.length < REVIEW_SIGNALS.minRuns) {
    return signals;
  }

  // 1. Temps quasi constants sur spots non triviaux (écart-type < 15 ms)
  const nonTrivialTimes: number[] = [];
  for (const run of history) {
    for (const s of run.spots) {
      if (!s.trivial && s.elapsedMs > 0) nonTrivialTimes.push(s.elapsedMs);
    }
  }
  if (nonTrivialTimes.length >= 15) {
    const mean = nonTrivialTimes.reduce((a, b) => a + b, 0) / nonTrivialTimes.length;
    const std = Math.sqrt(
      nonTrivialTimes.reduce((a, t) => a + (t - mean) ** 2, 0) / nonTrivialTimes.length
    );
    if (std < REVIEW_SIGNALS.timingStdMs) {
      signals.push({
        kind: 'timing_const',
        severity: 'medium',
        summary: `Écart-type temporel très faible (${std.toFixed(1)} ms < ${REVIEW_SIGNALS.timingStdMs} ms).`,
      });
    }
  }

  // 2. Lent et parfait de façon répétée (>= 85% des runs récents à 0 PD avec moyenne > 6500ms)
  const slowPerfectCount = history.filter((r) => {
    if (r.spots.length === 0) return false;
    const meanMs = r.spots.reduce((a, s) => a + s.elapsedMs, 0) / r.spots.length;
    return r.totalPd === 0 && meanMs > 6500;
  }).length;
  if (slowPerfectCount / history.length >= REVIEW_SIGNALS.slowPerfectRatio) {
    signals.push({
      kind: 'slow_perfect',
      severity: 'medium',
      summary: `${slowPerfectCount}/${history.length} runs parfaits (0 PD) avec latence élevée.`,
    });
  }

  // 3. Rupture brusque de précision par rapport à l'historique antérieur
  if (history.length >= 8) {
    const half = Math.floor(history.length / 2);
    const earlyMean = history.slice(0, half).reduce((a, r) => a + r.totalPd, 0) / half;
    const recentMean = history.slice(half).reduce((a, r) => a + r.totalPd, 0) / (history.length - half);
    if (earlyMean - recentMean >= REVIEW_SIGNALS.levelJumpPdDrop && recentMean <= 40) {
      signals.push({
        kind: 'level_jump',
        severity: 'low',
        summary: `Rupture de précision : moyenne ${Math.round(earlyMean)} PD -> ${Math.round(recentMean)} PD.`,
      });
    }
  }

  // 4. Forfaits ciblés vers le même adversaire
  const forfeitByOpp = new Map<string, number>();
  for (const r of history) {
    if (r.forfeited && r.opponentId) {
      forfeitByOpp.set(r.opponentId, (forfeitByOpp.get(r.opponentId) ?? 0) + 1);
    }
  }
  for (const [oppId, count] of forfeitByOpp.entries()) {
    if (count >= REVIEW_SIGNALS.collusionPairForfeits) {
      signals.push({
        kind: 'collusion_forfeit',
        severity: 'medium',
        summary: `Concentration de ${count} forfaits contre le même compte (${oppId.slice(0, 8)}…).`,
      });
    }
  }

  return signals;
}
