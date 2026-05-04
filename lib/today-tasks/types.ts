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
  completedAt?: string;
  quantityDone?: number;
  effectiveQty?: number;
  screenshotNote?: string;
  /** 图片/文字凭证，与当前任务同步持久化（LocalStorage） */
  attachments?: TaskAttachment[];
  customerRef?: string;
  deferNote?: string;
  dailyReportSummary?: string;
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
  completion: CompletionRecord;
};

export type DisplayStatus = 'pending' | 'done' | 'overdue';
