import type { KpiDailyCenterState, KpiDailySubmission } from './types';
import { seedKpiDailySubmissions } from './seed';
import { withDerivedMetrics } from './compute';
import { STORAGE_KEY_KPI_DAILY_CENTER } from '@/lib/workspace-storage-keys';
import { emitWorkspaceStorageUpdated } from '@/lib/workspace-events';

export const KPI_DAILY_CENTER_KEY = STORAGE_KEY_KPI_DAILY_CENTER;

function empty(): KpiDailyCenterState {
  return { submissions: [] };
}

export function normalizeKpiSubmission(p: Partial<KpiDailySubmission> & { id: string }): KpiDailySubmission {
  const now = new Date().toISOString();
  const base: KpiDailySubmission = {
    id: p.id,
    date: p.date || now.slice(0, 10),
    employeeName: String(p.employeeName ?? '').trim(),
    shift: p.shift === 'night' ? 'night' : 'day',
    storeName: String(p.storeName ?? '').trim(),
    taskType: String(p.taskType ?? '综合日报').trim() || '综合日报',
    remark: String(p.remark ?? ''),

    aiUseCount: Number(p.aiUseCount) || 0,
    aiScriptCount: Number(p.aiScriptCount) || 0,
    aiCaseCount: Number(p.aiCaseCount) || 0,
    aiRemark: String(p.aiRemark ?? ''),
    aiProofImages: Array.isArray(p.aiProofImages) ? p.aiProofImages.filter(Boolean) : [],

    todayLeadCount: Number(p.todayLeadCount) || 0,
    leadA: Number(p.leadA) || 0,
    leadB: Number(p.leadB) || 0,
    leadC: Number(p.leadC) || 0,
    invalidLead: Number(p.invalidLead) || 0,
    leadRemark: String(p.leadRemark ?? ''),

    shouldCallCount: Number(p.shouldCallCount) || 0,
    calledCount: Number(p.calledCount) || 0,
    validCallCount: Number(p.validCallCount) || 0,
    advancedCustomerCount: Number(p.advancedCustomerCount) || 0,
    overdueFollowCount: Number(p.overdueFollowCount) || 0,
    callRemark: String(p.callRemark ?? ''),

    orderCount: Number(p.orderCount) || 0,
    salesAmount: Number(p.salesAmount) || 0,
    refundAmount: Number(p.refundAmount) || 0,
    netSalesAmount: 0,
    salesRemark: String(p.salesRemark ?? ''),

    textReviewCount: Number(p.textReviewCount) || 0,
    imageReviewCount: Number(p.imageReviewCount) || 0,
    videoReviewCount: Number(p.videoReviewCount) || 0,
    followReviewCount: Number(p.followReviewCount) || 0,
    reviewScoreCount: 0,
    reviewRemark: String(p.reviewRemark ?? ''),
    reviewProofImages: Array.isArray(p.reviewProofImages) ? p.reviewProofImages.filter(Boolean) : [],

    proofImages: [],

    aiTotalScore: 0,
    highQualityLeadScore: 0,
    callCompletionRate: null,
    validCallRate: null,
    effectiveReviewScore: 0,

    auditStatus: p.auditStatus === 'pending_review' || p.auditStatus === 'approved' || p.auditStatus === 'rejected' ? p.auditStatus : 'draft',
    rejectReason: String(p.rejectReason ?? ''),
    auditor: String(p.auditor ?? ''),
    managerRemark: String(p.managerRemark ?? ''),
    submittedAt: p.submittedAt && String(p.submittedAt).trim() ? p.submittedAt : null,
    createdAt: p.createdAt || now,
    updatedAt: p.updatedAt || now,
  };
  return withDerivedMetrics(base) as KpiDailySubmission;
}

export function loadKpiDailyCenter(): KpiDailyCenterState {
  if (typeof window === 'undefined') return empty();
  try {
    const raw = localStorage.getItem(KPI_DAILY_CENTER_KEY);
    if (!raw) return empty();
    const v = JSON.parse(raw) as Partial<KpiDailyCenterState>;
    const list = Array.isArray(v.submissions) ? v.submissions : [];
    return { submissions: list.map((x) => normalizeKpiSubmission(x as KpiDailySubmission)) };
  } catch {
    return empty();
  }
}

export function saveKpiDailyCenter(s: KpiDailyCenterState) {
  const next = { submissions: s.submissions.map((x) => normalizeKpiSubmission(x)) };
  localStorage.setItem(KPI_DAILY_CENTER_KEY, JSON.stringify(next));
  emitWorkspaceStorageUpdated();
}

/**
 * 仅在与 LocalStorage 序列化结果不一致时写入并派发事件。
 * 避免「本页 save → emit → 本页监听 reload → setState → save」自激循环卡死主线程。
 */
export function persistKpiDailyCenterIfDirty(submissions: KpiDailyCenterState['submissions']) {
  if (typeof window === 'undefined') return;
  const next = { submissions: submissions.map((x) => normalizeKpiSubmission(x)) };
  const serialized = JSON.stringify(next);
  if (localStorage.getItem(KPI_DAILY_CENTER_KEY) === serialized) return;
  localStorage.setItem(KPI_DAILY_CENTER_KEY, serialized);
  emitWorkspaceStorageUpdated();
}

export function getInitialKpiDailyCenter(): KpiDailyCenterState {
  const s = loadKpiDailyCenter();
  if (s.submissions.length > 0) return s;
  const seeded = { submissions: seedKpiDailySubmissions() };
  saveKpiDailyCenter(seeded);
  return seeded;
}

/** 主管看板：当日 KPI 上传统计 */
export function kpiSubmissionStatsForDate(
  submissions: KpiDailySubmission[],
  date: string,
  rosterSize: number,
): {
  expected: number;
  uploaded: number;
  notUploaded: number;
  pending: number;
  approved: number;
  rejected: number;
  draft: number;
} {
  const day = submissions.filter((s) => s.date === date);
  const expected = rosterSize > 0 ? rosterSize : new Set(day.map((s) => s.employeeName).filter(Boolean)).size;
  const uploadedStaff = new Set<string>();
  let pending = 0;
  let approved = 0;
  let rejected = 0;
  let draft = 0;
  for (const s of day) {
    if (s.auditStatus === 'draft') draft++;
    if (s.auditStatus === 'pending_review') {
      pending++;
      uploadedStaff.add(s.employeeName);
    }
    if (s.auditStatus === 'approved') {
      approved++;
      uploadedStaff.add(s.employeeName);
    }
    if (s.auditStatus === 'rejected') {
      rejected++;
      uploadedStaff.add(s.employeeName);
    }
  }
  const uploaded = uploadedStaff.size;
  const notUploaded = expected > 0 ? Math.max(0, expected - uploaded) : 0;
  return { expected, uploaded, notUploaded, pending, approved, rejected, draft };
}
