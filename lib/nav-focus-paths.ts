/**
 * 侧栏「重点菜单」高亮：按角色默认 + 本机可覆盖（dashboard-nav-focus-v1）
 */
export const NAV_FOCUS_STORAGE_KEY = 'dashboard-nav-focus-v1';

export type NavFocusStored = {
  /** 保存时的用户 id，切换账号后自动回退角色默认 */
  userId?: number | null;
  paths: string[];
};

/** 角色 code 与常见别名 → 默认重点 path（与 DASHBOARD_NAV_ITEMS 一致） */
const ROLE_DEFAULT_PATHS: Record<string, string[]> = {
  客服: ['/dashboard/daily-sales', '/dashboard/conversions'],
  运营: ['/dashboard/tasks', '/dashboard/supervisor-board'],
};

function normalizeRoleKey(role: string | null | undefined): string {
  return String(role ?? '').trim();
}

export function defaultFocusPathsForRole(role: string | null | undefined): string[] {
  const r = normalizeRoleKey(role);
  if (!r) return [];
  if (ROLE_DEFAULT_PATHS[r]) return [...ROLE_DEFAULT_PATHS[r]];
  const lower = r.toLowerCase();
  if (lower === 'staff' || lower === 'service' || lower === 'agent' || lower === 'trainee') {
    return [...ROLE_DEFAULT_PATHS['客服']];
  }
  // seed 中无单独 ops；主管账号常用任务中心 + 看板，与「运营」默认一致
  if (lower === 'ops' || lower === 'operation' || lower === 'operations' || lower === 'manager') {
    return [...ROLE_DEFAULT_PATHS['运营']];
  }
  return [];
}

export function loadNavFocusOverride(): NavFocusStored | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(NAV_FOCUS_STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<NavFocusStored>;
    if (!v || !Array.isArray(v.paths)) return null;
    return { userId: v.userId ?? null, paths: v.paths.filter((p): p is string => typeof p === 'string') };
  } catch {
    return null;
  }
}

export function saveNavFocusOverride(stored: NavFocusStored) {
  localStorage.setItem(NAV_FOCUS_STORAGE_KEY, JSON.stringify(stored));
}

export function clearNavFocusOverride() {
  localStorage.removeItem(NAV_FOCUS_STORAGE_KEY);
}

/** 当前用户生效的重点 path 列表 */
export function getEffectiveFocusPaths(role: string | null | undefined, userId: number | null | undefined): string[] {
  const ov = loadNavFocusOverride();
  if (ov?.paths?.length) {
    if (userId != null && ov.userId != null && ov.userId !== userId) {
      return defaultFocusPathsForRole(role);
    }
    return [...ov.paths];
  }
  return defaultFocusPathsForRole(role);
}
