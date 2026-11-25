import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import { getApp, getApps, initializeApp as initializeAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth, type DecodedIdToken } from 'firebase-admin/auth';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const PRIMARY_MODEL = 'gemini-4-hydrogen';
const FALLBACK_MODEL = 'gemini-3.1-flash-lite';

const adminApp = getApps().length
  ? getApp()
  : initializeAdminApp({
      projectId: firebaseConfig.projectId,
    });
const adminAuth = getAdminAuth(adminApp);

async function requireFirebaseAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Authentification requise. Connectez-vous avec votre compte Google pour utiliser le Coach IA Poker.',
      });
    }
    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      return res.status(401).json({
        error: 'Jeton d’authentification manquant. Veuillez vous reconnecter.',
      });
    }
    const decoded: DecodedIdToken = await adminAuth.verifyIdToken(token);
    (req as express.Request & { user?: DecodedIdToken }).user = decoded;
    return next();
  } catch (err) {
    console.error('[Auth] Invalid Firebase ID token:', err);
    return res.status(401).json({
      error: 'Session expirée ou non autorisée. Veuillez vous reconnecter avec Google.',
    });
  }
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'Clé API Gemini absente côté serveur. Vérifiez le secret GEMINI_API_KEY dans Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function isTransientGeminiError(err: unknown): boolean {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  const status = (err as { status?: number; code?: number })?.status ?? (err as { code?: number })?.code;
  return (
    status === 503 ||
    status === 500 ||
    status === 429 ||
    /503|UNAVAILABLE|high demand|overloaded|RESOURCE_EXHAUSTED|temporarily unavailable/i.test(raw)
  );
}

function formatGeminiError(err: unknown, fallbackMessage: string): { status: number; message: string } {
  if (isTransientGeminiError(err)) {
    return {
      status: 503,
      message:
        'Le service Gemini connaît un pic de trafic temporaire (503). Réessayez dans quelques secondes.',
    };
  }
  const message = err instanceof Error ? err.message : fallbackMessage;
  return { status: 500, message };
}

async function generateJsonWithRetry(
  ai: GoogleGenAI,
  prompt: string,
  responseSchema: Record<string, unknown>
) {
  const modelsToTry = [PRIMARY_MODEL, FALLBACK_MODEL];
  let lastError: unknown = null;

  for (const model of modelsToTry) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema,
          },
        });
      } catch (err) {
        lastError = err;
        if (!isTransientGeminiError(err)) {
          throw err;
        }
        console.warn(`[Gemini] Transient error on ${model} (attempt ${attempt + 1}/2), retrying...`);
        if (attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 900));
        }
      }
    }
  }

  throw lastError;
}

const VALID_CARD_RE = /^[AKQJT98765432][shdc]$/;

interface GeneratedScenario {
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
  villainHud: {
    vpip: number;
    pfr: number;
    threeBet: number;
    af: number;
    hands: number;
  };
  actionHistory: string[];
  question: string;
  options: Array<{ label: string; text: string }>;
  correctIndex: number;
  hint: string;
  explanation: string;
  keyConcept: string;
  xpReward: number;
}

function validateScenario(data: GeneratedScenario): boolean {
  if (!data || !Array.isArray(data.heroCards) || data.heroCards.length !== 2) {
    return false;
  }
  if (!Array.isArray(data.boardCards)) return false;
  if (![0, 3, 4, 5].includes(data.boardCards.length)) return false;

  const allCards = [...data.heroCards, ...data.boardCards];
  for (const card of allCards) {
    if (!VALID_CARD_RE.test(card)) return false;
  }
  if (new Set(allCards).size !== allCards.length) return false;

  if (!Array.isArray(data.options) || data.options.length !== 4) return false;
  if (
    typeof data.correctIndex !== 'number' ||
    data.correctIndex < 0 ||
    data.correctIndex > 3
  ) {
    return false;
  }
  return true;
}

