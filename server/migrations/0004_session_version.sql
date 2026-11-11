-- Bumped to sign a user out on every device (cookies carry the value they were issued with).
-- Added in place: rebuilding "users" on D1 could cascade-delete rows in tables that reference it.
ALTER TABLE "users" ADD COLUMN "session_version" INTEGER NOT NULL DEFAULT 0;
