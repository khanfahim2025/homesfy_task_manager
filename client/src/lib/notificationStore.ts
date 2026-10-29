import { useSyncExternalStore } from 'react';
import type { NotificationSound } from './notificationSounds';

export interface AppNotification {
  /** Stable per event, so every open tab agrees on what is new. */
  id: string;
  taskId: string;
  taskTitle: string;
  text: string;
  kind: NotificationSound;
  at: number;
  read: boolean;
}

const MAX_ITEMS = 50;
const MAX_SEEN = 500;
const EMPTY: AppNotification[] = [];

let storageKey: string | null = null;
let items: AppNotification[] = EMPTY;
const listeners = new Set<() => void>();

const seenKey = () => `${storageKey}:seen`;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or blocked: keep the in-memory list
  }
}

function setItems(next: AppNotification[]): void {
  items = next;
  if (storageKey) writeJson(storageKey, items);
  listeners.forEach((l) => l());
}

/** Switch the store to a user's saved notifications (kept per browser). */
export function loadNotifications(userId: string): void {
  const key = `taskmanager:notifications:${userId}`;
  if (key === storageKey) return;
  storageKey = key;
  items = readJson(key, EMPTY);
  listeners.forEach((l) => l());
}

// Another tab changed the list (new items, marked read, cleared): mirror it.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (!storageKey || e.key !== storageKey) return;
    items = readJson(storageKey, EMPTY);
    listeners.forEach((l) => l());
  });
}

/**
 * Adds events not seen before in any tab and returns just those, so the caller
 * rings once per event even with several tabs open.
 */
export function addNotifications(added: Omit<AppNotification, 'read'>[]): AppNotification[] {
  if (added.length === 0 || !storageKey) return [];
  const seenList = readJson<string[]>(seenKey(), []);
  const seen = new Set(seenList);
  const fresh = added.filter((n) => !seen.has(n.id)).map((n) => ({ ...n, read: false }));
  if (fresh.length === 0) return [];

  writeJson(seenKey(), [...seenList, ...fresh.map((n) => n.id)].slice(-MAX_SEEN));
  // Re-read first: another tab may have added items since this one loaded.
  const current = readJson(storageKey, items);
  setItems([...[...fresh].reverse(), ...current].slice(0, MAX_ITEMS));
  return fresh;
}

export function markNotificationRead(id: string): void {
  setItems(items.map((n) => (n.id === id ? { ...n, read: true } : n)));
}

export function markAllNotificationsRead(): void {
  setItems(items.map((n) => (n.read ? n : { ...n, read: true })));
}

export function clearNotifications(): void {
  setItems(EMPTY);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useNotifications(): AppNotification[] {
  return useSyncExternalStore(subscribe, () => items);
}
