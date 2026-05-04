import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/** 当前登录客服某日期的复盘；?history=1 返回本人近期列表 */
export async function GET(req: Request) {
  const session = getSession();
  if (!session?.id) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const url = new URL(req.url);
  if (url.searchParams.get('history') === '1') {
    const take = Math.min(60, Math.max(1, Number(url.searchParams.get('take')) || 30));
    const items = await prisma.dailyReflection.findMany({
      where: { userId: session.id },
      orderBy: { date: 'desc' },
      take,
      select: {
        id: true,
        date: true,
        todayIssues: true,
        tomorrowPlan: true,
        updatedAt: true,
      },
    });
    return NextResponse.json({ staffName: session.name, items });
  }

  const date = (url.searchParams.get('date') || todayStr()).slice(0, 10);
  const row = await prisma.dailyReflection.findUnique({
    where: { date_userId: { date, userId: session.id } },
  });

  return NextResponse.json({
    date,
    staffName: session.name,
    username: session.username,
    id: row?.id ?? null,
    todayIssues: row?.todayIssues ?? '',
    tomorrowPlan: row?.tomorrowPlan ?? '',
    updatedAt: row?.updatedAt?.toISOString() ?? null,
  });
}

export async function POST(req: Request) {
  const session = getSession();
  if (!session?.id) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const date = typeof b.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : todayStr();
  const todayIssues = String(b.todayIssues ?? '');
  const tomorrowPlan = String(b.tomorrowPlan ?? '');

  const row = await prisma.dailyReflection.upsert({
    where: { date_userId: { date, userId: session.id } },
    create: { date, userId: session.id, todayIssues, tomorrowPlan },
    update: { todayIssues, tomorrowPlan },
  });

  return NextResponse.json({ ok: true, id: row.id, updatedAt: row.updatedAt.toISOString() });
}
