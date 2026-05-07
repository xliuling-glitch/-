import type { RelatedModule } from './types';

export const RELATED_MODULE_LABELS: Record<RelatedModule, string> = {
  none: '—',
  lead_follow_douyin: '留资跟进 · 抖音电联',
  lead_follow_detail: '留资跟进 · 明细',
  lead_follow_no_deal: '留资跟进 · 未成交反思',
  tasks_package: '今日工作包',
  kpi_daily: 'KPI每日上传',
  reviews: '评价管理',
  old_crm: '老客户CRM',
  competitor_weekly: '本周竞品聊天',
  calls_manage: '电联管理',
};

export type RelatedModuleHrefOptions = {
  /** 与今日任务等业务日对齐，打开留资跟进表时同步顶部「业务日期」 */
  businessDate?: string;
  /** 打开「抖音留资电联跟踪」时自动插入一条可编辑空白行（URL 带 add=1，落地后消费掉） */
  draftDouyinRow?: boolean;
};

export function leadFollowQuery(tab: string, opts?: { date?: string; add?: '1' }) {
  const u = new URLSearchParams();
  u.set('tab', tab);
  if (opts?.date && /^\d{4}-\d{2}-\d{2}$/.test(opts.date)) u.set('date', opts.date);
  if (opts?.add) u.set('add', opts.add);
  return `/dashboard/lead-follow?${u.toString()}`;
}

/** 跳转填写：目标路径 */
export function relatedModuleHref(m: RelatedModule, hrefOpts?: RelatedModuleHrefOptions): string | null {
  const d = hrefOpts?.businessDate;
  const dateOk = d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined;
  const douyinQs =
    hrefOpts?.draftDouyinRow
      ? dateOk
        ? { date: dateOk, add: '1' as const }
        : { add: '1' as const }
      : dateOk
        ? { date: dateOk }
        : undefined;

  const map: Record<RelatedModule, string | null> = {
    none: null,
    lead_follow_douyin: leadFollowQuery('douyin', douyinQs),
    lead_follow_detail: leadFollowQuery('detail', dateOk ? { date: dateOk } : undefined),
    lead_follow_no_deal: leadFollowQuery('no-deal', dateOk ? { date: dateOk } : undefined),
    tasks_package: '/dashboard/tasks',
    kpi_daily: '/dashboard/kpi-daily',
    reviews: '/dashboard/reviews',
    old_crm: '/dashboard/old-customer-crm',
    competitor_weekly: '/dashboard/tasks',
    calls_manage: '/dashboard/calls',
  };
  return map[m] ?? null;
}
