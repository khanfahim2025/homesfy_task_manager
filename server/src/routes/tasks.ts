import { Hono } from 'hono';
import type { Prisma, User } from '../generated/prisma/client';
import { parseLocationEmbed } from '../lib/locationEmbed';
import { timestampsForStatusChange } from '../lib/taskTimestamps';
import {
  assertTaskAccess,
  assertTaskDeleteAccess,
  canManageTeam,
  memberTaskVisibilityWhere,
} from '../lib/taskAccess';
import {
  buildMemberCreateData,
  buildMemberUpdateData,
  notifyAssignees,
  resolveAssigneeIds,
  resolveProjectId,
  serializeTask,
  taskInclude,
} from '../services/taskService';
import { awardTaskCompletionPoints, getLeaderboard } from '../services/scoreService';
import { createTaskSchema, statusSchema, taskQuerySchema, updateTaskSchema } from '../validators/task';
import { commentsRouter } from './comments';
import { taskAttachmentsRouter } from './attachments';
import type { AuthedEnv } from '../types';

export const tasksRouter = new Hono<AuthedEnv>();

type TaskQuery = ReturnType<typeof taskQuerySchema.parse>;

function visibleWhere(user: User): Prisma.TaskWhereInput {
  return user.role === 'admin' ? {} : memberTaskVisibilityWhere(user);
}

function buildTaskListWhere(user: User, query: TaskQuery): Prisma.TaskWhereInput {
  const filters: Prisma.TaskWhereInput[] = [visibleWhere(user)];
  if (query.team) filters.push({ team: query.team });
  if (query.status) filters.push({ status: query.status });
  if (query.priority) filters.push({ priority: query.priority });
  if (query.category) filters.push({ category: query.category });
  if (query.projectId) filters.push({ projectId: query.projectId });
  if (query.assigneeId) filters.push({ assigneeId: query.assigneeId });
  if (query.q) {
    // SQLite LIKE is case-insensitive for ASCII, so no `mode` is needed.
    filters.push({
      OR: [
        { title: { contains: query.q } },
        { projectId: { contains: query.q } },
        { project: { is: { OR: [{ name: { contains: query.q } }, { projectCode: { contains: query.q } }] } } },
      ],
    });
  }
  return { AND: filters };
}

/** Text fields that are copied as-is (empty → null). */
const TEXT_FIELDS = [
  'description',
  'domainName',
  'templateUrl',
  'docFileLink',
  'gtmHead',
  'gtmBody',
  'contentText',
  'contentUrls',
] as const;

tasksRouter.get('/points/leaderboard', async (c) => {
  const { team } = taskQuerySchema.pick({ team: true }).parse(c.req.query());
  return c.json({ leaderboard: await getLeaderboard(c.var.db, c.var.user, team) });
});

/** Cheap change marker the client polls instead of re-fetching every task. */
tasksRouter.get('/version', async (c) => {
  const agg = await c.var.db.task.aggregate({
    where: visibleWhere(c.var.user),
    _count: { _all: true },
    _max: { updatedAt: true },
  });
  return c.json({ version: `${agg._count._all}:${agg._max.updatedAt?.getTime() ?? 0}` });
});

