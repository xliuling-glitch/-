import type { KpiDailySubmission } from '@/lib/kpi-daily/types';
import {
  callCompletionRateFrom,
  resolvedTodayLeadCount,
  validCallRateFrom,
  withDerivedMetrics,
} from '@/lib/kpi-daily/compute';
import type { TaskInstance, TodayTaskState } from '@/lib/today-tasks/types';
import { buildInstances, computeWorkflowStatus, isFullyClosed } from '@/lib/today-tasks/engine';
import { kpiSubmissionStatsForDate } from '@/lib/kpi-daily/storage';
import type {
  DashboardException,
  DashboardExceptionCategory,
  DashboardOverview,
  ExceptionHandleStatus,
  ExceptionSeverity,
  StaffTodayRow,
} from './dashboard-types';
import { EXCEPTION_CATEGORY_LABELS } from './dashboard-types';

export type DashboardBuildInput = {
  date: string;
  now: Date;
  taskState: TodayTaskState;
  kpiSubmissions: KpiDailySubmission[];
  roster: string[];
  shiftFilter: 'all' | 'day' | 'night';
  shopFilter: string;
  staffFilter: string;
  handleMap: Record<string, ExceptionHandleStatus>;
};

function matchesShift(inst: TaskInstance, shift: 'all' | 'day' | 'night'): boolean {
  if (shift === 'all') return true;
  if (shift === 'day') return inst.shiftCode === 'day' || inst.shiftCode === 'all';
  if (shift === 'night') return inst.shiftCode === 'night' || inst.shiftCode === 'all';
  return true;
}

/** 同一客服当日多条 KPI 时：优先已通过 > 待审 > 驳回 > 草稿，同优先级取最近更新 */
export function pickPrimaryKpiSubmission(
  submissions: KpiDailySubmission[],
  date: string,
  staffName: string,
): KpiDailySubmission | null {
  const cand = submissions.filter((s) => s.date === date && s.employeeName === staffName);
  if (!cand.length) return null;
  const order: Record<string, number> = { approved: 0, pending_review: 1, rejected: 2, draft: 3 };
  return [...cand].sort((a, b) => {
    const oa = order[a.auditStatus] ?? 9;
    const ob = order[b.auditStatus] ?? 9;
    if (oa !== ob) return oa - ob;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  })[0];
}

/** 主管看板「今日统计」仅用已通过 KPI */
export function pickApprovedKpiSubmission(
  submissions: KpiDailySubmission[],
  date: string,
  staffName: string,
): KpiDailySubmission | null {
  const cand = submissions.filter((s) => s.date === date && s.employeeName === staffName && s.auditStatus === 'approved');
  if (!cand.length) return null;
  return [...cand].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
}

function kpiLabelFrom(s: KpiDailySubmission | null): StaffTodayRow['kpiLabel'] {
  if (!s) return '未上传';
  if (s.auditStatus === 'draft') return '草稿';
  if (s.auditStatus === 'pending_review') return '待审';
  if (s.auditStatus === 'approved') return '已通过';
  if (s.auditStatus === 'rejected') return '已驳回';
  return '未上传';
}

function staffRowStatus(row: Pick<StaffTodayRow, 'taskRate' | 'p0Overdue' | 'kpiLabel'>): Pick<StaffTodayRow, 'statusLabel' | 'statusTone'> {
  if (row.p0Overdue) return { statusLabel: 'P0逾期预警', statusTone: 'red' };
  if (row.kpiLabel === '未上传') return { statusLabel: 'KPI未上传', statusTone: 'yellow' };
  if (row.kpiLabel === '已驳回') return { statusLabel: 'KPI已驳回', statusTone: 'red' };
  if (row.kpiLabel === '草稿') return { statusLabel: 'KPI草稿', statusTone: 'yellow' };
  const r = row.taskRate;
  if (r >= 90) return { statusLabel: '优秀', statusTone: 'green' };
  if (r >= 70) return { statusLabel: '正常', statusTone: 'blue' };
  if (r >= 50) return { statusLabel: '预警', statusTone: 'yellow' };
  return { statusLabel: '严重落后', statusTone: 'red' };
}

function mergeHandle(id: string, map: Record<string, ExceptionHandleStatus>): 'open' | 'done' | 'ignored' {
  return map[id] ?? 'open';
}

