import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRoles } from '@/lib/rbac';

export async function GET(req: Request) {
  try {
    const session = requireRoles(['admin', 'manager', 'service', 'trainee']);
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const page = Number(searchParams.get('page') || 1);
    const pageSize = Number(searchParams.get('pageSize') || 10);
    const status = searchParams.get('status') || '';
    const date = searchParams.get('date') || '';
    const where: any = { AND: [] };
    if (session.role === 'service' || session.role === 'trainee') where.AND.push({ userId: session.id });
    if (q) where.AND.push({ OR: [{ type: { contains: q } }, { name: { contains: q } }] });
    if (status) where.AND.push({ status });
    if (date) {
      const start = new Date(date); const end = new Date(date); end.setDate(end.getDate() + 1);
      where.AND.push({ date: { gte: start, lt: end } });
    }
    const finalWhere = where.AND.length ? where : {};
    const [items, total] = await Promise.all([
      prisma.task.findMany({ where: finalWhere, include: { user: true, customer: true }, skip: (page - 1) * pageSize, take: pageSize, orderBy: { id: 'desc' } }),
      prisma.task.count({ where: finalWhere }),
    ]);
    return NextResponse.json({ items, total, page, pageSize });
  } catch { return new NextResponse('Forbidden', { status: 403 }); }
}

export async function POST(req: Request) { const b = await req.json(); const c = await prisma.task.create({ data: { date: new Date(b.date), userId: Number(b.userId), type: b.type, name: b.name, status: b.status ?? '未开始', dueAt: new Date(b.dueAt), customerId: b.customerId ? Number(b.customerId) : null } }); return NextResponse.json(c); }
