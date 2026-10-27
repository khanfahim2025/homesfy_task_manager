import type { MagicLinkPurpose, PrismaClient } from '../generated/prisma/client';
import { AppError } from './errors';

const SET_PASSWORD_TTL_MS = 48 * 60 * 60 * 1000;
const LOGIN_TTL_MS = 15 * 60 * 1000;

async function hashToken(raw: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function createAuthToken(
  db: PrismaClient,
  appUrl: string,
  input: { userId: string; email: string; purpose: MagicLinkPurpose; createdById?: string }
): Promise<string> {
  const rawToken = randomToken();
  const now = new Date();
  const ttl = input.purpose === 'set_password' ? SET_PASSWORD_TTL_MS : LOGIN_TTL_MS;

  await db.magic_link_tokens.updateMany({
    where: { user_id: input.userId, purpose: input.purpose, used_at: null, expires_at: { gt: now } },
    data: { used_at: now },
  });
  await db.magic_link_tokens.create({
    data: {
      token_hash: await hashToken(rawToken),
      email: input.email.toLowerCase(),
      purpose: input.purpose,
      expires_at: new Date(now.getTime() + ttl),
      user_id: input.userId,
      created_by_id: input.createdById ?? null,
    },
  });

  const path = input.purpose === 'set_password' ? '/set-password' : '/auth/verify';
  return `${appUrl.replace(/\/$/, '')}${path}?token=${encodeURIComponent(rawToken)}`;
}

export async function consumeAuthToken(db: PrismaClient, rawToken: string, purpose: MagicLinkPurpose) {
  const record = await db.magic_link_tokens.findUnique({
    where: { token_hash: await hashToken(rawToken) },
    include: { users: true },
  });

  if (!record || record.purpose !== purpose) {
    throw new AppError(400, 'Invalid or expired link', 'INVALID_TOKEN');
  }
  if (record.used_at) throw new AppError(400, 'This link has already been used', 'TOKEN_USED');
  if (record.expires_at < new Date()) throw new AppError(400, 'This link has expired', 'TOKEN_EXPIRED');
  if (!record.users?.isActive) throw new AppError(403, 'This account is not available', 'INACTIVE');

  await db.magic_link_tokens.update({ where: { id: record.id }, data: { used_at: new Date() } });
  return record.users;
}

export async function peekAuthToken(db: PrismaClient, rawToken: string, purpose: MagicLinkPurpose) {
  const record = await db.magic_link_tokens.findUnique({
    where: { token_hash: await hashToken(rawToken) },
  });
  if (!record || record.purpose !== purpose || record.used_at || record.expires_at < new Date()) {
    return null;
  }
  return { email: record.email };
}
