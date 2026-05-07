import type { ShiftType, SopSlotTemplate } from '@/lib/shift-sop/types';
import type { SopProgressRecord } from '@/lib/shift-sop/types';
import { findCurrentSlot } from '@/lib/shift-sop/time-utils';
import { getProgressRow } from '@/lib/shift-sop/storage';

export function sopRequiredCompletion(
  templates: SopSlotTemplate[],
  progress: SopProgressRecord[],
  date: string,
  employeeName: string,
  shiftType: ShiftType,
): { requiredTotal: number; requiredDone: number; rate: number; currentModule: string | null; currentSlotLabel: string | null } {
  const slots = templates.filter((s) => s.shiftType === shiftType && s.enabled).sort((a, b) => a.sort - b.sort);
  let requiredTotal = 0;
  let requiredDone = 0;
  for (const slot of slots) {
    for (const a of slot.actions) {
      if (!a.isRequired) continue;
      requiredTotal++;
      const r = getProgressRow(progress, date, employeeName, a.id);
      if (r?.status === 'done' || r?.status === 'skipped') requiredDone++;
    }
  }
  const rate = requiredTotal ? requiredDone / requiredTotal : 1;
  const cur = findCurrentSlot(slots, new Date());
  return {
    requiredTotal,
    requiredDone,
    rate,
    currentModule: cur?.moduleName ?? null,
    currentSlotLabel: cur ? `${cur.startTime}—${cur.endTime}` : null,
  };
}
