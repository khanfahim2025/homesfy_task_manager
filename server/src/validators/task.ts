import { z } from 'zod';

export const TASK_STATUSES = ['new', 'assigned', 'accepted', 'in_progress', 'done', 'closed'] as const;
export const TASK_PRIORITIES = ['low', 'medium', 'high'] as const;
export const TASK_CATEGORIES = ['general', 'website_development', 'creative', 'content_creation'] as const;
export const TEAMS = ['tech', 'digital'] as const;

const status = z.enum(TASK_STATUSES);
const priority = z.enum(TASK_PRIORITIES);
const category = z.enum(TASK_CATEGORIES);
const team = z.enum(TEAMS);

const optionalText = z
  .string()
  .trim()
  .max(50000)
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

const userIds = z.array(z.string()).optional();

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(300),
  description: optionalText,
  status: status.optional(),
  priority: priority.optional(),
  category: category.optional(),
  team: team.optional(),
  effortPoints: z.number().int().min(1).max(100).optional(),
  dueDate: z.string().datetime().optional().nullable(),
  projectId: z.string().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  assigneeIds: userIds,
  observerIds: userIds,
  participantIds: userIds,
  domainName: optionalText,
  templateUrl: optionalText,
  docFileLink: optionalText,
  locationIframe: optionalText,
  gtmHead: optionalText,
  gtmBody: optionalText,
  contentText: optionalText,
  contentUrls: optionalText,
});

export const updateTaskSchema = createTaskSchema.partial();

export const statusSchema = z.object({ status });

export const taskQuerySchema = z.object({
  status: status.optional(),
  priority: priority.optional(),
  category: category.optional(),
  team: team.optional(),
  projectId: z.string().optional(),
  assigneeId: z.string().optional(),
  q: z.string().trim().optional(),
});
