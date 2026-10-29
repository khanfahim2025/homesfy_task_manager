-- Who made the latest change to a task, for "X changed this" notifications.
-- A plain ADD COLUMN: Prisma's table rebuild would drop "tasks", and D1 keeps
-- foreign keys on, which would cascade-delete comments and attachments.
ALTER TABLE "tasks" ADD COLUMN "updated_by" TEXT REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
