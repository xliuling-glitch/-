import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams; const date = sp.get('date') || ''; const staff = sp.get('staff') || '';
  const where: any = {}; if (date) where.date = date; if (staff) where.staff = staff;
  return NextResponse.json(await prisma.lead.findMany({ where, orderBy: { id: 'desc' } }));
}

export async function POST(req: Request) {
  const b = await req.json();
  if (!b.model?.trim()) return new NextResponse('产品型号必填', { status: 400 });
  if (!b.buyerId?.trim()) return new NextResponse('旺旺名字/ID必填', { status: 400 });
  if (!b.phone?.trim() && !b.wechat?.trim()) return new NextResponse('电话/微信至少填一个', { status: 400 });
  const created = await prisma.lead.create({ data: { ...b, wechatAdded: !!b.wechatAdded, holdSent: !!b.holdSent } });
  await prisma.dailyActivity.upsert({ where: { date_staff: { date: b.date, staff: b.staff } }, update: { leadsAdded: { increment: 1 }, lastSubmitAt: new Date() }, create: { date: b.date, staff: b.staff, leadsAdded: 1 } });
  return NextResponse.json(created);
}
