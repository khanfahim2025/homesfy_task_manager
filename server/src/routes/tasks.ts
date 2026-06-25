import { Router } from 'express';
import type { Prisma, User } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { parseLocationEmbed } from '../lib/locationEmbed.js';
import { timestampsForStatusChange } from '../lib/taskTimestamps.js';
import {
  createTaskSchema,
  updateTaskSchema,
  statusSchema,
  taskQuerySchema,
} from '../validators/task.js';
import {
  buildMemberCreateData,
  buildMemberUpdateData,
  resolveProjectId,
  serializeTask,
  taskInclude,
} from '../services/taskService.js';
import {
  assertTaskAccess,
  assertTaskDeleteAccess,
  memberTaskVisibilityWhere,
} from '../lib/taskAccess.js';
import { commentsRouter } from './comments.js';
import { taskAttachmentsRouter } from './attachments.js';

export const tasksRouter = Router();

tasksRouter.use(requireAuth);

function buildTaskListWhere(
  user: User,
  query: ReturnType<typeof taskQuerySchema.parse>
): Prisma.TaskWhereInput {
  const filters: Prisma.TaskWhereInput[] = [];

  if (user.role !== 'admin') {
    filters.push(memberTaskVisibilityWhere(user.id));
  }
  if (query.status) filters.push({ status: query.status });
  if (query.priority) filters.push({ priority: query.priority });
  if (query.category) filters.push({ category: query.category });
  if (query.projectId) filters.push({ projectId: query.projectId });
  if (query.assigneeId) filters.push({ assigneeId: query.assigneeId });
  if (query.q) {
    filters.push({
      OR: [
        { title: { contains: query.q, mode: 'insensitive' } },
        { projectId: { contains: query.q, mode: 'insensitive' } },
        {
          project: {
            is: {
              OR: [
                { id: { contains: query.q, mode: 'insensitive' } },
                { name: { contains: query.q, mode: 'insensitive' } },
                { projectCode: { contains: query.q, mode: 'insensitive' } },
              ],
            },
          },
        },
      ],
    });
  }

  return filters.length > 0 ? { AND: filters } : {};
}

tasksRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = taskQuerySchema.parse(req.query);
    const where = buildTaskListWhere(req.user!, query);

    const tasks = await prisma.task.findMany({
      where,
      include: taskInclude,
      orderBy: { createdAt: 'desc' },
    });
    res.json({ tasks: tasks.map(serializeTask) });
  })
);

tasksRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = createTaskSchema.parse(req.body);
    const category = input.category ?? 'website_development';
    const projectId = await resolveProjectId(req.user!.id, input.projectId, input.domainName, {
      allowGeneralFallback: category !== 'website_development',
    });
    const memberData = buildMemberCreateData(input);

    const task = await prisma.task.create({
      data: {
        title: input.title,
        description: input.description ?? null,
        status: input.status ?? 'new',
        priority: input.priority ?? 'medium',
        category,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        project: { connect: { id: projectId } },
        creator: { connect: { id: req.user!.id } },
        domainName: input.domainName ?? null,
        templateUrl: input.templateUrl ?? null,
        docFileLink: input.docFileLink ?? null,
        locationIframe: parseLocationEmbed(input.locationIframe),
        gtmHead: input.gtmHead ?? null,
        gtmBody: input.gtmBody ?? null,
        contentText: input.contentText ?? null,
        contentUrls: input.contentUrls ?? null,
        ...memberData,
      },
      include: taskInclude,
    });
    res.status(201).json({ task: serializeTask(task) });
  })
);

tasksRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    await assertTaskAccess(req.user!, req.params.id);

    const task = await prisma.task.findUniqueOrThrow({
      where: { id: req.params.id },
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
    res.json({ task: serializeTask(task) });
  })
);

tasksRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    await assertTaskAccess(req.user!, req.params.id);

    const input = updateTaskSchema.parse(req.body);
    const existing = await prisma.task.findUniqueOrThrow({ where: { id: req.params.id } });

    const data: Prisma.TaskUpdateInput = {
      ...buildMemberUpdateData(input),
    };
    if (input.title !== undefined) data.title = input.title;
    if (input.description !== undefined) data.description = input.description ?? null;
    if (input.priority !== undefined) data.priority = input.priority;
    if (input.category !== undefined) data.category = input.category;
    if (input.dueDate !== undefined) data.dueDate = input.dueDate ? new Date(input.dueDate) : null;
    if (input.templateUrl !== undefined) data.templateUrl = input.templateUrl ?? null;
    if (input.docFileLink !== undefined) data.docFileLink = input.docFileLink ?? null;
    if (input.locationIframe !== undefined) {
      data.locationIframe = parseLocationEmbed(input.locationIframe);
    }
    if (input.gtmHead !== undefined) data.gtmHead = input.gtmHead ?? null;
    if (input.gtmBody !== undefined) data.gtmBody = input.gtmBody ?? null;
    if (input.contentText !== undefined) data.contentText = input.contentText ?? null;
    if (input.contentUrls !== undefined) data.contentUrls = input.contentUrls ?? null;
    if (input.domainName !== undefined) data.domainName = input.domainName ?? null;

    if (input.projectId) {
      const projectId = await resolveProjectId(req.user!.id, input.projectId, input.domainName);
      data.project = { connect: { id: projectId } };
    }

    if (input.status !== undefined && input.status !== existing.status) {
      data.status = input.status;
      Object.assign(
        data,
        timestampsForStatusChange(existing.status, input.status, {
          completedAt: existing.completedAt,
          closedAt: existing.closedAt,
        })
      );
    }

    const task = await prisma.task.update({
      where: { id: req.params.id },
      data,
      include: taskInclude,
    });
    res.json({ task: serializeTask(task) });
  })
);

tasksRouter.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    await assertTaskAccess(req.user!, req.params.id);

    const { status } = statusSchema.parse(req.body);
    const existing = await prisma.task.findUniqueOrThrow({ where: { id: req.params.id } });
    const task = await prisma.task.update({
      where: { id: req.params.id },
      data: {
        status,
        ...timestampsForStatusChange(existing.status, status, {
          completedAt: existing.completedAt,
          closedAt: existing.closedAt,
        }),
      },
      include: taskInclude,
    });
    res.json({ task: serializeTask(task) });
  })
);

tasksRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await assertTaskDeleteAccess(req.user!, req.params.id);
    await prisma.task.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  })
);

tasksRouter.use('/:taskId/comments', commentsRouter);
tasksRouter.use('/:taskId/attachments', taskAttachmentsRouter);
