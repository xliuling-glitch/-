'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReviewSubmission } from '@/lib/review-hub/types';
import { getCurrentStaffName, setCurrentStaffName } from '@/lib/review-hub/storage';
import { useOptionsShops, useReviewHub } from '@/components/review-hub/useReviewHub';

export default function MyReviewTasksPage() {
  const { data, setData, hydrated } = useReviewHub();
  const { shops, staffRoster, loaded } = useOptionsShops();
  const [staff, setStaff] = useState('');
  const [taskId, setTaskId] = useState('');
  const [orderNo, setOrderNo] = useState('');
  const [buyerId, setBuyerId] = useState('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!staffRoster.length) return;
    const saved = getCurrentStaffName();
    if (saved && staffRoster.includes(saved)) {
      setStaff(saved);
      return;
    }
    const first = staffRoster[0];
    setStaff(first);
    setCurrentStaffName(first);
  }, [staffRoster]);

  const myTasks = useMemo(() => {
    if (!staff) return [];
    return data.assignments.filter((a) => a.assignees.includes(staff));
  }, [data.assignments, staff]);

  const selectedTask = useMemo(() => data.assignments.find((a) => a.id === taskId), [data.assignments, taskId]);

  const mySubmissions = useMemo(() => {
    if (!staff) return [];
    return data.submissions.filter((s) => s.staff === staff).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [data.submissions, staff]);

  const countForTask = (tid: string) => data.submissions.filter((s) => s.taskId === tid).length;

  const submit = () => {
    setMsg('');
    if (!staff) {
      setMsg('请先选择当前客服身份');
      return;
    }
    if (!taskId) {
      setMsg('请选择任务');
      return;
    }
    if (!orderNo.trim()) {
      setMsg('请填写订单号');
      return;
    }
    const t = data.assignments.find((x) => x.id === taskId);
    if (!t) return;
    const sub: ReviewSubmission = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      taskId,
      shop: t.shop,
      title: t.title,
      staff,
      orderNo: orderNo.trim(),
      buyerId: buyerId.trim(),
      note: note.trim(),
      createdAt: new Date().toISOString(),
    };
    setData((d) => ({ ...d, submissions: [sub, ...d.submissions] }));
    setOrderNo('');
    setBuyerId('');
    setNote('');
    setMsg('已提交一条反馈');
  };

  const pickStaff = (name: string) => {
    setStaff(name);
    setCurrentStaffName(name);
    setTaskId('');
  };

  if (!hydrated || !loaded) {
    return <p className="text-sm text-slate-mid">加载中…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[10px] border border-ash bg-elevated p-4 shadow-subtle">
        <label className="text-sm font-medium text-coal-ink">
          当前客服（用于筛选分配给自己的任务）
          <select
            className="input-field mt-2 block max-w-xs"
            value={staff}
            onChange={(e) => pickStaff(e.target.value)}
          >
            <option value="">请选择</option>
            {staffRoster.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <p className="mt-2 text-xs text-slate-mid">名单来自系统设置 <code className="rounded bg-ash px-1">/api/options</code> 的 <code className="rounded bg-ash px-1">staff_roster</code>，与后台「选项」配置一致。</p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-coal-ink">分配给我的任务</h3>
        {myTasks.length === 0 ? (
          <p className="mt-2 text-sm text-slate-mid">暂无任务。请主管在「任务分配」中创建并勾选你。</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {myTasks.map((a) => (
              <li key={a.id} className="rounded-lg border border-ash bg-white px-3 py-2 text-sm">
                <span className="font-medium text-coal-ink">{a.title}</span>
                <span className="ml-2 text-graphite">{a.shop}</span>
                <span className="ml-2 tabular-nums text-slate-mid">
                  截止 {a.dueDate} · 目标 {a.targetCount} · 已提交 {countForTask(a.id)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-[10px] border border-ash bg-ledger-white p-4">
        <h3 className="text-sm font-semibold text-coal-ink">提交评价反馈</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-graphite">
            所属任务
            <select className="input-field mt-1 block w-full text-sm" value={taskId} onChange={(e) => setTaskId(e.target.value)}>
              <option value="">请选择</option>
              {myTasks.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.shop} · {a.title}
                </option>
              ))}
            </select>
          </label>
          {selectedTask ? (
            <div className="text-xs text-slate-mid sm:self-end sm:pb-2">
              店铺：<strong className="text-graphite">{selectedTask.shop}</strong>
            </div>
          ) : null}
          <label className="text-xs text-graphite sm:col-span-2">
            订单号 <span className="text-red-600">*</span>
            <input className="input-field mt-1 block w-full text-sm" value={orderNo} onChange={(e) => setOrderNo(e.target.value)} placeholder="平台订单号" />
          </label>
          <label className="text-xs text-graphite">
            客户 ID（旺旺/买家昵称等）
            <input className="input-field mt-1 block w-full text-sm" value={buyerId} onChange={(e) => setBuyerId(e.target.value)} />
          </label>
          <label className="text-xs text-graphite sm:col-span-2">
            备注
            <input className="input-field mt-1 block w-full text-sm" value={note} onChange={(e) => setNote(e.target.value)} placeholder="可选：截图路径说明、评价类型等" />
          </label>
        </div>
        <button type="button" className="btn-primary mt-4 text-sm" onClick={submit}>
          提交记录
        </button>
        {msg ? <p className="mt-2 text-sm text-mint-pulse">{msg}</p> : null}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-coal-ink">我的提交记录</h3>
        {mySubmissions.length === 0 ? (
          <p className="mt-2 text-sm text-slate-mid">暂无</p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-[10px] border border-ash bg-white">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-ash bg-parchment/50 text-left text-graphite">
                  <th className="px-2 py-2">时间</th>
                  <th className="px-2 py-2">任务</th>
                  <th className="px-2 py-2">店铺</th>
                  <th className="px-2 py-2">订单号</th>
                  <th className="px-2 py-2">客户ID</th>
                </tr>
              </thead>
              <tbody>
                {mySubmissions.map((s) => (
                  <tr key={s.id} className="border-b border-ash/70">
                    <td className="px-2 py-2 tabular-nums text-stone">{new Date(s.createdAt).toLocaleString('zh-CN')}</td>
                    <td className="px-2 py-2">{s.title}</td>
                    <td className="px-2 py-2">{s.shop}</td>
                    <td className="px-2 py-2">{s.orderNo}</td>
                    <td className="px-2 py-2">{s.buyerId || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
