'use client';
import { useEffect, useState } from 'react';

type Customer = { id: number; code: string; name: string; platform: string; level: string; owner: { name: string } };

export default function Page() {
  const [list, setList] = useState<Customer[]>([]);
  const [form, setForm] = useState({ code: '', name: '', platform: '淘宝天猫店', level: 'M普通复购', ownerId: 3 });
  const load = async () => setList(await (await fetch('/api/customers')).json());
  useEffect(() => { load(); }, []);

  const create = async () => { await fetch('/api/customers', { method: 'POST', body: JSON.stringify(form) }); setForm({ ...form, code: '', name: '' }); await load(); };

  return <div className='space-y-3'>
    <h2 className='text-xl font-semibold'>客户管理</h2>
    <div className='bg-white border rounded-xl p-4 grid grid-cols-5 gap-2'>
      <input className='border p-2 rounded' placeholder='客户编号' value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} />
      <input className='border p-2 rounded' placeholder='客户名称' value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
      <input className='border p-2 rounded' placeholder='平台来源' value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value })} />
      <input className='border p-2 rounded' placeholder='客户等级' value={form.level} onChange={e => setForm({ ...form, level: e.target.value })} />
      <button onClick={create} className='bg-blue-600 text-white rounded px-3'>新增客户</button>
    </div>
    <div className='bg-white border rounded-xl p-4'>
      <table className='w-full text-sm'><thead><tr><th>客户编号</th><th>客户名称</th><th>平台</th><th>等级</th><th>负责客服</th></tr></thead>
      <tbody>{list.map(c => <tr key={c.id} className='border-t'><td>{c.code}</td><td>{c.name}</td><td>{c.platform}</td><td>{c.level}</td><td>{c.owner?.name}</td></tr>)}</tbody></table>
    </div>
  </div>;
}
