import type { Prisma, PrismaClient, User } from '../generated/prisma/client';
import { AppError } from '../lib/errors';
import { domainToProjectName, normalizeDomain } from '../lib/domain';
import { sendEmail, taskAssignedEmail } from '../lib/email';
import type { Bindings } from '../types';

const userMemberSelect = {
  select: { id: true, name: true, email: true, avatarUrl: true },
} as const;

export const taskInclude = {
  project: true,
  assignee: userMemberSelect,
  creator: userMemberSelect,
  assignees: { include: { users: userMemberSelect } },
  observers: { include: { users: userMemberSelect } },
  participants: { include: { users: userMemberSelect } },
  _count: { select: { comments: true, attachments: true } },
} satisfies Prisma.TaskInclude;

type TaskWithRelations = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;

export function serializeTask<T extends TaskWithRelations>(task: T) {
  const { assignees, observers, participants, ...rest } = task;
  return {
    ...rest,
    assignees: assignees.map((row) => row.users),
    observers: observers.map((row) => row.users),
    participants: participants.map((row) => row.users),
  };
}

interface MemberInput {
  assigneeIds?: string[];
  assigneeId?: string | null;
  observerIds?: string[];
  participantIds?: string[];
}

function rows(ids: string[]) {
  return [...new Set(ids)].map((user_id) => ({ user_id }));
}

function sync(ids: string[]) {
  return { deleteMany: {}, create: rows(ids) };
}

/** The explicit assignee list wins; the legacy single assigneeId is a fallback. */
export function resolveAssigneeIds(input: MemberInput): string[] | undefined {
  if (input.assigneeIds !== undefined) return input.assigneeIds;
  if (input.assigneeId !== undefined) return input.assigneeId ? [input.assigneeId] : [];
  return undefined;
}

export function buildMemberCreateData(input: MemberInput) {
  const assigneeIds = resolveAssigneeIds(input) ?? [];
  const data: Pick<Prisma.TaskCreateInput, 'assignees' | 'assignee' | 'observers' | 'participants'> = {};
  if (assigneeIds.length > 0) {
    data.assignees = { create: rows(assigneeIds) };
    data.assignee = { connect: { id: assigneeIds[0] } };
  }
  if (input.observerIds?.length) data.observers = { create: rows(input.observerIds) };
  if (input.participantIds?.length) data.participants = { create: rows(input.participantIds) };
  return data;
}

export function buildMemberUpdateData(input: MemberInput): Prisma.TaskUpdateInput {
  const data: Prisma.TaskUpdateInput = {};
  const assigneeIds = resolveAssigneeIds(input);
  if (assigneeIds !== undefined) {
    data.assignees = sync(assigneeIds);
    data.assignee = assigneeIds[0] ? { connect: { id: assigneeIds[0] } } : { disconnect: true };
  }
  if (input.observerIds !== undefined) data.observers = sync(input.observerIds);
  if (input.participantIds !== undefined) data.participants = sync(input.participantIds);
  return data;
}

/**
 * Tasks require a project: use the explicit one, otherwise find-or-create one
 * from the domain, otherwise (when allowed) the shared "General" project.
 */
export async function resolveProjectId(
  db: PrismaClient,
  creatorId: string,
  projectId: string | null | undefined,
  domainName: string | null | undefined,
  allowGeneralFallback = false
): Promise<string> {
  if (projectId) {
    const project = await db.project.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!project) throw new AppError(400, 'Selected project does not exist', 'BAD_PROJECT');
    return project.id;
  }

  const domain = domainName ? normalizeDomain(domainName) : '';
  if (domain) {
    const existing = await db.project.findFirst({ where: { primaryDomain: domain }, select: { id: true } });
    if (existing) return existing.id;
    const created = await db.project.create({
      data: { name: domainToProjectName(domain), primaryDomain: domain, createdById: creatorId },
    });
    return created.id;
  }

  if (!allowGeneralFallback) {
    throw new AppError(400, 'A project or domain is required', 'PROJECT_REQUIRED');
  }
  const general = await db.project.findFirst({ where: { projectCode: 'GENERAL' }, select: { id: true } });
  if (general) return general.id;
  const created = await db.project.create({
    data: { name: 'General', projectCode: 'GENERAL', createdById: creatorId },
  });
  return created.id;
}

/**
 * S3 folder for a task's attachments: its website domain (normalized, e.g.
 * `the-world-worli.com`), so all tasks for one site share a folder; tasks
 * without a domain use `general`.
 */
export async function attachmentFolder(db: PrismaClient, taskId: string): Promise<string> {
  const task = await db.task.findUniqueOrThrow({
    where: { id: taskId },
    select: { domainName: true, project: { select: { primaryDomain: true } } },
  });
  const domain = task.project.primaryDomain ?? (task.domainName ? normalizeDomain(task.domainName) : '');
  return /^[a-z0-9][a-z0-9.-]{0,252}$/.test(domain) ? domain : 'general';
}

/** Bumps updatedAt so clients polling /tasks/version notice comment/attachment changes. */
export async function touchTask(db: PrismaClient, taskId: string): Promise<void> {
  await db.task.update({ where: { id: taskId }, data: { updatedAt: new Date() }, select: { id: true } });
}

/** Emails users newly assigned to a task (never the person who assigned them). */
export async function notifyAssignees(
  db: PrismaClient,
  env: Bindings,
  task: { id: string; title: string; dueDate: Date | null },
  userIds: string[],
  actor: User
): Promise<void> {
  const ids = userIds.filter((id) => id !== actor.id);
  if (ids.length === 0) return;
  const users = await db.user.findMany({
    where: { id: { in: ids }, isActive: true },
    select: { email: true },
  });
  const url = `${env.APP_URL.replace(/\/$/, '')}/tasks/${task.id}`;
  await Promise.all(
    users.map((u) =>
      sendEmail(env, {
        to: u.email,
        subject: `New task: ${task.title}`,
        html: taskAssignedEmail(task, actor.name, url),
      })
    )
  );
}
