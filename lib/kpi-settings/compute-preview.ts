import { aggregateKpiFromSources } from '@/lib/kpi-daily/aggregate-sources';
import type { KpiTargetConfigRow } from './types';

export type KpiPreviewStep = {
  label: string;
  detail: string;
};

export type KpiPreviewResult = {
  metricCode: string;
  date: string;
  employeeName: string;
  storeName: string;
  steps: KpiPreviewStep[];
  /** 聚合后的主数值（比例类为小数 0–1 或金额原值） */
  rawValue: number | null;
  /** 展示用字符串 */
  displayValue: string;
  meetsTarget: boolean | null;
  targetNote: string;
  warnings: string[];
};

function monthFromDate(date: string): string {
  const p = date.slice(0, 7);
  return p.length === 7 ? p : date;
}

function findSalesTarget(targets: KpiTargetConfigRow[], month: string, employee: string, store: string): number | null {
  const rows = targets.filter(
    (t) =>
      t.enabled &&
      t.month === month &&
      t.metricCode === 'salesAmount' &&
      (t.employeeName === employee || t.employeeName === '') &&
      (t.storeName === store || t.storeName === ''),
  );
  if (!rows.length) return null;
  const exact = rows.find((t) => t.employeeName === employee && (store ? t.storeName === store : true));
  if (exact) return exact.targetValue;
  return rows[0]?.targetValue ?? null;
}

function findMetricTarget(
  targets: KpiTargetConfigRow[],
  month: string,
  employee: string,
  store: string,
  metricCode: string,
): number | null {
  const rows = targets.filter(
    (t) =>
      t.enabled &&
      t.month === month &&
      t.metricCode === metricCode &&
      (t.employeeName === employee || t.employeeName === '*') &&
      (t.storeName === store || t.storeName === '' || t.storeName === '*'),
  );
  if (!rows.length) return null;
  const exact = rows.find((t) => t.employeeName === employee && (store ? t.storeName === store : !t.storeName));
  return (exact ?? rows[0])?.targetValue ?? null;
}

