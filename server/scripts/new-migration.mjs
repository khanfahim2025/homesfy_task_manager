#!/usr/bin/env node
// After editing prisma/schema.prisma, write the SQL needed to bring D1 up to date:
//
//   npm run db:migration -w server -- <short_name>
//
// Then apply it with db:migrate:local / db:migrate:remote.
import { execFileSync } from 'node:child_process';
import { readdirSync, writeFileSync } from 'node:fs';

const name = (process.argv[2] ?? 'change').replace(/[^a-z0-9_]+/gi, '_').toLowerCase();
const existing = readdirSync('migrations').filter((f) => f.endsWith('.sql')).sort();
const next = String(existing.length + 1).padStart(4, '0');

const sql = execFileSync(
  'npx',
  ['prisma', 'migrate', 'diff', '--from-migrations', 'migrations', '--to-schema', 'prisma/schema.prisma', '--script'],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }
);
if (!sql.trim() || /empty migration/i.test(sql)) {
  console.log('Schema matches migrations — nothing to do.');
  process.exit(0);
}
const file = `migrations/${next}_${name}.sql`;
writeFileSync(file, sql);
console.log(`Wrote ${file}`);
