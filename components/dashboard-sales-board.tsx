'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui';

type PresaleRow = {
  staff: string;
  presaleTarget: number;
  salesMTD: number;
  completionPct: number | null;
  yesterdayPresale: number;
  yesterdayOffline: number;
};

type AfterRow = {
  staff: string;
  aftersaleTarget: number;
  salesMTD: number;
  completionPct: number | null;
  reshipMTD: number;
  refundMTD: number;
};

type BoardPayload = {
  date: string;
  yearMonth: string;
  yesterday: string;
  monthRange: { from: string; to: string };
  presale: { rows: PresaleRow[]; totals: Record<string, number | null> };
  aftersale: { rows: AfterRow[]; totals: Record<string, number | null> };
};

function fmtMoney(n: number) {
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function ProgressBar({ pct }: { pct: number | null }) {
  if (pct == null) {
    return <span className="text-xs text-stone">—</span>;
  }
  const w = Math.min(100, Math.max(0, pct));
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 min-w-[4rem] flex-1 max-w-[140px] overflow-hidden rounded-full bg-ash">
        <div className="h-full rounded-full bg-mint-pulse transition-all" style={{ width: `${w}%` }} />
      </div>
      <span className="shrink-0 tabular-nums text-xs font-semibold text-coal-ink">{pct.toFixed(2)}%</span>
    </div>
  );
}

