import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { normalizeDomain } from '../lib/domain.js';
import { createProjectSchema, updateProjectSchema } from '../validators/project.js';

export const projectsRouter = Router();

projectsRouter.use(requireAuth);

projectsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { tasks: true } },
        creator: { select: { id: true, name: true } },
      },
    });
    res.json({ projects });
  })
);

projectsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = createProjectSchema.parse(req.body);
    const project = await prisma.project.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        primaryDomain: input.primaryDomain ? normalizeDomain(input.primaryDomain) : null,
        projectCode: input.projectCode || null,
        creator: { connect: { id: req.user!.id } },
      },
    });
    res.status(201).json({ project });
  })
);

projectsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const project = await prisma.project.findUniqueOrThrow({
      where: { id: req.params.id },
      include: {
        _count: { select: { tasks: true } },
        creator: { select: { id: true, name: true } },
      },
    });
    res.json({ project });
  })
);

projectsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const input = updateProjectSchema.parse(req.body);
    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description || null;
    if (input.primaryDomain !== undefined) {
      data.primaryDomain = input.primaryDomain ? normalizeDomain(input.primaryDomain) : null;
    }
    if (input.projectCode !== undefined) data.projectCode = input.projectCode || null;

    const project = await prisma.project.update({ where: { id: req.params.id }, data });
    res.json({ project });
  })
);

projectsRouter.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    await prisma.project.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  })
);
