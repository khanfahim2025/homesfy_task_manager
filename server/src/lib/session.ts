import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { AppEnv } from '../types';

const COOKIE = 'sid';
const MAX_AGE_S = 60 * 60 * 24 * 30;
/** Re-issue the cookie at most once a day so active users never expire. */
const REFRESH_AFTER_S = 60 * 60 * 24;

interface Payload {
  uid: string;
  iat: number;
}

const encoder = new TextEncoder();
const keyCache = new Map<string, Promise<CryptoKey>>();

function hmacKey(secret: string): Promise<CryptoKey> {
  let key = keyCache.get(secret);
  if (!key) {
    key = crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify']
    );
    keyCache.set(secret, key);
  }
  return key;
}

function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromB64url(value: string): Uint8Array {
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
}

async function sign(payload: Payload, secret: string): Promise<string> {
  const body = b64url(encoder.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(body));
  return `${body}.${b64url(new Uint8Array(sig))}`;
}

async function verify(token: string, secret: string): Promise<Payload | null> {
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  try {
    const ok = await crypto.subtle.verify(
      'HMAC',
      await hmacKey(secret),
      fromB64url(sig),
      encoder.encode(body)
    );
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(body))) as Payload;
    if (Date.now() / 1000 - payload.iat > MAX_AGE_S) return null;
    return payload;
  } catch {
    return null;
  }
}

function now(): number {
  return Math.floor(Date.now() / 1000);
}

export async function startSession(c: Context<AppEnv>, userId: string): Promise<void> {
  setCookie(c, COOKIE, await sign({ uid: userId, iat: now() }, c.env.SESSION_SECRET), {
    httpOnly: true,
    sameSite: 'Lax',
    secure: new URL(c.req.url).protocol === 'https:',
    path: '/',
    maxAge: MAX_AGE_S,
  });
}

export function endSession(c: Context<AppEnv>): void {
  deleteCookie(c, COOKIE, { path: '/' });
}

/** Returns the signed-in user id, refreshing the cookie when it is getting old. */
export async function readSession(c: Context<AppEnv>): Promise<string | null> {
  const token = getCookie(c, COOKIE);
  if (!token) return null;
  const payload = await verify(token, c.env.SESSION_SECRET);
  if (!payload) return null;
  if (now() - payload.iat > REFRESH_AFTER_S) await startSession(c, payload.uid);
  return payload.uid;
}
