import type { Prisma, User } from '@prisma/client';
import { prisma } from './prisma.js';
import { AppError } from './errors.js';

export function memberTaskVisibilityWhere(userId: string): Prisma.TaskWhereInput {
  return {
    OR: [
      { creatorId: userId },
      { assigneeId: userId },
      { assignees: { some: { user_id: userId } } },
      { observers: { some: { user_id: userId } } },
      { participants: { some: { user_id: userId } } },
    ],
  };
}

export function canAccessTask(user: User, task: { creatorId: string }): boolean {
  if (user.role === 'admin') return true;
  return task.creatorId === user.id;
}

export async function assertTaskAccess(user: User, taskId: string): Promise<void> {
  if (user.role === 'admin') return;

  const task = await prisma.task.findFirst({
    where: { id: taskId, ...memberTaskVisibilityWhere(user.id) },
    select: { id: true },
  });

  if (!task) {
    throw new AppError(403, 'You do not have access to this task', 'FORBIDDEN');
  }
}

export async function assertTaskDeleteAccess(
  user: User,
  taskId: string
): Promise<{ creatorId: string }> {
  const task = await prisma.task.findUniqueOrThrow({
    where: { id: taskId },
    select: { creatorId: true },
  });

  if (user.role !== 'admin' && task.creatorId !== user.id) {
    throw new AppError(403, 'You cannot delete this task', 'FORBIDDEN');
  }

  return task;
}
