import { Hono } from 'hono';
import type { User } from '../generated/prisma/client';
import { AppError } from '../lib/errors';
import { hashPassword, verifyPassword } from '../lib/password';
import { endSession, startSession } from '../lib/session';
import { consumeAuthToken, peekAuthToken } from '../lib/authTokens';
import { loginSchema, setPasswordSchema } from '../validators/auth';
import type { AppEnv } from '../types';

export const authRouter = new Hono<AppEnv>();

function publicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    team: user.team,
    avatarUrl: user.avatarUrl ?? null,
  };
}

authRouter.post('/login', async (c) => {
  const { email, password } = loginSchema.parse(await c.req.json());
  const user = await c.var.db.user.findUnique({ where: { email } });
  if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  }
  if (!user.isActive) throw new AppError(403, 'This account has been deactivated', 'INACTIVE');
  await startSession(c, user.id);
  return c.json({ user: publicUser(user) });
});

authRouter.get('/verify', async (c) => {
  const token = c.req.query('token');
  if (!token) throw new AppError(400, 'Missing token', 'MISSING_TOKEN');
  const user = await consumeAuthToken(c.var.db, token, 'login');
  await startSession(c, user.id);
  return c.json({ user: publicUser(user) });
});

authRouter.get('/set-password/verify', async (c) => {
  const token = c.req.query('token');
  if (!token) throw new AppError(400, 'Missing token', 'MISSING_TOKEN');
  const peek = await peekAuthToken(c.var.db, token, 'set_password');
  if (!peek) throw new AppError(400, 'Invalid or expired link', 'INVALID_TOKEN');
  return c.json({ email: peek.email, valid: true });
});

authRouter.post('/set-password', async (c) => {
  const { token, password } = setPasswordSchema.parse(await c.req.json());
  const user = await consumeAuthToken(c.var.db, token, 'set_password');
  const updated = await c.var.db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(password) },
  });
  await startSession(c, updated.id);
  return c.json({ user: publicUser(updated) });
});

authRouter.post('/logout', (c) => {
  endSession(c);
  return c.json({ ok: true });
});

authRouter.get('/me', (c) => {
  const user = c.get('user');
  return c.json({ user: user ? publicUser(user) : null });
});

authRouter.get('/config', (c) => c.json({ allowedEmailDomain: c.env.ALLOWED_EMAIL_DOMAIN ?? null }));
