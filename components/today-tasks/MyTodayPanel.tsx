'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { CompletionRecord, TaskInstance, TodayTaskState } from '@/lib/today-tasks/types';
import {
  buildInstances,
  computeStatus,
  isSatisfied,
  mergeCompletion,
} from '@/lib/today-tasks/engine';
import { TaskCredentialsEditor } from './TaskCredentialsEditor';

function priorityClass(p: string) {
  if (p === 'P0') return 'bg-red-100 text-red-800 border-red-200';
  if (p === 'P1') return 'bg-amber-100 text-amber-900 border-amber-200';
  if (p === 'P2') return 'bg-sky-100 text-sky-900 border-sky-200';
  return 'bg-ash text-graphite border-ash';
}

function statusLabel(s: string) {
  if (s === 'done') return { text: '已完成', className: 'text-mint-pulse' };
  if (s === 'overdue') return { text: '已逾期', className: 'text-red-600' };
  return { text: '待完成', className: 'text-slate-mid' };
}

export function MyTodayPanel({
  data,
  setData,
  date,
  staff,
}: {
  data: TodayTaskState;
  setData: React.Dispatch<React.SetStateAction<TodayTaskState>>;
  date: string;
  staff: string;
}) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((x) => x + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const instances = useMemo(() => {
    const all = buildInstances(data, date).filter((i) => i.staffName === staff);
    return all;
  }, [data, date, staff, tick]);

  const patch = (inst: TaskInstance, patchRec: CompletionRecord) => {
    setData((s) => mergeCompletion(s, inst.instanceKey, patchRec));
  };

  const tryComplete = (inst: TaskInstance) => {
    setData((s) => {
      const patchRec: CompletionRecord = { completedAt: new Date().toISOString() };
      const nextState = mergeCompletion(s, inst.instanceKey, patchRec);
      const rec = nextState.completions[inst.instanceKey] ?? {};
      if (
        inst.kpiTag &&
        isSatisfied(inst.completionMode, rec, inst.quantityTarget)
      ) {
        queueMicrotask(() =>
          window.alert('任务已完成。若已勾选 KPI 关联，请到「KPI绩效」核对是否计入。'),
        );
      }
      return nextState;
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-mid">
        以下为 <strong className="text-coal-ink">{date}</strong> 分配给 <strong>{staff || '未选择'}</strong> 的任务，按优先级与时间排序。
      </p>

      {instances.length === 0 ? (
        <p className="rounded-lg border border-dashed border-fossil bg-ledger-white px-4 py-8 text-center text-sm text-stone">
          当日无任务。请在「分配任务」中添加，或切换日期 / 客服身份。
        </p>
      ) : (
        <ul className="space-y-3">
          {instances.map((inst) => {
            const st = computeStatus(inst, new Date());
            const sl = statusLabel(st);
            const sat = isSatisfied(inst.completionMode, inst.completion, inst.quantityTarget);
            return (
              <li
                key={inst.instanceKey}
                className={`rounded-[10px] border bg-white p-4 shadow-subtle ${priorityClass(inst.priority)} border`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wide">{inst.priority}</span>
                    <h4 className="mt-0.5 font-semibold text-coal-ink">{inst.title}</h4>
                    <p className="mt-1 tabular-nums text-sm text-graphite">
                      {inst.startTime} – {inst.endTime}
                      {inst.shiftLabel ? <span className="ml-2 text-stone">· {inst.shiftLabel}</span> : null}
                    </p>
                  </div>
                  <div className={`text-sm font-medium ${sl.className}`}>{sat ? '已完成' : sl.text}</div>
                </div>

                <div className="mt-3 space-y-2 border-t border-black/5 pt-3">
                  {inst.completionMode === 'checkbox' && (
                    <button
                      type="button"
                      className="btn-primary text-sm disabled:opacity-50"
                      disabled={sat}
                      onClick={() => tryComplete(inst)}
                    >
                      {sat ? '已打卡' : '完成打卡'}
                    </button>
                  )}

                  {inst.completionMode === 'quantity' && (
                    <div className="flex flex-wrap items-end gap-2">
                      <label className="text-xs text-graphite">
                        完成数量 / 目标 {inst.quantityTarget}
                        <input
                          type="number"
                          min={0}
                          className="input-field mt-1 w-28 py-1.5 text-sm"
                          value={inst.completion.quantityDone ?? ''}
                          onChange={(e) =>
                            patch(inst, { quantityDone: Number(e.target.value) })
                          }
                        />
                      </label>
                      <button
                        type="button"
                        className="btn-ghost text-sm"
                        onClick={() => {
                          const qty = inst.completion.quantityDone ?? 0;
                          const done = qty >= inst.quantityTarget;
                          patch(inst, {
                            quantityDone: qty,
                            ...(done ? { completedAt: new Date().toISOString() } : { completedAt: undefined }),
                          });
                          if (!done) {
                            window.alert(`完成数量需达到目标 ${inst.quantityTarget} 后方可打卡完成。`);
                          }
                        }}
                      >
                        提交并校验数量
                      </button>
                    </div>
                  )}

                  {(inst.completionMode === 'screenshot' || inst.completionMode === 'review_upload') && (
                    <label className="block text-xs text-graphite">
                      {inst.completionMode === 'review_upload' ? '截图说明 / 凭证链接（评价类）' : '截图说明 / 链接'}
                      <textarea
                        className="input-field mt-1 min-h-[72px] w-full text-sm"
                        value={inst.completion.screenshotNote ?? ''}
                        onChange={(e) => patch(inst, { screenshotNote: e.target.value })}
                        placeholder="可填链接或备注；也可在下方直接上传图片 / 添加文字，均会保存到本任务"
                      />
                      {inst.completionMode === 'review_upload' ? (
                        <p className="mt-1 text-xs text-slate-mid">
                          完整流程还可前往{' '}
                          <Link href="/dashboard/reviews/my-tasks" className="font-medium text-signal-violet underline">
                            评价管理中心
                          </Link>
                        </p>
                      ) : null}
                    </label>
                  )}

                  {inst.completionMode === 'customer' && (
                    <label className="block text-xs text-graphite">
                      关联客户（旺旺 / 客户编号）
                      <input
                        className="input-field mt-1 block w-full max-w-md text-sm"
                        value={inst.completion.customerRef ?? ''}
                        onChange={(e) => patch(inst, { customerRef: e.target.value })}
                      />
                    </label>
                  )}

                  {inst.completionMode === 'daily_report' && (
                    <label className="block text-xs text-graphite">
                      日报摘要
                      <textarea
                        className="input-field mt-1 min-h-[64px] w-full text-sm"
                        value={inst.completion.dailyReportSummary ?? ''}
                        onChange={(e) => patch(inst, { dailyReportSummary: e.target.value })}
                      />
                    </label>
                  )}

                  {inst.completionMode === 'calls_metrics' && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="text-xs text-graphite">
                        完成电联次数
                        <input
                          type="number"
                          min={0}
                          className="input-field mt-1 w-full text-sm"
                          value={inst.completion.quantityDone ?? ''}
                          onChange={(e) => patch(inst, { quantityDone: Number(e.target.value) })}
                        />
                      </label>
                      <label className="text-xs text-graphite">
                        有效沟通次数
                        <input
                          type="number"
                          min={0}
                          className="input-field mt-1 w-full text-sm"
                          value={inst.completion.effectiveQty ?? ''}
                          onChange={(e) => patch(inst, { effectiveQty: Number(e.target.value) })}
                        />
                      </label>
                      <p className="sm:col-span-2 text-xs text-slate-mid">
                        明细可在{' '}
                        <Link href="/dashboard/calls" className="text-signal-violet underline">
                          电联管理
                        </Link>{' '}
                        核对。
                      </p>
                    </div>
                  )}

                  <TaskCredentialsEditor
                    attachments={inst.completion.attachments ?? []}
                    onChange={(next) => patch(inst, { attachments: next })}
                  />

                  <label className="block text-xs text-graphite">
                    延期说明（未完成时可填）
                    <input
                      className="input-field mt-1 block w-full max-w-xl text-sm"
                      value={inst.completion.deferNote ?? ''}
                      onChange={(e) => patch(inst, { deferNote: e.target.value })}
                    />
                  </label>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
