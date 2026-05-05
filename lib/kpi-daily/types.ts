/**
 * KPI 每日上传中心 — 单条「日报式」提交（与 DB 对齐的扁平字段）
 */
export type KpiDailyAuditStatus = 'draft' | 'pending_review' | 'approved' | 'rejected';

export type KpiDailyShift = 'day' | 'night';

/** 与需求文档一致的核心结构；部分截图拆分为 ai / 评价，持久化时合并入 proofImages */
export type KpiDailySubmission = {
  id: string;
  date: string;
  employeeName: string;
  shift: KpiDailyShift;
  storeName: string;
  /** 筛选用：如 综合日报 / 专项活动 */
  taskType: string;
  remark: string;

  aiUseCount: number;
  aiScriptCount: number;
  aiCaseCount: number;
  aiRemark: string;

  /** 今日留资总量（可与 A+B+C+无效 之和不一致时以本字段为准） */
  todayLeadCount: number;
  leadA: number;
  leadB: number;
  leadC: number;
  invalidLead: number;
  leadRemark: string;

  shouldCallCount: number;
  calledCount: number;
  validCallCount: number;
  advancedCustomerCount: number;
  overdueFollowCount: number;
  callRemark: string;

  orderCount: number;
  salesAmount: number;
  refundAmount: number;
  /** 净销售额 = salesAmount - refundAmount（保存时回写） */
  netSalesAmount: number;
  salesRemark: string;

  textReviewCount: number;
  imageReviewCount: number;
  videoReviewCount: number;
  followReviewCount: number;
  /** 有效评价计数：文×1 + 图×1.5 + 视频×2 + 追评×1 */
  reviewScoreCount: number;
  reviewRemark: string;

  /** AI 相关截图 data URL */
  aiProofImages: string[];
  /** 评价相关截图 data URL */
  reviewProofImages: string[];
  /** 全量凭证（导出/兼容：一般为 ai + 评价 合并） */
  proofImages: string[];

  /** AI 合计分（规则：次数 + 话术×2 + 案例×3） */
  aiTotalScore: number;
  /** 高质量留资加权分 */
  highQualityLeadScore: number;
  /** 电联完成率 % */
  callCompletionRate: number | null;
  /** 有效电联率 % */
  validCallRate: number | null;
  /** 与 reviewScoreCount 一致，便于列表展示 */
  effectiveReviewScore: number;

  auditStatus: KpiDailyAuditStatus;
  rejectReason: string;
  auditor: string;
  /** 主管审核备注（可修改） */
  managerRemark: string;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type KpiDailyCenterState = {
  submissions: KpiDailySubmission[];
};
