import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().min(1, 'Name is required'),
  role: z.enum(['admin', 'member']).optional(),
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(1).optional(),
  role: z.enum(['admin', 'member']).optional(),
  isActive: z.boolean().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
