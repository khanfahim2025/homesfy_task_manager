import type { Prisma, PrismaClient, User } from '../generated/prisma/client';
import { AppError } from '../lib/errors';
import { domainToProjectName, normalizeDomain } from '../lib/domain';
import { mentionEmail, sendEmail, taskAssignedEmail } from '../lib/email';
import { mentionedUserIds, plainCommentText } from '../lib/mentions';
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

/**
 * Handles @tags in a new comment: tagged people who aren't on the task yet become
 * participants (so they can open it), and everyone tagged gets an email.
 */
export async function handleMentions(
  db: PrismaClient,
  env: Bindings,
  taskId: string,
  body: string,
  actor: User
): Promise<{ notify: () => Promise<void> }> {
  const ids = mentionedUserIds(body).filter((id) => id !== actor.id);
  const none = { notify: async () => {} };
  if (ids.length === 0) return none;

  const [users, task] = await Promise.all([
    db.user.findMany({ where: { id: { in: ids }, isActive: true }, select: { id: true, email: true } }),
    db.task.findUniqueOrThrow({
      where: { id: taskId },
      select: {
        title: true,
        creatorId: true,
        assigneeId: true,
        assignees: { select: { user_id: true } },
        observers: { select: { user_id: true } },
        participants: { select: { user_id: true } },
      },
    }),
  ]);
  if (users.length === 0) return none;

  const involved = new Set([
    task.creatorId,
    task.assigneeId,
    ...task.assignees.map((r) => r.user_id),
    ...task.observers.map((r) => r.user_id),
    ...task.participants.map((r) => r.user_id),
  ]);
  const toAdd = users.filter((u) => !involved.has(u.id));
  if (toAdd.length > 0) {
    await db.task_participants.createMany({
      data: toAdd.map((u) => ({ task_id: taskId, user_id: u.id })),
    });
  }

  const url = `${env.APP_URL.replace(/\/$/, '')}/tasks/${taskId}`;
  const html = mentionEmail(task.title, actor.name, plainCommentText(body), url);
  return {
    notify: async () => {
      await Promise.all(
        users.map((u) =>
          sendEmail(env, { to: u.email, subject: `${actor.name} mentioned you on: ${task.title}`, html })
        )
      );
    },
  };
}
