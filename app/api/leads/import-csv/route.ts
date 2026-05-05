import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { parseLeadFollowupCsv, type LeadFollowupCsvRow } from '@/lib/lead-followup-csv';
import { mirrorFollowupLogToCustomerRecord } from '@/lib/followup-sync';

const MAX_BYTES = 25 * 1024 * 1024;
const PREVIEW_CAP = 40;
const OR_CHUNK = 80;

function leadKey(p: { date: string; buyerId: string; shop: string }) {
  return JSON.stringify([p.date, p.buyerId, p.shop]);
}

function logKey(p: { date: string; buyerId: string; staff: string; attemptNo: number }) {
  return JSON.stringify([p.date, p.buyerId, p.staff, p.attemptNo]);
}

function followedAtFromDate(dateStr: string): Date {
  const d = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const t = new Date(`${d}T12:00:00`);
    if (!Number.isNaN(t.getTime())) return t;
  }
  return new Date();
}

function dealAmountForLog(isDeal: boolean, raw: number | null): number | null {
  if (!isDeal) return null;
  if (raw == null || Number.isNaN(raw) || !Number.isFinite(raw)) return 0;
  return raw;
}

function finiteDealIncrement(amount: number | null): number {
  const n = Number(amount ?? 0);
  return Number.isFinite(n) ? n : 0;
}

async function fetchExistingLeadKeys(
  tuples: { date: string; buyerId: string; shop: string }[],
): Promise<Set<string>> {
  const uniq = new Map<string, { date: string; buyerId: string; shop: string }>();
  for (const t of tuples) {
    const k = leadKey(t);
    if (!uniq.has(k)) uniq.set(k, t);
  }
  const list = [...uniq.values()];
  const found = new Set<string>();
  for (let i = 0; i < list.length; i += OR_CHUNK) {
    const chunk = list.slice(i, i + OR_CHUNK);
    const rows = await prisma.lead.findMany({
      where: { OR: chunk.map((p) => ({ date: p.date, buyerId: p.buyerId, shop: p.shop })) },
      select: { date: true, buyerId: true, shop: true },
    });
    for (const r of rows) found.add(leadKey(r));
  }
  return found;
}

async function fetchExistingLogKeys(
  tuples: { date: string; buyerId: string; staff: string; attemptNo: number }[],
): Promise<Set<string>> {
  const uniq = new Map<string, { date: string; buyerId: string; staff: string; attemptNo: number }>();
  for (const t of tuples) {
    const k = logKey(t);
    if (!uniq.has(k)) uniq.set(k, t);
  }
  const list = [...uniq.values()];
  const found = new Set<string>();
  for (let i = 0; i < list.length; i += OR_CHUNK) {
    const chunk = list.slice(i, i + OR_CHUNK);
    /**
     * 仅用 date+buyerId+staff 命中记录（不在 OR 里写 attemptNo），兼容旧 Prisma Client /
     * 迁移未执行环境；导入仅创建首条跟进 attemptNo=1，按三元组去重即可。
     */
    let rows: { date: string; buyerId: string; staff: string; attemptNo?: number | null }[];
    try {
      rows = await prisma.followupLog.findMany({
        where: {
          OR: chunk.map((p) => ({
            date: p.date,
            buyerId: p.buyerId,
            staff: p.staff,
          })),
        },
        select: { date: true, buyerId: true, staff: true, attemptNo: true },
      });
    } catch {
      rows = await prisma.followupLog.findMany({
        where: {
          OR: chunk.map((p) => ({
            date: p.date,
            buyerId: p.buyerId,
            staff: p.staff,
          })),
        },
        select: { date: true, buyerId: true, staff: true },
      });
    }
    for (const r of rows) {
      const no = typeof r.attemptNo === 'number' ? r.attemptNo : 1;
      found.add(logKey({ date: r.date, buyerId: r.buyerId, staff: r.staff, attemptNo: no }));
    }
  }
  return found;
}

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
    return NextResponse.json({ ok: false, errors: ['文件过大（上限 25MB）'] }, { status: 400 });
  }

  let text: string;
  try {
    text = await blob.text();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, errors: [`读取文件失败：${msg}`] }, { status: 400 });
  }

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

  type ProcessItem = { row: LeadFollowupCsvRow; model: string };
  const processable: ProcessItem[] = [];

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
    processable.push({ row, model });
  }

  let existingLeads: Set<string>;
  let existingLogs: Set<string>;
  try {
    existingLeads = await fetchExistingLeadKeys(
      processable.map((p) => ({ date: p.row.date, buyerId: p.row.buyerId, shop: p.row.shop })),
    );
    existingLogs = await fetchExistingLogKeys(
      processable.map((p) => ({
        date: p.row.date,
        buyerId: p.row.buyerId,
        staff: p.row.staff,
        attemptNo: 1,
      })),
    );
  } catch (e) {
    console.error('[import-csv] preload', e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, errors: [`预加载已有数据失败：${msg}`] }, { status: 500 });
  }

  try {
    for (const { row, model } of processable) {
      const lk = leadKey({ date: row.date, buyerId: row.buyerId, shop: row.shop });

      if (!existingLeads.has(lk)) {
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
        existingLeads.add(lk);
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

      const lgk = logKey({ date: row.date, buyerId: row.buyerId, staff: row.staff, attemptNo: 1 });

      if (!existingLogs.has(lgk)) {
        const isDeal = row.isDeal;
        const dealAmount = dealAmountForLog(isDeal, row.dealAmount);
        const lostReason = isDeal ? null : (row.lostReason?.trim() || '未成交');
        const amtInc = isDeal ? finiteDealIncrement(dealAmount) : 0;

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
            followedAt: followedAtFromDate(row.date),
            purchaseIntent: row.purchaseIntent?.trim() || null,
            customerCategory: row.customerCategory?.trim() || null,
            screenshot: null,
          },
        });
        existingLogs.add(lgk);
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
            dealAmountAdded: { increment: amtInc },
            lastSubmitAt: new Date(),
          },
          create: {
            date: row.date,
            staff: row.staff,
            followupsAdded: 1,
            dealsAdded: isDeal ? 1 : 0,
            dealAmountAdded: amtInc,
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
  } catch (e) {
    console.error('[import-csv] loop', e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, errors: [`导入写入失败：${msg}`] }, { status: 500 });
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
