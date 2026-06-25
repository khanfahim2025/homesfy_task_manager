import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { AppError } from '../lib/errors.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { createUserSchema, updateUserSchema } from '../validators/user.js';
import { createAuthToken } from '../lib/authTokens.js';
import { env } from '../lib/env.js';

export const usersRouter = Router();

const select = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  avatarUrl: true,
  createdAt: true,
} as const;

function assertEmailDomain(email: string): void {
  if (env.allowedEmailDomain) {
    const domain = email.split('@')[1] ?? '';
    if (domain.toLowerCase() !== env.allowedEmailDomain.toLowerCase()) {
      throw new AppError(403, `Only @${env.allowedEmailDomain} accounts are allowed`, 'BAD_DOMAIN');
    }
  }
}

usersRouter.use(requireAuth);

const assignableSelect = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
} as const;

usersRouter.get(
  '/assignable',
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: assignableSelect,
      orderBy: { name: 'asc' },
    });
    res.json({ users });
  })
);

usersRouter.get(
  '/',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({ select, orderBy: { name: 'asc' } });
    res.json({ users });
  })
);

usersRouter.post(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { email, name, role } = createUserSchema.parse(req.body);
    assertEmailDomain(email);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError(409, 'An account with that email already exists', 'EMAIL_TAKEN');
    }

    const user = await prisma.user.create({
      data: { email, name, role: role ?? 'member', passwordHash: null },
      select,
    });

    const { url: inviteUrl } = await createAuthToken({
      userId: user.id,
      email: user.email,
      purpose: 'set_password',
      createdById: req.user!.id,
    });

    res.status(201).json({ user, inviteUrl });
  })
);

usersRouter.post(
  '/:id/invite-link',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.params.id },
      select: { id: true, email: true, isActive: true },
    });
    if (!user.isActive) {
      throw new AppError(403, 'Cannot invite deactivated user', 'INACTIVE');
    }

    const { url } = await createAuthToken({
      userId: user.id,
      email: user.email,
      purpose: 'set_password',
      createdById: req.user!.id,
    });

    res.json({ url });
  })
);

usersRouter.post(
  '/:id/login-link',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.params.id },
      select: { id: true, email: true, isActive: true, passwordHash: true },
    });
    if (!user.isActive) {
      throw new AppError(403, 'Cannot create login link for deactivated user', 'INACTIVE');
    }

    const { url } = await createAuthToken({
      userId: user.id,
      email: user.email,
      purpose: 'login',
      createdById: req.user!.id,
    });

    res.json({ url });
  })
);

usersRouter.patch(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const input = updateUserSchema.parse(req.body);
    const data: Record<string, unknown> = {};
    if (input.name) data.name = input.name;
    if (input.role) data.role = input.role;
    if (input.isActive !== undefined) data.isActive = input.isActive;

    const user = await prisma.user.update({ where: { id: req.params.id }, data, select });
    res.json({ user });
  })
);
