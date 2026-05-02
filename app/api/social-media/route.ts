import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir, unlink } from 'fs/promises';
import path from 'path';
import { getSession } from '@/lib/auth';

export async function GET(req: Request) {
  const date = new URL(req.url).searchParams.get('date');
  const session=getSession();
  const where:any = date ? { date: { gte: new Date(date), lt: new Date(new Date(date).getTime() + 86400000) } } : {};
  if(session && !['admin','manager'].includes(session.role)) where.userId = session.id;
  const rows = await prisma.socialPostRecord.findMany({ where, orderBy: { id: 'desc' } });
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const form = await req.formData();
  const session=getSession();
  const file = form.get('file') as File | null;
  const type = String(form.get('type') || '朋友圈');
  const userId = session?.id || Number(form.get('userId') || 1);
  const note = String(form.get('note') || '');
  let savedPath: string | null = null;
  if (file) { const bytes = Buffer.from(await file.arrayBuffer()); const dir = path.join(process.cwd(), 'public', 'uploads', 'social'); await mkdir(dir, { recursive: true }); const filename = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`; const full = path.join(dir, filename); await writeFile(full, bytes); savedPath = `/uploads/social/${filename}`; }
  const created = await prisma.socialPostRecord.create({ data: { date: new Date(), userId, type, posted: true, screenshot: savedPath, note } });
  return NextResponse.json(created);
}

export async function DELETE(req: Request) {
  const id = Number(new URL(req.url).searchParams.get('id')); const session=getSession();
  const row = await prisma.socialPostRecord.findUnique({ where: { id } });
  if(!row) return new NextResponse('not found',{status:404});
  if(session && !['admin','manager'].includes(session.role) && row.userId!==session.id) return new NextResponse('forbidden',{status:403});
  if (row?.screenshot) { try { await unlink(path.join(process.cwd(), 'public', row.screenshot)); } catch {} }
  await prisma.socialPostRecord.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
