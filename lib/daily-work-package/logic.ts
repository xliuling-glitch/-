import type {
  CallFollowRecord,
  CompetitorChatRecord,
  DailyPackageTaskStatus,
  DailyTaskInstance,
  DailyWorkPackage,
  ReviewRegisterRecord,
  WeeklyTaskInstance,
} from './types';
import { getWeekRange } from './storage';

export function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function isPastBusinessDay(taskDate: string): boolean {
  return taskDate < todayYmd();
}

/** 电联任务：按当日记录数 */
export function countCallsForStaff(calls: CallFollowRecord[], date: string, staff: string): number {
  return calls.filter((c) => c.date === date && c.staffName === staff).length;
}

/** 评价登记：当日条数（可选：只统计已填店铺） */
export function countReviewsForStaff(reviews: ReviewRegisterRecord[], date: string, staff: string): number {
  return reviews.filter((r) => r.date === date && r.staffName === staff).length;
}

export function applyWeeklyProgress(
  pkg: DailyWorkPackage,
  rows: CompetitorChatRecord[],
): DailyWorkPackage {
  const { start, end } = getWeekRange(pkg.date);
  const weeklyTasks = pkg.weeklyTasks.map((w) => {
    if (w.weekStartDate !== start) return w;
    const prog = competitorProgress(rows, start, end, pkg.employeeName);
    const requiredCategories = w.requiredCategories.map((c) => ({
      ...c,
      done: (prog.byDir[c.key] ?? 0) >= c.minCount,
    }));
    const status: DailyPackageTaskStatus = prog.weeklyDone
      ? 'completed'
      : prog.shopCount > 0
        ? 'in_progress'
        : 'incomplete';
    return {
      ...w,
      weekEndDate: end,
      completedCount: prog.shopCount,
      requiredCategories,
      status,
    };
  });
  return { ...pkg, weeklyTasks };
}

export function competitorProgress(
  rows: CompetitorChatRecord[],
  weekStart: string,
  weekEnd: string,
  staff: string,
): {
  shopCount: number;
  byDir: Record<string, number>;
  categoriesSatisfied: boolean;
  weeklyDone: boolean;
} {
  const list = rows.filter(
    (r) => r.staffName === staff && r.weekStartDate === weekStart && r.weekEndDate === weekEnd && r.done,
  );
  const shops = new Set(list.map((r) => r.shopName.trim()).filter(Boolean));
  const dirs = ['单室真空机', '双室真空机', '封箱机'];
  const byDir: Record<string, number> = Object.fromEntries(dirs.map((d) => [d, 0]));
  for (const r of list) {
    if (r.productDirection in byDir) {
      byDir[r.productDirection] = (byDir[r.productDirection] ?? 0) + 1;
    }
  }
  const categoriesSatisfied = dirs.every((d) => (byDir[d] ?? 0) >= 1);
  const weeklyDone = shops.size >= 3 && categoriesSatisfied;
  return { shopCount: shops.size, byDir, categoriesSatisfied, weeklyDone };
}

function effectiveCompletedCount(
  task: DailyTaskInstance,
  opts: { calls: number; reviews: number },
): number {
  if (task.taskKey === 'calls_three') return opts.calls;
  if (task.taskKey === 'review_register') return Math.max(task.completedCount, opts.reviews > 0 ? 1 : 0);
  if (task.taskKey === 'crm_old_follow_daily') return task.completedCount;
  return task.completedCount;
}

function hasRequiredProof(task: DailyTaskInstance): boolean {
  if (!task.needProof) return true;
  return task.proofImages.length > 0;
}

/** 日报 / 回执等：用 formData 里关键字段判断是否填过 */
function hasDailySalesCore(fd: Record<string, unknown>): boolean {
  if (fd.leadHubFromDailyInquiry === true) return true;
  if (fd.dailySalesAcknowledged === true) return true;
  return (
    String(fd.todaySales ?? '').trim() !== '' ||
    String(fd.todayOrders ?? '').trim() !== '' ||
    String(fd.todayInquiries ?? '').trim() !== ''
  );
}

