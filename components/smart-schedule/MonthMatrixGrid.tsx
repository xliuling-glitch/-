'use client';

import { useMemo } from 'react';
import type { MonthPlan, Staff } from '@/lib/smart-schedule/types';
import { dateList, todayStr } from '@/lib/smart-schedule/engine';

const WD = ['日', '一', '二', '三', '四', '五', '六'];

function weekdayShort(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return WD[new Date(y, m - 1, d).getDay()];
}

/** 月历矩阵：行=客服，列=日期；白/晚/休+当月休息序号 */
export function MonthMatrixGrid({
  plan,
  staffRows,
  dayTimeLabel,
  nightTimeLabel,
  onCellClick,
}: {
  plan: MonthPlan;
  staffRows: Staff[];
  dayTimeLabel: string;
  nightTimeLabel: string;
  onCellClick: (dateStr: string) => void;
}) {
  const dates = useMemo(() => dateList(plan.year, plan.month), [plan.year, plan.month]);
  const tToday = todayStr();

  const restSeqByStaff = useMemo(() => {
    const m = new Map<string, Record<string, number>>();
    for (const s of staffRows) {
      let c = 0;
      const r: Record<string, number> = {};
      for (const d of dates) {
        if (plan.byDate[d]?.[s.id] === 'rest') {
          c++;
          r[d] = c;
        }
      }
      m.set(s.id, r);
    }
    return m;
  }, [plan.byDate, staffRows, dates]);

  if (!staffRows.length) {
    return <p className="text-sm text-[#969594]">暂无参与排班的客服，请先在「客服管理」中添加并勾选参与排班。</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#5a5957]">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-4 w-7 rounded border border-[#e5e5e5] bg-white" />
          白 {dayTimeLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-4 w-7 rounded bg-[#bfdbfe]" />
          晚 {nightTimeLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-4 w-7 rounded bg-[#fde047]" />
          休（数字为当月第几次休息）
        </span>
        <span className="text-[#969594]">周五列浅粉便于对周；点击格子调整当日全员班次</span>
      </div>

      <div className="overflow-x-auto rounded-[10px] border border-[#f1f1f1] bg-white shadow-sm">
        <table className="w-max min-w-full border-collapse text-center text-[11px] sm:text-xs">
          <thead>
            <tr className="border-b border-[#f1f1f1] bg-[#f7f3eb] text-[#5a5957]">
              <th
                rowSpan={2}
                className="sticky left-0 z-30 min-w-[96px] border-r border-[#f1f1f1] bg-[#f7f3eb] px-2 py-2 text-left align-middle text-sm font-semibold text-[#1c1a17]"
              >
                姓名 / 日期
              </th>
              {dates.map((d) => {
                const dayNum = Number(d.slice(8, 10));
                const fri = weekdayShort(d) === '五';
                return (
                  <th
                    key={`n-${d}`}
                    className={`min-w-[34px] max-w-[40px] px-0.5 py-1 font-semibold tabular-nums text-[#1c1a17] sm:min-w-[38px] ${fri ? 'bg-rose-50' : ''}`}
                  >
                    {dayNum}
                  </th>
                );
              })}
            </tr>
            <tr className="border-b border-[#f1f1f1] bg-[#fafafa] text-[#7e7d7b]">
              {dates.map((d) => {
                const fri = weekdayShort(d) === '五';
                return (
                  <th key={`w-${d}`} className={`px-0.5 py-0.5 text-[10px] font-normal sm:text-[11px] ${fri ? 'bg-rose-50' : ''}`}>
                    {weekdayShort(d)}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {staffRows.map((s) => (
              <tr key={s.id} className="border-b border-[#f1f1f1]/80">
                <td className="sticky left-0 z-20 border-r border-[#f1f1f1] bg-white px-2 py-1.5 text-left text-sm font-medium text-[#1c1a17]">
                  {s.name}
                </td>
                {dates.map((d) => {
                  const sh = plan.byDate[d]?.[s.id] ?? 'rest';
                  const restN = restSeqByStaff.get(s.id)?.[d];
                  let cellClass = 'bg-[#fef08a] text-[#713f12]';
                  let label = restN != null ? `休${restN}` : '休';
                  if (sh === 'day') {
                    cellClass = 'bg-white text-[#1c1a17]';
                    label = '白';
                  } else if (sh === 'night') {
                    cellClass = 'bg-[#bfdbfe] text-[#1e3a5f]';
                    label = '晚';
                  }
                  const fri = weekdayShort(d) === '五';
                  const isToday = d === tToday;
                  return (
                    <td key={d} className={`p-0.5 ${fri ? 'bg-rose-50/50' : ''}`}>
                      <button
                        type="button"
                        title={`${d} ${s.name} · 点击调整当日排班`}
                        onClick={() => onCellClick(d)}
                        className={`flex h-8 w-full min-w-[32px] items-center justify-center rounded border border-[#f1f1f1]/80 font-semibold tabular-nums transition hover:brightness-95 hover:ring-1 hover:ring-[#1c1a17]/20 sm:h-9 ${cellClass} ${
                          isToday ? 'ring-2 ring-[#05933b] ring-offset-1' : ''
                        }`}
                      >
                        {label}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
