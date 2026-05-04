import type { TodayTaskState } from './types';

const KEY = 'today-tasks-v1';
const STAFF_KEY = 'today-tasks-current-staff';

function defaultState(): TodayTaskState {
  return { templates: [], assignments: [], completions: {} };
}

export function loadTodayTasks(): TodayTaskState {
  if (typeof window === 'undefined') return defaultState();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const v = JSON.parse(raw) as Partial<TodayTaskState>;
    return {
      templates: Array.isArray(v.templates) ? v.templates : [],
      assignments: Array.isArray(v.assignments) ? v.assignments : [],
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
