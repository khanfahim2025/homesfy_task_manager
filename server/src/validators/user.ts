import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().min(1, 'Name is required'),
  role: z.enum(['admin', 'manager', 'member']).optional(),
  team: z.enum(['tech', 'digital']).optional(),
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(1).optional(),
  role: z.enum(['admin', 'manager', 'member']).optional(),
  team: z.enum(['tech', 'digital']).optional(),
  isActive: z.boolean().optional(),
});
