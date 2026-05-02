'use client';
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function Home(){
  const today = new Date().toISOString().slice(0,10);
  const [data,setData]=useState<any>({salesRank:[],shopShare:[],lostTop:[],inquiryTop:[],submitted:[],notSubmitted:[],rateToday:0,rateYesterday:0});
  useEffect(()=>{fetch(`/api/dashboard/py-metrics?date=${today}`).then(r=>r.json()).then(setData)},[]);
  const diff = (data.rateToday||0)-(data.rateYesterday||0);
  return <div className='space-y-4'>
    <div className='grid grid-cols-3 gap-3'>
      <Card><h3 className='font-semibold'>✅ 今日已提交</h3><p>{data.submitted?.join('、') || '暂无'}</p></Card>
      <Card><h3 className='font-semibold'>❌ 今日未提交</h3><p className='text-red-600'>{data.notSubmitted?.join('、') || '全员已提交'}</p></Card>
      <Card><h3 className='font-semibold'>📈 提交率趋势</h3><p>今日 {data.rateToday}% / 昨日 {data.rateYesterday}%</p><p className={diff>=0?'text-green-600':'text-red-600'}>{diff>=0?'+':''}{diff}%</p></Card>
    </div>
    <div className='grid grid-cols-2 gap-3'>
      <Card className='h-72'><h3>🏆 客服销售额排行榜</h3><ResponsiveContainer width='100%' height='90%'><BarChart data={data.salesRank}><XAxis dataKey='staff'/><YAxis/><Tooltip/><Bar dataKey='amount' fill='#2563eb' /></BarChart></ResponsiveContainer></Card>
      <Card className='h-72'><h3>🛒 店铺成交额占比</h3><ResponsiveContainer width='100%' height='90%'><PieChart><Pie data={data.shopShare} dataKey='amount' nameKey='shop'>{['#3b82f6','#22c55e','#f59e0b','#ef4444','#8b5cf6'].map((c)=><Cell key={c} fill={c}/> )}</Pie></PieChart></ResponsiveContainer></Card>
    </div>
  </div>;
}
