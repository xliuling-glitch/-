import type { TaskInstance } from '@/lib/today-tasks/types';

/** 与筛选项、异常生成一致 */
export type DashboardExceptionCategory =
  | 'task_overdue'
  | 'p0_open'
  | 'kpi_missing'
  | 'kpi_pending'
  | 'kpi_rejected'
  | 'call_rate_low'
  | 'valid_call_low'
  | 'lead_zero'
  | 'sales_zero'
  | 'review_screenshot_missing'
  | 'review_task_overdue'
  | 'ai_low';

export type ExceptionSeverity = 'high' | 'medium' | 'low';

export type ExceptionHandleStatus = 'open' | 'done' | 'ignored';

export type DashboardException = {
  id: string;
  occurredAt: string;
  staffName: string;
  category: DashboardExceptionCategory;
  title: string;
  detail: string;
  severity: ExceptionSeverity;
  handleStatus: ExceptionHandleStatus;
  taskInstanceKey?: string;
  kpiSubmissionId?: string;
};

export type StaffTodayRow = {
  staffName: string;
  taskTotal: number;
  taskClosed: number;
  taskOverdue: number;
  taskRate: number;
  kpiLabel: '未上传' | '草稿' | '待审' | '已通过' | '已驳回';
  kpiSubmissionId: string | null;
  salesNet: number;
  leadScore: number;
  leadCount: number;
  validCalls: number;
  reviewScore: number;
  p0Overdue: boolean;
  statusLabel: string;
  statusTone: 'green' | 'blue' | 'yellow' | 'red';
};

export type DashboardOverview = {
  taskTotal: number;
  taskClosed: number;
  taskRate: number;
  taskOverdue: number;
  kpiUploaded: number;
  kpiNotUploaded: number;
  kpiPendingRecords: number;
  totalSalesNet: number;
  totalLeadScore: number;
  totalValidCalls: number;
  totalReviewScore: number;
};

export const EXCEPTION_CATEGORY_LABELS: Record<DashboardExceptionCategory, string> = {
  task_overdue: '客服今日任务逾期',
  p0_open: 'P0任务未完成',
  kpi_missing: 'KPI数据未上传',
  kpi_pending: 'KPI数据待审核',
  kpi_rejected: 'KPI数据被驳回',
  call_rate_low: '电联完成率不足',
  valid_call_low: '有效电联率过低',
  lead_zero: '留资数量为0',
  sales_zero: '今日销售额为0',
  review_screenshot_missing: '评价截图缺失',
  review_task_overdue: '评价任务逾期',
  ai_low: 'AI使用不足',
};
