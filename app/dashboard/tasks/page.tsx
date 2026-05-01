'use client';
import { useEffect, useState } from 'react';

type Task = { id: number; date: string; type: string; status: string; dueAt: string; user: { name: string } };

export default function Page() {
  const [tasks, setTasks] = useState<Task[]>([]); const [q,setQ]=useState(''); const [page,setPage]=useState(1); const [total,setTotal]=useState(0);
  const [modal,setModal]=useState<{id:number,type:string}|null>(null); const [note,setNote]=useState(''); const [proof,setProof]=useState(''); const [reviewStatus,setReviewStatus]=useState('');
  const load = async (np=page,nq=q) => { const r=await (await fetch(`/api/tasks?page=${np}&q=${encodeURIComponent(nq)}`)).json(); setTasks(r.items||[]); setTotal(r.total||0); };
  useEffect(() => { load(); }, []);
  const finish=async()=>{ if(!modal)return; const res=await fetch(`/api/tasks/${modal.id}`,{method:'PATCH',body:JSON.stringify({status:'已完成',note,proof,reviewStatus,type:modal.type})}); if(!res.ok) return alert(await res.text()); setModal(null); setNote(''); setProof(''); setReviewStatus(''); load(); };
  return <div className='space-y-3'>
    <div className='flex justify-between'><h2 className='text-xl font-semibold'>今日任务中心</h2><button onClick={async()=>{await fetch('/api/tasks/generate',{method:'POST'});load();}} className='bg-emerald-600 text-white px-3 py-1 rounded'>生成今日任务</button></div>
    <div className='bg-white border rounded p-3 flex gap-2'><input className='border p-2 rounded w-64' value={q} onChange={e=>setQ(e.target.value)} placeholder='搜索任务类型/名称'/><button className='px-3 py-1 bg-slate-800 text-white rounded' onClick={()=>{setPage(1);load(1,q);}}>搜索</button></div>
    <div className='bg-white border rounded-xl p-4'><table className='w-full text-sm'><thead><tr><th>日期</th><th>客服</th><th>任务</th><th>截止</th><th>状态</th><th>操作</th></tr></thead><tbody>{tasks.map(t => <tr key={t.id} className='border-t'><td>{new Date(t.date).toLocaleDateString()}</td><td>{t.user?.name}</td><td>{t.type}</td><td>{new Date(t.dueAt).toLocaleTimeString()}</td><td>{t.status}</td><td className='space-x-2'><button className='px-2 py-1 bg-blue-600 text-white rounded' onClick={()=>fetch(`/api/tasks/${t.id}`,{method:'PATCH',body:JSON.stringify({status:'进行中',note:'start'})}).then(()=>load())}>开始</button><button className='px-2 py-1 bg-green-600 text-white rounded' onClick={()=>setModal({id:t.id,type:t.type})}>完成</button></td></tr>)}</tbody></table></div>
    <div className='flex justify-end gap-2'><button className='border px-2' disabled={page<=1} onClick={()=>{const n=page-1;setPage(n);load(n,q);}}>上一页</button><span>{page} / {Math.max(1,Math.ceil(total/10))}</span><button className='border px-2' disabled={page>=Math.ceil(total/10)} onClick={()=>{const n=page+1;setPage(n);load(n,q);}}>下一页</button></div>
    {modal && <div className='fixed inset-0 bg-black/30 flex items-center justify-center'><div className='bg-white p-4 rounded w-[460px] space-y-2'><h3 className='font-semibold'>完成任务</h3><textarea className='border w-full p-2' placeholder='完成说明(必填)' value={note} onChange={e=>setNote(e.target.value)} />{modal.type.includes('朋友圈') && <input className='border w-full p-2' placeholder='截图链接(必填)' value={proof} onChange={e=>setProof(e.target.value)} />}{modal.type.includes('评价') && <input className='border w-full p-2' placeholder='评价状态(必填)' value={reviewStatus} onChange={e=>setReviewStatus(e.target.value)} />}<div className='text-right space-x-2'><button onClick={()=>setModal(null)}>取消</button><button className='bg-green-600 text-white px-3 py-1 rounded' onClick={finish}>提交完成</button></div></div></div>}
  </div>;
}
