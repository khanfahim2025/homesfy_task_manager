import { createMiddleware } from 'hono/factory';
import type { User } from '../generated/prisma/client';
import { AppError } from '../lib/errors';
import { getDb } from '../lib/db';
import { readSession } from '../lib/session';
import type { AppEnv } from '../types';

/** Attaches the Prisma client and the signed-in (active) user, if any. */
export const loadUser = createMiddleware<AppEnv>(async (c, next) => {
  const db = getDb(c.env.DB);
  c.set('db', db);
  const userId = await readSession(c);
  if (userId) {
    const user = await db.user.findUnique({ where: { id: userId } });
    if (user?.isActive) c.set('user', user);
  }
  await next();
});

export const requireAuth = createMiddleware<AppEnv & { Variables: { user: User } }>(async (c, next) => {
  if (!c.get('user')) throw new AppError(401, 'Authentication required', 'UNAUTHENTICATED');
  await next();
});

export const requireAdmin = createMiddleware<AppEnv & { Variables: { user: User } }>(async (c, next) => {
  const user = c.get('user');
  if (!user) throw new AppError(401, 'Authentication required', 'UNAUTHENTICATED');
  if (user.role !== 'admin') throw new AppError(403, 'Admin access required', 'FORBIDDEN');
  await next();
});
