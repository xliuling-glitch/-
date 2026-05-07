'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui';
import { WORKSPACE_STORAGE_UPDATED } from '@/lib/workspace-events';
import type { ShiftType } from '@/lib/shift-sop/types';
import {
  loadSopDailyOverrides,
  saveSopDailyOverrides,
  upsertSopDailyOverride,
} from '@/lib/shift-sop/daily-override-storage';

export function SopDailyOverridePanel({
  date,
  roster,
  actorName,
}: {
  date: string;
  roster: string[];
  actorName: string;
}) {
  const [rows, setRows] = useState(loadSopDailyOverrides());
  const [staff, setStaff] = useState(roster[0] ?? '');
  const [shift, setShift] = useState<ShiftType | ''>('');
  const [remark, setRemark] = useState('');

  const reload = useCallback(() => setRows(loadSopDailyOverrides()), []);

  useEffect(() => {
    reload();
    const fn = () => reload();
    window.addEventListener(WORKSPACE_STORAGE_UPDATED, fn);
    return () => window.removeEventListener(WORKSPACE_STORAGE_UPDATED, fn);
  }, [reload]);

  useEffect(() => {
    if (roster.length && !staff) setStaff(roster[0]!);
  }, [roster, staff]);

  useEffect(() => {
    const o = rows.find((r) => r.date === date && r.employeeName === staff);
    setRemark(o?.remark ?? '');
    setShift(o?.effectiveShift === 'day' || o?.effectiveShift === 'night' ? o.effectiveShift : '');
  }, [rows, date, staff]);

  const save = () => {
    const next = upsertSopDailyOverride(
      rows,
      {
        date,
        employeeName: staff,
        effectiveShift: shift === '' ? null : shift,
        remark: remark.trim(),
        createdBy: actorName,
      },
      actorName,
    );
    saveSopDailyOverrides(next);
    setRows(next);
  };

  return (
    <Card className="border border-ash p-4">
      <h3 className="font-display text-base font-semibold text-coal-ink">SOP 当日调整</h3>
      <p className="mt-1 text-xs text-slate-mid">仅影响所选客服在「{date}」当天的 SOP 生效班次与说明，不修改全局模板。</p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-xs text-graphite">
          客服
          <select className="input-field mt-1 block text-sm" value={staff} onChange={(e) => setStaff(e.target.value)}>
            {roster.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-graphite">
          当日生效班次覆盖
          <select className="input-field mt-1 block text-sm" value={shift} onChange={(e) => setShift(e.target.value as ShiftType | '')}>
            <option value="">不覆盖（沿用工作包班次）</option>
            <option value="day">白班</option>
            <option value="night">晚班</option>
          </select>
        </label>
        <label className="text-xs text-graphite flex-1 min-w-[200px]">
          备注（如临时顶晚班、下午活动追单）
          <input className="input-field mt-1 w-full text-sm" value={remark} onChange={(e) => setRemark(e.target.value)} />
        </label>
        <button type="button" className="btn-primary text-sm" onClick={save}>
          保存当日调整
        </button>
      </div>
    </Card>
  );
}
