import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { parseDailySalesCsv } from '@/lib/daily-sales-csv';

const MAX_BYTES = 12 * 1024 * 1024;
const PREVIEW_CAP = 40;

type SalesPreviewRow = {
  action: '新增' | '更新';
  date: string;
  staff: string;
  shop: string;
  reception: number;
  aftersale: number;
  invalidInquiry: number;
  presale: number;
  deals: number;
  sales: number;
};

/** 批量导入日销 CSV（模板或历史导出格式）；更新已存在同日期+客服+店铺行时不重复计入今日活动 */
export async function POST(req: Request) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ ok: false, errors: ['未登录，请先登录工作台后再导入。'] }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, errors: ['无法解析上传文件，请重试。'] }, { status: 400 });
  }
  const file = form.get('file');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ ok: false, errors: ['缺少 file 字段，请选择 CSV 文件。'] }, { status: 400 });
  }

  const blob = file as File;
  if (blob.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, errors: ['文件过大（上限 12MB）'] }, { status: 400 });
  }

  const text = await blob.text();
  const { rows, errors } = parseDailySalesCsv(text);
  if (errors.length && rows.length === 0) {
    return NextResponse.json({ ok: false, errors }, { status: 400 });
  }

  const privileged = session.role === 'admin' || session.role === 'manager';
  const rowErrors: string[] = [...errors];
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const createdPreview: SalesPreviewRow[] = [];
  const updatedPreview: SalesPreviewRow[] = [];

  const pushPreview = (list: SalesPreviewRow[], row: typeof rows[0], action: '新增' | '更新') => {
    if (list.length >= PREVIEW_CAP) return;
    list.push({
      action,
      date: row.date,
      staff: row.staff,
      shop: row.shop,
      reception: row.reception,
      aftersale: row.aftersale,
      invalidInquiry: row.invalidInquiry,
      presale: row.presale,
      deals: row.deals,
      sales: row.sales,
    });
  };

  for (const row of rows) {
    if (!privileged && row.staff !== session.name) {
      skipped++;
      rowErrors.push(`已跳过（非本人）：${row.date} ${row.staff} ${row.shop}`);
      continue;
    }

    const existing = await prisma.dailySales.findFirst({
      where: { date: row.date, staff: row.staff, shop: row.shop },
    });

    const payload = {
      reception: row.reception,
      aftersale: row.aftersale,
      invalidInquiry: row.invalidInquiry,
      presale: row.presale,
      deals: row.deals,
      sales: row.sales,
    };

    if (existing) {
      await prisma.dailySales.update({ where: { id: existing.id }, data: payload });
      updated++;
      pushPreview(updatedPreview, row, '更新');
    } else {
      await prisma.dailySales.create({
        data: { date: row.date, staff: row.staff, shop: row.shop, ...payload },
      });
      await prisma.dailyActivity.upsert({
        where: { date_staff: { date: row.date, staff: row.staff } },
        update: {
          dealsAdded: { increment: row.deals },
          dealAmountAdded: { increment: row.sales },
          lastSubmitAt: new Date(),
        },
        create: {
          date: row.date,
          staff: row.staff,
          dealsAdded: row.deals,
          dealAmountAdded: row.sales,
        },
      });
      created++;
      pushPreview(createdPreview, row, '新增');
    }
  }

  const hasMore = created > createdPreview.length || updated > updatedPreview.length;

  return NextResponse.json({
    ok: true,
    created,
    updated,
    skipped,
    totalRows: rows.length,
    errors: rowErrors.slice(0, 80),
    preview: {
      createdRows: createdPreview,
      updatedRows: updatedPreview,
      maxShown: PREVIEW_CAP,
      hasMore,
    },
  });
}
