import type { ShiftType, SopDailyOverride } from './types';
import { getOverrideFor } from './daily-override-storage';

export function getEffectiveSopShift(
  date: string,
  employeeName: string,
  workPackageShift: string,
  overrides: SopDailyOverride[],
): ShiftType {
  const o = getOverrideFor(overrides, date, employeeName);
  if (o?.effectiveShift === 'day' || o?.effectiveShift === 'night') return o.effectiveShift;
  return workPackageShift === 'night' ? 'night' : 'day';
}
