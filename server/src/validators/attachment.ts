import { z } from 'zod';

const MAX_FILES_PER_REQUEST = 20;

const fileName = z.string().trim().min(1).max(255);
const contentType = z.string().trim().max(150).default('application/octet-stream');

export const requestUploadsSchema = z.object({
  files: z
    .array(z.object({ name: fileName, type: contentType, size: z.number().int().positive() }))
    .min(1)
    .max(MAX_FILES_PER_REQUEST),
});

export const completeUploadsSchema = z.object({
  files: z
    .array(z.object({ storedName: z.string(), name: fileName, type: contentType }))
    .min(1)
    .max(MAX_FILES_PER_REQUEST),
});
