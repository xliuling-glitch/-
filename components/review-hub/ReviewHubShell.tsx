'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/dashboard/reviews/my-tasks', label: '我的任务' },
  { href: '/dashboard/reviews/shops', label: '店铺目标' },
  { href: '/dashboard/reviews/assignments', label: '任务分配' },
  { href: '/dashboard/reviews/analytics', label: '统计报表' },
] as const;

function navActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ReviewHubShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight text-coal-ink">评价管理中心</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-mid">
          按店铺管理评价目标、分配任务与登记提交。店铺列表与系统设置 / 询单等模块的「店铺」选项保持同步（来自后台配置）。
        </p>
      </div>

      <p className="rounded-[10px] border border-amber-200/80 bg-amber-50/90 px-4 py-2.5 text-xs text-amber-950">
        仅用于真实成交客户的评价引导记录，禁止刷评；数据暂存于本机浏览器，重要数据请定期自存或后续接库。
      </p>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <nav className="flex shrink-0 flex-wrap gap-2 border-b border-ash pb-2 lg:w-44 lg:flex-col lg:border-b-0 lg:border-r lg:pr-4 lg:pb-0">
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'rounded-lg px-3 py-2 text-sm font-medium transition',
                navActive(pathname, href) ? 'bg-coal-ink text-white' : 'bg-ledger-white text-graphite hover:bg-ash/80',
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
