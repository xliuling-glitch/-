'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui';
import { formatAmountYuan } from '@/lib/format-amount';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

type RangePreset = 7 | 15 | 30 | 'custom';

type AnalyticsPayload = {
  from: string;
  to: string;
  dayCount: number;
  totalSales: number;
  staffRank: { staff: string; sales: number }[];
  shopShare: { shop: string; sales: number; pct: number }[];
  heatmap: { staffs: string[]; shops: string[]; cells: number[][]; max: number };
  shopTable: {
    shop: string;
    reception: number;
    aftersale: number;
    invalidInquiry: number;
    presale: number;
    deals: number;
    sales: number;
  }[];
};

const PIE_COLORS = ['#1e3a5f', '#3b82f6', '#ef4444', '#ec4899', '#14b8a6', '#22c55e', '#f97316', '#eab308', '#a855f7', '#64748b'];

function endTodayRange(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - (days - 1));
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function heatmapCellText(n: number): string {
  if (n === 0) return '0';
  return formatAmountYuan(n);
}

export function DashboardAdminAnalytics() {
  const [role, setRole] = useState<string | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [preset, setPreset] = useState<RangePreset>(7);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [range, setRange] = useState(() => endTodayRange(7));
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/session', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setRole(d?.user?.role ?? null))
      .catch(() => setRole(null))
      .finally(() => setSessionLoaded(true));
  }, []);

  useEffect(() => {
    if (preset === 'custom') return;
    setRange(endTodayRange(preset));
  }, [preset]);

  const load = useCallback(async () => {
    const from = preset === 'custom' ? customFrom : range.from;
    const to = preset === 'custom' ? customTo : range.to;
    if (!from || !to || from > to) {
      setErr('请选择有效日期区间');
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/dashboard/daily-report-analytics?from=${from}&to=${to}`, { credentials: 'include' });
      if (res.status === 403) {
        setData(null);
        setErr(null);
        return;
      }
      if (!res.ok) {
        const t = await res.text();
        setErr(t.slice(0, 200));
        setData(null);
        return;
      }
      setData(await res.json());
    } catch {
      setErr('加载失败');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [preset, customFrom, customTo, range.from, range.to]);

  useEffect(() => {
    if (!sessionLoaded) return;
    if (role !== 'admin' && role !== 'manager') return;
    if (preset === 'custom' && (!customFrom || !customTo)) return;
    void load();
  }, [sessionLoaded, role, load, preset, customFrom, customTo]);

  const barData = useMemo(() => {
    if (!data?.staffRank?.length) return [];
    return [...data.staffRank].sort((a, b) => b.sales - a.sales);
  }, [data]);

  const pieData = useMemo(() => data?.shopShare?.filter((x) => x.sales > 0) ?? [], [data]);

  if (!sessionLoaded) return null;
  if (role !== 'admin' && role !== 'manager') return null;

  const displayFrom = preset === 'custom' ? customFrom : range.from;
  const displayTo = preset === 'custom' ? customTo : range.to;

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 border-b border-ash pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="font-display text-heading-sm font-bold tracking-tight text-coal-ink">日报数据看板（管理员）</h3>
          <p className="mt-1 text-sm text-slate-mid">
            数据来自客服上传的<strong className="text-coal-ink">日销/日报（DailySales）</strong>。区间{' '}
            <span className="tabular-nums text-coal-ink">
              {displayFrom} ~ {displayTo}
            </span>
            {data ? `（共 ${data.dayCount} 天）` : null}
          </p>
        </div>
        <div className="shrink-0 space-y-2 rounded-[10px] border border-ash bg-elevated px-4 py-3">
          <div className="text-xs font-semibold text-graphite">📅 日期范围</div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            {(
              [
                [7, '最近7天'],
                [15, '最近15天'],
                [30, '最近30天'],
              ] as const
            ).map(([d, label]) => (
              <label key={d} className="inline-flex cursor-pointer items-center gap-1.5 text-graphite">
                <input
                  type="radio"
                  name="dash-range"
                  checked={preset === d}
                  onChange={() => setPreset(d)}
                  className="accent-[#ff6020]"
                />
                {label}
              </label>
            ))}
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-graphite">
              <input
                type="radio"
                name="dash-range"
                checked={preset === 'custom'}
                onChange={() => setPreset('custom')}
                className="accent-[#ff6020]"
              />
              定制日期
            </label>
          </div>
          {preset === 'custom' ? (
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <label className="text-xs text-stone">
                开始
                <input
                  type="date"
                  className="input-field mt-1 block text-sm"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                />
              </label>
              <label className="text-xs text-stone">
                结束
                <input
                  type="date"
                  className="input-field mt-1 block text-sm"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                />
              </label>
              <button type="button" className="btn-primary text-xs" onClick={() => void load()}>
                应用
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {err ? <p className="text-sm text-red-600">{err}</p> : null}
      {loading ? <p className="text-sm text-stone">加载中…</p> : null}

      {data ? (
        <>
          <Card elevated className="border border-ash bg-gradient-to-br from-white to-ledger-white p-5">
            <div className="text-sm text-slate-mid">所有店铺销售额汇总（区间内）</div>
            <div className="font-display mt-1 text-3xl font-bold tabular-nums text-coal-ink">{formatAmountYuan(data.totalSales)}</div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card elevated className="h-[380px] p-4">
              <h4 className="font-display text-sm font-bold text-coal-ink">客服业绩排行榜（销售额，来自日报）</h4>
              {barData.length === 0 ? (
                <p className="mt-8 text-sm text-stone">该区间暂无日销数据</p>
              ) : (
                <ResponsiveContainer width="100%" height="90%">
                  <BarChart data={barData} margin={{ top: 28, right: 8, left: 0, bottom: 0 }}>
                    <XAxis dataKey="staff" tick={{ fill: '#5a5957', fontSize: 12 }} />
                    <YAxis
                      tick={{ fill: '#5a5957', fontSize: 11 }}
                      tickFormatter={(v) => formatAmountYuan(Number(v), 0)}
                    />
                    <Tooltip
                      formatter={(v: number) => [formatAmountYuan(v), '销售额']}
                      contentStyle={{ borderRadius: 10, border: '1px solid #e8e6e3', fontSize: 13 }}
                    />
                    <Bar
                      dataKey="sales"
                      fill="#3b82f6"
                      radius={[6, 6, 0, 0]}
                      label={{
                        position: 'top',
                        formatter: (v: number | string) => formatAmountYuan(Number(v), 0),
                        fontSize: 11,
                        fill: '#1c1a17',
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>

            <Card elevated className="h-[380px] p-4">
              <h4 className="font-display text-sm font-bold text-coal-ink">各店铺销售活动（来自日报）</h4>
              {pieData.length === 0 ? (
                <p className="mt-8 text-sm text-stone">该区间暂无店铺销售额</p>
              ) : (
                <ResponsiveContainer width="100%" height="90%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="sales"
                      nameKey="shop"
                      cx="42%"
                      cy="50%"
                      innerRadius={56}
                      outerRadius={88}
                      paddingAngle={1}
                      label={({ percent }) =>
                        (percent ?? 0) >= 0.01
                          ? `${((percent ?? 0) * 100).toFixed(1)}%`
                          : (percent ?? 0) > 0
                            ? `${((percent ?? 0) * 100).toFixed(2)}%`
                            : ''
                      }
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="#fafafa" strokeWidth={1} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatAmountYuan(v)} />
                    <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 11, paddingLeft: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </Card>
          </div>

          <Card elevated className="overflow-hidden p-4">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <h4 className="font-display text-sm font-bold text-coal-ink">客服 × 店铺矩阵（来自日报）</h4>
              <div className="flex items-center gap-2 text-[10px] text-stone">
                <span className="h-3 w-16 rounded bg-gradient-to-r from-[#eff6ff] to-[#1e40af]" />
                <span>浅 → 深（销售额高）</span>
              </div>
            </div>
            <div className="max-h-[420px] overflow-auto">
              <table className="min-w-max border-collapse text-left text-xs">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 border border-ash bg-ledger-white px-2 py-2 font-semibold text-coal-ink">客服</th>
                    {data.heatmap.shops.map((shop) => (
                      <th key={shop} className="min-w-[100px] border border-ash bg-ash/40 px-2 py-2 font-medium text-graphite">
                        {shop}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.heatmap.staffs.map((staff, i) => (
                    <tr key={staff}>
                      <td className="sticky left-0 z-10 border border-ash bg-white px-2 py-1.5 font-medium text-coal-ink">{staff}</td>
                      {data.heatmap.shops.map((_, j) => {
                        const v = data.heatmap.cells[i]?.[j] ?? 0;
                        const mx = data.heatmap.max || 1;
                        const t = mx > 0 ? v / mx : 0;
                        const bg = `rgba(37, 99, 235, ${0.06 + t * 0.84})`;
                        return (
                          <td
                            key={j}
                            className="border border-ash px-2 py-1.5 text-right tabular-nums text-coal-ink"
                            style={{ backgroundColor: bg }}
                          >
                            {heatmapCellText(v)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card elevated className="overflow-hidden p-4">
            <h4 className="font-display text-sm font-bold text-coal-ink">日报汇总 · 按店铺（区间内累加）</h4>
            <p className="mt-1 text-xs text-stone">接待 / 售后 / 无效 / 售前 / 成交人数 / 日销售额 均来自日销表逐日累加。</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-ash bg-ash/40 text-left text-xs font-semibold text-graphite">
                    <th className="px-3 py-2">店铺</th>
                    <th className="px-3 py-2">接待人数</th>
                    <th className="px-3 py-2">售后</th>
                    <th className="px-3 py-2">无效</th>
                    <th className="px-3 py-2">售前</th>
                    <th className="px-3 py-2">成交人数</th>
                    <th className="px-3 py-2">销售额</th>
                  </tr>
                </thead>
                <tbody>
                  {data.shopTable.map((row) => (
                    <tr key={row.shop} className="border-b border-ash/60">
                      <td className="px-3 py-2 font-medium text-coal-ink">{row.shop}</td>
                      <td className="px-3 py-2 tabular-nums">{row.reception}</td>
                      <td className="px-3 py-2 tabular-nums">{row.aftersale}</td>
                      <td className="px-3 py-2 tabular-nums">{row.invalidInquiry}</td>
                      <td className="px-3 py-2 tabular-nums">{row.presale}</td>
                      <td className="px-3 py-2 tabular-nums">{row.deals}</td>
                      <td className="px-3 py-2 tabular-nums font-medium">{formatAmountYuan(row.sales)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-coal-ink/[0.06] font-semibold text-coal-ink">
                    <td className="px-3 py-2">合计</td>
                    <td className="px-3 py-2 tabular-nums">{data.shopTable.reduce((s, r) => s + r.reception, 0)}</td>
                    <td className="px-3 py-2 tabular-nums">{data.shopTable.reduce((s, r) => s + r.aftersale, 0)}</td>
                    <td className="px-3 py-2 tabular-nums">{data.shopTable.reduce((s, r) => s + r.invalidInquiry, 0)}</td>
                    <td className="px-3 py-2 tabular-nums">{data.shopTable.reduce((s, r) => s + r.presale, 0)}</td>
                    <td className="px-3 py-2 tabular-nums">{data.shopTable.reduce((s, r) => s + r.deals, 0)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatAmountYuan(data.totalSales)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        </>
      ) : null}
    </section>
  );
}
