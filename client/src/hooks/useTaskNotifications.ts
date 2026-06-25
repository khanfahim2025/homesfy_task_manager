import { useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Task } from '../types';
import { api } from '../api/client';
import { areTaskNotificationsSuppressed } from '../lib/notificationSuppress';
import {
  buildSnapshotMap,
  detectDueSoonSounds,
  detectNewTaskSound,
  detectTaskNotificationSounds,
  sortNotificationSounds,
  type TaskWatchSnapshot,
} from '../lib/taskNotificationDiff';
import { playNotificationSounds, unlockNotificationAudio } from '../lib/notificationSounds';
import type { NotificationSound } from '../lib/notificationSounds';

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

export function useTaskNotifications(userId: string | undefined): void {
  const snapshotRef = useRef<Map<string, TaskWatchSnapshot> | null>(null);
  const readyRef = useRef(false);
  const dueSoonNotifiedRef = useRef<Set<string>>(loadDueSoonNotified());
  const tasksRef = useRef<Task[]>([]);
  const qc = useQueryClient();

  useEffect(() => {
    const unlock = () => unlockNotificationAudio();
    document.addEventListener('click', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });
    return () => {
      document.removeEventListener('click', unlock);
      document.removeEventListener('keydown', unlock);
    };
  }, []);

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', 'notifications'],
    queryFn: () => api.listTasks(),
    enabled: Boolean(userId),
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: true,
  });

  tasksRef.current = tasks;

  useEffect(() => {
    if (!userId) return;
    const unsub = qc.getQueryCache().subscribe((event) => {
      if (
        event.type === 'updated' &&
        event.query.queryKey[0] === 'tasks' &&
        event.query.queryKey[1] !== 'notifications'
      ) {
        void qc.invalidateQueries({ queryKey: ['tasks', 'notifications'] });
      }
    });
    return unsub;
  }, [qc, userId]);

  const playSounds = useCallback((sounds: NotificationSound[]) => {
    const ordered = sortNotificationSounds(sounds);
    if (ordered.length > 0) {
      void playNotificationSounds(ordered);
    }
  }, []);

  const checkDueSoon = useCallback(
    (taskList: Task[]) => {
      if (!userId || areTaskNotificationsSuppressed()) return;
      const before = dueSoonNotifiedRef.current.size;
      const sounds = detectDueSoonSounds(taskList, userId, dueSoonNotifiedRef.current);
      if (dueSoonNotifiedRef.current.size !== before) {
        saveDueSoonNotified(dueSoonNotifiedRef.current);
      }
      playSounds(sounds);
    },
    [userId, playSounds]
  );

  useEffect(() => {
    if (!userId) return;
    const id = setInterval(() => checkDueSoon(tasksRef.current), DUE_SOON_CHECK_MS);
    return () => clearInterval(id);
  }, [userId, checkDueSoon]);

  useEffect(() => {
    if (!userId) return;

    checkDueSoon(tasks);

    const current = buildSnapshotMap(tasks);

    if (!readyRef.current) {
      snapshotRef.current = current;
      readyRef.current = true;
      return;
    }

    if (areTaskNotificationsSuppressed()) {
      snapshotRef.current = current;
      return;
    }

    const previous = snapshotRef.current ?? current;
    const sounds: NotificationSound[] = [];

    for (const task of tasks) {
      const prev = previous.get(task.id);
      if (!prev) {
        const created = detectNewTaskSound(task, userId);
        if (created) sounds.push(created);
        continue;
      }
      sounds.push(...detectTaskNotificationSounds(prev, task, userId));
    }

    snapshotRef.current = current;
    playSounds(sounds);
  }, [tasks, userId, checkDueSoon, playSounds]);
}
