import { Hono } from 'hono';
import type { User } from '../generated/prisma/client';
import { AppError } from '../lib/errors';
import { clientIp, hit } from '../lib/rateLimit';
import { hashPassword, isLegacyHash, verifyPassword } from '../lib/password';
import { endSession, startSession } from '../lib/session';
import { forgetCachedUser } from '../middleware/auth';
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

// Hash of a random throwaway password, so a login for an unknown email takes as
// long as one with a wrong password and doesn't reveal which emails exist.
let dummyHash: Promise<string> | undefined;
function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword(crypto.randomUUID());
  return dummyHash;
}

authRouter.post('/login', async (c) => {
  const { email, password } = loginSchema.parse(await c.req.json());
  // Per IP + email: stops password guessing on one account without blocking
  // colleagues who share the office IP.
  await hit(c.env.LOGIN_LIMITER, `login:${clientIp(c)}:${email}`);
  const user = await c.var.db.user.findUnique({ where: { email } });
  const ok = await verifyPassword(password, user?.passwordHash ?? (await getDummyHash()));
  if (!user?.passwordHash || !ok) {
    throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  }
  if (!user.isActive) throw new AppError(403, 'This account has been deactivated', 'INACTIVE');
  // Move old bcrypt hashes to the lighter PBKDF2 format now that we know the password.
  if (isLegacyHash(user.passwordHash)) {
    const passwordHash = await hashPassword(password);
    c.executionCtx.waitUntil(c.var.db.user.update({ where: { id: user.id }, data: { passwordHash } }).then(() => undefined));
  }
  await startSession(c, user);
  return c.json({ user: publicUser(user) });
});

authRouter.get('/verify', async (c) => {
  const token = c.req.query('token');
  if (!token) throw new AppError(400, 'Missing token', 'MISSING_TOKEN');
  await hit(c.env.LOGIN_LIMITER, `token:${clientIp(c)}`);
  const user = await consumeAuthToken(c.var.db, token, 'login');
  await startSession(c, user);
  return c.json({ user: publicUser(user) });
});

authRouter.get('/set-password/verify', async (c) => {
  const token = c.req.query('token');
  if (!token) throw new AppError(400, 'Missing token', 'MISSING_TOKEN');
  await hit(c.env.LOGIN_LIMITER, `token:${clientIp(c)}`);
  const peek = await peekAuthToken(c.var.db, token, 'set_password');
  if (!peek) throw new AppError(400, 'Invalid or expired link', 'INVALID_TOKEN');
  return c.json({ email: peek.email, valid: true });
});

authRouter.post('/set-password', async (c) => {
  const { token, password } = setPasswordSchema.parse(await c.req.json());
  await hit(c.env.LOGIN_LIMITER, `token:${clientIp(c)}`);
  const user = await consumeAuthToken(c.var.db, token, 'set_password');
  const updated = await c.var.db.user.update({
    where: { id: user.id },
    // A new password signs out every other device.
    data: { passwordHash: await hashPassword(password), sessionVersion: { increment: 1 } },
  });
  forgetCachedUser(updated.id);
  await startSession(c, updated);
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
