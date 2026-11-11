import bcrypt from 'bcryptjs';

/**
 * Passwords are hashed with PBKDF2-SHA256 through Web Crypto, which runs natively
 * and stays well inside the Workers Free plan's CPU budget (bcryptjs is pure
 * JavaScript and does not). 100,000 iterations is the most Workers allows.
 *
 * Stored format: pbkdf2_sha256$<iterations>$<salt b64>$<hash b64>
 * Older bcrypt hashes ($2a$/$2b$...) still verify and are upgraded on next login.
 */
const ITERATIONS = 100_000;
const PREFIX = 'pbkdf2_sha256';
const encoder = new TextEncoder();

function toB64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function fromB64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (ch) => ch.charCodeAt(0));
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

/** Compares two byte arrays without stopping at the first difference. */
function equal(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, ITERATIONS);
  return `${PREFIX}$${ITERATIONS}$${toB64(salt)}$${toB64(hash)}`;
}

export function isLegacyHash(hash: string): boolean {
  return !hash.startsWith(`${PREFIX}$`);
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (isLegacyHash(stored)) return bcrypt.compare(password, stored);
  const [, iter, salt, hash] = stored.split('$');
  const iterations = Number(iter);
  if (!salt || !hash || !Number.isInteger(iterations) || iterations < 1 || iterations > ITERATIONS) return false;
  return equal(await derive(password, fromB64(salt), iterations), fromB64(hash));
}
