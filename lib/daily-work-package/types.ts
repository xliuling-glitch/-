/** 任务状态（与需求一致） */
export type DailyPackageTaskStatus =
  | 'incomplete'
  | 'completed'
  | 'in_progress'
  | 'pending_review'
  | 'rejected'
  | 'overdue';

export type DailyTaskTemplate = {
  id: string;
  enabled: boolean;
  taskKey: string;
  taskName: string;
  taskType: string;
  description: string;
  completionMethod: string;
  targetCount: number;
  needProof: boolean;
  needReview: boolean;
  kpiCounted: boolean;
  showInCenter: boolean;
  /** 当日 23:59 前未完成则视为逾期（仅对 incomplete/in_progress） */
  endOfDayDeadline?: boolean;
};

export type WeeklyTaskTemplate = {
  id: string;
  enabled: boolean;
  taskName: string;
  targetCount: number;
  /** 每条至少完成 minCount 次（店铺数）；label 为展示名 */
  requiredCategories: { key: string; label: string; minCount: number }[];
  needProof: boolean;
  needReview: boolean;
};

export type ProofImage = { id: string; dataUrl: string; name?: string; addedAt: string };

export type DailyTaskInstance = {
  id: string;
  taskKey: string;
  taskName: string;
  taskType: string;
  description: string;
  completionMethod: string;
  targetCount: number;
  completedCount: number;
  needProof: boolean;
  needReview: boolean;
  status: DailyPackageTaskStatus;
  proofImages: ProofImage[];
  formData: Record<string, unknown>;
  remark: string;
  updatedAt: string;
  submittedForReviewAt?: string;
  reviewNote?: string;
  reviewDecision?: 'approved' | 'rejected';
};

export type WeeklyTaskInstance = {
  id: string;
  weekStartDate: string;
  weekEndDate: string;
  taskName: string;
  targetCount: number;
  completedCount: number;
  requiredCategories: { key: string; label: string; minCount: number; done: boolean }[];
  records: string[];
  status: DailyPackageTaskStatus;
};

export type DailyWorkPackage = {
  id: string;
  date: string;
  employeeName: string;
  shift: string;
  status: string;
  completionRate: number;
  weeklyCompletionRate: number;
  dailyTasks: DailyTaskInstance[];
  weeklyTasks: WeeklyTaskInstance[];
  createdAt: string;
  updatedAt: string;
};

export type CallFollowRecord = {
  id: string;
  date: string;
  staffName: string;
  customerName: string;
  phone: string;
  source: string;
  product: string;
  connected: boolean;
  result: string;
  nextFollowAt: string;
  remark: string;
  createdAt: string;
};

export type ReviewRegisterRecord = {
  id: string;
  date: string;
  staffName: string;
  shop: string;
  product: string;
  orderId: string;
  reviewType: string;
  screenshot?: ProofImage[];
  remark: string;
  status: DailyPackageTaskStatus;
  reviewNote?: string;
  /** 主管在工作包审核通过/驳回后写入（可选） */
  reviewDecision?: 'approved' | 'rejected';
  createdAt: string;
};

export type CompetitorChatRecord = {
  id: string;
  weekStartDate: string;
  weekEndDate: string;
  staffName: string;
  productDirection: string;
  shopName: string;
  platform: string;
  consultContent: string;
  quote: string;
  sellingPoints: string;
  afterSales: string;
  screenshots: ProofImage[];
  done: boolean;
  createdAt: string;
};
