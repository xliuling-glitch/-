import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET(req:Request){
  const sp=new URL(req.url).searchParams; const date=sp.get('date')||''; const staff=sp.get('staff')||'';
  const session=getSession();
  const where:any={}; if(date) where.date=date; if(staff) where.staff=staff;
  if(session && !['admin','manager'].includes(session.role)) where.staff=session.name;
  return NextResponse.json(await prisma.dailySales.findMany({where,orderBy:{id:'desc'}}));
}

export async function POST(req:Request){
  const b=await req.json(); const session=getSession();
  const staff = session && !['admin','manager'].includes(session.role) ? session.name : b.staff;
  const sales=Number(b.sales||0);
  const created=await prisma.dailySales.create({data:{date:b.date,staff,shop:b.shop,reception:Number(b.reception||0),aftersale:Number(b.aftersale||0),invalidInquiry:Number(b.invalidInquiry||0),presale:Number(b.presale||0),deals:Number(b.deals||0),sales}});
  await prisma.dailyActivity.upsert({where:{date_staff:{date:b.date,staff}},update:{dealsAdded:{increment:Number(b.deals||0)},dealAmountAdded:{increment:sales},lastSubmitAt:new Date()},create:{date:b.date,staff,dealsAdded:Number(b.deals||0),dealAmountAdded:sales}});
  return NextResponse.json(created);
}
