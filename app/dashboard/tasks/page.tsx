'use client';
import { useEffect, useState } from 'react';

type Task = { id: number; date: string; type: string; name: string; status: string; dueAt: string; user: { name: string } };

export default function Page() {
  const [tasks, setTasks] = useState<Task[]>([]);

  const load = async () => setTasks(await (await fetch('/api/tasks')).json());
  useEffect(() => { load(); }, []);

  const generate = async () => { await fetch('/api/tasks/generate', { method: 'POST' }); await load(); };
  const updateStatus = async (id: number, status: string) => {
    await fetch(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    await load();
  };

  return <div className='space-y-3'>
    <div className='flex justify-between'><h2 className='text-xl font-semibold'>今日任务中心</h2><button onClick={generate} className='bg-emerald-600 text-white px-3 py-1 rounded'>生成今日任务</button></div>
    <div className='bg-white border rounded-xl p-4'>
      <table className='w-full text-sm'><thead><tr><th>日期</th><th>客服</th><th>任务</th><th>截止</th><th>状态</th><th>操作</th></tr></thead>
      <tbody>{tasks.map(t => <tr key={t.id} className='border-t'><td>{new Date(t.date).toLocaleDateString()}</td><td>{t.user?.name}</td><td>{t.type}</td><td>{new Date(t.dueAt).toLocaleTimeString()}</td><td>{t.status}</td><td className='space-x-2'><button className='px-2 py-1 bg-blue-600 text-white rounded' onClick={() => updateStatus(t.id, '进行中')}>开始</button><button className='px-2 py-1 bg-green-600 text-white rounded' onClick={() => updateStatus(t.id, '已完成')}>完成</button></td></tr>)}</tbody></table>
    </div>
  </div>;
}
