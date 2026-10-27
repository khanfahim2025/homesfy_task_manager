import type { Prisma, PrismaClient, User } from '../generated/prisma/client';
import { AppError } from './errors';

export function memberTaskVisibilityWhere(user: User): Prisma.TaskWhereInput {
  return {
    OR: [
      { team: user.team },
      { creatorId: user.id },
      { assigneeId: user.id },
      { assignees: { some: { user_id: user.id } } },
      { observers: { some: { user_id: user.id } } },
      { participants: { some: { user_id: user.id } } },
    ],
  };
}

export function canManageTeam(user: User, team: string): boolean {
  return user.role === 'admin' || (user.role === 'manager' && user.team === team);
}

export async function assertTaskAccess(db: PrismaClient, user: User, taskId: string): Promise<void> {
  const where: Prisma.TaskWhereInput =
    user.role === 'admin' ? { id: taskId } : { id: taskId, ...memberTaskVisibilityWhere(user) };
  const task = await db.task.findFirst({ where, select: { id: true } });
  if (!task) throw new AppError(404, 'Task not found', 'NOT_FOUND');
}

export async function assertTaskDeleteAccess(db: PrismaClient, user: User, taskId: string): Promise<void> {
  const task = await db.task.findUniqueOrThrow({
    where: { id: taskId },
    select: { creatorId: true, team: true },
  });
  if (!canManageTeam(user, task.team) && task.creatorId !== user.id) {
    throw new AppError(403, 'You cannot delete this task', 'FORBIDDEN');
  }
}
