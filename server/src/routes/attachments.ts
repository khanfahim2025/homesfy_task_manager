import { Router } from 'express';
import multer from 'multer';
import type { Express } from 'express';
import { prisma } from '../lib/prisma.js';
import { env } from '../lib/env.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { AppError } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { classifyAttachment } from '../lib/attachmentType.js';
import { deleteObject, storeObject, streamStoredFile } from '../lib/storage.js';
import { assertTaskAccess } from '../lib/taskAccess.js';

const MAX_FILES = 20;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxUploadBytes },
});

const uploaderSelect = { select: { id: true, name: true } } as const;

function collectUploadedFiles(req: Express.Request): Express.Multer.File[] {
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  if (files) {
    return [...(files.files ?? []), ...(files.file ?? [])];
  }
  return req.file ? [req.file] : [];
}

async function createAttachmentRecord(
  taskId: string,
  userId: string,
  file: Express.Multer.File
) {
  const contentType = file.mimetype || 'application/octet-stream';
  const { fileUrl } = await storeObject(file.buffer, file.originalname);
  return prisma.attachment.create({
    data: {
      task: { connect: { id: taskId } },
      uploadedBy: { connect: { id: userId } },
      fileName: file.originalname,
      fileUrl,
      mimeType: contentType,
      type: classifyAttachment(file.originalname, contentType),
    },
    include: { uploadedBy: uploaderSelect },
  });
}

/** Nested under /api/tasks/:taskId/attachments */
export const taskAttachmentsRouter = Router({ mergeParams: true });

taskAttachmentsRouter.use(
  asyncHandler(async (req, res, next) => {
    await assertTaskAccess(req.user!, req.params.taskId);
    next();
  })
);

taskAttachmentsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const attachments = await prisma.attachment.findMany({
      where: { taskId: req.params.taskId },
      include: { uploadedBy: uploaderSelect },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ attachments });
  })
);

taskAttachmentsRouter.post(
  '/',
  upload.fields([
    { name: 'files', maxCount: MAX_FILES },
    { name: 'file', maxCount: 1 },
  ]),
  asyncHandler(async (req, res) => {
    const uploaded = collectUploadedFiles(req);
    if (uploaded.length === 0) throw new AppError(400, 'No file uploaded', 'NO_FILE');
    await prisma.task.findUniqueOrThrow({ where: { id: req.params.taskId } });

    const attachments = await Promise.all(
      uploaded.map((file) => createAttachmentRecord(req.params.taskId, req.user!.id, file))
    );

    if (attachments.length === 1) {
      res.status(201).json({ attachment: attachments[0], attachments });
    } else {
      res.status(201).json({ attachments });
    }
  })
);

taskAttachmentsRouter.delete(
  '/:attachmentId',
  asyncHandler(async (req, res) => {
    const attachment = await prisma.attachment.findUniqueOrThrow({
      where: { id: req.params.attachmentId },
    });
    await deleteObject(attachment.fileUrl);
    await prisma.attachment.delete({ where: { id: attachment.id } });
    res.json({ ok: true });
  })
);

/** Mounted at /api/attachments — serves stored files (matches legacy URL scheme) */
export const attachmentFilesRouter = Router();

attachmentFilesRouter.get(
  '/files/:name',
  requireAuth,
  asyncHandler(async (req, res) => {
    const fileUrl = `/api/attachments/files/${req.params.name}`;
    const attachment = await prisma.attachment.findFirst({
      where: { fileUrl },
      select: { taskId: true },
    });
    if (attachment) {
      await assertTaskAccess(req.user!, attachment.taskId);
    }
    await streamStoredFile(req.params.name, res);
  })
);
