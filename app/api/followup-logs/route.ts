import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams; const date = sp.get('date') || ''; const where: any = {}; if (date) where.date = date;
  return NextResponse.json(await prisma.followupLog.findMany({ where, orderBy: { id: 'desc' } }));
}

export async function POST(req: Request) {
  const b = await req.json();
  if (!b.buyerId?.trim()) return new NextResponse('旺旺名字/ID必填', { status: 400 });
  if (b.isDeal && !b.dealAmount) return new NextResponse('成交=是时，成交金额必填', { status: 400 });
  if (!b.isDeal && !b.lostReason?.trim()) return new NextResponse('未成交时，未成交原因必填', { status: 400 });
  const created = await prisma.followupLog.create({ data: { ...b, isDeal: !!b.isDeal } });
  await prisma.dailyActivity.upsert({ where: { date_staff: { date: b.date, staff: b.staff } }, update: { followupsAdded: { increment: 1 }, dealsAdded: { increment: b.isDeal ? 1 : 0 }, dealAmountAdded: { increment: b.isDeal ? Number(b.dealAmount || 0) : 0 }, lastSubmitAt: new Date() }, create: { date: b.date, staff: b.staff, followupsAdded: 1, dealsAdded: b.isDeal ? 1 : 0, dealAmountAdded: b.isDeal ? Number(b.dealAmount || 0) : 0 } });
  return NextResponse.json(created);
}
