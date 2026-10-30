import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const PING_MS = 25_000;
const PONG_TIMEOUT_MS = 10_000;
const MAX_RETRY_MS = 15_000;

/**
 * Keeps a WebSocket to /api/live open. The server pushes the task version the
 * moment anything changes, and it goes straight into the ['tasks-version']
 * query, so lists and notifications refresh within a moment.
 * Returns whether the socket is connected (callers fall back to polling if not).
 */
export function useLiveTaskVersion(userId: string | undefined): boolean {
  const qc = useQueryClient();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!userId || typeof WebSocket === 'undefined') return;

    let ws: WebSocket | null = null;
    let stopped = false;
    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let pingTimer: ReturnType<typeof setInterval> | undefined;
    let pongTimer: ReturnType<typeof setTimeout> | undefined;

    const clearTimers = () => {
      clearTimeout(retryTimer);
      clearInterval(pingTimer);
      clearTimeout(pongTimer);
    };

    // Drop the socket without waiting for a close handshake that may never come.
    const drop = () => {
      if (!ws) return;
      const old = ws;
      ws = null;
      old.onopen = old.onmessage = old.onclose = old.onerror = null;
      old.close();
      clearTimers();
      setConnected(false);
      if (!stopped) retryTimer = setTimeout(connect, Math.min(MAX_RETRY_MS, 500 * 2 ** attempt++));
    };

    function connect() {
      clearTimeout(retryTimer);
      const socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/live`);
      ws = socket;
      socket.onopen = () => {
        attempt = 0;
        setConnected(true);
        // Catch up on anything that changed while we were disconnected.
        void qc.invalidateQueries({ queryKey: ['tasks-version'] });
        pingTimer = setInterval(() => {
          socket.send('ping');
          clearTimeout(pongTimer);
          pongTimer = setTimeout(drop, PONG_TIMEOUT_MS);
        }, PING_MS);
      };
      socket.onmessage = (e: MessageEvent) => {
        if (e.data === 'pong') {
          clearTimeout(pongTimer);
          return;
        }
        if (typeof e.data === 'string') qc.setQueryData(['tasks-version'], e.data);
      };
      socket.onclose = drop;
      socket.onerror = drop;
    }

    // Reconnect at once when the network or the tab comes back.
    const reconnectNow = () => {
      if (ws || stopped || document.visibilityState !== 'visible') return;
      attempt = 0;
      connect();
    };
    window.addEventListener('online', reconnectNow);
    document.addEventListener('visibilitychange', reconnectNow);

    connect();
    return () => {
      stopped = true;
      window.removeEventListener('online', reconnectNow);
      document.removeEventListener('visibilitychange', reconnectNow);
      drop();
      clearTimers();
    };
  }, [userId, qc]);

  return connected;
}
