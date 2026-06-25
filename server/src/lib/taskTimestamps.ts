import { TaskStatus } from '@prisma/client';

export function timestampsForStatusChange(
  from: TaskStatus,
  to: TaskStatus,
  existing: { completedAt: Date | null; closedAt: Date | null }
): { completedAt?: Date | null; closedAt?: Date | null } {
  const patch: { completedAt?: Date | null; closedAt?: Date | null } = {};

  if (to === 'done') {
    patch.completedAt = new Date();
  } else if (from === 'done' && to !== 'closed') {
    patch.completedAt = null;
  }

  if (to === 'closed') {
    patch.closedAt = new Date();
    if (!existing.completedAt) patch.completedAt = new Date();
  } else if (from === 'closed') {
    patch.closedAt = null;
    if (to !== 'done') patch.completedAt = null;
  }

  return patch;
}
