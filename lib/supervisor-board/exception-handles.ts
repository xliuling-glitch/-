import type { ExceptionHandleStatus } from './dashboard-types';
import { STORAGE_KEY_SUPERVISOR_EXCEPTION_HANDLES } from '@/lib/workspace-storage-keys';
import { emitWorkspaceStorageUpdated } from '@/lib/workspace-events';

const KEY = STORAGE_KEY_SUPERVISOR_EXCEPTION_HANDLES;

export type ExceptionHandleMap = Record<string, ExceptionHandleStatus>;

export function loadExceptionHandles(): ExceptionHandleMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== 'object') return {};
    const out: ExceptionHandleMap = {};
    for (const [k, val] of Object.entries(v)) {
      if (val === 'open' || val === 'done' || val === 'ignored') out[k] = val;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveExceptionHandles(m: ExceptionHandleMap) {
  localStorage.setItem(KEY, JSON.stringify(m));
  emitWorkspaceStorageUpdated();
}

export function setExceptionHandle(id: string, status: ExceptionHandleStatus) {
  const prev = loadExceptionHandles();
  const next = { ...prev, [id]: status };
  saveExceptionHandles(next);
  return next;
}
