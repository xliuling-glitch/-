import type {
  CompletionMode,
  CompletionRecord,
  DisplayStatus,
  TaskAssignment,
  TaskInstance,
  TodayTaskState,
} from './types';

export function hasAttachmentCredentials(c: CompletionRecord): boolean {
  const list = c.attachments ?? [];
  return list.some((a) => {
    if (a.kind === 'image') return !!(a.content && a.content.startsWith('data:'));
    return !!(a.content && String(a.content).trim());
  });
}

export const PRI_ORDER: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };

export function instanceKey(assignmentId: string, staff: string, date: string) {
  return `${assignmentId}::${staff}::${date}`;
}

export function dateWeekday(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

export function shouldIncludeAssignment(a: TaskAssignment, dateStr: string): boolean {
  if (!a.active) return false;
  if (a.recurrence === 'once') return a.date === dateStr;
  if (a.recurrence === 'daily') return true;
  if (a.recurrence === 'weekly') {
    const wd = dateWeekday(dateStr);
    return (a.weekdays ?? []).includes(wd);
  }
  return false;
}

function parseTodayEnd(dateStr: string, endTime: string): Date {
  const [h, min] = endTime.split(':').map(Number);
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, h, min, 0, 0);
}

function parseTodayStart(dateStr: string, startTime: string): Date {
  const [h, min] = startTime.split(':').map(Number);
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, h, min, 0, 0);
}

export function isSatisfied(
  mode: CompletionMode,
  c: CompletionRecord,
  quantityTarget: number,
): boolean {
  switch (mode) {
    case 'checkbox':
      return !!c.completedAt;
    case 'quantity':
      return (c.quantityDone ?? 0) >= quantityTarget;
    case 'screenshot':
    case 'review_upload':
      return (
        !!(c.screenshotNote && String(c.screenshotNote).trim()) ||
        hasAttachmentCredentials(c)
      );
    case 'customer':
      return !!(c.customerRef && String(c.customerRef).trim());
    case 'daily_report':
      return !!(c.dailyReportSummary && String(c.dailyReportSummary).trim());
    case 'calls_metrics':
      return (
        c.quantityDone != null &&
        c.quantityDone >= 0 &&
        c.effectiveQty != null &&
        c.effectiveQty >= 0
      );
    default:
      return false;
  }
}

export function computeStatus(
  inst: TaskInstance,
  now: Date,
): DisplayStatus {
  if (isSatisfied(inst.completionMode, inst.completion, inst.quantityTarget)) return 'done';
  const end = parseTodayEnd(inst.date, inst.endTime);
  if (now > end) return 'overdue';
  return 'pending';
}

export function buildInstances(state: TodayTaskState, dateStr: string): TaskInstance[] {
  const out: TaskInstance[] = [];
  for (const a of state.assignments) {
    if (!shouldIncludeAssignment(a, dateStr)) continue;
    for (const staff of a.staffNames) {
      const key = instanceKey(a.id, staff, dateStr);
      const completion = state.completions[key] ?? {};
      out.push({
        instanceKey: key,
        assignmentId: a.id,
        date: dateStr,
        staffName: staff,
        title: a.title,
        startTime: a.startTime,
        endTime: a.endTime,
        priority: a.priority,
        completionMode: a.completionMode,
        quantityTarget: a.quantityTarget ?? 1,
        shiftLabel: a.shiftLabel ?? '',
        kpiTag: !!a.kpiTag,
        completion,
      });
    }
  }
  return out.sort((a, b) => {
    const pa = PRI_ORDER[a.priority] ?? 9;
    const pb = PRI_ORDER[b.priority] ?? 9;
    if (pa !== pb) return pa - pb;
    return a.startTime.localeCompare(b.startTime);
  });
}

export function mergeCompletion(
  state: TodayTaskState,
  instanceKey: string,
  patch: CompletionRecord,
): TodayTaskState {
  const prev = state.completions[instanceKey] ?? {};
  return {
    ...state,
    completions: {
      ...state.completions,
      [instanceKey]: { ...prev, ...patch },
    },
  };
}

export { parseTodayStart, parseTodayEnd };
