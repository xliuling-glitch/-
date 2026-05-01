import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  if (body.status === '已完成') {
    if (!body.note) return new NextResponse('完成说明必填', { status: 400 });
    if (body.type?.includes('朋友圈') && !body.proof) return new NextResponse('朋友圈任务需上传截图', { status: 400 });
    if (body.type?.includes('评价') && !body.reviewStatus) return new NextResponse('评价任务需填写评价状态', { status: 400 });
  }
  const updated = await prisma.task.update({ where: { id: Number(params.id) }, data: { status: body.status } });
  return NextResponse.json(updated);
}
