import type { DailyInquiryReport, DouyinLeadFollowRecord, LeadConversionSettings, LeadFollowRecord } from './types';
import { loadLeadConversionSettings } from './storage';

export function isValidLead(r: LeadFollowRecord, settings?: LeadConversionSettings): boolean {
  const s = settings ?? loadLeadConversionSettings();
  if (s.strictLeadRules) {
    return Boolean(
      (r.phone && r.phone.trim()) || (r.customerWechat && r.customerWechat.trim()) || r.hasAddedWechat,
    );
  }
  return Boolean(
    (r.phone && r.phone.trim()) || (r.customerWechat && r.customerWechat.trim()) || r.hasAddedWechat,
  );
}

export function inquiryTotalForKey(
  reports: DailyInquiryReport[],
  date: string,
  store: string,
  employee: string,
): number {
  const row = reports.find((r) => r.date === date && r.storeName === store && r.employeeName === employee);
  return row ? Math.max(0, Number(row.inquiryCount) || 0) : 0;
}

export function leadCountForKey(
  leads: LeadFollowRecord[],
  date: string,
  store: string,
  employee: string,
  settings?: LeadConversionSettings,
): number {
  return leads.filter(
    (l) => l.date === date && l.storeName === store && l.employeeName === employee && isValidLead(l, settings),
  ).length;
}

export function leadRate(inquiry: number, lead: number): number {
  if (!inquiry || inquiry <= 0) return 0;
  return lead / inquiry;
}

export function aggregateByStore(
  date: string,
  reports: DailyInquiryReport[],
  leads: LeadFollowRecord[],
  settings?: LeadConversionSettings,
) {
  const keys = new Set<string>();
  reports.filter((r) => r.date === date).forEach((r) => keys.add(r.storeName));
  leads.filter((l) => l.date === date).forEach((l) => keys.add(l.storeName));
  const st = settings ?? loadLeadConversionSettings();
  return [...keys].map((store) => {
    const repRows = reports.filter((r) => r.date === date && r.storeName === store);
    const inquiry = repRows.reduce((a, r) => a + Math.max(0, Number(r.inquiryCount) || 0), 0);
    const leadN = leads.filter(
      (l) => l.date === date && l.storeName === store && isValidLead(l, st),
    ).length;
    const deals = leads.filter((l) => l.date === date && l.storeName === store && l.isDeal).length;
    const dealAmt = leads
      .filter((l) => l.date === date && l.storeName === store && l.isDeal)
      .reduce((a, l) => a + (Number(l.dealAmount) || 0), 0);
    const rate = leadRate(inquiry, leadN);
    return { store, inquiry, leadCount: leadN, rate, deals, dealAmount: dealAmt };
  });
}

export function aggregateByStaffStore(
  date: string,
  reports: DailyInquiryReport[],
  leads: LeadFollowRecord[],
  settings?: LeadConversionSettings,
) {
  const pairs = new Map<string, { employee: string; store: string }>();
  reports.filter((r) => r.date === date).forEach((r) => pairs.set(`${r.employeeName}::${r.storeName}`, { employee: r.employeeName, store: r.storeName }));
  leads.filter((l) => l.date === date).forEach((l) => pairs.set(`${l.employeeName}::${l.storeName}`, { employee: l.employeeName, store: l.storeName }));
  const st = settings ?? loadLeadConversionSettings();
  return [...pairs.values()].map(({ employee, store }) => {
    const inquiry = inquiryTotalForKey(reports, date, store, employee);
    const leadN = leadCountForKey(leads, date, store, employee, st);
    const deals = leads.filter((l) => l.date === date && l.storeName === store && l.employeeName === employee && l.isDeal).length;
    const dealAmt = leads
      .filter((l) => l.date === date && l.storeName === store && l.employeeName === employee && l.isDeal)
      .reduce((a, l) => a + (Number(l.dealAmount) || 0), 0);
    return { employee, store, inquiry, leadCount: leadN, rate: leadRate(inquiry, leadN), deals, dealAmount: dealAmt };
  });
}

