'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui';
import { cn } from '@/lib/utils';
import { loadPackages } from '@/lib/daily-work-package/storage';
import { loadSopTemplates, loadSopProgress } from '@/lib/shift-sop/storage';
import { loadSopDailyOverrides } from '@/lib/shift-sop/daily-override-storage';
import { getEffectiveSopShift } from '@/lib/shift-sop/effective-shift';
import { sopRequiredCompletion } from '@/lib/supervisor-workforce/sop-metrics';
import { computeDailyRequired } from '@/lib/daily-required/compute';
import { loadAssignedTasks, tasksForStaffAndDate, getDisplayTaskStatus } from '@/lib/assigned-tasks/storage';
import { loadDailyInquiryReports, loadDouyinLeadFollowRecords, loadLeadConversionSettings, loadLeadFollowRecords } from '@/lib/lead-follow-hub/storage';
import { isValidLead, leadRate } from '@/lib/lead-follow-hub/stats';

export type WorkforceRow = {
  staffName: string;
  shiftLabel: string;
  sopModule: string;
  sopRatePct: number;
  assignedSummary: string;
  dailyReqSummary: string;
  leadCount: number;
  inquiry: number;
  leadRatePct: number;
  dyPending: number;
  statusTone: 'green' | 'yellow' | 'red';
};

export type WorkforceAggregate = {
  onlineStaff: number;
  sopAvgPct: number;
  tempTaskCompletionPct: number;
  dailyReqCompletionPct: number;
  overdueAssigned: number;
  douyinUncalled: number;
};

/** 主管看板「今日总览」：基于 roster 与业务日聚合（不含 KPI 卡片）。 */
export function aggregateWorkforceMetrics(date: string, roster: string[], now = new Date()): WorkforceAggregate {
  const rows = buildWorkforceRows(date, roster);
  const assigned = loadAssignedTasks().filter((t) => t.date === date && roster.includes(t.assignedTo));
  let closed = 0;
  let overdue = 0;
  for (const t of assigned) {
    const s = getDisplayTaskStatus(t, now);
    if (s === 'overdue') overdue++;
    if (s === 'done' || s === 'pending_review') closed++;
  }
  const tempPct = assigned.length ? Math.round((closed / assigned.length) * 1000) / 10 : 100;

  let drNum = 0;
  let drDen = 0;
  for (const name of roster) {
    const reqs = computeDailyRequired(date, name);
    drDen += reqs.length;
    drNum += reqs.filter((r) => r.done).length;
  }
  const dailyPct = drDen ? Math.round((drNum / drDen) * 1000) / 10 : 100;

  const sopAvgPct = rows.length ? Math.round((rows.reduce((a, r) => a + r.sopRatePct, 0) / rows.length) * 10) / 10 : 0;
  const douyinUncalled = rows.reduce((a, r) => a + r.dyPending, 0);

  return {
    onlineStaff: roster.length,
    sopAvgPct,
    tempTaskCompletionPct: tempPct,
    dailyReqCompletionPct: dailyPct,
    overdueAssigned: overdue,
    douyinUncalled,
  };
}

