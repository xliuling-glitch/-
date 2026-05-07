'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui';
import { cn } from '@/lib/utils';
import {
  aggregateTopCards,
  buildAllInspectionRows,
  buildClosingBoardLines,
  buildSopActionRows,
  buildSopExecExceptions,
  shiftSlotsForInspection,
} from '@/lib/supervisor-sop-dashboard/build-inspection';
import type { SopExecException, SopInspectionRow } from '@/lib/supervisor-sop-dashboard/types';
import { loadExceptionHandles, setExceptionHandle } from '@/lib/supervisor-board/exception-handles';
import type { ExceptionHandleStatus } from '@/lib/supervisor-board/dashboard-types';
import { loadSopTemplates } from '@/lib/shift-sop/storage';
import { isoNow, loadAssignedTasks, saveAssignedTasks } from '@/lib/assigned-tasks/storage';
import type { AssignedTask } from '@/lib/assigned-tasks/types';
import { WORKSPACE_STORAGE_UPDATED } from '@/lib/workspace-events';
import { LS_ASSIGNED_TASKS } from '@/lib/assigned-tasks/storage-keys';
import { LS_SHIFT_SOP_DAILY_OVERRIDES, LS_SHIFT_SOP_PROGRESS, LS_SHIFT_SOP_TEMPLATES } from '@/lib/shift-sop/storage-keys';
import {
  LS_DAILY_INQUIRY_REPORTS,
  LS_DOUYIN_LEAD_FOLLOW_RECORDS,
  LS_LEAD_FOLLOW_RECORDS,
} from '@/lib/lead-follow-hub/storage-keys';
import {
  LS_COMPETITOR_CHAT_RECORDS,
  LS_DAILY_WORK_PACKAGES,
  LS_REVIEW_REGISTER_RECORDS,
} from '@/lib/daily-work-package/storage-keys';
import { STORAGE_KEY_SUPERVISOR_EXCEPTION_HANDLES } from '@/lib/workspace-storage-keys';
import { DEFAULT_LEGACY } from '@/lib/config-center-v2';

/** 接口不可用时用于本地预览；正常仍以 /api/options 的 staff_roster 为准 */
const OPTIONS_FALLBACK_ROSTER = DEFAULT_LEGACY.staff_roster;

