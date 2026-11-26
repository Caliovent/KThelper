import fs from 'node:fs';
import path from 'node:path';
import type { CorpusTemplate, SpotSolution } from '../src/domain/types.ts';
import {
  BOSS_CONFIG,
  CLOCK_MS,
  DRAW_BAND_PD,
  FRESQUE_CONFIG,
  GLICKO,
  RAID_CONFIG,
  RULES_VERSION,
  SALVE_CONFIG,
  TEXTURE_CONFIG,
} from '../src/engines/mp/config.ts';
import {
  CORPUS_VERSION,
  FRIENDLY_HEURISTIC_TEMPLATES,
  GENERATOR_VERSION,
  MP_CORPUS,
  validateCorpus,
  type CorpusTemplateWithMeta,
} from '../src/engines/mp/corpus.ts';
import { FRESQUE_DRILL_SETS } from '../src/engines/mp/fresque.ts';
import { FUNNEL_BLOCKS, FUNNEL_CASES } from '../src/engines/mp/funnel.ts';
import { BOSS_HAND_VARIANTS, BOSS_PROFILES } from '../src/engines/mp/boss.ts';
import { SALVE_SPOTS, computeSalveSpotEv } from '../src/engines/mp/salve.ts';
import { TEXTURE_TWIN_BOARDS } from '../src/engines/mp/texture.ts';
import { OFFLINE_SCENARIO_BANK } from '../src/engines/offlineCoach.ts';
import { V2_WEIGHTED_RANGES, expandRangeGroups } from '../src/engines/v2Ranges.ts';
import {
  L1_CORPUS_VERSION,
  L1_GENERATOR_VERSION,
  L1_MATHS_ICM_CORPUS,
  verifyL1CorpusTruth,
} from '../src/server/mp/corpusL1.ts';

function formatSolutionShort(sol: SpotSolution): string {
  if (sol.kind === 'estimate') {
    return `Estimation attendue = ${sol.truthPct}% (tolérance 0 PD ±${sol.tolerance}, zéro PD à ±${sol.zeroAt})`;
  }
  if (sol.kind === 'ev') {
    const entries = Object.entries(sol.ev)
      .sort((a, b) => b[1] - a[1])
      .map(([act, ev]) => `${act}: ${ev}`)
      .join(' | ');
    return `EV exactes -> ${entries}`;
  }
  return `Solution heuristique (${sol.kind}) : ${JSON.stringify(sol)}`;
}

function formatTemplatePublicSummary(tpl: CorpusTemplate): {
  prompt: string;
  assumptions: string[];
  options: string[];
} {
  const st = tpl.public.state;
  if (st.kind === 'estimate') {
    return {
      prompt: st.question,
      assumptions: st.assumptions,
      options: [`Slider ${st.min}%..${st.max}% (pas ${st.step})`],
    };
  }
  if (st.kind === 'decision') {
    return {
      prompt: `Hero ${st.hero} (${st.heroCards.join('')}) vs ${st.villainModel}`,
      assumptions: [],
      options: st.options.map((o) => `${o.id}: ${o.label}`),
    };
  }
  if (st.kind === 'texture') {
    return {
      prompt: `Board [${st.board.join(' ')}] (${st.potType})`,
      assumptions: [],
      options: st.options.map((o) => `${o.id}: ${o.label}`),
    };
  }
  if (st.kind === 'paint') {
    return {
      prompt: `Peindre ${st.lineIds.length} lignes (${st.lineIds.join(', ')})`,
      assumptions: [],
      options: [],
    };
  }
  return {
    prompt: `Entonnoir ${st.steps.map((s) => `${s.street}: ${s.observed}`).join(' -> ')}`,
    assumptions: [],
    options: st.blocks,
  };
}

