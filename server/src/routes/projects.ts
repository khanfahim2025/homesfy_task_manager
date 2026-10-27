import { Hono } from 'hono';
import { normalizeDomain } from '../lib/domain';
import { requireAdmin } from '../middleware/auth';
import { createProjectSchema, updateProjectSchema } from '../validators/project';
import type { AuthedEnv } from '../types';

export const projectsRouter = new Hono<AuthedEnv>();

const include = {
  _count: { select: { tasks: true } },
  creator: { select: { id: true, name: true } },
} as const;

projectsRouter.get('/', async (c) => {
  const projects = await c.var.db.project.findMany({ orderBy: { createdAt: 'desc' }, include });
  return c.json({ projects });
});

projectsRouter.post('/', async (c) => {
  const input = createProjectSchema.parse(await c.req.json());
  const project = await c.var.db.project.create({
    data: {
      name: input.name,
      description: input.description || null,
      primaryDomain: input.primaryDomain ? normalizeDomain(input.primaryDomain) : null,
      projectCode: input.projectCode || null,
      createdById: c.var.user.id,
    },
  });
  return c.json({ project }, 201);
});

projectsRouter.get('/:id', async (c) => {
  const project = await c.var.db.project.findUniqueOrThrow({ where: { id: c.req.param('id') }, include });
  return c.json({ project });
});

projectsRouter.patch('/:id', async (c) => {
  const input = updateProjectSchema.parse(await c.req.json());
  const project = await c.var.db.project.update({
    where: { id: c.req.param('id') },
    data: {
      name: input.name,
      description: input.description === undefined ? undefined : input.description || null,
      primaryDomain:
        input.primaryDomain === undefined
          ? undefined
          : input.primaryDomain
            ? normalizeDomain(input.primaryDomain)
            : null,
      projectCode: input.projectCode === undefined ? undefined : input.projectCode || null,
    },
  });
  return c.json({ project });
});

projectsRouter.delete('/:id', requireAdmin, async (c) => {
  await c.var.db.project.delete({ where: { id: c.req.param('id') } });
  return c.json({ ok: true });
});
