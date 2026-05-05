'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUp, Bell, ChevronDown, ChevronUp, LayoutGrid, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DASHBOARD_NAV_ITEMS,
  applyNavOrder,
  loadNavOrderFromStorage,
  saveNavOrderToStorage,
} from '@/lib/dashboard-nav';
import {
  NAV_FOCUS_STORAGE_KEY,
  clearNavFocusOverride,
  defaultFocusPathsForRole,
  getEffectiveFocusPaths,
  saveNavFocusOverride,
} from '@/lib/nav-focus-paths';
import {
  MAX_QUICK_NAV,
  QUICK_NAV_STORAGE_KEY,
  clearQuickNavOverride,
  defaultQuickPathsForRole,
  getEffectiveQuickPaths,
  saveQuickNavOverride,
} from '@/lib/quick-nav-dock';

function navActive(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function currentPageTitle(pathname: string, nav: { label: string; path: string }[]): string {
  if (pathname === '/dashboard') return '首页总览';
  const others = nav
    .filter((x) => x.path !== '/dashboard')
    .sort((a, b) => b.path.length - a.path.length);
  for (const { label, path } of others) {
    if (pathname === path || pathname.startsWith(`${path}/`)) return label;
  }
  return '';
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const today = new Date().toLocaleDateString('zh-CN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const [orderedNav, setOrderedNav] = useState<{ label: string; path: string }[]>(() => [...DASHBOARD_NAV_ITEMS]);
  const [canReorder, setCanReorder] = useState(false);
  const [sessionUser, setSessionUser] = useState<{ id: number; role: string } | null>(null);
  const [focusPaths, setFocusPaths] = useState<Set<string>>(() => new Set());
  const [navFocusOpen, setNavFocusOpen] = useState(false);
  const [navFocusDraft, setNavFocusDraft] = useState<string[]>([]);
  const [quickNavOpen, setQuickNavOpen] = useState(false);
  const [quickNavDraft, setQuickNavDraft] = useState<string[]>([]);
  const [quickPaths, setQuickPaths] = useState<string[]>([]);
  const [showBackTop, setShowBackTop] = useState(false);
  const mainScrollRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setOrderedNav(applyNavOrder(DASHBOARD_NAV_ITEMS, loadNavOrderFromStorage()));
  }, []);

  useEffect(() => {
    fetch('/api/session', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        const role = d?.user?.role as string | undefined;
        setCanReorder(role === 'admin' || role === 'manager');
        const id = d?.user?.id;
        if (typeof id === 'number' && role != null) {
          setSessionUser({ id, role: String(role) });
        } else {
          setSessionUser(null);
        }
      })
      .catch(() => {
        setCanReorder(false);
        setSessionUser(null);
      });
  }, []);

  const refreshFocusPaths = useCallback(() => {
    if (!sessionUser) {
      setFocusPaths(new Set());
      return;
    }
    setFocusPaths(new Set(getEffectiveFocusPaths(sessionUser.role, sessionUser.id)));
  }, [sessionUser]);

  useEffect(() => {
    refreshFocusPaths();
  }, [refreshFocusPaths]);

  const refreshQuickPaths = useCallback(() => {
    if (!sessionUser) {
      setQuickPaths([]);
      return;
    }
    setQuickPaths(getEffectiveQuickPaths(sessionUser.role, sessionUser.id));
  }, [sessionUser]);

  useEffect(() => {
    refreshQuickPaths();
  }, [refreshQuickPaths]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === NAV_FOCUS_STORAGE_KEY) refreshFocusPaths();
      if (e.key === QUICK_NAV_STORAGE_KEY) refreshQuickPaths();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [refreshFocusPaths, refreshQuickPaths]);

  useEffect(() => {
    const el = mainScrollRef.current;
    if (!el) return;
    const onScroll = () => setShowBackTop(el.scrollTop > 280);
    onScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [pathname]);

  useEffect(() => {
    mainScrollRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname]);

  const persistOrder = useCallback((next: { label: string; path: string }[]) => {
    saveNavOrderToStorage(next.map((x) => x.path));
    setOrderedNav(next);
  }, []);

  const move = useCallback(
    (index: number, delta: -1 | 1) => {
      const j = index + delta;
      if (j < 0 || j >= orderedNav.length) return;
      const next = [...orderedNav];
      [next[index], next[j]] = [next[j], next[index]];
      persistOrder(next);
    },
    [orderedNav, persistOrder],
  );

  const pageTitle = currentPageTitle(pathname, orderedNav);

  const openNavFocusModal = () => {
    setNavFocusDraft(Array.from(focusPaths));
    setNavFocusOpen(true);
  };

  const toggleNavFocusDraft = (path: string) => {
    setNavFocusDraft((prev) => (prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]));
  };

  const saveNavFocusFromModal = () => {
    if (!sessionUser) {
      setNavFocusOpen(false);
      return;
    }
    const defaults = defaultFocusPathsForRole(sessionUser.role);
    const sameAsDefault =
      navFocusDraft.length === defaults.length && defaults.every((p) => navFocusDraft.includes(p));
    if (sameAsDefault) {
      clearNavFocusOverride();
    } else {
      saveNavFocusOverride({ userId: sessionUser.id, paths: navFocusDraft });
    }
    setFocusPaths(new Set(getEffectiveFocusPaths(sessionUser.role, sessionUser.id)));
    setNavFocusOpen(false);
  };

  const restoreNavFocusDefaults = () => {
    if (!sessionUser) return;
    clearNavFocusOverride();
    setNavFocusDraft(defaultFocusPathsForRole(sessionUser.role));
    setFocusPaths(new Set(defaultFocusPathsForRole(sessionUser.role)));
  };

  const openQuickNavModal = () => {
    setQuickNavDraft([...quickPaths]);
    setQuickNavOpen(true);
  };

  const toggleQuickNavDraft = (path: string) => {
    setQuickNavDraft((prev) => {
      if (prev.includes(path)) return prev.filter((p) => p !== path);
      if (prev.length >= MAX_QUICK_NAV) {
        window.alert(`最多选择 ${MAX_QUICK_NAV} 个快捷入口`);
        return prev;
      }
      return [...prev, path];
    });
  };

  const saveQuickNavFromModal = () => {
    if (!sessionUser) {
      setQuickNavOpen(false);
      return;
    }
    if (quickNavDraft.length === 0) {
      window.alert('请至少保留 1 个快捷入口');
      return;
    }
    const defaults = defaultQuickPathsForRole(sessionUser.role);
    const a = [...quickNavDraft].sort().join('\0');
    const b = [...defaults].sort().join('\0');
    if (a === b) {
      clearQuickNavOverride();
    } else {
      saveQuickNavOverride({ userId: sessionUser.id, paths: quickNavDraft.slice(0, MAX_QUICK_NAV) });
    }
    setQuickPaths(getEffectiveQuickPaths(sessionUser.role, sessionUser.id));
    setQuickNavOpen(false);
  };

  const restoreQuickNavDraftDefaults = () => {
    if (!sessionUser) return;
    setQuickNavDraft(defaultQuickPathsForRole(sessionUser.role));
  };

  const scrollMainToTop = () => {
    mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const labelForQuickPath = (path: string) =>
    orderedNav.find((x) => x.path === path)?.label ?? (path.replace(/^\/dashboard\/?/, '') || path);

  return (
    <div
      className="min-h-[100dvh] overflow-x-hidden"
      style={{ backgroundColor: 'var(--color-parchment)', color: 'var(--color-coal-ink)' }}
    >
      <aside
        className="fixed left-0 top-0 z-[45] flex h-[100dvh] w-72 max-w-[min(18rem,100vw)] flex-col overflow-hidden border-r border-white/10"
        style={{ backgroundColor: 'var(--color-coal-ink)' }}
      >
        <div className="shrink-0 border-b border-white/10 px-5 py-5">
          <p className="font-display text-lg font-bold tracking-tight" style={{ color: '#fff' }}>
            欧信作战台
          </p>
          <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.2em]" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Presales
          </p>
        </div>
        {canReorder ? (
          <p className="shrink-0 border-b border-white/10 px-3 py-2 text-[10px] leading-snug text-white/50">
            管理员/主管：悬停菜单项右侧可点上移、下移调整顺序（本机保存，换浏览器需重新排）。
          </p>
        ) : null}
        <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain p-3 scrollbar-none">
          {orderedNav.map(({ label, path }, i) => {
            const active = navActive(pathname, path);
            const isFocus = focusPaths.has(path);
            return (
              <div
                key={path}
                className={cn(
                  'group flex items-stretch rounded-lg border-l-2 border-transparent transition-colors',
                  active ? 'bg-white/[0.12]' : 'hover:bg-white/[0.06]',
                )}
                style={
                  active
                    ? { borderLeftColor: isFocus ? '#ff9a3c' : '#ff6020' }
                    : isFocus
                      ? { borderLeftColor: 'rgba(255,154,60,0.45)' }
                      : undefined
                }
              >
                <Link
                  href={path}
                  className={cn(
                    'min-w-0 flex-1 py-2.5 pl-3 pr-1 text-sm font-medium transition-colors',
                    active
                      ? isFocus
                        ? 'text-[#ffe8cc]'
                        : 'text-white'
                      : isFocus
                        ? 'text-[#ffab47] hover:text-[#ffc266]'
                        : 'text-white/70 hover:text-white',
                    isFocus && 'font-semibold',
                  )}
                >
                  {label}
                </Link>
                {canReorder ? (
                  <div className="flex shrink-0 flex-col justify-center gap-0 border-l border-white/10 py-1 pr-1 pl-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                    <button
                      type="button"
                      aria-label={`「${label}」上移`}
                      disabled={i === 0}
                      className="rounded p-0.5 text-white/75 hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-25"
                      onClick={(e) => {
                        e.preventDefault();
                        move(i, -1);
                      }}
                    >
                      <ChevronUp className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                    <button
                      type="button"
                      aria-label={`「${label}」下移`}
                      disabled={i === orderedNav.length - 1}
                      className="rounded p-0.5 text-white/75 hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-25"
                      onClick={(e) => {
                        e.preventDefault();
                        move(i, 1);
                      }}
                    >
                      <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
        <div className="shrink-0 space-y-2 border-t border-white/10 p-3">
          <button
            type="button"
            onClick={openQuickNavModal}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/[0.06] py-2 text-xs font-medium text-white/80 transition hover:bg-white/[0.1] hover:text-white"
          >
            <LayoutGrid className="h-3.5 w-3.5 text-[#77a8ff]" strokeWidth={2} aria-hidden />
            快捷入口设置
          </button>
          <button
            type="button"
            onClick={openNavFocusModal}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/[0.06] py-2 text-xs font-medium text-white/80 transition hover:bg-white/[0.1] hover:text-white"
          >
            <Star className="h-3.5 w-3.5 text-[#ffab47]" strokeWidth={2} aria-hidden />
            重点菜单高亮
          </button>
          <p className="px-1 text-center text-[10px] leading-snug text-white/40">
            快捷入口：右下角悬浮（最多 {MAX_QUICK_NAV} 项）；重点：侧栏橙色标记。均本机保存。
          </p>
        </div>
      </aside>

      {navFocusOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="nav-focus-title"
          onClick={() => setNavFocusOpen(false)}
        >
          <div
            className="max-h-[min(85vh,32rem)] w-full max-w-md overflow-hidden rounded-xl border shadow-xl"
            style={{ borderColor: 'var(--color-ash)', backgroundColor: '#fff' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b px-4 py-3" style={{ borderColor: 'var(--color-ash)' }}>
              <h2 id="nav-focus-title" className="font-display text-base font-bold" style={{ color: 'var(--color-coal-ink)' }}>
                侧栏重点菜单
              </h2>
              <p className="mt-1 text-xs" style={{ color: 'var(--color-graphite)' }}>
                勾选后在左侧以橙色高亮；不勾选则该项不高亮。
              </p>
            </div>
            <div className="max-h-[min(55vh,22rem)] space-y-1 overflow-y-auto px-4 py-3">
              {orderedNav.map(({ label, path }) => (
                <label
                  key={path}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition hover:bg-[#fafafa]"
                  style={{ borderColor: 'var(--color-ash)' }}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 rounded border-gray-300 accent-[#ff6020]"
                    checked={navFocusDraft.includes(path)}
                    onChange={() => toggleNavFocusDraft(path)}
                  />
                  <span style={{ color: 'var(--color-coal-ink)' }}>{label}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 border-t px-4 py-3" style={{ borderColor: 'var(--color-ash)' }}>
              <button
                type="button"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--color-graphite)] hover:bg-[#f5f5f5]"
                onClick={() => setNavFocusOpen(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--color-graphite)] hover:bg-[#f5f5f5]"
                onClick={restoreNavFocusDefaults}
              >
                恢复角色默认
              </button>
              <button
                type="button"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-white"
                style={{ backgroundColor: '#ff6020' }}
                onClick={saveNavFocusFromModal}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {quickNavOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-nav-title"
          onClick={() => setQuickNavOpen(false)}
        >
          <div
            className="max-h-[min(85vh,32rem)] w-full max-w-md overflow-hidden rounded-xl border shadow-xl"
            style={{ borderColor: 'var(--color-ash)', backgroundColor: '#fff' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b px-4 py-3" style={{ borderColor: 'var(--color-ash)' }}>
              <h2 id="quick-nav-title" className="font-display text-base font-bold" style={{ color: 'var(--color-coal-ink)' }}>
                快捷入口（右下角）
              </h2>
              <p className="mt-1 text-xs" style={{ color: 'var(--color-graphite)' }}>
                勾选最多 {MAX_QUICK_NAV} 项，长页面可一键跳转；滚动条已隐藏，侧栏与主区域均可滑动浏览。
              </p>
            </div>
            <div className="max-h-[min(55vh,22rem)] space-y-1 overflow-y-auto px-4 py-3 scrollbar-none">
              {orderedNav.map(({ label, path }) => (
                <label
                  key={path}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition hover:bg-[#fafafa]"
                  style={{ borderColor: 'var(--color-ash)' }}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 rounded border-gray-300 accent-[#ff6020]"
                    checked={quickNavDraft.includes(path)}
                    disabled={!quickNavDraft.includes(path) && quickNavDraft.length >= MAX_QUICK_NAV}
                    onChange={() => toggleQuickNavDraft(path)}
                  />
                  <span style={{ color: 'var(--color-coal-ink)' }}>{label}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 border-t px-4 py-3" style={{ borderColor: 'var(--color-ash)' }}>
              <button
                type="button"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--color-graphite)] hover:bg-[#f5f5f5]"
                onClick={() => setQuickNavOpen(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--color-graphite)] hover:bg-[#f5f5f5]"
                onClick={restoreQuickNavDraftDefaults}
              >
                恢复默认
              </button>
              <button
                type="button"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-white"
                style={{ backgroundColor: '#ff6020' }}
                onClick={saveQuickNavFromModal}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div
        className="ml-72 flex h-[100dvh] min-h-0 min-w-0 flex-col overflow-hidden"
        style={{ backgroundColor: 'var(--color-parchment)' }}
      >
        <header
          className="flex h-14 shrink-0 items-center justify-between border-b px-4 sm:px-6"
          style={{ borderColor: 'var(--color-ash)', backgroundColor: '#ffffff' }}
        >
          <div>
            <h1 className="font-display text-base font-bold tracking-tight" style={{ color: 'var(--color-coal-ink)' }}>
              欧信售前客服作战台
            </h1>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em]" style={{ color: 'var(--color-graphite)' }}>
              Data terminal
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm sm:gap-5" style={{ color: 'var(--color-graphite)' }}>
            <span className="hidden sm:inline" style={{ color: 'var(--color-slate-mid)' }}>
              {today}
            </span>
            <span
              className="rounded-full border px-3 py-1 text-xs font-medium"
              style={{ borderColor: 'var(--color-ash)', backgroundColor: 'var(--color-ledger-white)', color: 'var(--color-graphite)' }}
            >
              当前班次 · 白班
            </span>
            <button
              type="button"
              className="rounded-full p-1.5 transition hover:bg-[#fafafa]"
              style={{ color: 'var(--color-graphite)' }}
              aria-label="通知"
            >
              <Bell className="h-4 w-4" strokeWidth={1.75} />
            </button>
            <Link href="/login" className="font-medium transition hover:underline" style={{ color: '#ff6020' }}>
              退出
            </Link>
          </div>
        </header>

        <div
          className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b px-4 py-2.5 text-sm sm:px-6"
          style={{ borderColor: 'var(--color-ash)', backgroundColor: 'var(--color-ledger-white)' }}
        >
          <Link href="/dashboard" className="font-medium hover:underline" style={{ color: 'var(--color-coal-ink)' }}>
            工作台
          </Link>
          {pageTitle ? (
            <>
              <span style={{ color: 'var(--color-fossil)' }}>/</span>
              <span style={{ color: 'var(--color-slate-mid)' }}>{pageTitle}</span>
            </>
          ) : null}
        </div>

        <main
          ref={mainScrollRef}
          className="min-h-0 w-full flex-1 overflow-y-auto overscroll-contain px-4 py-6 sm:px-6 lg:px-8 scrollbar-none"
        >
          {children}
        </main>
      </div>

      <div className="pointer-events-none fixed bottom-6 right-5 z-[38] flex flex-col items-end gap-2 sm:right-8">
        {quickPaths.length > 0 ? (
          <nav
            className="pointer-events-auto flex max-h-[min(50vh,22rem)] max-w-[13.5rem] flex-col gap-0.5 overflow-y-auto overscroll-contain rounded-xl border border-ash/80 bg-white/95 py-1.5 pl-2 pr-1 shadow-lg backdrop-blur-sm scrollbar-none"
            style={{ borderColor: 'var(--color-ash)' }}
            aria-label="快捷入口"
          >
            {quickPaths.map((path) => (
              <Link
                key={path}
                href={path}
                className="block truncate rounded-lg px-2 py-1.5 text-left text-[11px] font-medium leading-snug text-coal-ink transition hover:bg-[#f5f3ef]"
                title={labelForQuickPath(path)}
              >
                {labelForQuickPath(path)}
              </Link>
            ))}
          </nav>
        ) : null}
        {showBackTop ? (
          <button
            type="button"
            onClick={scrollMainToTop}
            className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-ash/90 bg-white text-coal-ink shadow-lg transition hover:bg-[#fafafa]"
            style={{ borderColor: 'var(--color-ash)' }}
            aria-label="回到顶部"
          >
            <ArrowUp className="h-5 w-5" strokeWidth={2} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
