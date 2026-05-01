'use client';
import { useEffect, useState } from 'react';
import { Card, Badge } from '@/components/ui';

export default function Home(){
  const [summary,setSummary]=useState({taskCount:0,callCount:0,customerCount:0,avgKpi:0});
  const [warnings,setWarnings]=useState<any[]>([]);
  useEffect(()=>{fetch('/api/dashboard/summary').then(r=>r.json()).then(setSummary);fetch('/api/warnings').then(r=>r.json()).then(setWarnings);},[]);
  const redCount = warnings.filter(w=>w.level==='red'&&w.value>0).length;
  return <div className='space-y-4'>
    <div className='grid grid-cols-3 gap-3'>
      <Card><h3 className='font-semibold'>客户转化分析仪表盘</h3><p>询单客户总量：{summary.customerCount}</p><p>电联触达：{summary.callCount}</p></Card>
      <Card><h3 className='font-semibold'>客服团队绩效仪表盘</h3><p>团队平均KPI：{summary.avgKpi}</p><Badge color={summary.avgKpi>=80?'bg-green-100 text-green-700':'bg-red-100 text-red-700'} text={summary.avgKpi>=80?'达标':'未达标'} /></Card>
      <Card><h3 className='font-semibold'>任务到期/逾期</h3><p>今日任务：{summary.taskCount}</p><p>高优先级预警：{redCount}</p></Card>
    </div>
    <div className='grid grid-cols-3 gap-3'>
      <Card><h3 className='font-semibold'>任务逾期预警</h3><p>{warnings.find(w=>w.type==='任务逾期')?.value ?? 0} 条</p></Card>
      <Card><h3 className='font-semibold'>复购任务自动生成</h3><p>{(warnings.find(w=>w.type==='7天回访未执行')?.value ?? 0)+(warnings.find(w=>w.type==='30天耗材未执行')?.value ?? 0)+(warnings.find(w=>w.type==='90天保养未执行')?.value ?? 0)} 条待处理</p></Card>
      <Card><h3 className='font-semibold'>客户跟进提醒</h3><p>{warnings.find(w=>w.type==='H客户跟进风险')?.value ?? 0} 位高价值客户需跟进</p></Card>
    </div>
  </div>
}
