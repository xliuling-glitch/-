'use client';
import { useEffect, useState } from 'react';

type User = { id: number; username: string; name: string; roleId: number; roleCode: string; roleName: string };

const roles = [
  { id: 1, code: 'admin', name: '管理员' },
  { id: 2, code: 'manager', name: '主管' },
  { id: 3, code: 'service', name: '客服' },
  { id: 4, code: 'trainee', name: '新人' },
];

export default function Page() {
  const [users, setUsers] = useState<User[]>([]);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; user?: User } | null>(null);
  const [form, setForm] = useState({ username: '', name: '', roleId: 3, password: '' });
  const [loading, setLoading] = useState(false);

  const load = async (np = page, nq = q) => {
    setLoading(true);
    try {
      const r = await (await fetch(`/api/users?page=${np}&q=${encodeURIComponent(nq)}`)).json();
      setUsers(r.items || []);
      setTotal(r.total || 0);
    } catch {
      // not logged in or forbidden
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setForm({ username: '', name: '', roleId: 3, password: '123456' });
    setModal({ mode: 'create' });
  };

  const openEdit = (u: User) => {
    setForm({ username: u.username, name: u.name, roleId: u.roleId, password: '' });
    setModal({ mode: 'edit', user: u });
  };

  const handleSave = async () => {
    if (!form.username || !form.name) return alert('用户名和姓名不能为空');
    const body: any = { username: form.username, name: form.name, roleId: form.roleId };
    if (form.password) body.password = form.password;
    const url = modal?.mode === 'edit' ? `/api/users/${modal.user!.id}` : '/api/users';
    const method = modal?.mode === 'edit' ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) {
      const text = await res.text();
      return alert(text || '操作失败');
    }
    setModal(null);
    load();
  };

  const handleDelete = async (u: User) => {
    if (!confirm(`确定删除用户 "${u.name}"（${u.username}）吗？此操作不可恢复。`)) return;
    const res = await fetch(`/api/users/${u.id}`, { method: 'DELETE' });
    if (!res.ok) return alert('删除失败');
    load();
  };

  return (
    <div className='space-y-3'>
      <div className='flex justify-between items-center'>
        <h2 className='text-xl font-semibold'>用户管理</h2>
        <button onClick={openCreate} className='bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700'>新增用户</button>
      </div>
      <div className='bg-white border rounded p-3 flex gap-2'>
        <input className='border p-2 rounded w-64' value={q} onChange={e => setQ(e.target.value)} placeholder='搜索用户名/姓名' />
        <button className='px-3 py-1 bg-slate-800 text-white rounded' onClick={() => { setPage(1); load(1, q); }}>搜索</button>
      </div>
      <div className='bg-white border rounded-xl p-4 overflow-x-auto'>
        {loading ? <p className='text-gray-400'>加载中...</p> : (
          <table className='w-full text-sm'>
            <thead>
              <tr className='border-b'>
                <th className='text-left p-2'>ID</th>
                <th className='text-left p-2'>用户名</th>
                <th className='text-left p-2'>姓名</th>
                <th className='text-left p-2'>角色</th>
                <th className='text-left p-2'>操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className='border-t hover:bg-gray-50'>
                  <td className='p-2'>{u.id}</td>
                  <td className='p-2 font-mono text-xs'>{u.username}</td>
                  <td className='p-2'>{u.name}</td>
                  <td className='p-2'>
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      u.roleCode === 'admin' ? 'bg-red-100 text-red-700' :
                      u.roleCode === 'manager' ? 'bg-blue-100 text-blue-700' :
                      u.roleCode === 'service' ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>{u.roleName}</span>
                  </td>
                  <td className='p-2 space-x-2'>
                    <button className='px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700' onClick={() => openEdit(u)}>编辑</button>
                    <button className='px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700' onClick={() => handleDelete(u)}>删除</button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={5} className='p-4 text-center text-gray-400'>暂无数据</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
      <div className='flex justify-end gap-2 text-sm'>
        <button className='border px-2 py-1 rounded disabled:opacity-50' disabled={page <= 1} onClick={() => { const n = page - 1; setPage(n); load(n, q); }}>上一页</button>
        <span className='px-2 py-1'>{page} / {Math.max(1, Math.ceil(total / 20))}</span>
        <button className='border px-2 py-1 rounded disabled:opacity-50' disabled={page >= Math.ceil(total / 20)} onClick={() => { const n = page + 1; setPage(n); load(n, q); }}>下一页</button>
      </div>

      {modal && (
        <div className='fixed inset-0 bg-black/30 flex items-center justify-center z-50' onClick={() => setModal(null)}>
          <div className='bg-white p-6 rounded-xl w-[420px] space-y-4' onClick={e => e.stopPropagation()}>
            <h3 className='text-lg font-semibold'>{modal.mode === 'create' ? '新增用户' : '编辑用户'}</h3>
            <div className='space-y-3'>
              <div>
                <label className='block text-sm text-gray-600 mb-1'>用户名</label>
                <input className='border w-full p-2 rounded' value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} disabled={modal.mode === 'edit'} />
              </div>
              <div>
                <label className='block text-sm text-gray-600 mb-1'>姓名</label>
                <input className='border w-full p-2 rounded' value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className='block text-sm text-gray-600 mb-1'>密码{modal.mode === 'edit' ? '（留空则不修改）' : ''}</label>
                <input className='border w-full p-2 rounded' type='password' value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
              </div>
              <div>
                <label className='block text-sm text-gray-600 mb-1'>角色</label>
                <select className='border w-full p-2 rounded' value={form.roleId} onChange={e => setForm({ ...form, roleId: Number(e.target.value) })}>
                  {roles.map(r => <option key={r.id} value={r.id}>{r.name}（{r.code}）</option>)}
                </select>
              </div>
            </div>
            <div className='flex justify-end gap-2 pt-2'>
              <button className='px-4 py-2 border rounded hover:bg-gray-50' onClick={() => setModal(null)}>取消</button>
              <button className='px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700' onClick={handleSave}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
