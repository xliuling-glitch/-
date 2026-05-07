import { emitWorkspaceStorageUpdated } from '@/lib/workspace-events';
import type { AssignedTask } from './types';
import { LS_ASSIGNED_TASKS } from './storage-keys';

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
  return `asg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function isoNow() {
  return new Date().toISOString();
}

export function loadAssignedTasks(): AssignedTask[] {
  if (typeof window === 'undefined') return [];
  return safeParse<AssignedTask[]>(localStorage.getItem(LS_ASSIGNED_TASKS), []);
}

export function saveAssignedTasks(list: AssignedTask[]) {
  localStorage.setItem(LS_ASSIGNED_TASKS, JSON.stringify(list));
  emitWorkspaceStorageUpdated();
}

export function tasksForStaffAndDate(list: AssignedTask[], date: string, staff: string): AssignedTask[] {
  return list.filter((t) => t.date === date && t.assignedTo === staff);
}

/** 业务日 `YYYY-MM-DD` 本地日末 23:59:59.999（与「截止当日」一致，不用单独 deadline 时刻） */
export function endOfAssignedTaskBusinessDay(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return new Date(0);
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

/**
 * 逾期：仅当当前时间已超过任务所属业务日日末；业务日内不按旧 deadline 字段标红。
 * 不写回 LS；逾期仍可继续标记完成。
 */
export function getDisplayTaskStatus(t: AssignedTask, now = new Date()): AssignedTask['status'] {
  if (t.status === 'done' || t.status === 'pending_review' || t.status === 'rejected') return t.status;
  const end = endOfAssignedTaskBusinessDay(t.date);
  if (now.getTime() > end.getTime()) return 'overdue';
  if (t.status === 'overdue') return 'in_progress';
  return t.status;
}
