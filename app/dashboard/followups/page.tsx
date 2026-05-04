'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type AttemptCell = {
  attemptNo: number;
  followedAt: string | null;
  callSummary: string;
  screenshot: string | null;
  statusReason: string;
  statusNote: string | null;
  isDeal: boolean;
  dealAmount: number | null;
};

type MatrixRow = {
  buyerId: string;
  shop: string;
  staff: string;
  purchaseIntent: string;
  customerCategory: string;
  attempts: [AttemptCell | null, AttemptCell | null, AttemptCell | null, AttemptCell | null];
};

const SUB_HEADERS = [
  ['第一次电联', '第一次截图', '第一次状态/未购原因'],
  ['第二次电联', '第二次截图', '第二次状态/未购原因'],
  ['第三次电联', '第三次截图', '第三次状态/未购原因'],
  ['第四次电联', '第四次截图', '第四次状态/未购原因'],
] as const;

function Thumb({ src }: { src: string | null }) {
  if (!src) return <span className="text-[#969594]">—</span>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="mx-auto h-11 w-16 rounded border border-[#f1f1f1] object-cover" />
  );
}

export default function Page() {
  const defaultSince = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return d.toISOString().slice(0, 10);
  }, []);
  const [since, setSince] = useState(defaultSince);
  const [buyerFilter, setBuyerFilter] = useState('');
  const [matrix, setMatrix] = useState<MatrixRow[]>([]);
  const [logCount, setLogCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      q.set('since', since);
      if (buyerFilter.trim()) q.set('buyerId', buyerFilter.trim());
      const res = await fetch(`/api/followup-matrix?${q}`);
      const data = await res.json();
      setMatrix(Array.isArray(data.matrix) ? data.matrix : []);
      setLogCount(typeof data.logCount === 'number' ? data.logCount : 0);
    } finally {
      setLoading(false);
    }
  }, [since, buyerFilter]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-heading-sm font-bold tracking-tight text-[#1c1a17]">客户跟进</h2>
        <p className="mt-1 text-sm text-[#7e7d7b]">
          与<strong className="text-[#1c1a17]">询单转化 → ② 跟进日志</strong>同步的宽表：
          <strong className="text-[#1c1a17]">客户购买欲望</strong>、<strong className="text-[#1c1a17]">客户分类</strong>，以及四次电联各自的
          <strong className="text-[#1c1a17]">电联记录、截图、状态/未购买原因与状态备注</strong>。日志未填时，购买欲望/分类会尝试从同旺旺的<strong>线索主档</strong>带出。
          留资跟进表 CSV 批量导入请前往{' '}
          <Link href="/dashboard/conversions" className="font-medium text-signal-violet underline">
            询单转化
          </Link>
          。
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-[10px] border border-[#f1f1f1] bg-white p-4">
        <label className="text-sm text-[#5a5957]">
          自日期起（跟进发生日）
          <input type="date" className="input-field mt-1 w-auto" value={since} onChange={(e) => setSince(e.target.value)} />
        </label>
        <label className="min-w-[180px] flex-1 text-sm text-[#5a5957]">
          筛选旺旺 ID
          <input
            className="input-field mt-1"
            placeholder="留空则显示全部"
            value={buyerFilter}
            onChange={(e) => setBuyerFilter(e.target.value)}
          />
        </label>
        <button type="button" className="btn-primary text-sm" onClick={load}>
          刷新
        </button>
        <Link href="/dashboard/conversions" className="btn-ghost text-sm">
          去询单转化录入
        </Link>
        <span className="text-xs text-[#969594]">
          {logCount} 条日志 → {matrix.length} 个旺旺
        </span>
      </div>

      {loading ? <p className="text-sm text-[#7e7d7b]">加载中…</p> : null}

      {!loading && matrix.length === 0 ? (
        <p className="text-sm text-[#969594]">该条件下暂无数据。请先在询单转化中提交 ② 跟进日志。</p>
      ) : null}

      {!loading && matrix.length > 0 ? (
        <div className="overflow-x-auto rounded-[10px] border border-[#f1f1f1] bg-[#fafafa] shadow-[rgba(95,99,106,0.08)_0px_0px_0px_1px]">
          <table className="w-full min-w-[1600px] border-collapse text-[11px] sm:text-xs">
            <thead>
              <tr className="border-b border-[#f1f1f1] bg-[#f7f3eb] text-left text-[#5a5957]">
                <th className="sticky left-0 z-10 min-w-[88px] border-r border-[#f1f1f1] px-1.5 py-2 font-semibold text-[#1c1a17]">旺旺</th>
                <th className="min-w-[64px] px-1.5 py-2 font-semibold">店铺</th>
                <th className="min-w-[48px] px-1.5 py-2 font-semibold">客服</th>
                <th className="min-w-[80px] px-1.5 py-2 font-semibold">客户购买欲望</th>
                <th className="min-w-[72px] border-r border-[#e8e4dc] px-1.5 py-2 font-semibold">客户分类</th>
                {SUB_HEADERS.flatMap((group) =>
                  group.map((h) => (
                    <th
                      key={h}
                      className="min-w-[100px] border-l border-[#eceae6] px-1 py-2 text-center font-semibold leading-tight text-[#1c1a17]"
                    >
                      {h}
                    </th>
                  ))
                )}
              </tr>
            </thead>
            <tbody>
              {matrix.map((row) => (
                <tr key={row.buyerId} className="border-b border-[#f1f1f1]/90 align-top hover:bg-white/90">
                  <td className="sticky left-0 z-10 border-r border-[#f1f1f1] bg-[#fafafa] px-1.5 py-2 font-medium text-[#1c1a17]">
                    {row.buyerId}
                  </td>
                  <td className="max-w-[90px] px-1.5 py-2 text-[#5a5957]">{row.shop || '—'}</td>
                  <td className="px-1.5 py-2 text-[#5a5957]">{row.staff || '—'}</td>
                  <td className="max-w-[100px] px-1.5 py-2 leading-snug text-[#1c1a17]">{row.purchaseIntent}</td>
                  <td className="max-w-[90px] border-r border-[#e8e4dc] px-1.5 py-2 leading-snug text-[#5a5957]">{row.customerCategory}</td>
                  {row.attempts.map((cell, idx) => (
                    <AttemptCells key={idx} cell={cell} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function AttemptCells({ cell }: { cell: AttemptCell | null }) {
  if (!cell) {
    return (
      <>
        <td className="border-l border-[#f1f1f1] px-1 py-2 text-[#bab9b8]">—</td>
        <td className="px-1 py-2 text-center">—</td>
        <td className="border-r border-[#e8e4dc] px-1 py-2 text-[#bab9b8]">—</td>
      </>
    );
  }
  return (
    <>
      <td className="border-l border-[#f1f1f1] px-1 py-2 leading-snug text-[#1c1a17]">{cell.callSummary}</td>
      <td className="px-1 py-2 text-center align-middle">
        <Thumb src={cell.screenshot} />
      </td>
      <td className="border-r border-[#e8e4dc] px-1 py-2 leading-snug text-[#5a5957]">
        <div>{cell.statusReason}</div>
        {cell.statusNote ? (
          <div className="mt-1 border-t border-dashed border-[#f1f1f1] pt-1 text-[10px] text-[#7e7d7b]">状态备注：{cell.statusNote}</div>
        ) : null}
      </td>
    </>
  );
}
