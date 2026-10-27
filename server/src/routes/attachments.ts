import { Hono } from 'hono';
import { AppError } from '../lib/errors';
import { classifyAttachment } from '../lib/attachmentType';
import {
  DOWNLOAD_TTL_S,
  FILE_URL_PREFIX,
  deleteObject,
  isStoredName,
  newStoredName,
  objectExists,
  presignDownload,
  presignUpload,
} from '../lib/s3';
import { assertTaskAccess } from '../lib/taskAccess';
import { attachmentFolder, touchTask } from '../services/taskService';
import { completeUploadsSchema, requestUploadsSchema } from '../validators/attachment';
import type { AuthedEnv } from '../types';

const uploadedBy = { select: { id: true, name: true } } as const;

/**
 * Mounted at /api/tasks/:id/attachments, after the task access check.
 * Upload flow: POST /uploads → browser PUTs each file to S3 → POST / to record them.
 */
export const taskAttachmentsRouter = new Hono<AuthedEnv>();

taskAttachmentsRouter.get('/', async (c) => {
  const attachments = await c.var.db.attachment.findMany({
    where: { taskId: c.req.param('id') },
    include: { uploadedBy },
    orderBy: { createdAt: 'desc' },
  });
  return c.json({ attachments });
});

taskAttachmentsRouter.post('/uploads', async (c) => {
  const { files } = requestUploadsSchema.parse(await c.req.json());
  const maxMb = Number(c.env.MAX_UPLOAD_MB ?? 100);
  const tooBig = files.find((f) => f.size > maxMb * 1024 * 1024);
  if (tooBig) {
    throw new AppError(413, `"${tooBig.name}" is too large — maximum size is ${maxMb} MB per file`, 'FILE_TOO_LARGE');
  }

  const folder = await attachmentFolder(c.var.db, c.req.param('id')!);
  const uploads = await Promise.all(
    files.map(async (file) => {
      const storedName = newStoredName(folder, file.name);
      return { storedName, uploadUrl: await presignUpload(c.env, storedName, file.type, file.size) };
    })
  );
  return c.json({ uploads });
});

taskAttachmentsRouter.post('/', async (c) => {
  const taskId = c.req.param('id')!;
  const { files } = completeUploadsSchema.parse(await c.req.json());

  // Only accept files uploaded into this task's folder.
  const folder = await attachmentFolder(c.var.db, taskId);
  const present = await Promise.all(
    files.map(
      (f) =>
        isStoredName(f.storedName) &&
        f.storedName.startsWith(`${folder}/`) &&
        objectExists(c.env, f.storedName)
    )
  );
  const missing = files.find((_, i) => !present[i]);
  if (missing) throw new AppError(400, `Upload of "${missing.name}" did not complete`, 'UPLOAD_MISSING');

  const attachments = await Promise.all(
    files.map((file) =>
      c.var.db.attachment.create({
        data: {
          taskId,
          uploadedById: c.var.user.id,
          fileName: file.name,
          fileUrl: `${FILE_URL_PREFIX}${file.storedName}`,
          mimeType: file.type,
          type: classifyAttachment(file.name, file.type),
        },
        include: { uploadedBy },
      })
    )
  );
  await touchTask(c.var.db, taskId);
  return c.json({ attachments }, 201);
});

taskAttachmentsRouter.delete('/:attachmentId', async (c) => {
  const taskId = c.req.param('id')!;
  const attachment = await c.var.db.attachment.findFirstOrThrow({
    where: { id: c.req.param('attachmentId'), taskId },
  });
  await c.var.db.attachment.delete({ where: { id: attachment.id } });
  c.executionCtx.waitUntil(deleteObject(c.env, attachment.fileUrl));
  await touchTask(c.var.db, taskId);
  return c.json({ ok: true });
});

/** Mounted at /api/attachments: redirects a stored file to a presigned S3 URL. */
export const attachmentFilesRouter = new Hono<AuthedEnv>();

attachmentFilesRouter.get('/files/:name{.+}', async (c) => {
  const name = c.req.param('name');
  const attachment = isStoredName(name)
    ? await c.var.db.attachment.findFirst({
        where: { fileUrl: `${FILE_URL_PREFIX}${name}` },
        select: { taskId: true, fileName: true },
      })
    : null;
  if (!attachment) throw new AppError(404, 'File not found', 'NOT_FOUND');
  await assertTaskAccess(c.var.db, c.var.user, attachment.taskId);

  // Let the browser reuse the redirect while the presigned URL is still valid.
  c.header('Cache-Control', `private, max-age=${DOWNLOAD_TTL_S - 300}`);
  return c.redirect(await presignDownload(c.env, name, attachment.fileName), 302);
});
