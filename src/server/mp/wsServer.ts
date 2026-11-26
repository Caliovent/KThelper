import crypto from 'node:crypto';
import type http from 'node:http';
import type { IncomingMessage } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import type { League } from '../../domain/types.ts';
import { LIVE_ARENA } from '../../engines/mp/config.ts';
import { ClientMsgSchema } from '../../engines/mp/schemas.ts';
import { MpHttpError, MpService } from './service.ts';

export interface LiveQueueEntry {
  playerId: string;
  pseudo: string;
  mmr: number;
  league: League;
  joinedAtMs: number;
  socket: WebSocket;
}

export interface ClientConnectionState {
  playerId: string;
  pseudo: string;
  runId: string | null;
  matchId: string | null;
}

export function mmrWindowForWaitMs(waitMs: number): number {
  for (const w of LIVE_ARENA.mmrWindows) {
    if (waitMs <= w.maxWaitMs) return w.delta;
  }
  return Infinity;
}

/** Sélectionne deux joueurs compatibles mutuellement (fenêtre MMR + plafond 3 matchs/30j), en priorisant l'attente la plus longue. */
export function matchLiveQueuePair(
  queue: readonly LiveQueueEntry[],
  nowMs: number,
  canPairFn: (a: string, b: string) => boolean
): [LiveQueueEntry, LiveQueueEntry] | null {
  if (queue.length < 2) return null;
  const sorted = [...queue].sort((a, b) => a.joinedAtMs - b.joinedAtMs);
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    const winA = mmrWindowForWaitMs(nowMs - a.joinedAtMs);
    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j];
      if (a.league !== b.league || a.playerId === b.playerId) continue;
      const winB = mmrWindowForWaitMs(nowMs - b.joinedAtMs);
      const diff = Math.abs(a.mmr - b.mmr);
      if (diff <= winA && diff <= winB && canPairFn(a.playerId, b.playerId)) {
        return [a, b];
      }
    }
  }
  return null;
}

