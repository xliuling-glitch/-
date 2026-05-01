import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const [tasks, calls, kpis, customers] = await Promise.all([
    prisma.task.count(),
    prisma.callRecord.count(),
    prisma.kpiRecord.findMany(),
    prisma.customer.count(),
  ]);
  const avgKpi = kpis.length ? kpis.reduce((a, b) => a + b.score, 0) / kpis.length : 0;
  return NextResponse.json({ taskCount: tasks, callCount: calls, customerCount: customers, avgKpi: Number(avgKpi.toFixed(1)) });
}
