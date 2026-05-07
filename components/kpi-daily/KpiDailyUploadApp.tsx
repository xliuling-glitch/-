'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui';
import { WorkflowStatusBadge } from '@/components/workflow-status-badge';
import type { WorkflowStatusKey } from '@/lib/workflow-status';
import { WORKSPACE_STORAGE_UPDATED } from '@/lib/workspace-events';
import { LS_TODAY_CENTER_SHIFT } from '@/lib/shift-sop/storage-keys';
import { formatAmountYuan } from '@/lib/format-amount';
import type { DailyKpiFlowStatus, DailyKpiSummary, KpiManualAdjustment } from '@/lib/kpi-daily/daily-summary-types';
import {
  findSummary,
  isoNow,
  loadDailyKpiSummaryStore,
  loadKpiManualAdjustments,
  rid,
  saveKpiManualAdjustments,
  upsertSummary,
} from '@/lib/kpi-daily/daily-summary-storage';
import { aggregateKpiFromSources, applyApprovedManualAdjustments } from '@/lib/kpi-daily/aggregate-sources';
import { syncDailyKpiSummaryToTodayTasks } from '@/lib/kpi-daily/summary-today-task-bridge';

type SessionUser = { name: string; role: string } | null;

const FLOW_LABEL: Record<DailyKpiFlowStatus, string> = {
  pending_confirm: '待确认',
  pending_review: '待审核',
  approved: '已通过',
  rejected: '已驳回',
};

function flowToWorkflow(s: DailyKpiFlowStatus): WorkflowStatusKey {
  switch (s) {
    case 'approved':
      return 'completed';
    case 'pending_review':
      return 'pending_review';
    case 'rejected':
      return 'rejected';
    default:
      return 'incomplete';
  }
}

const ADJUST_TYPES = [
  { v: 'sales', label: '销售额补差' },
  { v: 'lead', label: '留资数调整' },
  { v: 'inquiry', label: '咨询量调整' },
  { v: 'review_score', label: '评价计分调整' },
  { v: 'ai_total', label: 'AI 合计调整' },
  { v: 'other', label: '其他（说明必填）' },
];

async function filesToDataUrls(files: File[], cap: number): Promise<string[]> {
  const out: string[] = [];
  for (const f of Array.from(files).slice(0, cap)) {
    if (!f.type.startsWith('image/')) continue;
    const url = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(new Error('read'));
      fr.readAsDataURL(f);
    });
    out.push(url);
  }
  return out;
}

function emptySummary(date: string, employeeName: string, shift: 'day' | 'night'): DailyKpiSummary {
  const t = isoNow();
  const { data, sources, exceptions } = aggregateKpiFromSources(date, employeeName);
  const merged = applyApprovedManualAdjustments(data, loadKpiManualAdjustments(), date, employeeName);
  return {
    id: rid(),
    date,
    employeeName,
    shift,
    flowStatus: 'pending_confirm',
    sourceSummary: sources,
    kpiDataSnapshot: merged,
    exceptions,
    employeeRemark: '',
    keyCustomers: '',
    todayIssues: '',
    needManagerSupport: '',
    auditor: '',
    rejectReason: '',
    submittedAt: null,
    auditedAt: null,
    createdAt: t,
    updatedAt: t,
    dataRefreshedAt: t,
  };
}

