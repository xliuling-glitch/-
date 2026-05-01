'use client';
import { useEffect, useState } from 'react';
export default function Page(){
 const [list,setList]=useState<any[]>([]);
 const load=async()=>setList(await (await fetch('/api/schedules')).json()); useEffect(()=>{load()},[]);
 const add=async()=>{await fetch('/api/schedules',{method:'POST',body:JSON.stringify({date:new Date(),userId:3,shift:'白班',startTime:'08:00',endTime:'17:30'})});load();};
 return <div className='space-y-3'><h2 className='text-xl font-semibold'>排班管理</h2><div className='bg-white p-4 rounded border'><button className='bg-blue-600 text-white px-3 py-1 rounded' onClick={add}>新增排班</button></div><div className='bg-white p-4 rounded border'><table className='w-full text-sm'><thead><tr><th>ID</th><th>客服</th><th>班次</th><th>时间</th></tr></thead><tbody>{list.map(i=><tr key={i.id} className='border-t'><td>{i.id}</td><td>{i.user?.name}</td><td>{i.shift}</td><td>{i.startTime}-{i.endTime}</td></tr>)}</tbody></table></div></div>
}
