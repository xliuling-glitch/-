'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TaskInstance, TodayTaskState } from '@/lib/today-tasks/types';
import { buildInstances } from '@/lib/today-tasks/engine';
import { loadTodayTasks } from '@/lib/today-tasks/storage';
import { getInitialTaskState } from '@/lib/today-tasks/seed';
import type { KpiDailySubmission } from '@/lib/kpi-daily/types';
import { KPI_DAILY_CENTER_KEY, loadKpiDailyCenter } from '@/lib/kpi-daily/storage';
import { approveKpiSubmission, rejectKpiSubmission } from '@/lib/kpi-daily/board-mutations';
import {
  buildExceptions,
  buildOverview,
  buildStaffRows,
  filterExceptions,
  pendingKpiList,
  sortStaffRanking,
} from '@/lib/supervisor-board/build-dashboard';
import type { DashboardException, DashboardExceptionCategory, StaffTodayRow } from '@/lib/supervisor-board/dashboard-types';
import { EXCEPTION_CATEGORY_LABELS } from '@/lib/supervisor-board/dashboard-types';
import { loadExceptionHandles, setExceptionHandle } from '@/lib/supervisor-board/exception-handles';
import { KpiSubmissionDetailPanel } from '@/components/kpi-daily/KpiSubmissionDetailPanel';
import { Card } from '@/components/ui';
import { cn } from '@/lib/utils';
import { STORAGE_ALIAS_DAILY_KPI_UPLOADS, STORAGE_ALIAS_DAILY_TASKS, STORAGE_KEY_SUPERVISOR_EXCEPTION_HANDLES } from '@/lib/workspace-storage-keys';
import { WORKSPACE_STORAGE_UPDATED } from '@/lib/workspace-events';
import { formatAmountYuan } from '@/lib/format-amount';

function mergeTaskState(): TodayTaskState {
  const s = loadTodayTasks();
  if (s.templates.length > 0 || s.assignments.length > 0) return s;
  return getInitialTaskState();
}

function toneBadge(tone: StaffTodayRow['statusTone']) {
  const map: Record<StaffTodayRow['statusTone'], string> = {
    green: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200',
    blue: 'bg-sky-50 text-sky-900 ring-1 ring-sky-200',
    yellow: 'bg-amber-50 text-amber-950 ring-1 ring-amber-200',
    red: 'bg-red-50 text-red-900 ring-1 ring-red-200',
  };
  return map[tone];
}

function sevBadge(s: DashboardException['severity']) {
  if (s === 'high') return 'bg-red-50 text-red-800 ring-1 ring-red-200';
  if (s === 'medium') return 'bg-amber-50 text-amber-900 ring-1 ring-amber-200';
  return 'bg-slate-100 text-graphite ring-1 ring-ash';
}

function handleBadge(h: DashboardException['handleStatus']) {
  if (h === 'done') return 'text-emerald-700';
  if (h === 'ignored') return 'text-stone line-through';
  return 'text-amber-800';
}

