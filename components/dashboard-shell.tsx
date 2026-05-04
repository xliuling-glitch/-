'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Bell, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DASHBOARD_NAV_ITEMS,
  applyNavOrder,
  loadNavOrderFromStorage,
  saveNavOrderToStorage,
} from '@/lib/dashboard-nav';

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

  useEffect(() => {
    setOrderedNav(applyNavOrder(DASHBOARD_NAV_ITEMS, loadNavOrderFromStorage()));
  }, []);

  useEffect(() => {
    fetch('/api/session', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        const role = d?.user?.role as string | undefined;
        setCanReorder(role === 'admin' || role === 'manager');
      })
      .catch(() => setCanReorder(false));
  }, []);

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

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--color-parchment)', color: 'var(--color-coal-ink)' }}>
      <aside
        className="flex w-[min(18rem,100vw)] max-w-[18rem] shrink-0 flex-col border-r border-white/10"
        style={{ backgroundColor: 'var(--color-coal-ink)', minHeight: '100vh' }}
      >
        <div className="border-b border-white/10 px-5 py-5">
          <p className="font-display text-lg font-bold tracking-tight" style={{ color: '#fff' }}>
            欧信作战台
          </p>
          <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.2em]" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Presales
          </p>
        </div>
        {canReorder ? (
          <p className="border-b border-white/10 px-3 py-2 text-[10px] leading-snug text-white/50">
            管理员/主管：悬停菜单项右侧可点上移、下移调整顺序（本机保存，换浏览器需重新排）。
          </p>
        ) : null}
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {orderedNav.map(({ label, path }, i) => {
            const active = navActive(pathname, path);
            return (
              <div
                key={path}
                className={cn(
                  'group flex items-stretch rounded-lg border-l-2 border-transparent transition-colors',
                  active ? 'bg-white/[0.12]' : 'hover:bg-white/[0.06]',
                )}
                style={active ? { borderLeftColor: '#ff6020' } : undefined}
              >
                <Link
                  href={path}
                  className={cn(
                    'min-w-0 flex-1 py-2.5 pl-3 pr-1 text-sm font-medium transition-colors',
                    active ? 'text-white' : 'text-white/70 hover:text-white',
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
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col" style={{ backgroundColor: 'var(--color-parchment)' }}>
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
          className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b px-4 py-2.5 text-sm sm:px-6"
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

        <main className="w-full flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
