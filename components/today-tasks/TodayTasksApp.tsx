'use client';

import { useCallback, useEffect, useState } from 'react';
import { WORKSPACE_STORAGE_UPDATED } from '@/lib/workspace-events';
import { requestNotificationPermission } from './useTaskReminders';
import { DailyWorkPackagePanel } from '@/components/daily-work-package/DailyWorkPackagePanel';
import { LS_TODAY_CENTER_SHIFT } from '@/lib/shift-sop/storage-keys';
import { loadSopProgress, loadSopTemplates, saveSopProgress } from '@/lib/shift-sop/storage';
import { loadSopDailyOverrides } from '@/lib/shift-sop/daily-override-storage';
import { getEffectiveSopShift } from '@/lib/shift-sop/effective-shift';
import { ShiftSopTimelinePanel } from '@/components/shift-sop/ShiftSopTimelinePanel';
import { AssignedTasksCustomerList } from '@/components/assigned-tasks/AssignedTasksCustomerList';
import { loadAssignedTasks, saveAssignedTasks } from '@/lib/assigned-tasks/storage';
import { DailyRequiredSection } from '@/components/today-tasks/DailyRequiredSection';
import { WeeklyReminderStrip } from '@/components/today-tasks/WeeklyReminderStrip';
import { getTaskStaffName, setTaskStaffName } from '@/lib/today-tasks/storage';
import Link from 'next/link';

export function TodayTasksApp() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [staff, setStaff] = useState('');
  const [shift, setShift] = useState('day');
  const [roster, setRoster] = useState<string[]>([]);
  const [noti, setNoti] = useState('');
  const [role, setRole] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [sopTemplates, setSopTemplates] = useState(() => loadSopTemplates());
  const [sopProgress, setSopProgress] = useState(() => loadSopProgress());
  const [sopOverrides, setSopOverrides] = useState(() => loadSopDailyOverrides());
  const [assigned, setAssigned] = useState(() => loadAssignedTasks());
  const [wpOpen, setWpOpen] = useState(false);

  const isPrivileged = role === 'admin' || role === 'manager';
  const isStaffOnly = role === 'service' || role === 'trainee';

  const reloadSop = useCallback(() => {
    setSopTemplates(loadSopTemplates());
    setSopProgress(loadSopProgress());
    setSopOverrides(loadSopDailyOverrides());
    setAssigned(loadAssignedTasks());
  }, []);

  useEffect(() => {
    const fn = () => reloadSop();
    window.addEventListener(WORKSPACE_STORAGE_UPDATED, fn);
    return () => window.removeEventListener(WORKSPACE_STORAGE_UPDATED, fn);
  }, [reloadSop]);

  useEffect(() => {
    fetch('/api/session', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => {
        setRole(j?.user?.role ? String(j.user.role) : null);
        const n = j?.user?.name;
        if (typeof n === 'string' && n.trim()) setUserName(n.trim());
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/options')
      .then((r) => r.json())
      .then((d) => {
        const r0 = Array.isArray(d.staff_roster) ? d.staff_roster : [];
        setRoster(r0);
        const saved = getTaskStaffName();
        if (isStaffOnly && userName) {
          setStaff(userName);
          setTaskStaffName(userName);
        } else if (saved && r0.includes(saved)) {
          setStaff(saved);
        } else if (r0[0]) {
          setStaff(r0[0]);
          setTaskStaffName(r0[0]);
        }
      })
      .catch(() => {});
  }, [isStaffOnly, userName]);

  useEffect(() => {
    if (staff) setTaskStaffName(staff);
  }, [staff]);

  useEffect(() => {
    const s = typeof window !== 'undefined' ? localStorage.getItem(LS_TODAY_CENTER_SHIFT) : null;
    if (s === 'night') setShift('night');
  }, []);

  useEffect(() => {
    if (isStaffOnly && userName) setStaff(userName);
  }, [isStaffOnly, userName]);

  const persistShift = useCallback((s: string) => {
    setShift(s);
    if (typeof window !== 'undefined') localStorage.setItem(LS_TODAY_CENTER_SHIFT, s);
  }, []);

  const effectiveShift = staff ? getEffectiveSopShift(date, staff, shift, sopOverrides) : 'day';

  const enableNoti = async () => {
    const p = await requestNotificationPermission();
    setNoti(p === 'granted' ? '已允许浏览器通知，请保持本页打开以接收提醒。' : '未开启通知，仍可使用页面内状态。');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-slate-mid">
            客服执行页：本班次 SOP 时间轴、主管临时任务、结班必交与本周提醒。模板与派单请在「配置中心」与「SOP执行检查台」完成。
          </p>
          {isPrivileged ? (
            <p className="mt-1 text-xs text-amber-800">
              当前为管理账号预览：可切换客服姓名。派单与全员进度请打开{' '}
              <Link href="/dashboard/supervisor-board" className="font-medium underline">
                主管数据看板
              </Link>
              。
            </p>
          ) : null}
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
        {!isStaffOnly ? (
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
        ) : (
          <div className="text-sm text-graphite">
            当前客服：<span className="font-semibold text-coal-ink">{staff || userName || '…'}</span>
          </div>
        )}
        <p className="text-xs text-stone sm:ml-auto">
          管理功能见 <Link className="underline" href="/dashboard/supervisor-board">SOP检查台</Link> ·{' '}
          <Link className="underline" href="/dashboard/settings">配置中心</Link>
        </p>
      </div>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-base font-semibold text-coal-ink">
            当前班次 SOP 时间轴（{effectiveShift === 'day' ? '白班' : '晚班'}）
          </h2>
          <p className="text-xs text-slate-mid">班次可在下方「每日工作包」内切换；主管当日覆盖以配置为准。</p>
        </div>
        <ShiftSopTimelinePanel
          shiftType={effectiveShift}
          date={date}
          staff={staff}
          templates={sopTemplates}
          progress={sopProgress}
          onProgressChange={(next) => {
            saveSopProgress(next);
            setSopProgress(next);
          }}
        />
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-base font-semibold text-coal-ink">主管临时分配任务</h2>
        <AssignedTasksCustomerList
          date={date}
          staff={staff}
          tasks={assigned}
          onUpdate={(next) => {
            saveAssignedTasks(next);
            setAssigned(next);
          }}
        />
      </section>

      <DailyRequiredSection date={date} staff={staff} />

      <WeeklyReminderStrip date={date} staff={staff} />

      <section className="space-y-2">
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-lg border border-ash bg-ledger-white px-3 py-2 text-left text-sm font-medium text-coal-ink"
          onClick={() => setWpOpen((o) => !o)}
        >
          <span>每日工作包（询单、留资、评价、电联等）</span>
          <span className="text-xs text-graphite">{wpOpen ? '收起' : '展开'}</span>
        </button>
        {wpOpen ? (
          <div className="rounded-lg border border-ash p-2">
            <DailyWorkPackagePanel date={date} staff={staff} shift={shift} onShiftChange={persistShift} />
          </div>
        ) : null}
      </section>
    </div>
  );
}