function hasReceiptCore(fd: Record<string, unknown>): boolean {
  if (fd.leadHubFromLeadFollow === true) return true;
  return String(fd.personalSales ?? '').trim() !== '' || String(fd.inquiryCount ?? '').trim() !== '';
}

function hasDataSummaryDone(fd: Record<string, unknown>): boolean {
  if (fd.dataSummaryChecked === true) return true;
  return String(fd.dataSummaryLink ?? '').trim() !== '';
}

function hasDouyinCore(fd: Record<string, unknown>): boolean {
  if (fd.leadHubDouyinOk === true) return true;
  const leads = fd.douyinLeads as unknown[] | undefined;
  if (Array.isArray(leads) && leads.length > 0) return true;
  return String(fd.douyinLeadName ?? '').trim() !== '' && String(fd.douyinCalled ?? '') !== '';
}

function hasMomentsCore(task: DailyTaskInstance): boolean {
  const t = String(task.formData.publishType ?? '').trim();
  return t.length > 0 && task.proofImages.length > 0;
}

function internalQuantitySatisfied(task: DailyTaskInstance, calls: number, reviews: number): boolean {
  const done = effectiveCompletedCount(task, { calls, reviews });
  return done >= task.targetCount;
}

export function canMarkTaskComplete(
  task: DailyTaskInstance,
  opts: { calls: number; reviews: number; reviewRows?: ReviewRegisterRecord[]; date: string; staff: string },
): { ok: boolean; reason?: string } {
  if (task.status === 'pending_review') return { ok: false, reason: '待主管审核中，请勿重复提交。' };
  if (task.status === 'completed') return { ok: false, reason: '已完成。' };
  if (task.taskKey !== 'review_register' && !hasRequiredProof(task)) return { ok: false, reason: '需上传截图后才能标记完成。' };
  if (task.taskKey === 'moments_post' && !hasMomentsCore(task)) return { ok: false, reason: '请选择发布类型并上传朋友圈截图。' };
  if (task.taskKey === 'calls_three' && !internalQuantitySatisfied(task, opts.calls, opts.reviews)) {
    return { ok: false, reason: '电联记录需至少 3 条（在「留资/电联跟进区」添加）。' };
  }
  if (task.taskKey === 'daily_sales_report' && !hasDailySalesCore(task.formData)) {
    return { ok: false, reason: '请填写日报核心字段（销售额/订单/询单等至少一项）。' };
  }
  if (task.taskKey === 'presale_daily_receipt' && !hasReceiptCore(task.formData)) {
    return { ok: false, reason: '请填写日工作回执核心字段。' };
  }
  if (task.taskKey === 'data_summary_sheet' && !hasDataSummaryDone(task.formData)) {
    return { ok: false, reason: '请填写表格链接或勾选「今日已填写」。' };
  }
  if (task.taskKey === 'douyin_leads_follow' && !hasDouyinCore(task.formData)) {
    return { ok: false, reason: '请登记至少一条抖音留资跟进。' };
  }
  if (task.taskKey === 'crm_old_follow_daily') {
    if (task.completedCount < task.targetCount) {
      return { ok: false, reason: '请先在「老客户CRM → 老客户回访任务」完成当日全部回访。' };
    }
    return { ok: true };
  }
  if (task.taskKey === 'review_register') {
    const rows = opts.reviewRows?.filter((r) => r.date === opts.date && r.staffName === opts.staff) ?? [];
    if (rows.length < 1) return { ok: false, reason: '请在「评价登记区」添加至少一条评价记录。' };
    if (task.needProof) {
      const hasShot =
        rows.some((r) => (r.screenshot?.length ?? 0) > 0) || task.proofImages.length > 0;
      if (!hasShot) return { ok: false, reason: '评价登记需上传截图（记录区或任务卡片）。' };
    }
  }
  if (!internalQuantitySatisfied(task, opts.calls, opts.reviews) && task.targetCount > 1) {
    return { ok: false, reason: `数量未达标（需 ${task.targetCount}）。` };
  }
  return { ok: true };
}

