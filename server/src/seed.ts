import { prisma } from './lib/prisma.js';
import { env } from './lib/env.js';
import { hashPassword } from './lib/password.js';
import { bootstrapAdmin } from './bootstrap.js';
import { normalizeDomain, domainToProjectName } from './lib/domain.js';

async function main(): Promise<void> {
  await bootstrapAdmin();

  const admin = await prisma.user.findFirst({ where: { role: 'admin' } });
  if (!admin) throw new Error('No admin user found.');

  const memberEmail = env.allowedEmailDomain
    ? `member@${env.allowedEmailDomain}`
    : 'member@example.com';
  const member = await prisma.user.upsert({
    where: { email: memberEmail },
    update: {},
    create: {
      email: memberEmail,
      name: 'Demo Member',
      role: 'member',
      passwordHash: await hashPassword(env.bootstrapMemberPassword ?? 'member12345'),
    },
  });

  const domain = normalizeDomain('greenwood-residency.in');
  let project = await prisma.project.findFirst({ where: { primaryDomain: domain } });
  if (!project) {
    project = await prisma.project.create({
      data: {
        name: domainToProjectName(domain),
        primaryDomain: domain,
        projectCode: 'GWR-001',
        creator: { connect: { id: admin.id } },
      },
    });
  }

  const count = await prisma.task.count({ where: { projectId: project.id } });
  if (count === 0) {
    await prisma.task.create({
      data: {
        title: 'Set up landing page',
        description: 'Build the initial landing page from the template.',
        status: 'in_progress',
        priority: 'high',
        category: 'website_development',
        project: { connect: { id: project.id } },
        creator: { connect: { id: admin.id } },
        assignee: { connect: { id: member.id } },
        assignees: { create: [{ user_id: member.id }] },
        observers: { create: [{ user_id: admin.id }] },
        domainName: domain,
      },
    });
  }

  // Backfill assignee join rows for existing tasks
  const legacyTasks = await prisma.task.findMany({
    where: { assigneeId: { not: null } },
    select: { id: true, assigneeId: true },
  });
  for (const t of legacyTasks) {
    if (!t.assigneeId) continue;
    await prisma.task_assignees.upsert({
      where: { task_id_user_id: { task_id: t.id, user_id: t.assigneeId } },
      create: { task_id: t.id, user_id: t.assigneeId },
      update: {},
    });
  }

  console.log('Seed complete.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
