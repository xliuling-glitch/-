'use client';

export function FilterBar({ q, setQ, status, setStatus, date, setDate, onSearch }: any) {
  return (
    <div className='bg-white border rounded p-3 flex gap-2 flex-wrap'>
      <input className='border p-2 rounded w-56' value={q} onChange={(e) => setQ(e.target.value)} placeholder='搜索关键词' />
      <input className='border p-2 rounded' type='date' value={date} onChange={(e) => setDate(e.target.value)} />
      <select className='border p-2 rounded' value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value=''>全部状态</option>
        <option value='未开始'>未开始</option>
        <option value='进行中'>进行中</option>
        <option value='已完成'>已完成</option>
        <option value='逾期'>逾期</option>
      </select>
      <button className='px-3 py-1 bg-slate-800 text-white rounded' onClick={onSearch}>筛选</button>
    </div>
  );
}
