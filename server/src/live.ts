import { DurableObject } from 'cloudflare:workers';
import type { Bindings } from './types';

/** Current value of the task change counter (kept by triggers, migration 0003). */
export async function readTasksVersion(db: D1Database): Promise<string> {
  const row = await db
    .prepare(`SELECT "value" FROM "app_meta" WHERE "key" = 'tasks_version'`)
    .first<{ value: number }>();
  return String(row?.value ?? 0);
}

function liveHub(env: Bindings) {
  return env.LIVE.get(env.LIVE.idFromName('tasks'));
}

/** Opens a browser's live connection (the request is already authenticated). */
export function connectLive(env: Bindings, request: Request): Promise<Response> {
  return liveHub(env).fetch(request);
}

/** Tells every open browser the new task version so they refresh right away. */
export async function pushTasksVersion(env: Bindings): Promise<void> {
  await liveHub(env).broadcast(await readTasksVersion(env.DB));
}

/**
 * Holds every open browser's WebSocket and pushes the task version to them.
 * Uses hibernation: idle sockets cost nothing, and pings are answered by the
 * runtime without waking the object.
 */
export class LiveUpdates extends DurableObject<Bindings> {
  constructor(ctx: DurableObjectState, env: Bindings) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected a WebSocket', { status: 426 });
    }
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  broadcast(version: string): void {
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(version);
      } catch {
        // socket already closing; the browser reconnects on its own
      }
    }
  }

  webSocketClose(ws: WebSocket, code: number): void {
    try {
      ws.close(code === 1005 ? 1000 : code, 'closed');
    } catch {
      // already closed
    }
  }
}
