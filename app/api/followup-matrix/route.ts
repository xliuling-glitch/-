import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { buildFollowupMatrix } from '@/lib/followup-matrix';

/** 客户跟进宽表：按旺旺聚合，对齐原表格列（购买欲望、分类、四次电联+截图+状态/原因） */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const since = sp.get('since') || '';
  const buyerId = sp.get('buyerId') || '';
  const session = getSession();

  const where: Record<string, unknown> = {};
  if (buyerId.trim()) where.buyerId = buyerId.trim();
  if (since?.trim()) {
    const d = new Date(since.trim());
    if (!Number.isNaN(d.getTime())) where.followedAt = { gte: d };
  }
  if (session && !['admin', 'manager'].includes(session.role)) where.staff = session.name;

  const logs = await prisma.followupLog.findMany({
    where,
    orderBy: [{ followedAt: 'desc' }, { id: 'desc' }],
    take: 1200,
  });

  const buyers = [...new Set(logs.map((l) => l.buyerId))];
  const leads =
    buyers.length === 0
      ? []
      : await prisma.lead.findMany({
          where: { buyerId: { in: buyers } },
          orderBy: { id: 'desc' },
          take: 3000,
        });

  const matrix = buildFollowupMatrix(logs, leads);
  return NextResponse.json({ matrix, logCount: logs.length });
}
