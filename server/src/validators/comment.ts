import { z } from 'zod';

export const createCommentSchema = z.object({
  body: z.string().trim().min(1, 'Comment cannot be empty').max(10000),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