function normalizeStaffRoster(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of raw) {
    const n = String(x ?? '').trim();
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

const STATUS_LABEL: Record<SopInspectionRow['status'], string> = {
  normal: '正常',
  in_progress: '进行中',
  warning: '预警',
  abnormal: '异常',
  not_started: '未开始',
};

function statusBadgeClass(s: SopInspectionRow['status']) {
  switch (s) {
    case 'normal':
      return 'bg-emerald-100 text-emerald-900';
    case 'in_progress':
      return 'bg-sky-100 text-sky-900';
    case 'warning':
      return 'bg-amber-100 text-amber-900';
    case 'abnormal':
      return 'bg-red-100 text-red-900';
    case 'not_started':
      return 'bg-slate-200 text-slate-600';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

function actionStatusLabel(s: string) {
  const m: Record<string, string> = {
    not_started: '未开始',
    in_progress: '进行中',
    done: '已完成',
    overdue: '已逾期',
  };
  return m[s] ?? s;
}

function closingStateLabel(s: string) {
  const m: Record<string, string> = {
    done: '已完成',
    pending: '未完成',
    abnormal: '有异常',
    not_due: '未到时间',
  };
  return m[s] ?? s;
}

function sevClass(s: SopExecException['severity']) {
  if (s === 'high') return 'bg-red-50 text-red-800';
  if (s === 'medium') return 'bg-amber-50 text-amber-900';
  return 'bg-slate-100 text-graphite';
}

export function SupervisorSopInspectionApp() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [roster, setRoster] = useState<string[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [handleMap, setHandleMap] = useState(() => loadExceptionHandles());

  const [filterShift, setFilterShift] = useState<'all' | 'day' | 'night'>('all');
  const [filterStaff, setFilterStaff] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | SopInspectionRow['status']>('all');
  const [filterOverdue, setFilterOverdue] = useState<'all' | 'yes' | 'no'>('all');
  const [excCategory, setExcCategory] = useState<string>('all');
  const [excHandle, setExcHandle] = useState<'all' | ExceptionHandleStatus>('all');

  const [detailStaff, setDetailStaff] = useState<SopInspectionRow | null>(null);
  const [rejectModal, setRejectModal] = useState<{ id: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const now = useMemo(() => new Date(), [tick]);

  const refreshHandles = useCallback(() => setHandleMap(loadExceptionHandles()), []);

  useEffect(() => {
    fetch('/api/options')
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error('options not ok');
        const list = normalizeStaffRoster(d.staff_roster);
        setRoster(list);
      })
      .catch(() => setRoster([...OPTIONS_FALLBACK_ROSTER]));
    fetch('/api/session', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        const rr = d?.user?.role;
        setRole(rr != null ? String(rr) : null);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const id = setInterval(() => setTick((x) => x + 1), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const keys = [
      LS_ASSIGNED_TASKS,
      LS_SHIFT_SOP_TEMPLATES,
      LS_SHIFT_SOP_PROGRESS,
      LS_SHIFT_SOP_DAILY_OVERRIDES,
      LS_DAILY_INQUIRY_REPORTS,
      LS_LEAD_FOLLOW_RECORDS,
      LS_DOUYIN_LEAD_FOLLOW_RECORDS,
      LS_REVIEW_REGISTER_RECORDS,
      LS_DAILY_WORK_PACKAGES,
      LS_COMPETITOR_CHAT_RECORDS,
      STORAGE_KEY_SUPERVISOR_EXCEPTION_HANDLES,
    ];
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || keys.includes(e.key as string)) refreshHandles();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [refreshHandles]);

  useEffect(() => {
    const fn = () => refreshHandles();
    window.addEventListener(WORKSPACE_STORAGE_UPDATED, fn);
    return () => window.removeEventListener(WORKSPACE_STORAGE_UPDATED, fn);
  }, [refreshHandles]);

  const canAccess =
    role === 'admin' ||
    role === 'manager' ||
    role === '主管' ||
    role === '管理员' ||
    String(role ?? '').toLowerCase() === 'supervisor';

  const allRows = useMemo(() => buildAllInspectionRows(date, roster, now), [date, roster, now, tick]);

  const filteredRows = useMemo(() => {
    return allRows.filter((r) => {
      if (filterShift === 'day' && r.shiftType !== 'day') return false;
      if (filterShift === 'night' && r.shiftType !== 'night') return false;
      if (filterStaff && r.staffName !== filterStaff) return false;
      if (filterStatus !== 'all' && r.status !== filterStatus) return false;
      if (filterOverdue === 'yes' && !(r.hasAssignedOverdue || r.hasOverdueSopSlot)) return false;
      if (filterOverdue === 'no' && (r.hasAssignedOverdue || r.hasOverdueSopSlot)) return false;
      return true;
    });
  }, [allRows, filterShift, filterStaff, filterStatus, filterOverdue]);

  const exceptionsAll = useMemo(() => buildSopExecExceptions(date, roster, now), [date, roster, now, tick]);

  const excCategories = useMemo(() => {
    const s = new Set(exceptionsAll.map((e) => e.category));
    return ['all', ...Array.from(s)];
  }, [exceptionsAll]);

  const exceptions = useMemo(() => {
    return exceptionsAll.filter((e) => {
      if (excCategory !== 'all' && e.category !== excCategory) return false;
      const hs = handleMap[e.id] ?? 'open';
      if (excHandle === 'open' && hs !== 'open') return false;
      if (excHandle === 'done' && hs !== 'done') return false;
      if (excHandle === 'ignored' && hs !== 'ignored') return false;
      if (filterStaff.trim() && !e.staffName.includes(filterStaff.trim())) return false;
      return true;
    });
  }, [exceptionsAll, excCategory, excHandle, handleMap, filterStaff]);

  const top = useMemo(() => aggregateTopCards(allRows, date, roster, now), [allRows, date, roster, now, tick]);

  const pendingReviews = useMemo(() => {
    return loadAssignedTasks().filter((t) => t.date === date && t.needReview && t.status === 'pending_review');
  }, [date, tick]);

  const markExc = (id: string, status: ExceptionHandleStatus) => {
    setHandleMap(setExceptionHandle(id, status));
  };

  const approveTask = (id: string) => {
    const list = loadAssignedTasks();
    saveAssignedTasks(list.map((t) => (t.id === id ? { ...t, status: 'done' as const, updatedAt: isoNow() } : t)));
    setTick((x) => x + 1);
  };

  const rejectTask = (id: string, reason: string) => {
    const list = loadAssignedTasks();
    saveAssignedTasks(
      list.map((t) => (t.id === id ? { ...t, status: 'rejected' as const, rejectReason: reason, updatedAt: isoNow() } : t)),
    );
    setRejectModal(null);
    setRejectReason('');
    setTick((x) => x + 1);
  };

  const templates = loadSopTemplates();
  const detailActions = useMemo(() => {
    if (!detailStaff) return [];
    return buildSopActionRows(date, detailStaff.staffName, detailStaff.shiftType, now);
  }, [detailStaff, date, now, tick]);

  const detailClosing = useMemo(() => {
    if (!detailStaff) return [];
    const slots = shiftSlotsForInspection(templates, detailStaff.shiftType);
    return buildClosingBoardLines(date, detailStaff.staffName, slots, now);
  }, [detailStaff, date, now, templates, tick]);

  const detailExceptions = useMemo(() => {
    if (!detailStaff) return [];
    return exceptionsAll.filter((e) => e.staffName === detailStaff.staffName);
  }, [detailStaff, exceptionsAll]);

  const detailTasks = useMemo(() => {
    if (!detailStaff) return [];
    return loadAssignedTasks().filter((t) => t.date === date && t.assignedTo === detailStaff.staffName);
  }, [detailStaff, date, tick]);

  if (!canAccess) {
    return (
      <Card className="border border-amber-200 bg-amber-50/80 p-6 text-sm text-amber-950">
        <p className="font-medium">无权访问</p>
        <p className="mt-2 text-slate-mid">「SOP 执行进度检查台」仅主管与管理员可查看。普通客服请在今日任务中心执行本人任务。</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3 rounded-[10px] border border-ash bg-ledger-white p-3">
        <label className="text-xs text-graphite">
          业务日
          <input type="date" className="input-field mt-1 block text-sm" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="text-xs text-graphite">
          班次
          <select
            className="input-field mt-1 block min-w-[6rem] text-sm"
            value={filterShift}
            onChange={(e) => setFilterShift(e.target.value as 'all' | 'day' | 'night')}
          >
            <option value="all">全部</option>
            <option value="day">白班</option>
            <option value="night">晚班</option>
          </select>
        </label>
        <label className="text-xs text-graphite">
          客服
          <select
            className="input-field mt-1 block min-w-[9rem] text-sm"
            value={filterStaff}
            onChange={(e) => setFilterStaff(e.target.value)}
          >
            <option value="">全部</option>
            {roster.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-graphite">
          状态
          <select
            className="input-field mt-1 block min-w-[7rem] text-sm"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
          >
            <option value="all">全部</option>
            {(Object.keys(STATUS_LABEL) as SopInspectionRow['status'][]).map((k) => (
              <option key={k} value={k}>
                {STATUS_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-graphite">
          逾期
          <select
            className="input-field mt-1 block min-w-[6rem] text-sm"
            value={filterOverdue}
            onChange={(e) => setFilterOverdue(e.target.value as typeof filterOverdue)}
          >
            <option value="all">全部</option>
            <option value="yes">有逾期</option>
            <option value="no">无逾期</option>
          </select>
        </label>
        <div className="text-xs text-stone sm:ml-auto text-right space-y-0.5">
          <p>
            客服名单：<span className="text-graphite">配置中心「员工名单」→</span> <code className="rounded bg-ash px-1">/api/options</code>{' '}
            <code className="rounded bg-ash px-1">staff_roster</code>
            {roster.length ? `（${roster.length} 人）` : '（未配置则总览无行）'}
          </p>
          <p>
            数据：shift_sop_templates / shift_sop_progress / assigned_tasks / daily_inquiry_reports / lead_follow_records / no_deal_inquiry_reflections / review_register_records / douyin_lead_follow_records
          </p>
        </div>
      </div>

      {/* 顶部卡片 */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {(
          [
            ['今日排班人数', String(top.rosterCount), 'text-coal-ink'],
            ['SOP平均完成率', `${top.sopAvgPct}%`, 'text-emerald-800'],
            ['当前异常人数', String(top.abnormalStaffCount), 'text-red-600'],
            ['临时任务待审核', String(top.pendingReviewCount), 'text-amber-900'],
            ['结班必交未完成项', String(top.closingIncompleteCount), 'text-violet-900'],
          ] as const
        ).map(([label, val, cls]) => (
          <Card key={label} elevated className="p-4">
            <div className="text-[11px] text-slate-mid">{label}</div>
            <div className={cn('mt-1 font-display text-xl font-bold tabular-nums', cls)}>{val}</div>
          </Card>
        ))}
      </div>

      {/* 1 今日人员进度总览 */}
      <Card className="border border-ash p-4">
        <h3 className="font-display text-base font-semibold text-coal-ink">今日人员进度总览</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-[1100px] w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-ash bg-ash/40 text-left text-xs text-graphite">
                {[
                  '客服姓名',
                  '班次',
                  '当前SOP节点',
                  '当前时间段',
                  'SOP完成率',
                  '临时任务',
                  '结班必交',
                  '异常数量',
                  '当前状态',
                  '操作',
                ].map((h) => (
                  <th key={h} className="px-2 py-2 font-medium whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-stone">
                    暂无数据。请确认配置中心员工名单与当日业务日。
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => (
                  <tr key={r.staffName} className="border-b border-ash/80">
                    <td className="px-2 py-2 font-medium">{r.staffName}</td>
                    <td className="px-2 py-2">{r.shiftLabel}</td>
                    <td className="px-2 py-2 max-w-[160px] truncate">{r.currentModule}</td>
                    <td className="px-2 py-2 whitespace-nowrap text-xs">{r.currentSlotRange}</td>
                    <td className="px-2 py-2 tabular-nums">{r.sopRatePct}%</td>
                    <td className="px-2 py-2 text-xs">{r.tempTaskSummary}</td>
                    <td className="px-2 py-2 text-xs">{r.dailyReqSummary}</td>
                    <td className="px-2 py-2 tabular-nums">{r.exceptionCount}</td>
                    <td className="px-2 py-2">
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', statusBadgeClass(r.status))}>
                        {STATUS_LABEL[r.status]}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <button type="button" className="text-xs text-sky-800 underline" onClick={() => setDetailStaff(r)}>
                        查看详情
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 3 SOP异常提醒 */}
      <Card className="border border-ash p-4">
        <div className="flex flex-wrap items-end gap-3 border-b border-ash pb-3">
          <h3 className="font-display text-base font-semibold text-coal-ink">SOP异常提醒</h3>
          <label className="text-xs text-graphite">
            类型
            <select className="input-field mt-1 block text-sm" value={excCategory} onChange={(e) => setExcCategory(e.target.value)}>
              {excCategories.map((c) => (
                <option key={c} value={c}>
                  {c === 'all' ? '全部' : c}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-graphite">
            处理
            <select
              className="input-field mt-1 block text-sm"
              value={excHandle}
              onChange={(e) => setExcHandle(e.target.value as typeof excHandle)}
            >
              <option value="all">全部</option>
              <option value="open">未处理</option>
              <option value="done">已处理</option>
              <option value="ignored">忽略</option>
            </select>
          </label>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-[960px] w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-ash bg-ash/40 text-left text-xs text-graphite">
                {['异常时间', '客服', '异常类型', '说明', '严重度', '处理', '操作'].map((h) => (
                  <th key={h} className="px-2 py-2 font-medium whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {exceptions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-stone">
                    当前筛选下暂无异常。
                  </td>
                </tr>
              ) : (
                exceptions.map((e) => {
                  const hs = handleMap[e.id] ?? 'open';
                  return (
                    <tr key={e.id} className="border-b border-ash/70">
                      <td className="px-2 py-2 whitespace-nowrap text-xs text-stone">{e.occurredAt.slice(0, 19).replace('T', ' ')}</td>
                      <td className="px-2 py-2 font-medium">{e.staffName}</td>
                      <td className="px-2 py-2 text-xs">{e.category}</td>
                      <td className="max-w-[280px] px-2 py-2 text-xs text-slate-mid">{e.detail}</td>
                      <td className="px-2 py-2">
                        <span className={cn('rounded px-2 py-0.5 text-[10px] font-semibold', sevClass(e.severity))}>
                          {e.severity === 'high' ? '高' : e.severity === 'medium' ? '中' : '低'}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-xs">{hs === 'done' ? '已处理' : hs === 'ignored' ? '忽略' : '未处理'}</td>
                      <td className="px-2 py-2">
                        <div className="flex flex-wrap gap-1 text-xs">
                          <button type="button" className="text-sky-800 underline" onClick={() => {
                            const row = allRows.find((x) => x.staffName === e.staffName);
                            if (row) setDetailStaff(row);
                          }}>
                            查看详情
                          </button>
                          {hs === 'open' ? (
                            <>
                              <button type="button" className="text-emerald-700 underline" onClick={() => markExc(e.id, 'done')}>
                                标记处理
                              </button>
                              <button type="button" className="text-stone underline" onClick={() => markExc(e.id, 'ignored')}>
                                忽略
                              </button>
                            </>
                          ) : (
                            <button type="button" className="text-stone underline" onClick={() => markExc(e.id, 'open')}>
                              恢复未处理
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 4 临时任务审核 */}
      <Card className="border border-ash p-4">
        <h3 className="font-display text-base font-semibold text-coal-ink">临时任务审核</h3>
        <p className="mt-1 text-xs text-slate-mid">仅展示需主管审核且状态为待审核的临时任务（assigned_tasks）。</p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-[900px] w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-ash bg-ash/40 text-left text-xs text-graphite">
                {['任务名称', '客服', '优先级', '截止', '完成方式', '提交内容', '状态', '操作'].map((h) => (
                  <th key={h} className="px-2 py-2 font-medium whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pendingReviews.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-stone">
                    暂无待审核临时任务。
                  </td>
                </tr>
              ) : (
                pendingReviews.map((t: AssignedTask) => (
                  <tr key={t.id} className="border-b border-ash/80">
                    <td className="px-2 py-2 max-w-[180px]">{t.taskName}</td>
                    <td className="px-2 py-2">{t.assignedTo}</td>
                    <td className="px-2 py-2">{t.priority}</td>
                    <td className="px-2 py-2 whitespace-nowrap text-xs">{t.date}（当日）</td>
                    <td className="px-2 py-2 text-xs max-w-[140px]">{t.completionMethod}</td>
                    <td className="px-2 py-2 text-xs">
                      {t.description ? <span className="line-clamp-2">{t.description}</span> : null}
                      {t.proofImages?.length ? <span className="block text-graphite">截图×{t.proofImages.length}</span> : null}
                      <span className="block tabular-nums">
                        进度 {t.completedCount}/{t.targetCount}
                      </span>
                    </td>
                    <td className="px-2 py-2">待审核</td>
                    <td className="px-2 py-2">
                      <div className="flex flex-col gap-1">
                        <button type="button" className="btn-primary text-xs py-1" onClick={() => approveTask(t.id)}>
                          通过
                        </button>
                        <button type="button" className="btn-ghost text-xs text-red-800" onClick={() => setRejectModal({ id: t.id })}>
                          驳回
                        </button>
                        <button
                          type="button"
                          className="btn-ghost text-xs"
                          onClick={() => {
                            const row = allRows.find((x) => x.staffName === t.assignedTo);
                            if (row) setDetailStaff(row);
                          }}
                        >
                          查看客服
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 抽屉：客服个人进度详情 */}
      {detailStaff ? (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/40 p-2 sm:p-4"
          role="dialog"
          onClick={() => setDetailStaff(null)}
        >
          <div
            className="flex h-full w-full max-w-lg flex-col overflow-hidden rounded-l-xl border border-ash bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-ash px-4 py-3">
              <h4 className="font-display text-base font-bold text-coal-ink">客服进度详情 · {detailStaff.staffName}</h4>
              <button type="button" className="btn-ghost text-sm" onClick={() => setDetailStaff(null)}>
                关闭
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 text-sm">
              <div className="grid gap-2 rounded-lg border border-ash bg-ash/20 p-3 text-xs">
                <div>
                  <span className="text-graphite">班次：</span>
                  {detailStaff.shiftLabel}
                </div>
                <div>
                  <span className="text-graphite">当前SOP节点：</span>
                  {detailStaff.currentModule}
                </div>
                <div>
                  <span className="text-graphite">当前时间段：</span>
                  {detailStaff.currentSlotRange}
                </div>
                <div>
                  <span className="text-graphite">SOP完成率：</span>
                  {detailStaff.sopRatePct}%（必做 {detailStaff.requiredDone}/{detailStaff.requiredTotal}）
                </div>
                <div>
                  <span className="text-graphite">未完成必做：</span>
                  {detailStaff.requiredTotal - detailStaff.requiredDone}
                </div>
                <div>
                  <span className="text-graphite">逾期动作数：</span>
                  {detailStaff.overdueActionCount}
                </div>
              </div>

              <div>
                <h5 className="font-semibold text-coal-ink">今日异常</h5>
                {detailExceptions.length === 0 ? (
                  <p className="mt-1 text-xs text-stone">无</p>
                ) : (
                  <ul className="mt-1 list-inside list-disc text-xs text-slate-mid">
                    {detailExceptions.map((e) => (
                      <li key={e.id}>
                        【{e.category}】{e.detail}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h5 className="font-semibold text-coal-ink">结班必交项检查</h5>
                <ul className="mt-2 space-y-1 text-xs">
                  {detailClosing.map((line) => (
                    <li key={line.key} className="flex justify-between gap-2 border-b border-ash/40 py-1">
                      <span>{line.label}</span>
                      <span
                        className={cn(
                          line.state === 'done' ? 'text-emerald-800' : undefined,
                          line.state === 'pending' ? 'text-amber-800' : undefined,
                          line.state === 'abnormal' ? 'text-red-700' : undefined,
                          line.state === 'not_due' ? 'text-slate-500' : undefined,
                        )}
                      >
                        {closingStateLabel(line.state)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h5 className="font-semibold text-coal-ink">临时任务状态</h5>
                {detailTasks.length === 0 ? (
                  <p className="mt-1 text-xs text-stone">无分配记录</p>
                ) : (
                  <ul className="mt-1 space-y-1 text-xs">
                    {detailTasks.map((t) => (
                      <li key={t.id} className="text-slate-mid">
                        {t.taskName} · {t.status}
                        {t.needReview ? ' · 需审核' : ''}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h5 className="font-semibold text-coal-ink">个人SOP明细</h5>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[560px] border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-ash bg-ash/40 text-left text-graphite">
                        {['时间段', '模块', '动作', '类型', '状态', '完成时间', '备注', '操作'].map((h) => (
                          <th key={h} className="px-1 py-1 font-medium">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {detailActions.map((a) => (
                        <tr key={a.actionId} className="border-b border-ash/60">
                          <td className="px-1 py-1 whitespace-nowrap">{a.slotRange}</td>
                          <td className="px-1 py-1 max-w-[80px] truncate">{a.moduleName}</td>
                          <td className="px-1 py-1 max-w-[120px]">{a.actionText}</td>
                          <td className="px-1 py-1 whitespace-nowrap">{a.actionTypeLabel}</td>
                          <td className="px-1 py-1">{actionStatusLabel(a.status)}</td>
                          <td className="px-1 py-1 whitespace-nowrap text-[10px]">{a.completedAt ? a.completedAt.slice(0, 16).replace('T', ' ') : '—'}</td>
                          <td className="px-1 py-1 max-w-[100px] truncate">{a.remark || '—'}</td>
                          <td className="px-1 py-1 whitespace-nowrap">
                            <button
                              type="button"
                              className="text-sky-800 underline"
                              onClick={() => {
                                const msg = `【${detailStaff.staffName}】${a.moduleName} ${a.actionText}（${actionStatusLabel(a.status)}）请及时处理。`;
                                void navigator.clipboard.writeText(msg).catch(() => {});
                                window.alert('提醒文案已复制到剪贴板');
                              }}
                            >
                              提醒
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {rejectModal ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4">
          <Card className="w-full max-w-md p-4">
            <h4 className="font-semibold text-coal-ink">驳回原因</h4>
            <textarea className="input-field mt-2 w-full text-sm" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} />
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" className="btn-ghost text-sm" onClick={() => setRejectModal(null)}>
                取消
              </button>
              <button
                type="button"
                className="btn-primary text-sm"
                onClick={() => rejectTask(rejectModal.id, rejectReason.trim() || '未填写')}
              >
                确认驳回
              </button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
