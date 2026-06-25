let suppressUntil = 0;

/** Skip notification sounds briefly after this client mutates a task. */
export function suppressTaskNotifications(ms = 4000): void {
  suppressUntil = Date.now() + ms;
}

export function areTaskNotificationsSuppressed(): boolean {
  return Date.now() < suppressUntil;
}