function sendJson(ws: WebSocket, msg: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

export interface MpWsController {
  wss: WebSocketServer;
  close: () => Promise<void>;
}

export function attachMpWsServer(
  httpServer: http.Server,
  service: MpService,
  opts: { now?: () => number; graceTotalMs?: number } = {}
): MpWsController {
  const now = opts.now ?? (() => Date.now());
  const graceTotalMs = opts.graceTotalMs ?? LIVE_ARENA.reconnectGraceTotalMs;

  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: LIVE_ARENA.maxWsBytes,
  });

  const connState = new Map<WebSocket, ClientConnectionState>();
  const activeSocketByRun = new Map<string, WebSocket>();
  const disconnectTimers = new Map<string, { timer: ReturnType<typeof setTimeout>; disconnectedAtMs: number; usedMs: number }>();
  const liveQueue: LiveQueueEntry[] = [];

  const getOpponentSocket = (matchId: string, myPlayerId: string): WebSocket | null => {
    const oppRun = Array.from(service.store.runs.values()).find(
      (r) => r.matchId === matchId && r.playerId !== myPlayerId
    );
    if (!oppRun) return null;
    return activeSocketByRun.get(oppRun.id) ?? null;
  };

  const clearRunDisconnectTimer = (runId: string) => {
    const entry = disconnectTimers.get(runId);
    if (entry) {
      clearTimeout(entry.timer);
      const elapsed = Math.max(0, now() - entry.disconnectedAtMs);
      disconnectTimers.set(runId, {
        timer: setTimeout(() => {}, 0),
        disconnectedAtMs: 0,
        usedMs: entry.usedMs + elapsed,
      });
      clearTimeout(disconnectTimers.get(runId)!.timer);
    }
  };

  const scheduleDisconnectForfeit = (runId: string, playerId: string) => {
    const run = service.store.runs.get(runId);
    if (!run || run.engineRun.phase.s === 'done' || run.engineRun.phase.s === 'forfeit') return;

    const prev = disconnectTimers.get(runId);
    const usedMs = prev?.usedMs ?? 0;
    const remainingGrace = Math.max(250, graceTotalMs - usedMs);

    const timer = setTimeout(async () => {
      // Ne forfait que si le joueur n'est pas revenu
      if (activeSocketByRun.has(runId)) return;
      try {
        await service.forfeitRun(playerId, runId, crypto.randomUUID());
        const r = service.store.runs.get(runId);
        if (r) {
          const m = service.store.matches.get(r.matchId);
          if (m?.state === 'settled' && m.receipt) {
            const oppWs = getOpponentSocket(m.id, playerId);
            if (oppWs) sendJson(oppWs, { t: 'settled', matchId: m.id, receipt: JSON.stringify(m.receipt) });
          }
        }
      } catch {
        // Run déjà terminé ou annulé
      } finally {
        disconnectTimers.delete(runId);
      }
    }, remainingGrace);

    disconnectTimers.set(runId, { timer, disconnectedAtMs: now(), usedMs });
  };

  const tryMatchQueue = async () => {
    // Purge sockets fermées
    for (let i = liveQueue.length - 1; i >= 0; i--) {
      if (liveQueue[i].socket.readyState !== WebSocket.OPEN) {
        liveQueue.splice(i, 1);
      }
    }
    const pair = matchLiveQueuePair(liveQueue, now(), () => true);
    if (!pair) return;

    const [a, b] = pair;
    const idxA = liveQueue.indexOf(a);
    if (idxA >= 0) liveQueue.splice(idxA, 1);
    const idxB = liveQueue.indexOf(b);
    if (idxB >= 0) liveQueue.splice(idxB, 1);

    try {
      const created = await service.createLiveMatch(a.playerId, b.playerId, a.league);
      const stA = connState.get(a.socket);
      const stB = connState.get(b.socket);
      if (stA) {
        stA.matchId = created.matchId;
        stA.runId = created.runAId;
      }
      if (stB) {
        stB.matchId = created.matchId;
        stB.runId = created.runBId;
      }
      activeSocketByRun.set(created.runAId, a.socket);
      activeSocketByRun.set(created.runBId, b.socket);

      const startsAt = new Date(now()).toISOString();
      sendJson(a.socket, {
        t: 'matched',
        matchId: created.matchId,
        runId: created.runAId,
        opponent: { pseudo: b.pseudo, mmr: Math.round(b.mmr) },
      });
      sendJson(b.socket, {
        t: 'matched',
        matchId: created.matchId,
        runId: created.runBId,
        opponent: { pseudo: a.pseudo, mmr: Math.round(a.mmr) },
      });
      sendJson(a.socket, { t: 'start', startsAt, spotCount: created.spotCount });
      sendJson(b.socket, { t: 'start', startsAt, spotCount: created.spotCount });
    } catch (err) {
      const msg = err instanceof MpHttpError ? err.code : 'matchmaking_failed';
      sendJson(a.socket, { t: 'error', code: msg, retryable: true });
      sendJson(b.socket, { t: 'error', code: msg, retryable: true });
    }
  };

  httpServer.on('upgrade', (request: IncomingMessage, socket, head) => {
    const rawUrl = request.url ?? '';
    const pathname = rawUrl.split('?')[0];
    if (pathname !== '/v1/ws') {
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', (ws) => {
    ws.on('message', async (rawData) => {
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(rawData.toString());
      } catch {
        sendJson(ws, { t: 'error', code: 'invalid_json', retryable: false });
        return;
      }

      const checked = ClientMsgSchema.safeParse(parsedJson);
      if (!checked.success) {
        sendJson(ws, { t: 'error', code: 'validation_error', retryable: false });
        return;
      }
      const msg = checked.data;

      if (msg.t === 'ping') {
        sendJson(ws, { t: 'pong', at: msg.at, serverNow: new Date(now()).toISOString() });
        return;
      }

      if (msg.t === 'hello') {
        try {
          const player = service.authenticateBearer(`Bearer ${msg.token}`);
          const state: ClientConnectionState = {
            playerId: player.id,
            pseudo: player.pseudo,
            runId: null,
            matchId: null,
          };

          if (msg.resumeRunId) {
            const run = service.store.runs.get(msg.resumeRunId);
            if (!run || run.playerId !== player.id) {
              sendJson(ws, { t: 'error', code: 'forbidden', retryable: false });
              ws.close(4003, 'forbidden');
              return;
            }
            const existingWs = activeSocketByRun.get(run.id);
            if (existingWs && existingWs !== ws && existingWs.readyState === WebSocket.OPEN) {
              sendJson(ws, { t: 'error', code: 'duplicate_connection', retryable: false });
              ws.close(4009, 'duplicate_connection');
              return;
            }
            clearRunDisconnectTimer(run.id);
            activeSocketByRun.set(run.id, ws);
            state.runId = run.id;
            state.matchId = run.matchId;
            connState.set(ws, state);

            const match = service.store.matches.get(run.matchId);
            if (match?.state === 'settled' && match.receipt) {
              sendJson(ws, { t: 'settled', matchId: match.id, receipt: JSON.stringify(match.receipt) });
              return;
            }
            if (run.engineRun.phase.s === 'open') {
              const cachedOpen = run.openKeys[run.engineRun.phase.i]?.response as
                | { spotIndex: number; spot: unknown; deadline: string }
                | undefined;
              if (cachedOpen) {
                sendJson(ws, {
                  t: 'spot',
                  i: cachedOpen.spotIndex,
                  spot: cachedOpen.spot,
                  deadline: cachedOpen.deadline,
                  serverNow: new Date(now()).toISOString(),
                });
              }
            }
            const oppRun = Array.from(service.store.runs.values()).find(
              (r) => r.matchId === run.matchId && r.playerId !== player.id
            );
            if (oppRun) {
              sendJson(ws, { t: 'opponent_progress', done: oppRun.engineRun.locked.length });
            }
            return;
          }

          connState.set(ws, state);
          sendJson(ws, { t: 'pong', at: now(), serverNow: new Date(now()).toISOString() });
        } catch (err) {
          sendJson(ws, {
            t: 'error',
            code: err instanceof MpHttpError ? err.code : 'unauthorized',
            retryable: false,
          });
          ws.close(4001, 'unauthorized');
        }
        return;
      }

      const st = connState.get(ws);
      if (!st) {
        sendJson(ws, { t: 'error', code: 'hello_required', retryable: false });
        return;
      }

      if (msg.t === 'queue_live') {
        const me = service.getMe(st.playerId);
        const mmr = me.ratings[msg.league]?.r ?? 1500;
        const already = liveQueue.find((q) => q.playerId === st.playerId);
        if (!already) {
          liveQueue.push({
            playerId: st.playerId,
            pseudo: st.pseudo,
            mmr,
            league: msg.league,
            joinedAtMs: now(),
            socket: ws,
          });
        }
        await tryMatchQueue();
        return;
      }

      if (msg.t === 'ready') {
        const run = Array.from(service.store.runs.values()).find(
          (r) => r.matchId === msg.matchId && r.playerId === st.playerId
        );
        if (run) {
          const existingWs = activeSocketByRun.get(run.id);
          if (existingWs && existingWs !== ws && existingWs.readyState === WebSocket.OPEN) {
            sendJson(ws, { t: 'error', code: 'duplicate_connection', retryable: false });
            ws.close(4009, 'duplicate_connection');
            return;
          }
          st.matchId = msg.matchId;
          st.runId = run.id;
          activeSocketByRun.set(run.id, ws);
        }
        return;
      }

      if (msg.t === 'open') {
        try {
          activeSocketByRun.set(msg.runId, ws);
          st.runId = msg.runId;
          const opened = service.openSpot(st.playerId, msg.runId, msg.i, msg.key);
          sendJson(ws, {
            t: 'spot',
            i: opened.spotIndex,
            spot: opened.spot,
            deadline: opened.deadline,
            serverNow: opened.serverNow,
          });
        } catch (err) {
          sendJson(ws, {
            t: 'error',
            code: err instanceof MpHttpError ? err.code : 'open_failed',
            retryable: false,
          });
        }
        return;
      }

      if (msg.t === 'answer') {
        try {
          const res = await service.answerSpot(st.playerId, msg.runId, msg.i, {
            action: msg.action,
            clientMs: msg.clientMs,
            key: msg.key,
          });
          // Règle Bible p.30 : JAMAIS de PD/score dans `locked` ni `opponent_progress`
          sendJson(ws, { t: 'locked', i: res.spotIndex });

          const run = service.store.runs.get(msg.runId);
          if (run) {
            const oppWs = getOpponentSocket(run.matchId, st.playerId);
            if (oppWs) {
              sendJson(oppWs, { t: 'opponent_progress', done: run.engineRun.locked.length });
            }
            const match = service.store.matches.get(run.matchId);
            if (match?.state === 'settled' && match.receipt) {
              const payload = {
                t: 'settled',
                matchId: match.id,
                receipt: JSON.stringify(match.receipt),
              };
              sendJson(ws, payload);
              if (oppWs) sendJson(oppWs, payload);
            }
          }
        } catch (err) {
          sendJson(ws, {
            t: 'error',
            code: err instanceof MpHttpError ? err.code : 'answer_failed',
            retryable: false,
          });
        }
        return;
      }

      if (msg.t === 'forfeit') {
        try {
          const out = await service.forfeitRun(st.playerId, msg.runId, msg.key);
          const run = service.store.runs.get(msg.runId);
          if (run) {
            const match = service.store.matches.get(run.matchId);
            const oppWs = getOpponentSocket(run.matchId, st.playerId);
            if (match?.state === 'settled' && match.receipt) {
              const payload = {
                t: 'settled',
                matchId: match.id,
                receipt: JSON.stringify(match.receipt),
              };
              sendJson(ws, payload);
              if (oppWs) sendJson(oppWs, payload);
            } else if (out.cancelledNoMmr && oppWs) {
              sendJson(oppWs, { t: 'error', code: 'match_cancelled', retryable: false });
            }
          }
        } catch (err) {
          sendJson(ws, {
            t: 'error',
            code: err instanceof MpHttpError ? err.code : 'forfeit_failed',
            retryable: false,
          });
        }
      }
    });

    ws.on('close', () => {
      const idx = liveQueue.findIndex((q) => q.socket === ws);
      if (idx >= 0) liveQueue.splice(idx, 1);

      const st = connState.get(ws);
      connState.delete(ws);
      if (st?.runId && activeSocketByRun.get(st.runId) === ws) {
        activeSocketByRun.delete(st.runId);
        scheduleDisconnectForfeit(st.runId, st.playerId);
      }
    });
  });

  return {
    wss,
    async close() {
      for (const entry of disconnectTimers.values()) {
        clearTimeout(entry.timer);
      }
      disconnectTimers.clear();
      await new Promise<void>((resolve) => wss.close(() => resolve()));
    },
  };
}