export function buildStaffRows(input: DashboardBuildInput): StaffTodayRow[] {
  const { date, now, taskState, kpiSubmissions, roster, shiftFilter, shopFilter, staffFilter } = input;
  const allInst = buildInstances(taskState, date).filter((i) => matchesShift(i, shiftFilter));
  const names = new Set<string>([...roster, ...allInst.map((i) => i.staffName)]);
  for (const s of kpiSubmissions) {
    if (s.date === date && s.employeeName) names.add(s.employeeName);
  }
  const list = [...names].filter((n) => !staffFilter.trim() || n.includes(staffFilter.trim()));
  const rows: StaffTodayRow[] = [];
  for (const staffName of list.sort((a, b) => a.localeCompare(b, 'zh-CN'))) {
    const kpi = pickPrimaryKpiSubmission(kpiSubmissions, date, staffName);
    if (shopFilter.trim() && kpi && !kpi.storeName.includes(shopFilter.trim())) continue;
    if (shopFilter.trim() && !kpi) continue;

    const insts = allInst.filter((i) => i.staffName === staffName);
    let closed = 0;
    let overdue = 0;
    let p0Overdue = false;
    for (const i of insts) {
      if (isFullyClosed(i)) closed++;
      else {
        const w = computeWorkflowStatus(i, now);
        if (w === 'overdue') {
          overdue++;
          if (i.priority === 'P0') p0Overdue = true;
        }
      }
    }
    const total = insts.length;
    const taskRate = total ? Math.round((closed / total) * 1000) / 10 : 0;
    const kpiLabel = kpiLabelFrom(kpi);
    const kpiApproved = pickApprovedKpiSubmission(kpiSubmissions, date, staffName);
    const km = kpiApproved ? withDerivedMetrics(kpiApproved) : null;
    const base: StaffTodayRow = {
      staffName,
      taskTotal: total,
      taskClosed: closed,
      taskOverdue: overdue,
      taskRate,
      kpiLabel,
      kpiSubmissionId: kpi?.id ?? null,
      salesNet: km?.netSalesAmount ?? 0,
      leadScore: km?.highQualityLeadScore ?? 0,
      leadCount: km ? resolvedTodayLeadCount(km) : 0,
      validCalls: km?.validCallCount ?? 0,
      reviewScore: km?.effectiveReviewScore ?? 0,
      p0Overdue,
      statusLabel: '',
      statusTone: 'blue',
    };
    const st = staffRowStatus(base);
    rows.push({ ...base, ...st });
  }
  return rows;
}

export function buildOverview(
  instances: TaskInstance[],
  kpiSubmissions: KpiDailySubmission[],
  date: string,
  rosterLen: number,
  now: Date,
): DashboardOverview {
  let closed = 0;
  let overdue = 0;
  for (const i of instances) {
    if (isFullyClosed(i)) closed++;
    else if (computeWorkflowStatus(i, now) === 'overdue') overdue++;
  }
  const total = instances.length;
  const taskRate = total ? Math.round((closed / total) * 1000) / 10 : 0;
  const st = kpiSubmissionStatsForDate(kpiSubmissions, date, rosterLen);
  const dayKpi = kpiSubmissions.filter((s) => s.date === date && s.auditStatus === 'approved');
  let totalSalesNet = 0;
  let totalLeadScore = 0;
  let totalValidCalls = 0;
  let totalReviewScore = 0;
  for (const s of dayKpi) {
    const m = withDerivedMetrics(s);
    totalSalesNet += m.netSalesAmount;
    totalLeadScore += m.highQualityLeadScore;
    totalValidCalls += m.validCallCount;
    totalReviewScore += m.effectiveReviewScore;
  }
  return {
    taskTotal: total,
    taskClosed: closed,
    taskRate,
    taskOverdue: overdue,
    kpiUploaded: st.uploaded,
    kpiNotUploaded: st.notUploaded,
    kpiPendingRecords: st.pending,
    totalSalesNet,
    totalLeadScore,
    totalValidCalls,
    totalReviewScore,
  };
}

function sev(s: ExceptionSeverity): number {
  return s === 'high' ? 0 : s === 'medium' ? 1 : 2;
}

