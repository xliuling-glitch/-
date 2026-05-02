'use client';
import { useEffect, useState } from 'react';
import { Card, Badge } from '@/components/ui';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import Link from 'next/link';

const modules = [
  { title: '今日任务中心', href: '/dashboard/tasks', icon: '📋', desc: '生成、查看和完成任务' },
  { title: '客户管理', href: '/dashboard/customers', icon: '👥', desc: '客户列表与详情' },
  { title: '客户跟进', href: '/dashboard/followups', icon: '📝', desc: '跟进记录管理' },
  { title: '电联管理', href: '/dashboard/calls', icon: '📞', desc: '通话记录与统计' },
  { title: '询单转化', href: '/dashboard/conversions', icon: '💰', desc: '询单转化数据分析' },
  { title: 'KPI绩效', href: '/dashboard/kpi', icon: '📊', desc: 'KPI记录与考核' },
  { title: '老客复购', href: '/dashboard/repurchase', icon: '🔄', desc: '复购提醒与追踪' },
  { title: '评价管理', href: '/dashboard/reviews', icon: '⭐', desc: '客户评价处理' },
  { title: '朋友圈/视频号', href: '/dashboard/social', icon: '📱', desc: '社交平台运营' },
  { title: '竞品假聊', href: '/dashboard/competitors', icon: '🕵️', desc: '竞品情报收集' },
  { title: '问题复盘', href: '/dashboard/problems', icon: '🔍', desc: '问题回顾与总结' },
  { title: '话术素材库', href: '/dashboard/scripts', icon: '💬', desc: '标准话术管理' },
  { title: '排班管理', href: '/dashboard/schedules', icon: '📅', desc: '班次排班设置' },
  { title: '任务规则', href: '/dashboard/task-rules', icon: '⚙️', desc: '任务生成规则' },
  { title: '用户管理', href: '/dashboard/users', icon: '👤', desc: '用户增删改查' },
];

export default function Home() {
  const today = new Date().toISOString().slice(0, 10);
  const [summary, setSummary] = useState({ taskCount: 0, callCount: 0, customerCount: 0, avgKpi: 0 });
  const [warnings, setWarnings] = useState<any[]>([]);
  const [data, setData] = useState<any>({ salesRank: [], shopShare: [], lostTop: [], inquiryTop: [], submitted: [], notSubmitted: [], rateToday: 0, rateYesterday: 0 });

  useEffect(() => {
    fetch('/api/dashboard/summary').then(r => r.json()).then(setSummary).catch(() => {});
    fetch('/api/warnings').then(r => r.json()).then(setWarnings).catch(() => {});
    fetch(`/api/dashboard/py-metrics?date=${today}`).then(r => r.json()).then(setData).catch(() => {});
  }, []);

  const diff = (data.rateToday || 0) - (data.rateYesterday || 0);

  return (
    <div className='space-y-4'>
      {/* Summary cards */}
      <div className='grid grid-cols-4 gap-3'>
        <Card>
          <div className='text-sm text-gray-500'>今日任务数</div>
          <div className='text-2xl font-bold mt-1'>{summary.taskCount}</div>
        </Card>
        <Card>
          <div className='text-sm text-gray-500'>今日电联数</div>
          <div className='text-2xl font-bold mt-1'>{summary.callCount}</div>
        </Card>
        <Card>
          <div className='text-sm text-gray-500'>客户总数</div>
          <div className='text-2xl font-bold mt-1'>{summary.customerCount}</div>
        </Card>
        <Card>
          <div className='text-sm text-gray-500'>平均KPI</div>
          <div className='text-2xl font-bold mt-1'>{summary.avgKpi}</div>
        </Card>
      </div>

      {/* Submission status */}
      <div className='grid grid-cols-3 gap-3'>
        <Card><h3 className='font-semibold'>今日已提交</h3><p className='mt-1 text-sm text-gray-600'>{data.submitted?.join('、') || '暂无'}</p></Card>
        <Card><h3 className='font-semibold'>今日未提交</h3><p className='mt-1 text-sm text-red-600'>{data.notSubmitted?.join('、') || '全员已提交'}</p></Card>
        <Card>
          <h3 className='font-semibold'>提交率趋势</h3>
          <p className='mt-1 text-sm'>今日 {data.rateToday}% / 昨日 {data.rateYesterday}%</p>
          <p className={diff >= 0 ? 'text-green-600' : 'text-red-600'}>{diff >= 0 ? '+' : ''}{diff}%</p>
        </Card>
      </div>

      {/* Warnings */}
      <Card>
        <h3 className='font-semibold mb-2'>异常预警</h3>
        <div className='flex gap-2 flex-wrap'>
          {warnings.map((w, i) => (
            <Badge key={i}
              color={w.level === 'red' ? 'bg-red-100 text-red-700' : w.level === 'yellow' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}
              text={`${w.type}: ${w.value}`}
            />
          ))}
          {warnings.length === 0 && <span className='text-gray-400 text-sm'>暂无预警</span>}
        </div>
      </Card>

      {/* Charts */}
      {data.salesRank?.length > 0 && (
        <div className='grid grid-cols-2 gap-3'>
          <Card className='h-72'><h3 className='font-semibold mb-2'>客服销售额排行榜</h3><ResponsiveContainer width='100%' height='90%'><BarChart data={data.salesRank}><XAxis dataKey='staff' /><YAxis /><Tooltip /><Bar dataKey='amount' fill='#2563eb' /></BarChart></ResponsiveContainer></Card>
          <Card className='h-72'><h3 className='font-semibold mb-2'>店铺成交额占比</h3><ResponsiveContainer width='100%' height='90%'><PieChart><Pie data={data.shopShare} dataKey='amount' nameKey='shop'>{['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'].map((c) => <Cell key={c} fill={c} />)}</Pie></PieChart></ResponsiveContainer></Card>
        </div>
      )}

      {/* Module navigation grid */}
      <div>
        <h3 className='font-semibold text-lg mb-3'>功能模块</h3>
        <div className='grid grid-cols-5 gap-3'>
          {modules.map(m => (
            <Link key={m.href} href={m.href}
              className='bg-white border rounded-xl p-4 hover:border-blue-400 hover:shadow-md transition-all group block'
            >
              <div className='text-3xl mb-2'>{m.icon}</div>
              <div className='font-semibold text-gray-800 group-hover:text-blue-600'>{m.title}</div>
              <div className='text-xs text-gray-400 mt-1'>{m.desc}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
