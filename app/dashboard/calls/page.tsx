'use client';
import { useEffect, useState } from 'react';
export default function Page(){
 const [list,setList]=useState<any[]>([]);
 const load=async()=>setList(await (await fetch('/api/calls')).json()); useEffect(()=>{load()},[]);
 const add=async()=>{await fetch('/api/calls',{method:'POST',body:JSON.stringify({date:new Date(),userId:3,customerId:1,connected:true,durationSec:22})});load();};
 return <div className='space-y-3'><h2 className='text-xl font-semibold'>电联管理</h2><div className='bg-white p-4 rounded border'><button className='bg-blue-600 text-white px-3 py-1 rounded' onClick={add}>新增电联</button></div><div className='bg-white p-4 rounded border'><table className='w-full text-sm'><thead><tr><th>ID</th><th>客户</th><th>时长</th><th>有效</th></tr></thead><tbody>{list.map(i=><tr key={i.id} className='border-t'><td>{i.id}</td><td>{i.customer?.name}</td><td>{i.durationSec}s</td><td>{i.validCall?'是':'否'}</td></tr>)}</tbody></table></div></div>
}
