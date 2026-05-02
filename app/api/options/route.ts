import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const DEFAULTS: Record<string, string[]> = {
  shops: ['天猫旗舰店', '淘宝店', '拼多多店', '抖音店', '京东店'],
  inquiry_types: ['真空机', '封箱机', '封口机', '捆扎机', '打包机', '其他'],
  customer_types: ['新客户', '重点客户', '老客户', '同行/采购', '其他'],
  status_options: ['待跟进', '初步建议', '方案报价', '协商议价', '物料测试', '比较价格', '已停滞', '成交', '其他'],
  lost_reasons: ['价格高', '竞品对比', '仅咨询', '暂时没需求', '规格不匹配', '发货/售后顾虑', '无货/等货', '其他'],
  staff_roster: ['陶柳青', '张治国', '张林其', '周晨'],
};

export async function GET() {
  const keys = Object.keys(DEFAULTS);
  const rows = await prisma.systemSetting.findMany({ where: { key: { in: keys } } });
  const map = Object.fromEntries(rows.map((r) => [r.key, JSON.parse(r.value)]));
  return NextResponse.json(keys.reduce((acc, k) => ({ ...acc, [k]: map[k] || DEFAULTS[k] }), {}));
}

export async function POST(req: Request) {
  const body = await req.json();
  for (const [key, value] of Object.entries(body)) {
    await prisma.systemSetting.upsert({ where: { key }, update: { value: JSON.stringify(value) }, create: { key, value: JSON.stringify(value) } });
  }
  return NextResponse.json({ ok: true });
}
