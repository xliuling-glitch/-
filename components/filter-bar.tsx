'use client';

export function FilterBar({ q, setQ, status, setStatus, date, setDate, onSearch }: any) {
  return (
    <div className="flex flex-wrap gap-2 rounded-card border border-ash bg-elevated p-4 shadow-[rgba(95,99,106,0.08)_0px_0px_0px_1px]">
      <input
        className="input-field w-56 max-w-full"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="搜索关键词"
      />
      <input className="input-field w-auto max-w-full" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <select className="input-field max-w-full sm:w-40" value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="">全部状态</option>
        <option value="未开始">未开始</option>
        <option value="进行中">进行中</option>
        <option value="已完成">已完成</option>
        <option value="逾期">逾期</option>
      </select>
      <button type="button" className="btn-primary px-5" onClick={onSearch}>
        筛选
      </button>
    </div>
  );
}
