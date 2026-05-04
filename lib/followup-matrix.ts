import type { FollowupLog, Lead } from '@prisma/client';

export type AttemptCell = {
  attemptNo: number;
  followedAt: string | null;
  /** 电联摘要：日期 + 方式 */
  callSummary: string;
  screenshot: string | null;
  /** 状态 / 未购买原因（含状态备注） */
  statusReason: string;
  statusNote: string | null;
  isDeal: boolean;
  dealAmount: number | null;
};

export type FollowupMatrixRow = {
  buyerId: string;
  shop: string;
  staff: string;
  purchaseIntent: string;
  customerCategory: string;
  attempts: [AttemptCell | null, AttemptCell | null, AttemptCell | null, AttemptCell | null];
};

function formatChannel(l: Pick<FollowupLog, 'channel' | 'channelNote'>) {
  if (l.channel === '自定义' || l.channel === '其他') {
    return l.channelNote ? `${l.channel}（${l.channelNote}）` : l.channel;
  }
  return l.channel;
}

function logToCell(l: FollowupLog): AttemptCell {
  const when = l.followedAt ?? l.createdAt;
  const dateStr = new Date(when).toLocaleString('zh-CN');
  const callSummary = `${dateStr} · ${formatChannel(l)}`;
  const statusReason = [
    l.status ? `状态：${l.status}` : null,
    !l.isDeal && l.lostReason ? `未购原因：${l.lostReason}` : null,
    l.isDeal ? `已成交${l.dealAmount != null ? ` ¥${l.dealAmount}` : ''}` : null,
  ]
    .filter(Boolean)
    .join('；') || '—';
  return {
    attemptNo: l.attemptNo,
    followedAt: l.followedAt ? l.followedAt.toISOString() : null,
    callSummary,
    screenshot: l.screenshot,
    statusReason: statusReason || '—',
    statusNote: l.statusNote,
    isDeal: l.isDeal,
    dealAmount: l.dealAmount,
  };
}

/** 同一旺旺、同一轮次取最近一条 */
export function buildFollowupMatrix(logs: FollowupLog[], leads: Lead[]): FollowupMatrixRow[] {
  const byBuyer = new Map<string, FollowupLog[]>();
  for (const l of logs) {
    if (!byBuyer.has(l.buyerId)) byBuyer.set(l.buyerId, []);
    byBuyer.get(l.buyerId)!.push(l);
  }

  const leadByBuyer = new Map<string, Lead>();
  const sortedLeads = [...leads].sort((a, b) => b.id - a.id);
  for (const lead of sortedLeads) {
    if (!leadByBuyer.has(lead.buyerId)) leadByBuyer.set(lead.buyerId, lead);
  }

  const rows: FollowupMatrixRow[] = [];

  for (const [buyerId, list] of byBuyer) {
    list.sort((a, b) => {
      const ta = new Date(a.followedAt ?? a.createdAt).getTime();
      const tb = new Date(b.followedAt ?? b.createdAt).getTime();
      return tb - ta;
    });

    const latest = list[0];
    const shop = latest?.shop ?? '';
    const staff = latest?.staff ?? '';

    const intentFromLog = list.find((x) => x.purchaseIntent?.trim())?.purchaseIntent?.trim();
    const lead = leadByBuyer.get(buyerId);
    const intentFromLead =
      lead && (lead.intentLevel != null || lead.tier)
        ? [lead.intentLevel != null ? `意向${lead.intentLevel}` : null, lead.tier || null].filter(Boolean).join(' · ')
        : '';
    const purchaseIntent = intentFromLog || intentFromLead || '—';

    const catFromLog = list.find((x) => x.customerCategory?.trim())?.customerCategory?.trim();
    const catFromLead = lead?.customerType || '';
    const customerCategory = catFromLog || catFromLead || '—';

    const attempts: FollowupMatrixRow['attempts'] = [null, null, null, null];
    for (let n = 1; n <= 4; n++) {
      const subset = list.filter((x) => x.attemptNo === n);
      const pick = subset.sort((a, b) => {
        const ta = new Date(a.followedAt ?? a.createdAt).getTime();
        const tb = new Date(b.followedAt ?? b.createdAt).getTime();
        return tb - ta;
      })[0];
      if (pick) attempts[n - 1] = logToCell(pick);
    }

    rows.push({ buyerId, shop, staff, purchaseIntent, customerCategory, attempts });
  }

  rows.sort((a, b) => a.buyerId.localeCompare(b.buyerId, 'zh-CN'));
  return rows;
}
