'use client';

import { useCallback, useMemo } from 'react';
import { Card } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { SopActionTemplate, SopProgressRecord, SopSlotTemplate } from '@/lib/shift-sop/types';
import { findCurrentSlot, isSlotEnded } from '@/lib/shift-sop/time-utils';
import { getProgressRow, isoNow, rid, upsertProgress } from '@/lib/shift-sop/storage';
import { SopActionProgressRow } from '@/components/shift-sop/SopActionProgressRow';

type Props = {
  date: string;
  staff: string;
  templates: SopSlotTemplate[];
  progress: SopProgressRecord[];
  onProgressChange: (next: SopProgressRecord[]) => void;
};

type TodoItem = {
  slot: SopSlotTemplate;
  action: SopActionTemplate;
  overdue: boolean;
  current: boolean;
};

export function ShiftSopTodosPanel({ date, staff, templates, progress, onProgressChange }: Props) {
  const patchRow = useCallback(
    (slot: SopSlotTemplate, action: SopActionTemplate, partial: Partial<Pick<SopProgressRecord, 'status' | 'remark' | 'proofImages' | 'completedAt'>>) => {
      if (!staff) return;
      const ex = getProgressRow(progress, date, staff, action.id);
      const status = partial.status ?? ex?.status ?? 'pending';
      const row: SopProgressRecord = {
        id: ex?.id ?? rid(),
        date,
        employeeName: staff,
        shiftType: slot.shiftType,
        sopTemplateId: slot.id,
        actionId: action.id,
        status,
        proofImages: partial.proofImages ?? ex?.proofImages ?? [],
        remark: partial.remark !== undefined ? partial.remark : (ex?.remark ?? ''),
        completedAt: status === 'done' ? (partial.completedAt ?? isoNow()) : '',
        updatedAt: isoNow(),
      };
      onProgressChange(upsertProgress(progress, row));
    },
    [date, staff, progress, onProgressChange],
  );

  const blocks = useMemo(() => {
    const shifts: ('day' | 'night')[] = ['day', 'night'];
    const now = new Date();
    return shifts.map((st) => {
      const slots = templates.filter((s) => s.shiftType === st && s.enabled).sort((a, b) => a.sort - b.sort);
      const current = findCurrentSlot(slots, now);
      const items: TodoItem[] = [];
      for (const slot of slots) {
        const ended = isSlotEnded(slot, now);
        const isCur = current?.id === slot.id;
        for (const a of slot.actions) {
          if (!a.isRequired) continue;
          const r = staff ? getProgressRow(progress, date, staff, a.id) : undefined;
          if (r?.status === 'done' || r?.status === 'skipped') continue;
          items.push({
            slot,
            action: a,
            overdue: ended && !isCur,
            current: isCur,
          });
        }
      }
      return { shiftType: st, label: st === 'day' ? '白班' : '晚班', items };
    });
  }, [templates, date, staff, progress]);

  if (!staff) {
    return <p className="text-sm text-slate-mid">请先选择当前客服。</p>;
  }

  return (
    <div className="space-y-6">
      {blocks.map((b) => (
        <div key={b.shiftType}>
          <h3 className="mb-2 font-display text-base font-semibold text-coal-ink">{b.label} · 待办必做</h3>
          {b.items.length === 0 ? (
            <p className="text-sm text-emerald-800">暂无未完成必做项（或已全部跳过/完成）。</p>
          ) : (
            <ul className="space-y-2">
              {b.items.map((it) => {
                const slotEnded = isSlotEnded(it.slot, new Date());
                return (
                  <li key={`${it.slot.id}-${it.action.id}`}>
                    <Card
                      className={cn(
                        'border p-3 text-sm',
                        it.current ? 'border-sky-400 bg-sky-50/50' : undefined,
                        it.overdue ? 'border-red-300 bg-red-50/40' : undefined,
                      )}
                    >
                      <div className="text-xs text-slate-mid">
                        {it.slot.startTime}—{it.slot.endTime} · {it.slot.moduleName}
                        {it.current ? <span className="ml-2 font-medium text-sky-800">当前时段</span> : null}
                        {it.overdue ? (
                          <span className="ml-2 font-medium text-red-800">
                            已逾期
                            <span className="ml-1 font-normal text-graphite">（仍可在下方勾选完成、备注或上传截图）</span>
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-2">
                        <SopActionProgressRow
                          slot={it.slot}
                          action={it.action}
                          date={date}
                          staff={staff}
                          progress={progress}
                          isSlotEnded={slotEnded}
                          onPatch={patchRow}
                        />
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
