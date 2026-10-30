-- A single change counter the client polls (one row read per check).
-- Triggers bump it on every task insert/update/delete; comments and attachments
-- already touch their task, so they bump it too.
CREATE TABLE "app_meta" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" INTEGER NOT NULL DEFAULT 0
);

INSERT INTO "app_meta" ("key", "value") VALUES ('tasks_version', 1);

CREATE TRIGGER "tasks_version_insert" AFTER INSERT ON "tasks"
BEGIN
    UPDATE "app_meta" SET "value" = "value" + 1 WHERE "key" = 'tasks_version';
END;

CREATE TRIGGER "tasks_version_update" AFTER UPDATE ON "tasks"
BEGIN
    UPDATE "app_meta" SET "value" = "value" + 1 WHERE "key" = 'tasks_version';
END;

CREATE TRIGGER "tasks_version_delete" AFTER DELETE ON "tasks"
BEGIN
    UPDATE "app_meta" SET "value" = "value" + 1 WHERE "key" = 'tasks_version';
END;
