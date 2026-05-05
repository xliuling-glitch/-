export type Priority = 'P0' | 'P1' | 'P2' | 'P3';

export type Recurrence = 'once' | 'daily' | 'weekly';

export type CompletionMode =
  | 'checkbox'
  | 'quantity'
  | 'screenshot'
  | 'customer'
  | 'daily_report'
  | 'review_upload'
  | 'calls_metrics';

export type TaskTemplate = {
  id: string;
  name: string;
  description: string;
  defaultPriority: Priority;
  completionMode: CompletionMode;
  createdAt: string;
};

export type ShiftCode = 'day' | 'night' | 'all';

export type TaskAssignment = {
  id: string;
  templateId?: string;
  title: string;
  staffNames: string[];
  recurrence: Recurrence;
  date?: string;
  weekdays?: number[];
  startTime: string;
  endTime: string;
  priority: Priority;
  completionMode: CompletionMode;
  quantityTarget: number;
  shiftLabel: string;
  active: boolean;
  kpiTag: boolean;
  /** 完成后需主管审核（与 CompletionRecord.reviewState 配合，便于日后同步 DB） */
  requiresSupervisorReview?: boolean;
  /** 任务类型（筛选/统计用，预留 DB） */
  taskType?: string;
  /** 任务说明 */
  description?: string;
  /** 班次：白班 / 晚班 / 全部 */
  shiftCode?: ShiftCode;
  createdBy?: string;
  updatedAt?: string;
  createdAt: string;
};

/** 与任务实例绑定的完成凭证：图片（存 data URL）或文字片段 */
export type TaskAttachment = {
  id: string;
  kind: 'image' | 'text';
  /** image: data URL; text: 正文 */
  content: string;
  fileName?: string;
  caption?: string;
  addedAt: string;
};

export type CompletionRecord = {
  /** 客服点击「开始任务」记录 */
  startedAt?: string;
  completedAt?: string;
  quantityDone?: number;
  effectiveQty?: number;
  screenshotNote?: string;
  /** 图片/文字凭证，与当前任务同步持久化（LocalStorage） */
  attachments?: TaskAttachment[];
  customerRef?: string;
  deferNote?: string;
  dailyReportSummary?: string;
  /** 主管审核：none=未走审核流，pending=待审，approved=已通过，rejected=已驳回 */
  reviewState?: 'none' | 'pending' | 'approved' | 'rejected';
};

export type TodayTaskState = {
  templates: TaskTemplate[];
  assignments: TaskAssignment[];
  /** key = assignmentId::staffName::date */
  completions: Record<string, CompletionRecord>;
};

export type TaskInstance = {
  instanceKey: string;
  assignmentId: string;
  date: string;
  staffName: string;
  title: string;
  startTime: string;
  endTime: string;
  priority: Priority;
  completionMode: CompletionMode;
  quantityTarget: number;
  shiftLabel: string;
  kpiTag: boolean;
  requiresSupervisorReview: boolean;
  taskType: string;
  description: string;
  shiftCode: ShiftCode;
  createdBy: string;
  assignmentCreatedAt: string;
  assignmentUpdatedAt: string;
  completion: CompletionRecord;
};

/**
 * 工作台/API 对齐用视图模型（与 TaskInstance + Completion 对应，便于日后落库）
 */
export type DailyTaskItem = {
  id: string;
  date: string;
  employeeName: string;
  shift: string;
  taskName: string;
  taskType: string;
  description: string;
  startTime: string;
  endTime: string;
  priority: Priority;
  completionMethod: string;
  targetCount: number;
  completedCount: number;
  needReview: boolean;
  status: 'not_started' | 'in_progress' | 'completed' | 'pending_review' | 'overdue' | 'rejected';
  proofImages: { id: string; dataUrl: string; name?: string }[];
  relatedCustomer: string;
  remark: string;
  delayReason: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  assignmentId: string;
  instanceKey: string;
};

export type DisplayStatus = 'pending' | 'done' | 'overdue';
