import { emitWorkspaceStorageUpdated } from '@/lib/workspace-events';
import type { SopProgressRecord, SopSlotTemplate } from './types';
import { LS_SHIFT_SOP_PROGRESS, LS_SHIFT_SOP_TEMPLATES } from './storage-keys';
import { getBuiltinSopTemplates } from './default-templates';

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
  return `sop-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function isoNow() {
  return new Date().toISOString();
}

export function loadSopTemplates(): SopSlotTemplate[] {
  if (typeof window === 'undefined') return getBuiltinSopTemplates();
  const list = safeParse<SopSlotTemplate[]>(localStorage.getItem(LS_SHIFT_SOP_TEMPLATES), []);
  if (!list.length) return getBuiltinSopTemplates();
  return list;
}

export function saveSopTemplates(t: SopSlotTemplate[]) {
  localStorage.setItem(LS_SHIFT_SOP_TEMPLATES, JSON.stringify(t));
  emitWorkspaceStorageUpdated();
}

export function loadSopProgress(): SopProgressRecord[] {
  if (typeof window === 'undefined') return [];
  return safeParse<SopProgressRecord[]>(localStorage.getItem(LS_SHIFT_SOP_PROGRESS), []);
}

export function saveSopProgress(list: SopProgressRecord[]) {
  localStorage.setItem(LS_SHIFT_SOP_PROGRESS, JSON.stringify(list));
  emitWorkspaceStorageUpdated();
}

export function resetSopTemplatesToBuiltin() {
  const built = getBuiltinSopTemplates();
  saveSopTemplates(built);
  return built;
}

/** 取某日某客服某动作进度；无则 null */
export function getProgressRow(
  list: SopProgressRecord[],
  date: string,
  employeeName: string,
  actionId: string,
): SopProgressRecord | undefined {
  return list.find((r) => r.date === date && r.employeeName === employeeName && r.actionId === actionId);
}

export function upsertProgress(list: SopProgressRecord[], row: SopProgressRecord): SopProgressRecord[] {
  const now = isoNow();
  const i = list.findIndex(
    (r) => r.date === row.date && r.employeeName === row.employeeName && r.actionId === row.actionId,
  );
  const merged: SopProgressRecord = { ...row, updatedAt: now };
  if (i >= 0) {
    const copy = [...list];
    copy[i] = { ...merged, id: list[i]!.id };
    return copy;
  }
  return [...list, { ...merged, id: row.id || rid() }];
}
