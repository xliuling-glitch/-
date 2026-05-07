import { emitWorkspaceStorageUpdated } from '@/lib/workspace-events';
import type { SopDailyOverride } from './types';
import { LS_SHIFT_SOP_DAILY_OVERRIDES } from './storage-keys';

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function rid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `sopov-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function isoNow() {
  return new Date().toISOString();
}

export function loadSopDailyOverrides(): SopDailyOverride[] {
  if (typeof window === 'undefined') return [];
  return safeParse<SopDailyOverride[]>(localStorage.getItem(LS_SHIFT_SOP_DAILY_OVERRIDES), []);
}

export function saveSopDailyOverrides(list: SopDailyOverride[]) {
  localStorage.setItem(LS_SHIFT_SOP_DAILY_OVERRIDES, JSON.stringify(list));
  emitWorkspaceStorageUpdated();
}

export function getOverrideFor(overrides: SopDailyOverride[], date: string, employeeName: string): SopDailyOverride | undefined {
  return overrides.find((o) => o.date === date && o.employeeName === employeeName);
}

export function upsertSopDailyOverride(
  list: SopDailyOverride[],
  row: Omit<SopDailyOverride, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  createdBy: string,
): SopDailyOverride[] {
  const now = isoNow();
  const i = list.findIndex((o) => o.date === row.date && o.employeeName === row.employeeName);
  const next: SopDailyOverride = {
    id: row.id ?? list[i]?.id ?? rid(),
    date: row.date,
    employeeName: row.employeeName,
    effectiveShift: row.effectiveShift ?? null,
    remark: row.remark,
    createdBy: list[i]?.createdBy ?? createdBy,
    createdAt: list[i]?.createdAt ?? now,
    updatedAt: now,
  };
  if (i >= 0) {
    const copy = [...list];
    copy[i] = next;
    return copy;
  }
  return [...list, next];
}
