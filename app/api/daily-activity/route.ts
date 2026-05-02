import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET(req: Request) {
  const date = new URL(req.url).searchParams.get('date') || '';
  const session=getSession();
  const where:any = date ? { date } : {};
  if(session && !['admin','manager'].includes(session.role)) where.staff=session.name;
  return NextResponse.json(await prisma.dailyActivity.findMany({ where, orderBy: { lastSubmitAt: 'desc' } }));
}
