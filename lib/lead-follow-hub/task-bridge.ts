import type { DailyPackageTaskStatus, DailyTaskInstance, DailyWorkPackage } from '@/lib/daily-work-package/types';
import { loadDailyInquiryReports, loadDouyinLeadFollowRecords, loadLeadFollowRecords, isoNow } from './storage';

const DOUYIN_TEMPLATE_DESC = '登记抖音留资客户及是否已电联、结果与下次跟进。';

function formHasDailySales(fd: Record<string, unknown>): boolean {
  if (fd.dailySalesAcknowledged === true) return true;
  return (
    String(fd.todaySales ?? '').trim() !== '' ||
    String(fd.todayOrders ?? '').trim() !== '' ||
    String(fd.todayInquiries ?? '').trim() !== ''
  );
}

function formHasReceipt(fd: Record<string, unknown>): boolean {
  return String(fd.personalSales ?? '').trim() !== '' || String(fd.inquiryCount ?? '').trim() !== '';
}

function formHasDouyin(fd: Record<string, unknown>): boolean {
  const leads = fd.douyinLeads as unknown[] | undefined;
  if (Array.isArray(leads) && leads.length > 0) return true;
  return String(fd.douyinLeadName ?? '').trim() !== '' && String(fd.douyinCalled ?? '') !== '';
}

function patchDailySalesTask(t: DailyTaskInstance, hasLsRow: boolean): DailyTaskInstance {
  if (t.status === 'pending_review' || t.status === 'rejected') return t;
  const fd = { ...t.formData };
  if (hasLsRow) {
    fd.leadHubFromDailyInquiry = true;
    return { ...t, status: 'completed', formData: fd, updatedAt: isoNow() };
  }
  if (fd.leadHubFromDailyInquiry) {
    delete fd.leadHubFromDailyInquiry;
    const still = formHasDailySales(fd);
    const nextStatus: DailyPackageTaskStatus = !still && t.status === 'completed' ? 'incomplete' : t.status;
    return { ...t, status: nextStatus, formData: fd, updatedAt: isoNow() };
  }
  return t;
}

function patchPresaleTask(t: DailyTaskInstance, hasLsLead: boolean): DailyTaskInstance {
  if (t.status === 'pending_review' || t.status === 'rejected') return t;
  const fd = { ...t.formData };
  if (hasLsLead) {
    fd.leadHubFromLeadFollow = true;
    return { ...t, status: 'completed', formData: fd, updatedAt: isoNow() };
  }
  if (fd.leadHubFromLeadFollow) {
    delete fd.leadHubFromLeadFollow;
    const still = formHasReceipt(fd);
    const nextStatus: DailyPackageTaskStatus = !still && t.status === 'completed' ? 'incomplete' : t.status;
    return { ...t, status: nextStatus, formData: fd, updatedAt: isoNow() };
  }
  return t;
}

function patchDouyinTask(t: DailyTaskInstance, dyRows: { hasCalled: boolean }[]): DailyTaskInstance {
  if (t.status === 'pending_review' || t.status === 'rejected') return t;
  const fd = { ...t.formData };
  if (dyRows.length === 0) {
    if (fd.leadHubDouyinOk) {
      delete fd.leadHubDouyinOk;
      delete fd.leadHubDouyinPending;
    }
    const still = formHasDouyin(fd);
    const nextStatus: DailyPackageTaskStatus = !still && t.status === 'completed' ? 'incomplete' : t.status;
    return {
      ...t,
      status: nextStatus,
      description: DOUYIN_TEMPLATE_DESC,
      formData: fd,
      updatedAt: isoNow(),
    };
  }
  const pending = dyRows.filter((d) => !d.hasCalled).length;
  const ok = pending === 0;
  if (ok) {
    fd.leadHubDouyinOk = true;
    delete fd.leadHubDouyinPending;
    return {
      ...t,
      status: 'completed',
      description: DOUYIN_TEMPLATE_DESC,
      formData: fd,
      updatedAt: isoNow(),
    };
  }
  fd.leadHubDouyinOk = false;
  fd.leadHubDouyinPending = pending;
  const nextStatus: DailyPackageTaskStatus = t.status === 'completed' ? 'incomplete' : 'in_progress';
  return {
    ...t,
    status: nextStatus,
    description: `${DOUYIN_TEMPLATE_DESC}（提醒：今日 ${pending} 条抖音留资尚未标记已电联）`,
    formData: fd,
    updatedAt: isoNow(),
  };
}

/** 与 LocalStorage 留资工作台联动：自动勾选日报 / 留资回执 / 抖音任务完成态 */
export function mergeLeadFollowHubIntoPackage(pkg: DailyWorkPackage): DailyWorkPackage {
  const date = pkg.date;
  const staff = pkg.employeeName;
  const reports = loadDailyInquiryReports().filter((r) => r.date === date && r.employeeName === staff);
  const leads = loadLeadFollowRecords().filter((l) => l.date === date && l.employeeName === staff);
  const dyRows = loadDouyinLeadFollowRecords().filter((d) => d.date === date && d.employeeName === staff);

  const hasDailyInquiry = reports.length > 0;
  const hasLeadFollow = leads.length > 0;

  const dailyTasks = pkg.dailyTasks.map((t) => {
    if (t.taskKey === 'daily_sales_report') return patchDailySalesTask(t, hasDailyInquiry);
    if (t.taskKey === 'presale_daily_receipt') return patchPresaleTask(t, hasLeadFollow);
    if (t.taskKey === 'douyin_leads_follow') return patchDouyinTask(t, dyRows);
    return t;
  });

  return { ...pkg, dailyTasks };
}
