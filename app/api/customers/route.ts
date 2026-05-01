import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const customers = await prisma.customer.findMany({ include: { owner: true }, orderBy: { id: 'desc' } });
  return NextResponse.json(customers);
}

export async function POST(req: Request) {
  const body = await req.json();
  const created = await prisma.customer.create({
    data: {
      code: body.code,
      name: body.name,
      platform: body.platform,
      level: body.level,
      ownerId: Number(body.ownerId),
    },
  });
  return NextResponse.json(created);
}
