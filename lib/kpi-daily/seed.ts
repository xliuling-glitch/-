import type { KpiDailySubmission } from './types';
import { withDerivedMetrics } from './compute';

const t = new Date().toISOString();
const d = new Date().toISOString().slice(0, 10);

function row(p: Partial<KpiDailySubmission> & Pick<KpiDailySubmission, 'id' | 'employeeName' | 'auditStatus'>): KpiDailySubmission {
  const base: KpiDailySubmission = {
    id: p.id,
    date: p.date ?? d,
    employeeName: p.employeeName,
    shift: p.shift === 'night' ? 'night' : 'day',
    storeName: p.storeName ?? '天猫旗舰店',
    taskType: p.taskType ?? '综合日报',
    remark: p.remark ?? '',
    aiUseCount: p.aiUseCount ?? 6,
    aiScriptCount: p.aiScriptCount ?? 2,
    aiCaseCount: p.aiCaseCount ?? 1,
    aiRemark: p.aiRemark ?? '多用于接待首句优化',
    todayLeadCount: p.todayLeadCount ?? 0,
    leadA: p.leadA ?? 2,
    leadB: p.leadB ?? 3,
    leadC: p.leadC ?? 1,
    invalidLead: p.invalidLead ?? 0,
    leadRemark: p.leadRemark ?? '',
    shouldCallCount: p.shouldCallCount ?? 8,
    calledCount: p.calledCount ?? 7,
    validCallCount: p.validCallCount ?? 5,
    advancedCustomerCount: p.advancedCustomerCount ?? 2,
    overdueFollowCount: p.overdueFollowCount ?? 1,
    callRemark: p.callRemark ?? '',
    orderCount: p.orderCount ?? 2,
    salesAmount: p.salesAmount ?? 12800,
    refundAmount: p.refundAmount ?? 0,
    netSalesAmount: 0,
    salesRemark: p.salesRemark ?? '',
    textReviewCount: p.textReviewCount ?? 1,
    imageReviewCount: p.imageReviewCount ?? 1,
    videoReviewCount: p.videoReviewCount ?? 0,
    followReviewCount: p.followReviewCount ?? 0,
    reviewScoreCount: 0,
    reviewRemark: p.reviewRemark ?? '',
    aiProofImages: p.aiProofImages ?? [],
    reviewProofImages: p.reviewProofImages ?? [],
    proofImages: [],
    aiTotalScore: 0,
    highQualityLeadScore: 0,
    callCompletionRate: null,
    validCallRate: null,
    effectiveReviewScore: 0,
    auditStatus: p.auditStatus,
    rejectReason: p.rejectReason ?? '',
    auditor: p.auditor ?? '',
    managerRemark: p.managerRemark ?? '',
    submittedAt: p.submittedAt ?? (p.auditStatus !== 'draft' ? t : null),
    createdAt: p.createdAt ?? t,
    updatedAt: p.updatedAt ?? t,
  };
  return withDerivedMetrics(base) as KpiDailySubmission;
}

export function seedKpiDailySubmissions(): KpiDailySubmission[] {
  return [
    row({
      id: 'kpi-center-seed-1',
      employeeName: '周晨',
      auditStatus: 'pending_review',
      submittedAt: t,
    }),
    row({
      id: 'kpi-center-seed-2',
      employeeName: '陶柳青',
      auditStatus: 'approved',
      auditor: '主管',
      submittedAt: t,
    }),
  ];
}
