import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const KEY='menu_permissions';

export async function GET(){
  const row = await prisma.systemSetting.findUnique({where:{key:KEY}});
  return NextResponse.json(row?JSON.parse(row.value):{});
}

export async function POST(req:Request){
  const body=await req.json();
  await prisma.systemSetting.upsert({where:{key:KEY},update:{value:JSON.stringify(body)},create:{key:KEY,value:JSON.stringify(body)}});
  return NextResponse.json({ok:true});
}
