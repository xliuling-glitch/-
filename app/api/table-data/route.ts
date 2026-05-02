import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const moduleKey = new URL(req.url).searchParams.get('moduleKey');
  if (!moduleKey) return new NextResponse('moduleKey required', { status: 400 });
  const row = await prisma.systemSetting.findUnique({ where: { key: `table_${moduleKey}` } });
  return NextResponse.json(row ? JSON.parse(row.value) : null);
}

export async function POST(req: Request) {
  const b = await req.json();
  if (!b.moduleKey) return new NextResponse('moduleKey required', { status: 400 });
  await prisma.systemSetting.upsert({
    where: { key: `table_${b.moduleKey}` },
    update: { value: JSON.stringify({ columns: b.columns, rows: b.rows, updatedAt: new Date().toISOString() }) },
    create: { key: `table_${b.moduleKey}`, value: JSON.stringify({ columns: b.columns, rows: b.rows, updatedAt: new Date().toISOString() }) },
  });
  return NextResponse.json({ ok: true });
}
