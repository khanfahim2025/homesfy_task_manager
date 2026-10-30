import { createMiddleware } from 'hono/factory';
import type { User } from '../generated/prisma/client';
import { AppError } from '../lib/errors';
import { getDb } from '../lib/db';
import { readSession } from '../lib/session';
import type { AppEnv } from '../types';

/**
 * Signed-in users are kept in memory briefly so most requests (like the 8s
 * notification check) skip a database read. A change to a user is picked up
 * within USER_TTL_MS everywhere, and at once in the instance that made it.
 */
const USER_TTL_MS = 60_000;
const userCache = new Map<string, { user: User; at: number }>();

export function forgetCachedUser(id: string): void {
  userCache.delete(id);
}

/** Attaches the Prisma client and the signed-in (active) user, if any. */
export const loadUser = createMiddleware<AppEnv>(async (c, next) => {
  const db = getDb(c.env.DB);
  c.set('db', db);
  const userId = await readSession(c);
  if (userId) {
    let cached = userCache.get(userId);
    if (!cached || Date.now() - cached.at > USER_TTL_MS) {
      const user = await db.user.findUnique({ where: { id: userId } });
      cached = user ? { user, at: Date.now() } : undefined;
      if (cached) userCache.set(userId, cached);
      else userCache.delete(userId);
    }
    if (cached?.user.isActive) c.set('user', cached.user);
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
