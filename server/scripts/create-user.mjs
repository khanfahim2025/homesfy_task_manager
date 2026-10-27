#!/usr/bin/env node
// Create a user, or reset an existing user's password/role, directly in D1.
//
//   npm run user:create -w server -- <email> <password> [name] [--role admin|manager|member]
//                                     [--team tech|digital] [--remote]
//
// Uses the local dev database unless --remote is given.
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const [, value] = args.splice(i, 2);
  return value;
};
const remote = args.includes('--remote');
const role = flag('role', 'admin');
const team = flag('team', 'tech');
const [email, password, name] = args.filter((a) => a !== '--remote');

if (!email || !password || password.length < 8) {
  console.error('Usage: create-user.mjs <email> <password (8+ chars)> [name] [--role admin] [--team tech] [--remote]');
  process.exit(1);
}

const sql = (v) => `'${String(v).replace(/'/g, "''")}'`;
const lower = email.trim().toLowerCase();
const displayName =
  name ?? lower.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const hash = bcrypt.hashSync(password, 12);
const now = new Date().toISOString();

const statement = `INSERT INTO users (id, name, email, role, team, is_active, created_at, password_hash)
VALUES (${sql(randomUUID())}, ${sql(displayName)}, ${sql(lower)}, ${sql(role)}, ${sql(team)}, 1, ${sql(now)}, ${sql(hash)})
ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash, role = excluded.role, is_active = 1;`;

execFileSync(
  'npx',
  ['wrangler', 'd1', 'execute', 'DB', remote ? '--remote' : '--local', '--command', statement],
  { stdio: 'inherit' }
);
console.log(`\n${lower} (${role}) is ready to sign in${remote ? ' on production' : ' locally'}.`);
