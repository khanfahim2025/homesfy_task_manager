import type { TaskCategory, TaskPriority, TaskStatus } from '../types';

export const STATUS_LABELS: Record<TaskStatus, string> = {
  new: 'New',
  assigned: 'Assigned',
  accepted: 'Accepted',
  in_progress: 'In Progress',
  done: 'Done',
  closed: 'Closed',
};

export const STATUS_ORDER: TaskStatus[] = [
  'new',
  'assigned',
  'accepted',
  'in_progress',
  'done',
  'closed',
];

/** Kanban board columns (Accepted / In Progress replaced by Due). */
export type KanbanColumnId = 'new' | 'assigned' | 'due' | 'done' | 'closed';

export const KANBAN_COLUMN_ORDER: KanbanColumnId[] = [
  'new',
  'assigned',
  'due',
  'done',
  'closed',
];

export const KANBAN_COLUMN_LABELS: Record<KanbanColumnId, string> = {
  new: 'New',
  assigned: 'Assigned',
  due: 'Due',
  done: 'Done',
  closed: 'Closed',
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

export const CATEGORY_LABELS: Record<TaskCategory, string> = {
  website_development: 'Website Development',
  creative: 'Creative',
  content_creation: 'Content Creation',
};

export function isWebsiteCategory(category: TaskCategory): boolean {
  return category === 'website_development';
}

export const STATUS_STYLES: Record<TaskStatus, string> = {
  new: 'bg-slate-100 text-slate-600',
  assigned: 'bg-violet-100 text-violet-700',
  accepted: 'bg-sky-100 text-sky-700',
  in_progress: 'bg-blue-100 text-blue-700',
  done: 'bg-emerald-100 text-emerald-700',
  closed: 'bg-slate-800 text-white ring-1 ring-slate-600',
};

/** Kanban column header accent colors (Bitrix-style) */
export const STATUS_COLUMN_COLORS: Record<TaskStatus, string> = {
  new: 'bg-slate-400',
  assigned: 'bg-violet-500',
  accepted: 'bg-sky-500',
  in_progress: 'bg-blue-500',
  done: 'bg-emerald-500',
  closed: 'bg-slate-500',
};

export const KANBAN_COLUMN_COLORS: Record<KanbanColumnId, string> = {
  new: 'bg-slate-400',
  assigned: 'bg-violet-500',
  due: 'bg-amber-500',
  done: 'bg-emerald-500',
  closed: 'bg-slate-500',
};

const AVATAR_COLORS = [
  'bg-violet-500',
  'bg-blue-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-indigo-500',
];

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export const PRIORITY_STYLES: Record<TaskPriority, string> = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-red-100 text-red-700',
};

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** YYYY-MM-DD for `<input type="date">` */
export function toDateInputValue(value: string | null | undefined): string {
  if (!value) return '';
  return value.slice(0, 10);
}

/** Parse date input value to ISO string (midday local time avoids timezone shift). */
export function dateInputToIso(value: string): string {
  return new Date(`${value}T12:00:00`).toISOString();
}

export function isOverdue(task: { dueDate: string | null; status: TaskStatus }): boolean {
  if (!task.dueDate || task.status === 'done' || task.status === 'closed') return false;
  return new Date(task.dueDate).getTime() < Date.now();
}

/** Open tasks due today or already past due — shown in the Due kanban column. */
export function isDueTask(task: { dueDate: string | null; status: TaskStatus }): boolean {
  if (!task.dueDate || task.status === 'done' || task.status === 'closed') return false;
  const due = new Date(task.dueDate);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  return due.getTime() <= endOfToday.getTime();
}

export function getKanbanColumn(task: { dueDate: string | null; status: TaskStatus }): KanbanColumnId {
  if (task.status === 'done') return 'done';
  if (task.status === 'closed') return 'closed';
  if (isDueTask(task)) return 'due';
  if (task.status === 'new') return 'new';
  return 'assigned';
}
