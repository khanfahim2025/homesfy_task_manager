import { createHash, randomBytes } from 'node:crypto';
import type { MagicLinkPurpose } from '@prisma/client';
import { prisma } from './prisma.js';
import { env } from './env.js';
import { AppError } from './errors.js';

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function ttlMs(purpose: MagicLinkPurpose): number {
  if (purpose === 'set_password') {
    return env.tokenTtlSetPasswordHours * 60 * 60 * 1000;
  }
  return env.tokenTtlLoginMinutes * 60 * 1000;
}

export function buildTokenUrl(path: string, rawToken: string): string {
  const base = env.appUrl.replace(/\/$/, '');
  return `${base}${path}?token=${encodeURIComponent(rawToken)}`;
}

export async function createAuthToken(input: {
  userId: string;
  email: string;
  purpose: MagicLinkPurpose;
  createdById?: string;
}): Promise<{ rawToken: string; url: string }> {
  const rawToken = randomBytes(32).toString('base64url');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + ttlMs(input.purpose));

  await prisma.magic_link_tokens.updateMany({
    where: {
      user_id: input.userId,
      purpose: input.purpose,
      used_at: null,
      expires_at: { gt: new Date() },
    },
    data: { used_at: new Date() },
  });

  await prisma.magic_link_tokens.create({
    data: {
      token_hash: tokenHash,
      email: input.email.toLowerCase(),
      purpose: input.purpose,
      expires_at: expiresAt,
      user_id: input.userId,
      created_by_id: input.createdById ?? null,
    },
  });

  const path = input.purpose === 'set_password' ? '/set-password' : '/auth/verify';
  return { rawToken, url: buildTokenUrl(path, rawToken) };
}

export async function consumeAuthToken(rawToken: string, purpose: MagicLinkPurpose) {
  const tokenHash = hashToken(rawToken);
  const record = await prisma.magic_link_tokens.findUnique({
    where: { token_hash: tokenHash },
    include: { users: true },
  });

  if (!record || record.purpose !== purpose) {
    throw new AppError(400, 'Invalid or expired link', 'INVALID_TOKEN');
  }
  if (record.used_at) {
    throw new AppError(400, 'This link has already been used', 'TOKEN_USED');
  }
  if (record.expires_at < new Date()) {
    throw new AppError(400, 'This link has expired', 'TOKEN_EXPIRED');
  }
  if (!record.users || !record.users.isActive) {
    throw new AppError(403, 'This account is not available', 'INACTIVE');
  }

  await prisma.magic_link_tokens.update({
    where: { id: record.id },
    data: { used_at: new Date() },
  });

  return record.users;
}

export async function peekAuthToken(rawToken: string, purpose: MagicLinkPurpose) {
  const tokenHash = hashToken(rawToken);
  const record = await prisma.magic_link_tokens.findUnique({
    where: { token_hash: tokenHash },
  });

  if (!record || record.purpose !== purpose || record.used_at || record.expires_at < new Date()) {
    return null;
  }

  return { email: record.email };
}