tasksRouter.get('/', async (c) => {
  const query = taskQuerySchema.parse(c.req.query());
  const tasks = await c.var.db.task.findMany({
    where: buildTaskListWhere(c.var.user, query),
    include: {
      ...taskInclude,
      // Latest comment only, so the bell can say who commented or tagged you.
      comments: {
        take: 1,
        orderBy: { createdAt: 'desc' },
        select: { body: true, authorId: true, author: { select: { name: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  return c.json({
    tasks: tasks.map(({ comments, ...task }) => ({
      ...serializeTask(task),
      lastComment: comments[0] ?? null,
    })),
  });
});

tasksRouter.post('/', async (c) => {
  const { db, user } = c.var;
  const input = createTaskSchema.parse(await c.req.json());
  const category = input.category ?? 'general';
  const projectId = await resolveProjectId(
    db,
    user.id,
    input.projectId,
    input.domainName,
    category !== 'website_development'
  );

  const data: Prisma.TaskCreateInput = {
    title: input.title,
    status: input.status ?? 'new',
    priority: input.priority ?? 'medium',
    category,
    team: user.role === 'admin' ? (input.team ?? user.team) : user.team,
    effortPoints: input.effortPoints ?? 5,
    dueDate: input.dueDate ? new Date(input.dueDate) : null,
    project: { connect: { id: projectId } },
    creator: { connect: { id: user.id } },
    locationIframe: parseLocationEmbed(input.locationIframe),
    ...buildMemberCreateData(input),
  };
  for (const field of TEXT_FIELDS) data[field] = input[field] ?? null;

  const task = await db.task.create({ data, include: taskInclude });
  if (task.status === 'done' || task.status === 'closed') {
    await awardTaskCompletionPoints(db, task.id);
  }
  c.executionCtx.waitUntil(notifyAssignees(db, c.env, task, resolveAssigneeIds(input) ?? [], user));
  return c.json({ task: serializeTask(task) }, 201);
});

/** Every /:id route (including /:id itself) requires access to that task. */
tasksRouter.use('/:id/*', async (c, next) => {
  await assertTaskAccess(c.var.db, c.var.user, c.req.param('id')!);
  await next();
});
tasksRouter.route('/:id/comments', commentsRouter);
tasksRouter.route('/:id/attachments', taskAttachmentsRouter);

tasksRouter.get('/:id', async (c) => {
  const task = await c.var.db.task.findUniqueOrThrow({
    where: { id: c.req.param('id') },
    include: {
      ...taskInclude,
      comments: {
        include: { author: { select: { id: true, name: true, email: true, avatarUrl: true } } },
        orderBy: { createdAt: 'asc' },
      },
      attachments: {
        include: { uploadedBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  return c.json({ task: serializeTask(task) });
});

tasksRouter.patch('/:id', async (c) => {
  const { db, user } = c.var;
  const id = c.req.param('id');
  const input = updateTaskSchema.parse(await c.req.json());
  const existing = await db.task.findUniqueOrThrow({
    where: { id },
    include: { assignees: { select: { user_id: true } } },
  });

  const data: Prisma.TaskUpdateInput = {
    ...buildMemberUpdateData(input),
    updatedBy: { connect: { id: user.id } },
  };
  if (input.title !== undefined) data.title = input.title;
  if (input.priority !== undefined) data.priority = input.priority;
  if (input.category !== undefined) data.category = input.category;
  if (input.team !== undefined && user.role === 'admin') data.team = input.team;
  if (input.effortPoints !== undefined && canManageTeam(user, existing.team)) {
    data.effortPoints = input.effortPoints;
  }
  if (input.dueDate !== undefined) data.dueDate = input.dueDate ? new Date(input.dueDate) : null;
  if (input.locationIframe !== undefined) data.locationIframe = parseLocationEmbed(input.locationIframe);
  for (const field of TEXT_FIELDS) {
    if (field in input) data[field] = input[field] ?? null;
  }
  if (input.projectId) {
    const projectId = await resolveProjectId(db, user.id, input.projectId, input.domainName);
    data.project = { connect: { id: projectId } };
  }
  if (input.status !== undefined && input.status !== existing.status) {
    data.status = input.status;
    Object.assign(data, timestampsForStatusChange(existing.status, input.status, existing));
  }

  const task = await db.task.update({ where: { id }, data, include: taskInclude });
  if (task.status === 'done' || task.status === 'closed') {
    await awardTaskCompletionPoints(db, task.id);
  }

  const before = new Set(existing.assignees.map((a) => a.user_id));
  const added = (resolveAssigneeIds(input) ?? []).filter((uid) => !before.has(uid));
  c.executionCtx.waitUntil(notifyAssignees(db, c.env, task, added, user));
  return c.json({ task: serializeTask(task) });
});

tasksRouter.patch('/:id/status', async (c) => {
  const { db, user } = c.var;
  const id = c.req.param('id');
  const { status } = statusSchema.parse(await c.req.json());
  const existing = await db.task.findUniqueOrThrow({ where: { id } });
  const task = await db.task.update({
    where: { id },
    data: {
      status,
      ...timestampsForStatusChange(existing.status, status, existing),
      updatedById: user.id,
    },
    include: taskInclude,
  });
  if (task.status === 'done' || task.status === 'closed') {
    await awardTaskCompletionPoints(db, task.id);
  }
  return c.json({ task: serializeTask(task) });
});

tasksRouter.delete('/:id', async (c) => {
  await assertTaskDeleteAccess(c.var.db, c.var.user, c.req.param('id'));
  await c.var.db.task.delete({ where: { id: c.req.param('id') } });
  return c.json({ ok: true });
});
