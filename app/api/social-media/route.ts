import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir, unlink } from 'fs/promises';
import path from 'path';

export async function GET(req: Request) {
  const date = new URL(req.url).searchParams.get('date');
  const where = date ? { date: { gte: new Date(date), lt: new Date(new Date(date).getTime() + 86400000) } } : {};
  const rows = await prisma.socialPostRecord.findMany({ where, orderBy: { id: 'desc' } });
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get('file') as File | null;
  const type = String(form.get('type') || '朋友圈');
  const userId = Number(form.get('userId') || 1);
  const note = String(form.get('note') || '');
  let savedPath: string | null = null;
  if (file) {
    const bytes = Buffer.from(await file.arrayBuffer());
    const dir = path.join(process.cwd(), 'public', 'uploads', 'social');
    await mkdir(dir, { recursive: true });
    const filename = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    const full = path.join(dir, filename);
    await writeFile(full, bytes);
    savedPath = `/uploads/social/${filename}`;
  }
  const created = await prisma.socialPostRecord.create({ data: { date: new Date(), userId, type, posted: true, screenshot: savedPath, note } });
  return NextResponse.json(created);
}

export async function DELETE(req: Request) {
  const id = Number(new URL(req.url).searchParams.get('id'));
  const row = await prisma.socialPostRecord.findUnique({ where: { id } });
  if (row?.screenshot) {
    try { await unlink(path.join(process.cwd(), 'public', row.screenshot)); } catch {}
  }
  await prisma.socialPostRecord.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
