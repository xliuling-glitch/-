import type { DailyKpiFlowStatus } from './daily-summary-types';
import type { KpiDailyAuditStatus } from './types';
import { syncKpiSubmissionToTodayTasks } from './today-task-bridge';

function flowToAudit(flow: DailyKpiFlowStatus): KpiDailyAuditStatus {
  switch (flow) {
    case 'pending_review':
      return 'pending_review';
    case 'approved':
      return 'approved';
    case 'rejected':
      return 'rejected';
    case 'pending_confirm':
    default:
      return 'draft';
  }
}

/** 将「每日 KPI 汇总」状态同步到今日任务中心 KPI 类分配 */
export function syncDailyKpiSummaryToTodayTasks(params: {
  employeeName: string;
  date: string;
  flowStatus: DailyKpiFlowStatus;
  rejectReason?: string;
}): void {
  syncKpiSubmissionToTodayTasks({
    employeeName: params.employeeName,
    date: params.date,
    auditStatus: flowToAudit(params.flowStatus),
    rejectReason: params.rejectReason,
  });
}
