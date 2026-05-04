import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { mirrorFollowupLogToCustomerRecord } from '@/lib/followup-sync';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

const CHANNELS = ['电话', '微信', '其他', '自定义'] as const;

async function saveScreenshot(file: File): Promise<string> {
  const bytes = Buffer.from(await file.arrayBuffer());
  const dir = path.join(process.cwd(), 'public', 'uploads', 'followup');
  await mkdir(dir, { recursive: true });
  const filename = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
  await writeFile(path.join(dir, filename), bytes);
  return `/uploads/followup/${filename}`;
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const date = sp.get('date') || '';
  const since = sp.get('since') || '';
  const buyerId = sp.get('buyerId') || '';
  const session = getSession();
  const where: Record<string, unknown> = {};
  if (date) where.date = date;
  if (buyerId.trim()) where.buyerId = buyerId.trim();
  if (since?.trim()) {
    const d = new Date(since.trim());
    if (!Number.isNaN(d.getTime())) {
      where.followedAt = { gte: d };
    }
  }
  if (session && !['admin', 'manager'].includes(session.role)) where.staff = session.name;
  const rows = await prisma.followupLog.findMany({
    where,
    orderBy: [{ followedAt: 'desc' }, { id: 'desc' }],
    take: 800,
  });
  return NextResponse.json(rows);
}

function parseBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (v === 'true' || v === '1' || v === 1) return true;
  if (v === 'false' || v === '0' || v === 0) return false;
  return false;
}

export async function POST(req: Request) {
  const session = getSession();
  const ct = req.headers.get('content-type') || '';
  let screenshotPath: string | null = null;

  let b: Record<string, unknown>;

  if (ct.includes('multipart/form-data')) {
    const form = await req.formData();
    const file = form.get('file');
    if (file && typeof file !== 'string' && 'arrayBuffer' in file && (file as File).size > 0) {
      screenshotPath = await saveScreenshot(file as File);
    }
    const get = (k: string) => form.get(k);
    b = {
      date: String(get('date') || ''),
      staff: String(get('staff') || ''),
      shop: String(get('shop') || ''),
      buyerId: String(get('buyerId') || ''),
      followedAt: get('followedAt') ? String(get('followedAt')) : undefined,
      channel: String(get('channel') || '微信'),
      channelNote: get('channelNote') ? String(get('channelNote')) : '',
      attemptNo: Number(get('attemptNo') || 1),
      status: String(get('status') || ''),
      statusNote: get('statusNote') ? String(get('statusNote')) : '',
      isDeal: parseBool(get('isDeal')),
      dealAmount: get('dealAmount') ? String(get('dealAmount')) : '',
      lostReason: get('lostReason') ? String(get('lostReason')) : '',
      nextAction: get('nextAction') ? String(get('nextAction')) : '',
      purchaseIntent: get('purchaseIntent') ? String(get('purchaseIntent')) : '',
      customerCategory: get('customerCategory') ? String(get('customerCategory')) : '',
    };
  } else {
    b = (await req.json()) as Record<string, unknown>;
    if (typeof b.screenshot === 'string' && b.screenshot.trim()) screenshotPath = b.screenshot.trim();
  }

  if (!String(b.buyerId || '').trim()) return new NextResponse('旺旺名字/ID必填', { status: 400 });
  const isDeal = !!b.isDeal;
  if (isDeal && !b.dealAmount) return new NextResponse('成交=是时，成交金额必填', { status: 400 });
  if (!isDeal && !String(b.lostReason || '').trim()) return new NextResponse('未成交时，未成交原因必填', { status: 400 });

  const channel = CHANNELS.includes(b.channel as any) ? (b.channel as string) : '微信';
  if (channel === '自定义' && !String(b.channelNote || '').trim()) {
    return new NextResponse('选择「自定义」时请填写跟进方式说明', { status: 400 });
  }

  const staff =
    session && !['admin', 'manager'].includes(session.role) ? session.name : String(b.staff || '');
  const attemptRaw = Number(b.attemptNo);
  const attemptNo = [1, 2, 3, 4].includes(attemptRaw) ? attemptRaw : 1;
  const followedAt = b.followedAt ? new Date(String(b.followedAt)) : new Date();
  if (Number.isNaN(followedAt.getTime())) return new NextResponse('跟进日期无效', { status: 400 });

  const purchaseIntent = String(b.purchaseIntent || '').trim() || null;
  const customerCategory = String(b.customerCategory || '').trim() || null;

  const created = await prisma.followupLog.create({
    data: {
      date: String(b.date),
      staff,
      shop: String(b.shop || ''),
      buyerId: String(b.buyerId).trim(),
      status: String(b.status || ''),
      statusNote: b.statusNote ? String(b.statusNote) : null,
      isDeal,
      dealAmount: isDeal && b.dealAmount != null && b.dealAmount !== '' ? Number(b.dealAmount) : null,
      lostReason: !isDeal && b.lostReason ? String(b.lostReason) : null,
      nextAction: b.nextAction ? String(b.nextAction) : null,
      channel,
      channelNote:
        channel === '其他' || channel === '自定义'
          ? b.channelNote
            ? String(b.channelNote).trim() || null
            : null
          : null,
      attemptNo,
      followedAt,
      purchaseIntent,
      customerCategory,
      screenshot: screenshotPath,
    },
  });

  await prisma.dailyActivity.upsert({
    where: { date_staff: { date: String(b.date), staff } },
    update: {
      followupsAdded: { increment: 1 },
      dealsAdded: { increment: isDeal ? 1 : 0 },
      dealAmountAdded: { increment: isDeal ? Number(b.dealAmount || 0) : 0 },
      lastSubmitAt: new Date(),
    },
    create: {
      date: String(b.date),
      staff,
      followupsAdded: 1,
      dealsAdded: isDeal ? 1 : 0,
      dealAmountAdded: isDeal ? Number(b.dealAmount || 0) : 0,
    },
  });

  try {
    await mirrorFollowupLogToCustomerRecord(created.id);
  } catch {
    /* ignore */
  }

  return NextResponse.json(created);
}
