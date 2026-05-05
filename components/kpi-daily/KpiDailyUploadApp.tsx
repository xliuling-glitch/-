'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { KpiDailyAuditStatus, KpiDailySubmission } from '@/lib/kpi-daily/types';
import { buildKpiAlerts, withDerivedMetrics } from '@/lib/kpi-daily/compute';
import {
  KPI_DAILY_CENTER_KEY,
  getInitialKpiDailyCenter,
  kpiSubmissionStatsForDate,
  loadKpiDailyCenter,
  normalizeKpiSubmission,
  persistKpiDailyCenterIfDirty,
} from '@/lib/kpi-daily/storage';
import { kpiAuditToWorkflow } from '@/lib/kpi-daily/status-map';
import { syncKpiSubmissionToTodayTasks } from '@/lib/kpi-daily/today-task-bridge';
import { WORKSPACE_STORAGE_UPDATED } from '@/lib/workspace-events';
import { KpiSubmissionDetailPanel } from '@/components/kpi-daily/KpiSubmissionDetailPanel';
import { formatAmountYuan } from '@/lib/format-amount';
import { WorkflowStatusBadge } from '@/components/workflow-status-badge';
import { Card } from '@/components/ui';

const AUDIT_OPTIONS: { v: KpiDailyAuditStatus | 'all'; label: string }[] = [
  { v: 'all', label: '全部状态' },
  { v: 'draft', label: '草稿' },
  { v: 'pending_review', label: '待审核' },
  { v: 'approved', label: '已通过' },
  { v: 'rejected', label: '已驳回' },
];

const TASK_TYPES = ['综合日报', '专项活动', '新店磨合', '大促复盘', '其他'];

function rid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `kpi-${Date.now()}`;
}

function newDraft(date: string, employeeName: string): KpiDailySubmission {
  const id = rid();
  const now = new Date().toISOString();
  return normalizeKpiSubmission({
    id,
    date,
    employeeName,
    shift: 'day',
    storeName: '',
    taskType: '综合日报',
    remark: '',
    aiUseCount: 0,
    aiScriptCount: 0,
    aiCaseCount: 0,
    aiRemark: '',
    aiProofImages: [],
    todayLeadCount: 0,
    leadA: 0,
    leadB: 0,
    leadC: 0,
    invalidLead: 0,
    leadRemark: '',
    shouldCallCount: 0,
    calledCount: 0,
    validCallCount: 0,
    advancedCustomerCount: 0,
    overdueFollowCount: 0,
    callRemark: '',
    orderCount: 0,
    salesAmount: 0,
    refundAmount: 0,
    netSalesAmount: 0,
    salesRemark: '',
    textReviewCount: 0,
    imageReviewCount: 0,
    videoReviewCount: 0,
    followReviewCount: 0,
    reviewScoreCount: 0,
    reviewRemark: '',
    reviewProofImages: [],
    proofImages: [],
    aiTotalScore: 0,
    highQualityLeadScore: 0,
    callCompletionRate: null,
    validCallRate: null,
    effectiveReviewScore: 0,
    auditStatus: 'draft',
    rejectReason: '',
    auditor: '',
    managerRemark: '',
    submittedAt: null,
    createdAt: now,
    updatedAt: now,
  });
}

async function filesToDataUrls(files: File[], cap: number): Promise<string[]> {
  const out: string[] = [];
  for (const f of files.slice(0, cap)) {
    if (!f.type.startsWith('image/')) continue;
    const url = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(new Error('read'));
      fr.readAsDataURL(f);
    });
    out.push(url);
    if (out.length >= cap) break;
  }
  return out;
}

type SessionUser = { name: string; role: string } | null;

