import type { MonthPlan, ScheduleRules, Staff } from './types';
import { DEFAULT_RULES, STORAGE_KEYS } from './types';

export function loadStaff(): Staff[] {
  if (typeof window === 'undefined') return defaultStaff();
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.staff);
    if (!raw) return defaultStaff();
    const v = JSON.parse(raw) as Staff[];
    return Array.isArray(v) && v.length ? v : defaultStaff();
  } catch {
    return defaultStaff();
  }
}

export function saveStaff(s: Staff[]) {
  localStorage.setItem(STORAGE_KEYS.staff, JSON.stringify(s));
}

export function loadRules(): ScheduleRules {
  if (typeof window === 'undefined') return { ...DEFAULT_RULES };
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.rules);
    if (!raw) return { ...DEFAULT_RULES };
    return { ...DEFAULT_RULES, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_RULES };
  }
}

export function saveRules(r: ScheduleRules) {
  localStorage.setItem(STORAGE_KEYS.rules, JSON.stringify(r));
}

export function loadPlan(): MonthPlan | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.plan);
    if (!raw) return null;
    return JSON.parse(raw) as MonthPlan;
  } catch {
    return null;
  }
}

export function savePlan(p: MonthPlan | null) {
  if (!p) {
    localStorage.removeItem(STORAGE_KEYS.plan);
    return;
  }
  localStorage.setItem(STORAGE_KEYS.plan, JSON.stringify(p));
}

function defaultStaff(): Staff[] {
  return [
    { id: '1', name: '周晨', joinSchedule: true, monthlyRestQuota: 6, canNight: true, note: '' },
    { id: '2', name: '李悦', joinSchedule: true, monthlyRestQuota: 6, canNight: true, note: '' },
    { id: '3', name: '王楠', joinSchedule: true, monthlyRestQuota: 6, canNight: false, note: '仅白班' },
    { id: '4', name: '赵琪', joinSchedule: true, monthlyRestQuota: 5, canNight: true, note: '' },
    { id: '5', name: '孙浩', joinSchedule: true, monthlyRestQuota: 6, canNight: true, note: '' },
  ];
}