function renderTemplateMarkdown(tpl: CorpusTemplateWithMeta, idx: number): string[] {
  const pub = formatTemplatePublicSummary(tpl);
  const unitKind = tpl.solution.kind === 'ev' ? tpl.solution.unit : tpl.solution.kind;
  const lines: string[] = [
    `#### ${idx + 1}. \`${tpl.id}\` — Famille \`${tpl.family}\` | ${tpl.public.context.format} (${tpl.bucket})`,
    `- **Provenance** : \`${tpl.provenance.origin}\` (confiance \`${tpl.provenance.confidence}\`)${tpl.provenance.tool ? ` • outil: ${tpl.provenance.tool}` : ''}`,
    `- **Unité** : ${tpl.unitLabel} (\`${unitKind}\`) • Chrono: ${tpl.public.limitMs} ms`,
    `- **Prompt** : ${pub.prompt}`,
  ];
  if (pub.assumptions.length > 0) {
    lines.push(`- **Hypothèses** : ${pub.assumptions.join(' ; ')}`);
  }
  if (pub.options.length > 0) {
    lines.push(`- **Options** : ${pub.options.join(' ; ')}`);
  }
  lines.push(`- **Solution mathématique** : ${formatSolutionShort(tpl.solution)}`);
  lines.push(`- **Explication** : ${tpl.explanationText}`);
  lines.push('');
  return lines;
}

function checkLocalCorpus(): { ok: boolean; errors: string[] } {
  try {
    validateCorpus(MP_CORPUS, { isProduction: true });
    return { ok: true, errors: [] };
  } catch (err) {
    return { ok: false, errors: [err instanceof Error ? err.message : String(err)] };
  }
}

function checkL1CorpusTruth(): { ok: boolean; total: number; families: number; errors: string[] } {
  try {
    const res = verifyL1CorpusTruth();
    return { ok: true, total: res.total, families: res.families, errors: [] };
  } catch (err) {
    return { ok: false, total: 0, families: 0, errors: [err instanceof Error ? err.message : String(err)] };
  }
}

