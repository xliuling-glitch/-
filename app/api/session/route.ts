import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

/** 客户端侧栏等读取当前登录身份（session 为 httpOnly，仅服务端可读） */
export async function GET() {
  const s = getSession();
  if (!s) return NextResponse.json({ user: null });
  return NextResponse.json({
    user: { id: s.id, name: s.name, username: s.username, role: s.role },
  });
}
