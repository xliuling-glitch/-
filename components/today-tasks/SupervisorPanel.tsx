'use client';

import { useMemo } from 'react';
import type { TodayTaskState } from '@/lib/today-tasks/types';
import { buildInstances, computeStatus, hasAttachmentCredentials, isSatisfied, PRI_ORDER } from '@/lib/today-tasks/engine';
import { TaskAttachmentsPreview } from './TaskCredentialsEditor';

export function SupervisorPanel({ data, date }: { data: TodayTaskState; date: string }) {
  const instances = useMemo(() => buildInstances(data, date), [data, date]);

  const stats = useMemo(() => {
    const now = new Date();
    let done = 0;
    let overdue = 0;
    let p0open = 0;
    for (const inst of instances) {
      const sat = isSatisfied(inst.completionMode, inst.completion, inst.quantityTarget);
      if (sat) {
        done++;
        continue;
      }
      const st = computeStatus(inst, now);
      if (st === 'overdue') overdue++;
      if (inst.priority === 'P0' && !sat) p0open++;
    }
    const total = instances.length;
    const pending = total - done;
    const rate = total ? Math.round((done / total) * 100) : 0;
    return { total, done, pending, overdue, p0open, rate };
  }, [instances]);

  const p0OverdueList = useMemo(() => {
    const now = new Date();
    return instances.filter((i) => {
      if (i.priority !== 'P0') return false;
      if (isSatisfied(i.completionMode, i.completion, i.quantityTarget)) return false;
      return computeStatus(i, now) === 'overdue';
    });
  }, [instances]);

  const byStaff = useMemo(() => {
    const m = new Map<string, typeof instances>();
    for (const i of instances) {
      if (!m.has(i.staffName)) m.set(i.staffName, []);
      m.get(i.staffName)!.push(i);
    }
    return m;
  }, [instances]);

  return (
    <div className="space-y-4">
      {p0OverdueList.length > 0 ? (
        <div className="rounded-[10px] border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
          <strong>P0 逾期预警：</strong>
          {p0OverdueList.map((i) => `${i.staffName}「${i.title}」`).join('；')}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['今日任务数', stats.total],
          ['已完成', stats.done],
          ['未完成', stats.pending],
          ['逾期', stats.overdue],
          ['P0 未完成', stats.p0open],
          ['完成率', `${stats.rate}%`],
        ].map(([k, v]) => (
          <div key={String(k)} className="rounded-[10px] border border-ash bg-elevated px-4 py-3 shadow-subtle">
            <div className="text-xs text-stone">{k}</div>
            <div className="mt-1 font-display text-2xl font-bold tabular-nums text-coal-ink">{v}</div>
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
                    const sat = isSatisfied(i.completionMode, i.completion, i.quantityTarget);
                    const st = sat ? 'done' : computeStatus(i, new Date());
                    const note = i.completion.screenshotNote?.trim();
                    const hasAtt = hasAttachmentCredentials(i.completion);
                    return (
                      <li key={i.instanceKey} className="border-b border-ash/60 py-2 last:border-0">
                        <div className="flex flex-wrap justify-between gap-2">
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
                          <span className={st === 'done' ? 'text-mint-pulse' : st === 'overdue' ? 'text-red-600' : 'text-amber-700'}>
                            {st === 'done' ? '已完成' : st === 'overdue' ? '逾期' : '待完成'}
                          </span>
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
