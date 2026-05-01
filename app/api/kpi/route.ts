import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const data = await prisma.kpiRecord.findMany({ orderBy: { id: 'desc' } });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const body = await req.json();
  const score = Number(body.score);
  const created = await prisma.kpiRecord.create({ data: { date: new Date(body.date), userId: Number(body.userId), score, reached: score >= 80 } });
  return NextResponse.json(created);
}
