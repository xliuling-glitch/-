import { NextResponse } from 'next/server';
import { login } from '@/lib/auth';
export async function POST(req:Request){const b=await req.json();const u=await login(b.username,b.password);return u?NextResponse.json({ok:true}):new NextResponse('Unauthorized',{status:401});}
