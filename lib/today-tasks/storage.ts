import type { TaskAssignment, TodayTaskState } from './types';
import { STORAGE_KEY_TODAY_TASKS } from '@/lib/workspace-storage-keys';

const KEY = STORAGE_KEY_TODAY_TASKS;
const STAFF_KEY = 'today-tasks-current-staff';

function defaultState(): TodayTaskState {
  return { templates: [], assignments: [], completions: {} };
}

function normalizeAssignment(raw: TaskAssignment): TaskAssignment {
  const ts = raw.createdAt || new Date().toISOString();
  let taskType = raw.taskType ?? '例行';
  if (raw.id === 'asg-day-08' && raw.kpiTag && (taskType === '数据' || taskType === '例行')) {
    taskType = 'KPI上传';
  }
  const strictKpi = taskType === 'KPI上传' || String(taskType).includes('KPI上传');
  const requiresSupervisorReview =
    raw.id === 'asg-day-08' && raw.kpiTag && strictKpi ? false : !!raw.requiresSupervisorReview;

  return {
    ...raw,
    title: raw.title?.trim() ? raw.title : '未命名任务',
    staffNames: Array.isArray(raw.staffNames) ? raw.staffNames : [],
    recurrence: raw.recurrence ?? 'daily',
    startTime: raw.startTime || '09:00',
    endTime: raw.endTime || '10:00',
    priority: raw.priority ?? 'P2',
    completionMode: raw.completionMode ?? 'checkbox',
    quantityTarget: typeof raw.quantityTarget === 'number' && raw.quantityTarget > 0 ? raw.quantityTarget : 1,
    shiftLabel: raw.shiftLabel ?? '',
    active: raw.active !== false,
    kpiTag: !!raw.kpiTag,
    taskType,
    description: raw.description ?? '',
    shiftCode: raw.shiftCode ?? 'all',
    createdBy: raw.createdBy ?? '系统',
    createdAt: raw.createdAt || ts,
    updatedAt: raw.updatedAt ?? raw.createdAt ?? ts,
    requiresSupervisorReview,
  };
}

export function loadTodayTasks(): TodayTaskState {
  if (typeof window === 'undefined') return defaultState();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const v = JSON.parse(raw) as Partial<TodayTaskState>;
    const assignments = Array.isArray(v.assignments) ? v.assignments.map((a) => normalizeAssignment(a as TaskAssignment)) : [];
    return {
      templates: Array.isArray(v.templates) ? v.templates : [],
      assignments,
      completions: v.completions && typeof v.completions === 'object' ? v.completions : {},
    };
  } catch {
    return defaultState();
  }
}

export function saveTodayTasks(s: TodayTaskState) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function getTaskStaffName(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(STAFF_KEY) || '';
}

export function setTaskStaffName(name: string) {
  localStorage.setItem(STAFF_KEY, name);
}
