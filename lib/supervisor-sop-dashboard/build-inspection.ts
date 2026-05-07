import { getWeekRange, loadCompetitors, loadPackages, loadReviews } from '@/lib/daily-work-package/storage';
import { competitorProgress } from '@/lib/daily-work-package/logic';
import { computeDailyRequired } from '@/lib/daily-required/compute';
import { loadAssignedTasks, tasksForStaffAndDate, getDisplayTaskStatus } from '@/lib/assigned-tasks/storage';
import { loadDailyInquiryReports, loadDouyinLeadFollowRecords, loadLeadFollowRecords } from '@/lib/lead-follow-hub/storage';
import { isValidLead } from '@/lib/lead-follow-hub/stats';
import { loadLeadConversionSettings } from '@/lib/lead-follow-hub/storage';
import { loadSopProgress, loadSopTemplates } from '@/lib/shift-sop/storage';
import { loadSopDailyOverrides } from '@/lib/shift-sop/daily-override-storage';
import { getEffectiveSopShift } from '@/lib/shift-sop/effective-shift';
import type { ShiftType, SopProgressRecord, SopSlotTemplate } from '@/lib/shift-sop/types';
import { findCurrentSlot, formatActionTypeLabel, isSlotEnded, nowMinutes, timeToMinutes } from '@/lib/shift-sop/time-utils';
import { getProgressRow } from '@/lib/shift-sop/storage';
import type {
  ClosingBoardLine,
  InspectionStatus,
  SopActionInspection,
  SopExecException,
  SopInspectionRow,
} from './types';