async function createServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.post('/api/coach/scenario', requireFirebaseAuth, async (req, res) => {
    try {
      const {
        xp = 0,
        level = 1,
        levelTitle = 'Niveau 1 — Apprenti NL2',
        levelDesc = 'Fondations NL2',
        streetFocus = 'AUTO',
        limit = 'NL2',
        recentTopics = [],
      } = req.body ?? {};

      const safeLevel = Math.min(5, Math.max(1, Number(level) || 1));
      const safeLimit = limit === 'NL5' ? 'NL5' : 'NL2';
      const safeStreetFocus = ['AUTO', 'Préflop', 'Flop', 'Turn', 'River'].includes(
        String(streetFocus)
      )
        ? String(streetFocus)
        : 'AUTO';

      const recentNote =
        Array.isArray(recentTopics) && recentTopics.length > 0
          ? `Évite de répéter ces thèmes déjà joués récemment : ${recentTopics.slice(0, 6).join(', ')}.`
          : '';

      const levelGuidance: Record<number, string> = {
        1: 'Niveau 1 (Débutant NL2) : spots clairs de Préflop (Open Raise, Iso-raise limper, fold main dominée) ou Flop simple (C-Bet board dry vs board drawy, value top paire contre Fish passif).',
        2: 'Niveau 2 (Régulier TAG) : défense de BB, iso-raise SB limp, set mining, c-bet adapté à la texture du flop et value bet 2-3 streets contre Calling Station.',
        3: 'Niveau 3 (3-Bet / 4-Bet & Profiling HUD) : 3-Bet IP/OOP, Squeeze 4x, discipline face aux 5-Bet tapis de Nit, exploitation ciblée des stats HUD (VPIP/PFR/3-Bet/AF).',
        4: 'Niveau 4 (Stratège Mathématique) : cotes du pot (Pot Odds), calcul d’outs (règle x4 / x2.25) sur tirages couleur/quinte/combo draw, EV d’un call turn/river, protection.',
        5: 'Niveau 5 (Shark Kill Tilt) : décisions complexes Turn/River, réévaluation d’overpaire sur board connecté face à check-raise passif, thin value river, overbets exploitants, bluff-catching vs profil aggro/nit.',
      };

      const streetInstruction =
        safeStreetFocus === 'AUTO'
          ? 'Choisis librement une rue pertinente (Préflop, Flop, Turn ou River) adaptée au niveau du joueur.'
          : `La décision finale DOIT impérativement se situer à la rue : ${safeStreetFocus}. (${
              safeStreetFocus === 'Préflop'
                ? 'boardCards doit être un tableau vide []'
                : safeStreetFocus === 'Flop'
                  ? 'boardCards doit contenir exactement 3 cartes'
                  : safeStreetFocus === 'Turn'
                    ? 'boardCards doit contenir exactement 4 cartes'
                    : 'boardCards doit contenir exactement 5 cartes'
            }).`;

      const ai = getGeminiClient();

      const prompt = `Tu es un coach de poker professionnel francophone spécialisé en Cash Game 6-Max micro-limites (${safeLimit}) dans la pure pédagogie Kill Tilt / Pe4nuts (jeu TAG, discipline préflop, pas de limp, sizings 3bb + 1bb/limper, 3-Bet 3x IP / +1-2bb OOP, exploitation pragmatique du HUD en micro-limites, cotes du pot et lecture de texture).

Génère un scénario de poker Cash Game 6-Max 100% inédit, réaliste et ultra-pédagogique en ${safeLimit}.
Profil actuel de l'élève :
- Niveau : ${safeLevel}/5 (${levelTitle}, ${xp} XP)
- Axe pédagogique : ${levelDesc}
- Consigne de difficulté : ${levelGuidance[safeLevel]}
- ${streetInstruction}
- ${recentNote}

Règles strictes :
1. Les cartes (heroCards et boardCards) doivent utiliser la notation exacte rang+couleur en anglais à 2 caractères : rang parmi A, K, Q, J, T, 9, 8, 7, 6, 5, 4, 3, 2 et couleur parmi s (pique), h (coeur), d (carreau), c (trèfle). Exemple : ["As", "Kd"], ["Ac", "9d", "4s"].
2. AUCUNE carte en double entre heroCards et boardCards !
3. Si street == "Préflop", boardCards = []. Si "Flop", 3 cartes. Si "Turn", 4 cartes. Si "River", 5 cartes.
4. Hero a un stack de 100bb (heroStackBb = 100). Vilain a un profil HUD cohérent avec son comportement dans le coup.
5. Propose exactement 4 choix d'actions distincts (labels "A", "B", "C", "D") avec des sizings réalistes en bb ou % du pot. Un seul choix est clairement la meilleure ligne Kill Tilt (correctIndex entre 0 et 3).
6. Dans "explanation", explique avec bienveillance et précision (style Pe4nuts / Kill Tilt) pourquoi la bonne réponse l'emporte sur les autres en citant concrètement les cotes du pot (si pertinent), la position, la texture du board et le profil HUD de Vilain.
7. xpReward : entre 20 (niveau 1) et 35 (niveau 5).`;

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          limit: { type: Type.STRING },
          street: { type: Type.STRING },
          heroPosition: { type: Type.STRING },
          heroStackBb: { type: Type.NUMBER },
          heroCards: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          boardCards: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          potBb: { type: Type.NUMBER },
          villainPosition: { type: Type.STRING },
          villainStackBb: { type: Type.NUMBER },
          villainProfileName: { type: Type.STRING },
          villainHud: {
            type: Type.OBJECT,
            properties: {
              vpip: { type: Type.NUMBER },
              pfr: { type: Type.NUMBER },
              threeBet: { type: Type.NUMBER },
              af: { type: Type.NUMBER },
              hands: { type: Type.INTEGER },
            },
            required: ['vpip', 'pfr', 'threeBet', 'af', 'hands'],
          },
          actionHistory: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          question: { type: Type.STRING },
          options: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING },
                text: { type: Type.STRING },
              },
              required: ['label', 'text'],
            },
          },
          correctIndex: { type: Type.INTEGER },
          hint: { type: Type.STRING },
          explanation: { type: Type.STRING },
          keyConcept: { type: Type.STRING },
          xpReward: { type: Type.INTEGER },
        },
        required: [
          'title',
          'limit',
          'street',
          'heroPosition',
          'heroStackBb',
          'heroCards',
          'boardCards',
          'potBb',
          'villainPosition',
          'villainStackBb',
          'villainProfileName',
          'villainHud',
          'actionHistory',
          'question',
          'options',
          'correctIndex',
          'hint',
          'explanation',
          'keyConcept',
          'xpReward',
        ],
      };

      let scenario: GeneratedScenario | null = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        const response = await generateJsonWithRetry(ai, prompt, responseSchema);
        const text = (response.text ?? '').trim();
        const parsed = JSON.parse(text) as GeneratedScenario;
        if (validateScenario(parsed)) {
          scenario = parsed;
          break;
        }
      }

      if (!scenario) {
        return res.status(502).json({
          error:
            'Le Coach IA a généré un scénario incomplet. Cliquez à nouveau pour générer une nouvelle main.',
        });
      }

      return res.json({ scenario });
    } catch (err: unknown) {
      console.error('[/api/coach/scenario] error:', err);
      const { status, message } = formatGeminiError(
        err,
        'Erreur lors de la génération du scénario IA.'
      );
      return res.status(status).json({ error: message });
    }
  });

  app.post('/api/coach/review', requireFirebaseAuth, async (req, res) => {
    try {
      const {
        handHistory = '',
        limit = 'NL2',
        format = 'Cash 6-Max',
      } = req.body ?? {};

      const trimmed = String(handHistory).trim();
      if (trimmed.length < 15) {
        return res.status(400).json({
          error:
            'Décrivez davantage votre main (au moins votre position, vos cartes et l’action) pour une analyse pertinente.',
        });
      }
      if (trimmed.length > 8000) {
        return res.status(400).json({
          error:
            'Historique trop long (8000 caractères max). Collez une seule main à la fois.',
        });
      }

      const ai = getGeminiClient();

      const prompt = `Tu es un coach de poker professionnel spécialiste du Cash Game micro-limites (${limit}, ${format}) dans l'esprit pédagogique Kill Tilt / Pe4nuts.

Un joueur te soumet cette main jouée (format Winamax, PokerStars, ou description libre en français) :
"""
${trimmed}
"""

Analyse cette main avec rigueur, clarté et bienveillance :
1. Détecte le contexte (limite, position de Hero, cartes de Hero au format ["As", "Qd"] si identifiables sinon [], cartes du board au format ["Ac", "9d", "4c"] si identifiables sinon [], profil adverse détecté).
2. Analyse chaque rue effectivement jouée dans la main (Préflop, Flop, Turn, River — n'inclus que les rues qui ont lieu dans la main). Pour chaque rue, indique :
   - "status" : "good" (bien joué), "warning" (améliorable / sizing imparfait), ou "error" (erreur stratégique ou mathématique).
   - "actionSummary" : résumé court de ce qui s'est passé sur cette rue.
   - "analysis" : analyse approfondie (cotes du pot, sizings, ranges adverses, texture du board, profil HUD).
   - "optimalLine" : la ligne optimale concrète recommandée en ${limit}.
3. Liste les points forts ("strengths") et les erreurs à corriger ("mistakes").
4. Attribue une note honnête sur 10 ("score" entier de 1 à 10) et un verdict court ("verdictLabel").
5. Termine par UN conseil concret, mémorable et actionnable dès la prochaine session ("keyTakeaway").

IMPORTANT : Pour heroCards et boardCards dans detectedSpot, n'utilise QUE des codes valides de 2 caractères ([AKQJT98765432][shdc]) sans doublons ; si une couleur n'est pas précisée par le joueur (ex: "AQo"), choisis des couleurs cohérentes (ex: ["As", "Qd"]). Si les cartes ne sont pas mentionnées du tout, laisse un tableau vide [].`;

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.INTEGER },
          verdictLabel: { type: Type.STRING },
          summary: { type: Type.STRING },
          detectedSpot: {
            type: Type.OBJECT,
            properties: {
              limit: { type: Type.STRING },
              heroPosition: { type: Type.STRING },
              heroCards: { type: Type.ARRAY, items: { type: Type.STRING } },
              boardCards: { type: Type.ARRAY, items: { type: Type.STRING } },
              villainProfile: { type: Type.STRING },
            },
            required: [
              'limit',
              'heroPosition',
              'heroCards',
              'boardCards',
              'villainProfile',
            ],
          },
          streets: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                street: { type: Type.STRING },
                status: { type: Type.STRING },
                actionSummary: { type: Type.STRING },
                analysis: { type: Type.STRING },
                optimalLine: { type: Type.STRING },
              },
              required: [
                'street',
                'status',
                'actionSummary',
                'analysis',
                'optimalLine',
              ],
            },
          },
          strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
          mistakes: { type: Type.ARRAY, items: { type: Type.STRING } },
          keyTakeaway: { type: Type.STRING },
        },
        required: [
          'score',
          'verdictLabel',
          'summary',
          'detectedSpot',
          'streets',
          'strengths',
          'mistakes',
          'keyTakeaway',
        ],
      };

      const response = await generateJsonWithRetry(ai, prompt, responseSchema);

      const text = (response.text ?? '').trim();
      const review = JSON.parse(text);

      // Sanitize detected cards so UI never breaks on invalid card codes
      if (review?.detectedSpot) {
        const seen = new Set<string>();
        const cleanCards = (arr: unknown): string[] => {
          if (!Array.isArray(arr)) return [];
          const out: string[] = [];
          for (const c of arr) {
            if (typeof c === 'string' && VALID_CARD_RE.test(c) && !seen.has(c)) {
              seen.add(c);
              out.push(c);
            }
          }
          return out;
        };
        review.detectedSpot.heroCards = cleanCards(review.detectedSpot.heroCards).slice(0, 2);
        review.detectedSpot.boardCards = cleanCards(review.detectedSpot.boardCards).slice(0, 5);
      }

      review.score = Math.min(10, Math.max(1, Math.round(Number(review.score) || 5)));

      return res.json({ review });
    } catch (err: unknown) {
      console.error('[/api/coach/review] error:', err);
      const { status, message } = formatGeminiError(
        err,
        'Erreur lors de l’analyse de la main.'
      );
      return res.status(status).json({ error: message });
    }
  });

  const isProd = process.env.NODE_ENV === 'production';
  const distPath = path.resolve(__dirname, 'dist');

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Kill Tilt Poker Suite server running on http://0.0.0.0:${PORT}`);
  });
}

createServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
