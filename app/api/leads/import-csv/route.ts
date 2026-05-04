import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { parseLeadFollowupCsv } from '@/lib/lead-followup-csv';
import { mirrorFollowupLogToCustomerRecord } from '@/lib/followup-sync';

const MAX_BYTES = 12 * 1024 * 1024;
const PREVIEW_CAP = 40;

/** 留资跟进表 CSV：写入 Lead + 首条 FollowupLog（与询单转化手工录入一致） */
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
  const { rows, errors } = parseLeadFollowupCsv(text);
  if (errors.length && rows.length === 0) {
    return NextResponse.json({ ok: false, errors }, { status: 400 });
  }

  const privileged = session.role === 'admin' || session.role === 'manager';
  const rowErrors: string[] = [...errors];
  let leadsCreated = 0;
  let leadsSkipped = 0;
  let logsCreated = 0;
  let logsSkipped = 0;
  let staffSkipped = 0;
  const leadsPreview: { date: string; staff: string; shop: string; buyerId: string; model: string }[] = [];
  const logsPreview: {
    date: string;
    staff: string;
    shop: string;
    buyerId: string;
    status: string;
    isDeal: boolean;
    dealAmount: number | null;
  }[] = [];

  for (const row of rows) {
    if (!privileged && row.staff !== session.name) {
      staffSkipped++;
      continue;
    }

    const model = row.model.trim() || row.inquiryType.trim();
    if (!model) {
      rowErrors.push(`跳过 ${row.buyerId}：产品型号为空`);
      continue;
    }

    const existingLead = await prisma.lead.findFirst({
      where: { date: row.date, buyerId: row.buyerId, shop: row.shop },
    });

    if (!existingLead) {
      await prisma.lead.create({
        data: {
          date: row.date,
          staff: row.staff,
          shop: row.shop,
          inquiryType: row.inquiryType,
          model,
          customerType: row.customerType,
          buyerId: row.buyerId,
          phone: row.phone || null,
          wechat: row.wechat || null,
          wechatAdded: row.wechatAdded,
          holdSent: row.holdSent,
          intentLevel: row.intentLevel,
          tier: row.customerCategory || null,
          note: row.statusNote || null,
        },
      });
      leadsCreated++;
      if (leadsPreview.length < PREVIEW_CAP) {
        leadsPreview.push({
          date: row.date,
          staff: row.staff,
          shop: row.shop,
          buyerId: row.buyerId,
          model,
        });
      }
      await prisma.dailyActivity.upsert({
        where: { date_staff: { date: row.date, staff: row.staff } },
        update: { leadsAdded: { increment: 1 }, lastSubmitAt: new Date() },
        create: { date: row.date, staff: row.staff, leadsAdded: 1 },
      });
    } else {
      leadsSkipped++;
    }

    const existingLog = await prisma.followupLog.findFirst({
      where: { date: row.date, buyerId: row.buyerId, staff: row.staff, attemptNo: 1 },
    });

    if (!existingLog) {
      const isDeal = row.isDeal;
      const dealAmount = isDeal ? (row.dealAmount ?? 0) : null;
      const lostReason = isDeal ? null : (row.lostReason?.trim() || '未成交');

      const created = await prisma.followupLog.create({
        data: {
          date: row.date,
          staff: row.staff,
          shop: row.shop,
          buyerId: row.buyerId,
          status: row.status || '待跟进',
          statusNote: row.statusNote?.trim() || null,
          isDeal,
          dealAmount,
          lostReason,
          nextAction: null,
          channel: '微信',
          channelNote: null,
          attemptNo: 1,
          followedAt: new Date(`${row.date}T12:00:00`),
          purchaseIntent: row.purchaseIntent?.trim() || null,
          customerCategory: row.customerCategory?.trim() || null,
          screenshot: null,
        },
      });
      logsCreated++;
      if (logsPreview.length < PREVIEW_CAP) {
        logsPreview.push({
          date: row.date,
          staff: row.staff,
          shop: row.shop,
          buyerId: row.buyerId,
          status: row.status || '待跟进',
          isDeal,
          dealAmount,
        });
      }
      await prisma.dailyActivity.upsert({
        where: { date_staff: { date: row.date, staff: row.staff } },
        update: {
          followupsAdded: { increment: 1 },
          dealsAdded: { increment: isDeal ? 1 : 0 },
          dealAmountAdded: { increment: isDeal ? Number(dealAmount || 0) : 0 },
          lastSubmitAt: new Date(),
        },
        create: {
          date: row.date,
          staff: row.staff,
          followupsAdded: 1,
          dealsAdded: isDeal ? 1 : 0,
          dealAmountAdded: isDeal ? Number(dealAmount || 0) : 0,
        },
      });
      try {
        await mirrorFollowupLogToCustomerRecord(created.id);
      } catch {
        /* ignore */
      }
    } else {
      logsSkipped++;
    }
  }

  const hasMore = leadsCreated > leadsPreview.length || logsCreated > logsPreview.length;

  return NextResponse.json({
    ok: true,
    leadsCreated,
    leadsSkipped,
    logsCreated,
    logsSkipped,
    staffSkipped,
    totalRows: rows.length,
    errors: rowErrors.slice(0, 80),
    preview: {
      leadsNew: leadsPreview,
      followupsNew: logsPreview,
      maxShown: PREVIEW_CAP,
      hasMore,
    },
  });
}
