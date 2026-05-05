/**
 * 右下角「快捷入口」悬浮按钮：本机可配置 path 列表（dashboard-quick-nav-v1）
 */
import { defaultFocusPathsForRole } from '@/lib/nav-focus-paths';

export const QUICK_NAV_STORAGE_KEY = 'dashboard-quick-nav-v1';

export const MAX_QUICK_NAV = 6;

export type QuickNavStored = {
  userId?: number | null;
  paths: string[];
};

const FALLBACK_EXTRA = ['/dashboard/tasks', '/dashboard/kpi-daily', '/dashboard/settings'] as const;

export function defaultQuickPathsForRole(role: string | null | undefined): string[] {
  const home = '/dashboard';
  const fromRole = defaultFocusPathsForRole(role);
  const merged = [home, ...fromRole.filter((p) => p !== home), ...FALLBACK_EXTRA];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of merged) {
    if (seen.has(p)) continue;
    seen.add(p);
    out.push(p);
    if (out.length >= MAX_QUICK_NAV) break;
  }
  return out;
}

export function loadQuickNavOverride(): QuickNavStored | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(QUICK_NAV_STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<QuickNavStored>;
    if (!v || !Array.isArray(v.paths)) return null;
    return { userId: v.userId ?? null, paths: v.paths.filter((p): p is string => typeof p === 'string') };
  } catch {
    return null;
  }
}

export function saveQuickNavOverride(stored: QuickNavStored) {
  localStorage.setItem(QUICK_NAV_STORAGE_KEY, JSON.stringify(stored));
}

export function clearQuickNavOverride() {
  localStorage.removeItem(QUICK_NAV_STORAGE_KEY);
}

export function getEffectiveQuickPaths(role: string | null | undefined, userId: number | null | undefined): string[] {
  const ov = loadQuickNavOverride();
  if (ov?.paths?.length) {
    if (userId != null && ov.userId != null && ov.userId !== userId) {
      return defaultQuickPathsForRole(role);
    }
    return ov.paths.slice(0, MAX_QUICK_NAV);
  }
  return defaultQuickPathsForRole(role);
}
