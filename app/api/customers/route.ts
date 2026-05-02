import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRoles } from '@/lib/rbac';

export async function GET(req: Request) {
  try {
    requireRoles(['admin', 'manager', 'service', 'trainee']);
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const page = Number(searchParams.get('page') || 1);
    const pageSize = Number(searchParams.get('pageSize') || 10);
    const where = q ? { OR: [{ name: { contains: q } }, { code: { contains: q } }] } : {};
    const [items, total] = await Promise.all([
      prisma.customer.findMany({ where, include: { owner: true }, skip: (page - 1) * pageSize, take: pageSize, orderBy: { id: 'desc' } }),
      prisma.customer.count({ where }),
    ]);
    return NextResponse.json({ items, total, page, pageSize });
  } catch {
    return new NextResponse('Forbidden', { status: 403 });
  }
}

export async function POST(req: Request) {
  try {
    requireRoles(['admin', 'manager', 'service']);
    const body = await req.json();
    const created = await prisma.customer.create({ data: { code: body.code, name: body.name, platform: body.platform, level: body.level, ownerId: Number(body.ownerId) } });
    return NextResponse.json(created);
  } catch {
    return new NextResponse('Forbidden', { status: 403 });
  }
}
