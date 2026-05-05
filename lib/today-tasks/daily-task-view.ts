import type { CompletionMode, DailyTaskItem, TaskInstance } from './types';
import {
  computeWorkflowStatus,
  isFullyClosed,
  isSatisfied,
  parseTodayEnd,
  parseTodayStart,
  PRI_ORDER,
} from './engine';
import type { WorkflowStatusKey } from '@/lib/workflow-status';

export function completionModeLabel(m: CompletionMode): string {
  const labels: Record<CompletionMode, string> = {
    checkbox: '直接打勾',
    quantity: '填写完成数量',
    screenshot: '上传截图/备注',
    customer: '关联客户',
    daily_report: '提交日报',
    review_upload: '评价/截图凭证',
    calls_metrics: '电联指标',
  };
  return labels[m] ?? m;
}

function wfToDailyStatus(wf: WorkflowStatusKey, closed: boolean): DailyTaskItem['status'] {
  if (closed) return 'completed';
  if (wf === 'rejected') return 'rejected';
  if (wf === 'pending_review') return 'pending_review';
  if (wf === 'overdue') return 'overdue';
  if (wf === 'in_progress') return 'in_progress';
  return 'not_started';
}

export function toDailyTaskItem(inst: TaskInstance, now: Date): DailyTaskItem {
  const wf = computeWorkflowStatus(inst, now);
  const closed = isFullyClosed(inst);
  const imgs = (inst.completion.attachments ?? [])
    .filter((a) => a.kind === 'image' && a.content?.startsWith('data:'))
    .map((a) => ({ id: a.id, dataUrl: a.content, name: a.fileName }));
  const qtyDone = inst.completion.quantityDone ?? 0;
  const sat = isSatisfied(inst.completionMode, inst.completion, inst.quantityTarget);
  const completedCount =
    inst.completionMode === 'quantity' || inst.completionMode === 'calls_metrics'
      ? qtyDone
      : sat
        ? inst.quantityTarget
        : 0;

  const shiftLabel =
    inst.shiftLabel?.trim() ||
    (inst.shiftCode === 'day' ? '白班' : inst.shiftCode === 'night' ? '晚班' : '');

  return {
    id: inst.instanceKey,
    date: inst.date,
    employeeName: inst.staffName,
    shift: shiftLabel || (inst.shiftCode === 'all' ? '全部' : inst.shiftCode === 'day' ? '白班' : '晚班'),
    taskName: inst.title,
    taskType: inst.taskType,
    description: inst.description,
    startTime: inst.startTime,
    endTime: inst.endTime,
    priority: inst.priority,
    completionMethod: completionModeLabel(inst.completionMode),
    targetCount: inst.quantityTarget,
    completedCount,
    needReview: !!inst.requiresSupervisorReview,
    status: wfToDailyStatus(wf, closed),
    proofImages: imgs,
    relatedCustomer: inst.completion.customerRef ?? '',
    remark: inst.completion.screenshotNote ?? '',
    delayReason: inst.completion.deferNote ?? '',
    createdBy: inst.createdBy,
    createdAt: inst.assignmentCreatedAt,
    updatedAt: inst.assignmentUpdatedAt,
    assignmentId: inst.assignmentId,
    instanceKey: inst.instanceKey,
  };
}

/** 排序：逾期 → 当前时段 → P0 → 临近截止(90min) → 其它 → 已完成 */
export function sortInstancesForWorkbench(insts: TaskInstance[], now: Date): TaskInstance[] {
  return [...insts].sort((a, b) => {
    for (let i = 0; i < 6; i++) {
      const d = sortKey(a, now)[i]! - sortKey(b, now)[i]!;
      if (d !== 0) return d;
    }
    return a.startTime.localeCompare(b.startTime);
  });
}

function sortKey(inst: TaskInstance, now: Date): number[] {
  const closed = isFullyClosed(inst);
  const wf = computeWorkflowStatus(inst, now);
  const t0 = parseTodayStart(inst.date, inst.startTime).getTime();
  const t1 = parseTodayEnd(inst.date, inst.endTime).getTime();
  const nt = now.getTime();
  const inWin = nt >= t0 && nt <= t1;
  const pri = PRI_ORDER[inst.priority] ?? 9;

  if (closed) return [5, t1, pri, t0, 0, 0];
  if (wf === 'overdue' || wf === 'rejected') return [0, pri, t1, t0, 0, 0];
  if (inWin) return [1, pri, t0, t1, 0, 0];
  if (inst.priority === 'P0') return [2, t1, t0, pri, 0, 0];
  const minsToEnd = (t1 - nt) / 60000;
  if (minsToEnd > 0 && minsToEnd <= 90) return [3, t1, t0, pri, 0, 0];
  return [4, t0, t1, pri, 0, 0];
}

export function isInCurrentTimeWindow(inst: TaskInstance, now: Date): boolean {
  const t0 = parseTodayStart(inst.date, inst.startTime).getTime();
  const t1 = parseTodayEnd(inst.date, inst.endTime).getTime();
  const nt = now.getTime();
  return nt >= t0 && nt <= t1;
}

/** 距开始 ≤5 分钟且尚未闭环 */
export function isStartingWithinFiveMinutes(inst: TaskInstance, now: Date): boolean {
  if (isFullyClosed(inst)) return false;
  const t0 = parseTodayStart(inst.date, inst.startTime).getTime();
  const nt = now.getTime();
  const diff = t0 - nt;
  return diff > 0 && diff <= 5 * 60 * 1000;
}

export function isP0Overdue(inst: TaskInstance, now: Date): boolean {
  return inst.priority === 'P0' && computeWorkflowStatus(inst, now) === 'overdue';
}
