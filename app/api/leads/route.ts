import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams; const date = sp.get('date') || ''; const staff = sp.get('staff') || '';
  const session=getSession();
  const where: any = {}; if (date) where.date = date; if (staff) where.staff = staff;
  if(session && !['admin','manager'].includes(session.role)) where.staff=session.name;
  return NextResponse.json(await prisma.lead.findMany({ where, orderBy: { id: 'desc' } }));
}

export async function POST(req: Request) {
  const b = await req.json(); const session=getSession();
  if (!b.model?.trim()) return new NextResponse('产品型号必填', { status: 400 });
  if (!b.buyerId?.trim()) return new NextResponse('旺旺名字/ID必填', { status: 400 });
  if (!b.phone?.trim() && !b.wechat?.trim()) return new NextResponse('电话/微信至少填一个', { status: 400 });
  const staff = session && !['admin','manager'].includes(session.role) ? session.name : b.staff;
  const created = await prisma.lead.create({ data: { ...b, staff, wechatAdded: !!b.wechatAdded, holdSent: !!b.holdSent } });
  await prisma.dailyActivity.upsert({ where: { date_staff: { date: b.date, staff } }, update: { leadsAdded: { increment: 1 }, lastSubmitAt: new Date() }, create: { date: b.date, staff, leadsAdded: 1 } });
  return NextResponse.json(created);
}
