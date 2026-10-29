import { Hono } from 'hono';
import { AppError } from '../lib/errors';
import { handleMentions, touchTask } from '../services/taskService';
import { createCommentSchema } from '../validators/comment';
import type { AuthedEnv } from '../types';

/** Mounted at /api/tasks/:id/comments, after the task access check. */
export const commentsRouter = new Hono<AuthedEnv>();

const author = { select: { id: true, name: true, email: true, avatarUrl: true } } as const;

commentsRouter.get('/', async (c) => {
  const comments = await c.var.db.comment.findMany({
    where: { taskId: c.req.param('id') },
    include: { author },
    orderBy: { createdAt: 'asc' },
  });
  return c.json({ comments });
});

commentsRouter.post('/', async (c) => {
  const taskId = c.req.param('id')!;
  const { body } = createCommentSchema.parse(await c.req.json());
  const comment = await c.var.db.comment.create({
    data: { body, taskId, authorId: c.var.user.id },
    include: { author },
  });
  const mentions = await handleMentions(c.var.db, c.env, taskId, body, c.var.user);
  await touchTask(c.var.db, taskId, c.var.user.id);
  c.executionCtx.waitUntil(mentions.notify());
  return c.json({ comment }, 201);
});

commentsRouter.delete('/:commentId', async (c) => {
  const taskId = c.req.param('id')!;
  const comment = await c.var.db.comment.findFirstOrThrow({
    where: { id: c.req.param('commentId'), taskId },
  });
  if (comment.authorId !== c.var.user.id && c.var.user.role !== 'admin') {
    throw new AppError(403, 'You can only delete your own comments', 'FORBIDDEN');
  }
  await c.var.db.comment.delete({ where: { id: comment.id } });
  await touchTask(c.var.db, taskId, c.var.user.id);
  return c.json({ ok: true });
});
