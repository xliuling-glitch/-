import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const date = new URL(req.url).searchParams.get('date') || '';
  return NextResponse.json(await prisma.dailyActivity.findMany({ where: date ? { date } : {}, orderBy: { lastSubmitAt: 'desc' } }));
}
