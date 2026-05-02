'use client';
import { useEffect, useState } from 'react';
import { DynamicTable } from '@/components/dynamic-table';

export default function Page(){
  const [missed,setMissed]=useState<string[]>([]);
  useEffect(()=>{const d=new Date().toISOString().slice(0,10);fetch(`/api/dashboard/py-metrics?date=${d}`).then(r=>r.json()).then(x=>setMissed(x.notSubmitted||[]));},[]);
  return <div><h2 className='text-xl font-semibold mb-3'>今日任务中心</h2>{missed.length>0&&<div className='mb-3 p-2 rounded bg-red-50 text-red-700'>未提交日报预警：{missed.join('、')}</div>}<DynamicTable moduleKey='tasks' defaultColumns={['任务日期','客服姓名','任务类型','截止时间','任务状态','优先级','主管备注']} /></div>}
