'use client';
import { useEffect, useState } from 'react';
export default function Page(){
 const [list,setList]=useState<any[]>([]);
 const load=async()=>setList(await (await fetch('/api/kpi')).json()); useEffect(()=>{load()},[]);
 const add=async()=>{await fetch('/api/kpi',{method:'POST',body:JSON.stringify({date:new Date(),userId:3,score:85})});load();};
 return <div className='space-y-3'><h2 className='text-xl font-semibold'>KPI绩效</h2><div className='bg-white p-4 rounded border'><button className='bg-blue-600 text-white px-3 py-1 rounded' onClick={add}>新增KPI记录</button></div><div className='bg-white p-4 rounded border'><table className='w-full text-sm'><thead><tr><th>ID</th><th>日期</th><th>得分</th><th>达标</th></tr></thead><tbody>{list.map(i=><tr key={i.id} className='border-t'><td>{i.id}</td><td>{new Date(i.date).toLocaleDateString()}</td><td>{i.score}</td><td className={i.reached?'text-green-600':'text-red-600'}>{i.reached?'达标':'未达标'}</td></tr>)}</tbody></table></div></div>
}
