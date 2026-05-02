'use client';
import { useEffect, useState } from 'react';

const menus=['/dashboard','/dashboard/tasks','/dashboard/customers','/dashboard/followups','/dashboard/calls','/dashboard/conversions','/dashboard/daily-sales','/dashboard/kpi','/dashboard/repurchase','/dashboard/reviews','/dashboard/social','/dashboard/competitors','/dashboard/problems','/dashboard/scripts','/dashboard/schedules','/dashboard/task-rules','/dashboard/submissions','/dashboard/settings'];
const users=['admin','manager','zhouchen','zhangzhiguo','likefu','newbie'];

export default function Page(){
  const [perm,setPerm]=useState<Record<string,string[]>>({});
  useEffect(()=>{const c=localStorage.getItem('menu_perm'); if(c) setPerm(JSON.parse(c)); else setPerm(Object.fromEntries(users.map(u=>[u,[...menus]])));},[]);
  const toggle=(u:string,m:string)=>setPerm(p=>{const has=(p[u]||[]).includes(m);const next={...p,[u]:has?(p[u]||[]).filter(x=>x!==m):[...(p[u]||[]),m]};localStorage.setItem('menu_perm',JSON.stringify(next));return next;});
  return <div className='space-y-3'><h2 className='text-xl font-semibold'>用户管理（菜单权限）</h2><div className='bg-white border rounded p-3 overflow-auto'><table className='text-sm min-w-[1100px]'><thead><tr><th className='p-2'>菜单</th>{users.map(u=><th key={u} className='p-2'>{u}</th>)}</tr></thead><tbody>{menus.map(m=><tr key={m} className='border-t'><td className='p-2'>{m}</td>{users.map(u=><td key={u} className='p-2 text-center'><input type='checkbox' checked={(perm[u]||[]).includes(m)} onChange={()=>toggle(u,m)} /></td>)}</tr>)}</tbody></table><p className='text-xs text-slate-500 mt-2'>勾选保存：自动缓存到浏览器 localStorage。</p></div></div>
}
