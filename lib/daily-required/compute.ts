import type { DailyRequiredKey } from './types';
import { loadDailyInquiryReports, loadDouyinLeadFollowRecords, loadLeadFollowRecords } from '@/lib/lead-follow-hub/storage';
import { isValidLead } from '@/lib/lead-follow-hub/stats';
import { loadLeadConversionSettings } from '@/lib/lead-follow-hub/storage';
import { getWeekRange, loadCompetitors, loadPackages, loadReviews } from '@/lib/daily-work-package/storage';
import { competitorProgress } from '@/lib/daily-work-package/logic';

export type DailyRequiredItem = {
  key: DailyRequiredKey;
  label: string;
  done: boolean;
  hint: string;
};

export function computeDailyRequired(date: string, employeeName: string): DailyRequiredItem[] {
  const reports = loadDailyInquiryReports().filter((r) => r.date === date && r.employeeName === employeeName);
  const st = loadLeadConversionSettings();
  const leads = loadLeadFollowRecords().filter((l) => l.date === date && l.employeeName === employeeName);
  const dy = loadDouyinLeadFollowRecords().filter((d) => d.date === date && d.employeeName === employeeName);
  const pkgs = loadPackages().filter((p) => p.date === date && p.employeeName === employeeName);
  const reviews = loadReviews().filter((r) => r.date === date && r.staffName === employeeName);
  const comp = loadCompetitors();
  const week = getWeekRange(date);
  const prog = competitorProgress(comp, week.start, week.end, employeeName);

  const dailyPkg = pkgs[0];
  const dailySalesOk = dailyPkg?.dailyTasks?.some(
    (t) =>
      t.taskKey === 'daily_sales_report' &&
      (t.status === 'completed' || Boolean((t.formData as Record<string, unknown>)?.leadHubFromDailyInquiry)),
  );
  const presaleOk = dailyPkg?.dailyTasks?.some(
    (t) =>
      t.taskKey === 'presale_daily_receipt' &&
      (t.status === 'completed' || Boolean((t.formData as Record<string, unknown>)?.leadHubFromLeadFollow)),
  );
  const douyinOk = dailyPkg?.dailyTasks?.some(
    (t) =>
      t.taskKey === 'douyin_leads_follow' &&
      (t.status === 'completed' || Boolean((t.formData as Record<string, unknown>)?.leadHubDouyinOk)),
  );
  const dataSummaryOk = dailyPkg?.dailyTasks?.find((t) => t.taskKey === 'data_summary_sheet')?.status === 'completed';

  const items: DailyRequiredItem[] = [
    {
      key: 'daily_inquiry',
      label: '日报 / 询单量登记',
      done: reports.length > 0 || !!dailySalesOk,
      hint: '留资跟进表 · 日报/询单量',
    },
    {
      key: 'lead_register',
      label: '今日留资登记',
      done: leads.some((l) => isValidLead(l, st)) || !!presaleOk,
      hint: '留资跟进表 · 今日留资',
    },
    {
      key: 'review_register',
      label: '评价登记',
      done: reviews.length > 0,
      hint: '评价管理中心',
    },
    {
      key: 'douyin_call',
      label: '抖音留资电联完成',
      done: dy.length === 0 ? !!douyinOk : dy.every((d) => d.hasCalled),
      hint: '留资跟进表 · 抖音',
    },
    {
      key: 'competitor_weekly',
      label: '本周竞品聊天',
      done: prog.weeklyDone,
      hint: '今日任务中心内工作包竞品区',
    },
    {
      key: 'data_summary',
      label: '数据汇总登记表',
      done: !!dataSummaryOk,
      hint: '每日工作包 · 数据汇总任务',
    },
  ];
  return items;
}
