import type { NotificationSound } from './notificationSounds';
import type { Task, TaskStatus } from '../types';

export interface TaskWatchSnapshot {
  status: TaskStatus;
  assigneeIds: string[];
  observerIds: string[];
  participantIds: string[];
  memberIds: string[];
  commentCount: number;
  attachmentCount: number;
  title: string;
  description: string | null;
  contentText: string | null;
  contentUrls: string | null;
  priority: Task['priority'];
  dueDate: string | null;
  updatedAt: string;
}

function uniqueIds(ids: (string | undefined | null)[]): string[] {
  return [...new Set(ids.filter((id): id is string => Boolean(id)))];
}

export function getTaskMemberIds(task: Task): string[] {
  return uniqueIds([
    task.creatorId,
    ...(task.assignees?.map((u) => u.id) ?? []),
    task.assignee?.id,
    ...(task.observers?.map((u) => u.id) ?? []),
    ...(task.participants?.map((u) => u.id) ?? []),
  ]);
}

export function isUserInvolvedInTask(task: Task, userId: string): boolean {
  return getTaskMemberIds(task).includes(userId);
}

export function taskWatchSnapshot(task: Task): TaskWatchSnapshot {
  const assigneeIds = uniqueIds([
    ...(task.assignees?.map((u) => u.id) ?? []),
    task.assignee?.id,
  ]);
  const observerIds = task.observers?.map((u) => u.id) ?? [];
  const participantIds = task.participants?.map((u) => u.id) ?? [];

  return {
    status: task.status,
    assigneeIds,
    observerIds,
    participantIds,
    memberIds: getTaskMemberIds(task),
    commentCount: task._count?.comments ?? task.comments?.length ?? 0,
    attachmentCount: task._count?.attachments ?? task.attachments?.length ?? 0,
    title: task.title,
    description: task.description,
    contentText: task.contentText,
    contentUrls: task.contentUrls,
    priority: task.priority,
    dueDate: task.dueDate,
    updatedAt: task.updatedAt,
  };
}

function wasNewlyAssigned(prev: TaskWatchSnapshot, next: TaskWatchSnapshot, userId: string): boolean {
  return next.assigneeIds.includes(userId) && !prev.assigneeIds.includes(userId);
}

function wasNewlyConnected(prev: TaskWatchSnapshot, next: TaskWatchSnapshot, userId: string): boolean {
  if (wasNewlyAssigned(prev, next, userId)) return true;
  const wasObserver = prev.observerIds.includes(userId);
  const wasParticipant = prev.participantIds.includes(userId);
  const isObserver = next.observerIds.includes(userId);
  const isParticipant = next.participantIds.includes(userId);
  return (!wasObserver && isObserver) || (!wasParticipant && isParticipant);
}

export const DUE_SOON_MS = 5 * 60 * 1000;

/** Actual due datetime (supports date + time). */
export function getEffectiveDueTimeMs(dueDate: string): number {
  return new Date(dueDate).getTime();
}

export function isTaskDueSoon(task: Task, now = Date.now()): boolean {
  if (!task.dueDate || task.status === 'done' || task.status === 'closed') return false;
  const diff = getEffectiveDueTimeMs(task.dueDate) - now;
  return diff > 0 && diff <= DUE_SOON_MS;
}

export function dueSoonStorageKey(task: Task): string | null {
  if (!task.dueDate) return null;
  return `${task.id}:${task.dueDate}`;
}

function hasContentChange(prev: TaskWatchSnapshot, next: TaskWatchSnapshot): boolean {
  if (next.commentCount > prev.commentCount) return true;
  if (next.attachmentCount > prev.attachmentCount) return true;
  if (next.title !== prev.title) return true;
  if (next.description !== prev.description) return true;
  if (next.contentText !== prev.contentText) return true;
  if (next.contentUrls !== prev.contentUrls) return true;
  if (next.priority !== prev.priority) return true;
  return false;
}

export function detectDueSoonSounds(
  tasks: Task[],
  userId: string,
  alreadyNotified: Set<string>
): NotificationSound[] {
  const sounds: NotificationSound[] = [];
  for (const task of tasks) {
    if (!isUserInvolvedInTask(task, userId) || !isTaskDueSoon(task)) continue;
    const key = dueSoonStorageKey(task);
    if (!key || alreadyNotified.has(key)) continue;
    sounds.push('dueSoon');
    alreadyNotified.add(key);
  }
  return sounds;
}

const SOUND_PRIORITY: Record<NotificationSound, number> = {
  created: 0,
  assigned: 1,
  dueSoon: 2,
  done: 3,
  closed: 4,
  content: 5,
};

export function detectTaskNotificationSounds(
  prev: TaskWatchSnapshot,
  task: Task,
  userId: string
): NotificationSound[] {
  if (!isUserInvolvedInTask(task, userId)) return [];

  const next = taskWatchSnapshot(task);
  const sounds: NotificationSound[] = [];

  if (wasNewlyConnected(prev, next, userId)) {
    sounds.push('assigned');
  }
  if (prev.status !== 'done' && next.status === 'done') {
    sounds.push('done');
  }
  if (prev.status !== 'closed' && next.status === 'closed') {
    sounds.push('closed');
  }
  if (hasContentChange(prev, next)) {
    sounds.push('content');
  }

  return sounds;
}

export function detectNewTaskSound(task: Task, userId: string): NotificationSound | null {
  if (!isUserInvolvedInTask(task, userId)) return null;
  return 'created';
}

export function sortNotificationSounds(sounds: NotificationSound[]): NotificationSound[] {
  return [...new Set(sounds)].sort((a, b) => SOUND_PRIORITY[a] - SOUND_PRIORITY[b]);
}

export function buildSnapshotMap(tasks: Task[]): Map<string, TaskWatchSnapshot> {
  return new Map(tasks.map((t) => [t.id, taskWatchSnapshot(t)]));
}
