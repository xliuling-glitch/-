'use client';
import Image from 'next/image';
import { useEffect, useState } from 'react';

export default function Page(){
  const today = new Date().toISOString().slice(0,10);
  const [rows,setRows]=useState<any[]>([]); const [file,setFile]=useState<File|null>(null); const [type,setType]=useState('朋友圈'); const [note,setNote]=useState('');
  const load=async()=>setRows(await (await fetch(`/api/social-media?date=${today}`)).json());
  useEffect(()=>{load()},[]);
  const submit=async()=>{const fd=new FormData(); if(file) fd.append('file',file); fd.append('type',type); fd.append('note',note); fd.append('userId','1'); await fetch('/api/social-media',{method:'POST',body:fd}); setFile(null); setNote(''); load();};
  const remove=async(id:number)=>{await fetch(`/api/social-media?id=${id}`,{method:'DELETE'});load();};
  return <div className='space-y-3'><h2 className='text-xl font-semibold'>朋友圈/视频号（截图提交）</h2><div className='bg-white border rounded p-3 flex gap-2 items-center'><select className='border p-2' value={type} onChange={e=>setType(e.target.value)}><option>朋友圈</option><option>视频号</option></select><input className='border p-2' placeholder='备注' value={note} onChange={e=>setNote(e.target.value)} /><input type='file' accept='image/*' onChange={e=>setFile(e.target.files?.[0]||null)} /><button className='bg-blue-600 text-white px-3 py-1 rounded' onClick={submit}>提交截图</button></div><div className='grid grid-cols-4 gap-3'>{rows.map(r=><div key={r.id} className='bg-white border rounded p-2'><div className='text-sm'>{r.type} | {new Date(r.date).toLocaleString()}</div>{r.screenshot?<Image src={r.screenshot} alt='截图' width={240} height={140} className='rounded mt-2 object-cover h-32 w-full'/>:<div className='h-32 bg-slate-100 mt-2'/>}<button className='mt-2 text-red-600 text-sm' onClick={()=>remove(r.id)}>删除记录</button></div>)}</div></div>
}
