import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Task } from '../types';
import { api } from '../api/client';
import {
  buildSnapshotMap,
  detectDueSoonTasks,
  detectTaskEvents,
  sortNotificationSounds,
  type TaskWatchSnapshot,
} from '../lib/taskNotificationDiff';
import { playNotificationSounds, unlockNotificationAudio } from '../lib/notificationSounds';
import type { NotificationSound } from '../lib/notificationSounds';
import { addNotifications, loadNotifications, type AppNotification } from '../lib/notificationStore';

const POLL_MS = 8_000;
const DUE_SOON_CHECK_MS = 30_000;
// The last seen task state is kept per user, so changes made while the app was
// closed still show up in the bell on the next visit (without a sound).
function snapshotKey(userId: string): string {
  return `taskmanager:taskSnapshot:${userId}`;
}

function loadSnapshot(userId: string): Map<string, TaskWatchSnapshot> | null {
  try {
    const raw = localStorage.getItem(snapshotKey(userId));
    return raw ? new Map(JSON.parse(raw) as [string, TaskWatchSnapshot][]) : null;
  } catch {
    return null;
  }
}

function saveSnapshot(userId: string, snapshot: Map<string, TaskWatchSnapshot>): void {
  try {
    localStorage.setItem(snapshotKey(userId), JSON.stringify([...snapshot]));
  } catch {
    // ignore quota errors
  }
}

type NewNotification = Omit<AppNotification, 'read'>;

/**
 * True in the one tab (per user, per browser) that holds the poll lock. The
 * lock passes to another tab when this one closes. Browsers without Web Locks
 * or BroadcastChannel make every tab a leader, as before.
 */
function usePollLeader(userId: string | undefined): boolean {
  const [leader, setLeader] = useState(false);
  useEffect(() => {
    if (!userId) return;
    if (!navigator.locks || typeof BroadcastChannel === 'undefined') {
      setLeader(true);
      return () => setLeader(false);
    }
    let release = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    const abort = new AbortController();
    navigator.locks
      .request(`taskmanager:poll:${userId}`, { signal: abort.signal }, () => {
        setLeader(true);
        return held;
      })
      .catch(() => {});
    return () => {
      abort.abort();
      release();
      setLeader(false);
    };
  }, [userId]);
  return leader;
}

function subscribeVisibility(cb: () => void): () => void {
  document.addEventListener('visibilitychange', cb);
  return () => document.removeEventListener('visibilitychange', cb);
}

function usePageVisible(): boolean {
  return useSyncExternalStore(subscribeVisibility, () => document.visibilityState === 'visible');
}

export function useTaskNotifications(userId: string | undefined): void {
  const snapshotRef = useRef<Map<string, TaskWatchSnapshot> | null>(null);
  const readyRef = useRef(false);
  const tasksRef = useRef<Task[]>([]);
  const qc = useQueryClient();

  useEffect(() => {
    const unlock = () => unlockNotificationAudio();
    // Browsers only allow audio after a user gesture; keep retrying until one lands.
    document.addEventListener('click', unlock);
    document.addEventListener('keydown', unlock);
    return () => {
      document.removeEventListener('click', unlock);
      document.removeEventListener('keydown', unlock);
    };
  }, []);

  // Poll a tiny version marker; only re-fetch the task list when it changes.
  // One tab per browser polls in the background and shares what it gets; the
  // tab on screen always polls too, so it never waits on a frozen background tab.
  const isLeader = usePollLeader(userId);
  const visible = usePageVisible();
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (!userId || typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(`taskmanager:version:${userId}`);
    channel.onmessage = (e: MessageEvent) => {
      if (typeof e.data === 'string') qc.setQueryData(['tasks-version'], e.data);
    };
    channelRef.current = channel;
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [userId, qc]);

  const { data: version } = useQuery({
    queryKey: ['tasks-version'],
    queryFn: async () => {
      const v = await api.getTasksVersion();
      channelRef.current?.postMessage(v);
      return v;
    },
    enabled: Boolean(userId),
    refetchInterval: isLeader || visible ? POLL_MS : false,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (userId) loadNotifications(userId);
  }, [userId]);

  const { data: tasks, isSuccess } = useQuery({
    queryKey: ['tasks', 'notifications'],
    queryFn: () => api.listTasks(),
    enabled: Boolean(userId),
  });

  const lastVersionRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!version) return;
    const previous = lastVersionRef.current;
    lastVersionRef.current = version;
    if (previous !== undefined && previous !== version) {
      void qc.invalidateQueries({ queryKey: ['tasks'] });
      void qc.invalidateQueries({ queryKey: ['task'] });
    }
  }, [version, qc]);

  tasksRef.current = tasks ?? [];

  useEffect(() => {
    if (!userId) return;
    const unsub = qc.getQueryCache().subscribe((event) => {
      if (
        event.type === 'updated' &&
        event.query.queryKey[0] === 'tasks' &&
        event.query.queryKey[1] !== 'notifications'
      ) {
        // Reuse an in-flight refetch instead of cancelling and starting another.
        void qc.invalidateQueries({ queryKey: ['tasks', 'notifications'] }, { cancelRefetch: false });
      }
    });
    return unsub;
  }, [qc, userId]);

  const notify = useCallback((added: NewNotification[], withSound: boolean) => {
    // Only events no tab has recorded yet are added, and only those ring.
    const fresh = addNotifications(added);
    if (!withSound) return;
    const ordered = sortNotificationSounds(fresh.map((n) => n.kind));
    if (ordered.length > 0) {
      void playNotificationSounds(ordered);
    }
  }, []);

  const checkDueSoon = useCallback(
    (taskList: Task[]) => {
      if (!userId) return;
      const due = detectDueSoonTasks(taskList, userId);
      if (due.length === 0) return;
      notify(
        due.map((t) => ({
          id: `due|${t.id}|${t.dueDate}`,
          taskId: t.id,
          taskTitle: t.title,
          text: 'Due in 5 minutes',
          kind: 'dueSoon' as NotificationSound,
          at: Date.now(),
        })),
        true
      );
    },
    [userId, notify]
  );

  useEffect(() => {
    if (!userId) return;
    const id = setInterval(() => checkDueSoon(tasksRef.current), DUE_SOON_CHECK_MS);
    return () => clearInterval(id);
  }, [userId, checkDueSoon]);

  useEffect(() => {
    if (!userId || !isSuccess || !tasks) return;

    checkDueSoon(tasks);

    const current = buildSnapshotMap(tasks);

    // First load: compare against what was seen on the last visit, silently.
    const firstLoad = !readyRef.current;
    const previous = firstLoad ? loadSnapshot(userId) : snapshotRef.current;
    readyRef.current = true;
    snapshotRef.current = current;
    saveSnapshot(userId, current);

    if (!previous) return;

    const now = Date.now();
    const added: NewNotification[] = [];
    for (const task of tasks) {
      for (const event of detectTaskEvents(previous.get(task.id), task, userId)) {
        added.push({
          // Same task version + same event = same id in every tab.
          id: `${task.id}|${task.updatedAt}|${event.text}`,
          taskId: task.id,
          taskTitle: task.title,
          text: event.text,
          kind: event.kind,
          at: now,
        });
      }
    }
    notify(added, !firstLoad);
  }, [tasks, isSuccess, userId, checkDueSoon, notify]);
}
