/** 每日 KPI 自动汇总与确认中心 — 状态流 */
export type DailyKpiFlowStatus = 'pending_confirm' | 'pending_review' | 'approved' | 'rejected';

export type DailyKpiSourceFlags = {
  inquiryReportSynced: boolean;
  leadFollowSynced: boolean;
  douyinLeadSynced: boolean;
  reviewSynced: boolean;
  socialPostSynced: boolean;
  aiUsageSynced: boolean;
  oldCustomerSynced: boolean;
  repurchaseSynced: boolean;
};

/** 自动汇总数值（与页面 KPI 表一致） */
export type KpiAggregatedData = {
  inquiryCount: number;
  leadCount: number;
  leadRatePct: number | null;
  leadClassA: number;
  leadClassB: number;
  leadClassC: number;
  leadDealCount: number;
  /** 留资明细成交合计（展示用，销售额优先日报） */
  leadDealAmountSum: number;
  callRequiredCount: number;
  calledCount: number;
  validCallCount: number;
  callCompletionRatePct: number | null;
  validCallRatePct: number | null;
  /** 销售额：日报合计优先，否则回退留资成交合计 */
  salesAmount: number;
  reviewText: number;
  reviewImage: number;
  reviewVideo: number;
  reviewFollow: number;
  reviewPendingAudit: number;
  reviewScoreEffective: number;
  momentsPostCount: number;
  videoChannelPostCount: number;
  aiUseCount: number;
  aiScriptCount: number;
  aiCaseCount: number;
  aiUseTotal: number;
  oldCustomerFollowRequired: number;
  oldCustomerFollowCompleted: number;
  oldCustomerFollowRatePct: number | null;
  repurchaseAmount: number;
  repurchaseOpportunityCount: number;
  repurchaseDoneCount: number;
};

export type DailyKpiSummary = {
  id: string;
  date: string;
  employeeName: string;
  shift: 'day' | 'night';
  flowStatus: DailyKpiFlowStatus;
  sourceSummary: DailyKpiSourceFlags;
  /** 提交审核当时快照（待审/通过/驳回后展示）；pending_confirm 时在 UI 侧用实时聚合 */
  kpiDataSnapshot: KpiAggregatedData;
  exceptions: string[];
  employeeRemark: string;
  keyCustomers: string;
  todayIssues: string;
  needManagerSupport: string;
  auditor: string;
  rejectReason: string;
  submittedAt: string | null;
  auditedAt: string | null;
  createdAt: string;
  updatedAt: string;
  dataRefreshedAt: string;
};

export type KpiManualAdjustmentAudit = 'pending_review' | 'approved' | 'rejected';

export type KpiManualAdjustment = {
  id: string;
  date: string;
  employeeName: string;
  /** 业务含义分类 */
  adjustType: string;
  /** 数值补丁（如销售额补差） */
  value: number;
  reason: string;
  proofImages: string[];
  note: string;
  auditStatus: KpiManualAdjustmentAudit;
  auditor: string;
  rejectReason: string;
  createdAt: string;
  updatedAt: string;
};

export type DailyKpiSummaryStore = {
  summaries: DailyKpiSummary[];
};

export type KpiManualAdjustmentStore = {
  adjustments: KpiManualAdjustment[];
};
