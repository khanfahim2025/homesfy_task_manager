import { useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Task } from '../types';
import { api } from '../api/client';
import { areTaskNotificationsSuppressed } from '../lib/notificationSuppress';
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
const DUE_SOON_STORAGE_KEY = 'taskmanager:dueSoonNotified';

function loadDueSoonNotified(): Set<string> {
  try {
    const raw = sessionStorage.getItem(DUE_SOON_STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveDueSoonNotified(keys: Set<string>): void {
  try {
    sessionStorage.setItem(DUE_SOON_STORAGE_KEY, JSON.stringify([...keys]));
  } catch {
    // ignore quota errors
  }
}

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

type NewNotification = Omit<AppNotification, 'id' | 'read'>;

export function useTaskNotifications(userId: string | undefined): void {
  const snapshotRef = useRef<Map<string, TaskWatchSnapshot> | null>(null);
  const readyRef = useRef(false);
  const dueSoonNotifiedRef = useRef<Set<string>>(loadDueSoonNotified());
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
  const { data: version } = useQuery({
    queryKey: ['tasks-version'],
    queryFn: api.getTasksVersion,
    enabled: Boolean(userId),
    refetchInterval: POLL_MS,
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
    addNotifications(added);
    if (!withSound) return;
    const ordered = sortNotificationSounds(added.map((n) => n.kind));
    if (ordered.length > 0) {
      void playNotificationSounds(ordered);
    }
  }, []);

  const checkDueSoon = useCallback(
    (taskList: Task[]) => {
      if (!userId || areTaskNotificationsSuppressed()) return;
      const due = detectDueSoonTasks(taskList, userId, dueSoonNotifiedRef.current);
      if (due.length === 0) return;
      saveDueSoonNotified(dueSoonNotifiedRef.current);
      notify(
        due.map((t) => ({
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

    if (!previous || areTaskNotificationsSuppressed()) return;

    const now = Date.now();
    const added: NewNotification[] = [];
    for (const task of tasks) {
      for (const event of detectTaskEvents(previous.get(task.id), task, userId)) {
        added.push({ taskId: task.id, taskTitle: task.title, text: event.text, kind: event.kind, at: now });
      }
    }
    notify(added, !firstLoad);
  }, [tasks, isSuccess, userId, checkDueSoon, notify]);
}
