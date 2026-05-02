import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main(){const roles=await Promise.all(['admin','manager','service','trainee'].map((c)=>prisma.role.upsert({where:{code:c},update:{},create:{code:c,name:c}})));const p=await bcrypt.hash('123456',10);
const users=[['admin','管理员','admin'],['manager','主管','manager'],['zhouchen','周晨','service'],['zhangzhiguo','张治国','service'],['likefu','李客服','service'],['newbie','新人客服','trainee']];
for(const u of users){const role=roles.find(r=>r.code===u[2])!;await prisma.user.upsert({where:{username:u[0]},update:{},create:{username:u[0],name:u[1],passwordHash:p,roleId:role.id}})}
const z=await prisma.user.findUniqueOrThrow({where:{username:'zhouchen'}});
await prisma.customer.createMany({data:[{code:'C001',name:'王老板',platform:'淘宝天猫店',level:'H高价值',ownerId:z.id},{code:'C002',name:'李老板',platform:'京东',level:'G成长型',ownerId:z.id},{code:'C003',name:'陈老板',platform:'淘宝C店',level:'M普通复购',ownerId:z.id}]});
await prisma.taskRule.createMany({data:[{shift:'白班',taskType:'平台登录',startTime:'08:00',endTime:'08:30'},{shift:'白班',taskType:'昨日未成交电联',startTime:'08:30',endTime:'10:00'},{shift:'晚班',taskType:'抖音留资电联',startTime:'19:00',endTime:'22:00'}]});
}
main().finally(()=>prisma.$disconnect());
