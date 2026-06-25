import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { env } from '../lib/env.js';
import { AppError } from '../lib/errors.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { hashPassword, verifyPassword, assertPasswordStrength } from '../lib/password.js';
import { requireAuth } from '../middleware/auth.js';
import { loginSchema, signupSchema, setPasswordSchema } from '../validators/auth.js';
import { consumeAuthToken, peekAuthToken } from '../lib/authTokens.js';

export const authRouter = Router();

function publicUser(user: {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl?: string | null;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    avatarUrl: user.avatarUrl ?? null,
  };
}

function assertEmailDomain(email: string): void {
  if (env.allowedEmailDomain) {
    const domain = email.split('@')[1] ?? '';
    if (domain.toLowerCase() !== env.allowedEmailDomain.toLowerCase()) {
      throw new AppError(403, `Only @${env.allowedEmailDomain} accounts are allowed`, 'BAD_DOMAIN');
    }
  }
}

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
    }
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
    }
    if (!user.isActive) {
      throw new AppError(403, 'This account has been deactivated', 'INACTIVE');
    }
    req.session.userId = user.id;
    res.json({ user: publicUser(user) });
  })
);

authRouter.post(
  '/signup',
  asyncHandler(async (req, res) => {
    if (!env.allowSignup) {
      throw new AppError(403, 'Self-registration is disabled', 'SIGNUP_DISABLED');
    }
    const { email, name, password } = signupSchema.parse(req.body);
    assertEmailDomain(email);
    assertPasswordStrength(password);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError(409, 'An account with that email already exists', 'EMAIL_TAKEN');
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email, name, passwordHash, role: 'member' },
    });
    req.session.userId = user.id;
    res.status(201).json({ user: publicUser(user) });
  })
);

authRouter.get(
  '/verify',
  asyncHandler(async (req, res) => {
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    if (!token) {
      throw new AppError(400, 'Missing token', 'MISSING_TOKEN');
    }

    const user = await consumeAuthToken(token, 'login');
    req.session.userId = user.id;

    if (req.headers.accept?.includes('application/json')) {
      res.json({ user: publicUser(user) });
      return;
    }

    const redirect = `${env.appUrl.replace(/\/$/, '')}/tasks`;
    res.redirect(redirect);
  })
);

authRouter.get(
  '/set-password/verify',
  asyncHandler(async (req, res) => {
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    if (!token) {
      throw new AppError(400, 'Missing token', 'MISSING_TOKEN');
    }

    const peek = await peekAuthToken(token, 'set_password');
    if (!peek) {
      throw new AppError(400, 'Invalid or expired link', 'INVALID_TOKEN');
    }

    res.json({ email: peek.email, valid: true });
  })
);

authRouter.post(
  '/set-password',
  asyncHandler(async (req, res) => {
    const { token, password } = setPasswordSchema.parse(req.body);
    assertPasswordStrength(password);

    const user = await consumeAuthToken(token, 'set_password');
    assertEmailDomain(user.email);

    const passwordHash = await hashPassword(password);
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    req.session.userId = updated.id;
    res.json({ user: publicUser(updated) });
  })
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    await new Promise<void>((resolve, reject) => {
      req.session.destroy((err) => (err ? reject(err) : resolve()));
    });
    res.clearCookie('sid');
    res.json({ ok: true });
  })
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: publicUser(req.user!) });
  })
);

authRouter.get(
  '/config',
  asyncHandler(async (_req, res) => {
    res.json({
      allowSignup: env.allowSignup,
      allowedEmailDomain: env.allowedEmailDomain ?? null,
    });
  })
);
