'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CompletionMode, CompletionRecord, Priority, Recurrence, ShiftCode, TaskAssignment, TaskInstance, TodayTaskState } from '@/lib/today-tasks/types';
import {
  augmentCompletionPatch,
  buildInstances,
  computeWorkflowStatus,
  isFullyClosed,
  isSatisfied,
  mergeCompletion,
} from '@/lib/today-tasks/engine';
import {
  completionModeLabel,
  isInCurrentTimeWindow,
  isP0Overdue,
  isStartingWithinFiveMinutes,
  sortInstancesForWorkbench,
  toDailyTaskItem,
} from '@/lib/today-tasks/daily-task-view';
import { WorkflowStatusBadge } from '@/components/workflow-status-badge';
import type { WorkflowStatusKey } from '@/lib/workflow-status';
import { TaskCredentialsEditor } from './TaskCredentialsEditor';
import { Card } from '@/components/ui';
import { cn } from '@/lib/utils';

type ShiftFilter = 'all' | 'day' | 'night';
type StatusFilter = 'all' | WorkflowStatusKey | 'closed';

const PRI_OPTIONS: (Priority | 'all')[] = ['all', 'P0', 'P1', 'P2', 'P3'];
const MODE_OPTIONS: { v: CompletionMode | 'all'; label: string }[] = [
  { v: 'all', label: '全部方式' },
  { v: 'checkbox', label: '直接打勾' },
  { v: 'quantity', label: '完成数量' },
  { v: 'screenshot', label: '截图/备注' },
  { v: 'customer', label: '关联客户' },
  { v: 'daily_report', label: '提交日报' },
  { v: 'review_upload', label: '评价上传' },
  { v: 'calls_metrics', label: '电联指标' },
];

function rid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `asg-${Date.now()}`;
}

function matchesShift(inst: TaskInstance, f: ShiftFilter): boolean {
  if (f === 'all') return true;
  if (f === 'day') return inst.shiftCode === 'day' || inst.shiftCode === 'all';
  if (f === 'night') return inst.shiftCode === 'night' || inst.shiftCode === 'all';
  return true;
}

function matchesStatus(inst: TaskInstance, now: Date, f: StatusFilter): boolean {
  if (f === 'all') return true;
  const wf = computeWorkflowStatus(inst, now);
  if (f === 'closed') return isFullyClosed(inst);
  if (f === 'completed') return wf === 'completed';
  return wf === f;
}

