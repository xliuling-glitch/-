'use client';

import { useEffect, useMemo, useState } from 'react';
import { getInitialTaskState } from '@/lib/today-tasks/seed';
import { getTaskStaffName, saveTodayTasks, setTaskStaffName } from '@/lib/today-tasks/storage';
import { buildInstances } from '@/lib/today-tasks/engine';
import { cn } from '@/lib/utils';
import { requestNotificationPermission, useTaskReminders } from './useTaskReminders';
import { MyTodayPanel } from './MyTodayPanel';
import { TemplatesPanel } from './TemplatesPanel';
import { AssignmentsPanel } from './AssignmentsPanel';
import { SupervisorPanel } from './SupervisorPanel';
import type { TodayTaskState } from '@/lib/today-tasks/types';

type Tab = 'my' | 'tpl' | 'asg' | 'sup';

const TABS: { id: Tab; label: string }[] = [
  { id: 'my', label: '我的今日' },
  { id: 'tpl', label: '任务模板' },
  { id: 'asg', label: '分配任务' },
  { id: 'sup', label: '主管看板' },
];

export function TodayTasksApp() {
  const [data, setData] = useState<TodayTaskState>(getInitialTaskState);
  const [tab, setTab] = useState<Tab>('my');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [staff, setStaff] = useState('');
  const [roster, setRoster] = useState<string[]>([]);
  const [noti, setNoti] = useState('');

  useEffect(() => {
    saveTodayTasks(data);
  }, [data]);

  useEffect(() => {
    fetch('/api/options')
      .then((r) => r.json())
      .then((d) => {
        const r0 = Array.isArray(d.staff_roster) ? d.staff_roster : [];
        setRoster(r0);
        const saved = getTaskStaffName();
        if (saved && r0.includes(saved)) setStaff(saved);
        else if (r0[0]) {
          setStaff(r0[0]);
          setTaskStaffName(r0[0]);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (staff) setTaskStaffName(staff);
  }, [staff]);

  const myList = useMemo(
    () => buildInstances(data, date).filter((i) => i.staffName === staff),
    [data, date, staff],
  );
  useTaskReminders(myList, tab === 'my');

  const enableNoti = async () => {
    const p = await requestNotificationPermission();
    setNoti(p === 'granted' ? '已允许浏览器通知，请保持本页打开以接收提醒。' : '未开启通知，仍可使用页面内状态。');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-slate-mid">售前团队每日待办、时段、优先级与完成凭证（数据存本机，详见 docs/TODAY-TASK-CENTER-PRD.md）。</p>
        </div>
        <button type="button" className="btn-ghost self-start text-sm" onClick={() => void enableNoti()}>
          开启浏览器提醒
        </button>
      </div>
      {noti ? <p className="text-xs text-mint-pulse">{noti}</p> : null}

      <div className="flex flex-wrap items-end gap-3 rounded-[10px] border border-ash bg-ledger-white p-3">
        <label className="text-xs text-graphite">
          业务日
          <input type="date" className="input-field mt-1 block text-sm" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="text-xs text-graphite">
          当前客服
          <select className="input-field mt-1 block min-w-[8rem] text-sm" value={staff} onChange={(e) => setStaff(e.target.value)}>
            <option value="">请选择</option>
            {roster.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-stone sm:ml-auto">客服名单与后台 <code className="rounded bg-ash px-1">staff_roster</code> 同步</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'rounded-full px-4 py-2 text-sm font-medium transition',
              tab === t.id ? 'bg-coal-ink text-white' : 'bg-ash/80 text-graphite hover:bg-ash',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="min-h-[320px]">
        {tab === 'my' && <MyTodayPanel data={data} setData={setData} date={date} staff={staff} />}
        {tab === 'tpl' && <TemplatesPanel data={data} setData={setData} />}
        {tab === 'asg' && <AssignmentsPanel data={data} setData={setData} roster={roster} />}
        {tab === 'sup' && <SupervisorPanel data={data} date={date} />}
      </div>
    </div>
  );
}
