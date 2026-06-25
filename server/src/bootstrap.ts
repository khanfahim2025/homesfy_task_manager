import { prisma } from './lib/prisma.js';
import { env } from './lib/env.js';
import { hashPassword } from './lib/password.js';

/**
 * Ensure the configured bootstrap admin exists and can sign in.
 *
 * In development the admin password is (re)set to BOOTSTRAP_ADMIN_PASSWORD on
 * every start so the app is always usable; in production the password is only
 * set when missing.
 */
export async function bootstrapAdmin(): Promise<void> {
  const email = env.bootstrapAdminEmail?.toLowerCase();
  const password = env.bootstrapAdminPassword;
  if (!email || !password) {
    console.warn('[bootstrap] BOOTSTRAP_ADMIN_EMAIL/PASSWORD not set, skipping admin setup');
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });

  if (!existing) {
    const name = (email.split('@')[0] ?? 'Admin').replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) =>
      c.toUpperCase()
    );
    await prisma.user.create({
      data: { email, name, role: 'admin', isActive: true, passwordHash: await hashPassword(password) },
    });
    console.log(`[bootstrap] created admin ${email}`);
    return;
  }

  const needsPassword = !existing.passwordHash;
  if (needsPassword || !env.isProd) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash: await hashPassword(password), role: 'admin', isActive: true },
    });
    console.log(`[bootstrap] admin ${email} password set to BOOTSTRAP_ADMIN_PASSWORD`);
  }
}
