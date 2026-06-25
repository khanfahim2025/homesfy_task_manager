import type { TaskPriority, TaskStatus } from '../types';
import {
  PRIORITY_LABELS,
  PRIORITY_STYLES,
  STATUS_LABELS,
  STATUS_STYLES,
} from '../lib/format';

export function StatusBadge({ status }: { status: TaskStatus }) {
  return <span className={`badge ${STATUS_STYLES[status]}`}>{STATUS_LABELS[status]}</span>;
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return <span className={`badge ${PRIORITY_STYLES[priority]}`}>{PRIORITY_LABELS[priority]}</span>;
}