function main() {
  const localCorpusCheck = checkLocalCorpus();
  const l1TruthCheck = checkL1CorpusTruth();

  const auditPayload = {
    meta: {
      generatedAt: new Date().toISOString(),
      rulesVersion: RULES_VERSION,
      localCorpusVersion: CORPUS_VERSION,
      localGeneratorVersion: GENERATOR_VERSION,
      l1CorpusVersion: L1_CORPUS_VERSION,
      l1GeneratorVersion: L1_GENERATOR_VERSION,
      checks: {
        localCorpusValid: localCorpusCheck.ok,
        localCorpusErrors: localCorpusCheck.errors,
        l1CorpusTruthValid: l1TruthCheck.ok,
        l1CorpusTruthErrors: l1TruthCheck.errors,
      },
      counts: {
        duelLibreCorpus: MP_CORPUS.length,
        friendlyHeuristics: FRIENDLY_HEURISTIC_TEMPLATES.length,
        l1RankedCorpus: L1_MATHS_ICM_CORPUS.length,
        fresqueSets: FRESQUE_DRILL_SETS.length,
        fresqueLines: FRESQUE_DRILL_SETS.reduce((acc, s) => acc + s.lines.length, 0),
        salveSpots: SALVE_SPOTS.length,
        textureSpots: TEXTURE_TWIN_BOARDS.length,
        funnelCases: FUNNEL_CASES.length,
        funnelStreets: FUNNEL_CASES.reduce((acc, c) => acc + c.streets.length, 0),
        bossProfiles: Object.keys(BOSS_PROFILES).length,
        bossHands: BOSS_HAND_VARIANTS.length,
        v2Ranges: V2_WEIGHTED_RANGES.length,
        offlineCoachScenarios: OFFLINE_SCENARIO_BANK.length,
      },
    },
    scoringAndRules: {
      drawBandPd: DRAW_BAND_PD,
      clockMs: CLOCK_MS,
      glicko: GLICKO,
      fresqueConfig: FRESQUE_CONFIG,
      salveConfig: SALVE_CONFIG,
      textureConfig: TEXTURE_CONFIG,
      bossConfig: BOSS_CONFIG,
      raidConfig: RAID_CONFIG,
    },
    games: {
      duelLibreEtWarmup: {
        calibratedSpots: MP_CORPUS,
        friendlyHeuristics: FRIENDLY_HEURISTIC_TEMPLATES,
      },
      areneClasseeServeur: {
        spots: L1_MATHS_ICM_CORPUS,
      },
      peinsTaRange: FRESQUE_DRILL_SETS,
      sprint3MaxExpresso: SALVE_SPOTS.map((sp) => ({
        ...sp,
        computedEvCheck: computeSalveSpotEv(sp.model),
      })),
      lectureDeBoard: TEXTURE_TWIN_BOARDS,
      handReadingEntonnoir: {
        blocks: FUNNEL_BLOCKS,
        cases: FUNNEL_CASES,
      },
      tableDesBossEtRaids: {
        profiles: BOSS_PROFILES,
        hands: BOSS_HAND_VARIANTS,
      },
      catalogueRangesV2: V2_WEIGHTED_RANGES.map((spec) => {
        const expanded = expandRangeGroups(spec.groups);
        return {
          ...spec,
          expandedHandsCount: Object.keys(expanded).length,
          expandedHands: expanded,
        };
      }),
      coachHorsLigne: OFFLINE_SCENARIO_BANK,
    },
  };

  const docsDir = path.resolve(process.cwd(), 'docs');
  fs.mkdirSync(docsDir, { recursive: true });

  const jsonPath = path.join(docsDir, 'audit-contenu-jeux.json');
  fs.writeFileSync(jsonPath, JSON.stringify(auditPayload, null, 2), 'utf8');

  const md: string[] = [
    '# Audit Complet du Contenu Pédagogique & des Jeux — Kill Tilt Poker Suite',
    '',
    `> Généré automatiquement le \`${auditPayload.meta.generatedAt}\` via \`npm run export:audit\`.`,
    '> Destiné à la relecture poker (EV, ICM, PKO, ChipEV, MDF, Alpha, textures, ranges) par un joueur pro, un coach ou un analyseur externe.',
    '',
    '## 1. Synthèse & Vérifications Automatiques',
    '',
    `- **Règles Arène** : \`${RULES_VERSION}\` | **Corpus Local** : \`${CORPUS_VERSION}\` (${MP_CORPUS.length} spots calibrés + ${FRIENDLY_HEURISTIC_TEMPLATES.length} heuristiques) | **Corpus Classé L1** : \`${L1_CORPUS_VERSION}\` (${L1_MATHS_ICM_CORPUS.length} spots)`,
    `- **Validation \`validateCorpus(MP_CORPUS)\`** : ${localCorpusCheck.ok ? '✅ OK' : `❌ ERREURS: ${localCorpusCheck.errors.join(' | ')}`}`,
    `- **Validation \`verifyL1CorpusTruth()\`** : ${l1TruthCheck.ok ? '✅ OK' : `❌ ERREURS: ${l1TruthCheck.errors.join(' | ')}`}`,
    '',
    '| Jeu / Module | Volume | Éligibilité Classé | Barème / Règle |',
    '| :--- | :--- | :--- | :--- |',
    `| **Duel Libre & Warm-up du Jour** | ${MP_CORPUS.length} spots calibrés (+ ${FRIENDLY_HEURISTIC_TEMPLATES.length} amicaux) | Maths & ICM uniquement | PD (1000 PD = 1 bb ou 1% PP), marge ±1.5 pt sur estimations |`,
    `| **Arène Classée, Heads-Up Live & Défi du Jour** | ${L1_MATHS_ICM_CORPUS.length} spots serveur | ✅ Classé officiel | Solutions jamais envoyées avant fin de match / clôture UTC |`,
    `| **Peins ta Range** | ${FRESQUE_DRILL_SETS.length} sets (${auditPayload.meta.counts.fresqueLines} lignes) | ❌ Amical uniquement | Frontière ±1 case ×2, pondérée combos (6/4/12), 25 s/ligne |`,
    `| **Sprint Expresso & 3-Max** | ${SALVE_SPOTS.length} spots (12 + 3 Mort Subite) | Modèle affiché | ChipEV \`mbb\` & Jackpot 80/12/8 \`ppm_pp\`, 4 s/spot |`,
    `| **Lecture de Board** | ${TEXTURE_TWIN_BOARDS.length} flops jumeaux | ❌ Hors classement | Étape 1 (Range/Nuts) + Étape 2 (Fréq/Sizing) |`,
    `| **Hand Reading — Entonnoir** | ${FUNNEL_CASES.length} cas (${auditPayload.meta.counts.funnelStreets} rues) | ❌ Hors classement | 6 blocs par rue + comparaison pair, PD = 1000 × (1 − recouvrement) |`,
    `| **Table des Boss & Raids 72h** | 4 Bosses, ${BOSS_HAND_VARIANTS.length} mains multi-streets | Hors classement (Raid Club) | Solo < 500 PD/main & pic ≤ 500 PD ; Raid Équipe ≤ 80 PD/décision |`,
    `| **Catalogue Ranges V2** | ${V2_WEIGHTED_RANGES.length} ranges multi-formats | N/A | Cash 6-Max, MTT 15-20bb, Expresso 25bb |`,
    `| **Scénarios Coach hors-ligne** | ${OFFLINE_SCENARIO_BANK.length} scénarios | N/A | Quiz multi-streets avec calcul EV / MDF / ICM |`,
    '',
    '---',
    '',
    '## 2. Sprint Expresso & 3-Max (`salve.ts`)',
    '',
  ];

  SALVE_SPOTS.forEach((sp, i) => {
    const ev = computeSalveSpotEv(sp.model);
    md.push(`### ${i + 1}. \`${sp.template.id}\` — ${sp.model.name} ${sp.suddenDeath ? '🔥 (Mort Subite)' : ''}`);
    md.push(
      `- **Format** : ${sp.model.format} | Tapis eff. ${sp.model.effectiveBb} bb | Pot avant héro ${sp.model.potBeforeBb} bb | Coût call/shove ${sp.model.heroCostBb} bb`
    );
    md.push(
      `- **Hypothèses affichées** : Fold adverse = ${sp.model.foldToActionPct}% | Équité héro si payé = ${sp.model.heroEqWhenCalledPct}% | Fréq affichées : ${sp.model.displayedFreqs}`
    );
    md.push(
      `- **EV calculée (\`computeSalveSpotEv\`)** : \`${ev.unit}\` -> Action = \`${ev.evShoveOrCall}\` vs Fold = \`${ev.evFold}\`${ev.riskPremiumPct !== null ? ` (Risk Premium ICM = ${ev.riskPremiumPct}%)` : ''}`
    );
    md.push(`- **Explication** : ${sp.explanation}`);
    md.push('');
  });

  md.push('---', '', '## 3. Peins ta Range (`fresque.ts`)', '');
  FRESQUE_DRILL_SETS.forEach((set) => {
    md.push(`### ${set.title} (\`${set.id}\` — ${set.position})`);
    md.push(`- **Provenance** : ${set.provenanceNote}`);
    set.lines.forEach((l) => {
      const refHands = l.reference.floorIndex !== null ? l.hands.slice(0, l.reference.floorIndex + 1).join(', ') : 'Aucun plancher';
      const islands = l.reference.islands.length ? ` + îlots: ${l.reference.islands.map((idx) => l.hands[idx]).join(', ')}` : '';
      md.push(`- **${l.label}** : Référence = \`${refHands}${islands}\` — *${l.note}*`);
    });
    md.push('');
  });

  md.push('---', '', '## 4. Lecture de Board (`texture.ts`)', '');
  TEXTURE_TWIN_BOARDS.forEach((t, i) => {
    const st = t.template.public.state;
    const board = st.kind === 'texture' ? st.board.join(' ') : '';
    md.push(`### ${i + 1}. \`${t.template.id}\` — ${t.twinLabel} (\`${board}\`)`);
    md.push(
      `- **Attendu Étape 1** : Avantage Range = \`${t.expectedPhase1.rangeAdv}\` | Avantage Nuts = \`${t.expectedPhase1.nutsAdv}\``
    );
    md.push(`- **Attendu Étape 2** : Fréquence = \`${t.expectedPhase2.freqPct}%\` | Sizing = \`${t.expectedPhase2.sizingPct}%\``);
    md.push(`- **Explication** : ${t.explanation}`);
    md.push('');
  });

  md.push('---', '', '## 5. Hand Reading — Entonnoir de Range (`funnel.ts`)', '');
  FUNNEL_CASES.forEach((fc) => {
    md.push(`### ${fc.title} (\`${fc.id}\`)`);
    md.push(`- **Hypothèses** : ${fc.assumptions.join(' ; ')}`);
    fc.streets.forEach((st) => {
      md.push(`- **${st.street} [${st.board.join(' ')}] (${st.observedAction})**`);
      md.push(`  - Référence (%) : ${JSON.stringify(st.referenceWeights)}`);
      md.push(`  - Pair affiché (%) : ${JSON.stringify(st.peerInitialWeights)}`);
      md.push(`  - Explication : ${st.explanation}`);
    });
    md.push('');
  });

  md.push('---', '', '## 6. Table des Boss & Raids 72h (`boss.ts`)', '');
  BOSS_HAND_VARIANTS.forEach((bh, i) => {
    md.push(`### ${i + 1}. \`${bh.id}\` (${bh.bossId}) — ${bh.title}`);
    bh.steps.forEach((st, sIdx) => {
      md.push(
        `- **Décision ${sIdx + 1} (${st.streetLabel} / ${st.phase})** : Héro \`[${st.heroCards.join(' ')}]\` Board \`[${st.board.join(' ')}]\` — ${st.prompt}`
      );
      md.push(`  - Ligne de référence : *${st.referenceRailActionLabel}* | ${formatSolutionShort(st.solution)}`);
      md.push(`  - Explication : ${st.explanation}`);
    });
    md.push('');
  });

  md.push('---', '', '## 7. Catalogue Ranges V2 (`v2Ranges.ts`)', '');
  V2_WEIGHTED_RANGES.forEach((vr) => {
    const exp = expandRangeGroups(vr.groups);
    md.push(`### \`${vr.id}\` — ${vr.scenario} (${vr.format}, ${vr.stackBB}bb, ${vr.position})`);
    md.push(
      `- **Provenance** : \`${vr.provenance.origin}\` (${vr.provenance.confidence})${vr.provenance.note ? ` — ${vr.provenance.note}` : ''}`
    );
    md.push(`- **Mains couvertes** : ${Object.keys(exp).length} mains 13×13 • Synthèse : ${JSON.stringify(vr.summary)}`);
    vr.groups.forEach((g) => {
      md.push(`  - ${JSON.stringify(g.freq)} : \`${g.hands.join(', ')}\``);
    });
    md.push('');
  });

  md.push('---', '', '## 8. Scénarios Coach Hors-Ligne (`offlineCoach.ts`)', '');
  OFFLINE_SCENARIO_BANK.forEach((sc, i) => {
    md.push(`### ${i + 1}. ${sc.title} (${sc.limit} • ${sc.street})`);
    md.push(
      `- **Setup** : ${sc.heroPosition} (${sc.heroStackBb}bb) \`[${sc.heroCards.join(' ')}]\` vs ${sc.villainPosition} (${sc.villainProfileName}) • Board \`[${sc.boardCards.join(' ')}]\` • Pot ${sc.potBb}bb`
    );
    md.push(`- **Question** : ${sc.question}`);
    md.push(`- **Bonne option** : \`${sc.options[sc.correctIndex]?.label}\` — ${sc.options[sc.correctIndex]?.text}`);
    md.push(`- **Explication** : ${sc.explanation}`);
    md.push('');
  });

  md.push('---', '', `## 9. Corpus Arène Classée Serveur (\`${L1_CORPUS_VERSION}\` — ${L1_MATHS_ICM_CORPUS.length} spots)`, '');
  L1_MATHS_ICM_CORPUS.forEach((tpl, i) => {
    md.push(...renderTemplateMarkdown(tpl, i));
  });

  md.push('---', '', `## 10. Corpus Duel Libre Local (\`${CORPUS_VERSION}\` — ${MP_CORPUS.length} spots + ${FRIENDLY_HEURISTIC_TEMPLATES.length} amicaux)`, '');
  [...MP_CORPUS, ...FRIENDLY_HEURISTIC_TEMPLATES].forEach((tpl, i) => {
    md.push(...renderTemplateMarkdown(tpl, i));
  });

  const mdPath = path.join(docsDir, 'AUDIT_CONTENU_JEUX.md');
  fs.writeFileSync(mdPath, md.join('\n'), 'utf8');

  console.log('AUDIT EXPORT OK:', {
    jsonPath,
    mdPath,
    counts: auditPayload.meta.counts,
    checks: auditPayload.meta.checks,
  });
}

main();
