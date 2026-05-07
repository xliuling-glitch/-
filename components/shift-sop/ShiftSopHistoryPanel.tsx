'use client';

import { useMemo, useState } from 'react';
import { Card } from '@/components/ui';
import type { SopProgressRecord, SopSlotTemplate } from '@/lib/shift-sop/types';
import { formatActionTypeLabel } from '@/lib/shift-sop/time-utils';

type Props = {
  date: string;
  staff: string;
  templates: SopSlotTemplate[];
  progress: SopProgressRecord[];
};

export function ShiftSopHistoryPanel({ date, staff, templates, progress }: Props) {
  const [range, setRange] = useState<'day' | 'week'>('day');

  const actionMeta = useMemo(() => {
    const m = new Map<string, { text: string; type: string }>();
    for (const s of templates) {
      for (const a of s.actions) {
        m.set(a.id, { text: a.actionText, type: formatActionTypeLabel(a.actionType) });
      }
    }
    return m;
  }, [templates]);

  const rows = useMemo(() => {
    let list = progress.filter((r) => r.employeeName === staff);
    if (range === 'day') {
      list = list.filter((r) => r.date === date);
    } else {
      const anchor = new Date(`${date}T12:00:00`);
      const start = new Date(anchor);
      start.setDate(start.getDate() - 6);
      const startStr = start.toISOString().slice(0, 10);
      list = list.filter((r) => r.date >= startStr && r.date <= date);
    }
    list = list.filter((r) => r.status !== 'pending');
    return [...list].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }, [progress, staff, date, range]);

  if (!staff) {
    return <p className="text-sm text-slate-mid">请先选择当前客服。</p>;
  }

  const statusLabel = (s: SopProgressRecord['status']) => {
    const m = { done: '已完成', skipped: '已跳过', deferred: '已延期', pending: '待处理' };
    return m[s] ?? s;
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={range === 'day' ? 'btn-primary text-sm' : 'btn-ghost text-sm'}
          onClick={() => setRange('day')}
        >
          当日完成记录
        </button>
        <button
          type="button"
          className={range === 'week' ? 'btn-primary text-sm' : 'btn-ghost text-sm'}
          onClick={() => setRange('week')}
        >
          近 7 日
        </button>
      </div>
      <Card className="overflow-x-auto border border-ash">
        <table className="min-w-[720px] w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-ash bg-ash/40 text-left text-xs text-graphite">
              {['日期', '班次', '时段模块', '动作', '类型', '状态', '备注', '更新时间'].map((h) => (
                <th key={h} className="px-2 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-slate-mid">
                  暂无完成/跳过/延期记录
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const slot = templates.find((s) => s.id === r.sopTemplateId);
                const meta = actionMeta.get(r.actionId);
                return (
                  <tr key={r.id} className="border-b border-ash/80">
                    <td className="px-2 py-1 whitespace-nowrap">{r.date}</td>
                    <td className="px-2 py-1">{r.shiftType === 'day' ? '白班' : '晚班'}</td>
                    <td className="px-2 py-1">{slot ? `${slot.startTime}-${slot.endTime} ${slot.moduleName}` : r.sopTemplateId}</td>
                    <td className="px-2 py-1 max-w-[240px]">{meta?.text ?? r.actionId}</td>
                    <td className="px-2 py-1">{meta?.type ?? '—'}</td>
                    <td className="px-2 py-1">{statusLabel(r.status)}</td>
                    <td className="px-2 py-1 max-w-[180px] truncate">{r.remark || '—'}</td>
                    <td className="px-2 py-1 whitespace-nowrap text-xs text-slate-mid">{r.updatedAt?.slice(0, 19).replace('T', ' ') ?? '—'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
