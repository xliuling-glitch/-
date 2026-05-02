'use client';
import { useEffect, useState } from 'react';

const menus=['/dashboard','/dashboard/tasks','/dashboard/customers','/dashboard/followups','/dashboard/calls','/dashboard/conversions','/dashboard/daily-sales','/dashboard/kpi','/dashboard/repurchase','/dashboard/reviews','/dashboard/social','/dashboard/competitors','/dashboard/problems','/dashboard/scripts','/dashboard/schedules','/dashboard/task-rules','/dashboard/submissions','/dashboard/settings'];
const users=['admin','manager','zhouchen','zhangzhiguo','likefu','newbie'];

export default function Page(){
  const [perm,setPerm]=useState<Record<string,string[]>>({});
  useEffect(()=>{fetch('/api/menu-permissions').then(r=>r.json()).then((p)=>setPerm(Object.keys(p).length?p:Object.fromEntries(users.map(u=>[u,[...menus]]))));},[]);
  const toggle=(u:string,m:string)=>setPerm(p=>{const has=(p[u]||[]).includes(m);return {...p,[u]:has?(p[u]||[]).filter(x=>x!==m):[...(p[u]||[]),m]};});
  const save=async()=>{await fetch('/api/menu-permissions',{method:'POST',body:JSON.stringify(perm)});alert('权限已保存');};
  return <div className='space-y-3'><h2 className='text-xl font-semibold'>用户管理（菜单权限）</h2><div className='bg-white border rounded p-3 overflow-auto'><table className='text-sm min-w-[1100px]'><thead><tr><th className='p-2'>菜单</th>{users.map(u=><th key={u} className='p-2'>{u}</th>)}</tr></thead><tbody>{menus.map(m=><tr key={m} className='border-t'><td className='p-2'>{m}</td>{users.map(u=><td key={u} className='p-2 text-center'><input type='checkbox' checked={(perm[u]||[]).includes(m)} onChange={()=>toggle(u,m)} /></td>)}</tr>)}</tbody></table><button className='mt-3 px-3 py-1 bg-blue-600 text-white rounded' onClick={save}>保存权限</button></div></div>
}