export function TodayWorkbench({
  data,
  setData,
  date,
  staff,
  roster,
}: {
  data: TodayTaskState;
  setData: React.Dispatch<React.SetStateAction<TodayTaskState>>;
  date: string;
  staff: string;
  roster: string[];
}) {
  const [tick, setTick] = useState(0);
  const [shiftFilter, setShiftFilter] = useState<ShiftFilter>('all');
  const [typeQ, setTypeQ] = useState('');
  const [priFilter, setPriFilter] = useState<Priority | 'all'>('all');
  const [modeFilter, setModeFilter] = useState<CompletionMode | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [modal, setModal] = useState<null | { mode: 'add' } | { mode: 'edit'; id: string }>(null);

  const [draft, setDraft] = useState({
    title: '',
    description: '',
    taskType: '例行',
    shiftCode: 'all' as ShiftCode,
    shiftLabel: '',
    startTime: '09:00',
    endTime: '10:00',
    priority: 'P2' as Priority,
    completionMode: 'checkbox' as CompletionMode,
    quantityTarget: 1,
    recurrence: 'once' as Recurrence,
    staffNames: [] as string[],
    kpiTag: false,
    requiresSupervisorReview: false,
  });

  useEffect(() => {
    const id = setInterval(() => setTick((x) => x + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const now = useMemo(() => new Date(), [tick]);

  const forStaff = useMemo(() => buildInstances(data, date).filter((i) => i.staffName === staff), [data, date, staff, tick]);

  const baseFiltered = useMemo(() => {
    return forStaff.filter((i) => {
      if (!matchesShift(i, shiftFilter)) return false;
      if (priFilter !== 'all' && i.priority !== priFilter) return false;
      if (modeFilter !== 'all' && i.completionMode !== modeFilter) return false;
      if (typeQ.trim() && !i.taskType.toLowerCase().includes(typeQ.trim().toLowerCase())) return false;
      return true;
    });
  }, [forStaff, shiftFilter, priFilter, modeFilter, typeQ]);

  const stats = useMemo(() => {
    let total = 0;
    let closed = 0;
    let open = 0;
    let overdue = 0;
    let p0 = 0;
    let inSlot = 0;
    for (const i of baseFiltered) {
      total++;
      if (isFullyClosed(i)) closed++;
      else open++;
      const wf = computeWorkflowStatus(i, now);
      if (wf === 'overdue') overdue++;
      if (i.priority === 'P0') p0++;
      if (isInCurrentTimeWindow(i, now) && !isFullyClosed(i)) inSlot++;
    }
    return { total, closed, open, overdue, p0, inSlot };
  }, [baseFiltered, now]);

  const alerts = useMemo(() => {
    const p0od = baseFiltered.filter((i) => isP0Overdue(i, now));
    const soon = baseFiltered.filter((i) => isStartingWithinFiveMinutes(i, now));
    const cur = baseFiltered.filter((i) => isInCurrentTimeWindow(i, now) && !isFullyClosed(i));
    return { p0od, soon, cur };
  }, [baseFiltered, now, tick]);

  const tableList = useMemo(() => {
    const st = baseFiltered.filter((i) => matchesStatus(i, now, statusFilter));
    return sortInstancesForWorkbench(st, now);
  }, [baseFiltered, statusFilter, now, tick]);

  const patchInst = useCallback(
    (inst: TaskInstance, patchRec: CompletionRecord) => {
      setData((s) => mergeCompletion(s, inst.instanceKey, augmentCompletionPatch(inst, patchRec)));
    },
    [setData],
  );

  const tryComplete = (inst: TaskInstance) => {
    setData((s) => {
      const patchRec = augmentCompletionPatch(inst, { completedAt: new Date().toISOString() });
      return mergeCompletion(s, inst.instanceKey, patchRec);
    });
  };

  const openAdd = () => {
    setDraft({
      title: '',
      description: '',
      taskType: '例行',
      shiftCode: 'all',
      shiftLabel: '',
      startTime: '09:00',
      endTime: '10:00',
      priority: 'P2',
      completionMode: 'checkbox',
      quantityTarget: 1,
      recurrence: 'once',
      staffNames: staff ? [staff] : [],
      kpiTag: false,
      requiresSupervisorReview: false,
    });
    setModal({ mode: 'add' });
  };

  const openEdit = (a: TaskAssignment) => {
    setDraft({
      title: a.title,
      description: a.description ?? '',
      taskType: a.taskType ?? '例行',
      shiftCode: a.shiftCode ?? 'all',
      shiftLabel: a.shiftLabel ?? '',
      startTime: a.startTime,
      endTime: a.endTime,
      priority: a.priority,
      completionMode: a.completionMode,
      quantityTarget: a.quantityTarget ?? 1,
      recurrence: a.recurrence,
      staffNames: [...a.staffNames],
      kpiTag: !!a.kpiTag,
      requiresSupervisorReview: !!a.requiresSupervisorReview,
    });
    setModal({ mode: 'edit', id: a.id });
  };

  const saveModal = () => {
    if (!draft.title.trim() || draft.staffNames.length === 0) {
      window.alert('请填写任务标题并至少选择一名客服');
      return;
    }
    const ts = new Date().toISOString();
    if (modal?.mode === 'add') {
      const a: TaskAssignment = {
        id: rid(),
        title: draft.title.trim(),
        description: draft.description.trim(),
        taskType: draft.taskType.trim() || '例行',
        shiftCode: draft.shiftCode,
        shiftLabel: draft.shiftLabel.trim(),
        staffNames: draft.staffNames,
        recurrence: draft.recurrence,
        date: draft.recurrence === 'once' ? date : undefined,
        weekdays: draft.recurrence === 'weekly' ? [1, 2, 3, 4, 5] : undefined,
        startTime: draft.startTime,
        endTime: draft.endTime,
        priority: draft.priority,
        completionMode: draft.completionMode,
        quantityTarget: draft.quantityTarget,
        active: true,
        kpiTag: draft.kpiTag,
        requiresSupervisorReview: draft.requiresSupervisorReview || undefined,
        createdBy: '工作台',
        createdAt: ts,
        updatedAt: ts,
      };
      setData((s) => ({ ...s, assignments: [a, ...s.assignments] }));
    } else if (modal?.mode === 'edit') {
      setData((s) => ({
        ...s,
        assignments: s.assignments.map((x) =>
          x.id === modal.id
            ? {
                ...x,
                title: draft.title.trim(),
                description: draft.description.trim(),
                taskType: draft.taskType.trim() || '例行',
                shiftCode: draft.shiftCode,
                shiftLabel: draft.shiftLabel.trim(),
                staffNames: draft.staffNames,
                recurrence: draft.recurrence,
                date: draft.recurrence === 'once' ? date : undefined,
                weekdays: draft.recurrence === 'weekly' ? [1, 2, 3, 4, 5] : undefined,
                startTime: draft.startTime,
                endTime: draft.endTime,
                priority: draft.priority,
                completionMode: draft.completionMode,
                quantityTarget: draft.quantityTarget,
                kpiTag: draft.kpiTag,
                requiresSupervisorReview: draft.requiresSupervisorReview || undefined,
                updatedAt: ts,
              }
            : x,
        ),
      }));
    }
    setModal(null);
  };

  const deleteAssignment = (id: string) => {
    if (!window.confirm('确定删除该任务分配？对应完成记录也将失效。')) return;
    setData((s) => ({
      ...s,
      assignments: s.assignments.filter((x) => x.id !== id),
      completions: Object.fromEntries(Object.entries(s.completions).filter(([k]) => !k.startsWith(`${id}::`))),
    }));
  };

  const toggleStaffPick = (n: string) => {
    setDraft((d) => ({
      ...d,
      staffNames: d.staffNames.includes(n) ? d.staffNames.filter((x) => x !== n) : [...d.staffNames, n],
    }));
  };

  const wfFor = (inst: TaskInstance) => computeWorkflowStatus(inst, now);

  return (
    <div className="space-y-5">
      {/* 页面内提醒 */}
      {alerts.p0od.length > 0 ? (
        <div className="rounded-[10px] border-2 border-red-500 bg-red-50 px-4 py-3 text-sm font-medium text-red-950">
          <strong>P0 逾期强提醒：</strong>
          {alerts.p0od.map((i) => `「${i.title}」`).join(' ')}
        </div>
      ) : null}
      {alerts.soon.length > 0 ? (
        <div className="rounded-[10px] border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-950">
          <strong>即将开始（5 分钟内）：</strong>
          {alerts.soon.map((i) => `${i.startTime} ${i.title}`).join(' · ')}
        </div>
      ) : null}

      {/* 顶部数据卡片 */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {[
          ['今日任务总数', stats.total, 'text-coal-ink'],
          ['已完成', stats.closed, 'text-emerald-700'],
          ['未完成', stats.open, 'text-stone'],
          ['逾期任务', stats.overdue, 'text-red-600'],
          ['P0 任务数', stats.p0, 'text-red-800'],
          ['当前时段任务', stats.inSlot, 'text-sky-800'],
        ].map(([label, val, cls]) => (
          <Card key={String(label)} elevated className="p-4">
            <div className="text-xs text-slate-mid">{label}</div>
            <div className={cn('mt-1 font-display text-2xl font-bold tabular-nums', String(cls))}>{val}</div>
          </Card>
        ))}
      </div>

      {/* 筛选 */}
      <div className="rounded-[10px] border border-ash bg-ledger-white p-4">
        <h3 className="text-sm font-semibold text-coal-ink">筛选</h3>
        <p className="mb-2 text-xs text-stone">业务日与当前客服请在页面上方选择，与全页筛选同步。</p>
        <div className="mt-3 grid gap-3 lg:grid-cols-5">
          <label className="text-xs text-graphite">
            班次
            <select className="input-field mt-1 block w-full text-sm" value={shiftFilter} onChange={(e) => setShiftFilter(e.target.value as ShiftFilter)}>
              <option value="all">全部</option>
              <option value="day">白班</option>
              <option value="night">晚班</option>
            </select>
          </label>
          <label className="text-xs text-graphite">
            任务类型（关键字）
            <input className="input-field mt-1 block w-full text-sm" value={typeQ} onChange={(e) => setTypeQ(e.target.value)} placeholder="如 售前" />
          </label>
          <label className="text-xs text-graphite">
            优先级
            <select className="input-field mt-1 block w-full text-sm" value={priFilter} onChange={(e) => setPriFilter(e.target.value as Priority | 'all')}>
              {PRI_OPTIONS.map((p) => (
                <option key={String(p)} value={p}>
                  {p === 'all' ? '全部' : p}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-graphite">
            完成方式
            <select className="input-field mt-1 block w-full text-sm" value={modeFilter} onChange={(e) => setModeFilter(e.target.value as CompletionMode | 'all')}>
              {MODE_OPTIONS.map((o) => (
                <option key={o.label} value={o.v}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-graphite lg:col-span-2">
            完成状态
            <select className="input-field mt-1 block w-full text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
              <option value="all">全部</option>
              <option value="closed">已闭环（含审核通过）</option>
              <option value="incomplete">未开始</option>
              <option value="in_progress">进行中</option>
              <option value="pending_review">待审核</option>
              <option value="overdue">已逾期</option>
              <option value="rejected">已驳回</option>
              <option value="completed">已完成（未含待审）</option>
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn-primary text-sm" onClick={openAdd}>
            新增任务
          </button>
        </div>
      </div>

      {/* 当前任务提醒区 */}
      <div className="rounded-[10px] border-2 border-sky-400 bg-sky-50/80 p-4">
        <h3 className="text-sm font-bold text-sky-950">当前时间段任务</h3>
        {!staff ? (
          <p className="mt-2 text-sm text-stone">请先选择客服。</p>
        ) : alerts.cur.length === 0 ? (
          <p className="mt-2 text-sm text-stone">当前时段无进行中任务，或已全部闭环。</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {alerts.cur.map((inst) => {
              const row = toDailyTaskItem(inst, now);
              return (
                <li key={inst.instanceKey} className="rounded-lg border border-sky-200 bg-white p-3 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="text-xs text-stone">
                        {inst.startTime} – {inst.endTime}
                      </div>
                      <div className="text-base font-semibold text-coal-ink">{inst.title}</div>
                      {inst.description ? <p className="mt-1 text-sm text-graphite">{inst.description}</p> : null}
                      <p className="mt-1 text-xs text-slate-mid">
                        优先级 {inst.priority} · 完成要求：{completionModeLabel(inst.completionMode)}
                      </p>
                    </div>
                    <WorkflowStatusBadge status={wfFor(inst)} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-sky-100 pt-3">
                    <button
                      type="button"
                      className="btn-ghost text-xs"
                      disabled={!!inst.completion.startedAt}
                      onClick={() => patchInst(inst, { startedAt: new Date().toISOString() })}
                    >
                      {inst.completion.startedAt ? '已开始' : '开始任务'}
                    </button>
                    {inst.completionMode === 'checkbox' ? (
                      <button type="button" className="btn-primary text-xs" disabled={isFullyClosed(inst)} onClick={() => tryComplete(inst)}>
                        标记完成
                      </button>
                    ) : null}
                    <button type="button" className="btn-ghost text-xs" onClick={() => setExpanded(expanded === inst.instanceKey ? null : inst.instanceKey)}>
                      {expanded === inst.instanceKey ? '收起反馈' : '上传反馈'}
                    </button>
                    <label className="flex flex-1 min-w-[200px] items-center gap-2 text-xs text-graphite">
                      延期说明
                      <input
                        className="input-field flex-1 py-1 text-xs"
                        value={inst.completion.deferNote ?? ''}
                        onChange={(e) => patchInst(inst, { deferNote: e.target.value })}
                      />
                    </label>
                  </div>
                  {expanded === inst.instanceKey ? (
                    <div className="mt-3 space-y-2 border-t border-ash pt-3">
                      <TaskRowEditor inst={inst} patchInst={patchInst} tryComplete={tryComplete} />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* 时间轴表格 */}
      <div className="overflow-x-auto rounded-[10px] border border-ash bg-white">
        <table className="w-full min-w-[1100px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-ash bg-ash/60 text-left text-xs font-semibold text-graphite">
              <th className="px-2 py-2">开始</th>
              <th className="px-2 py-2">结束</th>
              <th className="px-2 py-2">任务名称</th>
              <th className="px-2 py-2">类型</th>
              <th className="px-2 py-2">优先级</th>
              <th className="px-2 py-2">完成方式</th>
              <th className="px-2 py-2">目标</th>
              <th className="px-2 py-2">完成数</th>
              <th className="px-2 py-2">状态</th>
              <th className="px-2 py-2 w-56">操作</th>
            </tr>
          </thead>
          <tbody>
            {!staff ? (
              <tr>
                <td colSpan={10} className="px-3 py-10 text-center text-stone">
                  请选择客服查看时间轴
                </td>
              </tr>
            ) : tableList.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-10 text-center text-stone">
                  无符合条件的任务
                </td>
              </tr>
            ) : (
              tableList.map((inst) => {
                const row = toDailyTaskItem(inst, now);
                const inWin = isInCurrentTimeWindow(inst, now);
                const a = data.assignments.find((x) => x.id === inst.assignmentId);
                return (
                  <tr
                    key={inst.instanceKey}
                    className={cn('border-b border-ash/70', inWin && !isFullyClosed(inst) ? 'bg-sky-50/50' : '')}
                  >
                    <td className="px-2 py-2 tabular-nums text-graphite">{inst.startTime}</td>
                    <td className="px-2 py-2 tabular-nums text-graphite">{inst.endTime}</td>
                    <td className="px-2 py-2">
                      <div className="font-medium text-coal-ink">{inst.title}</div>
                      {inst.description ? <div className="text-[11px] text-slate-mid">{inst.description}</div> : null}
                    </td>
                    <td className="px-2 py-2 text-xs">{inst.taskType}</td>
                    <td className="px-2 py-2 text-xs font-semibold">{inst.priority}</td>
                    <td className="px-2 py-2 text-xs">{completionModeLabel(inst.completionMode)}</td>
                    <td className="px-2 py-2 tabular-nums">{inst.quantityTarget}</td>
                    <td className="px-2 py-2 tabular-nums">{row.completedCount}</td>
                    <td className="px-2 py-2">
                      <WorkflowStatusBadge status={wfFor(inst)} size="sm" />
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex flex-wrap gap-1">
                        <button type="button" className="text-[11px] text-signal-violet underline" onClick={() => a && openEdit(a)}>
                          编辑
                        </button>
                        <button type="button" className="text-[11px] text-red-600 underline" onClick={() => inst.assignmentId && deleteAssignment(inst.assignmentId)}>
                          删除
                        </button>
                        <button type="button" className="text-[11px] text-graphite underline" onClick={() => setExpanded(expanded === inst.instanceKey ? null : inst.instanceKey)}>
                          反馈
                        </button>
                      </div>
                      {expanded === inst.instanceKey ? (
                        <div className="mt-2 rounded border border-ash bg-ledger-white p-2">
                          <TaskRowEditor inst={inst} patchInst={patchInst} tryComplete={tryComplete} />
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 弹窗：新增/编辑分配 */}
      {modal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-ash bg-white p-5 shadow-xl">
            <h4 className="font-semibold text-coal-ink">{modal.mode === 'add' ? '新增任务' : '编辑任务'}</h4>
            <div className="mt-3 grid gap-2 text-xs">
              <label className="text-graphite">
                标题
                <input className="input-field mt-1 block w-full text-sm" value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
              </label>
              <label className="text-graphite">
                说明
                <textarea className="input-field mt-1 min-h-[64px] w-full text-sm" value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-graphite">
                  类型
                  <input className="input-field mt-1 w-full text-sm" value={draft.taskType} onChange={(e) => setDraft((d) => ({ ...d, taskType: e.target.value }))} />
                </label>
                <label className="text-graphite">
                  班次
                  <select className="input-field mt-1 w-full text-sm" value={draft.shiftCode} onChange={(e) => setDraft((d) => ({ ...d, shiftCode: e.target.value as ShiftCode }))}>
                    <option value="all">全部</option>
                    <option value="day">白班</option>
                    <option value="night">晚班</option>
                  </select>
                </label>
                <label className="text-graphite">
                  开始
                  <input type="time" className="input-field mt-1 w-full text-sm" value={draft.startTime} onChange={(e) => setDraft((d) => ({ ...d, startTime: e.target.value }))} />
                </label>
                <label className="text-graphite">
                  结束
                  <input type="time" className="input-field mt-1 w-full text-sm" value={draft.endTime} onChange={(e) => setDraft((d) => ({ ...d, endTime: e.target.value }))} />
                </label>
                <label className="text-graphite">
                  优先级
                  <select className="input-field mt-1 w-full text-sm" value={draft.priority} onChange={(e) => setDraft((d) => ({ ...d, priority: e.target.value as Priority }))}>
                    <option value="P0">P0 紧急重要</option>
                    <option value="P1">P1 重要不紧急</option>
                    <option value="P2">P2 紧急不重要</option>
                    <option value="P3">P3 普通</option>
                  </select>
                </label>
                <label className="text-graphite">
                  完成方式
                  <select className="input-field mt-1 w-full text-sm" value={draft.completionMode} onChange={(e) => setDraft((d) => ({ ...d, completionMode: e.target.value as CompletionMode }))}>
                    {MODE_OPTIONS.filter((x) => x.v !== 'all').map((o) => (
                      <option key={o.v} value={o.v}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-graphite">
                  目标数量
                  <input type="number" min={1} className="input-field mt-1 w-full text-sm" value={draft.quantityTarget} onChange={(e) => setDraft((d) => ({ ...d, quantityTarget: Number(e.target.value) }))} />
                </label>
                <label className="text-graphite">
                  重复
                  <select className="input-field mt-1 w-full text-sm" value={draft.recurrence} onChange={(e) => setDraft((d) => ({ ...d, recurrence: e.target.value as Recurrence }))}>
                    <option value="once">单次（当前筛选日）</option>
                    <option value="daily">每天</option>
                    <option value="weekly">每周（工作日 一至五）</option>
                  </select>
                </label>
              </div>
              <label className="text-graphite">
                班次标签（展示）
                <input className="input-field mt-1 w-full text-sm" value={draft.shiftLabel} onChange={(e) => setDraft((d) => ({ ...d, shiftLabel: e.target.value }))} placeholder="如 早班 / 晚班" />
              </label>
              <div>
                <span className="text-graphite">指派客服</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {roster.map((n) => (
                    <label key={n} className="inline-flex items-center gap-1 rounded-full border border-ash px-2 py-1 text-sm">
                      <input type="checkbox" checked={draft.staffNames.includes(n)} onChange={() => toggleStaffPick(n)} />
                      {n}
                    </label>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-graphite">
                <input type="checkbox" checked={draft.kpiTag} onChange={(e) => setDraft((d) => ({ ...d, kpiTag: e.target.checked }))} />
                KPI 关联提示
              </label>
              <label className="flex items-center gap-2 text-graphite">
                <input type="checkbox" checked={draft.requiresSupervisorReview} onChange={(e) => setDraft((d) => ({ ...d, requiresSupervisorReview: e.target.checked }))} />
                需主管审核
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn-ghost text-sm" onClick={() => setModal(null)}>
                取消
              </button>
              <button type="button" className="btn-primary text-sm" onClick={saveModal}>
                保存
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TaskRowEditor({
  inst,
  patchInst,
  tryComplete,
}: {
  inst: TaskInstance;
  patchInst: (i: TaskInstance, p: CompletionRecord) => void;
  tryComplete: (i: TaskInstance) => void;
}) {
  return (
    <div className="space-y-2 text-xs">
      {inst.completionMode === 'quantity' ? (
        <label className="block text-graphite">
          完成数量 / 目标 {inst.quantityTarget}
          <input
            type="number"
            min={0}
            className="input-field mt-1 w-32 py-1 text-sm"
            value={inst.completion.quantityDone ?? ''}
            onChange={(e) => patchInst(inst, { quantityDone: Number(e.target.value) })}
          />
        </label>
      ) : null}
      {(inst.completionMode === 'screenshot' || inst.completionMode === 'review_upload') && (
        <label className="block text-graphite">
          备注 / 链接
          <textarea className="input-field mt-1 min-h-[56px] w-full text-sm" value={inst.completion.screenshotNote ?? ''} onChange={(e) => patchInst(inst, { screenshotNote: e.target.value })} />
        </label>
      )}
      {inst.completionMode === 'customer' ? (
        <label className="block text-graphite">
          关联客户
          <input className="input-field mt-1 w-full text-sm" value={inst.completion.customerRef ?? ''} onChange={(e) => patchInst(inst, { customerRef: e.target.value })} />
        </label>
      ) : null}
      {inst.completionMode === 'daily_report' ? (
        <label className="block text-graphite">
          日报内容
          <textarea className="input-field mt-1 min-h-[64px] w-full text-sm" value={inst.completion.dailyReportSummary ?? ''} onChange={(e) => patchInst(inst, { dailyReportSummary: e.target.value })} />
        </label>
      ) : null}
      {inst.completionMode === 'calls_metrics' ? (
        <div className="grid grid-cols-2 gap-2">
          <label className="text-graphite">
            电联次数
            <input type="number" className="input-field mt-1 w-full text-sm" value={inst.completion.quantityDone ?? ''} onChange={(e) => patchInst(inst, { quantityDone: Number(e.target.value) })} />
          </label>
          <label className="text-graphite">
            有效沟通
            <input type="number" className="input-field mt-1 w-full text-sm" value={inst.completion.effectiveQty ?? ''} onChange={(e) => patchInst(inst, { effectiveQty: Number(e.target.value) })} />
          </label>
        </div>
      ) : null}
      <TaskCredentialsEditor attachments={inst.completion.attachments ?? []} onChange={(next) => patchInst(inst, { attachments: next })} />
      <label className="block text-graphite">
        延期说明
        <input className="input-field mt-1 w-full text-sm" value={inst.completion.deferNote ?? ''} onChange={(e) => patchInst(inst, { deferNote: e.target.value })} />
      </label>
      <div className="flex flex-wrap gap-2 pt-1">
        <button type="button" className="btn-ghost text-xs" disabled={!!inst.completion.startedAt} onClick={() => patchInst(inst, { startedAt: new Date().toISOString() })}>
          {inst.completion.startedAt ? '已开始' : '开始任务'}
        </button>
        {inst.completionMode === 'checkbox' ? (
          <button type="button" className="btn-primary text-xs" disabled={isFullyClosed(inst)} onClick={() => tryComplete(inst)}>
            标记完成
          </button>
        ) : (
          <button
            type="button"
            className="btn-primary text-xs"
            disabled={isFullyClosed(inst)}
            onClick={() => {
              if (!isSatisfied(inst.completionMode, inst.completion, inst.quantityTarget)) {
                window.alert('请先按完成方式填齐必填项后再标记完成。');
                return;
              }
              patchInst(inst, { completedAt: new Date().toISOString() });
            }}
          >
            校验并标记完成
          </button>
        )}
      </div>
    </div>
  );
}
