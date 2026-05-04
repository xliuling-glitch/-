'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Anomaly, DayShifts, MonthPlan, ScheduleRules, ShiftType, Staff, StaffStat } from '@/lib/smart-schedule/types';
import { DEFAULT_RULES } from '@/lib/smart-schedule/types';
import { loadPlan, loadRules, loadStaff, savePlan, saveRules, saveStaff } from '@/lib/smart-schedule/storage';
import {
  computeAnomalies,
  computeStats,
  dateList,
  generateMonth,
  getDaySnapshot,
  todayStr,
} from '@/lib/smart-schedule/engine';
import { MonthMatrixGrid } from '@/components/smart-schedule/MonthMatrixGrid';
import { ScheduleExcelToolbar } from '@/components/smart-schedule/ScheduleExcelToolbar';

type Tab = 'dashboard' | 'staff' | 'rules' | 'generate' | 'grid' | 'stats' | 'anomalies';

const SHIFT_LABEL: Record<ShiftType, string> = { day: '白班', night: '晚班', rest: '休息' };

/** 当前版跑顺后的迭代方向（与 DESIGN.md「排班管理 · 后续版本规划」一致） */
const SCHEDULE_ROADMAP = ['节假日规则', '新老客服搭配', '晚班补贴统计', '请假申请'] as const;

function formatChineseDateLabel(ymd: string) {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return ymd;
  return `${m[1]}年${Number(m[2])}月${Number(m[3])}日`;
}

