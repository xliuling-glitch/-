import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req:Request){
  const sp=new URL(req.url).searchParams; const date=sp.get('date')||''; const staff=sp.get('staff')||'';
  const where:any={}; if(date) where.date=date; if(staff) where.staff=staff;
  return NextResponse.json(await prisma.dailySales.findMany({where,orderBy:{id:'desc'}}));
}

export async function POST(req:Request){
  const b=await req.json();
  const created=await prisma.dailySales.create({data:{date:b.date,staff:b.staff,shop:b.shop,reception:Number(b.reception||0),aftersale:Number(b.aftersale||0),invalidInquiry:Number(b.invalidInquiry||0),presale:Number(b.presale||0),deals:Number(b.deals||0),sales:Number(b.sales||0)}});
  return NextResponse.json(created);
}
