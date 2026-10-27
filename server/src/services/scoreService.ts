import type { Prisma, PrismaClient, TaskPriority, Team, User } from '../generated/prisma/client';

const PRIORITY_BONUS: Record<TaskPriority, number> = { low: 0, medium: 2, high: 5 };

function calculateCompletionPoints(task: {
  effortPoints: number;
  priority: TaskPriority;
  dueDate: Date | null;
}): { points: number; reason: string } {
  let points = task.effortPoints + PRIORITY_BONUS[task.priority];
  const reason = [`Base ${task.effortPoints}`, `${task.priority} priority +${PRIORITY_BONUS[task.priority]}`];

  if (!task.dueDate) {
    reason.push('no due date bonus');
  } else if (Date.now() <= task.dueDate.getTime()) {
    points += 3;
    reason.push('on time +3');
  } else {
    points -= 2;
    reason.push('overdue -2');
  }

  return { points: Math.max(1, points), reason: reason.join(', ') };
}

/** Awards points once per (task, assignee); later status flips never re-award. */
export async function awardTaskCompletionPoints(db: PrismaClient, taskId: string): Promise<void> {
  const task = await db.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      effortPoints: true,
      priority: true,
      dueDate: true,
      assigneeId: true,
      assignees: { select: { user_id: true } },
      scoreEvents: { select: { user_id: true } },
    },
  });
  if (!task) return;

  const awarded = new Set(task.scoreEvents.map((e) => e.user_id));
  const userIds = new Set(task.assignees.map((row) => row.user_id));
  if (task.assigneeId) userIds.add(task.assigneeId);
  const pending = [...userIds].filter((id) => !awarded.has(id));
  if (pending.length === 0) return;

  const score = calculateCompletionPoints(task);
  await db.task_score_events.createMany({
    data: pending.map((user_id) => ({ task_id: task.id, user_id, ...score })),
  });
}

export async function getLeaderboard(db: PrismaClient, user: User, team?: Team) {
  const where: Prisma.task_score_eventsWhereInput = {};
  if (user.role === 'member') where.user_id = user.id;
  else if (user.role === 'manager') where.users = { team: user.team };
  else if (team) where.users = { team };

  const grouped = await db.task_score_events.groupBy({
    by: ['user_id'],
    where,
    _sum: { points: true },
    _count: { task_id: true },
    orderBy: { _sum: { points: 'desc' } },
    take: 10,
  });

  const users = await db.user.findMany({
    where: { id: { in: grouped.map((row) => row.user_id) } },
    select: { id: true, name: true, email: true, team: true, avatarUrl: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));

  return grouped.map((row, index) => ({
    rank: index + 1,
    user: byId.get(row.user_id),
    points: row._sum.points ?? 0,
    completedTasks: row._count.task_id,
  }));
}
