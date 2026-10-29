import type { NotificationSound } from './notificationSounds';
import type { Task, TaskStatus } from '../types';
import { STATUS_LABELS, formatDueDateTime } from './format';
import { mentionsUser } from './mentions';

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

export interface TaskEvent {
  kind: NotificationSound;
  text: string;
}

function hasContentChange(prev: TaskWatchSnapshot, next: TaskWatchSnapshot): boolean {
  return (
    next.title !== prev.title ||
    next.description !== prev.description ||
    next.contentText !== prev.contentText ||
    next.contentUrls !== prev.contentUrls ||
    next.priority !== prev.priority
  );
}

/** Tasks you're on that are due within 5 minutes (the store skips ones already alerted). */
export function detectDueSoonTasks(tasks: Task[], userId: string): Task[] {
  return tasks.filter((task) => isUserInvolvedInTask(task, userId) && isTaskDueSoon(task));
}

const SOUND_PRIORITY: Record<NotificationSound, number> = {
  created: 0,
  assigned: 1,
  dueSoon: 2,
  done: 3,
  closed: 4,
  content: 5,
};

/** What changed on a task since the last snapshot, for a user involved in it. */
/**
 * What changed on a task since the last snapshot, for a user involved in it.
 * Changes the user made themselves (on any device) are never reported.
 */
export function detectTaskEvents(
  prev: TaskWatchSnapshot | undefined,
  task: Task,
  userId: string
): TaskEvent[] {
  if (!isUserInvolvedInTask(task, userId)) return [];

  const last = task.lastComment;
  const commentByOther = Boolean(last && last.authorId !== userId);
  const tagged = Boolean(last && commentByOther && mentionsUser(last.body, userId));

  // A task new to this user: created with them on it, or they were tagged into it.
  if (!prev) {
    if (tagged) return [{ kind: 'assigned', text: `${last!.author.name} mentioned you` }];
    if (task.creatorId === userId) return [];
    const creator = task.creator?.name ?? 'Someone';
    const assigned = taskWatchSnapshot(task).assigneeIds.includes(userId);
    return [
      {
        kind: 'created',
        text: assigned ? `${creator} assigned you a new task` : `${creator} added you to a new task`,
      },
    ];
  }

  const next = taskWatchSnapshot(task);
  const events: TaskEvent[] = [];
  const newComment = next.commentCount > prev.commentCount;
  // updatedBy is whoever made the latest change; if that's this user, stay quiet.
  const byOther = task.updatedById !== userId;
  const actor = task.updatedBy?.name ?? 'Someone';

  if (newComment && tagged) {
    events.push({ kind: 'assigned', text: `${last!.author.name} mentioned you` });
  } else if (byOther && wasNewlyConnected(prev, next, userId)) {
    events.push({ kind: 'assigned', text: `${actor} added you to this task` });
  }
  if (byOther && prev.status !== next.status) {
    if (next.status === 'closed') {
      events.push({ kind: 'closed', text: `${actor} closed this task` });
    } else if (next.status === 'done') {
      events.push({ kind: 'done', text: `${actor} marked this task Done` });
    } else {
      events.push({ kind: 'content', text: `${actor} changed status to ${STATUS_LABELS[next.status]}` });
    }
  }
  if (newComment && commentByOther && !tagged) {
    events.push({ kind: 'content', text: `New comment from ${last!.author.name}` });
  }
  if (byOther && next.dueDate !== prev.dueDate) {
    events.push({
      kind: 'content',
      text: next.dueDate
        ? `${actor} changed the deadline to ${formatDueDateTime(next.dueDate)}`
        : `${actor} removed the deadline`,
    });
  }
  if (byOther && next.attachmentCount > prev.attachmentCount) {
    events.push({ kind: 'content', text: `${actor} added an attachment` });
  }
  if (byOther && hasContentChange(prev, next)) {
    events.push({ kind: 'content', text: `${actor} updated the task details` });
  }
  return events;
}

export function sortNotificationSounds(sounds: NotificationSound[]): NotificationSound[] {
  return [...new Set(sounds)].sort((a, b) => SOUND_PRIORITY[a] - SOUND_PRIORITY[b]);
}

export function buildSnapshotMap(tasks: Task[]): Map<string, TaskWatchSnapshot> {
  return new Map(tasks.map((t) => [t.id, taskWatchSnapshot(t)]));
}