export function applyOverdueToTasks(
  tasks: DailyTaskInstance[],
  pkgDate: string,
  calls: number,
  reviews: number,
  reviewRows: ReviewRegisterRecord[],
  date: string,
  staff: string,
): DailyTaskInstance[] {
  const past = isPastBusinessDay(pkgDate);
  const dayReviews = reviewRows.filter((r) => r.date === date && r.staffName === staff);
  return tasks.map((t) => {
    if (t.status === 'completed' || t.status === 'pending_review') return t;
    if (t.status === 'rejected') return t;
    if (past) {
      const qtyOk = internalQuantitySatisfied(t, calls, reviews);
      const proofOk = t.taskKey === 'review_register' ? true : hasRequiredProof(t);
      let satisfied = qtyOk && proofOk;
      if (t.taskKey === 'moments_post') satisfied = satisfied && hasMomentsCore(t);
      if (t.taskKey === 'daily_sales_report') satisfied = satisfied && hasDailySalesCore(t.formData);
      if (t.taskKey === 'presale_daily_receipt') satisfied = satisfied && hasReceiptCore(t.formData);
      if (t.taskKey === 'data_summary_sheet') satisfied = satisfied && hasDataSummaryDone(t.formData);
      if (t.taskKey === 'douyin_leads_follow') satisfied = satisfied && hasDouyinCore(t.formData);
      if (t.taskKey === 'review_register') {
        satisfied =
          dayReviews.length >= 1 &&
          dayReviews.some((r) => (r.screenshot?.length ?? 0) > 0 || (t.proofImages?.length ?? 0) > 0);
      }
      if (t.taskKey === 'crm_old_follow_daily') {
        satisfied = t.completedCount >= t.targetCount;
      }
      if (!satisfied) return { ...t, status: 'overdue' as DailyPackageTaskStatus };
    }
    return t;
  });
}

export function computePackageRates(
  pkg: DailyWorkPackage,
  calls: number,
  reviews: number,
  weekly: WeeklyTaskInstance | undefined,
  weeklyDone: boolean,
): { completionRate: number; weeklyCompletionRate: number; total: number; done: number; overdue: number } {
  const tasks = pkg.dailyTasks;
  const total = tasks.length;
  const done = tasks.filter((x) => x.status === 'completed').length;
  const overdue = tasks.filter((x) => x.status === 'overdue').length;
  const completionRate = total ? Math.round((done / total) * 100) : 0;
  const weeklyCompletionRate = weekly ? (weeklyDone ? 100 : Math.min(100, Math.round((weekly.completedCount / Math.max(weekly.targetCount, 1)) * 100))) : 0;
  return { completionRate, weeklyCompletionRate, total, done, overdue };
}

export function syncDailyTaskCounts(
  pkg: DailyWorkPackage,
  calls: CallFollowRecord[],
  reviews: ReviewRegisterRecord[],
): DailyWorkPackage {
  const c = countCallsForStaff(calls, pkg.date, pkg.employeeName);
  const r = countReviewsForStaff(reviews, pkg.date, pkg.employeeName);
  const dailyTasks = pkg.dailyTasks.map((t) => {
    if (t.taskKey === 'calls_three') return { ...t, completedCount: c };
    if (t.taskKey === 'review_register') return { ...t, completedCount: r > 0 ? 1 : 0 };
    return t;
  });
  return { ...pkg, dailyTasks };
}

export function statusBadgeClass(status: DailyPackageTaskStatus): string {
  switch (status) {
    case 'completed':
      return 'bg-emerald-100 text-emerald-900 border-emerald-200';
    case 'in_progress':
      return 'bg-sky-100 text-sky-900 border-sky-200';
    case 'incomplete':
      return 'bg-slate-100 text-slate-600 border-slate-200';
    case 'pending_review':
      return 'bg-amber-100 text-amber-900 border-amber-200';
    case 'rejected':
    case 'overdue':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}

export function statusLabel(status: DailyPackageTaskStatus): string {
  const map: Record<DailyPackageTaskStatus, string> = {
    incomplete: '未完成',
    completed: '已完成',
    in_progress: '进行中',
    pending_review: '待审核',
    rejected: '已驳回',
    overdue: '已逾期',
  };
  return map[status] ?? status;
}
