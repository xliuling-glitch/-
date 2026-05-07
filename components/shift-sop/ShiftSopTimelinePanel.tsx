'use client';

import { useCallback, useMemo, useState } from 'react';
import { Card } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { ShiftType, SopActionTemplate, SopProgressRecord, SopSlotTemplate } from '@/lib/shift-sop/types';
import { findCurrentSlot, isSlotEnded } from '@/lib/shift-sop/time-utils';
import { getProgressRow, isoNow, rid, upsertProgress } from '@/lib/shift-sop/storage';
import { SopActionProgressRow } from '@/components/shift-sop/SopActionProgressRow';

type Props = {
  shiftType: ShiftType;
  date: string;
  staff: string;
  templates: SopSlotTemplate[];
  progress: SopProgressRecord[];
  onProgressChange: (next: SopProgressRecord[]) => void;
};

export function ShiftSopTimelinePanel({ shiftType, date, staff, templates, progress, onProgressChange }: Props) {
  const slots = useMemo(
    () => templates.filter((s) => s.shiftType === shiftType && s.enabled).sort((a, b) => a.sort - b.sort),
    [templates, shiftType],
  );

  const current = useMemo(() => findCurrentSlot(slots, new Date()), [slots]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleCollapse = (id: string) => {
    setCollapsed((c) => ({ ...c, [id]: !c[id] }));
  };

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

  return (
    <div className="space-y-4">
      {current ? (
        <Card className="border-2 border-emerald-400/80 bg-emerald-50/50 p-4">
          <p className="text-xs font-medium text-emerald-900">当前时间段 · 进行中</p>
          <p className="mt-1 font-display text-lg font-bold text-coal-ink">{current.moduleName}</p>
          <p className="text-sm text-graphite">
            {current.startTime} — {current.endTime}
          </p>
          <ul className="mt-2 list-inside list-disc text-sm text-coal-ink">
            {current.actions.map((a) => (
              <li key={a.id}>{a.actionText}</li>
            ))}
          </ul>
        </Card>
      ) : (
        <Card className="border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-950">
          当前暂无 SOP 节点，请查看「今日工作包」或下一时间段任务。业务日 {date} · {shiftType === 'day' ? '白班' : '晚班'}
        </Card>
      )}

      <div className="relative space-y-2 pl-2 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-ash">
        {slots.map((slot) => {
          const isCurrent = current?.id === slot.id;
          const ended = isSlotEnded(slot, new Date());
          const isCollapsed = collapsed[slot.id];
          const requiredActions = slot.actions.filter((a) => a.isRequired);
          const incompleteRequired = requiredActions.filter((a) => {
            const r = getProgressRow(progress, date, staff, a.id);
            return r?.status !== 'done' && r?.status !== 'skipped';
          });
          const missed = ended && incompleteRequired.length > 0;

          return (
            <div key={slot.id} className="relative pl-6">
              <span
                className={cn(
                  'absolute left-0 top-3 h-3 w-3 rounded-full border-2 border-white',
                  isCurrent ? 'bg-emerald-500' : missed ? 'bg-red-500' : ended ? 'bg-slate-300' : 'bg-sky-400',
                )}
              />
              <Card
                className={cn(
                  'border transition-shadow',
                  isCurrent ? 'ring-2 ring-emerald-500/60' : undefined,
                  missed ? 'border-red-300 bg-red-50/40' : undefined,
                )}
              >
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-2 p-3 text-left"
                  onClick={() => toggleCollapse(slot.id)}
                >
                  <div>
                    <div className="text-xs text-slate-mid">
                      {slot.startTime} — {slot.endTime}
                      {missed ? <span className="ml-2 text-red-700">· 有必做项未完成</span> : null}
                    </div>
                    <div className="font-semibold text-coal-ink">{slot.moduleName}</div>
                  </div>
                  <span className="text-xs text-graphite">{isCollapsed ? '展开' : '收起'}</span>
                </button>
                {!isCollapsed ? (
                  <div className="space-y-2 border-t border-ash px-3 pb-3 pt-2">
                    {slot.actions.map((action) => (
                      <SopActionProgressRow
                        key={action.id}
                        slot={slot}
                        action={action}
                        date={date}
                        staff={staff}
                        progress={progress}
                        isSlotEnded={ended}
                        onPatch={patchRow}
                      />
                    ))}
                  </div>
                ) : null}
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}