export function KpiDailyUploadApp() {
  const [filterDate, setFilterDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [filterStaff, setFilterStaff] = useState('');
  const [filterAudit, setFilterAudit] = useState<KpiDailyAuditStatus | 'all'>('all');
  const [filterShop, setFilterShop] = useState('');
  const [filterTaskType, setFilterTaskType] = useState('');
  const [submissions, setSubmissions] = useState<KpiDailySubmission[]>([]);
  const [roster, setRoster] = useState<string[]>([]);
  const [shops, setShops] = useState<string[]>([]);
  const [user, setUser] = useState<SessionUser>(null);
  const [form, setForm] = useState<KpiDailySubmission>(() => newDraft(filterDate, ''));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewRow, setViewRow] = useState<KpiDailySubmission | null>(null);
  const [rejectRow, setRejectRow] = useState<KpiDailySubmission | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState('');
  /** 避免首屏 submissions 仍为 [] 时写入空数据，并与 persist 去重配合打断 emit 自循环 */
  const [storeReady, setStoreReady] = useState(false);

  const isSupervisor = user?.role === 'admin' || user?.role === 'manager';

  useEffect(() => {
    setSubmissions(getInitialKpiDailyCenter().submissions);
    setStoreReady(true);
  }, []);

  useEffect(() => {
    const onWs = () => setSubmissions(loadKpiDailyCenter().submissions);
    window.addEventListener(WORKSPACE_STORAGE_UPDATED, onWs);
    return () => window.removeEventListener(WORKSPACE_STORAGE_UPDATED, onWs);
  }, []);

  useEffect(() => {
    if (!storeReady) return;
    persistKpiDailyCenterIfDirty(submissions);
  }, [submissions, storeReady]);

  useEffect(() => {
    fetch('/api/options')
      .then((r) => r.json())
      .then((d) => {
        setRoster(Array.isArray(d.staff_roster) ? d.staff_roster : []);
        setShops(Array.isArray(d.shops) ? d.shops : []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/session', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        const u = d?.user;
        if (u && typeof u.name === 'string') setUser({ name: u.name, role: String(u.role || '') });
        else setUser(null);
      })
      .catch(() => setUser(null));
  }, []);

  const stats = useMemo(() => {
    const st = kpiSubmissionStatsForDate(submissions, filterDate, roster.length);
    return st;
  }, [submissions, filterDate, roster.length]);

  const filteredList = useMemo(() => {
    return submissions.filter((r) => {
      if (r.date !== filterDate) return false;
      if (filterStaff && r.employeeName !== filterStaff) return false;
      if (filterAudit !== 'all' && r.auditStatus !== filterAudit) return false;
      if (filterShop.trim() && !r.storeName.includes(filterShop.trim())) return false;
      if (filterTaskType.trim() && !r.taskType.includes(filterTaskType.trim())) return false;
      return true;
    });
  }, [submissions, filterDate, filterStaff, filterAudit, filterShop, filterTaskType]);

  const topAlerts = useMemo(() => {
    const lines: string[] = [];
    if (!filterStaff || !roster.includes(filterStaff)) return lines;
    const mine = submissions.filter((s) => s.date === filterDate && s.employeeName === filterStaff);
    const hasNonDraft = mine.some((s) => s.auditStatus !== 'draft');
    if (mine.length === 0) {
      lines.push(`${filterStaff} 在 ${filterDate} 尚未上传 KPI 日报。`);
    } else if (!hasNonDraft) {
      lines.push(`${filterStaff} 有草稿尚未提交审核。`);
    }
    for (const r of mine) {
      lines.push(...buildKpiAlerts(r));
    }
    return [...new Set(lines)].slice(0, 10);
  }, [submissions, filterDate, filterStaff, roster]);

  const upsert = useCallback((r: KpiDailySubmission) => {
    const next = normalizeKpiSubmission({ ...r, updatedAt: new Date().toISOString() });
    setSubmissions((list) => {
      const i = list.findIndex((x) => x.id === next.id);
      if (i >= 0) {
        const cp = [...list];
        cp[i] = next;
        return cp;
      }
      return [next, ...list];
    });
    return next;
  }, []);

  const applyFormDerived = useCallback((f: KpiDailySubmission) => normalizeKpiSubmission(withDerivedMetrics(f) as KpiDailySubmission), []);

  const setFormField = <K extends keyof KpiDailySubmission>(key: K, value: KpiDailySubmission[K]) => {
    setForm((prev) => applyFormDerived({ ...prev, [key]: value }));
  };

  const onPickImages = async (field: 'aiProofImages' | 'reviewProofImages', e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    e.target.value = '';
    if (!files?.length) return;
    const add = await filesToDataUrls([...files], 6);
    setForm((prev) =>
      applyFormDerived({
        ...prev,
        [field]: [...(prev[field] as string[]), ...add].slice(0, 8),
      }),
    );
  };

  const resetForm = () => {
    const name = !isSupervisor && user?.name ? user.name : '';
    setForm(newDraft(filterDate, name));
    setEditingId(null);
  };

  useEffect(() => {
    if (editingId) return;
    if (user?.name && !isSupervisor) {
      setForm((f) => applyFormDerived({ ...f, employeeName: user.name }));
    }
  }, [user, isSupervisor, editingId, applyFormDerived]);

  const canEditRecord = (r: KpiDailySubmission) => {
    if (isSupervisor) return true;
    if (!user?.name) return true;
    return r.employeeName === user.name;
  };

  const saveDraft = () => {
    const f = applyFormDerived({ ...form, auditStatus: 'draft', submittedAt: null });
    if (!f.employeeName.trim()) {
      window.alert('请填写客服姓名');
      return;
    }
    if (!f.storeName.trim()) {
      window.alert('请选择或填写所属店铺');
      return;
    }
    upsert(f);
    window.alert('已保存草稿');
    resetForm();
  };

  const submitForReview = () => {
    let f = applyFormDerived({
      ...form,
      auditStatus: 'pending_review',
      submittedAt: new Date().toISOString(),
      rejectReason: '',
    });
    if (!f.employeeName.trim()) {
      window.alert('请填写客服姓名');
      return;
    }
    if (!isSupervisor && user?.name && f.employeeName !== user.name) {
      window.alert('只能以自己的名义提交');
      return;
    }
    if (!f.storeName.trim()) {
      window.alert('请选择或填写所属店铺');
      return;
    }
    f =     upsert(f);
    syncKpiSubmissionToTodayTasks({ employeeName: f.employeeName, date: f.date, auditStatus: 'pending_review' });
    window.alert('已提交审核，状态为「待审核」；已与「今日任务中心」KPI 任务同步。');
    resetForm();
  };

  const startEdit = (r: KpiDailySubmission) => {
    if (!canEditRecord(r) && !isSupervisor) {
      window.alert('无权编辑他人数据');
      return;
    }
    setEditingId(r.id);
    setForm(normalizeKpiSubmission({ ...r }));
  };

  const saveEdit = () => {
    if (!editingId) return;
    const prev = submissions.find((x) => x.id === editingId);
    if (!prev) return;
    const f = applyFormDerived({ ...form, id: editingId, createdAt: prev.createdAt });
    upsert(f);
    if (f.auditStatus === 'pending_review') {
      syncKpiSubmissionToTodayTasks({ employeeName: f.employeeName, date: f.date, auditStatus: 'pending_review' });
    }
    if (f.auditStatus === 'approved') {
      syncKpiSubmissionToTodayTasks({ employeeName: f.employeeName, date: f.date, auditStatus: 'approved' });
    }
    if (f.auditStatus === 'rejected') {
      syncKpiSubmissionToTodayTasks({
        employeeName: f.employeeName,
        date: f.date,
        auditStatus: 'rejected',
        rejectReason: f.rejectReason,
      });
    }
    resetForm();
  };

  const resubmitAfterReject = () => {
    if (!editingId) return;
    const prev = submissions.find((x) => x.id === editingId);
    if (!prev || prev.auditStatus !== 'rejected') return;
    const f = applyFormDerived({
      ...form,
      id: editingId,
      createdAt: prev.createdAt,
      auditStatus: 'pending_review',
      rejectReason: '',
      submittedAt: new Date().toISOString(),
    });
    upsert(f);
    syncKpiSubmissionToTodayTasks({ employeeName: f.employeeName, date: f.date, auditStatus: 'pending_review' });
    window.alert('已重新提交审核');
    resetForm();
  };

  const approveRow = (r: KpiDailySubmission) => {
    if (!isSupervisor) return;
    const auditor = user?.name || '主管';
    const next = normalizeKpiSubmission({
      ...r,
      auditStatus: 'approved',
      auditor,
      updatedAt: new Date().toISOString(),
    });
    upsert(next);
    syncKpiSubmissionToTodayTasks({ employeeName: next.employeeName, date: next.date, auditStatus: 'approved' });
    window.alert('已通过');
  };

  const openReject = (r: KpiDailySubmission) => {
    setRejectRow(r);
    setRejectReasonInput(r.rejectReason || '');
  };

  const confirmReject = () => {
    if (!rejectRow) return;
    if (!rejectReasonInput.trim()) {
      window.alert('请填写驳回原因');
      return;
    }
    const auditor = user?.name || '主管';
    const next = normalizeKpiSubmission({
      ...rejectRow,
      auditStatus: 'rejected',
      rejectReason: rejectReasonInput.trim(),
      auditor,
      updatedAt: new Date().toISOString(),
    });
    upsert(next);
    syncKpiSubmissionToTodayTasks({
      employeeName: next.employeeName,
      date: next.date,
      auditStatus: 'rejected',
      rejectReason: rejectReasonInput.trim(),
    });
    setRejectRow(null);
    window.alert('已驳回');
  };

  const removeRow = (r: KpiDailySubmission) => {
    if (!isSupervisor && (!user?.name || r.employeeName !== user.name)) {
      window.alert('仅能删除本人草稿或未提交数据');
      return;
    }
    if (r.auditStatus !== 'draft' && !isSupervisor) {
      window.alert('仅草稿可由本人删除；其他状态请联系主管');
      return;
    }
    if (!window.confirm('确定删除该条记录？')) return;
    setSubmissions((list) => list.filter((x) => x.id !== r.id));
  };

  const derivedBar = useMemo(() => {
    const d = withDerivedMetrics(form);
    return (
      <div className="grid gap-2 rounded-lg border border-ash bg-white/80 p-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <span className="text-xs text-graphite">AI 合计分</span>
          <div className="font-display text-xl font-bold text-coal-ink tabular-nums">{d.aiTotalScore}</div>
        </div>
        <div>
          <span className="text-xs text-graphite">高质量留资分</span>
          <div className="font-display text-xl font-bold text-emerald-800 tabular-nums">{d.highQualityLeadScore.toFixed(2)}</div>
        </div>
        <div>
          <span className="text-xs text-graphite">电联完成率 / 有效电联率</span>
          <div className="font-display text-xl font-bold text-sky-800 tabular-nums">
            {d.callCompletionRate != null ? `${d.callCompletionRate}%` : '—'} / {d.validCallRate != null ? `${d.validCallRate}%` : '—'}
          </div>
        </div>
        <div>
          <span className="text-xs text-graphite">净销售额</span>
          <div className="font-display text-xl font-bold text-amber-900 tabular-nums">{formatAmountYuan(d.netSalesAmount)}</div>
        </div>
        <div>
          <span className="text-xs text-graphite">有效评价计数</span>
          <div className="font-display text-xl font-bold text-violet-800 tabular-nums">{d.effectiveReviewScore.toFixed(2)}</div>
        </div>
      </div>
    );
  }, [form]);

  return (
    <div className="space-y-5">
      {topAlerts.length > 0 ? (
        <div className="rounded-[10px] border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <strong className="block text-xs font-semibold uppercase tracking-wide text-amber-900">异常 / 提醒</strong>
          <ul className="mt-2 list-inside list-disc space-y-1">
            {topAlerts.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {[
          ['今日应上传人数', stats.expected, 'text-coal-ink'],
          ['已上传人数', stats.uploaded, 'text-emerald-700'],
          ['未上传人数', stats.notUploaded, 'text-stone'],
          ['待审核记录', stats.pending, 'text-amber-800'],
          ['已通过', stats.approved, 'text-emerald-800'],
          ['已驳回', stats.rejected, 'text-rose-800'],
        ].map(([label, val, cls]) => (
          <Card key={String(label)} elevated className="p-4">
            <div className="text-xs text-slate-mid">{label}</div>
            <div className={`mt-1 font-display text-2xl font-bold tabular-nums ${cls}`}>{val}</div>
          </Card>
        ))}
      </div>

      <div className="rounded-[10px] border border-ash bg-ledger-white p-4">
        <h3 className="text-sm font-semibold text-coal-ink">筛选</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-xs text-graphite">
            日期
            <input type="date" className="input-field mt-1 block w-full text-sm" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
          </label>
          <label className="text-xs text-graphite">
            客服
            <select className="input-field mt-1 block w-full text-sm" value={filterStaff} onChange={(e) => setFilterStaff(e.target.value)}>
              <option value="">全部</option>
              {roster.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-graphite">
            审核状态
            <select className="input-field mt-1 block w-full text-sm" value={filterAudit} onChange={(e) => setFilterAudit(e.target.value as KpiDailyAuditStatus | 'all')}>
              {AUDIT_OPTIONS.map((o) => (
                <option key={o.v} value={o.v}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-graphite">
            店铺
            <input className="input-field mt-1 block w-full text-sm" value={filterShop} onChange={(e) => setFilterShop(e.target.value)} placeholder="关键字" />
          </label>
          <label className="text-xs text-graphite">
            任务类型
            <input className="input-field mt-1 block w-full text-sm" value={filterTaskType} onChange={(e) => setFilterTaskType(e.target.value)} placeholder="关键字" />
          </label>
        </div>
        <p className="mt-2 text-xs text-stone">
          数据保存在 LocalStorage（<code className="rounded bg-ash px-1">{KPI_DAILY_CENTER_KEY}</code>，别名 daily_kpi_uploads）。提交后为「待审核」；仅「已通过」计入主管看板今日统计。任务类型为「KPI上传」的今日任务在提交 KPI 后自动闭环。
          {isSupervisor ? <span className="ml-2 text-emerald-800">当前为管理/主管身份，可审核全部记录。</span> : null}
        </p>
      </div>

      <Card elevated className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ash pb-3">
          <h3 className="font-display text-base font-bold text-coal-ink">{editingId ? '编辑 KPI 日报' : '新建 KPI 日报'}</h3>
          <button type="button" className="btn-ghost text-sm" onClick={resetForm}>
            清空表单
          </button>
        </div>
        <div className="mt-4 space-y-4">
          <section>
            <h4 className="text-xs font-bold uppercase tracking-wide text-graphite">基础信息</h4>
            <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-xs text-graphite">
                日期
                <input type="date" className="input-field mt-1 block w-full text-sm" value={form.date} onChange={(e) => setFormField('date', e.target.value)} />
              </label>
              <label className="text-xs text-graphite">
                客服姓名
                <select
                  className="input-field mt-1 block w-full text-sm"
                  value={form.employeeName}
                  disabled={!isSupervisor && !!user?.name}
                  onChange={(e) => setFormField('employeeName', e.target.value)}
                >
                  <option value="">请选择</option>
                  {roster.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                {!isSupervisor && user?.name ? <span className="mt-1 block text-[10px] text-stone">已锁定为当前登录用户</span> : null}
              </label>
              <label className="text-xs text-graphite">
                班次
                <select className="input-field mt-1 block w-full text-sm" value={form.shift} onChange={(e) => setFormField('shift', e.target.value as 'day' | 'night')}>
                  <option value="day">白班</option>
                  <option value="night">晚班</option>
                </select>
              </label>
              <label className="text-xs text-graphite">
                所属店铺
                <input className="input-field mt-1 block w-full text-sm" list="kpi-shop-list" value={form.storeName} onChange={(e) => setFormField('storeName', e.target.value)} />
                <datalist id="kpi-shop-list">
                  {shops.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </label>
              <label className="text-xs text-graphite">
                任务类型
                <select className="input-field mt-1 block w-full text-sm" value={form.taskType} onChange={(e) => setFormField('taskType', e.target.value)}>
                  {TASK_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-graphite sm:col-span-2 lg:col-span-3">
                备注
                <input className="input-field mt-1 block w-full text-sm" value={form.remark} onChange={(e) => setFormField('remark', e.target.value)} />
              </label>
            </div>
          </section>

          <section className="rounded-lg border border-ash/80 bg-[#fafafa] p-3">
            <h4 className="text-xs font-bold uppercase tracking-wide text-graphite">AI 智能体运用</h4>
            <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-xs text-graphite">
                AI 使用次数
                <input type="number" min={0} className="input-field mt-1 block w-full text-sm tabular-nums" value={form.aiUseCount} onChange={(e) => setFormField('aiUseCount', Number(e.target.value))} />
              </label>
              <label className="text-xs text-graphite">
                AI 优化话术数量
                <input type="number" min={0} className="input-field mt-1 block w-full text-sm tabular-nums" value={form.aiScriptCount} onChange={(e) => setFormField('aiScriptCount', Number(e.target.value))} />
              </label>
              <label className="text-xs text-graphite">
                AI 案例沉淀数量
                <input type="number" min={0} className="input-field mt-1 block w-full text-sm tabular-nums" value={form.aiCaseCount} onChange={(e) => setFormField('aiCaseCount', Number(e.target.value))} />
              </label>
              <label className="text-xs text-graphite sm:col-span-2 lg:col-span-4">
                AI 使用说明
                <textarea className="input-field mt-1 min-h-[4rem] w-full text-sm" value={form.aiRemark} onChange={(e) => setFormField('aiRemark', e.target.value)} />
              </label>
              <div className="sm:col-span-2 lg:col-span-4">
                <span className="text-xs text-graphite">AI 使用截图 / 案例截图</span>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <label className="btn-ghost cursor-pointer text-xs">
                    选择图片
                    <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => void onPickImages('aiProofImages', e)} />
                  </label>
                  <span className="text-[10px] text-stone">本地预览（data URL），最多 8 张</span>
                </div>
                {form.aiProofImages.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {form.aiProofImages.map((src, i) => (
                      <div key={i} className="relative h-16 w-16 overflow-hidden rounded border border-ash bg-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt="" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          className="absolute right-0 top-0 rounded-bl bg-black/60 px-1 text-[10px] text-white"
                          onClick={() =>
                            setForm((prev) =>
                              applyFormDerived({ ...prev, aiProofImages: prev.aiProofImages.filter((_, j) => j !== i) }),
                            )
                          }
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-ash/80 bg-[#fafafa] p-3">
            <h4 className="text-xs font-bold uppercase tracking-wide text-graphite">高质量留资</h4>
            <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-xs text-graphite">
                今日留资数量
                <input type="number" min={0} className="input-field mt-1 block w-full text-sm tabular-nums" value={form.todayLeadCount} onChange={(e) => setFormField('todayLeadCount', Number(e.target.value))} />
                <span className="mt-1 block text-[10px] text-stone">留 0 则列表按 A+B+C+无效 自动合计展示</span>
              </label>
              <label className="text-xs text-graphite">
                A 类留资
                <input type="number" min={0} className="input-field mt-1 block w-full text-sm tabular-nums" value={form.leadA} onChange={(e) => setFormField('leadA', Number(e.target.value))} />
              </label>
              <label className="text-xs text-graphite">
                B 类留资
                <input type="number" min={0} className="input-field mt-1 block w-full text-sm tabular-nums" value={form.leadB} onChange={(e) => setFormField('leadB', Number(e.target.value))} />
              </label>
              <label className="text-xs text-graphite">
                C 类留资
                <input type="number" min={0} className="input-field mt-1 block w-full text-sm tabular-nums" value={form.leadC} onChange={(e) => setFormField('leadC', Number(e.target.value))} />
              </label>
              <label className="text-xs text-graphite">
                无效留资
                <input type="number" min={0} className="input-field mt-1 block w-full text-sm tabular-nums" value={form.invalidLead} onChange={(e) => setFormField('invalidLead', Number(e.target.value))} />
              </label>
              <label className="text-xs text-graphite sm:col-span-2 lg:col-span-3">
                留资客户备注
                <textarea className="input-field mt-1 min-h-[3.5rem] w-full text-sm" value={form.leadRemark} onChange={(e) => setFormField('leadRemark', e.target.value)} />
              </label>
            </div>
          </section>

          <section className="rounded-lg border border-ash/80 bg-[#fafafa] p-3">
            <h4 className="text-xs font-bold uppercase tracking-wide text-graphite">电联追单</h4>
            <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(
                [
                  ['应电联客户数', 'shouldCallCount'],
                  ['已电联客户数', 'calledCount'],
                  ['有效电联数', 'validCallCount'],
                  ['推进客户数', 'advancedCustomerCount'],
                  ['逾期未跟进数', 'overdueFollowCount'],
                ] as const
              ).map(([label, key]) => (
                <label key={key} className="text-xs text-graphite">
                  {label}
                  <input
                    type="number"
                    min={0}
                    className="input-field mt-1 block w-full text-sm tabular-nums"
                    value={form[key]}
                    onChange={(e) => setFormField(key, Number(e.target.value))}
                  />
                </label>
              ))}
              <label className="text-xs text-graphite sm:col-span-2 lg:col-span-3">
                电联备注
                <textarea className="input-field mt-1 min-h-[3.5rem] w-full text-sm" value={form.callRemark} onChange={(e) => setFormField('callRemark', e.target.value)} />
              </label>
            </div>
          </section>

          <section className="rounded-lg border border-ash/80 bg-[#fafafa] p-3">
            <h4 className="text-xs font-bold uppercase tracking-wide text-graphite">销售额</h4>
            <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-xs text-graphite">
                当日成交订单数
                <input type="number" min={0} className="input-field mt-1 block w-full text-sm tabular-nums" value={form.orderCount} onChange={(e) => setFormField('orderCount', Number(e.target.value))} />
              </label>
              <label className="text-xs text-graphite">
                当日销售额
                <input type="number" min={0} className="input-field mt-1 block w-full text-sm tabular-nums" value={form.salesAmount} onChange={(e) => setFormField('salesAmount', Number(e.target.value))} />
              </label>
              <label className="text-xs text-graphite">
                退款金额
                <input type="number" min={0} className="input-field mt-1 block w-full text-sm tabular-nums" value={form.refundAmount} onChange={(e) => setFormField('refundAmount', Number(e.target.value))} />
              </label>
              <div className="text-xs text-graphite">
                净销售额（自动）
                <div className="input-field mt-1 bg-ash/40 font-display text-lg font-bold tabular-nums text-coal-ink">
                  {formatAmountYuan(withDerivedMetrics(form).netSalesAmount)}
                </div>
              </div>
              <label className="text-xs text-graphite sm:col-span-2 lg:col-span-4">
                重点成交客户备注
                <textarea className="input-field mt-1 min-h-[3.5rem] w-full text-sm" value={form.salesRemark} onChange={(e) => setFormField('salesRemark', e.target.value)} />
              </label>
            </div>
          </section>

          <section className="rounded-lg border border-ash/80 bg-[#fafafa] p-3">
            <h4 className="text-xs font-bold uppercase tracking-wide text-graphite">客户评价</h4>
            <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(
                [
                  ['普通文字评价数', 'textReviewCount'],
                  ['图片评价数', 'imageReviewCount'],
                  ['视频评价数', 'videoReviewCount'],
                  ['追评数量', 'followReviewCount'],
                ] as const
              ).map(([label, key]) => (
                <label key={key} className="text-xs text-graphite">
                  {label}
                  <input
                    type="number"
                    min={0}
                    className="input-field mt-1 block w-full text-sm tabular-nums"
                    value={form[key]}
                    onChange={(e) => setFormField(key, Number(e.target.value))}
                  />
                </label>
              ))}
              <div className="sm:col-span-2 lg:col-span-4">
                <span className="text-xs text-graphite">评价截图上传</span>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <label className="btn-ghost cursor-pointer text-xs">
                    选择图片
                    <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => void onPickImages('reviewProofImages', e)} />
                  </label>
                </div>
                {form.reviewProofImages.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {form.reviewProofImages.map((src, i) => (
                      <div key={i} className="relative h-16 w-16 overflow-hidden rounded border border-ash bg-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt="" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          className="absolute right-0 top-0 rounded-bl bg-black/60 px-1 text-[10px] text-white"
                          onClick={() =>
                            setForm((prev) =>
                              applyFormDerived({ ...prev, reviewProofImages: prev.reviewProofImages.filter((_, j) => j !== i) }),
                            )
                          }
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
              <label className="text-xs text-graphite sm:col-span-2 lg:col-span-4">
                评价备注
                <textarea className="input-field mt-1 min-h-[3.5rem] w-full text-sm" value={form.reviewRemark} onChange={(e) => setFormField('reviewRemark', e.target.value)} />
              </label>
            </div>
          </section>

          {isSupervisor && editingId ? (
            <section className="rounded-lg border border-dashed border-sky-300 bg-sky-50/50 p-3">
              <h4 className="text-xs font-bold text-sky-900">主管审核备注（可修改）</h4>
              <textarea
                className="input-field mt-2 min-h-[3rem] w-full text-sm"
                value={form.managerRemark}
                onChange={(e) => setFormField('managerRemark', e.target.value)}
              />
            </section>
          ) : null}

          {derivedBar}

          <div className="flex flex-wrap gap-2 border-t border-ash pt-4">
            {editingId ? (
              <>
                <button type="button" className="btn-primary text-sm" onClick={saveEdit}>
                  保存修改
                </button>
                {form.auditStatus === 'rejected' && !isSupervisor ? (
                  <button type="button" className="btn-primary text-sm" onClick={resubmitAfterReject}>
                    修改后重新提交审核
                  </button>
                ) : null}
              </>
            ) : (
              <>
                <button type="button" className="btn-ghost text-sm" onClick={saveDraft}>
                  保存草稿
                </button>
                <button type="button" className="btn-primary text-sm" onClick={submitForReview}>
                  提交审核
                </button>
              </>
            )}
            <button type="button" className="btn-ghost text-sm" onClick={resetForm}>
              取消编辑
            </button>
          </div>
        </div>
      </Card>

      <div className="overflow-x-auto rounded-[10px] border border-ash bg-white">
        <table className="w-full min-w-[1100px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-ash bg-ash/50 text-left text-xs font-semibold text-graphite">
              <th className="px-2 py-2">日期</th>
              <th className="px-2 py-2">客服</th>
              <th className="px-2 py-2">班次</th>
              <th className="px-2 py-2">店铺</th>
              <th className="px-2 py-2">AI次数</th>
              <th className="px-2 py-2">留资分</th>
              <th className="px-2 py-2">已电联</th>
              <th className="px-2 py-2">有效电联</th>
              <th className="px-2 py-2">净销售额</th>
              <th className="px-2 py-2">有效评价</th>
              <th className="px-2 py-2">状态</th>
              <th className="max-w-[200px] px-2 py-2">驳回原因</th>
              <th className="px-2 py-2 w-52">操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredList.length === 0 ? (
              <tr>
                <td colSpan={13} className="px-3 py-10 text-center text-stone">
                  暂无记录。请使用上方表单新建，或调整筛选条件。
                </td>
              </tr>
            ) : (
              filteredList.map((r) => (
                <tr key={r.id} className="border-b border-ash/70">
                  <td className="px-2 py-2 tabular-nums text-stone">{r.date}</td>
                  <td className="px-2 py-2 font-medium">{r.employeeName}</td>
                  <td className="px-2 py-2">{r.shift === 'night' ? '晚班' : '白班'}</td>
                  <td className="max-w-[140px] truncate px-2 py-2" title={r.storeName}>
                    {r.storeName}
                  </td>
                  <td className="px-2 py-2 tabular-nums">{r.aiUseCount}</td>
                  <td className="px-2 py-2 tabular-nums">{r.highQualityLeadScore.toFixed(2)}</td>
                  <td className="px-2 py-2 tabular-nums">{r.calledCount}</td>
                  <td className="px-2 py-2 tabular-nums">{r.validCallCount}</td>
                  <td className="px-2 py-2 tabular-nums">{formatAmountYuan(r.netSalesAmount)}</td>
                  <td className="px-2 py-2 tabular-nums">{r.effectiveReviewScore.toFixed(2)}</td>
                  <td className="px-2 py-2">
                    <WorkflowStatusBadge status={kpiAuditToWorkflow(r.auditStatus)} size="sm" />
                  </td>
                  <td className="max-w-[200px] px-2 py-2 text-xs text-rose-800" title={r.rejectReason || ''}>
                    {r.auditStatus === 'rejected' && r.rejectReason ? r.rejectReason : '—'}
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap gap-1 text-xs">
                      <button type="button" className="text-signal-violet underline" onClick={() => setViewRow(r)}>
                        查看
                      </button>
                      {(canEditRecord(r) || isSupervisor) && (
                        <button type="button" className="text-coal-ink underline" onClick={() => startEdit(r)}>
                          编辑
                        </button>
                      )}
                      {isSupervisor && r.auditStatus === 'pending_review' ? (
                        <>
                          <button type="button" className="text-emerald-700 underline" onClick={() => approveRow(r)}>
                            通过
                          </button>
                          <button type="button" className="text-rose-700 underline" onClick={() => openReject(r)}>
                            驳回
                          </button>
                        </>
                      ) : null}
                      <button type="button" className="text-red-600 underline" onClick={() => removeRow(r)}>
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {viewRow ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[12px] border border-ash bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-display text-lg font-bold text-coal-ink">查看 KPI 日报</h3>
              <button type="button" className="btn-ghost text-sm" onClick={() => setViewRow(null)}>
                关闭
              </button>
            </div>
            <KpiSubmissionDetailPanel submission={viewRow} />
          </div>
        </div>
      ) : null}

      {rejectRow ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog">
          <div className="w-full max-w-md rounded-[12px] border border-ash bg-white p-5 shadow-xl">
            <h3 className="font-display text-base font-bold text-coal-ink">驳回原因</h3>
            <p className="mt-1 text-xs text-stone">
              {rejectRow.employeeName} · {rejectRow.date}
            </p>
            <textarea className="input-field mt-3 min-h-[6rem] w-full text-sm" value={rejectReasonInput} onChange={(e) => setRejectReasonInput(e.target.value)} placeholder="请填写驳回原因（必填）" />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn-ghost text-sm" onClick={() => setRejectRow(null)}>
                取消
              </button>
              <button type="button" className="btn-primary text-sm" onClick={confirmReject}>
                确认驳回
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
