import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

const MAX_RANGE_DAYS = 400;

function parseDate(s: string | null): string | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T12:00:00`).getTime();
  const b = new Date(`${to}T12:00:00`).getTime();
  return Math.floor((b - a) / 86400000) + 1;
}

async function shopListFromSettings(): Promise<string[]> {
  const row = await prisma.systemSetting.findUnique({ where: { key: 'shops' } });
  if (!row) return [];
  try {
    const v = JSON.parse(row.value) as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

async function rosterList(): Promise<string[]> {
  const row = await prisma.systemSetting.findUnique({ where: { key: 'staff_roster' } });
  if (!row) return [];
  try {
    const v = JSON.parse(row.value) as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** 管理员/主管：日报（DailySales）按日期区间聚合 — 客服排行、店铺占比、客服×店铺矩阵、店铺维度汇总 */
export async function GET(req: Request) {
  const session = getSession();
  if (!session || !['admin', 'manager'].includes(session.role)) {
    return NextResponse.json({ error: '仅管理员/主管可查看' }, { status: 403 });
  }

  const sp = new URL(req.url).searchParams;
  const from = parseDate(sp.get('from'));
  const to = parseDate(sp.get('to'));
  if (!from || !to || from > to) {
    return NextResponse.json({ error: '请提供有效 from、to（YYYY-MM-DD）' }, { status: 400 });
  }
  if (daysBetween(from, to) > MAX_RANGE_DAYS) {
    return NextResponse.json({ error: `区间过长（上限 ${MAX_RANGE_DAYS} 天）` }, { status: 400 });
  }

  const rows = await prisma.dailySales.findMany({
    where: { date: { gte: from, lte: to } },
  });

  const staffSales = new Map<string, number>();
  const shopSales = new Map<string, number>();
  const shopAgg = new Map<
    string,
    { reception: number; aftersale: number; invalidInquiry: number; presale: number; deals: number; sales: number }
  >();
  const matrix = new Map<string, number>();

  for (const r of rows) {
    const s = Number(r.sales || 0);
    staffSales.set(r.staff, (staffSales.get(r.staff) || 0) + s);
    shopSales.set(r.shop, (shopSales.get(r.shop) || 0) + s);
    const mk = `${r.staff}\t${r.shop}`;
    matrix.set(mk, (matrix.get(mk) || 0) + s);

    const g = shopAgg.get(r.shop) ?? {
      reception: 0,
      aftersale: 0,
      invalidInquiry: 0,
      presale: 0,
      deals: 0,
      sales: 0,
    };
    g.reception += r.reception;
    g.aftersale += r.aftersale;
    g.invalidInquiry += r.invalidInquiry;
    g.presale += r.presale;
    g.deals += r.deals;
    g.sales += s;
    shopAgg.set(r.shop, g);
  }

  const totalSales = [...staffSales.values()].reduce((a, b) => a + b, 0);

  const staffRank = [...staffSales.entries()]
    .map(([staff, sales]) => ({ staff, sales }))
    .sort((a, b) => b.sales - a.sales);

  const shopShare = [...shopSales.entries()]
    .map(([shop, sales]) => ({
      shop,
      sales,
      pct: totalSales > 0 ? Math.round((sales / totalSales) * 10000) / 100 : 0,
    }))
    .sort((a, b) => b.sales - a.sales);

  const [roster, defaultShops] = await Promise.all([rosterList(), shopListFromSettings()]);

  const staffSet = new Set<string>([...roster, ...staffSales.keys()]);
  const shopSet = new Set<string>([...defaultShops, ...shopSales.keys()]);

  const staffsSorted = [...staffSet].filter(Boolean).sort((a, b) => {
    const sa = staffSales.get(a) || 0;
    const sb = staffSales.get(b) || 0;
    if (sb !== sa) return sb - sa;
    return a.localeCompare(b, 'zh-CN');
  });

  const shopsSorted = [...shopSet].filter(Boolean).sort((a, b) => {
    const sa = shopSales.get(a) || 0;
    const sb = shopSales.get(b) || 0;
    if (sb !== sa) return sb - sa;
    return a.localeCompare(b, 'zh-CN');
  });

  let matrixMax = 0;
  const matrixCells = staffsSorted.map((staff) =>
    shopsSorted.map((shop) => {
      const v = matrix.get(`${staff}\t${shop}`) || 0;
      if (v > matrixMax) matrixMax = v;
      return v;
    }),
  );

  const shopTable = shopsSorted.map((shop) => {
    const g = shopAgg.get(shop) ?? {
      reception: 0,
      aftersale: 0,
      invalidInquiry: 0,
      presale: 0,
      deals: 0,
      sales: 0,
    };
    return { shop, ...g };
  });

  return NextResponse.json({
    from,
    to,
    dayCount: daysBetween(from, to),
    totalSales,
    staffRank,
    shopShare,
    heatmap: {
      staffs: staffsSorted,
      shops: shopsSorted,
      cells: matrixCells,
      max: matrixMax,
    },
    shopTable,
  });
}
