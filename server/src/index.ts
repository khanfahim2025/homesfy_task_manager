import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { ZodError } from 'zod';
import { Prisma } from './generated/prisma/client';
import { AppError } from './lib/errors';
import { loadUser, requireAuth } from './middleware/auth';
import { apiRateLimit } from './lib/rateLimit';
import { authRouter } from './routes/auth';
import { usersRouter } from './routes/users';
import { projectsRouter } from './routes/projects';
import { tasksRouter } from './routes/tasks';
import { attachmentFilesRouter } from './routes/attachments';
import { connectLive, pushTasksVersion } from './live';
import type { AppEnv, AuthedEnv } from './types';

export { LiveUpdates } from './live';

// Static client files are served by Workers Assets; only /api/* reaches this app.
const app = new Hono<AppEnv>().basePath('/api');

// API responses are JSON only, so they can be locked down completely.
const apiSecurityHeaders = secureHeaders({
  contentSecurityPolicy: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
  crossOriginResourcePolicy: 'same-origin',
  crossOriginOpenerPolicy: 'same-origin',
  strictTransportSecurity: 'max-age=31536000; includeSubDomains',
});
// Skip the WebSocket upgrade: its 101 response comes from the Durable Object
// and its headers can't be changed.
app.use('*', (c, next) => (c.req.header('Upgrade') === 'websocket' ? next() : apiSecurityHeaders(c, next)));
app.use('*', loadUser);
app.use('*', apiRateLimit);

app.get('/health', (c) => c.json({ ok: true, time: new Date().toISOString() }));
app.route('/auth', authRouter);

const authed = new Hono<AuthedEnv>();
authed.use('*', requireAuth);
// After any successful change, push the new task version to open browsers.
authed.use('*', async (c, next) => {
  await next();
  if (c.req.method !== 'GET' && c.res.ok) c.executionCtx.waitUntil(pushTasksVersion(c.env));
});
authed.get('/live', (c) => {
  if (c.req.header('Upgrade') !== 'websocket') throw new AppError(426, 'Expected a WebSocket', 'UPGRADE_REQUIRED');
  return connectLive(c.env, c.req.raw);
});
authed.route('/users', usersRouter);
authed.route('/projects', projectsRouter);
authed.route('/tasks', tasksRouter);
authed.route('/attachments', attachmentFilesRouter);
app.route('/', authed);

app.notFound((c) => c.json({ error: 'Not found' }, 404));

app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json({ error: err.message, code: err.code }, err.statusCode as 400);
  }
  if (err instanceof ZodError) {
    return c.json({ error: 'Validation failed', code: 'VALIDATION_ERROR', details: err.flatten() }, 400);
  }
  if (err instanceof SyntaxError) {
    return c.json({ error: 'Invalid JSON body', code: 'BAD_JSON' }, 400);
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2025') return c.json({ error: 'Not found', code: 'NOT_FOUND' }, 404);
    if (err.code === 'P2002') {
      return c.json({ error: 'A record with that value already exists', code: 'CONFLICT' }, 409);
    }
  }
  console.error('Unhandled error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

export default app;