export function DashboardSalesBoard() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [data, setData] = useState<BoardPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/dashboard/sales-board?date=${date}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-display text-heading-sm font-bold tracking-tight text-coal-ink">每日销售看板</h3>
          <p className="mt-1 text-sm text-slate-mid">
            售前：日销汇总（<strong className="text-coal-ink">本月累计至所选日</strong>）对比月总指标；昨日销售额 / 昨日线下取<strong className="text-coal-ink">前一自然日</strong>。
            售后：补发 / 退货 / 售后销售额来自<strong className="text-coal-ink">补充录入</strong>（本月累计）。
          </p>
        </div>
        <label className="text-xs text-graphite">
          业务日
          <input
            type="date"
            className="input-field mt-1 block text-sm"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
      </div>

      {loading ? <p className="text-sm text-stone">加载中…</p> : null}
      {!loading && !data ? <p className="text-sm text-smolder">看板数据加载失败。</p> : null}

      {data ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card elevated className="overflow-hidden p-0">
            <div className="border-b border-ash bg-ledger-white px-4 py-3">
              <h4 className="font-display text-sm font-bold text-coal-ink">售前</h4>
              <p className="mt-0.5 text-[11px] text-stone">
                自然月 {data.yearMonth} · 累计区间 {data.monthRange.from} ~ {data.monthRange.to} · 昨日列 = {data.yesterday}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead className="bg-ash/50 text-xs font-semibold text-graphite">
                  <tr>
                    <th className="border-b border-ash px-3 py-2">客服</th>
                    <th className="border-b border-ash px-3 py-2">总指标</th>
                    <th className="border-b border-ash px-3 py-2">销售额(月累计)</th>
                    <th className="border-b border-ash px-3 py-2">完成占比</th>
                    <th className="border-b border-ash px-3 py-2">昨日销售额</th>
                    <th className="border-b border-ash px-3 py-2">昨日线下</th>
                  </tr>
                </thead>
                <tbody>
                  {data.presale.rows.map((r) => (
                    <tr key={r.staff} className="border-b border-ash/60 last:border-0">
                      <td className="px-3 py-2 font-medium text-coal-ink">{r.staff}</td>
                      <td className="px-3 py-2 tabular-nums">{fmtMoney(r.presaleTarget)}</td>
                      <td className="px-3 py-2 tabular-nums">{fmtMoney(r.salesMTD)}</td>
                      <td className="px-3 py-2">
                        <ProgressBar pct={r.completionPct} />
                      </td>
                      <td className="px-3 py-2 tabular-nums text-graphite">{fmtMoney(r.yesterdayPresale)}</td>
                      <td className="px-3 py-2 tabular-nums text-graphite">{fmtMoney(r.yesterdayOffline)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-coal-ink/[0.04] text-sm font-semibold text-coal-ink">
                  <tr>
                    <td className="px-3 py-2">合计 / 均值</td>
                    <td className="px-3 py-2 tabular-nums">{fmtMoney(Number(data.presale.totals.presaleTarget ?? 0))}</td>
                    <td className="px-3 py-2 tabular-nums">{fmtMoney(Number(data.presale.totals.salesMTD ?? 0))}</td>
                    <td className="px-3 py-2">
                      <ProgressBar pct={data.presale.totals.completionPct as number | null} />
                    </td>
                    <td className="px-3 py-2 text-stone">—</td>
                    <td className="px-3 py-2 text-stone">—</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          <Card elevated className="overflow-hidden p-0">
            <div className="border-b border-ash bg-ledger-white px-4 py-3">
              <h4 className="font-display text-sm font-bold text-coal-ink">售后</h4>
              <p className="mt-0.5 text-[11px] text-stone">售后销售额 / 补发 / 退货均为补充表本月累计；指标为月「总指标」。</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] border-collapse text-left text-sm">
                <thead className="bg-ash/50 text-xs font-semibold text-graphite">
                  <tr>
                    <th className="border-b border-ash px-3 py-2">客服</th>
                    <th className="border-b border-ash px-3 py-2">总指标</th>
                    <th className="border-b border-ash px-3 py-2">销售额(月累计)</th>
                    <th className="border-b border-ash px-3 py-2">完成占比</th>
                    <th className="border-b border-ash px-3 py-2">补发金额</th>
                    <th className="border-b border-ash px-3 py-2">退货金额</th>
                  </tr>
                </thead>
                <tbody>
                  {data.aftersale.rows.map((r) => (
                    <tr key={r.staff} className="border-b border-ash/60 last:border-0">
                      <td className="px-3 py-2 font-medium text-coal-ink">{r.staff}</td>
                      <td className="px-3 py-2 tabular-nums">{fmtMoney(r.aftersaleTarget)}</td>
                      <td className="px-3 py-2 tabular-nums">{fmtMoney(r.salesMTD)}</td>
                      <td className="px-3 py-2">
                        <ProgressBar pct={r.completionPct} />
                      </td>
                      <td className="px-3 py-2 tabular-nums text-graphite">{fmtMoney(r.reshipMTD)}</td>
                      <td className="px-3 py-2 tabular-nums text-graphite">{fmtMoney(r.refundMTD)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-coal-ink/[0.04] text-sm font-semibold text-coal-ink">
                  <tr>
                    <td className="px-3 py-2">合计</td>
                    <td className="px-3 py-2 tabular-nums">{fmtMoney(Number(data.aftersale.totals.aftersaleTarget ?? 0))}</td>
                    <td className="px-3 py-2 tabular-nums">{fmtMoney(Number(data.aftersale.totals.salesMTD ?? 0))}</td>
                    <td className="px-3 py-2">
                      <ProgressBar pct={data.aftersale.totals.completionPct as number | null} />
                    </td>
                    <td className="px-3 py-2 tabular-nums">{fmtMoney(Number(data.aftersale.totals.reshipMTD ?? 0))}</td>
                    <td className="px-3 py-2 tabular-nums">{fmtMoney(Number(data.aftersale.totals.refundMTD ?? 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        </div>
      ) : null}

      <p className="text-[11px] leading-relaxed text-stone">
        指标维护：管理员/主管可调用接口写入 — <code className="rounded bg-ash px-1">POST /api/dashboard/sales-board</code>，body{' '}
        <code className="rounded bg-ash px-1">{`{ "kind":"target","yearMonth":"2026-04","staff":"张治国","presaleTarget":1005000,"aftersaleTarget":0 }`}</code>
        或{' '}
        <code className="rounded bg-ash px-1">{`{ "kind":"supplement","date":"2026-04-28","staff":"周晨","presaleOffline":1200,"aftersaleSales":0,"afterReshipAmount":0,"afterRefundAmount":0 }`}</code>
        。迁移：<code className="rounded bg-ash px-1">npx prisma migrate deploy</code>。
      </p>
    </div>
  );
}
