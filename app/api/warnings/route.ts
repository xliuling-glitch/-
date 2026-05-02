import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const now = new Date();
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);

  const [overdueTasks, lowKpi, hStale, t7, t30, t90, douyinNoCall] = await Promise.all([
    prisma.task.count({ where: { status: { not: '已完成' }, dueAt: { lt: now } } }),
    prisma.kpiRecord.count({ where: { score: { lt: 80 } } }),
    prisma.customer.count({ where: { level: 'H高价值' } }),
    prisma.task.count({ where: { type: { contains: '7天回访' }, status: { not: '已完成' }, dueAt: { lt: now } } }),
    prisma.task.count({ where: { type: { contains: '30天耗材' }, status: { not: '已完成' }, dueAt: { lt: now } } }),
    prisma.task.count({ where: { type: { contains: '90天保养' }, status: { not: '已完成' }, dueAt: { lt: now } } }),
    prisma.customer.count({
      where: {
        platform: '抖音',
        calls: { none: { date: { gte: thirtyMinAgo } } },
      },
    }),
  ]);

  return NextResponse.json([
    { type: '任务逾期', level: overdueTasks > 0 ? 'red' : 'green', value: overdueTasks },
    { type: 'KPI低于80', level: lowKpi > 0 ? 'red' : 'green', value: lowKpi },
    { type: 'H客户跟进风险', level: hStale > 0 ? 'yellow' : 'green', value: hStale },
    { type: '7天回访未执行', level: t7 > 0 ? 'red' : 'green', value: t7 },
    { type: '30天耗材未执行', level: t30 > 0 ? 'red' : 'green', value: t30 },
    { type: '90天保养未执行', level: t90 > 0 ? 'red' : 'green', value: t90 },
    { type: '抖音留资30分钟未电联', level: douyinNoCall > 0 ? 'red' : 'green', value: douyinNoCall },
  ]);
}
