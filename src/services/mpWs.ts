import type { League, SpotPublic } from '../domain/types';
import { AI_STUDIO_ORIGIN, MP_HETZNER_ORIGIN } from './mpApi';

export type WsServerMsg =
  | { t: 'matched'; matchId: string; runId: string; opponent: { pseudo: string; mmr: number } }
  | { t: 'start'; startsAt: string; spotCount: number }
  | { t: 'spot'; i: number; spot: SpotPublic; deadline: string; serverNow: string }
  | { t: 'locked'; i: number }
  | { t: 'opponent_progress'; done: number }
  | { t: 'settled'; matchId: string; receipt: string }
  | { t: 'error'; code: string; retryable: boolean }
  | { t: 'pong'; at: number; serverNow: string };

export function resolveMpWsUrl(): string {
  if (typeof window !== 'undefined' && typeof window.location !== 'undefined') {
    if (window.location.origin === AI_STUDIO_ORIGIN) {
      return `${MP_HETZNER_ORIGIN.replace(/^http/, 'ws')}/v1/ws`;
    }
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/v1/ws`;
  }
  return `${MP_HETZNER_ORIGIN.replace(/^http/, 'ws')}/v1/ws`;
}

export class MpLiveClient {
  private ws: WebSocket | null = null;
  private token: string;
  private resumeRunId?: string;
  private onMessage: (msg: WsServerMsg) => void;
  private onStatusChange: (status: 'connecting' | 'connected' | 'disconnected') => void;
  private intentionalClose = false;

  constructor(opts: {
    token: string;
    resumeRunId?: string;
    onMessage: (msg: WsServerMsg) => void;
    onStatusChange: (status: 'connecting' | 'connected' | 'disconnected') => void;
  }) {
    this.token = opts.token;
    this.resumeRunId = opts.resumeRunId;
    this.onMessage = opts.onMessage;
    this.onStatusChange = opts.onStatusChange;
  }

  public setResumeRunId(runId?: string) {
    this.resumeRunId = runId;
  }

  public connect(): void {
    this.intentionalClose = false;
    this.onStatusChange('connecting');
    const ws = new WebSocket(resolveMpWsUrl());
    this.ws = ws;

    ws.onopen = () => {
      this.onStatusChange('connected');
      this.send({
        t: 'hello',
        protocol: 1,
        token: this.token,
        ...(this.resumeRunId ? { resumeRunId: this.resumeRunId } : {}),
      });
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as WsServerMsg;
        if (msg.t === 'matched') {
          this.resumeRunId = msg.runId;
        } else if (msg.t === 'settled') {
          this.resumeRunId = undefined;
        }
        this.onMessage(msg);
      } catch {
        // Ignore malformed message cleanly
      }
    };

    ws.onclose = () => {
      this.onStatusChange('disconnected');
      if (!this.intentionalClose && this.resumeRunId) {
        setTimeout(() => {
          if (!this.intentionalClose) this.connect();
        }, 1200);
      }
    };
  }

  public send(payload: Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  public joinLiveQueue(league: League = 'maths_icm'): void {
    this.send({ t: 'queue_live', league });
  }

  public ping(): void {
    this.send({ t: 'ping', at: Date.now() });
  }

  public openSpot(runId: string, i: number, key: string): void {
    this.send({ t: 'open', runId, i, key });
  }

  public answerSpot(runId: string, i: number, action: string, clientMs: number, key: string): void {
    this.send({ t: 'answer', runId, i, action, clientMs, key });
  }

  public forfeitRun(runId: string, key: string): void {
    this.send({ t: 'forfeit', runId, key });
  }

  public close(): void {
    this.intentionalClose = true;
    this.ws?.close();
    this.ws = null;
  }
}
