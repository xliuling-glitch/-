import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const data = await prisma.callRecord.findMany({ include: { customer: true }, orderBy: { id: 'desc' } });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const body = await req.json();
  const durationSec = Number(body.durationSec);
  const connected = Boolean(body.connected);
  const validCall = connected && durationSec > 10;
  const created = await prisma.callRecord.create({
    data: { date: new Date(body.date), userId: Number(body.userId), customerId: Number(body.customerId), connected, durationSec, validCall },
  });
  return NextResponse.json(created);
}
