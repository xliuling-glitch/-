import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const customer = await prisma.customer.findUnique({ where: { id: Number(params.id) }, include: { owner: true, followUps: true, calls: true, reminders: true } });
  return NextResponse.json(customer);
}
