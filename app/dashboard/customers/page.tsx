'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FilterBar } from '@/components/filter-bar';

export default function Page() {
  const [list, setList] = useState<any[]>([]); const [q,setQ]=useState(''); const [page,setPage]=useState(1); const [total,setTotal]=useState(0);
  const [status,setStatus]=useState(''); const [date,setDate]=useState('');
  const [form, setForm] = useState({ code: '', name: '', platform: '淘宝天猫店', level: 'M普通复购', ownerId: 3 });
  const load = async (np=page,nq=q) => { const r=await (await fetch(`/api/customers?page=${np}&q=${encodeURIComponent(nq)}`)).json(); setList((r.items||[]).filter((x:any)=>!status||x.level===status)); setTotal(r.total||0); };
  useEffect(() => { load(); }, []);
  const create = async () => { await fetch('/api/customers', { method: 'POST', body: JSON.stringify(form) }); setForm({ ...form, code: '', name: '' }); await load(); };
  return <div className='space-y-3'><h2 className='text-xl font-semibold'>客户管理</h2>
    <FilterBar q={q} setQ={setQ} status={status} setStatus={setStatus} date={date} setDate={setDate} onSearch={()=>{setPage(1);load(1,q)}} />
    <div className='bg-white border rounded-xl p-4 grid grid-cols-5 gap-2'><input className='border p-2 rounded' placeholder='客户编号' value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} /><input className='border p-2 rounded' placeholder='客户名称' value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /><input className='border p-2 rounded' placeholder='平台来源' value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value })} /><input className='border p-2 rounded' placeholder='客户等级' value={form.level} onChange={e => setForm({ ...form, level: e.target.value })} /><button onClick={create} className='bg-blue-600 text-white rounded px-3'>新增客户</button></div>
    <div className='bg-white border rounded-xl p-4'><table className='w-full text-sm'><thead><tr><th>客户编号</th><th>客户名称</th><th>平台</th><th>等级</th><th>负责客服</th><th>详情</th></tr></thead><tbody>{list.map(c => <tr key={c.id} className='border-t'><td>{c.code}</td><td>{c.name}</td><td>{c.platform}</td><td>{c.level}</td><td>{c.owner?.name}</td><td><Link className='text-blue-600' href={`/dashboard/customers/${c.id}`}>查看</Link></td></tr>)}</tbody></table></div>
    <div className='flex justify-end gap-2'><button className='border px-2' disabled={page<=1} onClick={()=>{const n=page-1;setPage(n);load(n,q);}}>上一页</button><span>{page} / {Math.max(1,Math.ceil(total/10))}</span><button className='border px-2' disabled={page>=Math.ceil(total/10)} onClick={()=>{const n=page+1;setPage(n);load(n,q);}}>下一页</button></div>
  </div>;
}
