/** 侧栏菜单权威列表（不含已下线的「任务规则」） */
export const DASHBOARD_NAV_ITEMS: { label: string; path: string }[] = [
  { label: '工作台首页', path: '/dashboard' },
  { label: '今日任务中心', path: '/dashboard/tasks' },
  { label: 'KPI汇总确认', path: '/dashboard/kpi-daily' },
  { label: 'SOP执行检查台', path: '/dashboard/supervisor-board' },
  { label: '老客户CRM', path: '/dashboard/old-customer-crm' },
  /* 侧栏暂隐藏（直链仍可访问）：客户跟进、电联管理、KPI绩效、老客复购、问题复盘、朋友圈/视频号、AI运用反馈 */
  { label: '留资跟进表', path: '/dashboard/lead-follow' },
  { label: '每日销售额数据', path: '/dashboard/daily-sales' },
  { label: '评价管理中心', path: '/dashboard/reviews' },
  { label: '排班管理', path: '/dashboard/schedules' },
  { label: '用户管理', path: '/dashboard/users' },
  { label: '今日提交情况', path: '/dashboard/submissions' },
  { label: '系统设置', path: '/dashboard/settings' },
];

export const NAV_ORDER_STORAGE_KEY = 'dashboard-nav-order-v1';

export function loadNavOrderFromStorage(): string[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(NAV_ORDER_STORAGE_KEY);
    if (!raw) return null;
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return null;
    return arr.filter((x): x is string => typeof x === 'string');
  } catch {
    return null;
  }
}

export function saveNavOrderToStorage(paths: string[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(NAV_ORDER_STORAGE_KEY, JSON.stringify(paths));
}

/** 按本地保存的 path 顺序排列；未知 path 丢弃；新增菜单自动追加在末尾 */
export function applyNavOrder(
  items: readonly { label: string; path: string }[],
  saved: string[] | null,
): { label: string; path: string }[] {
  const byPath = new Map(items.map((x) => [x.path, x] as const));
  if (!saved?.length) return items.map((x) => ({ ...x }));
  const seen = new Set<string>();
  const out: { label: string; path: string }[] = [];
  for (const p of saved) {
    const it = byPath.get(p);
    if (it) {
      out.push({ label: it.label, path: it.path });
      seen.add(p);
    }
  }
  for (const it of items) {
    if (!seen.has(it.path)) out.push({ label: it.label, path: it.path });
  }
  return out;
}
