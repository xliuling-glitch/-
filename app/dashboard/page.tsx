'use client';
import { useEffect, useState } from 'react';
import { Card, Badge } from '@/components/ui';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function Home(){
  const [summary,setSummary]=useState({taskCount:0,callCount:0,customerCount:0,avgKpi:0});
  const [warnings,setWarnings]=useState<any[]>([]);
  useEffect(()=>{fetch('/api/dashboard/summary').then(r=>r.json()).then(setSummary);fetch('/api/warnings').then(r=>r.json()).then(setWarnings);},[]);
  const kpi=[{name:'团队KPI',score:summary.avgKpi},{name:'任务数',score:summary.taskCount},{name:'电联数',score:summary.callCount}];
  return <div className='space-y-4'><div className='grid grid-cols-4 gap-3'><Card>今日任务数 {summary.taskCount}</Card><Card>今日电联数 {summary.callCount}</Card><Card>客户总数 {summary.customerCount}</Card><Card>平均KPI {summary.avgKpi}</Card></div>
  <Card><h3 className='font-semibold mb-2'>异常预警</h3><div className='flex gap-2 flex-wrap'>{warnings.map((w,i)=><Badge key={i} color={w.level==='red'?'bg-red-100 text-red-700':w.level==='yellow'?'bg-yellow-100 text-yellow-700':'bg-green-100 text-green-700'} text={`${w.type}: ${w.value}`} />)}</div></Card>
  <Card className='h-72'><h3>关键指标</h3><ResponsiveContainer width='100%' height='90%'><BarChart data={kpi}><XAxis dataKey='name'/><YAxis/><Tooltip/><Bar dataKey='score' fill='#3b82f6'/></BarChart></ResponsiveContainer></Card></div>
}
