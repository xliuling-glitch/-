'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui';
import type { DailyTaskTemplate, WeeklyTaskTemplate } from '@/lib/daily-work-package/types';

export function WorkPackageTemplateSettings({
  daily,
  weekly,
  onSaveDaily,
  onSaveWeekly,
}: {
  daily: DailyTaskTemplate[];
  weekly: WeeklyTaskTemplate[];
  onSaveDaily: (t: DailyTaskTemplate[]) => void;
  onSaveWeekly: (t: WeeklyTaskTemplate[]) => void;
}) {
  const [d, setD] = useState(daily);
  const [w, setW] = useState(weekly);
  useEffect(() => {
    setD(daily);
    setW(weekly);
  }, [daily, weekly]);

  const syncDaily = (i: number, patch: Partial<DailyTaskTemplate>) => {
    setD((prev) => prev.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  };
  const syncWeekly = (i: number, patch: Partial<WeeklyTaskTemplate>) => {
    setW((prev) => prev.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  };

  return (
    <div className="space-y-6">
      <Card className="border border-ash p-4">
        <h3 className="font-display text-base font-semibold text-coal-ink">每日任务模板</h3>
        <p className="mt-1 text-xs text-slate-mid">可启用/停用、改名称、目标数量、是否需截图与主管审核。</p>
        <div className="mt-4 space-y-3">
          {d.map((row, i) => (
            <div key={row.id} className="rounded-lg border border-ash/80 bg-ledger-white p-3 text-sm">
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-graphite">
                  <input type="checkbox" checked={row.enabled} onChange={(e) => syncDaily(i, { enabled: e.target.checked })} />
                  启用
                </label>
                <label className="flex items-center gap-2 text-xs text-graphite">
                  <input type="checkbox" checked={row.showInCenter} onChange={(e) => syncDaily(i, { showInCenter: e.target.checked })} />
                  显示在今日中心
                </label>
                <label className="flex items-center gap-2 text-xs text-graphite">
                  <input type="checkbox" checked={row.kpiCounted} onChange={(e) => syncDaily(i, { kpiCounted: e.target.checked })} />
                  计入 KPI
                </label>
                <label className="flex items-center gap-2 text-xs text-graphite">
                  <input type="checkbox" checked={row.needProof} onChange={(e) => syncDaily(i, { needProof: e.target.checked })} />
                  需截图
                </label>
                <label className="flex items-center gap-2 text-xs text-graphite">
                  <input type="checkbox" checked={row.needReview} onChange={(e) => syncDaily(i, { needReview: e.target.checked })} />
                  需审核
                </label>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="text-xs text-graphite">
                  任务名称
                  <input className="input-field mt-1 w-full text-sm" value={row.taskName} onChange={(e) => syncDaily(i, { taskName: e.target.value })} />
                </label>
                <label className="text-xs text-graphite">
                  目标数量
                  <input
                    type="number"
                    min={0}
                    className="input-field mt-1 w-full text-sm"
                    value={row.targetCount}
                    onChange={(e) => syncDaily(i, { targetCount: Number(e.target.value) || 0 })}
                  />
                </label>
              </div>
              <label className="mt-2 block text-xs text-graphite">
                说明
                <textarea className="input-field mt-1 min-h-[52px] w-full text-sm" value={row.description} onChange={(e) => syncDaily(i, { description: e.target.value })} />
              </label>
              <label className="mt-2 block text-xs text-graphite">
                完成方式说明
                <input className="input-field mt-1 w-full text-sm" value={row.completionMethod} onChange={(e) => syncDaily(i, { completionMethod: e.target.value })} />
              </label>
            </div>
          ))}
        </div>
        <button type="button" className="btn-primary mt-4 text-sm" onClick={() => onSaveDaily(d)}>
          保存每日模板
        </button>
      </Card>

      <Card className="border border-ash p-4">
        <h3 className="font-display text-base font-semibold text-coal-ink">本周任务模板</h3>
        <div className="mt-3 space-y-3">
          {w.map((row, i) => (
            <div key={row.id} className="rounded-lg border border-ash/80 bg-ledger-white p-3 text-sm">
              <div className="flex flex-wrap gap-3">
                <label className="flex items-center gap-2 text-xs text-graphite">
                  <input type="checkbox" checked={row.enabled} onChange={(e) => syncWeekly(i, { enabled: e.target.checked })} />
                  启用
                </label>
                <label className="flex items-center gap-2 text-xs text-graphite">
                  <input type="checkbox" checked={row.needProof} onChange={(e) => syncWeekly(i, { needProof: e.target.checked })} />
                  需截图
                </label>
                <label className="flex items-center gap-2 text-xs text-graphite">
                  <input type="checkbox" checked={row.needReview} onChange={(e) => syncWeekly(i, { needReview: e.target.checked })} />
                  需审核
                </label>
              </div>
              <label className="mt-2 block text-xs text-graphite">
                周任务名称
                <input className="input-field mt-1 w-full text-sm" value={row.taskName} onChange={(e) => syncWeekly(i, { taskName: e.target.value })} />
              </label>
              <label className="mt-2 block text-xs text-graphite">
                周目标店铺数
                <input
                  type="number"
                  min={1}
                  className="input-field mt-1 w-full text-sm"
                  value={row.targetCount}
                  onChange={(e) => syncWeekly(i, { targetCount: Number(e.target.value) || 1 })}
                />
              </label>
              <p className="mt-2 text-xs text-slate-mid">
                产品方向要求：{row.requiredCategories.map((c) => c.label).join('、')}（各至少 {row.requiredCategories[0]?.minCount ?? 1} 家）
              </p>
            </div>
          ))}
        </div>
        <button type="button" className="btn-primary mt-4 text-sm" onClick={() => onSaveWeekly(w)}>
          保存周任务模板
        </button>
      </Card>
    </div>
  );
}
