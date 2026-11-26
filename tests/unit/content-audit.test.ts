import { describe, expect, it } from 'vitest';
import { comboCount } from '../../src/engines/chunk';
import {
  BOSS_HAND_VARIANTS,
  FUNNEL_CASES,
  SALVE_SPOTS,
  TEXTURE_TWIN_BOARDS,
  computeSalveSpotEv,
} from '../../src/engines/mp';
import { OFFLINE_SCENARIO_BANK } from '../../src/engines/offlineCoach';
import {
  V2_WEIGHTED_RANGES,
  expandRangeGroups,
  type V2ActionCode,
} from '../../src/engines/v2Ranges';

function assertUniqueCards(cards: readonly string[], label: string): void {
  const seen = new Set<string>();
  for (const card of cards) {
    expect(seen.has(card), `Carte dupliquée "${card}" dans ${label}`).toBe(false);
    seen.add(card);
  }
}

describe('Audit anti-régression du contenu des jeux', () => {
  it('garantit zéro carte dupliquée dans Boss, Coach hors-ligne, Radar de Board et Entonnoir', () => {
    for (const hand of BOSS_HAND_VARIANTS) {
      for (const step of hand.steps) {
        assertUniqueCards([...step.heroCards, ...step.board], `${hand.id} (${step.streetLabel})`);
      }
    }

    for (const scenario of OFFLINE_SCENARIO_BANK) {
      assertUniqueCards(
        [...scenario.heroCards, ...scenario.boardCards],
        `offlineCoach:${scenario.title}`
      );
    }

    for (const tex of TEXTURE_TWIN_BOARDS) {
      const state = tex.template.public.state;
      if (state.kind === 'texture') {
        assertUniqueCards(state.board, `texture:${tex.template.id}`);
      }
    }

    for (const funnelCase of FUNNEL_CASES) {
      for (const street of funnelCase.streets) {
        assertUniqueCards(street.board, `funnel:${funnelCase.id}:${street.street}`);
      }
    }
  });

  it('vérifie les calculs ChipEV et Jackpot 80/12/8 exacts des 15 spots Salve', () => {
    const byId = new Map(SALVE_SPOTS.map((spot) => [spot.template.id, spot]));

    const salve04 = byId.get('salve_04_bb_call_aggro')!;
    const ev04 = computeSalveSpotEv(salve04.model);
    expect(ev04.unit).toBe('mbb');
    expect(ev04.evShoveOrCall).toBe(2408);

    const salve05 = byId.get('salve_05_3max_btn_18bb')!;
    const ev05 = computeSalveSpotEv(salve05.model);
    expect(ev05.unit).toBe('mbb');
    expect(ev05.evShoveOrCall).toBe(-76);
    expect(ev05.evFold).toBe(0);

    const salve06 = byId.get('salve_06_bb_vs_iso_nit')!;
    const ev06 = computeSalveSpotEv(salve06.model);
    expect(ev06.unit).toBe('mbb');
    expect(ev06.evShoveOrCall).toBe(-1989);

    const salve15 = byId.get('salve_15_sd_jackpot_3max')!;
    expect(salve15.model.stacksBb).toEqual([14, 14, 14]);
    expect(salve15.model.effectiveBb).toBe(14);
    const ev15 = computeSalveSpotEv(salve15.model);
    expect(ev15.unit).toBe('ppm_pp');
    expect(ev15.riskPremiumPct).toBeCloseTo(1.35, 1);
    expect(ev15.evShoveOrCall).toBeGreaterThan(ev15.evFold);

    for (const spot of SALVE_SPOTS) {
      const computed = computeSalveSpotEv(spot.model);
      expect(spot.template.solution.kind).toBe('ev');
      if (spot.template.solution.kind === 'ev') {
        const nonFoldEntry = Object.entries(spot.template.solution.ev).find(
          ([action]) => action !== 'fold'
        );
        expect(nonFoldEntry).toBeDefined();
        expect(nonFoldEntry?.[1]).toBe(computed.evShoveOrCall);
        expect(spot.template.solution.ev.fold).toBe(computed.evFold);
      }
    }
  });

  it('vérifie la provenance et la somme exacte des combos des ranges V2', () => {
    const summaryActionMap: { key: string; action: V2ActionCode }[] = [
      { key: 'combosMr', action: 'mr' },
      { key: 'combosShv', action: 'shv' },
      { key: 'combos3b', action: '3b' },
      { key: 'combos4b', action: '4b' },
      { key: 'combosCall', action: 'c' },
      { key: 'combosLimp', action: 'limp' },
    ];

    for (const spec of V2_WEIGHTED_RANGES) {
      expect(spec.provenance.origin, `Provenance inattendue sur ${spec.id}`).toBe('heuristic');
      const expanded = expandRangeGroups(spec.groups);

      const actionTotals: Record<V2ActionCode, number> = {
        mr: 0,
        shv: 0,
        '3b': 0,
        '4b': 0,
        c: 0,
        limp: 0,
        f: 0,
      };
      for (const [hand, freq] of Object.entries(expanded)) {
        const combos = comboCount(hand);
        for (const action of Object.keys(actionTotals) as V2ActionCode[]) {
          actionTotals[action] += combos * (freq[action] ?? 0);
        }
      }

      for (const { key, action } of summaryActionMap) {
        if (key in spec.summary) {
          expect(
            Math.abs(actionTotals[action] - spec.summary[key]),
            `${spec.id} -> ${key} attendu ${spec.summary[key]}, calculé ${actionTotals[action].toFixed(2)}`
          ).toBeLessThanOrEqual(0.2);
        }
      }
    }
  });
});
