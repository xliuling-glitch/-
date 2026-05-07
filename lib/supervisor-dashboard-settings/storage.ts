import { emitWorkspaceStorageUpdated } from '@/lib/workspace-events';
import type { SupervisorDashboardSettings } from './types';
import { DEFAULT_SUPERVISOR_DASHBOARD_SETTINGS } from './types';
import { LS_SUPERVISOR_DASHBOARD_SETTINGS } from './storage-keys';

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadSupervisorDashboardSettings(): SupervisorDashboardSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_SUPERVISOR_DASHBOARD_SETTINGS };
  const v = safeParse<Partial<SupervisorDashboardSettings> | null>(localStorage.getItem(LS_SUPERVISOR_DASHBOARD_SETTINGS), null);
  return { ...DEFAULT_SUPERVISOR_DASHBOARD_SETTINGS, ...v };
}

export function saveSupervisorDashboardSettings(s: SupervisorDashboardSettings) {
  localStorage.setItem(LS_SUPERVISOR_DASHBOARD_SETTINGS, JSON.stringify(s));
  emitWorkspaceStorageUpdated();
}
