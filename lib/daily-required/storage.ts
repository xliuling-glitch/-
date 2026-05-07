import { emitWorkspaceStorageUpdated } from '@/lib/workspace-events';
import type { DailyRequiredAck } from './types';
import { LS_DAILY_REQUIRED_SUBMISSIONS } from './storage-keys';

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
  return `drq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function isoNow() {
  return new Date().toISOString();
}

export function loadDailyRequiredAcks(): DailyRequiredAck[] {
  if (typeof window === 'undefined') return [];
  return safeParse<DailyRequiredAck[]>(localStorage.getItem(LS_DAILY_REQUIRED_SUBMISSIONS), []);
}

export function saveDailyRequiredAcks(list: DailyRequiredAck[]) {
  localStorage.setItem(LS_DAILY_REQUIRED_SUBMISSIONS, JSON.stringify(list));
  emitWorkspaceStorageUpdated();
}

export function upsertAck(
  list: DailyRequiredAck[],
  row: Pick<DailyRequiredAck, 'date' | 'employeeName' | 'key' | 'manualDone' | 'remark'>,
): DailyRequiredAck[] {
  const now = isoNow();
  const i = list.findIndex((x) => x.date === row.date && x.employeeName === row.employeeName && x.key === row.key);
  const next: DailyRequiredAck = {
    id: i >= 0 ? list[i]!.id : rid(),
    date: row.date,
    employeeName: row.employeeName,
    key: row.key,
    manualDone: row.manualDone,
    remark: row.remark,
    updatedAt: now,
  };
  if (i >= 0) {
    const c = [...list];
    c[i] = next;
    return c;
  }
  return [...list, next];
}
