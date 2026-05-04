'use client';

import { useMemo, useState } from 'react';
import type { ReviewAssignment } from '@/lib/review-hub/types';
import { useOptionsShops, useReviewHub } from '@/components/review-hub/useReviewHub';

export default function ReviewAssignmentsPage() {
  const { data, setData, hydrated } = useReviewHub();
  const { shops, staffRoster, loaded } = useOptionsShops();
  const [shop, setShop] = useState('');
  const [title, setTitle] = useState('');
  const [targetCount, setTargetCount] = useState(5);
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [pick, setPick] = useState<Record<string, boolean>>({});

  const toggleStaff = (name: string) => {
    setPick((p) => ({ ...p, [name]: !p[name] }));
  };

  const createTask = () => {
    if (!shop || !title.trim()) return;
    const assignees = staffRoster.filter((n) => pick[n]);
    if (assignees.length === 0) return;
    const a: ReviewAssignment = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      shop,
      title: title.trim(),
      targetCount: Math.max(0, targetCount),
      dueDate,
      assignees,
      createdAt: new Date().toISOString(),
    };
    setData((d) => ({ ...d, assignments: [a, ...d.assignments] }));
    setTitle('');
    setPick({});
  };

  const remove = (id: string) => {
    setData((d) => ({
      ...d,
      assignments: d.assignments.filter((x) => x.id !== id),
      submissions: d.submissions.filter((s) => s.taskId !== id),
    }));
  };

  const pickCount = useMemo(() => staffRoster.filter((n) => pick[n]).length, [pick, staffRoster]);

  if (!hydrated || !loaded) return <p className="text-sm text-slate-mid">加载中…</p>;

  return (
    <div className="space-y-6">
      <div className="rounded-[10px] border border-ash bg-elevated p-4 shadow-subtle">
        <h3 className="text-sm font-semibold text-coal-ink">新建任务</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-graphite">
            店铺（与后台同步）
            <select className="input-field mt-1 block w-full text-sm" value={shop} onChange={(e) => setShop(e.target.value)}>
              <option value="">请选择</option>
              {shops.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-graphite">
            任务名称
            <input className="input-field mt-1 block w-full text-sm" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="如：新品首评、月度追评" />
          </label>
          <label className="text-xs text-graphite">
            目标条数
            <input
              type="number"
              min={1}
              className="input-field mt-1 block w-full text-sm"
              value={targetCount}
              onChange={(e) => setTargetCount(Number(e.target.value))}
            />
          </label>
          <label className="text-xs text-graphite">
            截止日期
            <input type="date" className="input-field mt-1 block w-full text-sm" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
        </div>
        <div className="mt-3">
          <span className="text-xs font-medium text-graphite">分配给（多选）</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {staffRoster.map((n) => (
              <label key={n} className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-ash bg-white px-3 py-1.5 text-sm">
                <input type="checkbox" checked={!!pick[n]} onChange={() => toggleStaff(n)} />
                {n}
              </label>
            ))}
          </div>
          {staffRoster.length === 0 ? <p className="mt-2 text-xs text-amber-800">后台未配置 staff_roster</p> : null}
        </div>
        <button
          type="button"
          className="btn-primary mt-4 text-sm"
          disabled={!shop || !title.trim() || pickCount === 0}
          onClick={createTask}
        >
          创建任务
        </button>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-coal-ink">已创建任务</h3>
        {data.assignments.length === 0 ? (
          <p className="mt-2 text-sm text-slate-mid">暂无</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {data.assignments.map((a) => (
              <li key={a.id} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-ash bg-white px-3 py-2 text-sm">
                <div>
                  <span className="font-medium text-coal-ink">{a.title}</span>
                  <span className="ml-2 text-graphite">{a.shop}</span>
                  <p className="mt-1 text-xs text-slate-mid">
                    截止 {a.dueDate} · 目标 {a.targetCount} 条 · 指派：{a.assignees.join('、')}
                  </p>
                </div>
                <button type="button" className="shrink-0 text-xs text-red-600 hover:underline" onClick={() => remove(a.id)}>
                  删除
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
