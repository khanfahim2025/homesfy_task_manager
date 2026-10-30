import { Hono, type Context } from 'hono';
import { AppError } from '../lib/errors';
import { createAuthToken } from '../lib/authTokens';
import { inviteEmail, sendEmail } from '../lib/email';
import { forgetCachedUser, requireAdmin } from '../middleware/auth';
import { createUserSchema, updateUserSchema } from '../validators/user';
import type { AuthedEnv } from '../types';

export const usersRouter = new Hono<AuthedEnv>();

const select = {
  id: true,
  email: true,
  name: true,
  role: true,
  team: true,
  isActive: true,
  avatarUrl: true,
  createdAt: true,
} as const;

usersRouter.get('/assignable', async (c) => {
  const users = await c.var.db.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, email: true, role: true, team: true, avatarUrl: true },
    orderBy: { name: 'asc' },
  });
  return c.json({ users });
});

usersRouter.use('*', requireAdmin);

usersRouter.get('/', async (c) => {
  const users = await c.var.db.user.findMany({ select, orderBy: { name: 'asc' } });
  return c.json({ users });
});

async function inviteUser(c: Context<AuthedEnv>, user: { id: string; email: string; name: string }) {
  const url = await createAuthToken(c.var.db, c.env.APP_URL, {
    userId: user.id,
    email: user.email,
    purpose: 'set_password',
    createdById: c.var.user.id,
  });
  c.executionCtx.waitUntil(
    sendEmail(c.env, { to: user.email, subject: 'Your Task Manager invite', html: inviteEmail(user.name, url) })
  );
  return url;
}

usersRouter.post('/', async (c) => {
  const { email, name, role, team } = createUserSchema.parse(await c.req.json());
  const domain = c.env.ALLOWED_EMAIL_DOMAIN;
  if (domain && email.split('@')[1] !== domain.toLowerCase()) {
    throw new AppError(403, `Only @${domain} accounts are allowed`, 'BAD_DOMAIN');
  }
  if (await c.var.db.user.findUnique({ where: { email }, select: { id: true } })) {
    throw new AppError(409, 'An account with that email already exists', 'EMAIL_TAKEN');
  }

  const user = await c.var.db.user.create({
    data: { email, name, role: role ?? 'member', team: team ?? 'tech' },
    select,
  });
  const inviteUrl = await inviteUser(c, user);
  return c.json({ user, inviteUrl }, 201);
});

usersRouter.post('/:id/invite-link', async (c) => {
  const user = await c.var.db.user.findUniqueOrThrow({
    where: { id: c.req.param('id') },
    select: { id: true, email: true, name: true, isActive: true },
  });
  if (!user.isActive) throw new AppError(403, 'Cannot invite deactivated user', 'INACTIVE');
  return c.json({ url: await inviteUser(c, user) });
});

usersRouter.post('/:id/login-link', async (c) => {
  const user = await c.var.db.user.findUniqueOrThrow({
    where: { id: c.req.param('id') },
    select: { id: true, email: true, isActive: true },
  });
  if (!user.isActive) throw new AppError(403, 'Cannot create login link for deactivated user', 'INACTIVE');
  const url = await createAuthToken(c.var.db, c.env.APP_URL, {
    userId: user.id,
    email: user.email,
    purpose: 'login',
    createdById: c.var.user.id,
  });
  return c.json({ url });
});

usersRouter.patch('/:id', async (c) => {
  const data = updateUserSchema.parse(await c.req.json());
  const user = await c.var.db.user.update({ where: { id: c.req.param('id') }, data, select });
  forgetCachedUser(user.id);
  return c.json({ user });
});
