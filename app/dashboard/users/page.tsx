'use client';
import { useEffect, useState } from 'react';
import { DASHBOARD_NAV_ITEMS } from '@/lib/dashboard-nav';

const menus = DASHBOARD_NAV_ITEMS.map(({ path, label }) => ({ path, label }));
const users=['admin','manager','zhouchen','zhangzhiguo','likefu','newbie'];

export default function Page(){
  const [perm,setPerm]=useState<Record<string,string[]>>({});
  useEffect(()=>{fetch('/api/menu-permissions').then(r=>r.json()).then((p)=>setPerm(Object.keys(p).length?p:Object.fromEntries(users.map(u=>[u,menus.map(m=>m.path)]))));},[]);
  const toggle=(u:string,m:string)=>setPerm(p=>{const has=(p[u]||[]).includes(m);return {...p,[u]:has?(p[u]||[]).filter(x=>x!==m):[...(p[u]||[]),m]};});
  const save=async()=>{await fetch('/api/menu-permissions',{method:'POST',body:JSON.stringify(perm)});alert('权限已保存');};
  return <div className='space-y-3'><h2 className='text-xl font-semibold'>用户管理（菜单权限）</h2><div className='bg-white border rounded p-3 overflow-auto'><table className='text-sm min-w-[1100px]'><thead><tr><th className='p-2'>菜单</th>{users.map(u=><th key={u} className='p-2'>{u}</th>)}</tr></thead><tbody>{menus.map(m=><tr key={m.path} className='border-t'><td className='p-2'>{m.label}</td>{users.map(u=><td key={u} className='p-2 text-center'><input type='checkbox' checked={(perm[u]||[]).includes(m.path)} onChange={()=>toggle(u,m.path)} /></td>)}</tr>)}</tbody></table><button className='btn-primary mt-3 text-sm' onClick={save}>保存权限</button></div></div>
}
