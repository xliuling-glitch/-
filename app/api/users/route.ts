import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRoles } from '@/lib/rbac';
import bcrypt from 'bcryptjs';

export async function GET(req: Request) {
  try {
    requireRoles(['admin', 'manager']);
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const page = Number(searchParams.get('page') || 1);
    const pageSize = Number(searchParams.get('pageSize') || 20);
    const where = q ? { OR: [{ name: { contains: q } }, { username: { contains: q } }] } : {};
    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: { role: true },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { id: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);
    return NextResponse.json({
      items: items.map((u) => ({
        id: u.id,
        username: u.username,
        name: u.name,
        roleId: u.roleId,
        roleCode: u.role.code,
        roleName: u.role.name,
      })),
      total,
      page,
      pageSize,
    });
  } catch {
    return new NextResponse('Forbidden', { status: 403 });
  }
}

export async function POST(req: Request) {
  try {
    requireRoles(['admin']);
    const body = await req.json();
    if (!body.username || !body.name || !body.roleId) {
      return new NextResponse('Missing required fields', { status: 400 });
    }
    const passwordHash = await bcrypt.hash(body.password || '123456', 10);
    const user = await prisma.user.create({
      data: {
        username: body.username,
        name: body.name,
        passwordHash,
        roleId: Number(body.roleId),
      },
      include: { role: true },
    });
    return NextResponse.json({
      id: user.id,
      username: user.username,
      name: user.name,
      roleId: user.roleId,
      roleCode: user.role.code,
      roleName: user.role.name,
    });
  } catch (e: any) {
    if (e.code === 'P2002') {
      return new NextResponse('Username already exists', { status: 409 });
    }
    return new NextResponse('Forbidden', { status: 403 });
  }
}