export function buildExceptions(input: DashboardBuildInput, rows: StaffTodayRow[]): DashboardException[] {
  const { date, now, taskState, kpiSubmissions, roster, shiftFilter, handleMap } = input;
  const allInst = buildInstances(taskState, date).filter((i) => matchesShift(i, shiftFilter));
  const ts = now.toISOString();
  const out: DashboardException[] = [];

  const push = (partial: Omit<DashboardException, 'handleStatus'> & { id: string }) => {
    out.push({ ...partial, handleStatus: mergeHandle(partial.id, handleMap) });
  };

  for (const staff of roster.length ? roster : [...new Set(allInst.map((i) => i.staffName))]) {
    const insts = allInst.filter((i) => i.staffName === staff);
    let od = 0;
    for (const i of insts) {
      if (!isFullyClosed(i) && computeWorkflowStatus(i, now) === 'overdue') od++;
    }
    if (od > 0) {
      push({
        id: `${date}::task_overdue::${staff}`,
        occurredAt: ts,
        staffName: staff,
        category: 'task_overdue',
        title: EXCEPTION_CATEGORY_LABELS.task_overdue,
        detail: `${staff} 当日有 ${od} 个任务已逾期（未闭环）。`,
        severity: od >= 3 ? 'high' : 'medium',
      });
    }

    for (const i of insts) {
      if (i.priority === 'P0' && !isFullyClosed(i) && computeWorkflowStatus(i, now) === 'overdue') {
        push({
          id: `${date}::p0_open::${i.instanceKey}`,
          occurredAt: ts,
          staffName: staff,
          category: 'p0_open',
          title: EXCEPTION_CATEGORY_LABELS.p0_open,
          detail: `「${i.title}」P0 已逾期（${i.startTime}-${i.endTime}）。`,
          severity: 'high',
          taskInstanceKey: i.instanceKey,
        });
      }
      const isReviewTask = /评价|引导.*评/.test(i.title) || /评价/.test(i.taskType);
      if (isReviewTask && !isFullyClosed(i) && computeWorkflowStatus(i, now) === 'overdue') {
        push({
          id: `${date}::review_task_overdue::${i.instanceKey}`,
          occurredAt: ts,
          staffName: staff,
          category: 'review_task_overdue',
          title: EXCEPTION_CATEGORY_LABELS.review_task_overdue,
          detail: `评价相关任务「${i.title}」已逾期。`,
          severity: 'medium',
          taskInstanceKey: i.instanceKey,
        });
      }
    }

    const subs = kpiSubmissions.filter((s) => s.date === date && s.employeeName === staff);
    const hasNonDraft = subs.some((s) => s.auditStatus !== 'draft');
    const hasFinal = subs.some((s) => s.auditStatus === 'pending_review' || s.auditStatus === 'approved' || s.auditStatus === 'rejected');
    if (!hasFinal && (roster.length === 0 || roster.includes(staff))) {
      push({
        id: `${date}::kpi_missing::${staff}`,
        occurredAt: ts,
        staffName: staff,
        category: 'kpi_missing',
        title: EXCEPTION_CATEGORY_LABELS.kpi_missing,
        detail: hasNonDraft ? `${staff} 仅有 KPI 草稿，尚未提交审核。` : `${staff} 尚未上传当日 KPI。`,
        severity: 'medium',
      });
    }

    for (const s of subs.filter((x) => x.auditStatus === 'pending_review')) {
      push({
        id: `${date}::kpi_pending::${s.id}`,
        occurredAt: s.submittedAt || ts,
        staffName: staff,
        category: 'kpi_pending',
        title: EXCEPTION_CATEGORY_LABELS.kpi_pending,
        detail: `店铺 ${s.storeName || '—'} · 待审核`,
        severity: 'low',
        kpiSubmissionId: s.id,
      });
    }

    for (const s of subs.filter((x) => x.auditStatus === 'rejected')) {
      push({
        id: `${date}::kpi_rejected::${s.id}`,
        occurredAt: ts,
        staffName: staff,
        category: 'kpi_rejected',
        title: EXCEPTION_CATEGORY_LABELS.kpi_rejected,
        detail: (s.rejectReason && s.rejectReason.slice(0, 120)) || '请在 KPI 中心修改后重提。',
        severity: 'high',
        kpiSubmissionId: s.id,
      });
    }

    const primary = pickPrimaryKpiSubmission(kpiSubmissions, date, staff);
    if (primary && primary.auditStatus !== 'draft') {
      const m = withDerivedMetrics(primary);
      const cc = callCompletionRateFrom(m);
      if (cc != null && m.shouldCallCount >= 3 && cc < 70) {
        push({
          id: `${date}::call_rate_low::${staff}::${primary.id}`,
          occurredAt: ts,
          staffName: staff,
          category: 'call_rate_low',
          title: EXCEPTION_CATEGORY_LABELS.call_rate_low,
          detail: `电联完成率 ${cc}%（应联 ${m.shouldCallCount}，已联 ${m.calledCount}）。`,
          severity: 'medium',
          kpiSubmissionId: primary.id,
        });
      }
      const vr = validCallRateFrom(m);
      if (vr != null && m.calledCount >= 3 && vr < 50) {
        push({
          id: `${date}::valid_call_low::${staff}::${primary.id}`,
          occurredAt: ts,
          staffName: staff,
          category: 'valid_call_low',
          title: EXCEPTION_CATEGORY_LABELS.valid_call_low,
          detail: `有效电联率 ${vr}% 偏低。`,
          severity: 'medium',
          kpiSubmissionId: primary.id,
        });
      }
      if (resolvedTodayLeadCount(m) <= 0) {
        push({
          id: `${date}::lead_zero::${staff}::${primary.id}`,
          occurredAt: ts,
          staffName: staff,
          category: 'lead_zero',
          title: EXCEPTION_CATEGORY_LABELS.lead_zero,
          detail: '留资合计为 0。',
          severity: 'low',
          kpiSubmissionId: primary.id,
        });
      }
      if (m.netSalesAmount <= 0 && primary.auditStatus === 'approved') {
        push({
          id: `${date}::sales_zero::${staff}::${primary.id}`,
          occurredAt: ts,
          staffName: staff,
          category: 'sales_zero',
          title: EXCEPTION_CATEGORY_LABELS.sales_zero,
          detail: '已通过记录中净销售额为 0。',
          severity: 'low',
          kpiSubmissionId: primary.id,
        });
      }
      if (m.imageReviewCount + m.videoReviewCount > 0 && m.reviewProofImages.length === 0) {
        push({
          id: `${date}::review_screenshot_missing::${staff}::${primary.id}`,
          occurredAt: ts,
          staffName: staff,
          category: 'review_screenshot_missing',
          title: EXCEPTION_CATEGORY_LABELS.review_screenshot_missing,
          detail: '有图/视频评价计数但未上传评价截图。',
          severity: 'medium',
          kpiSubmissionId: primary.id,
        });
      }
    }
  }

  const aiVals = rows.map((r) => r.staffName).flatMap((name) => {
    const p = pickPrimaryKpiSubmission(kpiSubmissions, date, name);
    return p && p.auditStatus !== 'draft' ? [p.aiUseCount] : [];
  });
  const sorted = [...aiVals].sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  const threshold = Math.max(2, Math.floor(median * 0.5));
  for (const r of rows) {
    const p = pickPrimaryKpiSubmission(kpiSubmissions, date, r.staffName);
    if (p && p.auditStatus !== 'draft' && p.aiUseCount < threshold && median >= 4) {
      push({
        id: `${date}::ai_low::${r.staffName}::${p.id}`,
        occurredAt: ts,
        staffName: r.staffName,
        category: 'ai_low',
        title: EXCEPTION_CATEGORY_LABELS.ai_low,
        detail: `AI 使用次数 ${p.aiUseCount}，低于团队参考阈值 ${threshold}。`,
        severity: 'low',
        kpiSubmissionId: p.id,
      });
    }
  }

  const seen = new Set<string>();
  let deduped = out.filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
  deduped.sort((a, b) => sev(a.severity) - sev(b.severity) || a.staffName.localeCompare(b.staffName, 'zh-CN'));
  if (input.shopFilter.trim()) {
    const allow = new Set(rows.map((r) => r.staffName));
    deduped = deduped.filter((e) => allow.has(e.staffName));
  }
  return deduped;
}

export function filterExceptions(
  list: DashboardException[],
  category: 'all' | DashboardExceptionCategory,
  handle: 'all' | 'open' | 'done' | 'ignored',
  staffQ: string,
): DashboardException[] {
  return list.filter((e) => {
    if (staffQ.trim() && !e.staffName.includes(staffQ.trim())) return false;
    if (category !== 'all' && e.category !== category) return false;
    if (handle !== 'all' && e.handleStatus !== handle) return false;
    return true;
  });
}

export function pendingKpiList(kpiSubmissions: KpiDailySubmission[], date: string): KpiDailySubmission[] {
  return kpiSubmissions.filter((s) => s.date === date && s.auditStatus === 'pending_review');
}

/** 完成率优先，其次逾期少、销售额高 */
export function sortStaffRanking(rows: StaffTodayRow[]): StaffTodayRow[] {
  return [...rows].sort((a, b) => {
    if (b.taskRate !== a.taskRate) return b.taskRate - a.taskRate;
    if (a.taskOverdue !== b.taskOverdue) return a.taskOverdue - b.taskOverdue;
    return b.salesNet - a.salesNet;
  });
}
