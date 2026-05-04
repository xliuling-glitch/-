'use client';

import { useMemo, useState } from 'react';
import type {
  CompletionMode,
  Priority,
  Recurrence,
  TaskAssignment,
  TodayTaskState,
} from '@/lib/today-tasks/types';

const WD = ['日', '一', '二', '三', '四', '五', '六'];

export function AssignmentsPanel({
  data,
  setData,
  roster,
}: {
  data: TodayTaskState;
  setData: React.Dispatch<React.SetStateAction<TodayTaskState>>;
  roster: string[];
}) {
  const [title, setTitle] = useState('');
  const [rec, setRec] = useState<Recurrence>('daily');
  const [dateOnce, setDateOnce] = useState(() => new Date().toISOString().slice(0, 10));
  const [weekPick, setWeekPick] = useState<Record<number, boolean>>({ 1: true, 2: true, 3: true, 4: true, 5: true });
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [priority, setPriority] = useState<Priority>('P2');
  const [mode, setMode] = useState<CompletionMode>('checkbox');
  const [qty, setQty] = useState(1);
  const [shift, setShift] = useState('');
  const [pick, setPick] = useState<Record<string, boolean>>({});
  const [kpiTag, setKpiTag] = useState(false);
  const [tplId, setTplId] = useState('');

  const toggle = (n: string) => setPick((p) => ({ ...p, [n]: !p[n] }));

  const staffSelected = useMemo(() => roster.filter((n) => pick[n]), [pick, roster]);

  const applyTemplate = (id: string) => {
    setTplId(id);
    const t = data.templates.find((x) => x.id === id);
    if (!t) return;
    setPriority(t.defaultPriority);
    setMode(t.completionMode);
  };

  const create = () => {
    if (!title.trim() || staffSelected.length === 0) return;
    const weekdays = rec === 'weekly' ? Object.entries(weekPick).filter(([, v]) => v).map(([k]) => Number(k)) : undefined;
    if (rec === 'weekly' && (!weekdays || weekdays.length === 0)) {
      window.alert('每周重复请至少选择一个星期。');
      return;
    }
    const a: TaskAssignment = {
      id: `asg-${Date.now()}`,
      templateId: tplId || undefined,
      title: title.trim(),
      staffNames: staffSelected,
      recurrence: rec,
      date: rec === 'once' ? dateOnce : undefined,
      weekdays,
      startTime,
      endTime,
      priority,
      completionMode: mode,
      quantityTarget: qty,
      shiftLabel: shift.trim(),
      active: true,
      kpiTag,
      createdAt: new Date().toISOString(),
    };
    setData((s) => ({ ...s, assignments: [a, ...s.assignments] }));
    setTitle('');
    setTplId('');
  };

  const remove = (id: string) => setData((s) => ({ ...s, assignments: s.assignments.filter((x) => x.id !== id) }));
  const toggleActive = (id: string) =>
    setData((s) => ({
      ...s,
      assignments: s.assignments.map((x) => (x.id === id ? { ...x, active: !x.active } : x)),
    }));

  return (
    <div className="space-y-4">
      <div className="rounded-[10px] border border-ash bg-elevated p-4">
        <h3 className="text-sm font-semibold text-coal-ink">新建分配</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-graphite sm:col-span-2">
            基于模板（可选）
            <select className="input-field mt-1 block w-full max-w-md text-sm" value={tplId} onChange={(e) => applyTemplate(e.target.value)}>
              <option value="">不使用模板</option>
              {data.templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-graphite sm:col-span-2">
            任务标题
            <input className="input-field mt-1 block w-full text-sm" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="text-xs text-graphite">
            重复规则
            <select className="input-field mt-1 block w-full text-sm" value={rec} onChange={(e) => setRec(e.target.value as Recurrence)}>
              <option value="once">单次</option>
              <option value="daily">每天</option>
              <option value="weekly">每周</option>
            </select>
          </label>
          {rec === 'once' ? (
            <label className="text-xs text-graphite">
              日期
              <input type="date" className="input-field mt-1 block w-full text-sm" value={dateOnce} onChange={(e) => setDateOnce(e.target.value)} />
            </label>
          ) : null}
          {rec === 'weekly' ? (
            <div className="text-xs text-graphite sm:col-span-2">
              星期（可多选）
              <div className="mt-2 flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                  <label key={d} className="inline-flex items-center gap-1 rounded border border-ash bg-white px-2 py-1">
                    <input type="checkbox" checked={!!weekPick[d]} onChange={() => setWeekPick((w) => ({ ...w, [d]: !w[d] }))} />
                    周{WD[d]}
                  </label>
                ))}
              </div>
            </div>
          ) : null}
          <label className="text-xs text-graphite">
            开始时间
            <input type="time" className="input-field mt-1 block w-full text-sm" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </label>
          <label className="text-xs text-graphite">
            结束时间
            <input type="time" className="input-field mt-1 block w-full text-sm" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </label>
          <label className="text-xs text-graphite">
            优先级
            <select className="input-field mt-1 block w-full text-sm" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              <option value="P0">P0 紧急重要</option>
              <option value="P1">P1 重要不紧急</option>
              <option value="P2">P2 紧急不重要</option>
              <option value="P3">P3 普通</option>
            </select>
          </label>
          <label className="text-xs text-graphite">
            完成方式
            <select className="input-field mt-1 block w-full text-sm" value={mode} onChange={(e) => setMode(e.target.value as CompletionMode)}>
              <option value="checkbox">直接打勾</option>
              <option value="quantity">数量</option>
              <option value="screenshot">截图说明</option>
              <option value="customer">关联客户</option>
              <option value="daily_report">日报摘要</option>
              <option value="review_upload">评价上传</option>
              <option value="calls_metrics">电联指标</option>
            </select>
          </label>
          <label className="text-xs text-graphite">
            数量目标（数量/电联类）
            <input type="number" min={1} className="input-field mt-1 block w-full text-sm" value={qty} onChange={(e) => setQty(Number(e.target.value))} />
          </label>
          <label className="text-xs text-graphite">
            班次标签
            <input className="input-field mt-1 block w-full text-sm" value={shift} onChange={(e) => setShift(e.target.value)} placeholder="如 早班" />
          </label>
          <label className="flex items-center gap-2 text-xs text-graphite sm:col-span-2">
            <input type="checkbox" checked={kpiTag} onChange={(e) => setKpiTag(e.target.checked)} />
            完成后提示计入 KPI（联动占位）
          </label>
        </div>
        <div className="mt-3">
          <span className="text-xs font-medium text-graphite">指派客服</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {roster.map((n) => (
              <label key={n} className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-ash bg-white px-3 py-1.5 text-sm">
                <input type="checkbox" checked={!!pick[n]} onChange={() => toggle(n)} />
                {n}
              </label>
            ))}
          </div>
        </div>
        <button type="button" className="btn-primary mt-4 text-sm" disabled={!title.trim() || staffSelected.length === 0} onClick={create}>
          创建分配
        </button>
      </div>

      <ul className="space-y-2">
        {data.assignments.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ash bg-white px-3 py-2 text-sm">
            <div>
              <span className={`mr-2 rounded px-1.5 py-0.5 text-xs font-semibold ${a.active ? 'bg-mint-pulse/20 text-mint-pulse' : 'bg-stone/30 text-stone'}`}>
                {a.active ? '启用' : '停用'}
              </span>
              <strong>{a.title}</strong>
              <span className="ml-2 text-graphite">
                {a.recurrence === 'once' ? a.date : a.recurrence === 'daily' ? '每日' : `每周 ${(a.weekdays ?? []).map((i) => WD[i]).join('、')}`}
              </span>
              <span className="ml-2 tabular-nums text-stone">
                {a.startTime}-{a.endTime} · {a.priority} · {a.staffNames.join('、')}
              </span>
            </div>
            <div className="flex gap-2">
              <button type="button" className="text-xs text-graphite underline" onClick={() => toggleActive(a.id)}>
                {a.active ? '停用' : '启用'}
              </button>
              <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => remove(a.id)}>
                删除
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
