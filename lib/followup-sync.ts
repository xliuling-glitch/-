import { prisma } from '@/lib/prisma';

/** 询单转化②写入跟进日志后，若能在客户表、用户表匹配，则同步一条客户跟进记录 */
export async function mirrorFollowupLogToCustomerRecord(logId: number) {
  const log = await prisma.followupLog.findUnique({ where: { id: logId } });
  if (!log) return;
  const customer = await prisma.customer.findFirst({
    where: { OR: [{ code: log.buyerId }, { name: log.buyerId }] },
  });
  const user = await prisma.user.findFirst({ where: { name: log.staff } });
  if (!customer || !user) return;
  const when = log.followedAt ?? log.createdAt;
  await prisma.followUpRecord.create({
    data: { date: when, userId: user.id, customerId: customer.id },
  });
}
