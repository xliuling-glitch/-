import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { addCalendarDays, completionPct, monthStartDate, yearMonthFromDate } from '@/lib/sales-board';

type PresaleBoardRow = {
  staff: string;
  presaleTarget: number;
  salesMTD: number;
  completionPct: number | null;
  yesterdayPresale: number;
  yesterdayOffline: number;
};

type AftersaleBoardRow = {
  staff: string;
  aftersaleTarget: number;
  salesMTD: number;
  completionPct: number | null;
  reshipMTD: number;
  refundMTD: number;
};

async function roster(): Promise<string[]> {
  const row = await prisma.systemSetting.findUnique({ where: { key: 'staff_roster' } });
  if (!row) return [];
  try {
    const v = JSON.parse(row.value) as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** 售前：日销表各店 sales 之和（本月累计至业务日） */
async function presaleSumByStaff(from: string, to: string): Promise<Map<string, number>> {
  const rows = await prisma.dailySales.groupBy({
    by: ['staff'],
    where: { date: { gte: from, lte: to } },
    _sum: { sales: true },
  });
  return new Map(rows.map((r) => [r.staff, Number(r._sum.sales ?? 0)]));
}

async function supplementSumByStaff(
  from: string,
  to: string,
): Promise<Map<string, { aftersale: number; reship: number; refund: number }>> {
  const rows = await prisma.staffDailyBoardSupplement.findMany({
    where: { date: { gte: from, lte: to } },
  });
  const m = new Map<string, { aftersale: number; reship: number; refund: number }>();
  for (const x of rows) {
    const cur = m.get(x.staff) ?? { aftersale: 0, reship: 0, refund: 0 };
    cur.aftersale += x.aftersaleSales;
    cur.reship += x.afterReshipAmount;
    cur.refund += x.afterRefundAmount;
    m.set(x.staff, cur);
  }
  return m;
}

export async function GET(req: Request) {
  const date = new URL(req.url).searchParams.get('date') || new Date().toISOString().slice(0, 10);
  const ym = yearMonthFromDate(date);
  const m0 = monthStartDate(ym);
  const yday = addCalendarDays(date, -1);

  const [rosterList, targets, salesStaffRows, supStaffRows, mtdPresaleMap, yPresaleMap, supMtdMap, offlineYRows] =
    await Promise.all([
      roster(),
      prisma.staffSalesBoardTarget.findMany({ where: { yearMonth: ym } }),
      prisma.dailySales.findMany({
        where: { date: { gte: m0, lte: date } },
        distinct: ['staff'],
        select: { staff: true },
      }),
      prisma.staffDailyBoardSupplement.findMany({
        where: { date: { gte: m0, lte: date } },
        distinct: ['staff'],
        select: { staff: true },
      }),
      presaleSumByStaff(m0, date),
      presaleSumByStaff(yday, yday),
      supplementSumByStaff(m0, date),
      prisma.staffDailyBoardSupplement.findMany({ where: { date: yday }, select: { staff: true, presaleOffline: true } }),
    ]);

  const offlineYMap = new Map(offlineYRows.map((r) => [r.staff, r.presaleOffline]));

  const staffSet = new Set<string>([...rosterList]);
  for (const t of targets) staffSet.add(t.staff);
  for (const { staff } of salesStaffRows) staffSet.add(staff);
  for (const { staff } of supStaffRows) staffSet.add(staff);

  const targetByStaff = new Map(targets.map((t) => [t.staff, t]));

  const presaleRows: PresaleBoardRow[] = [];
  const aftersaleRows: AftersaleBoardRow[] = [];

  const staffSorted = [...staffSet].filter(Boolean).sort((a, b) => a.localeCompare(b, 'zh-CN'));

  for (const staff of staffSorted) {
    const tgt = targetByStaff.get(staff);
    const presaleTarget = tgt?.presaleTarget ?? 0;
    const aftersaleTarget = tgt?.aftersaleTarget ?? 0;

    const salesMTD = mtdPresaleMap.get(staff) ?? 0;
    const yesterdayPresale = yPresaleMap.get(staff) ?? 0;
    const yesterdayOffline = offlineYMap.get(staff) ?? 0;

    presaleRows.push({
      staff,
      presaleTarget,
      salesMTD,
      completionPct: completionPct(salesMTD, presaleTarget),
      yesterdayPresale,
      yesterdayOffline,
    });

    const supAgg = supMtdMap.get(staff) ?? { aftersale: 0, reship: 0, refund: 0 };
    aftersaleRows.push({
      staff,
      aftersaleTarget,
      salesMTD: supAgg.aftersale,
      completionPct: completionPct(supAgg.aftersale, aftersaleTarget),
      reshipMTD: supAgg.reship,
      refundMTD: supAgg.refund,
    });
  }

  const presaleTotals = presaleRows.reduce(
    (a, r) => ({
      target: a.target + r.presaleTarget,
      salesMTD: a.salesMTD + r.salesMTD,
    }),
    { target: 0, salesMTD: 0 },
  );

  const aftersaleVisible = aftersaleRows.filter(
    (r) =>
      r.aftersaleTarget > 0 || r.salesMTD > 0 || r.reshipMTD > 0 || r.refundMTD > 0,
  );

  const afterTotals = aftersaleVisible.reduce(
    (a, r) => ({
      target: a.target + r.aftersaleTarget,
      salesMTD: a.salesMTD + r.salesMTD,
      reship: a.reship + r.reshipMTD,
      refund: a.refund + r.refundMTD,
    }),
    { target: 0, salesMTD: 0, reship: 0, refund: 0 },
  );

  return NextResponse.json({
    date,
    yearMonth: ym,
    monthRange: { from: m0, to: date },
    yesterday: yday,
    presale: {
      rows: presaleRows,
      totals: {
        presaleTarget: presaleTotals.target,
        salesMTD: presaleTotals.salesMTD,
        completionPct: completionPct(presaleTotals.salesMTD, presaleTotals.target),
      },
    },
    aftersale: {
      rows: aftersaleVisible,
      totals: {
        aftersaleTarget: afterTotals.target,
        salesMTD: afterTotals.salesMTD,
        completionPct: completionPct(afterTotals.salesMTD, afterTotals.target),
        reshipMTD: afterTotals.reship,
        refundMTD: afterTotals.refund,
      },
    },
  });
}

/** 管理员/主管维护月度指标或每日补充字段 */
export async function POST(req: Request) {
  const session = getSession();
  if (!session || !['admin', 'manager'].includes(session.role)) {
    return NextResponse.json({ ok: false, error: '无权限' }, { status: 403 });
  }

  const body = (await req.json()) as Record<string, unknown>;
  const kind = String(body.kind || '');

  if (kind === 'target') {
    const yearMonth = String(body.yearMonth || '').trim();
    const staff = String(body.staff || '').trim();
    if (!/^\d{4}-\d{2}$/.test(yearMonth) || !staff) {
      return NextResponse.json({ ok: false, error: 'yearMonth、staff 必填' }, { status: 400 });
    }
    const presaleTarget = Number(body.presaleTarget ?? 0);
    const aftersaleTarget = Number(body.aftersaleTarget ?? 0);
    await prisma.staffSalesBoardTarget.upsert({
      where: { yearMonth_staff: { yearMonth, staff } },
      update: { presaleTarget, aftersaleTarget },
      create: { yearMonth, staff, presaleTarget, aftersaleTarget },
    });
    return NextResponse.json({ ok: true });
  }

  if (kind === 'supplement') {
    const date = String(body.date || '').trim();
    const staff = String(body.staff || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !staff) {
      return NextResponse.json({ ok: false, error: 'date、staff 必填' }, { status: 400 });
    }
    const presaleOffline = body.presaleOffline != null ? Number(body.presaleOffline) : undefined;
    const aftersaleSales = body.aftersaleSales != null ? Number(body.aftersaleSales) : undefined;
    const afterReshipAmount = body.afterReshipAmount != null ? Number(body.afterReshipAmount) : undefined;
    const afterRefundAmount = body.afterRefundAmount != null ? Number(body.afterRefundAmount) : undefined;

    await prisma.staffDailyBoardSupplement.upsert({
      where: { date_staff: { date, staff } },
      create: {
        date,
        staff,
        presaleOffline: presaleOffline ?? 0,
        aftersaleSales: aftersaleSales ?? 0,
        afterReshipAmount: afterReshipAmount ?? 0,
        afterRefundAmount: afterRefundAmount ?? 0,
      },
      update: {
        ...(presaleOffline !== undefined ? { presaleOffline } : {}),
        ...(aftersaleSales !== undefined ? { aftersaleSales } : {}),
        ...(afterReshipAmount !== undefined ? { afterReshipAmount } : {}),
        ...(afterRefundAmount !== undefined ? { afterRefundAmount } : {}),
      },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: 'kind 须为 target 或 supplement' }, { status: 400 });
}
