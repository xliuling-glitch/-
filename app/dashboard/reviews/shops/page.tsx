'use client';

import { useEffect } from 'react';
import { useOptionsShops, useReviewHub } from '@/components/review-hub/useReviewHub';

export default function ReviewShopsPage() {
  const { data, setData, hydrated } = useReviewHub();
  const { shops, loaded } = useOptionsShops();

  useEffect(() => {
    if (!shops.length) return;
    setData((d) => {
      const st = { ...d.shopTargets };
      for (const s of shops) {
        if (!st[s]) st[s] = { monthlyTarget: 0, note: '' };
      }
      return { ...d, shopTargets: st };
    });
  }, [shops, setData]);

  const update = (shop: string, field: 'monthlyTarget' | 'note', value: string | number) => {
    setData((d) => ({
      ...d,
      shopTargets: {
        ...d.shopTargets,
        [shop]: {
          ...d.shopTargets[shop],
          monthlyTarget: field === 'monthlyTarget' ? Number(value) || 0 : d.shopTargets[shop]?.monthlyTarget ?? 0,
          note: field === 'note' ? String(value) : d.shopTargets[shop]?.note ?? '',
        },
      },
    }));
  };

  if (!hydrated || !loaded) return <p className="text-sm text-slate-mid">加载中…</p>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-mid">
        店铺列表与系统后台「选项配置」中的 <strong className="text-graphite">shops</strong> 同步（接口 <code className="rounded bg-ash px-1 text-xs">GET /api/options</code>）。在此填写各店本月目标评价条数。
      </p>
      {shops.length === 0 ? (
        <p className="text-sm text-amber-800">未获取到店铺列表，可在「系统设置」或数据库中维护 options.shops。</p>
      ) : (
        <div className="overflow-x-auto rounded-[10px] border border-ash bg-white shadow-subtle">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-ash bg-parchment/50 text-left text-graphite">
                <th className="px-3 py-2.5">店铺</th>
                <th className="px-3 py-2.5">本月目标（条）</th>
                <th className="px-3 py-2.5">备注</th>
              </tr>
            </thead>
            <tbody>
              {shops.map((shop) => {
                const t = data.shopTargets[shop] ?? { monthlyTarget: 0, note: '' };
                return (
                  <tr key={shop} className="border-b border-ash/70">
                    <td className="px-3 py-2 font-medium text-coal-ink">{shop}</td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        className="input-field w-28 py-1.5 text-sm tabular-nums"
                        value={t.monthlyTarget}
                        onChange={(e) => update(shop, 'monthlyTarget', e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        className="input-field w-full min-w-[200px] py-1.5 text-sm"
                        value={t.note}
                        onChange={(e) => update(shop, 'note', e.target.value)}
                        placeholder="可选"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-stone">数据保存在浏览器本地；修改后立即生效。</p>
    </div>
  );
}
