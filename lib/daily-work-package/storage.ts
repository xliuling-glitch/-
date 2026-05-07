import { emitWorkspaceStorageUpdated } from '@/lib/workspace-events';
import type {
  CallFollowRecord,
  CompetitorChatRecord,
  DailyTaskInstance,
  DailyTaskTemplate,
  DailyWorkPackage,
  ReviewRegisterRecord,
  WeeklyTaskInstance,
  WeeklyTaskTemplate,
} from './types';
import {
  LS_CALL_FOLLOW_RECORDS,
  LS_COMPETITOR_CHAT_RECORDS,
  LS_DAILY_TASK_TEMPLATES,
  LS_DAILY_WORK_PACKAGES,
  LS_REVIEW_REGISTER_RECORDS,
  LS_WEEKLY_TASK_TEMPLATES,
} from './storage-keys';
import { DEFAULT_DAILY_TEMPLATES, DEFAULT_WEEKLY_TEMPLATES } from './defaults';
import { mergeCrmFollowIntoPackage } from '@/lib/old-customer-crm/daily-bridge';
import { mergeLeadFollowHubIntoPackage } from '@/lib/lead-follow-hub/task-bridge';

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
  return `dwp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function isoNow() {
  return new Date().toISOString();
}

export function loadDailyTemplates(): DailyTaskTemplate[] {
  if (typeof window === 'undefined') return DEFAULT_DAILY_TEMPLATES;
  const list = safeParse<DailyTaskTemplate[]>(localStorage.getItem(LS_DAILY_TASK_TEMPLATES), []);
  if (!list.length) return DEFAULT_DAILY_TEMPLATES.map((t) => ({ ...t }));
  return list;
}

export function saveDailyTemplates(t: DailyTaskTemplate[]) {
  localStorage.setItem(LS_DAILY_TASK_TEMPLATES, JSON.stringify(t));
  emitWorkspaceStorageUpdated();
}

export function loadWeeklyTemplates(): WeeklyTaskTemplate[] {
  if (typeof window === 'undefined') return DEFAULT_WEEKLY_TEMPLATES;
  const list = safeParse<WeeklyTaskTemplate[]>(localStorage.getItem(LS_WEEKLY_TASK_TEMPLATES), []);
  if (!list.length) return DEFAULT_WEEKLY_TEMPLATES.map((t) => ({ ...t }));
  return list;
}

export function saveWeeklyTemplates(t: WeeklyTaskTemplate[]) {
  localStorage.setItem(LS_WEEKLY_TASK_TEMPLATES, JSON.stringify(t));
  emitWorkspaceStorageUpdated();
}

export function loadPackages(): DailyWorkPackage[] {
  if (typeof window === 'undefined') return [];
  return safeParse<DailyWorkPackage[]>(localStorage.getItem(LS_DAILY_WORK_PACKAGES), []);
}

export function savePackages(list: DailyWorkPackage[], options?: { silent?: boolean }) {
  localStorage.setItem(LS_DAILY_WORK_PACKAGES, JSON.stringify(list));
  if (!options?.silent) emitWorkspaceStorageUpdated();
}

export function loadCalls(): CallFollowRecord[] {
  if (typeof window === 'undefined') return [];
  return safeParse<CallFollowRecord[]>(localStorage.getItem(LS_CALL_FOLLOW_RECORDS), []);
}

export function saveCalls(list: CallFollowRecord[]) {
  localStorage.setItem(LS_CALL_FOLLOW_RECORDS, JSON.stringify(list));
  emitWorkspaceStorageUpdated();
}

export function loadReviews(): ReviewRegisterRecord[] {
  if (typeof window === 'undefined') return [];
  return safeParse<ReviewRegisterRecord[]>(localStorage.getItem(LS_REVIEW_REGISTER_RECORDS), []);
}

export function saveReviews(list: ReviewRegisterRecord[]) {
  localStorage.setItem(LS_REVIEW_REGISTER_RECORDS, JSON.stringify(list));
  emitWorkspaceStorageUpdated();
}

export function loadCompetitors(): CompetitorChatRecord[] {
  if (typeof window === 'undefined') return [];
  return safeParse<CompetitorChatRecord[]>(localStorage.getItem(LS_COMPETITOR_CHAT_RECORDS), []);
}

export function saveCompetitors(list: CompetitorChatRecord[]) {
  localStorage.setItem(LS_COMPETITOR_CHAT_RECORDS, JSON.stringify(list));
  emitWorkspaceStorageUpdated();
}

export function getWeekRange(anchorYmd: string): { start: string; end: string } {
  const d = new Date(`${anchorYmd}T12:00:00`);
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + mondayOffset);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const toY = (x: Date) => x.toISOString().slice(0, 10);
  return { start: toY(mon), end: toY(sun) };
}

function instanceFromTemplate(t: DailyTaskTemplate): DailyTaskInstance {
  return {
    id: rid(),
    taskKey: t.taskKey,
    taskName: t.taskName,
    taskType: t.taskType,
    description: t.description,
    completionMethod: t.completionMethod,
    targetCount: t.targetCount,
    completedCount: 0,
    needProof: t.needProof,
    needReview: t.needReview,
    status: 'incomplete',
    proofImages: [],
    formData: {},
    remark: '',
    updatedAt: isoNow(),
  };
}

function weeklyInstanceFromTemplate(w: WeeklyTaskTemplate, weekStart: string, weekEnd: string): WeeklyTaskInstance {
  return {
    id: rid(),
    weekStartDate: weekStart,
    weekEndDate: weekEnd,
    taskName: w.taskName,
    targetCount: w.targetCount,
    completedCount: 0,
    requiredCategories: w.requiredCategories.map((c) => ({
      key: c.key,
      label: c.label,
      minCount: c.minCount,
      done: false,
    })),
    records: [],
    status: 'incomplete',
  };
}

/** 合并模板：新增 taskKey、更新文案，不删用户已有 formData */
export function mergePackageTasks(pkg: DailyWorkPackage, templates: DailyTaskTemplate[]): DailyTaskInstance[] {
  const byKey = new Map(pkg.dailyTasks.map((x) => [x.taskKey, x] as const));
  const next: DailyTaskInstance[] = [];
  for (const t of templates) {
    if (!t.enabled || !t.showInCenter) continue;
    const ex = byKey.get(t.taskKey);
    if (ex) {
      next.push({
        ...ex,
        taskName: t.taskName,
        description: t.description,
        completionMethod: t.completionMethod,
        targetCount: t.targetCount,
        needProof: t.needProof,
        needReview: t.needReview,
      });
    } else {
      next.push(instanceFromTemplate(t));
    }
  }
  return next;
}

export function ensureWeeklyTasks(pkg: DailyWorkPackage, wtpls: WeeklyTaskTemplate[], anchorDate: string): WeeklyTaskInstance[] {
  const { start, end } = getWeekRange(anchorDate);
  const enabled = wtpls.filter((w) => w.enabled);
  if (!enabled.length) return pkg.weeklyTasks;
  const existing = pkg.weeklyTasks.find((w) => w.weekStartDate === start);
  if (existing) {
    const w0 = enabled[0]!;
    return pkg.weeklyTasks.map((w) =>
      w.weekStartDate === start
        ? {
            ...w,
            taskName: w0.taskName,
            targetCount: w0.targetCount,
            requiredCategories: w0.requiredCategories.map((c) => {
              const old = w.requiredCategories.find((x) => x.key === c.key);
              return {
                key: c.key,
                label: c.label,
                minCount: c.minCount,
                done: old?.done ?? false,
              };
            }),
          }
        : w,
    );
  }
  const w0 = enabled[0]!;
  return [...pkg.weeklyTasks, weeklyInstanceFromTemplate(w0, start, end)];
}

function buildNewPackage(
  date: string,
  employeeName: string,
  shift: string,
  dailyTpls: DailyTaskTemplate[],
  weeklyTpls: WeeklyTaskTemplate[],
): DailyWorkPackage {
  const { start, end } = getWeekRange(date);
  const w0 = weeklyTpls.filter((w) => w.enabled)[0];
  const weekly = w0 ? weeklyInstanceFromTemplate(w0, start, end) : null;
  const core: DailyWorkPackage = {
    id: rid(),
    date,
    employeeName,
    shift,
    status: 'in_progress',
    completionRate: 0,
    weeklyCompletionRate: 0,
    dailyTasks: dailyTpls.filter((t) => t.enabled && t.showInCenter).map(instanceFromTemplate),
    weeklyTasks: weekly ? [weekly] : [],
    createdAt: isoNow(),
    updatedAt: isoNow(),
  };
  return mergeCrmFollowIntoPackage(core);
}

/** 合并模板与周任务结构；若尚无记录则返回新包（未写入 LS，由调用方 persist） */
export function readMergedPackage(
  date: string,
  employeeName: string,
  shift: string,
  dailyTpls: DailyTaskTemplate[],
  weeklyTpls: WeeklyTaskTemplate[],
): { pkg: DailyWorkPackage; isNew: boolean } {
  const list = loadPackages();
  const idx = list.findIndex((p) => p.date === date && p.employeeName === employeeName);
  if (idx < 0) {
    return { pkg: buildNewPackage(date, employeeName, shift, dailyTpls, weeklyTpls), isNew: true };
  }
  let pkg = { ...list[idx]! };
  pkg.dailyTasks = mergePackageTasks(pkg, dailyTpls);
  pkg.weeklyTasks = ensureWeeklyTasks(pkg, weeklyTpls, date);
  pkg.shift = shift;
  pkg = mergeLeadFollowHubIntoPackage(mergeCrmFollowIntoPackage(pkg));
  return { pkg, isNew: false };
}

export function upsertPackage(pkg: DailyWorkPackage, silent = true) {
  const list = loadPackages();
  const i = list.findIndex((p) => p.id === pkg.id);
  const next = { ...pkg, updatedAt: isoNow() };
  if (i >= 0) list[i] = next;
  else list.push(next);
  savePackages(list, { silent });
}
