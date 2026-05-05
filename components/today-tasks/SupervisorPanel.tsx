'use client';

import { useMemo } from 'react';
import type { TodayTaskState } from '@/lib/today-tasks/types';
import {
  buildInstances,
  computeWorkflowStatus,
  hasAttachmentCredentials,
  isFullyClosed,
  isSatisfied,
  mergeCompletion,
  PRI_ORDER,
} from '@/lib/today-tasks/engine';
import { TaskAttachmentsPreview } from './TaskCredentialsEditor';
import { WorkflowStatusBadge } from '@/components/workflow-status-badge';

export function SupervisorPanel({
  data,
  setData,
  date,
}: {
  data: TodayTaskState;
  setData: React.Dispatch<React.SetStateAction<TodayTaskState>>;
  date: string;
}) {
  const instances = useMemo(() => buildInstances(data, date), [data, date]);

  const stats = useMemo(() => {
    const now = new Date();
    let closed = 0;
    let overdue = 0;
    let p0open = 0;
    for (const inst of instances) {
      if (isFullyClosed(inst)) {
        closed++;
        continue;
      }
      const wf = computeWorkflowStatus(inst, now);
      if (wf === 'overdue') overdue++;
      if (inst.priority === 'P0' && !isFullyClosed(inst)) p0open++;
    }
    const total = instances.length;
    const open = total - closed;
    const rate = total ? Math.round((closed / total) * 100) : 0;
    return { total, closed, open, overdue, p0open, rate };
  }, [instances]);

  const p0OverdueList = useMemo(() => {
    const now = new Date();
    return instances.filter((i) => {
      if (i.priority !== 'P0') return false;
      if (isFullyClosed(i)) return false;
      return computeWorkflowStatus(i, now) === 'overdue';
    });
  }, [instances]);

  const pendingReviews = useMemo(() => {
    return instances.filter(
      (i) =>
        i.requiresSupervisorReview &&
        isSatisfied(i.completionMode, i.completion, i.quantityTarget) &&
        (i.completion.reviewState === 'pending' || !i.completion.reviewState),
    );
  }, [instances]);

  const byStaff = useMemo(() => {
    const m = new Map<string, typeof instances>();
    for (const i of instances) {
      if (!m.has(i.staffName)) m.set(i.staffName, []);
      m.get(i.staffName)!.push(i);
    }
    return m;
  }, [instances]);

  const setReview = (instanceKey: string, reviewState: 'approved' | 'rejected') => {
    setData((s) =>
      mergeCompletion(s, instanceKey, {
        reviewState,
      }),
    );
  };

  return (
    <div className="space-y-4">
      {p0OverdueList.length > 0 ? (
        <div className="rounded-[10px] border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
          <strong>P0 逾期预警：</strong>
          {p0OverdueList.map((i) => `${i.staffName}「${i.title}」`).join('；')}
        </div>
      ) : null}

      {pendingReviews.length > 0 ? (
        <div className="rounded-[10px] border border-amber-200 bg-amber-50 px-4 py-3">
          <h4 className="text-sm font-semibold text-amber-950">待审核任务（{pendingReviews.length}）</h4>
          <ul className="mt-2 space-y-2 text-sm text-graphite">
            {pendingReviews.map((i) => (
              <li key={i.instanceKey} className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/60 pb-2 last:border-0">
                <span>
                  <strong className="text-coal-ink">{i.staffName}</strong> · {i.title}
                </span>
                <span className="flex gap-2">
                  <button type="button" className="btn-secondary text-xs" onClick={() => setReview(i.instanceKey, 'approved')}>
                    通过
                  </button>
                  <button type="button" className="rounded-full border border-red-300 px-3 py-1 text-xs text-red-800" onClick={() => setReview(i.instanceKey, 'rejected')}>
                    驳回
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['今日任务数', stats.total, 'text-coal-ink'],
          ['已闭环', stats.closed, 'text-emerald-700'],
          ['未闭环', stats.open, 'text-stone'],
          ['逾期', stats.overdue, 'text-red-600'],
          ['P0 未闭环', stats.p0open, 'text-red-700'],
          ['闭环率', `${stats.rate}%`, 'text-sky-800'],
        ].map(([k, v, c]) => (
          <div key={String(k)} className="rounded-[10px] border border-ash bg-elevated px-4 py-3 shadow-subtle">
            <div className="text-xs text-stone">{k}</div>
            <div className={`mt-1 font-display text-2xl font-bold tabular-nums ${c}`}>{v}</div>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {[...byStaff.entries()]
          .sort((a, b) => a[0].localeCompare(b[0], 'zh-CN'))
          .map(([name, list]) => (
            <div key={name} className="rounded-[10px] border border-ash bg-white p-3">
              <h4 className="font-semibold text-coal-ink">{name}</h4>
              <ul className="mt-2 space-y-1 text-sm">
                {list
                  .sort((a, b) => (PRI_ORDER[a.priority] ?? 9) - (PRI_ORDER[b.priority] ?? 9) || a.startTime.localeCompare(b.startTime))
                  .map((i) => {
                    const wf = computeWorkflowStatus(i, new Date());
                    const note = i.completion.screenshotNote?.trim();
                    const hasAtt = hasAttachmentCredentials(i.completion);
                    return (
                      <li key={i.instanceKey} className="border-b border-ash/60 py-2 last:border-0">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span>
                            {i.title}{' '}
                            <span className="text-stone">
                              {i.startTime}-{i.endTime} {i.priority}
                            </span>
                            {hasAtt || note ? (
                              <span className="ml-2 rounded bg-ash px-1.5 py-0.5 text-[10px] text-graphite">
                                {hasAtt ? '有凭证' : ''}
                                {hasAtt && note ? ' · ' : ''}
                                {note ? '有备注' : ''}
                              </span>
                            ) : null}
                          </span>
                          <WorkflowStatusBadge status={wf} size="sm" />
                        </div>
                        {note ? (
                          <p className="mt-1 whitespace-pre-wrap break-words pl-0 text-xs text-slate-mid">{i.completion.screenshotNote}</p>
                        ) : null}
                        {i.completion.dailyReportSummary?.trim() ? (
                          <p className="mt-1 whitespace-pre-wrap break-words text-xs text-slate-mid">
                            <span className="font-medium text-graphite">日报：</span>
                            {i.completion.dailyReportSummary}
                          </p>
                        ) : null}
                        <TaskAttachmentsPreview attachments={i.completion.attachments} />
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
      </div>
    </div>
  );
}
