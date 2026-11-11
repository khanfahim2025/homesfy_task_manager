import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import { AppError } from './errors';
import type { AppEnv } from '../types';

/** Client IP as Cloudflare sees it (falls back for local dev). */
export function clientIp(c: Context<AppEnv>): string {
  return c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For')?.split(',')[0].trim() ?? 'local';
}

/**
 * Counts one hit against `limiter` for `key` and throws 429 when over the limit.
 * Uses the Workers Rate Limiting binding (counted in memory at the Cloudflare
 * edge, no storage). If the binding is missing or errors, the request is let
 * through so a limiter problem can never lock people out of the app.
 */
export async function hit(limiter: RateLimit | undefined, key: string): Promise<void> {
  if (!limiter) return;
  let success = true;
  try {
    ({ success } = await limiter.limit({ key }));
  } catch (err) {
    console.error('Rate limiter failed, allowing request:', err);
  }
  if (!success) throw new AppError(429, 'Too many requests — please wait a minute and try again', 'RATE_LIMITED');
}

/** Limits every API request: per signed-in user, or per IP when signed out. */
export const apiRateLimit = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.get('user');
  await hit(c.env.API_LIMITER, user ? `u:${user.id}` : `ip:${clientIp(c)}`);
  await next();
});
