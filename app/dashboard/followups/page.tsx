'use client';
import { useEffect, useState } from 'react';
export default function Page(){
 const [list,setList]=useState<any[]>([]); const [customerId,setCustomerId]=useState('1');
 const load=async()=>setList(await (await fetch('/api/followups')).json()); useEffect(()=>{load()},[]);
 const add=async()=>{await fetch('/api/followups',{method:'POST',body:JSON.stringify({date:new Date(),userId:3,customerId})});load();};
 return <div className='space-y-3'><h2 className='text-xl font-semibold'>客户跟进</h2><div className='bg-white p-4 rounded border'><button className='bg-blue-600 text-white px-3 py-1 rounded' onClick={add}>新增跟进</button></div><div className='bg-white p-4 rounded border'><table className='w-full text-sm'><thead><tr><th>ID</th><th>客户</th><th>日期</th></tr></thead><tbody>{list.map(i=><tr key={i.id} className='border-t'><td>{i.id}</td><td>{i.customer?.name}</td><td>{new Date(i.date).toLocaleString()}</td></tr>)}</tbody></table></div></div>
}
