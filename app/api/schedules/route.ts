import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const data = await prisma.shiftSchedule.findMany({ include: { user: true }, orderBy: { id: 'desc' } });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const body = await req.json();
  const created = await prisma.shiftSchedule.create({
    data: { date: new Date(body.date), userId: Number(body.userId), shift: body.shift, startTime: body.startTime, endTime: body.endTime },
  });
  return NextResponse.json(created);
}
