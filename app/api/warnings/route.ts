import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const overdueTasks = await prisma.task.count({ where: { status: { not: '已完成' }, dueAt: { lt: new Date() } } });
  const lowKpi = await prisma.kpiRecord.count({ where: { score: { lt: 80 } } });
  const highValueStale = await prisma.customer.count({ where: { level: 'H高价值' } });
  return NextResponse.json([
    { type: '任务逾期', level: overdueTasks > 0 ? 'red' : 'green', value: overdueTasks },
    { type: 'KPI低于80', level: lowKpi > 0 ? 'red' : 'green', value: lowKpi },
    { type: 'H客户跟进风险', level: highValueStale > 0 ? 'yellow' : 'green', value: highValueStale },
  ]);
}
