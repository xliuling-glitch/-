'use client';

import { useEffect, useState } from 'react';
import { Card, Badge } from '@/components/ui';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import Link from 'next/link';
import { DashboardSalesBoard } from '@/components/dashboard-sales-board';
import { DashboardAdminAnalytics } from '@/components/dashboard-admin-analytics';
import { formatAmountYuan } from '@/lib/format-amount';

const modules = [
  { title: '今日任务中心', href: '/dashboard/tasks', icon: '📋', desc: '生成、查看和完成任务' },
  { title: 'KPI每日上传中心', href: '/dashboard/kpi-daily', icon: '📤', desc: '日报表单、审核与任务联动' },
  { title: '主管数据看板', href: '/dashboard/supervisor-board', icon: '📈', desc: '任务与KPI聚合、关注清单' },
  { title: '客户管理', href: '/dashboard/customers', icon: '👥', desc: '客户列表与详情' },
  { title: '客户跟进', href: '/dashboard/followups', icon: '📝', desc: '跟进记录管理' },
  { title: '电联管理', href: '/dashboard/calls', icon: '📞', desc: '通话记录与统计' },
  { title: '询单转化', href: '/dashboard/conversions', icon: '💰', desc: '询单转化数据分析' },
  { title: 'KPI绩效', href: '/dashboard/kpi', icon: '📊', desc: 'KPI记录与考核' },
  { title: '老客复购', href: '/dashboard/repurchase', icon: '🔄', desc: '复购提醒与追踪' },
  { title: '评价管理中心', href: '/dashboard/reviews', icon: '⭐', desc: '多店铺产品评价任务与审核' },
  { title: '朋友圈/视频号', href: '/dashboard/social', icon: '📱', desc: '社交平台运营' },
  { title: '问题复盘', href: '/dashboard/problems', icon: '🔍', desc: '每日自我反思与明日计划' },
  { title: 'AI运用反馈', href: '/dashboard/scripts', icon: '🤖', desc: '品类询单、成交与 AI 使用登记' },
  { title: '排班管理', href: '/dashboard/schedules', icon: '📅', desc: '班次排班设置' },
  { title: '用户管理', href: '/dashboard/users', icon: '👤', desc: '用户增删改查' },
];

const pieSpectrum = ['#10b981', '#a855f7', '#f59e0b', '#777eff', '#1c1a17'];

