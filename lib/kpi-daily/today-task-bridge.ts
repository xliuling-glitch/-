import type { TaskAssignment, TodayTaskState } from '@/lib/today-tasks/types';
import type { KpiDailyAuditStatus } from './types';
import { loadTodayTasks, saveTodayTasks } from '@/lib/today-tasks/storage';
import { emitWorkspaceStorageUpdated } from '@/lib/workspace-events';
import { augmentCompletionPatch, buildInstances, instanceKey, mergeCompletion } from '@/lib/today-tasks/engine';

const KPI_ASSIGNMENT_ID = 'asg-day-08';

/** 仅「任务类型」为 KPI上传 时：提交 KPI 即视为任务闭环（与 KPI 侧待审并行） */
export function isStrictKpiUploadTaskType(a: TaskAssignment | undefined): boolean {
  if (!a?.active) return false;
  const t = a.taskType ?? '';
  return t === 'KPI上传' || t.includes('KPI上传');
}

function findKpiLinkedAssignmentId(state: TodayTaskState): string | undefined {
  const byType = state.assignments.find((x) => isStrictKpiUploadTaskType(x));
  if (byType) return byType.id;
  const byId = state.assignments.find((a) => a.id === KPI_ASSIGNMENT_ID && a.active);
  if (byId) return byId.id;
  const byTitle = state.assignments.find((a) => a.active && /KPI|数据上传/.test(a.title ?? ''));
  return byTitle?.id;
}

function summaryLine(employeeName: string, date: string, audit: KpiDailyAuditStatus): string {
  if (audit === 'approved') return `【KPI中心已通过】${employeeName} ${date}`;
  if (audit === 'rejected') return `【KPI中心已驳回】${employeeName} ${date}，请修改后重提。`;
  return `【KPI中心已提交待审】${employeeName} ${date}`;
}

export type SyncKpiToTasksParams = {
  employeeName: string;
  date: string;
  auditStatus: KpiDailyAuditStatus;
  /** 主管驳回原因，写入任务延期说明便于客服端展示 */
  rejectReason?: string;
};

/**
 * 将 KPI 每日上传状态同步到「今日任务中心」对应实例（KPI上传 / 日传类分配）。
 */
export function syncKpiSubmissionToTodayTasks(params: SyncKpiToTasksParams): void {
  if (typeof window === 'undefined') return;
  if (!params.employeeName.trim()) return;

  let state = loadTodayTasks();
  const aid = findKpiLinkedAssignmentId(state);
  if (!aid) return;

  const assignment = state.assignments.find((a) => a.id === aid);
  const key = instanceKey(aid, params.employeeName.trim(), params.date);
  const inst = buildInstances(state, params.date).find((i) => i.instanceKey === key);
  const line = summaryLine(params.employeeName.trim(), params.date, params.auditStatus);
  const strict = isStrictKpiUploadTaskType(assignment);

  if (params.auditStatus === 'draft') {
    return;
  }

  if (params.auditStatus === 'pending_review') {
    if (strict) {
      state = mergeCompletion(state, key, {
        dailyReportSummary: line,
        completedAt: new Date().toISOString(),
        reviewState: 'none',
        deferNote: '',
      });
    } else {
      const patch = {
        dailyReportSummary: line,
        completedAt: new Date().toISOString(),
        reviewState: 'pending' as const,
      };
      if (inst) {
        state = mergeCompletion(state, key, augmentCompletionPatch(inst, patch));
      } else {
        state = mergeCompletion(state, key, patch);
      }
    }
    saveTodayTasks(state);
    emitWorkspaceStorageUpdated();
    return;
  }

  if (params.auditStatus === 'approved') {
    const prev = state.completions[key] ?? {};
    if (strict) {
      state = mergeCompletion(state, key, {
        ...prev,
        dailyReportSummary: line,
        completedAt: prev.completedAt ?? new Date().toISOString(),
        reviewState: 'none',
        deferNote: '',
      });
    } else {
      state = mergeCompletion(state, key, {
        ...prev,
        dailyReportSummary: line,
        completedAt: prev.completedAt ?? new Date().toISOString(),
        reviewState: 'approved',
      });
    }
    saveTodayTasks(state);
    emitWorkspaceStorageUpdated();
    return;
  }

  if (params.auditStatus === 'rejected') {
    const prev = state.completions[key] ?? {};
    const reason = params.rejectReason?.trim();
    const deferNote = reason ? `主管驳回：${reason}` : line;
    if (strict) {
      state = mergeCompletion(state, key, {
        completedAt: undefined,
        dailyReportSummary: '',
        deferNote,
        reviewState: 'none',
      });
    } else {
      state = mergeCompletion(state, key, {
        ...prev,
        dailyReportSummary: line,
        reviewState: 'rejected',
        deferNote: reason ? deferNote : prev.deferNote,
      });
    }
    saveTodayTasks(state);
    emitWorkspaceStorageUpdated();
  }
}
