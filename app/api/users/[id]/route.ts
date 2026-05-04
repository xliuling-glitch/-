import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRoles } from '@/lib/rbac';
import bcrypt from 'bcryptjs';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    requireRoles(['admin', 'manager']);
    const user = await prisma.user.findUnique({
      where: { id: Number(params.id) },
      include: { role: true },
    });
    if (!user) return new NextResponse('Not found', { status: 404 });
    return NextResponse.json({
      id: user.id,
      username: user.username,
      name: user.name,
      roleId: user.roleId,
      roleCode: user.role.code,
      roleName: user.role.name,
    });
  } catch {
    return new NextResponse('Forbidden', { status: 403 });
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    requireRoles(['admin']);
    const body = await req.json();
    const id = Number(params.id);
    const data: any = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.roleId !== undefined) data.roleId = Number(body.roleId);
    if (body.username !== undefined) data.username = body.username;
    if (body.password) {
      data.passwordHash = await bcrypt.hash(body.password, 10);
    }
    const user = await prisma.user.update({
      where: { id },
      data,
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
    if (e.code === 'P2025') {
      return new NextResponse('Not found', { status: 404 });
    }
    return new NextResponse('Forbidden', { status: 403 });
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    requireRoles(['admin']);
    const id = Number(params.id);
    await prisma.user.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse('Forbidden or failed', { status: 403 });
  }
}
