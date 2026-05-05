import type { WorkflowStatusKey } from '@/lib/workflow-status';
import type { KpiDailyAuditStatus } from './types';

/** 与统一五色状态标签对齐（仅四态 + 映射） */
export function kpiAuditToWorkflow(status: KpiDailyAuditStatus): WorkflowStatusKey {
  switch (status) {
    case 'approved':
      return 'completed';
    case 'pending_review':
      return 'pending_review';
    case 'rejected':
      return 'rejected';
    case 'draft':
    default:
      return 'incomplete';
  }
}
