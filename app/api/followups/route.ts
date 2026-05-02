import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const data = await prisma.followUpRecord.findMany({ include: { customer: true }, orderBy: { id: 'desc' } });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const body = await req.json();
  const created = await prisma.followUpRecord.create({
    data: { date: new Date(body.date), userId: Number(body.userId), customerId: Number(body.customerId) },
  });
  return NextResponse.json(created);
}