/** 基于当前业务数据与内置汇总逻辑，生成「计算预览」说明（与 KPI 每日汇总页一致） */
export function runKpiMetricPreview(params: {
  date: string;
  employeeName: string;
  storeName: string;
  metricCode: string;
  targets: KpiTargetConfigRow[];
}): KpiPreviewResult {
  const { date, employeeName, storeName, metricCode, targets } = params;
  const store = storeName.trim();
  const agg = aggregateKpiFromSources(date, employeeName, store || undefined);
  const d = agg.data;
  const steps: KpiPreviewStep[] = [];
  const warnings: string[] = [];
  let rawValue: number | null = null;
  let displayValue = '—';
  let meetsTarget: boolean | null = null;
  let targetNote = '';

  const month = monthFromDate(date);

  switch (metricCode) {
    case 'inquiryCount': {
      steps.push({
        label: '数据来源',
        detail: 'LocalStorage `daily_inquiry_reports`，按日期、客服' + (store ? '、店铺' : '') + '过滤后，对 `inquiryCount` 求和。',
      });
      steps.push({ label: '聚合结果', detail: `咨询量 = ${d.inquiryCount}` });
      rawValue = d.inquiryCount;
      displayValue = String(d.inquiryCount);
      const t = findMetricTarget(targets, month, employeeName, store, 'inquiryCount');
      if (t != null && t > 0) {
        meetsTarget = d.inquiryCount >= t;
        targetNote = `日目标 ${t}`;
      }
      break;
    }
    case 'leadCount': {
      steps.push({
        label: '数据来源',
        detail: '`lead_follow_records`：有效留资（电话/微信非空或已加微），同日同店同客户键去重。',
      });
      steps.push({ label: '聚合结果', detail: `留资数 = ${d.leadCount}` });
      rawValue = d.leadCount;
      displayValue = String(d.leadCount);
      const t = findMetricTarget(targets, month, employeeName, store, 'leadCount');
      if (t != null && t > 0) {
        meetsTarget = d.leadCount >= t;
        targetNote = `日目标 ${t}`;
      }
      break;
    }
    case 'leadRate': {
      steps.push({ label: '咨询量', detail: `${d.inquiryCount}（daily_inquiry_reports 合计）` });
      steps.push({ label: '留资数', detail: `${d.leadCount}（lead_follow_records 有效口径）` });
      if (!d.inquiryCount) {
        steps.push({ label: '公式', detail: '留资率 = 留资数 / 咨询量（咨询量为 0，无法计算）' });
        rawValue = null;
        displayValue = '—';
      } else {
        const r = d.leadCount / d.inquiryCount;
        rawValue = r;
        displayValue = `${(r * 100).toFixed(1)}%`;
        steps.push({ label: '公式', detail: `留资率 = ${d.leadCount} / ${d.inquiryCount}` });
        steps.push({ label: '结果', detail: displayValue });
      }
      const t = findMetricTarget(targets, month, employeeName, store, 'leadRate');
      if (t != null && t > 0 && rawValue != null) {
        meetsTarget = rawValue >= t;
        targetNote = `目标 ${(t * 100).toFixed(1)}%（配置为小数，如 0.25）`;
      }
      break;
    }
    case 'callCompletionRate': {
      steps.push({
        label: '口径说明',
        detail: '与「KPI 每日汇总」一致：应电联/已电联取自抖音留资表 `douyin_lead_follow_records`（按日、客服）；留资首电在映射表中可单独配置，汇总页主展示为抖音口径。',
      });
      steps.push({ label: '应电联数', detail: String(d.callRequiredCount) });
      steps.push({ label: '已电联数', detail: String(d.calledCount) });
      if (d.callRequiredCount <= 0) {
        rawValue = null;
        displayValue = '—';
        steps.push({ label: '完成率', detail: '无应电联数据' });
      } else {
        rawValue = d.calledCount / d.callRequiredCount;
        displayValue = d.callCompletionRatePct != null ? `${d.callCompletionRatePct}%` : `${(rawValue * 100).toFixed(1)}%`;
        steps.push({ label: '公式', detail: `完成率 = ${d.calledCount} / ${d.callRequiredCount}` });
      }
      break;
    }
    case 'salesAmount': {
      steps.push({
        label: '销售额',
        detail:
          '优先 `daily_inquiry_reports.dailySalesAmount` 合计；若日报销售额全为 0 或缺失，则回退 `lead_follow_records` 中成交行的 `dealAmount` 合计，避免双计。',
      });
      steps.push({ label: '结果', detail: `¥${d.salesAmount.toFixed(2)}` });
      rawValue = d.salesAmount;
      displayValue = `¥${d.salesAmount.toFixed(2)}`;
      const t = findSalesTarget(targets, month, employeeName, store);
      if (t != null && t > 0) {
        meetsTarget = d.salesAmount >= t;
        targetNote = `当月日折算目标见「个人目标」salesAmount（当前匹配 ${t}）`;
      }
      break;
    }
    case 'salesCompletionRate': {
      const tgt = findSalesTarget(targets, month, employeeName, store);
      steps.push({ label: '当日销售额', detail: `¥${d.salesAmount.toFixed(2)}` });
      if (tgt == null || tgt <= 0) {
        targetNote = '未配置当月 salesAmount 目标，无法计算完成率';
        steps.push({ label: '说明', detail: targetNote });
        rawValue = null;
        displayValue = '—';
      } else {
        rawValue = d.salesAmount / tgt;
        displayValue = `${((d.salesAmount / tgt) * 100).toFixed(1)}%（相对日目标 ${tgt}）`;
        steps.push({ label: '公式', detail: `完成率 = 当日销售额 / 配置目标` });
        meetsTarget = d.salesAmount >= tgt;
      }
      break;
    }
    case 'reviewScoreCount': {
      steps.push({
        label: '评价计分',
        detail: `文字 ${d.reviewText}×1 + 图片 ${d.reviewImage}×1.5 + 视频 ${d.reviewVideo}×2 + 追评 ${d.reviewFollow}×1；仅统计已通过/可计分记录（与评价模块一致）。`,
      });
      steps.push({ label: '有效评价分', detail: d.reviewScoreEffective.toFixed(2) });
      rawValue = d.reviewScoreEffective;
      displayValue = d.reviewScoreEffective.toFixed(2);
      const t = findMetricTarget(targets, month, employeeName, store, 'reviewScoreCount');
      if (t != null && t > 0) {
        meetsTarget = d.reviewScoreEffective >= t;
        targetNote = `目标分 ${t}`;
      }
      if (d.reviewPendingAudit > 0) warnings.push(`有 ${d.reviewPendingAudit} 条待审核评价未计入`);
      break;
    }
    case 'aiUsage': {
      steps.push({
        label: 'AI 加权',
        detail: `次数 ${d.aiUseCount}×1 + 话术 ${d.aiScriptCount}×2 + 案例 ${d.aiCaseCount}×3 = ${d.aiUseTotal}`,
      });
      rawValue = d.aiUseTotal;
      displayValue = String(d.aiUseTotal);
      const t = findMetricTarget(targets, month, employeeName, store, 'aiUsage');
      if (t != null && t > 0) {
        meetsTarget = d.aiUseTotal >= t;
        targetNote = `日目标 ${t}`;
      }
      break;
    }
    case 'oldCustomerFollowRate': {
      steps.push({
        label: '老客户回访',
        detail: '`old_customer_follow_tasks` 中 followDate 匹配当日、ownerEmployee 为当前客服的任务数。',
      });
      steps.push({ label: '应回访 / 已回访', detail: `${d.oldCustomerFollowRequired} / ${d.oldCustomerFollowCompleted}` });
      if (d.oldCustomerFollowRequired <= 0) {
        rawValue = null;
        displayValue = '—';
        steps.push({ label: '完成率', detail: '无任务' });
      } else {
        rawValue = d.oldCustomerFollowCompleted / d.oldCustomerFollowRequired;
        displayValue = d.oldCustomerFollowRatePct != null ? `${d.oldCustomerFollowRatePct}%` : `${(rawValue * 100).toFixed(1)}%`;
      }
      break;
    }
    default: {
      steps.push({
        label: '提示',
        detail: `指标「${metricCode}」暂无内置预览，请在「数据源映射」中配置后扩展引擎；当前已加载异常 ${agg.exceptions.length} 条。`,
      });
      if (agg.exceptions.length) warnings.push(...agg.exceptions.slice(0, 5));
    }
  }

  if (agg.exceptions.length && metricCode !== 'default') {
    warnings.push(...agg.exceptions.filter((e) => !warnings.includes(e)).slice(0, 3));
  }

  return {
    metricCode,
    date,
    employeeName,
    storeName: store,
    steps,
    rawValue,
    displayValue,
    meetsTarget,
    targetNote,
    warnings,
  };
}

/** 单项得分：min(完成率, cap) × 权重分 — 此处权重分用 100 表示满分基数 */
export function scoreSingleMetric(actual: number, target: number, capRatio: number, weightPoints = 100): number {
  if (!target || target <= 0) return 0;
  const rate = actual / target;
  const capped = Math.min(rate, capRatio);
  return Math.max(0, Math.round(capped * weightPoints * 10) / 10);
}
