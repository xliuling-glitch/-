import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const users = await prisma.user.findMany({ where: { role: { code: { in: ['service', 'trainee'] } } } });
  const rules = await prisma.taskRule.findMany();
  const tasks = await Promise.all(
    users.flatMap((u) =>
      rules.map((r) =>
        prisma.task.upsert({
          where: { date_userId_type: { date: today, userId: u.id, type: r.taskType } },
          update: {},
          create: { date: today, userId: u.id, type: r.taskType, name: r.taskType, status: '未开始', dueAt: today },
        }),
      ),
    ),
  );

  return NextResponse.json({ ok: true, count: tasks.length });
}
