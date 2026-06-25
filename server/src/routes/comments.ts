import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { AppError } from '../lib/errors.js';
import { createCommentSchema } from '../validators/comment.js';
import { assertTaskAccess } from '../lib/taskAccess.js';

export const commentsRouter = Router({ mergeParams: true });

const authorSelect = { select: { id: true, name: true, email: true, avatarUrl: true } } as const;

commentsRouter.use(
  asyncHandler(async (req, res, next) => {
    await assertTaskAccess(req.user!, req.params.taskId);
    next();
  })
);

commentsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const comments = await prisma.comment.findMany({
      where: { taskId: req.params.taskId },
      include: { author: authorSelect },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ comments });
  })
);

commentsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { body } = createCommentSchema.parse(req.body);
    const comment = await prisma.comment.create({
      data: {
        body,
        task: { connect: { id: req.params.taskId } },
        author: { connect: { id: req.user!.id } },
      },
      include: { author: authorSelect },
    });
    res.status(201).json({ comment });
  })
);

commentsRouter.delete(
  '/:commentId',
  asyncHandler(async (req, res) => {
    const comment = await prisma.comment.findUniqueOrThrow({
      where: { id: req.params.commentId },
    });
    if (comment.authorId !== req.user!.id && req.user!.role !== 'admin') {
      throw new AppError(403, 'You can only delete your own comments', 'FORBIDDEN');
    }
    await prisma.comment.delete({ where: { id: req.params.commentId } });
    res.json({ ok: true });
  })
);