export function buildWorkforceRows(date: string, roster: string[]): WorkforceRow[] {
  const st = loadLeadConversionSettings();
  const templates = loadSopTemplates();
  const progress = loadSopProgress();
  const overrides = loadSopDailyOverrides();
  const assigned = loadAssignedTasks();
  const pkgs = loadPackages().filter((p) => p.date === date);
  const byStaff = new Map(pkgs.map((p) => [p.employeeName, p]));

  return roster.map((name) => {
    const pkg = byStaff.get(name);
    const wpShift = pkg?.shift === 'night' ? 'night' : 'day';
    const eff = getEffectiveSopShift(date, name, wpShift, overrides);
    const sop = sopRequiredCompletion(templates, progress, date, name, eff);
    const reqs = computeDailyRequired(date, name);
    const reqDone = reqs.filter((r) => r.done).length;
    const mine = tasksForStaffAndDate(assigned, date, name);
    const assignDone = mine.filter((t) => getDisplayTaskStatus(t) === 'done').length;
    const assignOver = mine.filter((t) => getDisplayTaskStatus(t) === 'overdue').length;
    const leads = loadLeadFollowRecords().filter((l) => l.date === date && l.employeeName === name);
    const reps = loadDailyInquiryReports().filter((r) => r.date === date && r.employeeName === name);
    const inquiry = reps.reduce((a, r) => a + Math.max(0, Number(r.inquiryCount) || 0), 0);
    const leadN = leads.filter((l) => isValidLead(l, st)).length;
    const lr = leadRate(inquiry, leadN);
    const dy = loadDouyinLeadFollowRecords().filter((d) => d.date === date && d.employeeName === name);
    const dyP = dy.filter((d) => !d.hasCalled).length;

    let tone: WorkforceRow['statusTone'] = 'green';
    if (assignOver > 0 || dyP > 0 || sop.rate < 0.5) tone = 'red';
    else if (sop.rate < 0.85 || reqDone < reqs.length) tone = 'yellow';

    return {
      staffName: name,
      shiftLabel: eff === 'day' ? '白班' : '晚班',
      sopModule: sop.currentModule ?? '—',
      sopRatePct: Math.round(sop.rate * 1000) / 10,
      assignedSummary: mine.length ? `${assignDone}/${mine.length} 完成${assignOver ? ` · ${assignOver}逾期` : ''}` : '—',
      dailyReqSummary: `${reqDone}/${reqs.length} 项就绪`,
      leadCount: leadN,
      inquiry,
      leadRatePct: Math.round(lr * 1000) / 10,
      dyPending: dyP,
      statusTone: tone,
    };
  });
}

export function SupervisorWorkforceTable({ date, roster }: { date: string; roster: string[] }) {
  const rows = useMemo(() => (roster.length ? buildWorkforceRows(date, roster) : []), [date, roster]);

  return (
    <Card className="border border-ash p-4">
      <h3 className="font-display text-base font-semibold text-coal-ink">人员进度（SOP / 临时任务 / 结班项）</h3>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-[1100px] w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-ash bg-ash/40 text-left text-xs text-graphite">
              {['客服', '班次', '当前SOP模块', 'SOP完成率', '临时任务', '结班必交', '留资数', '咨询量', '留资率%', '抖音未电联', '状态'].map((h) => (
                <th key={h} className="px-2 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.staffName} className="border-b border-ash/80">
                <td className="px-2 py-1 font-medium">
                  <Link href={`/dashboard/tasks`} className="text-sky-800 underline">
                    {r.staffName}
                  </Link>
                </td>
                <td className="px-2 py-1">{r.shiftLabel}</td>
                <td className="px-2 py-1 max-w-[180px] truncate">{r.sopModule}</td>
                <td className="px-2 py-1">{r.sopRatePct}%</td>
                <td className="px-2 py-1 text-xs">{r.assignedSummary}</td>
                <td className="px-2 py-1 text-xs">{r.dailyReqSummary}</td>
                <td className="px-2 py-1">{r.leadCount}</td>
                <td className="px-2 py-1">{r.inquiry}</td>
                <td className="px-2 py-1">{r.leadRatePct}%</td>
                <td className="px-2 py-1">{r.dyPending}</td>
                <td className="px-2 py-1">
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-medium',
                      r.statusTone === 'green' ? 'bg-emerald-100 text-emerald-900' : undefined,
                      r.statusTone === 'yellow' ? 'bg-amber-100 text-amber-900' : undefined,
                      r.statusTone === 'red' ? 'bg-red-100 text-red-900' : undefined,
                    )}
                  >
                    {r.statusTone === 'green' ? '正常' : r.statusTone === 'yellow' ? '关注' : '异常'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
