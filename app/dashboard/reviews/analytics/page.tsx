'use client';

import { useMemo } from 'react';
import { useOptionsShops, useReviewHub } from '@/components/review-hub/useReviewHub';

export default function ReviewAnalyticsPage() {
  const { data, hydrated } = useReviewHub();
  const { shops, loaded } = useOptionsShops();

  const byShop = useMemo(() => {
    const map = new Map<string, { target: number; done: number }>();
    for (const s of shops) {
      const t = data.shopTargets[s]?.monthlyTarget ?? 0;
      map.set(s, { target: t, done: 0 });
    }
    for (const sub of data.submissions) {
      const cur = map.get(sub.shop) ?? { target: data.shopTargets[sub.shop]?.monthlyTarget ?? 0, done: 0 };
      cur.done += 1;
      map.set(sub.shop, cur);
    }
    return map;
  }, [data.shopTargets, data.submissions, shops]);

  const byStaff = useMemo(() => {
    const m = new Map<string, number>();
    for (const sub of data.submissions) {
      m.set(sub.staff, (m.get(sub.staff) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [data.submissions]);

  if (!hydrated || !loaded) return <p className="text-sm text-slate-mid">加载中…</p>;

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-mid">基于本地「店铺目标」与「客服提交」汇总；店铺列表仍与后台 options 同步。</p>

      <div>
        <h3 className="text-sm font-semibold text-coal-ink">按店铺</h3>
        <div className="mt-2 overflow-x-auto rounded-[10px] border border-ash bg-white">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-ash bg-parchment/50 text-left text-graphite">
                <th className="px-3 py-2">店铺</th>
                <th className="px-3 py-2">本月目标</th>
                <th className="px-3 py-2">已登记提交数</th>
              </tr>
            </thead>
            <tbody>
              {shops.map((shop) => {
                const row = byShop.get(shop);
                return (
                  <tr key={shop} className="border-b border-ash/70">
                    <td className="px-3 py-2 font-medium">{shop}</td>
                    <td className="px-3 py-2 tabular-nums">{row?.target ?? 0}</td>
                    <td className="px-3 py-2 tabular-nums">{row?.done ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-coal-ink">按客服（提交条数）</h3>
        {byStaff.length === 0 ? (
          <p className="mt-2 text-sm text-slate-mid">暂无提交数据</p>
        ) : (
          <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {byStaff.map(([name, n]) => (
              <li key={name} className="rounded-lg border border-ash bg-elevated px-3 py-2 text-sm">
                <span className="font-medium text-coal-ink">{name}</span>
                <span className="ml-2 tabular-nums text-graphite">{n} 条</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-[10px] border border-dashed border-fossil bg-ledger-white px-3 py-2 text-xs text-slate-mid">
        任务总数：{data.assignments.length} · 提交记录总数：{data.submissions.length}
      </div>
    </div>
  );
}
