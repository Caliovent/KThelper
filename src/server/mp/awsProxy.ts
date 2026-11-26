import express from 'express';
import { AWS_KTP_ALLOWED_ORIGIN, AWS_KTP_BASE_URL } from '../../services/ktpApi';

const VALID_CHALLENGE_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;
const VALID_LEAGUES = new Set(['cash', 'mtt_icm', 'expresso', 'all_around']);

async function forwardToAws(
  req: express.Request,
  res: express.Response,
  upstreamPath: string,
  method: 'GET' | 'POST'
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Origin: AWS_KTP_ALLOWED_ORIGIN,
  };
  const xPlayerId = req.header('X-Player-Id');
  if (xPlayerId && xPlayerId.length <= 128) {
    headers['X-Player-Id'] = xPlayerId;
  }

  try {
    const upstreamRes = await fetch(`${AWS_KTP_BASE_URL}${upstreamPath}`, {
      method,
      headers,
      body: method === 'POST' ? JSON.stringify(req.body ?? {}) : undefined,
    });
    const text = await upstreamRes.text();
    res.status(upstreamRes.status);
    try {
      return res.json(JSON.parse(text));
    } catch {
      return res.send(text);
    }
  } catch (err) {
    return res.status(502).json({
      error: 'aws_upstream_unreachable',
      message: err instanceof Error ? err.message : 'Backend AWS inaccessible depuis le proxy local.',
    });
  }
}

/**
 * Proxy dev/test strict (anti-SSRF) vers les 4 endpoints AWS ktp-backend eu-north-1.
 */
export function createAwsKtpProxyRouter(): express.Router {
  const router = express.Router();
  router.use(express.json({ limit: '64kb' }));

  router.post('/challenges', (req, res) => forwardToAws(req, res, '/challenges', 'POST'));

  router.get('/challenges/:id', (req, res) => {
    const id = req.params.id;
    if (!VALID_CHALLENGE_ID_RE.test(id)) {
      return res.status(400).json({ error: 'invalid_challenge_id' });
    }
    return forwardToAws(req, res, `/challenges/${encodeURIComponent(id)}`, 'GET');
  });

  router.post('/challenges/:id/submit', (req, res) => {
    const id = req.params.id;
    if (!VALID_CHALLENGE_ID_RE.test(id)) {
      return res.status(400).json({ error: 'invalid_challenge_id' });
    }
    return forwardToAws(req, res, `/challenges/${encodeURIComponent(id)}/submit`, 'POST');
  });

  router.get('/leaderboard', (req, res) => {
    const rawLeague = String(req.query.league ?? 'all_around');
    if (!VALID_LEAGUES.has(rawLeague)) {
      return res.status(400).json({ error: 'invalid_league' });
    }
    const rawLimit = Number(req.query.limit ?? 50);
    const limit = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, Math.round(rawLimit))) : 50;
    return forwardToAws(
      req,
      res,
      `/leaderboard?league=${encodeURIComponent(rawLeague)}&limit=${limit}`,
      'GET'
    );
  });

  return router;
}
