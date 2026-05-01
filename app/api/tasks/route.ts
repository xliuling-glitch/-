import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const tasks = await prisma.task.findMany({ include: { user: true, customer: true }, orderBy: { id: 'desc' } });
  return NextResponse.json(tasks);
}

export async function POST(req: Request) {
  const body = await req.json();
  const created = await prisma.task.create({
    data: {
      date: new Date(body.date),
      userId: Number(body.userId),
      type: body.type,
      name: body.name,
      status: body.status ?? '未开始',
      dueAt: new Date(body.dueAt),
      customerId: body.customerId ? Number(body.customerId) : null,
    },
  });
  return NextResponse.json(created);
}