export default function Home() {
  const today = new Date().toISOString().slice(0, 10);
  const [summary, setSummary] = useState({ taskCount: 0, callCount: 0, customerCount: 0, avgKpi: 0 });
  const [warnings, setWarnings] = useState<any[]>([]);
  const [data, setData] = useState<any>({
    salesRank: [],
    shopShare: [],
    lostTop: [],
    inquiryTop: [],
    submitted: [],
    notSubmitted: [],
    rateToday: 0,
    rateYesterday: 0,
  });

  useEffect(() => {
    fetch('/api/dashboard/summary')
      .then((r) => r.json())
      .then(setSummary)
      .catch(() => {});
    fetch('/api/warnings')
      .then((r) => r.json())
      .then(setWarnings)
      .catch(() => {});
    fetch(`/api/dashboard/py-metrics?date=${today}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  const diff = (data.rateToday || 0) - (data.rateYesterday || 0);

  const warningClass = (level: string) => {
    if (level === 'red') return 'border border-smolder/25 bg-smolder/10 text-coal-ink';
    if (level === 'yellow') return 'border border-amber-200/80 bg-amber-50 text-graphite';
    return 'border border-emerald-tag/25 bg-emerald-tag/10 text-mint-pulse';
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="relative overflow-hidden border-0 bg-[radial-gradient(81%_66%_at_1.8%_1.1%,#545454_0%,#1c1a17_100%)] p-6 text-white shadow-subtle">
          <div className="text-sm text-white/70">今日任务数</div>
          <div className="font-display mt-1 text-4xl font-bold tracking-tight">{summary.taskCount}</div>
        </Card>
        <Card>
          <div className="text-sm text-slate-mid">今日电联数</div>
          <div className="font-display mt-1 text-4xl font-bold tracking-tight text-coal-ink">{summary.callCount}</div>
        </Card>
        <Card>
          <div className="text-sm text-slate-mid">客户总数</div>
          <div className="font-display mt-1 text-4xl font-bold tracking-tight text-coal-ink">{summary.customerCount}</div>
        </Card>
        <Card>
          <div className="text-sm text-slate-mid">平均 KPI</div>
          <div className="font-display mt-1 text-4xl font-bold tracking-tight text-coal-ink">{summary.avgKpi}</div>
        </Card>
      </div>

      <DashboardAdminAnalytics />

      <DashboardSalesBoard />

      <div className="grid gap-3 md:grid-cols-3">
        <Card elevated>
          <h3 className="font-display text-base font-bold text-coal-ink">今日已提交</h3>
          <p className="mt-2 text-sm leading-relaxed text-graphite">{data.submitted?.join('、') || '暂无'}</p>
        </Card>
        <Card elevated>
          <h3 className="font-display text-base font-bold text-coal-ink">今日未提交</h3>
          <p className="mt-2 text-sm leading-relaxed text-smolder">{data.notSubmitted?.join('、') || '全员已提交'}</p>
        </Card>
        <Card elevated>
          <h3 className="font-display text-base font-bold text-coal-ink">提交率趋势</h3>
          <p className="mt-2 text-sm text-graphite">
            今日 {data.rateToday}% / 昨日 {data.rateYesterday}%
          </p>
          <p className={`mt-1 font-semibold ${diff >= 0 ? 'text-mint-pulse' : 'text-smolder'}`}>
            {diff >= 0 ? '+' : ''}
            {diff}%
          </p>
        </Card>
      </div>

      <Card elevated>
        <h3 className="font-display text-base font-bold text-coal-ink">异常预警</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {warnings.map((w, i) => (
            <Badge key={i} color={warningClass(w.level)} text={`${w.type}: ${w.value}`} />
          ))}
          {warnings.length === 0 ? <span className="text-sm text-stone">暂无预警</span> : null}
        </div>
      </Card>

      {data.salesRank?.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <Card elevated className="h-72">
            <h3 className="font-display mb-3 text-base font-bold text-coal-ink">客服销售额排行榜</h3>
            <ResponsiveContainer width="100%" height="86%">
              <BarChart data={data.salesRank}>
                <XAxis dataKey="staff" tick={{ fill: '#5a5957', fontSize: 12 }} />
                <YAxis tick={{ fill: '#5a5957', fontSize: 12 }} tickFormatter={(v) => formatAmountYuan(Number(v), 0)} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 10,
                    border: '1px solid #f1f1f1',
                    fontSize: 13,
                  }}
                  formatter={(value: number) => [formatAmountYuan(value), '销售额']}
                />
                <Bar dataKey="amount" fill="#05933b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <Card elevated className="h-72">
            <h3 className="font-display mb-3 text-base font-bold text-coal-ink">店铺成交额占比</h3>
            <ResponsiveContainer width="100%" height="86%">
              <PieChart>
                <Pie data={data.shopShare} dataKey="amount" nameKey="shop">
                  {data.shopShare?.map((_: unknown, i: number) => (
                    <Cell key={i} fill={pieSpectrum[i % pieSpectrum.length]} stroke="#fafafa" strokeWidth={1} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: 10,
                    border: '1px solid #f1f1f1',
                    fontSize: 13,
                  }}
                  formatter={(value: number) => formatAmountYuan(value)}
                />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>
      ) : null}

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <h3 className="font-display text-heading-sm font-bold tracking-tight text-coal-ink">功能模块</h3>
          <div
            className="hidden h-2 flex-1 max-w-xs rounded-full md:block"
            style={{
              background: 'linear-gradient(90deg, #10b981 0%, #a855f7 50%, #f59e0b 100%)',
              opacity: 0.35,
            }}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {modules.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="group block rounded-card border border-ash bg-elevated p-4 shadow-[rgba(95,99,106,0.08)_0px_0px_0px_1px] transition hover:border-fossil hover:shadow-subtle"
            >
              <div className="text-3xl">{m.icon}</div>
              <div className="mt-2 font-display text-[15px] font-bold text-coal-ink group-hover:underline decoration-coal-ink/20 underline-offset-4">
                {m.title}
              </div>
              <div className="mt-1 text-xs leading-snug text-graphite">{m.desc}</div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