export function todayOverview(
  date: string,
  reports: DailyInquiryReport[],
  leads: LeadFollowRecord[],
  douyin: DouyinLeadFollowRecord[],
  settings?: LeadConversionSettings,
) {
  const st = settings ?? loadLeadConversionSettings();
  const r0 = reports.filter((r) => r.date === date);
  const l0 = leads.filter((l) => l.date === date);
  const totalInquiry = r0.reduce((a, r) => a + Math.max(0, Number(r.inquiryCount) || 0), 0);
  const totalLeads = l0.filter((l) => isValidLead(l, st)).length;
  const avgRate = leadRate(totalInquiry, totalLeads);
  const deals = l0.filter((l) => l.isDeal).length;
  const dealAmt = l0.filter((l) => l.isDeal).reduce((a, l) => a + (Number(l.dealAmount) || 0), 0);
  const dy = douyin.filter((d) => d.date === date);
  const dyUncalled = dy.filter((d) => !d.hasCalled).length;
  const unfollow = l0.filter((l) => {
    const hasCall = [l.firstCallDate, l.secondCallDate, l.thirdCallDate, l.fourthCallDate].some((x) => String(x || '').trim());
    return !hasCall && !l.isDeal;
  }).length;
  return { totalInquiry, totalLeads, avgRate, deals, dealAmt, dyUncalled, unfollow };
}

/** 周/月：按日期范围汇总咨询量与留资 */
export function rangeDates(start: string, end: string): string[] {
  const out: string[] = [];
  const a = new Date(`${start}T12:00:00`);
  const b = new Date(`${end}T12:00:00`);
  for (let d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export function aggregateStoreRange(
  start: string,
  end: string,
  reports: DailyInquiryReport[],
  leads: LeadFollowRecord[],
  settings?: LeadConversionSettings,
) {
  const dates = rangeDates(start, end);
  const stores = new Set<string>();
  dates.forEach((date) => {
    reports.filter((r) => r.date === date).forEach((r) => stores.add(r.storeName));
    leads.filter((l) => l.date === date).forEach((l) => stores.add(l.storeName));
  });
  const st = settings ?? loadLeadConversionSettings();
  return [...stores].map((store) => {
    let inquiry = 0;
    let leadN = 0;
    let deals = 0;
    let dealAmt = 0;
    for (const date of dates) {
      const agg = aggregateByStore(date, reports, leads, st).find((x) => x.store === store);
      if (agg) {
        inquiry += agg.inquiry;
        leadN += agg.leadCount;
        deals += agg.deals;
        dealAmt += agg.dealAmount;
      }
    }
    return { store, inquiry, leadCount: leadN, rate: leadRate(inquiry, leadN), deals, dealAmount: dealAmt };
  });
}

/** 按客服+店铺汇总一段时间内的咨询量与留资（用于客服留资率统计） */
export function aggregateStaffStoreRange(
  start: string,
  end: string,
  reports: DailyInquiryReport[],
  leads: LeadFollowRecord[],
  settings?: LeadConversionSettings,
) {
  const dates = rangeDates(start, end);
  const pairs = new Map<string, { employee: string; store: string }>();
  for (const date of dates) {
    reports.filter((r) => r.date === date).forEach((r) => pairs.set(`${r.employeeName}::${r.storeName}`, { employee: r.employeeName, store: r.storeName }));
    leads.filter((l) => l.date === date).forEach((l) => pairs.set(`${l.employeeName}::${l.storeName}`, { employee: l.employeeName, store: l.storeName }));
  }
  const st = settings ?? loadLeadConversionSettings();
  return [...pairs.values()].map(({ employee, store }) => {
    let inquiry = 0;
    let leadN = 0;
    let deals = 0;
    let dealAmt = 0;
    for (const date of dates) {
      inquiry += inquiryTotalForKey(reports, date, store, employee);
      leadN += leadCountForKey(leads, date, store, employee, st);
      deals += leads.filter((l) => l.date === date && l.storeName === store && l.employeeName === employee && l.isDeal).length;
      dealAmt += leads
        .filter((l) => l.date === date && l.storeName === store && l.employeeName === employee && l.isDeal)
        .reduce((a, l) => a + (Number(l.dealAmount) || 0), 0);
    }
    return { employee, store, inquiry, leadCount: leadN, rate: leadRate(inquiry, leadN), deals, dealAmount: dealAmt };
  });
}
