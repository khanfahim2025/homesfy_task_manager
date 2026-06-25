import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';
import { normalizeDomain, domainToProjectName } from '../lib/domain.js';

export const userMemberSelect = {
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

export type TaskWithRelations = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;

export function serializeTask<T extends TaskWithRelations>(task: T) {
  const { assignees, observers, participants, ...rest } = task;
  return {
    ...rest,
    assignees: assignees.map((row) => row.users),
    observers: observers.map((row) => row.users),
    participants: participants.map((row) => row.users),
  };
}

export function syncMemberIds(ids: string[]) {
  return {
    deleteMany: {},
    create: ids.map((user_id) => ({ user_id })),
  };
}

export function resolveAssigneeIds(
  assigneeIds: string[] | undefined,
  assigneeId: string | null | undefined
): string[] {
  if (assigneeIds !== undefined) return assigneeIds;
  if (assigneeId) return [assigneeId];
  return [];
}

export function buildMemberCreateData(input: {
  assigneeIds?: string[];
  assigneeId?: string | null;
  observerIds?: string[];
  participantIds?: string[];
}): Pick<Prisma.TaskCreateInput, 'assignees' | 'assignee' | 'observers' | 'participants'> {
  const assigneeIds = resolveAssigneeIds(input.assigneeIds, input.assigneeId);
  const data: Pick<Prisma.TaskCreateInput, 'assignees' | 'assignee' | 'observers' | 'participants'> = {};

  if (assigneeIds.length > 0) {
    data.assignees = { create: assigneeIds.map((user_id) => ({ user_id })) };
    data.assignee = { connect: { id: assigneeIds[0] } };
  }

  if (input.observerIds?.length) {
    data.observers = { create: input.observerIds.map((user_id) => ({ user_id })) };
  }
  if (input.participantIds?.length) {
    data.participants = { create: input.participantIds.map((user_id) => ({ user_id })) };
  }

  return data;
}

export function buildMemberUpdateData(input: {
  assigneeIds?: string[];
  assigneeId?: string | null;
  observerIds?: string[];
  participantIds?: string[];
}): Prisma.TaskUpdateInput {
  const data: Prisma.TaskUpdateInput = {};

  if (input.assigneeIds !== undefined) {
    data.assignees = syncMemberIds(input.assigneeIds);
    data.assignee = input.assigneeIds[0]
      ? { connect: { id: input.assigneeIds[0] } }
      : { disconnect: true };
  } else if (input.assigneeId !== undefined) {
    const ids = input.assigneeId ? [input.assigneeId] : [];
    data.assignees = syncMemberIds(ids);
    data.assignee = input.assigneeId
      ? { connect: { id: input.assigneeId } }
      : { disconnect: true };
  }

  if (input.observerIds !== undefined) {
    data.observers = syncMemberIds(input.observerIds);
  }
  if (input.participantIds !== undefined) {
    data.participants = syncMemberIds(input.participantIds);
  }

  return data;
}

/**
 * Resolve the project for a task. Tasks require a project, so if an explicit
 * projectId is not provided we find-or-create one from the domain name.
 */
export async function resolveProjectId(
  creatorId: string,
  projectId: string | null | undefined,
  domainName: string | null | undefined,
  options?: { allowGeneralFallback?: boolean }
): Promise<string> {
  if (projectId) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new AppError(400, 'Selected project does not exist', 'BAD_PROJECT');
    return project.id;
  }

  const domain = domainName ? normalizeDomain(domainName) : '';
  if (!domain) {
    if (options?.allowGeneralFallback) {
      const general = await prisma.project.findFirst({ where: { projectCode: 'GENERAL' } });
      if (general) return general.id;
      const created = await prisma.project.create({
        data: {
          name: 'General',
          projectCode: 'GENERAL',
          creator: { connect: { id: creatorId } },
        },
      });
      return created.id;
    }
    throw new AppError(400, 'A project or domain is required', 'PROJECT_REQUIRED');
  }

  const existing = await prisma.project.findFirst({ where: { primaryDomain: domain } });
  if (existing) return existing.id;

  const created = await prisma.project.create({
    data: {
      name: domainToProjectName(domain),
      primaryDomain: domain,
      creator: { connect: { id: creatorId } },
    },
  });
  return created.id;
}