export function shiftSlotsForInspection(templates: SopSlotTemplate[], shift: ShiftType): SopSlotTemplate[] {
  return templates
    .filter((s) => s.shiftType === shift && s.enabled)
    .sort((a, b) => a.sort - b.sort || timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
}

function shiftClosingMinute(slots: SopSlotTemplate[]): number {
  if (!slots.length) return 23 * 60 + 59;
  return Math.max(...slots.map((s) => timeToMinutes(s.endTime)));
}

function shiftFirstStartMinute(slots: SopSlotTemplate[]): number {
  if (!slots.length) return 0;
  return Math.min(...slots.map((s) => timeToMinutes(s.startTime)));
}

function isBeforeShift(slots: SopSlotTemplate[], now: Date): boolean {
  if (!slots.length) return false;
  return nowMinutes(now) < shiftFirstStartMinute(slots);
}

function isAfterClosing(slots: SopSlotTemplate[], now: Date): boolean {
  if (!slots.length) return false;
  return nowMinutes(now) >= shiftClosingMinute(slots);
}

function hasOverdueSopSlot(
  slots: SopSlotTemplate[],
  progress: SopProgressRecord[],
  date: string,
  staff: string,
  now: Date,
): boolean {
  for (const slot of slots) {
    if (!isSlotEnded(slot, now)) continue;
    for (const a of slot.actions) {
      if (!a.isRequired) continue;
      const r = getProgressRow(progress, date, staff, a.id);
      if (r?.status !== 'done' && r?.status !== 'skipped') return true;
    }
  }
  return false;
}

function currentSlotHasIncompleteRequired(
  slots: SopSlotTemplate[],
  progress: SopProgressRecord[],
  date: string,
  staff: string,
  now: Date,
): boolean {
  const cur = findCurrentSlot(slots, now);
  if (!cur) return false;
  for (const a of cur.actions) {
    if (!a.isRequired) continue;
    const r = getProgressRow(progress, date, staff, a.id);
    if (r?.status !== 'done' && r?.status !== 'skipped') return true;
  }
  return false;
}

function requiredTotals(slots: SopSlotTemplate[], progress: SopProgressRecord[], date: string, staff: string) {
  let total = 0;
  let done = 0;
  let overdue = 0;
  const now = new Date();
  for (const slot of slots) {
    const ended = isSlotEnded(slot, now);
    for (const a of slot.actions) {
      if (!a.isRequired) continue;
      total++;
      const r = getProgressRow(progress, date, staff, a.id);
      const ok = r?.status === 'done' || r?.status === 'skipped';
      if (ok) done++;
      else if (ended) overdue++;
    }
  }
  return { total, done, overdue };
}

function dueEndedProgress(slots: SopSlotTemplate[], progress: SopProgressRecord[], date: string, staff: string, now: Date) {
  let dueTotal = 0;
  let dueDone = 0;
  for (const slot of slots) {
    if (!isSlotEnded(slot, now)) continue;
    for (const a of slot.actions) {
      if (!a.isRequired) continue;
      dueTotal++;
      const r = getProgressRow(progress, date, staff, a.id);
      if (r?.status === 'done' || r?.status === 'skipped') dueDone++;
    }
  }
  return { dueTotal, dueDone };
}

function pickStatus(args: {
  beforeShift: boolean;
  hasAssignedOverdue: boolean;
  postCloseDailyIncomplete: boolean;
  hasOverdueSop: boolean;
  dyUncalled: number;
  competitorIncomplete: boolean;
  currentIncomplete: boolean;
}): InspectionStatus {
  if (args.beforeShift) return 'not_started';
  if (args.hasAssignedOverdue || args.postCloseDailyIncomplete) return 'abnormal';
  if (args.hasOverdueSop || args.dyUncalled > 0 || args.competitorIncomplete) return 'warning';
  if (args.currentIncomplete) return 'in_progress';
  return 'normal';
}

function stableExcId(parts: string[]): string {
  return `sop-exc-${parts.map((p) => encodeURIComponent(p)).join('--')}`;
}

export function buildInspectionRow(date: string, staffName: string, now: Date): SopInspectionRow | null {
  if (!staffName) return null;
  const templates = loadSopTemplates();
  const progress = loadSopProgress();
  const overrides = loadSopDailyOverrides();
  const pkgs = loadPackages().filter((p) => p.date === date);
  const byStaff = new Map(pkgs.map((p) => [p.employeeName, p]));
  const pkg = byStaff.get(staffName);
  const wpShift = pkg?.shift === 'night' ? 'night' : 'day';
  const eff = getEffectiveSopShift(date, staffName, wpShift, overrides);
  const slots = shiftSlotsForInspection(templates, eff);

  const cur = findCurrentSlot(slots, now);
  const { total, done, overdue } = requiredTotals(slots, progress, date, staffName);
  const { dueTotal, dueDone } = dueEndedProgress(slots, progress, date, staffName, now);

  const sopRatePct = total ? Math.round((done / total) * 1000) / 10 : 100;
  const expectedRatePct = dueTotal ? Math.round((dueDone / dueTotal) * 1000) / 10 : 100;

  const assigned = loadAssignedTasks();
  const mine = tasksForStaffAndDate(assigned, date, staffName);
  const hasAssignedOverdue = mine.some((t) => getDisplayTaskStatus(t, now) === 'overdue');
  const pendingReviewCount = mine.filter((t) => t.needReview && t.status === 'pending_review').length;
  const assignDone = mine.filter((t) => getDisplayTaskStatus(t) === 'done').length;
  const assignOver = mine.filter((t) => getDisplayTaskStatus(t) === 'overdue').length;
  const tempTaskSummary = mine.length ? `${assignDone}/${mine.length} 完成${assignOver ? ` · ${assignOver}逾期` : ''}` : '—';

  const dailyItems = computeDailyRequired(date, staffName);
  const dailyIncompleteCount = dailyItems.filter((i) => !i.done).length;
  const dailyReqSummary = `${dailyItems.filter((i) => i.done).length}/${dailyItems.length} 项就绪`;

  const dyRows = loadDouyinLeadFollowRecords().filter((d) => d.date === date && d.employeeName === staffName);
  const dyUncalled = dyRows.filter((d) => !d.hasCalled).length;

  const week = getWeekRange(date);
  const prog = competitorProgress(loadCompetitors(), week.start, week.end, staffName);

  const beforeShift = isBeforeShift(slots, now);
  const postClose = isAfterClosing(slots, now);
  const postCloseDailyIncomplete = postClose && dailyIncompleteCount > 0;
  const overdueSop = hasOverdueSopSlot(slots, progress, date, staffName, now);
  const currentIncomplete = currentSlotHasIncompleteRequired(slots, progress, date, staffName, now);

  const status = pickStatus({
    beforeShift,
    hasAssignedOverdue,
    postCloseDailyIncomplete,
    hasOverdueSop: overdueSop,
    dyUncalled,
    competitorIncomplete: !prog.weeklyDone,
    currentIncomplete,
  });

  let exceptionCount = 0;
  if (overdueSop) exceptionCount++;
  if (currentIncomplete && !beforeShift) exceptionCount++;
  if (postCloseDailyIncomplete) exceptionCount++;
  if (hasAssignedOverdue) exceptionCount++;
  if (pendingReviewCount > 0) exceptionCount++;
  if (dyUncalled > 0) exceptionCount++;
  if (!prog.weeklyDone) exceptionCount++;

  return {
    staffName,
    shiftType: eff,
    shiftLabel: eff === 'day' ? '白班' : '晚班',
    currentModule: cur?.moduleName ?? '—',
    currentSlotRange: cur ? `${cur.startTime}—${cur.endTime}` : '—',
    sopRatePct,
    expectedRatePct,
    tempTaskSummary,
    dailyReqSummary,
    exceptionCount,
    status,
    hasAssignedOverdue,
    hasOverdueSopSlot: overdueSop,
    dyUncalled,
    dailyIncompleteCount,
    pendingReviewCount,
    requiredDone: done,
    requiredTotal: total,
    overdueActionCount: overdue,
  };
}

export function buildAllInspectionRows(date: string, roster: string[], now: Date): SopInspectionRow[] {
  return roster.map((name) => buildInspectionRow(date, name, now)).filter(Boolean) as SopInspectionRow[];
}

export function buildSopActionRows(
  date: string,
  staffName: string,
  shift: ShiftType,
  now: Date,
): SopActionInspection[] {
  const templates = loadSopTemplates();
  const progress = loadSopProgress();
  const slots = shiftSlotsForInspection(templates, shift);
  const cur = findCurrentSlot(slots, now);
  const out: SopActionInspection[] = [];
  for (const slot of slots) {
    const ended = isSlotEnded(slot, now);
    const started = nowMinutes(now) >= timeToMinutes(slot.startTime);
    for (const a of slot.actions) {
      const r = getProgressRow(progress, date, staffName, a.id);
      const ok = r?.status === 'done' || r?.status === 'skipped';
      let st: SopActionInspection['status'];
      if (ok) st = 'done';
      else if (ended) st = 'overdue';
      else if (cur?.id === slot.id && started) st = 'in_progress';
      else if (!started) st = 'not_started';
      else st = 'in_progress';
      out.push({
        slotRange: `${slot.startTime}—${slot.endTime}`,
        moduleName: slot.moduleName,
        actionText: a.actionText,
        actionTypeLabel: formatActionTypeLabel(a.actionType) + (a.isRequired ? ' · 必做' : ''),
        status: st,
        completedAt: r?.completedAt ?? '',
        remark: r?.remark ?? '',
        actionId: a.id,
      });
    }
  }
  return out;
}

export function buildClosingBoardLines(date: string, staffName: string, slots: SopSlotTemplate[], now: Date): ClosingBoardLine[] {
  const postClose = isAfterClosing(slots, now);
  const reports = loadDailyInquiryReports().filter((r) => r.date === date && r.employeeName === staffName);
  const st = loadLeadConversionSettings();
  const leads = loadLeadFollowRecords().filter((l) => l.date === date && l.employeeName === staffName);
  const dy = loadDouyinLeadFollowRecords().filter((d) => d.date === date && d.employeeName === staffName);
  const pkgs = loadPackages().filter((p) => p.date === date && p.employeeName === staffName);
  const pkg = pkgs[0];
  const revRows = loadReviews().filter((r) => r.date === date && r.staffName === staffName);

  const dailyPkg = pkg;
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
  const dataSummaryOk = dailyPkg?.dailyTasks?.find((t) => t.taskKey === 'data_summary_sheet')?.status === 'completed';
  const douyinPkgOk = dailyPkg?.dailyTasks?.some(
    (t) =>
      t.taskKey === 'douyin_leads_follow' &&
      (t.status === 'completed' || Boolean((t.formData as Record<string, unknown>)?.leadHubDouyinOk)),
  );

  const leadFollowDone = leads.some((l) => isValidLead(l, st)) || !!presaleOk;
  const dailyReportDone = reports.length > 0 || !!dailySalesOk;
  const reviewDone = revRows.length > 0;
  const dyAllCalled = dy.length === 0 ? !!douyinPkgOk : dy.every((d) => d.hasCalled);
  const dyAbnormal = dy.some((d) => !d.hasCalled);

  const line = (key: string, label: string, done: boolean, abnormal: boolean): ClosingBoardLine => {
    if (abnormal) return { key, label, state: 'abnormal' };
    if (done) return { key, label, state: 'done' };
    if (!postClose) return { key, label, state: 'not_due' };
    return { key, label, state: 'pending' };
  };

  return [
    line('presale', '日工作回执', !!presaleOk, false),
    line('data_summary', '数据汇总登记表', !!dataSummaryOk, false),
    line('review', '评价登记', reviewDone, false),
    line('daily_inquiry', '日报 / 询单量登记', dailyReportDone, false),
    line('lead', '留资跟进表', leadFollowDone, false),
    {
      key: 'douyin',
      label: '抖音留资电联',
      state: dyAbnormal ? 'abnormal' : dyAllCalled ? 'done' : !postClose ? 'not_due' : 'pending',
    },
  ];
}

export function buildSopExecExceptions(date: string, roster: string[], now: Date): SopExecException[] {
  const templates = loadSopTemplates();
  const progress = loadSopProgress();
  const overrides = loadSopDailyOverrides();
  const assigned = loadAssignedTasks();
  const week = getWeekRange(date);
  const competitors = loadCompetitors();
  const iso = now.toISOString();
  const list: SopExecException[] = [];

  for (const staffName of roster) {
    const pkgs = loadPackages().filter((p) => p.date === date && p.employeeName === staffName);
    const pkg = pkgs[0];
    const wpShift = pkg?.shift === 'night' ? 'night' : 'day';
    const eff = getEffectiveSopShift(date, staffName, wpShift, overrides);
    const slots = shiftSlotsForInspection(templates, eff);
    const postClose = isAfterClosing(slots, now);

    for (const slot of slots) {
      const ended = isSlotEnded(slot, now);
      const cur = findCurrentSlot(slots, now);
      const isCur = cur?.id === slot.id;
      for (const a of slot.actions) {
        if (!a.isRequired) continue;
        const r = getProgressRow(progress, date, staffName, a.id);
        const ok = r?.status === 'done' || r?.status === 'skipped';
        if (ended && !ok) {
          list.push({
            id: stableExcId(['sop_slot_overdue', staffName, slot.id, a.id]),
            occurredAt: iso,
            staffName,
            category: 'SOP必做项逾期',
            title: `${slot.moduleName} · ${slot.startTime}—${slot.endTime}`,
            detail: `未完成必做：${a.actionText}`,
            severity: 'high',
          });
        } else if (isCur && !ended && !ok) {
          list.push({
            id: stableExcId(['sop_current', staffName, slot.id, a.id]),
            occurredAt: iso,
            staffName,
            category: '当前时段必做未完成',
            title: `${slot.moduleName} · 当前时段`,
            detail: a.actionText,
            severity: 'medium',
          });
        }
      }
    }

    const dailyItems = computeDailyRequired(date, staffName);
    if (postClose && dailyItems.some((i) => !i.done)) {
      const miss = dailyItems.filter((i) => !i.done).map((i) => i.label);
      list.push({
        id: stableExcId(['daily_req', staffName, date]),
        occurredAt: iso,
        staffName,
        category: '结班必交未完成',
        title: '结班后仍有必交未就绪',
        detail: miss.join('；'),
        severity: 'high',
      });
    }

    const mine = tasksForStaffAndDate(assigned, date, staffName);
    for (const t of mine) {
      if (getDisplayTaskStatus(t, now) === 'overdue') {
        list.push({
          id: stableExcId(['task_od', staffName, t.id]),
          occurredAt: iso,
          staffName,
          category: '临时任务逾期',
          title: t.taskName,
          detail: t.description || '已超过业务日未完成',
          severity: 'high',
        });
      }
      if (t.needReview && t.status === 'pending_review') {
        list.push({
          id: stableExcId(['task_review', staffName, t.id]),
          occurredAt: iso,
          staffName,
          category: '临时任务待审核',
          title: t.taskName,
          detail: `优先级 ${t.priority} · ${t.completedCount}/${t.targetCount}`,
          severity: 'medium',
        });
      }
    }

    const dy = loadDouyinLeadFollowRecords().filter((d) => d.date === date && d.employeeName === staffName);
    const unc = dy.filter((d) => !d.hasCalled);
    if (unc.length > 0) {
      list.push({
        id: stableExcId(['dy_uncall', staffName, date]),
        occurredAt: iso,
        staffName,
        category: '抖音留资未电联',
        title: `${unc.length} 条抖音留资未电联`,
        detail: unc.map((x) => x.customerName || x.phone || '未命名').join('、'),
        severity: 'medium',
      });
    }

    const prog = competitorProgress(competitors, week.start, week.end, staffName);
    if (!prog.weeklyDone) {
      list.push({
        id: stableExcId(['comp_week', staffName, week.start]),
        occurredAt: iso,
        staffName,
        category: '本周竞品任务未完成',
        title: '竞品聊天未达标',
        detail: `本周至少 3 店且三方向各 1；当前已完成店铺 ${prog.shopCount}`,
        severity: 'low',
      });
    }
  }

  return list;
}

export function aggregateTopCards(rows: SopInspectionRow[], date: string, roster: string[], now: Date) {
  const sopAvg = rows.length ? Math.round((rows.reduce((a, r) => a + r.sopRatePct, 0) / rows.length) * 10) / 10 : 0;
  const abnormalStaff = rows.filter((r) => r.status === 'abnormal').length;
  const pendingReview = loadAssignedTasks().filter((t) => t.date === date && t.needReview && t.status === 'pending_review').length;
  let closingIncomplete = 0;
  for (const name of roster) {
    closingIncomplete += computeDailyRequired(date, name).filter((i) => !i.done).length;
  }
  return {
    rosterCount: roster.length,
    sopAvgPct: sopAvg,
    abnormalStaffCount: abnormalStaff,
    pendingReviewCount: pendingReview,
    closingIncompleteCount: closingIncomplete,
  };
}
