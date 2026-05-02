'use client';
import { useEffect, useState } from 'react';

const menus=[
  {path:'/dashboard',label:'工作台首页'},{path:'/dashboard/tasks',label:'今日任务中心'},{path:'/dashboard/customers',label:'客户管理'},{path:'/dashboard/followups',label:'客户跟进'},{path:'/dashboard/calls',label:'电联管理'},{path:'/dashboard/conversions',label:'询单转化'},{path:'/dashboard/daily-sales',label:'每日销售额数据'},{path:'/dashboard/kpi',label:'KPI绩效'},{path:'/dashboard/repurchase',label:'老客复购'},{path:'/dashboard/reviews',label:'评价管理'},{path:'/dashboard/social',label:'朋友圈/视频号'},{path:'/dashboard/competitors',label:'竞品假聊'},{path:'/dashboard/problems',label:'问题复盘'},{path:'/dashboard/scripts',label:'话术素材库'},{path:'/dashboard/schedules',label:'排班管理'},{path:'/dashboard/task-rules',label:'任务规则'},{path:'/dashboard/submissions',label:'今日提交情况'},{path:'/dashboard/settings',label:'系统设置'}
];
const users=['admin','manager','zhouchen','zhangzhiguo','likefu','newbie'];

export default function Page(){
  const [perm,setPerm]=useState<Record<string,string[]>>({});
  useEffect(()=>{fetch('/api/menu-permissions').then(r=>r.json()).then((p)=>setPerm(Object.keys(p).length?p:Object.fromEntries(users.map(u=>[u,menus.map(m=>m.path)]))));},[]);
  const toggle=(u:string,m:string)=>setPerm(p=>{const has=(p[u]||[]).includes(m);return {...p,[u]:has?(p[u]||[]).filter(x=>x!==m):[...(p[u]||[]),m]};});
  const save=async()=>{await fetch('/api/menu-permissions',{method:'POST',body:JSON.stringify(perm)});alert('权限已保存');};
  return <div className='space-y-3'><h2 className='text-xl font-semibold'>用户管理（菜单权限）</h2><div className='bg-white border rounded p-3 overflow-auto'><table className='text-sm min-w-[1100px]'><thead><tr><th className='p-2'>菜单</th>{users.map(u=><th key={u} className='p-2'>{u}</th>)}</tr></thead><tbody>{menus.map(m=><tr key={m.path} className='border-t'><td className='p-2'>{m.label}</td>{users.map(u=><td key={u} className='p-2 text-center'><input type='checkbox' checked={(perm[u]||[]).includes(m.path)} onChange={()=>toggle(u,m.path)} /></td>)}</tr>)}</tbody></table><button className='mt-3 px-3 py-1 bg-blue-600 text-white rounded' onClick={save}>保存权限</button></div></div>
}
