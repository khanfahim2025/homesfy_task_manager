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

/** Due date + time in 12-hour format. */
export function formatDueDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export interface DueDateTimeParts {
  date: string;
  hour12: string;
  minute: string;
  meridiem: 'AM' | 'PM';
}

export function parseDueDateTime(iso: string | null | undefined): DueDateTimeParts {
  const fallback: DueDateTimeParts = { date: '', hour12: '6', minute: '00', meridiem: 'PM' };
  if (!iso) return fallback;

  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return fallback;

  let hours = d.getHours();
  const meridiem: 'AM' | 'PM' = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;

  return {
    date: toDateInputValue(iso),
    hour12: String(hours),
    minute: String(d.getMinutes()).padStart(2, '0'),
    meridiem,
  };
}

function to24Hour(hour12: number, meridiem: 'AM' | 'PM'): number {
  if (meridiem === 'AM') return hour12 === 12 ? 0 : hour12;
  return hour12 === 12 ? 12 : hour12 + 12;
}

export function dueDateTimeToIso(parts: DueDateTimeParts): string | null {
  if (!parts.date) return null;
  const hour = to24Hour(parseInt(parts.hour12, 10) || 12, parts.meridiem);
  const minute = parseInt(parts.minute, 10) || 0;
  const local = new Date(
    `${parts.date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`
  );
  return local.toISOString();
}

/** Turn domain or URL text into a clickable https link. */
export function domainToUrl(domain: string): string {
  const trimmed = domain.trim();
  if (!trimmed) return '#';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
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

/** Parse date-only input to ISO at 12:00 PM local. */
export function dateInputToIso(value: string): string {
  return dueDateTimeToIso({ date: value, hour12: '12', minute: '00', meridiem: 'PM' })!;
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