export function SmartScheduleApp() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [staff, setStaff] = useState<Staff[]>([]);
  const [rules, setRules] = useState<ScheduleRules>({ ...DEFAULT_RULES });
  const [plan, setPlan] = useState<MonthPlan | null>(null);
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth() + 1);
  const [genYear, setGenYear] = useState(() => new Date().getFullYear());
  const [genMonth, setGenMonth] = useState(() => new Date().getMonth() + 1);
  const [hydrated, setHydrated] = useState(false);
  const [previewDate, setPreviewDate] = useState('');
  const [editDate, setEditDate] = useState<string | null>(null);
  /** 月度排班表：月历矩阵 vs 按日三列总览 */
  const [gridViewMode, setGridViewMode] = useState<'matrix' | 'byDay'>('matrix');
  /** 月历矩阵下查看全部或某一客服 */
  const [matrixStaffFilter, setMatrixStaffFilter] = useState<'all' | string>('all');

  useEffect(() => {
    setStaff(loadStaff());
    setRules(loadRules());
    setPlan(loadPlan());
    setHydrated(true);
    setPreviewDate(todayStr());
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveStaff(staff);
  }, [staff, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    saveRules(rules);
  }, [rules, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    savePlan(plan);
  }, [plan, hydrated]);

  const joinStaff = useMemo(() => staff.filter((s) => s.joinSchedule), [staff]);

  useEffect(() => {
    if (matrixStaffFilter !== 'all' && !joinStaff.some((s) => s.id === matrixStaffFilter)) {
      setMatrixStaffFilter('all');
    }
  }, [joinStaff, matrixStaffFilter]);
  const stats = useMemo(() => computeStats(plan, staff, rules), [plan, staff, rules]);
  const anomalies = useMemo(() => computeAnomalies(plan, staff, rules), [plan, staff, rules]);
  const monthlyDash = useMemo(() => {
    const a = computeAnomalies(plan, staff, rules);
    return {
      errCount: a.filter((x) => x.severity === 'error').length,
      warnCount: a.filter((x) => x.severity === 'warn').length,
      anomalyTotal: a.length,
    };
  }, [plan, staff, rules]);
  const snap = useMemo(
    () => getDaySnapshot(plan, staff, rules, previewDate || todayStr()),
    [plan, staff, rules, previewDate],
  );
  const dates = useMemo(() => (plan ? dateList(plan.year, plan.month) : dateList(viewYear, viewMonth)), [plan, viewYear, viewMonth]);
  const planMatchesView = plan && plan.year === viewYear && plan.month === viewMonth;
  const displayPlan = planMatchesView ? plan : null;

  const errorDates = useMemo(() => {
    const s = new Set<string>();
    for (const a of anomalies) {
      if (a.severity === 'error' && a.date && (a.type === '白班不足' || a.type === '晚班不足')) s.add(a.date);
    }
    return s;
  }, [anomalies]);

  const okDates = useMemo(() => {
    if (!displayPlan) return new Set<string>();
    const ok = new Set<string>();
    for (const d of dates) {
      if (!errorDates.has(d)) {
        const row = displayPlan.byDate[d];
        if (row) {
          const dc = joinStaff.filter((x) => row[x.id] === 'day').length;
          const nc = joinStaff.filter((x) => row[x.id] === 'night').length;
          if (dc >= rules.minDay && nc >= rules.minNight) ok.add(d);
        }
      }
    }
    return ok;
  }, [displayPlan, dates, joinStaff, rules, errorDates]);

  const runGenerate = useCallback(() => {
    const p = generateMonth(genYear, genMonth, staff, rules);
    setPlan(p);
    setViewYear(genYear);
    setViewMonth(genMonth);
    setTab('grid');
  }, [genYear, genMonth, staff, rules]);

  const updateShift = useCallback(
    (dateStr: string, staffId: string, shift: ShiftType) => {
      if (!plan) return;
      const s = staff.find((x) => x.id === staffId);
      if (shift === 'night' && s && !s.canNight) return;
      setPlan({
        ...plan,
        byDate: {
          ...plan.byDate,
          [dateStr]: { ...plan.byDate[dateStr], [staffId]: shift },
        },
      });
    },
    [plan, staff],
  );

  if (!hydrated) {
    return <div className="py-12 text-center text-sm text-[#7e7d7b]">加载排班数据…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 border-b border-[#f1f1f1] pb-3">
        {(
          [
            ['dashboard', '首页看板'],
            ['staff', '客服管理'],
            ['rules', '排班规则'],
            ['generate', '自动排班'],
            ['grid', '月度排班表'],
            ['stats', '员工统计'],
            ['anomalies', '异常检查'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              tab === k ? 'bg-[#1c1a17] text-white' : 'bg-[#f1f1f1] text-[#5a5957] hover:bg-[#e8e8e8]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="rounded-[10px] border border-dashed border-[#bab9b8] bg-[#f7f3eb]/40 px-4 py-3 text-xs leading-relaxed text-[#5a5957]">
        <span className="font-semibold text-[#1c1a17]">后续版本（本版跑顺后再做）：</span>
        <span className="mt-1 block sm:mt-0 sm:inline">
          {SCHEDULE_ROADMAP.join(' · ')}
        </span>
      </div>

      {tab === 'dashboard' && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end gap-4 rounded-[10px] border border-[#f1f1f1] bg-white p-4">
            <label className="text-sm text-[#5a5957]">
              预览日期
              <input
                type="date"
                className="input-field mt-1 block w-auto min-w-[11rem]"
                value={previewDate}
                onChange={(e) => setPreviewDate(e.target.value)}
              />
            </label>
            <button type="button" className="btn-ghost text-sm" onClick={() => setPreviewDate(todayStr())}>
              回到今天
            </button>
            <div className="text-sm text-[#1c1a17]">
              <span className="font-medium">{formatChineseDateLabel(previewDate || todayStr())}</span>
              {(previewDate || todayStr()) === todayStr() ? (
                <span className="ml-2 rounded-full bg-[#ecfdf5] px-2 py-0.5 text-xs text-[#047857]">今天</span>
              ) : null}
            </div>
            {snap.hint ? <p className="w-full text-xs text-[#b45309]">{snap.hint}</p> : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Card title="白班人员" timeRange={`时段 ${rules.dayStart} – ${rules.dayEnd}`} accent="day">
              <ul className="mt-2 space-y-1 text-sm">
                {!snap.hasRow ? (
                  <li className="text-[#969594]">该日无排班数据或不在当前排班月份内</li>
                ) : snap.dayNames.length ? (
                  snap.dayNames.map((n) => <li key={n}>{n}</li>)
                ) : (
                  <li className="text-[#969594]">无人排白班</li>
                )}
              </ul>
            </Card>
            <Card title="晚班人员" timeRange={`时段 ${rules.nightStart} – ${rules.nightEnd}`} accent="night">
              <ul className="mt-2 space-y-1 text-sm">
                {!snap.hasRow ? (
                  <li className="text-[#969594]">该日无排班数据或不在当前排班月份内</li>
                ) : snap.nightNames.length ? (
                  snap.nightNames.map((n) => <li key={n}>{n}</li>)
                ) : (
                  <li className="text-[#969594]">无人排晚班</li>
                )}
              </ul>
            </Card>
            <Card title="休息" accent="rest">
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-sm">
                {!snap.hasRow ? (
                  <li className="text-[#969594]">—</li>
                ) : snap.restNames.length ? (
                  snap.restNames.map((n) => <li key={n}>{n}</li>)
                ) : (
                  <li className="text-[#969594]">无</li>
                )}
              </ul>
            </Card>
            <div className="rounded-[10px] border border-[#f1f1f1] bg-white p-4 md:col-span-2 xl:col-span-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[#1c1a17]">当日人力是否满足规则</div>
                  <div className="mt-1 text-xs text-[#7e7d7b]">
                    对照规则：白班 ≥ {rules.minDay}，晚班 ≥ {rules.minNight}（预览日 {snap.dateStr}）
                  </div>
                </div>
                <span
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${
                    snap.short ? 'bg-[#fee2e2] text-[#b91c1c]' : 'bg-[#d1fae5] text-[#047857]'
                  }`}
                >
                  {!snap.hasRow ? '无数据' : snap.short ? '缺人或不足' : '人力满足'}
                </span>
              </div>
            </div>
            <div className="rounded-[10px] border border-[#f1f1f1] bg-[#fafafa] p-4 md:col-span-2 xl:col-span-3">
              <div className="text-sm font-semibold text-[#1c1a17]">本月异常数量（全月统计）</div>
              <div className="mt-2 flex flex-wrap gap-4 text-sm">
                <span>
                  错误级：<strong className="text-[#b91c1c]">{monthlyDash.errCount}</strong>
                </span>
                <span>
                  提醒级：<strong className="text-[#b45309]">{monthlyDash.warnCount}</strong>
                </span>
                <span>
                  合计：<strong>{monthlyDash.anomalyTotal}</strong>
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {tab === 'staff' && <StaffTab staff={staff} setStaff={setStaff} />}
      {tab === 'rules' && <RulesTab rules={rules} setRules={setRules} />}
      {tab === 'generate' && (
        <section className="max-w-xl space-y-4 rounded-[10px] border border-[#f1f1f1] bg-white p-6">
          <h3 className="font-display text-lg font-bold text-[#1c1a17]">一键生成排班</h3>
          <p className="text-sm text-[#7e7d7b]">按当前客服与规则生成整月排班，写入本地；可再到「月度排班表」微调。</p>
          <div className="flex flex-wrap gap-3">
            <label className="text-sm text-[#5a5957]">
              年份
              <input
                type="number"
                className="input-field mt-1 w-28"
                value={genYear}
                onChange={(e) => setGenYear(Number(e.target.value))}
              />
            </label>
            <label className="text-sm text-[#5a5957]">
              月份
              <select className="input-field mt-1 w-28" value={genMonth} onChange={(e) => setGenMonth(Number(e.target.value))}>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1} 月
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button type="button" className="btn-primary" onClick={runGenerate}>
            一键生成排班
          </button>
        </section>
      )}

      {tab === 'grid' && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm text-[#5a5957]">
              查看年
              <input
                type="number"
                className="input-field mt-1 w-28"
                value={viewYear}
                onChange={(e) => setViewYear(Number(e.target.value))}
              />
            </label>
            <label className="text-sm text-[#5a5957]">
              月
              <select className="input-field mt-1 w-28" value={viewMonth} onChange={(e) => setViewMonth(Number(e.target.value))}>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1} 月
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <span className="self-end text-xs font-medium text-[#5a5957]">视图</span>
              {(
                [
                  ['matrix', '月历矩阵'],
                  ['byDay', '按日总览'],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setGridViewMode(k)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    gridViewMode === k ? 'bg-[#1c1a17] text-white' : 'bg-[#f1f1f1] text-[#5a5957] hover:bg-[#e8e8e8]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {gridViewMode === 'matrix' && (
              <label className="text-sm text-[#5a5957]">
                查看客服
                <select
                  className="input-field mt-1 min-w-[8rem]"
                  value={matrixStaffFilter}
                  onChange={(e) => setMatrixStaffFilter(e.target.value as 'all' | string)}
                >
                  <option value="all">全部客服</option>
                  {joinStaff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {!planMatchesView && (
              <span className="text-xs text-[#b45309]">当前本地排班为 {plan ? `${plan.year}-${plan.month}` : '无'}，与查看年月不一致时可点「自动排班」生成该月。</span>
            )}
          </div>

          <ScheduleExcelToolbar
            staff={staff}
            viewYear={viewYear}
            viewMonth={viewMonth}
            onImported={(p) => setPlan(p)}
            onJumpToMonth={(y, m) => {
              setViewYear(y);
              setViewMonth(m);
            }}
          />

          {!displayPlan ? (
            <p className="text-sm text-[#969594]">该月份暂无排班表，请使用「自动排班」生成。</p>
          ) : gridViewMode === 'matrix' ? (
            <>
              {matrixStaffFilter !== 'all' ? (
                <p className="text-sm text-[#5a5957]">
                  当前仅展示「{joinStaff.find((s) => s.id === matrixStaffFilter)?.name ?? ''}」的班次；点击某日格子仍会打开<strong>当日全员</strong>调整弹窗。
                </p>
              ) : (
                <p className="text-sm text-[#5a5957]">横向为当月每一天，纵向为参与排班的客服；休息格内数字表示本月第几次休息。</p>
              )}
              <MonthMatrixGrid
                plan={displayPlan}
                staffRows={matrixStaffFilter === 'all' ? joinStaff : joinStaff.filter((s) => s.id === matrixStaffFilter)}
                dayTimeLabel={`${rules.dayStart}–${rules.dayEnd}`}
                nightTimeLabel={`${rules.nightStart}–${rules.nightEnd}`}
                onCellClick={(d) => displayPlan.byDate[d] && setEditDate(d)}
              />
            </>
          ) : (
            <div className="overflow-x-auto rounded-[10px] border border-[#f1f1f1] bg-white">
              <table className="min-w-[720px] w-full border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-[#f1f1f1] bg-[#f7f3eb] text-left text-[#5a5957]">
                    <th className="sticky left-0 z-10 min-w-[88px] border-r border-[#f1f1f1] px-2 py-2">日期</th>
                    <th className="min-w-[120px] px-2 py-2">白班</th>
                    <th className="min-w-[100px] px-2 py-2">晚班</th>
                    <th className="min-w-[120px] px-2 py-2">休息</th>
                  </tr>
                </thead>
                <tbody>
                  {dates.map((d) => {
                    const row = displayPlan.byDate[d];
                    const dayN = joinStaff.filter((s) => row?.[s.id] === 'day').map((s) => s.name);
                    const nightN = joinStaff.filter((s) => row?.[s.id] === 'night').map((s) => s.name);
                    const restN = joinStaff.filter((s) => row?.[s.id] === 'rest').map((s) => s.name);
                    const err = errorDates.has(d);
                    const ok = okDates.has(d);
                    return (
                      <tr
                        key={d}
                        className={`border-b border-[#f1f1f1]/80 ${err ? 'bg-[#fef2f2]' : ok ? 'bg-[#f0fdf4]' : ''}`}
                      >
                        <td className="sticky left-0 z-10 border-r border-[#f1f1f1] bg-white px-2 py-2 font-medium whitespace-nowrap">
                          {d}
                          {d === todayStr() ? <span className="ml-1 text-[#05933b]">（今）</span> : null}
                        </td>
                        <td
                          className="cursor-pointer px-2 py-2 align-top hover:bg-[#fafafa]"
                          onClick={() => row && setEditDate(d)}
                          title="点击调整"
                        >
                          {dayN.join('、') || '—'}
                        </td>
                        <td className="cursor-pointer px-2 py-2 align-top hover:bg-[#fafafa]" onClick={() => row && setEditDate(d)}>
                          {nightN.join('、') || '—'}
                        </td>
                        <td className="cursor-pointer px-2 py-2 align-top hover:bg-[#fafafa]" onClick={() => row && setEditDate(d)}>
                          {restN.join('、') || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === 'stats' && <StatsTable stats={stats} />}
      {tab === 'anomalies' && <AnomalyList items={anomalies} />}

      {editDate && displayPlan && (
        <EditDayModal
          dateStr={editDate}
          shifts={displayPlan.byDate[editDate] || {}}
          staff={staff}
          onClose={() => setEditDate(null)}
          onSave={(next) => {
            setPlan({ ...plan!, byDate: { ...plan!.byDate, [editDate]: next } });
            setEditDate(null);
          }}
        />
      )}
    </div>
  );
}

function Card({
  title,
  timeRange,
  children,
  accent,
}: {
  title: string;
  timeRange?: string;
  children: React.ReactNode;
  accent: 'day' | 'night' | 'rest';
}) {
  const border =
    accent === 'day' ? 'border-l-[#05933b]' : accent === 'night' ? 'border-l-[#731fff]' : 'border-l-[#969594]';
  return (
    <div className={`rounded-[10px] border border-[#f1f1f1] border-l-4 bg-white p-4 ${border}`}>
      <div className="text-sm font-semibold text-[#1c1a17]">{title}</div>
      {timeRange ? (
        <div className="mt-0.5 text-xs font-medium tabular-nums text-[#5a5957]">
          时段 {timeRange}
        </div>
      ) : null}
      {children}
    </div>
  );
}

function StaffTab({ staff, setStaff }: { staff: Staff[]; setStaff: Dispatch<SetStateAction<Staff[]>> }) {
  const add = () => {
    const id = String(Date.now());
    setStaff((s) => [...s, { id, name: '新员工', joinSchedule: true, monthlyRestQuota: 6, canNight: true, note: '' }]);
  };
  const upd = (id: string, patch: Partial<Staff>) => {
    setStaff((list) => list.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };
  return (
    <div className="space-y-4">
      <div className="flex justify-between gap-2">
        <h3 className="font-display text-lg font-bold text-[#1c1a17]">客服管理</h3>
        <button type="button" className="btn-primary text-sm" onClick={add}>
          添加客服
        </button>
      </div>
      <div className="overflow-x-auto rounded-[10px] border border-[#f1f1f1] bg-white">
        <table className="w-full min-w-[800px] text-sm">
          <thead>
            <tr className="border-b border-[#f1f1f1] bg-[#f7f3eb] text-left text-[#5a5957]">
              <th className="px-2 py-2">姓名</th>
              <th className="px-2 py-2">参与排班</th>
              <th className="px-2 py-2">本月应休</th>
              <th className="px-2 py-2">可晚班</th>
              <th className="px-2 py-2">备注</th>
              <th className="px-2 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id} className="border-b border-[#f1f1f1]/80">
                <td className="px-2 py-2">
                  <input className="input-field py-1 text-sm" value={s.name} onChange={(e) => upd(s.id, { name: e.target.value })} />
                </td>
                <td className="px-2 py-2">
                  <input type="checkbox" checked={s.joinSchedule} onChange={(e) => upd(s.id, { joinSchedule: e.target.checked })} />
                </td>
                <td className="px-2 py-2">
                  <input
                    type="number"
                    min={0}
                    max={31}
                    className="input-field w-20 py-1 text-sm"
                    value={s.monthlyRestQuota}
                    onChange={(e) => upd(s.id, { monthlyRestQuota: Number(e.target.value) })}
                  />
                </td>
                <td className="px-2 py-2">
                  <input type="checkbox" checked={s.canNight} onChange={(e) => upd(s.id, { canNight: e.target.checked })} />
                </td>
                <td className="px-2 py-2">
                  <input className="input-field py-1 text-sm" value={s.note} onChange={(e) => upd(s.id, { note: e.target.value })} />
                </td>
                <td className="px-2 py-2">
                  <button type="button" className="text-sm text-[#b91c1c] hover:underline" onClick={() => setStaff((list) => list.filter((x) => x.id !== s.id))}>
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RulesTab({ rules, setRules }: { rules: ScheduleRules; setRules: Dispatch<SetStateAction<ScheduleRules>> }) {
  const field = (k: keyof ScheduleRules, label: string, type: 'text' | 'number' = 'text') => (
    <label className="block text-sm text-[#5a5957]">
      {label}
      <input
        type={type}
        className="input-field mt-1"
        value={rules[k] as string | number}
        onChange={(e) => {
          const v = type === 'number' ? Number(e.target.value) : e.target.value;
          setRules((r) => ({ ...r, [k]: v }));
        }}
      />
    </label>
  );
  return (
    <div className="mx-auto max-w-lg space-y-3 rounded-[10px] border border-[#f1f1f1] bg-white p-6">
      <h3 className="font-display text-lg font-bold text-[#1c1a17]">排班规则</h3>
      <p className="rounded-lg border border-[#e8e4dc] bg-[#faf8f4] px-3 py-2 text-xs leading-relaxed text-[#5a5957]">
        <strong className="text-[#1c1a17]">默认保障：</strong>
        自动排班时<strong>任意一天都不会出现全员休息</strong>；若多人同日应休导致人力不足，会优先取消「应休天数较多」的同事该日休息，并在其它日期尽量补休。每日白班、晚班人数仍须满足下方最低人数（且晚班仅安排「可上晚班」人员）。
      </p>
      {field('dayStart', '白班开始时间')}
      {field('dayEnd', '白班结束时间')}
      {field('nightStart', '晚班开始时间')}
      {field('nightEnd', '晚班结束时间')}
      {field('minDay', '每天最低白班人数', 'number')}
      {field('minNight', '每天最低晚班人数', 'number')}
      {field('maxConsecutiveWork', '最大连续上班天数', 'number')}
      {field('maxConsecutiveNight', '最大连续晚班天数', 'number')}
    </div>
  );
}

function StatsTable({ stats }: { stats: StaffStat[] }) {
  return (
    <div className="overflow-x-auto rounded-[10px] border border-[#f1f1f1] bg-white">
      <table className="w-full min-w-[960px] text-sm">
        <thead>
          <tr className="border-b border-[#f1f1f1] bg-[#f7f3eb] text-left text-[#5a5957]">
            <th className="px-2 py-2">客服</th>
            <th className="px-2 py-2">白班次数</th>
            <th className="px-2 py-2">晚班次数</th>
            <th className="px-2 py-2">休息天数</th>
            <th className="px-2 py-2">应休天数</th>
            <th className="px-2 py-2">是否休满</th>
            <th className="px-2 py-2">最大连续上班</th>
            <th className="px-2 py-2">最大连续晚班</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => (
            <tr key={s.staffId} className="border-b border-[#f1f1f1]/80">
              <td className="px-2 py-2 font-medium">{s.name}</td>
              <td className="px-2 py-2">{s.dayCount}</td>
              <td className="px-2 py-2">{s.nightCount}</td>
              <td className={`px-2 py-2 ${s.restCount !== s.quota ? 'bg-[#fef2f2] font-semibold text-[#b91c1c]' : ''}`}>{s.restCount}</td>
              <td className="px-2 py-2">{s.quota}</td>
              <td className={`px-2 py-2 ${s.restOk ? 'text-[#05933b]' : 'text-[#b91c1c] font-semibold'}`}>{s.restOk ? '是' : '否'}</td>
              <td className="px-2 py-2">{s.maxConsecutiveWork}</td>
              <td className="px-2 py-2">{s.maxConsecutiveNight}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AnomalyList({ items }: { items: Anomaly[] }) {
  if (!items.length) return <p className="text-sm text-[#05933b]">暂无异常记录。</p>;
  return (
    <div className="overflow-x-auto rounded-[10px] border border-[#f1f1f1] bg-white">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-[#f1f1f1] bg-[#f7f3eb] text-left text-[#5a5957]">
            <th className="px-2 py-2">日期</th>
            <th className="px-2 py-2">类型</th>
            <th className="px-2 py-2">说明</th>
            <th className="px-2 py-2">建议</th>
            <th className="px-2 py-2">级别</th>
          </tr>
        </thead>
        <tbody>
          {items.map((a) => (
            <tr key={a.id} className={`border-b border-[#f1f1f1]/80 ${a.severity === 'error' ? 'bg-[#fef2f2]' : 'bg-[#fffbeb]'}`}>
              <td className="px-2 py-2 whitespace-nowrap">{a.date || '—'}</td>
              <td className="px-2 py-2">{a.type}</td>
              <td className="px-2 py-2">{a.message}</td>
              <td className="px-2 py-2 text-[#5a5957]">{a.suggestion}</td>
              <td className="px-2 py-2">{a.severity === 'error' ? '错误' : '提醒'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EditDayModal({
  dateStr,
  shifts,
  staff,
  onClose,
  onSave,
}: {
  dateStr: string;
  shifts: DayShifts;
  staff: Staff[];
  onClose: () => void;
  onSave: (next: DayShifts) => void;
}) {
  const joinList = staff.filter((s) => s.joinSchedule);
  const [draft, setDraft] = useState<DayShifts>({});
  useEffect(() => {
    const d: DayShifts = {};
    for (const s of staff.filter((x) => x.joinSchedule)) d[s.id] = shifts[s.id] || 'rest';
    setDraft(d);
  }, [shifts, dateStr, staff]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[12px] border border-[#f1f1f1] bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h4 className="font-display text-lg font-bold text-[#1c1a17]">调整 {dateStr}</h4>
        <p className="mt-1 text-xs text-[#7e7d7b]">为每位参与排班的客服选择班次；保存后立即重算统计与异常。</p>
        <div className="mt-4 space-y-2">
          {joinList.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-2 border-b border-[#f1f1f1]/80 py-2">
              <span className="w-20 font-medium">{s.name}</span>
              {(['day', 'night', 'rest'] as ShiftType[]).map((sh) => (
                <label key={sh} className="flex cursor-pointer items-center gap-1 text-sm">
                  <input
                    type="radio"
                    name={`shift-${s.id}`}
                    checked={draft[s.id] === sh}
                    disabled={sh === 'night' && !s.canNight}
                    onChange={() => setDraft((d) => ({ ...d, [s.id]: sh }))}
                  />
                  {SHIFT_LABEL[sh]}
                </label>
              ))}
            </div>
          ))}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn-ghost text-sm" onClick={onClose}>
            取消
          </button>
          <button type="button" className="btn-primary text-sm" onClick={() => onSave(draft)}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
