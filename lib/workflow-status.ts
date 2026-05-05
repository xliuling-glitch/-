/**
 * 运营类模块统一状态（便于日后与 DB status 字段对齐）
 */
export type WorkflowStatusKey =
  | 'completed'
  | 'in_progress'
  | 'incomplete'
  | 'overdue'
  | 'pending_review'
  | 'rejected';

export const WORKFLOW_STATUS_META: Record<
  WorkflowStatusKey,
  { label: string; badgeClass: string; dotClass: string }
> = {
  completed: {
    label: '已完成',
    badgeClass: 'border border-emerald-200 bg-emerald-50 text-emerald-900',
    dotClass: 'bg-emerald-500',
  },
  in_progress: {
    label: '进行中',
    badgeClass: 'border border-sky-200 bg-sky-50 text-sky-900',
    dotClass: 'bg-sky-500',
  },
  incomplete: {
    label: '未完成',
    badgeClass: 'border border-stone-200 bg-stone-100 text-graphite',
    dotClass: 'bg-stone-400',
  },
  overdue: {
    label: '逾期/异常',
    badgeClass: 'border border-red-200 bg-red-50 text-red-900',
    dotClass: 'bg-red-500',
  },
  pending_review: {
    label: '待审核',
    badgeClass: 'border border-amber-200 bg-amber-50 text-amber-950',
    dotClass: 'bg-amber-400',
  },
  rejected: {
    label: '已驳回',
    badgeClass: 'border border-red-300 bg-red-100 text-red-950',
    dotClass: 'bg-red-700',
  },
};
