import { useSyncExternalStore } from 'react';
import type { NotificationSound } from './notificationSounds';

export interface AppNotification {
  id: string;
  taskId: string;
  taskTitle: string;
  text: string;
  kind: NotificationSound;
  at: number;
  read: boolean;
}

const MAX_ITEMS = 50;
const EMPTY: AppNotification[] = [];

let storageKey: string | null = null;
let items: AppNotification[] = EMPTY;
const listeners = new Set<() => void>();

function emit(): void {
  try {
    if (storageKey) localStorage.setItem(storageKey, JSON.stringify(items));
  } catch {
    // storage full or blocked: keep the in-memory list
  }
  listeners.forEach((l) => l());
}

/** Switch the store to a user's saved notifications (kept per browser). */
export function loadNotifications(userId: string): void {
  const key = `taskmanager:notifications:${userId}`;
  if (key === storageKey) return;
  storageKey = key;
  try {
    const raw = localStorage.getItem(key);
    items = raw ? (JSON.parse(raw) as AppNotification[]) : EMPTY;
  } catch {
    items = EMPTY;
  }
  listeners.forEach((l) => l());
}

export function addNotifications(added: Omit<AppNotification, 'id' | 'read'>[]): void {
  if (added.length === 0) return;
  const fresh = added.map((n) => ({ ...n, id: crypto.randomUUID(), read: false }));
  items = [...fresh.reverse(), ...items].slice(0, MAX_ITEMS);
  emit();
}

export function markNotificationRead(id: string): void {
  items = items.map((n) => (n.id === id ? { ...n, read: true } : n));
  emit();
}

export function markAllNotificationsRead(): void {
  items = items.map((n) => (n.read ? n : { ...n, read: true }));
  emit();
}

export function clearNotifications(): void {
  items = EMPTY;
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useNotifications(): AppNotification[] {
  return useSyncExternalStore(subscribe, () => items);
}
