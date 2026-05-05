import type { KpiDailySubmission } from './types';

function nz(n: unknown): number {
  const x = Number(n);
  return Number.isFinite(x) ? Math.max(0, x) : 0;
}

/** 高质量留资加权：A×1.5 + B×1 + C×0.5，无效计 0 */
export function highQualityLeadScoreFrom(r: Pick<KpiDailySubmission, 'leadA' | 'leadB' | 'leadC' | 'invalidLead'>): number {
  return nz(r.leadA) * 1.5 + nz(r.leadB) * 1 + nz(r.leadC) * 0.5;
}

/** 有效评价计数 */
export function effectiveReviewScoreFrom(
  r: Pick<KpiDailySubmission, 'textReviewCount' | 'imageReviewCount' | 'videoReviewCount' | 'followReviewCount'>,
): number {
  return (
    nz(r.textReviewCount) * 1 +
    nz(r.imageReviewCount) * 1.5 +
    nz(r.videoReviewCount) * 2 +
    nz(r.followReviewCount) * 1
  );
}

/** AI 合计分：使用次数 + 话术×2 + 案例×3 */
export function aiTotalScoreFrom(r: Pick<KpiDailySubmission, 'aiUseCount' | 'aiScriptCount' | 'aiCaseCount'>): number {
  return nz(r.aiUseCount) + nz(r.aiScriptCount) * 2 + nz(r.aiCaseCount) * 3;
}

export function netSalesFrom(r: Pick<KpiDailySubmission, 'salesAmount' | 'refundAmount'>): number {
  return Math.max(0, nz(r.salesAmount) - nz(r.refundAmount));
}

export function callCompletionRateFrom(r: Pick<KpiDailySubmission, 'shouldCallCount' | 'calledCount'>): number | null {
  const s = nz(r.shouldCallCount);
  if (s <= 0) return null;
  return Math.round((nz(r.calledCount) / s) * 1000) / 10;
}

export function validCallRateFrom(r: Pick<KpiDailySubmission, 'calledCount' | 'validCallCount'>): number | null {
  const c = nz(r.calledCount);
  if (c <= 0) return null;
  return Math.round((nz(r.validCallCount) / c) * 1000) / 10;
}

/** 若未手填今日留资，则用 A+B+C+无效 之和 */
export function resolvedTodayLeadCount(r: Pick<KpiDailySubmission, 'todayLeadCount' | 'leadA' | 'leadB' | 'leadC' | 'invalidLead'>): number {
  const sum = nz(r.leadA) + nz(r.leadB) + nz(r.leadC) + nz(r.invalidLead);
  const t = nz(r.todayLeadCount);
  if (t > 0) return t;
  return sum;
}

/** 合并派生指标到记录（不改动 id / audit 等） */
export function withDerivedMetrics<T extends Partial<KpiDailySubmission>>(r: T): T & Pick<KpiDailySubmission, 'netSalesAmount' | 'aiTotalScore' | 'highQualityLeadScore' | 'callCompletionRate' | 'validCallRate' | 'reviewScoreCount' | 'effectiveReviewScore' | 'proofImages'> {
  const net = netSalesFrom(r as KpiDailySubmission);
  const ai = aiTotalScoreFrom(r as KpiDailySubmission);
  const hq = highQualityLeadScoreFrom(r as KpiDailySubmission);
  const eff = effectiveReviewScoreFrom(r as KpiDailySubmission);
  const aiImgs = Array.isArray(r.aiProofImages) ? r.aiProofImages : [];
  const rvImgs = Array.isArray(r.reviewProofImages) ? r.reviewProofImages : [];
  return {
    ...r,
    netSalesAmount: net,
    aiTotalScore: ai,
    highQualityLeadScore: hq,
    callCompletionRate: callCompletionRateFrom(r as KpiDailySubmission),
    validCallRate: validCallRateFrom(r as KpiDailySubmission),
    reviewScoreCount: eff,
    effectiveReviewScore: eff,
    proofImages: [...aiImgs, ...rvImgs],
  };
}

export function buildKpiAlerts(r: KpiDailySubmission): string[] {
  const out: string[] = [];
  const leads = resolvedTodayLeadCount(r);
  const vr = validCallRateFrom(r);

  if (nz(r.shouldCallCount) > 0 && nz(r.calledCount) === 0) {
    out.push('应电联客户数大于 0，但已电联数为 0。');
  }
  if (nz(r.shouldCallCount) > 0 && nz(r.calledCount) > 0 && nz(r.calledCount) < nz(r.shouldCallCount)) {
    out.push('已电联数小于应电联数，请关注进度。');
  }
  if (vr != null && vr < 50) {
    out.push(`有效电联率低于 50%（当前 ${vr}%）。`);
  }
  if (leads <= 0) {
    out.push('今日留资数量为 0。');
  }
  if (nz(r.salesAmount) === 0) {
    out.push('当日销售额为 0（若确无成交可忽略）。');
  }
  if (nz(r.imageReviewCount) + nz(r.videoReviewCount) > 0 && r.reviewProofImages.length === 0) {
    out.push('有图片/视频评价计数，但未上传评价截图。');
  }
  if ((r.auditStatus === 'pending_review' || r.auditStatus === 'approved') && r.proofImages.length === 0 && r.aiProofImages.length === 0) {
    out.push('已提交或已通过，但无任何截图凭证，建议补充。');
  }
  if (r.auditStatus === 'rejected') {
    out.push('本条已被驳回，请按驳回原因修改后重新提交。');
  }
  return out;
}
