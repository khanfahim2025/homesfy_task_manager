import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellIcon } from '@heroicons/react/24/outline';
import {
  clearNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  useNotifications,
  type AppNotification,
} from '../lib/notificationStore';
import { playNotificationSounds, unlockNotificationAudio } from '../lib/notificationSounds';

function timeAgo(at: number): string {
  const s = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

interface Group {
  key: string;
  items: AppNotification[];
}

/** Back-to-back notifications with the same task and text show as one row with a count. */
function groupNotifications(list: AppNotification[]): Group[] {
  const groups: Group[] = [];
  for (const n of list) {
    const key = `${n.taskId}|${n.text}`;
    const last = groups[groups.length - 1];
    if (last?.key === key) last.items.push(n);
    else groups.push({ key, items: [n] });
  }
  return groups;
}

export function NotificationBell() {
  const navigate = useNavigate();
  const notifications = useNotifications();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openGroup = (group: Group) => {
    group.items.forEach((n) => !n.read && markNotificationRead(n.id));
    setOpen(false);
    navigate(`/tasks/${group.items[0]!.taskId}`);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="header-icon-btn relative"
        title="Notifications"
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        onClick={() => {
          unlockNotificationAudio();
          setOpen((v) => !v);
        }}
      >
        <BellIcon className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-3 top-14 z-50 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 dark:border-white/10 dark:bg-[#111111]">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5 dark:border-white/10">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Notifications</span>
            <div className="flex items-center gap-3 text-xs font-medium">
              <button
                type="button"
                className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
                onClick={() => void playNotificationSounds(['content'])}
                title="Play the notification sound"
              >
                Test sound
              </button>
              {unread > 0 && (
                <button
                  type="button"
                  className="text-[#137fa8] hover:underline dark:text-[#2fc6f6]"
                  onClick={markAllNotificationsRead}
                >
                  Mark all read
                </button>
              )}
              {unread === 0 && notifications.length > 0 && (
                <button
                  type="button"
                  className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
                  onClick={clearNotifications}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              No notifications yet. You'll see new tasks and changes on your tasks here.
            </p>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto">
              {groupNotifications(notifications).map((group) => {
                const n = group.items[0]!;
                const unreadInGroup = group.items.some((item) => !item.read);
                return (
                  <li key={n.id} className="border-b border-slate-100 last:border-b-0 dark:border-white/5">
                    <button
                      type="button"
                      onClick={() => openGroup(group)}
                      className={`flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition hover:bg-slate-50 dark:hover:bg-white/5 ${
                        unreadInGroup ? 'bg-sky-50/60 dark:bg-white/[0.04]' : ''
                      }`}
                    >
                      <span
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${unreadInGroup ? 'bg-[#2fc6f6]' : 'bg-transparent'}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                          {n.taskTitle}
                        </span>
                        <span className="mt-0.5 flex items-baseline justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span className="min-w-0 break-words">
                            {n.text}
                            {group.items.length > 1 && (
                              <span className="ml-1 font-semibold text-slate-600 dark:text-slate-300">
                                ×{group.items.length}
                              </span>
                            )}
                          </span>
                          <span className="shrink-0 whitespace-nowrap text-[11px] text-slate-400 dark:text-slate-500">
                            {timeAgo(n.at)}
                          </span>
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