export function KpiDailyUploadApp() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [staff, setStaff] = useState('');
  const [roster, setRoster] = useState<string[]>([]);
  const [user, setUser] = useState<SessionUser>(null);
  const [shift, setShift] = useState<'day' | 'night'>('day');
  const [tick, setTick] = useState(0);
  const [adjustments, setAdjustments] = useState<KpiManualAdjustment[]>([]);
  const [rejectOpen, setRejectOpen] = useState<DailyKpiSummary | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [manualType, setManualType] = useState('sales');
  const [manualValue, setManualValue] = useState('');
  const [manualReason, setManualReason] = useState('');
  const [manualNote, setManualNote] = useState('');
  const [manualFiles, setManualFiles] = useState<FileList | null>(null);
  const [draft, setDraft] = useState({
    employeeRemark: '',
    keyCustomers: '',
    todayIssues: '',
    needManagerSupport: '',
  });

  const isSupervisor = user?.role === 'admin' || user?.role === 'manager';

  const reload = useCallback(() => {
    setAdjustments(loadKpiManualAdjustments());
    setTick((x) => x + 1);
  }, []);

  useEffect(() => {
    const s = typeof window !== 'undefined' ? localStorage.getItem(LS_TODAY_CENTER_SHIFT) : null;
    if (s === 'night') setShift('night');
  }, []);

  useEffect(() => {
    fetch('/api/options')
      .then((r) => r.json())
      .then((d) => setRoster(Array.isArray(d.staff_roster) ? d.staff_roster : []))
      .catch(() => {});
    fetch('/api/session', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        const u = d?.user;
        if (u && typeof u.name === 'string') setUser({ name: u.name, role: String(u.role || '') });
        else setUser(null);
      })
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    setAdjustments(loadKpiManualAdjustments());
  }, []);

  useEffect(() => {
    const fn = () => reload();
    window.addEventListener(WORKSPACE_STORAGE_UPDATED, fn);
    return () => window.removeEventListener(WORKSPACE_STORAGE_UPDATED, fn);
  }, [reload]);

  useEffect(() => {
    if (!staff && roster.length && user?.name && !isSupervisor) {
      setStaff(user.name);
    }
  }, [staff, roster, user, isSupervisor]);

  const summaries = useMemo(() => loadDailyKpiSummaryStore().summaries, [tick]);

  useEffect(() => {
    if (!staff) return;
    const ex = findSummary(date, staff);
    if (!ex) {
      upsertSummary(emptySummary(date, staff, shift));
      reload();
    }
  }, [date, staff, shift, reload]);

  const summary = staff ? findSummary(date, staff) : undefined;

  useEffect(() => {
    if (!summary) return;
    setDraft({
      employeeRemark: summary.employeeRemark,
      keyCustomers: summary.keyCustomers,
      todayIssues: summary.todayIssues,
      needManagerSupport: summary.needManagerSupport,
    });
  }, [summary?.id, summary?.flowStatus]);

  const agg = useMemo(() => (staff ? aggregateKpiFromSources(date, staff) : null), [date, staff, tick]);
  const mergedLive = useMemo(() => {
    if (!staff || !agg) return null;
    return applyApprovedManualAdjustments(agg.data, adjustments, date, staff);
  }, [agg, adjustments, date, staff]);

  const displayKpi = useMemo(() => {
    if (!summary || !mergedLive) return mergedLive;
    if (summary.flowStatus === 'pending_review' || summary.flowStatus === 'approved') {
      return summary.kpiDataSnapshot;
    }
    return mergedLive;
  }, [summary, mergedLive]);

  const saveNotes = () => {
    const cur = findSummary(date, staff);
    if (!cur) return;
    upsertSummary({ ...cur, ...draft, updatedAt: isoNow() });
    reload();
  };

  const submitForReview = () => {
    const cur = findSummary(date, staff);
    if (!cur || !mergedLive) return;
    upsertSummary({
      ...cur,
      ...draft,
      flowStatus: 'pending_review',
      kpiDataSnapshot: mergedLive,
      submittedAt: isoNow(),
      rejectReason: '',
      dataRefreshedAt: isoNow(),
      updatedAt: isoNow(),
    });
    reload();
    syncDailyKpiSummaryToTodayTasks({ employeeName: staff, date, flowStatus: 'pending_review' });
  };

  const supervisorApprove = (row: DailyKpiSummary) => {
    const auditor = user?.name ?? '主管';
    upsertSummary({
      ...row,
      flowStatus: 'approved',
      auditor,
      auditedAt: isoNow(),
      updatedAt: isoNow(),
      rejectReason: '',
    });
    reload();
    syncDailyKpiSummaryToTodayTasks({ employeeName: row.employeeName, date: row.date, flowStatus: 'approved' });
  };

  const supervisorReject = () => {
    if (!rejectOpen || !rejectReason.trim()) return;
    upsertSummary({
      ...rejectOpen,
      flowStatus: 'rejected',
      auditor: user?.name ?? '主管',
      auditedAt: isoNow(),
      rejectReason: rejectReason.trim(),
      updatedAt: isoNow(),
    });
    reload();
    syncDailyKpiSummaryToTodayTasks({
      employeeName: rejectOpen.employeeName,
      date: rejectOpen.date,
      flowStatus: 'rejected',
      rejectReason: rejectReason.trim(),
    });
    setRejectOpen(null);
    setRejectReason('');
  };

  const addManualAdjustment = async () => {
    if (!staff) return;
    const v = Number(manualValue);
    if (!manualReason.trim()) {
      window.alert('请填写补录原因');
      return;
    }
    const proofs = manualFiles?.length ? await filesToDataUrls(Array.from(manualFiles), 6) : [];
    if (!proofs.length) {
      window.alert('手动补录需上传凭证截图');
      return;
    }
    const row: KpiManualAdjustment = {
      id: rid(),
      date,
      employeeName: staff,
      adjustType: manualType,
      value: Number.isFinite(v) ? v : 0,
      reason: manualReason.trim(),
      proofImages: proofs,
      note: manualNote.trim(),
      auditStatus: 'pending_review',
      auditor: '',
      rejectReason: '',
      createdAt: isoNow(),
      updatedAt: isoNow(),
    };
    saveKpiManualAdjustments([...adjustments, row]);
    setManualValue('');
    setManualReason('');
    setManualNote('');
    setManualFiles(null);
    reload();
  };

  const approveAdjustment = (row: KpiManualAdjustment) => {
    const next = adjustments.map((a) =>
      a.id === row.id ? { ...a, auditStatus: 'approved' as const, auditor: user?.name ?? '主管', updatedAt: isoNow() } : a,
    );
    saveKpiManualAdjustments(next);
    reload();
  };

  const rejectAdjustment = (row: KpiManualAdjustment, reason: string) => {
    if (!reason.trim()) return;
    const next = adjustments.map((a) =>
      a.id === row.id
        ? { ...a, auditStatus: 'rejected' as const, auditor: user?.name ?? '主管', rejectReason: reason.trim(), updatedAt: isoNow() }
        : a,
    );
    saveKpiManualAdjustments(next);
    reload();
  };

  const daySummaries = summaries.filter((s) => s.date === date);
  const pendingAdj = adjustments.filter((a) => a.date === date && a.auditStatus === 'pending_review');

  const syncRows = [
    {
      name: '日报/询单量登记',
      ok: agg?.sources.inquiryReportSynced,
      blurb: agg?.sourceBlurbs.inquiry ?? '—',
      href: `/dashboard/lead-follow?tab=daily&date=${date}`,
      abnormal: agg?.exceptions.some((e) => e.includes('咨询量')) ?? false,
    },
    {
      name: '留资跟进表',
      ok: agg?.sources.leadFollowSynced,
      blurb: agg?.sourceBlurbs.lead ?? '—',
      href: `/dashboard/lead-follow?tab=today&date=${date}`,
      abnormal: agg?.exceptions.some((e) => e.includes('留资跟进')) ?? false,
    },
    {
      name: '抖音留资电联',
      ok: agg?.sources.douyinLeadSynced,
      blurb: agg?.sourceBlurbs.douyin ?? '—',
      href: `/dashboard/lead-follow?tab=douyin&date=${date}`,
      abnormal: agg?.exceptions.some((e) => e.includes('抖音')) ?? false,
    },
    {
      name: '评价管理',
      ok: agg?.sources.reviewSynced,
      blurb: agg?.sourceBlurbs.review ?? '—',
      href: '/dashboard/reviews',
      abnormal: agg?.exceptions.some((e) => e.includes('评价')) ?? false,
    },
    {
      name: '朋友圈/视频号',
      ok: agg?.sources.socialPostSynced,
      blurb: agg?.sourceBlurbs.social ?? '—',
      href: '/dashboard/tasks',
      abnormal: agg?.exceptions.some((e) => e.includes('朋友圈')) ?? false,
    },
    {
      name: 'AI运用反馈',
      ok: agg?.sources.aiUsageSynced,
      blurb: agg?.sourceBlurbs.ai ?? '—',
      href: '/dashboard/tasks',
      abnormal: agg?.exceptions.some((e) => e.includes('AI')) ?? false,
    },
    {
      name: '老客户CRM',
      ok: agg?.sources.oldCustomerSynced,
      blurb: agg?.sourceBlurbs.crm ?? '—',
      href: '/dashboard/old-customer-crm',
      abnormal: agg?.exceptions.some((e) => e.includes('老客户')) ?? false,
    },
    {
      name: '复购跟踪',
      ok: agg?.sources.repurchaseSynced,
      blurb: agg?.sourceBlurbs.repurchase ?? '—',
      href: '/dashboard/old-customer-crm',
      abnormal: false,
    },
  ];

  const kpiRows = displayKpi
    ? [
        ['咨询量', String(displayKpi.inquiryCount), '日报 inquiryCount 合计', 'daily_inquiry_reports', '自动'],
        ['留资数', String(displayKpi.leadCount), '有效留资（电话/微信/已加微），同日去重', 'lead_follow_records', '自动'],
        ['留资率', displayKpi.leadRatePct != null ? `${displayKpi.leadRatePct}%` : '—', '留资数/咨询量', '计算', '自动'],
        ['电联完成率', displayKpi.callCompletionRatePct != null ? `${displayKpi.callCompletionRatePct}%` : '—', '抖音已电联/抖音留资条数', 'douyin_lead_follow_records', '自动'],
        ['有效电联率', displayKpi.validCallRatePct != null ? `${displayKpi.validCallRatePct}%` : '—', '电联管理接通数/已电联（抖音）', 'call_follow + 抖音', '自动'],
        ['销售额', formatAmountYuan(displayKpi.salesAmount), '优先日报 dailySalesAmount，否则留资成交合计', 'daily_inquiry_reports / lead_follow_records', '自动'],
        ['评价计分', displayKpi.reviewScoreEffective.toFixed(1), '文×1 + 图×1.5 + 视频×2 + 追评×1（已完成且未驳回）', 'review_register_records', '自动'],
        ['朋友圈发布', String(displayKpi.momentsPostCount), '社交 LS 或工作包朋友圈任务', 'social_post_records / daily_work_packages', '自动'],
        ['AI使用合计', String(displayKpi.aiUseTotal), '次数×1+话术×2+案例×3', 'ai_usage_records', '自动'],
        ['老客户回访率', displayKpi.oldCustomerFollowRatePct != null ? `${displayKpi.oldCustomerFollowRatePct}%` : '—', '已完成/当日任务数', 'old_customer_follow_tasks', '自动'],
      ]
    : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3 rounded-[10px] border border-ash bg-ledger-white p-3">
        <label className="text-xs text-graphite">
          业务日
          <input type="date" className="input-field mt-1 block text-sm" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="text-xs text-graphite">
          客服
          <select className="input-field mt-1 block min-w-[8rem] text-sm" value={staff} onChange={(e) => setStaff(e.target.value)}>
            <option value="">请选择</option>
            {roster.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        {isSupervisor ? (
          <p className="text-xs text-slate-mid sm:ml-auto">主管可审核当日汇总；客服需在名单中。</p>
        ) : (
          <p className="text-xs text-slate-mid sm:ml-auto">当前账号：{user?.name ?? '…'}</p>
        )}
      </div>

      {!staff ? (
        <p className="text-sm text-slate-mid">请选择客服姓名。</p>
      ) : (
        <>
          {/* 顶部信息 */}
          <Card className="border border-ash p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-semibold text-coal-ink">汇总状态</h3>
                <p className="mt-1 text-xs text-slate-mid">
                  数据由当日各模块 LocalStorage 自动汇总；提交后锁定快照待主管审核。旧版手工 KPI 仍保存在 <code className="rounded bg-ash px-1">kpi-daily-center-v1</code>，本页不再逐项手填。
                </p>
              </div>
              <div className="text-right text-sm">
                <div className="flex items-center justify-end gap-2">
                  <span className="text-graphite">流程：</span>
                  <WorkflowStatusBadge status={flowToWorkflow(summary?.flowStatus ?? 'pending_confirm')} />
                  <span className="font-medium text-coal-ink">{FLOW_LABEL[summary?.flowStatus ?? 'pending_confirm']}</span>
                </div>
                <p className="mt-1 text-xs text-stone">
                  班次：{shift === 'day' ? '白班' : '晚班'} · 更新时间 {summary?.dataRefreshedAt?.slice(0, 19).replace('T', ' ') ?? '—'}
                </p>
              </div>
            </div>
          </Card>

          {/* 同步状态 */}
          <Card className="border border-ash p-4">
            <h3 className="font-display text-base font-semibold text-coal-ink">数据来源同步状态</h3>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-[720px] w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-ash bg-ash/40 text-left text-xs text-graphite">
                    <th className="px-2 py-2">模块</th>
                    <th className="px-2 py-2">已同步</th>
                    <th className="px-2 py-2">摘要</th>
                    <th className="px-2 py-2">异常</th>
                    <th className="px-2 py-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {syncRows.map((r) => (
                    <tr key={r.name} className="border-b border-ash/80">
                      <td className="px-2 py-2">{r.name}</td>
                      <td className="px-2 py-2">{r.ok ? <span className="text-emerald-700">是</span> : <span className="text-stone">否</span>}</td>
                      <td className="px-2 py-2 text-xs text-graphite">{r.blurb}</td>
                      <td className="px-2 py-2">{r.abnormal ? <span className="text-amber-800">有</span> : <span className="text-stone">无</span>}</td>
                      <td className="px-2 py-2 whitespace-nowrap">
                        <Link href={r.href} className="text-sky-800 underline text-xs">
                          去补录
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* KPI 表 */}
          <Card className="border border-ash p-4">
            <h3 className="font-display text-base font-semibold text-coal-ink">KPI 自动汇总</h3>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-[800px] w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-ash bg-ash/40 text-left text-xs text-graphite">
                    <th className="px-2 py-2">项目</th>
                    <th className="px-2 py-2">数值</th>
                    <th className="px-2 py-2">计算方式</th>
                    <th className="px-2 py-2">来源</th>
                  </tr>
                </thead>
                <tbody>
                  {kpiRows.map(([a, b, c, d]) => (
                    <tr key={String(a)} className="border-b border-ash/80">
                      <td className="px-2 py-2 font-medium">{a}</td>
                      <td className="px-2 py-2 tabular-nums">{b}</td>
                      <td className="px-2 py-2 text-xs text-graphite">{c}</td>
                      <td className="px-2 py-2 text-xs text-stone">{d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[11px] text-slate-mid">
              复购：金额 {displayKpi ? formatAmountYuan(displayKpi.repurchaseAmount) : '—'} · 机会 {displayKpi?.repurchaseOpportunityCount ?? '—'} · 已复购{' '}
              {displayKpi?.repurchaseDoneCount ?? '—'}（repurchase_opportunities）
            </p>
          </Card>

          {/* 异常 */}
          <Card className="border border-amber-200 bg-amber-50/50 p-4">
            <h3 className="font-display text-base font-semibold text-amber-950">异常提醒</h3>
            <ul className="mt-2 list-inside list-disc text-sm text-amber-950">
              {(agg?.exceptions.length ? agg.exceptions : ['暂无自动检测到的问题']).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </Card>

          {/* 客服确认 */}
          <Card className="border border-ash p-4 space-y-3">
            <h3 className="font-display text-base font-semibold text-coal-ink">客服确认</h3>
            {summary?.flowStatus === 'rejected' && summary.rejectReason ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
                驳回原因：{summary.rejectReason}
              </p>
            ) : null}
            <label className="block text-xs text-graphite">
              今日工作备注
              <textarea
                className="input-field mt-1 min-h-[56px] w-full text-sm"
                disabled={summary?.flowStatus === 'pending_review' || summary?.flowStatus === 'approved'}
                value={draft.employeeRemark}
                onChange={(e) => setDraft((d) => ({ ...d, employeeRemark: e.target.value }))}
              />
            </label>
            <label className="block text-xs text-graphite">
              今日重点客户
              <input
                className="input-field mt-1 w-full text-sm"
                disabled={summary?.flowStatus === 'pending_review' || summary?.flowStatus === 'approved'}
                value={draft.keyCustomers}
                onChange={(e) => setDraft((d) => ({ ...d, keyCustomers: e.target.value }))}
              />
            </label>
            <label className="block text-xs text-graphite">
              今日问题反馈
              <input
                className="input-field mt-1 w-full text-sm"
                disabled={summary?.flowStatus === 'pending_review' || summary?.flowStatus === 'approved'}
                value={draft.todayIssues}
                onChange={(e) => setDraft((d) => ({ ...d, todayIssues: e.target.value }))}
              />
            </label>
            <label className="block text-xs text-graphite">
              需要主管支持
              <input
                className="input-field mt-1 w-full text-sm"
                disabled={summary?.flowStatus === 'pending_review' || summary?.flowStatus === 'approved'}
                value={draft.needManagerSupport}
                onChange={(e) => setDraft((d) => ({ ...d, needManagerSupport: e.target.value }))}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-primary text-sm"
                disabled={
                  !summary ||
                  summary.flowStatus === 'pending_review' ||
                  summary.flowStatus === 'approved' ||
                  !mergedLive
                }
                onClick={submitForReview}
              >
                确认提交审核
              </button>
              <button
                type="button"
                className="btn-ghost text-sm"
                disabled={summary?.flowStatus === 'pending_review' || summary?.flowStatus === 'approved'}
                onClick={saveNotes}
              >
                保存备注
              </button>
              <button
                type="button"
                className="btn-ghost text-sm"
                onClick={() => {
                  const cur = findSummary(date, staff);
                  if (!cur || !staff) return;
                  const { sources, exceptions } = aggregateKpiFromSources(date, staff);
                  upsertSummary({ ...cur, sourceSummary: sources, exceptions, dataRefreshedAt: isoNow(), updatedAt: isoNow() });
                  reload();
                }}
              >
                刷新汇总
              </button>
            </div>
          </Card>

          {/* 手动补录 */}
          <Card className="border border-dashed border-ash p-4 space-y-3">
            <h3 className="font-display text-base font-semibold text-coal-ink">手动补录（需原因+凭证，主管通过后才计入）</h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-xs text-graphite">
                类型
                <select className="input-field mt-1 w-full text-sm" value={manualType} onChange={(e) => setManualType(e.target.value)}>
                  {ADJUST_TYPES.map((t) => (
                    <option key={t.v} value={t.v}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-graphite">
                数值
                <input
                  type="number"
                  className="input-field mt-1 w-full text-sm"
                  value={manualValue}
                  onChange={(e) => setManualValue(e.target.value)}
                />
              </label>
              <label className="text-xs text-graphite sm:col-span-2">
                原因（必填）
                <input className="input-field mt-1 w-full text-sm" value={manualReason} onChange={(e) => setManualReason(e.target.value)} />
              </label>
              <label className="text-xs text-graphite sm:col-span-2">
                备注
                <input className="input-field mt-1 w-full text-sm" value={manualNote} onChange={(e) => setManualNote(e.target.value)} />
              </label>
              <label className="text-xs text-graphite sm:col-span-2">
                凭证截图（必填）
                <input type="file" accept="image/*" multiple className="mt-1 block text-sm" onChange={(e) => setManualFiles(e.target.files)} />
              </label>
            </div>
            <button type="button" className="btn-ghost text-sm" onClick={() => void addManualAdjustment()}>
              提交补录申请
            </button>

            {adjustments.filter((a) => a.date === date && a.employeeName === staff).length ? (
              <div className="mt-2 overflow-x-auto">
                <table className="min-w-[640px] w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-ash text-graphite">
                      <th className="py-2 text-left">类型</th>
                      <th className="py-2 text-left">值</th>
                      <th className="py-2 text-left">状态</th>
                      <th className="py-2 text-left">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adjustments
                      .filter((a) => a.date === date && a.employeeName === staff)
                      .map((a) => (
                        <tr key={a.id} className="border-b border-ash/70">
                          <td className="py-2">{a.adjustType}</td>
                          <td className="py-2">{a.value}</td>
                          <td className="py-2">{a.auditStatus}</td>
                          <td className="py-2">
                            {isSupervisor && a.auditStatus === 'pending_review' ? (
                              <span className="space-x-2">
                                <button type="button" className="text-emerald-800 underline" onClick={() => approveAdjustment(a)}>
                                  通过
                                </button>
                                <button
                                  type="button"
                                  className="text-red-700 underline"
                                  onClick={() => {
                                    const rs = window.prompt('驳回原因');
                                    if (rs) rejectAdjustment(a, rs);
                                  }}
                                >
                                  驳回
                                </button>
                              </span>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </Card>

          {/* 主管当日列表 */}
          {isSupervisor ? (
            <Card className="border border-ash p-4">
              <h3 className="font-display text-base font-semibold text-coal-ink">
                当日审核队列 · {date}（待审 {daySummaries.filter((s) => s.flowStatus === 'pending_review').length}）
              </h3>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-[720px] w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-ash bg-ash/40 text-left text-xs text-graphite">
                      <th className="px-2 py-2">客服</th>
                      <th className="px-2 py-2">状态</th>
                      <th className="px-2 py-2">提交时间</th>
                      <th className="px-2 py-2">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {daySummaries.map((row) => (
                      <tr key={row.id} className="border-b border-ash/80">
                        <td className="px-2 py-2">{row.employeeName}</td>
                        <td className="px-2 py-2">{FLOW_LABEL[row.flowStatus]}</td>
                        <td className="px-2 py-2 text-xs">{row.submittedAt?.slice(0, 19) ?? '—'}</td>
                        <td className="px-2 py-2 whitespace-nowrap">
                          {row.flowStatus === 'pending_review' ? (
                            <span className="space-x-2">
                              <button type="button" className="text-emerald-800 underline text-xs" onClick={() => supervisorApprove(row)}>
                                通过
                              </button>
                              <button type="button" className="text-red-700 underline text-xs" onClick={() => setRejectOpen(row)}>
                                驳回
                              </button>
                            </span>
                          ) : (
                            <span className="text-stone text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pendingAdj.length ? (
                <p className="mt-2 text-xs text-amber-900">另有 {pendingAdj.length} 条手动补录待审核。</p>
              ) : null}
            </Card>
          ) : null}
        </>
      )}

      {rejectOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
          <Card className="max-w-md border border-ash bg-white p-4 shadow-xl">
            <h4 className="font-semibold text-coal-ink">驳回 KPI 汇总</h4>
            <p className="mt-2 text-xs text-graphite">{rejectOpen.employeeName}</p>
            <textarea
              className="input-field mt-3 min-h-[80px] w-full text-sm"
              placeholder="驳回原因"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" className="btn-ghost text-sm" onClick={() => setRejectOpen(null)}>
                取消
              </button>
              <button type="button" className="btn-primary text-sm" onClick={supervisorReject}>
                确认驳回
              </button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
