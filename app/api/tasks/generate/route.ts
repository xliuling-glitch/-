import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
export async function POST(){const today=new Date();const users=await prisma.user.findMany({where:{role:{code:{in:['service','trainee']}}}});const rules=await prisma.taskRule.findMany();for(const u of users){for(const r of rules){await prisma.task.createMany({data:[{date:today,userId:u.id,type:r.taskType,name:r.taskType,status:'未开始',dueAt:today}],skipDuplicates:true});}}return NextResponse.json({ok:true});}
