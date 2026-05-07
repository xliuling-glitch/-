import type { DouyinLeadFollowRecord, LeadFollowRecord } from '@/lib/lead-follow-hub/types';
import {
  loadDailyInquiryReports,
  loadDouyinLeadFollowRecords,
  loadLeadConversionSettings,
  loadLeadFollowRecords,
} from '@/lib/lead-follow-hub/storage';
import { isValidLead } from '@/lib/lead-follow-hub/stats';
import type { DailyWorkPackage, ReviewRegisterRecord } from '@/lib/daily-work-package/types';
import { loadCalls, loadPackages, loadReviews } from '@/lib/daily-work-package/storage';
import type { OldCustomerFollowTask, RepurchaseOpportunity } from '@/lib/old-customer-crm/types';
import { loadFollowTasks, loadRepurchase } from '@/lib/old-customer-crm/storage';
import type {
  DailyKpiSourceFlags,
  KpiAggregatedData,
  KpiManualAdjustment,
} from './daily-summary-types';

function norm(s: string | undefined | null): string {
  return String(s ?? '')
    .trim()
    .replace(/\s+/g, '');
}

/** 同日同客服下去重留资（旺旺/电话/微信组合） */
export function dedupeLeadRows(rows: LeadFollowRecord[]): LeadFollowRecord[] {
  const seen = new Set<string>();
  const out: LeadFollowRecord[] = [];
  for (const r of rows) {
    const k = `${norm(r.customerPlatformId)}|${norm(r.phone)}|${norm(r.customerWechat)}|${norm(r.storeName)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

function douyinDedupe(rows: DouyinLeadFollowRecord[]): DouyinLeadFollowRecord[] {
  const seen = new Set<string>();
  const out: DouyinLeadFollowRecord[] = [];
  for (const r of rows) {
    const k = `${norm(r.customerName)}|${norm(r.phone)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

function leadClassFromCustomerLevel(level: string): 'A' | 'B' | 'C' | null {
  const u = norm(level).toUpperCase();
  if (u === 'L1' || u === 'L2') return 'A';
  if (u === 'L3') return 'B';
  if (u === 'L4' || u === 'L5') return 'C';
  return null;
}

/** 评价是否计入 KPI（已通过 / 本地已完成且未驳回） */
export function isReviewCountedForKpi(r: ReviewRegisterRecord): boolean {
  if (r.status === 'pending_review') return false;
  if (r.status === 'rejected' || r.reviewDecision === 'rejected') return false;
  if (r.status === 'incomplete' || r.status === 'overdue') return false;
  if (r.status === 'completed') return true;
  return false;
}

export function isReviewPendingAudit(r: ReviewRegisterRecord): boolean {
  return r.status === 'pending_review';
}

export function effectiveReviewScore(text: number, img: number, vid: number, follow: number): number {
  return text * 1 + img * 1.5 + vid * 2 + follow * 1;
}

/** 可选 LS：social_post_records */
function loadSocialPostRecordsRaw(): unknown[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('social_post_records');
    if (!raw) return [];
    const j = JSON.parse(raw) as unknown;
    return Array.isArray(j) ? j : Array.isArray((j as { records?: unknown }).records) ? (j as { records: unknown[] }).records : [];
  } catch {
    return [];
  }
}

/** 可选 LS：ai_usage_records */
function loadAiUsageRecordsRaw(): unknown[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('ai_usage_records');
    if (!raw) return [];
    const j = JSON.parse(raw) as unknown;
    return Array.isArray(j) ? j : Array.isArray((j as { records?: unknown }).records) ? (j as { records: unknown[] }).records : [];
  } catch {
    return [];
  }
}

function pkgForStaff(packages: DailyWorkPackage[], date: string, employeeName: string): DailyWorkPackage | undefined {
  return packages.find((p) => p.date === date && p.employeeName === employeeName);
}

export type AggregateResult = {
  data: KpiAggregatedData;
  sources: DailyKpiSourceFlags;
  exceptions: string[];
  /** 摘要文案供表格展示 */
  sourceBlurbs: Record<string, string>;
};

function sameStore(storeName: string | undefined, filter?: string): boolean {
  if (!filter || !String(filter).trim()) return true;
  return norm(storeName) === norm(filter);
}

/** @param storeName 可选：仅汇总该店铺相关行（抖音/老客户等无店铺字段的仍按客服口径计入） */
export function aggregateKpiFromSources(date: string, employeeName: string, storeName?: string): AggregateResult {
  const settings = loadLeadConversionSettings();
  const reports = loadDailyInquiryReports().filter(
    (r) => r.date === date && r.employeeName === employeeName && sameStore(r.storeName, storeName),
  );
  const leadsRaw = loadLeadFollowRecords().filter(
    (l) => l.date === date && l.employeeName === employeeName && sameStore(l.storeName, storeName),
  );
  const leads = dedupeLeadRows(leadsRaw);
  const dyRaw = loadDouyinLeadFollowRecords().filter((d) => d.date === date && d.employeeName === employeeName);
  const dy = douyinDedupe(dyRaw);
  const reviews = loadReviews().filter(
    (r) => r.date === date && r.staffName === employeeName && sameStore(r.shop, storeName),
  );
  const calls = loadCalls().filter((c) => c.date === date && c.staffName === employeeName);
  const packages = loadPackages();
  const pkg = pkgForStaff(packages, date, employeeName);
  const followTasks = loadFollowTasks().filter((t) => t.followDate === date && t.ownerEmployee === employeeName);
  const repRows = loadRepurchase().filter((r) => r.ownerEmployee === employeeName);

  const inquiryCount = reports.reduce((a, r) => a + Math.max(0, Number(r.inquiryCount) || 0), 0);
  const presalesValidSum = reports.reduce((a, r) => a + Math.max(0, Number(r.presalesValidCount) || 0), 0);
  const dealCustomerSum = reports.reduce((a, r) => a + Math.max(0, Number(r.dealCustomerCount) || 0), 0);

  const validLeads = leads.filter((l) => isValidLead(l, settings));
  let leadClassA = 0;
  let leadClassB = 0;
  let leadClassC = 0;
  for (const l of validLeads) {
    const c = leadClassFromCustomerLevel(l.customerLevel);
    if (c === 'A') leadClassA++;
    else if (c === 'B') leadClassB++;
    else if (c === 'C') leadClassC++;
  }
  const leadCount = validLeads.length;
  const leadDealRows = leads.filter((l) => l.isDeal);
  const leadDealCount = leadDealRows.length;
  const leadDealAmountSum = leadDealRows.reduce((a, l) => a + (Number(l.dealAmount) || 0), 0);

  const reportSalesSum = reports.reduce((a, r) => a + Math.max(0, Number(r.dailySalesAmount) || 0), 0);
  const salesAmount = reportSalesSum > 0 ? reportSalesSum : leadDealAmountSum;

  const leadRatePct = !inquiryCount || inquiryCount <= 0 ? null : Math.round((leadCount / inquiryCount) * 1000) / 10;

  const callRequiredCount = dy.length;
  const calledCount = dy.filter((d) => d.hasCalled).length;
  const douyinUncalled = dy.filter((d) => !d.hasCalled).length;
  const callCompletionRatePct =
    callRequiredCount <= 0 ? null : Math.round((calledCount / callRequiredCount) * 1000) / 10;

  const validCallCount = calls.filter((c) => c.connected).length;
  const validCallRatePct =
    calledCount <= 0 ? null : Math.min(100, Math.round((validCallCount / calledCount) * 1000) / 10);

  let reviewText = 0;
  let reviewImage = 0;
  let reviewVideo = 0;
  let reviewFollow = 0;
  let reviewPendingAudit = 0;
  for (const r of reviews) {
    if (isReviewPendingAudit(r)) {
      reviewPendingAudit++;
      continue;
    }
    if (!isReviewCountedForKpi(r)) continue;
    const t = String(r.reviewType || '');
    if (t.includes('图')) reviewImage++;
    else if (t.includes('视频')) reviewVideo++;
    else if (t.includes('追')) reviewFollow++;
    else reviewText++;
  }
  const reviewScoreEffective = effectiveReviewScore(reviewText, reviewImage, reviewVideo, reviewFollow);

  const socialRaw = loadSocialPostRecordsRaw().filter((row) => {
    const o = row as Record<string, unknown>;
    return String(o.date ?? '') === date && String(o.employeeName ?? '') === employeeName;
  });
  let momentsPostCount = 0;
  let videoChannelPostCount = 0;
  let momentsHasProof = false;
  for (const row of socialRaw) {
    const o = row as Record<string, unknown>;
    const ch = String(o.channel ?? 'moments');
    if (ch === 'video' || ch === '视频号') {
      videoChannelPostCount++;
    } else {
      momentsPostCount++;
    }
    if (o.hasScreenshot === true || (Array.isArray(o.screenshots) && (o.screenshots as unknown[]).length > 0)) {
      momentsHasProof = true;
    }
  }
  if (pkg) {
    const momentsTask = pkg.dailyTasks.find((t) => t.taskKey === 'moments_post');
    if (momentsTask && (momentsTask.status === 'completed' || momentsTask.status === 'pending_review')) {
      if (momentsPostCount === 0) momentsPostCount = momentsTask.completedCount > 0 ? momentsTask.completedCount : 1;
      momentsHasProof = momentsHasProof || momentsTask.proofImages.length > 0;
    }
  }

  const aiRaw = loadAiUsageRecordsRaw().filter((row) => {
    const o = row as Record<string, unknown>;
    return String(o.date ?? '') === date && String(o.employeeName ?? '') === employeeName;
  });
  let aiUseCount = 0;
  let aiScriptCount = 0;
  let aiCaseCount = 0;
  let aiHasProof = false;
  if (aiRaw.length) {
    for (const row of aiRaw) {
      const o = row as Record<string, unknown>;
      aiUseCount += Math.max(0, Number(o.useCount ?? o.aiUseCount ?? 0) || 0);
      aiScriptCount += Math.max(0, Number(o.scriptCount ?? o.aiScriptCount ?? o.optimizeScriptCount ?? 0) || 0);
      aiCaseCount += Math.max(0, Number(o.caseCount ?? o.aiCaseCount ?? 0) || 0);
      const proofs = o.proofImages ?? o.screenshots ?? o.proofs;
      if (Array.isArray(proofs) && proofs.length > 0) aiHasProof = true;
    }
  }
  /** 与配置中心 KPI 默认权重一致：次数×1 + 话术×2 + 案例×3 */
  const aiUseTotal = aiUseCount * 1 + aiScriptCount * 2 + aiCaseCount * 3;

  const oldCustomerFollowRequired = followTasks.length;
  const oldCustomerFollowCompleted = followTasks.filter((t) => t.isCompleted).length;
  const oldCustomerFollowRatePct =
    oldCustomerFollowRequired <= 0
      ? null
      : Math.round((oldCustomerFollowCompleted / oldCustomerFollowRequired) * 1000) / 10;

  const repurchaseDoneCount = repRows.filter((r) => r.repurchaseStatus === '已复购').length;
  const repurchaseAmount = repRows
    .filter((r) => r.repurchaseStatus === '已复购')
    .reduce((a, r) => a + Math.max(0, Number(r.actualAmount) || 0), 0);
  const repurchaseOpportunityCount = repRows.filter((r) => r.repurchaseStatus !== '已复购').length;

  const sources: DailyKpiSourceFlags = {
    inquiryReportSynced: reports.length > 0 && inquiryCount > 0,
    leadFollowSynced: leadsRaw.length > 0,
    douyinLeadSynced: dy.length > 0,
    reviewSynced: reviews.length > 0,
    socialPostSynced: momentsPostCount > 0 || videoChannelPostCount > 0 || socialRaw.length > 0,
    aiUsageSynced: aiRaw.length > 0 || aiUseTotal > 0,
    oldCustomerSynced: followTasks.length > 0,
    repurchaseSynced: repRows.length > 0,
  };

  const exceptions: string[] = [];
  if (reports.length === 0 || inquiryCount <= 0) {
    exceptions.push('咨询量未填写：请在「留资跟进表 → 日报/询单量登记」补录。');
  }
  if (leadsRaw.length === 0) {
    exceptions.push('留资跟进表当日无明细，建议登记留资或确认无需登记。');
  }
  if (leadRatePct != null && inquiryCount >= 5 && leadRatePct < 15) {
    exceptions.push(`留资率偏低（${leadRatePct}%），请关注转化。`);
  }
  if (douyinUncalled > 0) {
    exceptions.push(`抖音留资仍有 ${douyinUncalled} 条未电联。`);
  }
  const missingReviewShot = reviews.some((r) => {
    if (!isReviewCountedForKpi(r)) return false;
    const t = String(r.reviewType || '');
    const need = t.includes('图') || t.includes('视频');
    const has = (r.screenshot?.length ?? 0) > 0;
    return need && !has;
  });
  if (missingReviewShot) {
    exceptions.push('评价截图缺失：含图片/视频评价时请上传截图。');
  }
  if (momentsPostCount <= 0) {
    exceptions.push('朋友圈未发布或未同步：请在「今日工作包 → 朋友圈」或社交登记模块完成。');
  }
  if (aiRaw.length === 0 && aiUseTotal <= 0) {
    exceptions.push('AI 运用反馈未提交：请在专用登记表或工作包中填写。');
  }
  if (oldCustomerFollowRequired > 0 && oldCustomerFollowCompleted < oldCustomerFollowRequired) {
    exceptions.push('老客户回访未完成：请在老客户 CRM 勾选完成回访任务。');
  }

  const data: KpiAggregatedData = {
    inquiryCount,
    leadCount,
    leadRatePct,
    leadClassA,
    leadClassB,
    leadClassC,
    leadDealCount,
    leadDealAmountSum,
    callRequiredCount,
    calledCount,
    validCallCount,
    callCompletionRatePct,
    validCallRatePct,
    salesAmount,
    reviewText,
    reviewImage,
    reviewVideo,
    reviewFollow,
    reviewPendingAudit,
    reviewScoreEffective,
    momentsPostCount,
    videoChannelPostCount,
    aiUseCount,
    aiScriptCount,
    aiCaseCount,
    aiUseTotal,
    oldCustomerFollowRequired,
    oldCustomerFollowCompleted,
    oldCustomerFollowRatePct,
    repurchaseAmount,
    repurchaseOpportunityCount,
    repurchaseDoneCount,
  };

  const sourceBlurbs: Record<string, string> = {
    inquiry: `咨询 ${inquiryCount} · 售前有效 ${presalesValidSum} · 成交人数 ${dealCustomerSum} · 日报 ${reports.length} 条`,
    lead: `有效留资 ${leadCount}（A/B/C ${leadClassA}/${leadClassB}/${leadClassC}）`,
    douyin: dy.length ? `留资 ${dy.length} · 已电联 ${calledCount}` : '无抖音留资行',
    review: `有效评价计分 ${reviewScoreEffective.toFixed(1)} · 待审 ${reviewPendingAudit}`,
    social: `朋友圈 ${momentsPostCount} · 视频号 ${videoChannelPostCount}`,
    ai: `AI 合计 ${aiUseTotal}（${aiUseCount}×1+${aiScriptCount}×2+${aiCaseCount}×3）`,
    crm: `回访 ${oldCustomerFollowCompleted}/${oldCustomerFollowRequired}`,
    repurchase: `复购金额 ${repurchaseAmount} · 机会 ${repurchaseOpportunityCount}`,
  };

  return { data, sources, exceptions, sourceBlurbs };
}

export function applyApprovedManualAdjustments(
  base: KpiAggregatedData,
  adjustments: KpiManualAdjustment[],
  date: string,
  employeeName: string,
): KpiAggregatedData {
  const out: KpiAggregatedData = { ...base };
  for (const a of adjustments) {
    if (a.auditStatus !== 'approved' || a.date !== date || a.employeeName !== employeeName) continue;
    switch (a.adjustType) {
      case 'sales':
        out.salesAmount += a.value;
        break;
      case 'lead':
        out.leadCount += Math.round(a.value);
        break;
      case 'inquiry':
        out.inquiryCount += Math.round(a.value);
        break;
      case 'review_score':
        out.reviewScoreEffective += a.value;
        break;
      case 'ai_total':
        out.aiUseTotal += a.value;
        out.aiUseCount += a.value;
        break;
      default:
        break;
    }
  }
  return out;
}