function MiniBar({
  label,
  value,
  max,
  formatValue,
}: {
  label: string;
  value: number;
  max: number;
  formatValue?: (v: number) => string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 1000) / 10) : 0;
  const text = formatValue ? formatValue(value) : String(value);
  return (
    <div className="text-xs">
      <div className="flex justify-between gap-2 text-graphite">
        <span className="truncate">{label}</span>
        <span className="shrink-0 tabular-nums text-coal-ink">{text}</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded bg-ash">
        <div className="h-2 rounded-sm bg-coal-ink transition-[width]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function SupervisorBoardApp() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [taskData, setTaskData] = useState<TodayTaskState>(() => ({ templates: [], assignments: [], completions: {} }));
  const [kpiSubmissions, setKpiSubmissions] = useState<KpiDailySubmission[]>([]);
  const [roster, setRoster] = useState<string[]>([]);
  const [shops, setShops] = useState<string[]>([]);
  const [handleMap, setHandleMap] = useState(() => loadExceptionHandles());
  const [auditorName, setAuditorName] = useState('主管');

  const [filterStaff, setFilterStaff] = useState('');
  const [filterShift, setFilterShift] = useState<'all' | 'day' | 'night'>('all');
  const [filterShop, setFilterShop] = useState('');
  const [excCategory, setExcCategory] = useState<'all' | DashboardExceptionCategory>('all');
  const [excHandle, setExcHandle] = useState<'all' | 'open' | 'done' | 'ignored'>('all');

  const [tick, setTick] = useState(0);
  const [taskModal, setTaskModal] = useState<TaskInstance | null>(null);
  const [staffModal, setStaffModal] = useState<StaffTodayRow | null>(null);
  const [kpiView, setKpiView] = useState<KpiDailySubmission | null>(null);
  const [rejectModal, setRejectModal] = useState<{ id: string; staff: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const now = useMemo(() => new Date(), [tick]);

  const refresh = useCallback(() => {
    setTaskData(mergeTaskState());
    setKpiSubmissions(loadKpiDailyCenter().submissions);
    setHandleMap(loadExceptionHandles());
  }, []);

  useEffect(() => {
    refresh();
  }, [date, refresh]);

  useEffect(() => {
    const id = setInterval(() => setTick((x) => x + 1), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    fetch('/api/options')
      .then((r) => r.json())
      .then((d) => {
        setRoster(Array.isArray(d.staff_roster) ? d.staff_roster : []);
        setShops(Array.isArray(d.shops) ? d.shops : []);
      })
      .catch(() => {});
    fetch('/api/session', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        const n = d?.user?.name;
        if (typeof n === 'string' && n.trim()) setAuditorName(n.trim());
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (
        e.key === STORAGE_ALIAS_DAILY_TASKS ||
        e.key === KPI_DAILY_CENTER_KEY ||
        e.key === STORAGE_KEY_SUPERVISOR_EXCEPTION_HANDLES ||
        e.key === null
      ) {
        refresh();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [refresh]);

  useEffect(() => {
    const onWs = () => refresh();
    window.addEventListener(WORKSPACE_STORAGE_UPDATED, onWs);
    return () => window.removeEventListener(WORKSPACE_STORAGE_UPDATED, onWs);
  }, [refresh]);

  const instances = useMemo(() => buildInstances(taskData, date), [taskData, date]);

  const shiftInstances = useMemo(() => {
    if (filterShift === 'all') return instances;
    if (filterShift === 'day') return instances.filter((i) => i.shiftCode === 'day' || i.shiftCode === 'all');
    return instances.filter((i) => i.shiftCode === 'night' || i.shiftCode === 'all');
  }, [instances, filterShift]);

  const buildInput = useMemo(
    () => ({
      date,
      now,
      taskState: taskData,
      kpiSubmissions,
      roster,
      shiftFilter: filterShift,
      shopFilter: filterShop,
      staffFilter: filterStaff,
      handleMap,
    }),
    [date, now, taskData, kpiSubmissions, roster, filterShift, filterShop, filterStaff, handleMap],
  );

  const staffRows = useMemo(() => {
    const rows = buildStaffRows(buildInput);
    return sortStaffRanking(rows);
  }, [buildInput]);

  const overview = useMemo(
    () => buildOverview(shiftInstances, kpiSubmissions, date, roster.length, now),
    [shiftInstances, kpiSubmissions, date, roster.length, now],
  );

  const exceptionsAll = useMemo(() => buildExceptions(buildInput, staffRows), [buildInput, staffRows]);

  const exceptions = useMemo(
    () => filterExceptions(exceptionsAll, excCategory, excHandle, filterStaff),
    [exceptionsAll, excCategory, excHandle, filterStaff],
  );

  const pendingKpis = useMemo(() => {
    return pendingKpiList(kpiSubmissions, date).filter((s) => {
      if (filterStaff.trim() && !s.employeeName.includes(filterStaff.trim())) return false;
      if (filterShop.trim() && !s.storeName.includes(filterShop.trim())) return false;
      return true;
    });
  }, [kpiSubmissions, date, filterStaff, filterShop]);

  const trendMax = useMemo(() => {
    const r = staffRows;
    return {
      rate: 100,
      sales: Math.max(1, ...r.map((x) => x.salesNet)),
      lead: Math.max(1, ...r.map((x) => x.leadCount)),
      call: Math.max(1, ...r.map((x) => x.validCalls)),
      rev: Math.max(0.01, ...r.map((x) => x.reviewScore)),
    };
  }, [staffRows]);

  const staffTasksMap = useMemo(() => {
    const m = new Map<string, TaskInstance[]>();
    for (const i of shiftInstances) {
      if (!m.has(i.staffName)) m.set(i.staffName, []);
      m.get(i.staffName)!.push(i);
    }
    return m;
  }, [shiftInstances]);

  const onApproveKpi = (id: string) => {
    if (approveKpiSubmission(id, auditorName)) {
      refresh();
    }
  };

  const onConfirmReject = () => {
    if (!rejectModal) return;
    if (!rejectReason.trim()) {
      window.alert('请填写驳回原因');
      return;
    }
    if (rejectKpiSubmission(rejectModal.id, auditorName, rejectReason)) {
      setRejectModal(null);
      setRejectReason('');
      refresh();
    }
  };

  const markExc = (id: string, status: 'done' | 'ignored') => {
    setHandleMap(setExceptionHandle(id, status));
  };

  const exportPlaceholder = () => window.alert('导出今日数据功能开发中，敬请期待。');

  const overviewCards: [string, string, string][] = [
    ['今日任务总数', String(overview.taskTotal), 'text-coal-ink'],
    ['今日任务完成率', `${overview.taskRate}%`, 'text-emerald-700'],
    ['今日逾期任务数', String(overview.taskOverdue), 'text-red-600'],
    ['KPI 已上传人数', String(overview.kpiUploaded), 'text-emerald-800'],
    ['KPI 未上传人数', String(overview.kpiNotUploaded), 'text-stone'],
    ['待审核 KPI 记录', String(overview.kpiPendingRecords), 'text-amber-800'],
    ['今日总销售额（净）', formatAmountYuan(overview.totalSalesNet), 'text-amber-900'],
    ['今日高质量留资（分）', overview.totalLeadScore.toFixed(2), 'text-emerald-800'],
    ['今日有效电联数', String(overview.totalValidCalls), 'text-sky-800'],
    ['今日有效评价（分）', overview.totalReviewScore.toFixed(2), 'text-violet-800'],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3 rounded-[10px] border border-ash bg-ledger-white p-3">
        <label className="text-xs text-graphite">
          业务日
          <input type="date" className="input-field mt-1 block text-sm" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="text-xs text-graphite">
          客服
          <select className="input-field mt-1 block min-w-[7rem] text-sm" value={filterStaff} onChange={(e) => setFilterStaff(e.target.value)}>
            <option value="">全部</option>
            {roster.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
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
          店铺
          <input className="input-field mt-1 block min-w-[8rem] text-sm" list="sup-shop-dl" value={filterShop} onChange={(e) => setFilterShop(e.target.value)} placeholder="筛选" />
          <datalist id="sup-shop-dl">
            {shops.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
        <label className="text-xs text-graphite">
          异常类型
          <select
            className="input-field mt-1 block min-w-[9rem] text-sm"
            value={excCategory}
            onChange={(e) => setExcCategory(e.target.value as 'all' | DashboardExceptionCategory)}
          >
            <option value="all">全部</option>
            {(Object.keys(EXCEPTION_CATEGORY_LABELS) as DashboardExceptionCategory[]).map((k) => (
              <option key={k} value={k}>
                {EXCEPTION_CATEGORY_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-graphite">
          异常处理
          <select
            className="input-field mt-1 block min-w-[6rem] text-sm"
            value={excHandle}
            onChange={(e) => setExcHandle(e.target.value as 'all' | 'open' | 'done' | 'ignored')}
          >
            <option value="all">全部</option>
            <option value="open">未处理</option>
            <option value="done">已处理</option>
            <option value="ignored">忽略</option>
          </select>
        </label>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <button type="button" className="btn-ghost text-sm" onClick={refresh}>
            刷新数据
          </button>
          <button type="button" className="btn-ghost text-sm" onClick={exportPlaceholder}>
            导出今日数据
          </button>
        </div>
      </div>
      <p className="text-xs text-stone">
        数据来源：LocalStorage <code className="rounded bg-ash px-1">{STORAGE_ALIAS_DAILY_TASKS}</code>（今日任务中心）、
        <code className="rounded bg-ash px-1">{STORAGE_ALIAS_DAILY_KPI_UPLOADS}</code>（KPI 每日上传中心）；异常处理状态存{' '}
        <code className="rounded bg-ash px-1">{STORAGE_KEY_SUPERVISOR_EXCEPTION_HANDLES}</code>。同标签页内保存后会广播事件，本页自动刷新。
      </p>

      {/* 一、顶部总览 */}
      <div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {overviewCards.map(([label, val, cls]) => (
            <Card key={label} elevated className="p-4">
              <div className="text-xs text-slate-mid">{label}</div>
              <div className={cn('mt-1 font-display text-2xl font-bold tabular-nums', cls)}>{val}</div>
            </Card>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-stone">
          说明：总览中销售额、留资分、电联数、评价分仅汇总<strong>审核已通过</strong>的 KPI；待审条数单独体现在「待审核 KPI 记录」卡片。
        </p>
      </div>

      {/* 二、客服排名 */}
      <Card elevated className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ash pb-3">
          <h3 className="font-display text-base font-bold text-coal-ink">客服今日完成情况排名</h3>
          <span className="text-xs text-stone">按任务完成率排序 · 班次筛选已应用</span>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[1080px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-ash bg-ash/50 text-left text-xs font-semibold text-graphite">
                <th className="px-2 py-2">#</th>
                <th className="px-2 py-2">客服</th>
                <th className="px-2 py-2">任务数</th>
                <th className="px-2 py-2">已完成</th>
                <th className="px-2 py-2">逾期</th>
                <th className="px-2 py-2">完成率</th>
                <th className="px-2 py-2">KPI</th>
                <th className="px-2 py-2">净销售额</th>
                <th className="px-2 py-2">留资分</th>
                <th className="px-2 py-2">有效电联</th>
                <th className="px-2 py-2">评价分</th>
                <th className="px-2 py-2">今日状态</th>
                <th className="px-2 py-2 w-28">操作</th>
              </tr>
            </thead>
            <tbody>
              {staffRows.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-3 py-10 text-center text-stone">
                    无数据。请在「今日任务中心」「KPI 每日上传中心」维护示例数据。
                  </td>
                </tr>
              ) : (
                staffRows.map((r, idx) => (
                  <tr key={r.staffName} className="border-b border-ash/70">
                    <td className="px-2 py-2 tabular-nums text-stone">{idx + 1}</td>
                    <td className="px-2 py-2 font-medium text-coal-ink">{r.staffName}</td>
                    <td className="px-2 py-2 tabular-nums">{r.taskTotal}</td>
                    <td className="px-2 py-2 tabular-nums text-emerald-800">{r.taskClosed}</td>
                    <td className="px-2 py-2 tabular-nums text-red-600">{r.taskOverdue}</td>
                    <td className="px-2 py-2 tabular-nums font-semibold">{r.taskRate}%</td>
                    <td className="px-2 py-2 text-xs">{r.kpiLabel}</td>
                    <td className="px-2 py-2 tabular-nums">{formatAmountYuan(r.salesNet)}</td>
                    <td className="px-2 py-2 tabular-nums">{r.leadScore.toFixed(2)}</td>
                    <td className="px-2 py-2 tabular-nums">{r.validCalls}</td>
                    <td className="px-2 py-2 tabular-nums">{r.reviewScore.toFixed(2)}</td>
                    <td className="px-2 py-2">
                      <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', toneBadge(r.statusTone))}>{r.statusLabel}</span>
                    </td>
                    <td className="px-2 py-2">
                      <button type="button" className="text-xs text-signal-violet underline" onClick={() => setStaffModal(r)}>
                        详情
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 三、异常提醒 */}
      <Card elevated className="p-4">
        <h3 className="border-b border-ash pb-3 font-display text-base font-bold text-coal-ink">异常提醒中心</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-ash bg-ash/50 text-left text-xs font-semibold text-graphite">
                <th className="px-2 py-2">时间</th>
                <th className="px-2 py-2">客服</th>
                <th className="px-2 py-2">类型</th>
                <th className="px-2 py-2">说明</th>
                <th className="px-2 py-2">严重度</th>
                <th className="px-2 py-2">处理</th>
                <th className="px-2 py-2 w-44">操作</th>
              </tr>
            </thead>
            <tbody>
              {exceptions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-stone">
                    当前筛选下暂无异常项。
                  </td>
                </tr>
              ) : (
                exceptions.map((e) => (
                  <tr
                    key={e.id}
                    className={cn(
                      'border-b border-ash/60',
                      e.category === 'p0_open' && 'bg-red-50',
                      e.category === 'kpi_missing' && 'bg-amber-50/90',
                      e.category === 'kpi_rejected' && 'bg-red-50/80',
                    )}
                  >
                    <td className="px-2 py-2 whitespace-nowrap text-xs text-stone">{e.occurredAt.slice(0, 19).replace('T', ' ')}</td>
                    <td className="px-2 py-2 font-medium">{e.staffName}</td>
                    <td className="max-w-[180px] px-2 py-2 text-xs">{e.title}</td>
                    <td className="max-w-[280px] px-2 py-2 text-xs text-slate-mid">{e.detail}</td>
                    <td className="px-2 py-2">
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase', sevBadge(e.severity))}>
                        {e.severity === 'high' ? '高' : e.severity === 'medium' ? '中' : '低'}
                      </span>
                    </td>
                    <td className={cn('px-2 py-2 text-xs font-medium', handleBadge(e.handleStatus))}>
                      {e.handleStatus === 'done' ? '已处理' : e.handleStatus === 'ignored' ? '忽略' : '未处理'}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex flex-wrap gap-1 text-xs">
                        {e.taskInstanceKey ? (
                          <button
                            type="button"
                            className="text-signal-violet underline"
                            onClick={() => {
                              const inst = shiftInstances.find((i) => i.instanceKey === e.taskInstanceKey);
                              if (inst) setTaskModal(inst);
                              else window.alert('未找到对应任务实例（可能已变更班次筛选）。');
                            }}
                          >
                            任务详情
                          </button>
                        ) : null}
                        {e.kpiSubmissionId ? (
                          <button
                            type="button"
                            className="text-signal-violet underline"
                            onClick={() => {
                              const k = kpiSubmissions.find((x) => x.id === e.kpiSubmissionId);
                              if (k) setKpiView(k);
                            }}
                          >
                            KPI 详情
                          </button>
                        ) : null}
                        {e.handleStatus === 'open' ? (
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 四、KPI 待审核 */}
      <Card elevated className="p-4">
        <h3 className="border-b border-ash pb-3 font-display text-base font-bold text-coal-ink">KPI 审核快捷区</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-ash bg-ash/50 text-left text-xs font-semibold text-graphite">
                <th className="px-2 py-2">日期</th>
                <th className="px-2 py-2">客服</th>
                <th className="px-2 py-2">店铺</th>
                <th className="px-2 py-2">AI次数</th>
                <th className="px-2 py-2">留资分</th>
                <th className="px-2 py-2">已电联</th>
                <th className="px-2 py-2">销售额</th>
                <th className="px-2 py-2">评价分</th>
                <th className="px-2 py-2">提交时间</th>
                <th className="px-2 py-2 w-40">操作</th>
              </tr>
            </thead>
            <tbody>
              {pendingKpis.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-stone">
                    暂无待审核 KPI。
                  </td>
                </tr>
              ) : (
                pendingKpis.map((k) => (
                  <tr key={k.id} className="border-b border-ash/60">
                    <td className="px-2 py-2 tabular-nums text-stone">{k.date}</td>
                    <td className="px-2 py-2 font-medium">{k.employeeName}</td>
                    <td className="max-w-[140px] truncate px-2 py-2" title={k.storeName}>
                      {k.storeName || '—'}
                    </td>
                    <td className="px-2 py-2 tabular-nums">{k.aiUseCount}</td>
                    <td className="px-2 py-2 tabular-nums">{k.highQualityLeadScore.toFixed(2)}</td>
                    <td className="px-2 py-2 tabular-nums">{k.calledCount}</td>
                    <td className="px-2 py-2 tabular-nums">{formatAmountYuan(k.netSalesAmount)}</td>
                    <td className="px-2 py-2 tabular-nums">{k.effectiveReviewScore.toFixed(2)}</td>
                    <td className="px-2 py-2 text-xs text-stone">{k.submittedAt?.slice(0, 19).replace('T', ' ') ?? '—'}</td>
                    <td className="px-2 py-2">
                      <div className="flex flex-wrap gap-1 text-xs">
                        <button type="button" className="text-emerald-700 underline" onClick={() => onApproveKpi(k.id)}>
                          通过
                        </button>
                        <button type="button" className="text-rose-700 underline" onClick={() => setRejectModal({ id: k.id, staff: k.employeeName })}>
                          驳回
                        </button>
                        <button type="button" className="text-signal-violet underline" onClick={() => setKpiView(k)}>
                          查看
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

      {/* 五、趋势进度条 */}
      <Card elevated className="p-4">
        <h3 className="border-b border-ash pb-3 font-display text-base font-bold text-coal-ink">今日数据趋势（进度条）</h3>
        <p className="mt-2 text-xs text-stone">柱长为相对当日最大值的比例，便于横向对比。</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {staffRows.length === 0 ? (
            <p className="text-sm text-stone">无客服数据</p>
          ) : (
            staffRows.map((r) => (
              <div key={r.staffName} className="rounded-lg border border-ash bg-ledger-white p-3">
                <div className="text-sm font-semibold text-coal-ink">{r.staffName}</div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <MiniBar label="任务完成率 %" value={r.taskRate} max={trendMax.rate} />
                  <MiniBar
                    label="净销售额"
                    value={Math.round(r.salesNet)}
                    max={trendMax.sales}
                    formatValue={(v) => formatAmountYuan(v, 0)}
                  />
                  <MiniBar label="留资数量" value={r.leadCount} max={trendMax.lead} />
                  <MiniBar label="有效电联" value={r.validCalls} max={trendMax.call} />
                  <MiniBar label="评价分" value={Math.round(r.reviewScore * 100) / 100} max={trendMax.rev} />
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {taskModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog">
          <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-[12px] border border-ash bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-display text-lg font-bold text-coal-ink">任务详情</h3>
              <button type="button" className="btn-ghost text-sm" onClick={() => setTaskModal(null)}>
                关闭
              </button>
            </div>
            <pre className="mt-4 max-h-[70vh] overflow-auto rounded-lg bg-ash/30 p-3 text-xs leading-relaxed">{JSON.stringify(taskModal, null, 2)}</pre>
          </div>
        </div>
      ) : null}

      {staffModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog">
          <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-[12px] border border-ash bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-display text-lg font-bold text-coal-ink">客服详情 · {staffModal.staffName}</h3>
              <button type="button" className="btn-ghost text-sm" onClick={() => setStaffModal(null)}>
                关闭
              </button>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <dt className="text-graphite">任务完成率</dt>
              <dd className="font-semibold tabular-nums">{staffModal.taskRate}%</dd>
              <dt className="text-graphite">任务数 / 完成 / 逾期</dt>
              <dd className="tabular-nums">
                {staffModal.taskTotal} / {staffModal.taskClosed} / {staffModal.taskOverdue}
              </dd>
              <dt className="text-graphite">KPI</dt>
              <dd>{staffModal.kpiLabel}</dd>
              <dt className="text-graphite">净销售额</dt>
              <dd className="tabular-nums">{formatAmountYuan(staffModal.salesNet)}</dd>
              <dt className="text-graphite">留资分 / 评价分</dt>
              <dd className="tabular-nums">
                {staffModal.leadScore.toFixed(2)} / {staffModal.reviewScore.toFixed(2)}
              </dd>
            </dl>
            <h4 className="mt-4 text-xs font-bold text-graphite">当日任务列表</h4>
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs">
              {(staffTasksMap.get(staffModal.staffName) ?? []).map((i) => (
                <li key={i.instanceKey} className="flex justify-between gap-2 rounded border border-ash/60 bg-ash/20 px-2 py-1">
                  <span className="min-w-0 truncate">
                    {i.startTime}-{i.endTime} {i.title}
                  </span>
                  <button type="button" className="shrink-0 text-signal-violet underline" onClick={() => setTaskModal(i)}>
                    任务
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {kpiView ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog">
          <div className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-[12px] border border-ash bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-display text-lg font-bold text-coal-ink">KPI 记录详情</h3>
              <button type="button" className="btn-ghost text-sm" onClick={() => setKpiView(null)}>
                关闭
              </button>
            </div>
            <KpiSubmissionDetailPanel submission={kpiView} />
          </div>
        </div>
      ) : null}

      {rejectModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog">
          <div className="w-full max-w-md rounded-[12px] border border-ash bg-white p-5 shadow-xl">
            <h3 className="font-display text-base font-bold text-coal-ink">驳回 KPI</h3>
            <p className="mt-1 text-xs text-stone">
              {rejectModal.staff} · 记录 ID {rejectModal.id.slice(0, 8)}…
            </p>
            <textarea className="input-field mt-3 min-h-[6rem] w-full text-sm" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="驳回原因（必填）" />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="btn-ghost text-sm"
                onClick={() => {
                  setRejectModal(null);
                  setRejectReason('');
                }}
              >
                取消
              </button>
              <button type="button" className="btn-primary text-sm" onClick={onConfirmReject}>
                确认驳回
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
