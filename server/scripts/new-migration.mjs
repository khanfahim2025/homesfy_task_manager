#!/usr/bin/env node
// After editing prisma/schema.prisma, write the SQL needed to bring D1 up to date:
//
//   npm run db:migration -w server -- <short_name>
//
// Then apply it with db:migrate:local / db:migrate:remote.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const name = (process.argv[2] ?? 'change').replace(/[^a-z0-9_]+/gi, '_').toLowerCase();
const existing = readdirSync('migrations').filter((f) => f.endsWith('.sql')).sort();
const next = String(existing.length + 1).padStart(4, '0');

// Diff against the last committed schema (the migrations folder has no Prisma lock file).
const committed = execFileSync('git', ['show', 'HEAD:./prisma/schema.prisma'], { encoding: 'utf8' });
const base = join(mkdtempSync(join(tmpdir(), 'schema-')), 'schema.prisma');
writeFileSync(base, committed);
const sql = execFileSync(
  'npx',
  ['prisma', 'migrate', 'diff', '--from-schema', base, '--to-schema', 'prisma/schema.prisma', '--script'],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }
);
if (!sql.trim() || /empty migration/i.test(sql)) {
  console.log('Schema matches migrations — nothing to do.');
  process.exit(0);
}
const file = `migrations/${next}_${name}.sql`;
writeFileSync(file, sql);
console.log(`Wrote ${file}`);
if (/RedefineTables|DROP TABLE/.test(sql)) {
  console.warn(
    'WARNING: this rebuilds a table. D1 keeps foreign keys on, so dropping a table can\n' +
      'cascade-delete rows in other tables. Rewrite it as ALTER TABLE ... ADD COLUMN if you can.'
  );
}
