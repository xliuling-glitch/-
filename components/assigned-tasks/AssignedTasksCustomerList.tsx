'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { Card } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { AssignedTask } from '@/lib/assigned-tasks/types';
import { getDisplayTaskStatus, isoNow } from '@/lib/assigned-tasks/storage';
import { relatedModuleHref, RELATED_MODULE_LABELS } from '@/lib/shift-sop/links';
import { tasksForStaffAndDate } from '@/lib/assigned-tasks/storage';

function readFileAsDataUrl(cb: (url: string) => void) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = () => {
    const f = input.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => cb(String(r.result));
    r.readAsDataURL(f);
  };
  input.click();
}

const STATUS_LABEL: Record<AssignedTask['status'], string> = {
  not_started: '未开始',
  in_progress: '进行中',
  done: '已完成',
  pending_review: '待审核',
  rejected: '已驳回',
  overdue: '已逾期',
};

export function AssignedTasksCustomerList({
  date,
  staff,
  tasks,
  onUpdate,
}: {
  date: string;
  staff: string;
  tasks: AssignedTask[];
  onUpdate: (next: AssignedTask[]) => void;
}) {
  const mine = useMemo(() => tasksForStaffAndDate(tasks, date, staff), [tasks, date, staff]);

  const patch = (row: AssignedTask, partial: Partial<AssignedTask>) => {
    const now = isoNow();
    const next = tasks.map((t) => (t.id === row.id ? { ...t, ...partial, updatedAt: now } : t));
    onUpdate(next);
  };

  if (!staff) return <p className="text-sm text-slate-mid">请先登录或选择客服身份。</p>;

  return (
    <div className="space-y-2">
      {mine.length === 0 ? (
        <p className="text-sm text-slate-mid">暂无主管临时分配任务。</p>
      ) : (
        mine.map((t) => {
          const displayStatus = getDisplayTaskStatus(t);
          const href = relatedModuleHref(t.relatedModule, {
            businessDate: date,
            draftDouyinRow: t.relatedModule === 'lead_follow_douyin',
          });
          const canAct =
            displayStatus !== 'done' && displayStatus !== 'pending_review' && displayStatus !== 'rejected';
          return (
            <Card key={t.id} className={cn('border p-3 text-sm', displayStatus === 'overdue' ? 'border-red-300 bg-red-50/40' : '')}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-coal-ink">{t.taskName}</div>
                  <div className="mt-1 text-xs text-graphite">
                    优先级 {t.priority} · 截至业务日当日（{t.date}）· {STATUS_LABEL[displayStatus]}
                  </div>
                  {t.description ? <p className="mt-1 text-xs text-slate-mid">{t.description}</p> : null}
                  <div className="mt-1 text-xs">完成方式：{t.completionMethod || '—'}</div>
                  {t.targetCount > 1 ? (
                    <div className="text-xs text-graphite">
                      进度 {t.completedCount}/{t.targetCount}
                    </div>
                  ) : null}
                </div>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-medium',
                    displayStatus === 'done' ? 'bg-emerald-100 text-emerald-900' : '',
                    displayStatus === 'pending_review' ? 'bg-amber-100 text-amber-900' : '',
                    displayStatus === 'rejected' ? 'bg-red-100 text-red-800' : '',
                    displayStatus === 'overdue' ? 'bg-red-200 text-red-950' : '',
                  )}
                >
                  {STATUS_LABEL[displayStatus]}
                </span>
              </div>
              {t.rejectReason ? <p className="mt-2 text-xs text-red-700">驳回原因：{t.rejectReason}</p> : null}
              {href ? (
                <Link href={href} className="mt-2 inline-block text-xs font-medium text-sky-800 underline">
                  关联模块：{RELATED_MODULE_LABELS[t.relatedModule]}
                </Link>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2">
                {canAct ? (
                  <button
                    type="button"
                    className="btn-primary text-xs"
                    onClick={() => {
                      const nextCount = Math.min(t.targetCount, t.completedCount + 1);
                      let status: AssignedTask['status'] =
                        t.status === 'not_started' || t.status === 'overdue' ? 'in_progress' : t.status;
                      if (nextCount >= t.targetCount) {
                        status = t.needReview ? 'pending_review' : 'done';
                      }
                      patch(t, { completedCount: nextCount, status });
                    }}
                  >
                    {t.targetCount > 1 ? '完成一步' : '标记完成'}
                  </button>
                ) : null}
                {t.needProof && canAct ? (
                  <button
                    type="button"
                    className="btn-ghost text-xs"
                    onClick={() =>
                      readFileAsDataUrl((url) => patch(t, { proofImages: [...(t.proofImages ?? []), url] }))
                    }
                  >
                    上传截图
                  </button>
                ) : null}
              </div>
              {t.proofImages?.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {t.proofImages.map((src, i) => (
                    <div key={i} className="relative shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" className="h-12 w-12 rounded border border-ash object-cover" />
                      <button
                        type="button"
                        className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1 text-[10px] font-medium text-white shadow hover:bg-red-700"
                        title="删除截图"
                        onClick={() => patch(t, { proofImages: t.proofImages!.filter((_, j) => j !== i) })}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </Card>
          );
        })
      )}
    </div>
  );
}
