#!/usr/bin/env node
// One-time export of the old Postgres data into SQL that D1 can import.
//
//   DATABASE_URL=postgresql://... node scripts/export-postgres.mjs > migrations-data.sql
//   npx wrangler d1 execute DB --remote --file migrations-data.sql
//
// Run it after `db:migrate:remote` on an empty D1 database. Sessions and the
// tables the app no longer uses are skipped.
import pg from 'pg';

const TABLES = {
  users: ['id', 'name', 'email', 'role', 'team', 'avatar_url', 'is_active', 'created_at', 'password_hash'],
  projects: ['id', 'project_name', 'description', 'created_by', 'created_at', 'primary_domain', 'project_code'],
  tasks: [
    'id', 'title', 'description', 'project_id', 'assigned_to', 'created_by', 'due_date', 'status',
    'priority', 'task_category', 'team', 'effort_points', 'updated_at', 'completed_at', 'closed_at',
    'created_at', 'domain_name', 'template_url', 'doc_file_link', 'location_iframe', 'gtm_head',
    'gtm_body', 'content_text', 'content_urls',
  ],
  task_assignees: ['task_id', 'user_id', 'added_at'],
  task_observers: ['task_id', 'user_id', 'added_at'],
  task_participants: ['task_id', 'user_id', 'added_at'],
  task_score_events: ['id', 'task_id', 'user_id', 'points', 'reason', 'created_at'],
  comments: ['id', 'task_id', 'user_id', 'body', 'created_at'],
  attachments: ['id', 'task_id', 'file_url', 'file_name', 'mime_type', 'type', 'uploaded_by', 'created_at'],
};

function literal(value) {
  if (value === null || value === undefined) return 'NULL';
  if (value instanceof Date) return `'${value.toISOString()}'`;
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value === 'number') return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const out = ['PRAGMA defer_foreign_keys = true;'];
for (const [table, cols] of Object.entries(TABLES)) {
  const { rows } = await client.query(`SELECT ${cols.map((c) => `"${c}"`).join(', ')} FROM "${table}"`);
  for (const row of rows) {
    out.push(`INSERT INTO "${table}" (${cols.join(', ')}) VALUES (${cols.map((c) => literal(row[c])).join(', ')});`);
  }
  console.error(`${table}: ${rows.length}`);
}
await client.end();
console.log(out.join('\n'));
