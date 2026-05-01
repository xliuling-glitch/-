'use client';
import { useMemo, useState } from 'react';

export function DynamicTable({ moduleKey, defaultColumns }: { moduleKey: string; defaultColumns: string[] }) {
  const storageKey = `cols_${moduleKey}`;
  const [columns, setColumns] = useState<string[]>(() => {
    if (typeof window === 'undefined') return defaultColumns;
    const cached = localStorage.getItem(storageKey);
    return cached ? JSON.parse(cached) : defaultColumns;
  });
  const [rows, setRows] = useState<any[]>([{ id: 1 }, { id: 2 }]);
  const [newCol, setNewCol] = useState('');

  const saveCols = (next: string[]) => {
    setColumns(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  };

  const addCol = () => { if (!newCol.trim()) return; saveCols([...columns, newCol.trim()]); setNewCol(''); };
  const removeCol = (name: string) => saveCols(columns.filter((c) => c !== name));

  const onCsv = async (f: File) => {
    const text = await f.text();
    const lines = text.trim().split(/\r?\n/);
    if (!lines.length) return;
    const head = lines[0].split(',').map((s) => s.trim());
    saveCols(head);
    const parsed = lines.slice(1).map((line, i) => {
      const vals = line.split(',');
      const obj: any = { id: i + 1 };
      head.forEach((h, idx) => (obj[h] = vals[idx] || ''));
      return obj;
    });
    setRows(parsed);
  };

  const tableRows = useMemo(() => rows, [rows]);

  return <div className='space-y-3'>
    <div className='flex gap-2 flex-wrap'>
      <input className='border p-2 rounded' value={newCol} onChange={(e)=>setNewCol(e.target.value)} placeholder='新增表头字段' />
      <button className='px-3 py-1 bg-blue-600 text-white rounded' onClick={addCol}>添加表头</button>
      <label className='px-3 py-1 bg-emerald-600 text-white rounded cursor-pointer'>导入CSV<input type='file' accept='.csv' className='hidden' onChange={(e)=>e.target.files?.[0]&&onCsv(e.target.files[0])}/></label>
    </div>
    <div className='bg-white border rounded p-4 overflow-auto'>
      <table className='w-full text-sm min-w-[900px]'>
        <thead><tr>{columns.map(c=><th key={c} className='text-left p-2 border-b'>{c}<button className='ml-2 text-red-500' onClick={()=>removeCol(c)}>×</button></th>)}<th className='p-2 border-b'>操作</th></tr></thead>
        <tbody>{tableRows.map((r,i)=><tr key={i} className='border-b'>{columns.map(c=><td key={c} className='p-2'><input className='border rounded p-1 w-full' value={r[c]||''} onChange={(e)=>setRows(prev=>prev.map((x,idx)=>idx===i?{...x,[c]:e.target.value}:x))}/></td>)}<td className='p-2 text-xs text-slate-500'>在线填写</td></tr>)}</tbody>
      </table>
    </div>
  </div>;
}
