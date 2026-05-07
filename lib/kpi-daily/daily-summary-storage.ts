import type {
  DailyKpiSummary,
  DailyKpiSummaryStore,
  KpiManualAdjustment,
  KpiManualAdjustmentStore,
} from './daily-summary-types';
import { emitWorkspaceStorageUpdated } from '@/lib/workspace-events';

/** 与需求文档一致的 LocalStorage 键（新增，不覆盖旧 kpi-daily-center-v1） */
export const LS_DAILY_KPI_SUMMARY = 'daily_kpi_summary';
export const LS_KPI_MANUAL_ADJUSTMENTS = 'kpi_manual_adjustments';

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
  return `kpi-sum-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function isoNow() {
  return new Date().toISOString();
}

export function loadDailyKpiSummaryStore(): DailyKpiSummaryStore {
  if (typeof window === 'undefined') return { summaries: [] };
  const v = safeParse<Partial<DailyKpiSummaryStore>>(localStorage.getItem(LS_DAILY_KPI_SUMMARY), {});
  return { summaries: Array.isArray(v.summaries) ? v.summaries : [] };
}

export function saveDailyKpiSummaryStore(s: DailyKpiSummaryStore) {
  localStorage.setItem(LS_DAILY_KPI_SUMMARY, JSON.stringify(s));
  emitWorkspaceStorageUpdated();
}

export function loadKpiManualAdjustments(): KpiManualAdjustment[] {
  if (typeof window === 'undefined') return [];
  const v = safeParse<KpiManualAdjustmentStore>(localStorage.getItem(LS_KPI_MANUAL_ADJUSTMENTS), { adjustments: [] });
  return Array.isArray(v.adjustments) ? v.adjustments : [];
}

export function saveKpiManualAdjustments(list: KpiManualAdjustment[]) {
  localStorage.setItem(LS_KPI_MANUAL_ADJUSTMENTS, JSON.stringify({ adjustments: list }));
  emitWorkspaceStorageUpdated();
}

export function findSummary(date: string, employeeName: string): DailyKpiSummary | undefined {
  return loadDailyKpiSummaryStore().summaries.find((x) => x.date === date && x.employeeName === employeeName);
}

export function upsertSummary(row: DailyKpiSummary) {
  const st = loadDailyKpiSummaryStore();
  const i = st.summaries.findIndex((x) => x.id === row.id);
  const next = i >= 0 ? st.summaries.map((x, j) => (j === i ? row : x)) : [...st.summaries, row];
  saveDailyKpiSummaryStore({ summaries: next });
}
