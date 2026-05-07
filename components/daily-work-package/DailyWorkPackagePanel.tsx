'use client';

import Link from 'next/link';
import { DailySalesReportTaskBlock } from './DailySalesReportTaskBlock';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui';
import { cn } from '@/lib/utils';
import { WORKSPACE_STORAGE_UPDATED } from '@/lib/workspace-events';
import type {
  CallFollowRecord,
  CompetitorChatRecord,
  DailyPackageTaskStatus,
  DailyTaskInstance,
  DailyWorkPackage,
  ProofImage,
  ReviewRegisterRecord,
} from '@/lib/daily-work-package/types';
import {
  applyWeeklyProgress,
  applyOverdueToTasks,
  canMarkTaskComplete,
  competitorProgress,
  computePackageRates,
  countCallsForStaff,
  countReviewsForStaff,
  statusBadgeClass,
  statusLabel,
  syncDailyTaskCounts,
} from '@/lib/daily-work-package/logic';
import {
  getWeekRange,
  isoNow,
  loadCalls,
  loadCompetitors,
  loadDailyTemplates,
  loadPackages,
  loadReviews,
  loadWeeklyTemplates,
  readMergedPackage,
  rid,
  saveCalls,
  saveCompetitors,
  savePackages,
  saveReviews,
  upsertPackage,
} from '@/lib/daily-work-package/storage';

function readFileAsProof(cb: (p: ProofImage) => void) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = () => {
    const f = input.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => cb({ id: rid(), dataUrl: String(r.result), name: f.name, addedAt: isoNow() });
    r.readAsDataURL(f);
  };
  input.click();
}

export function DailyWorkPackagePanel({
  date,
  staff,
  shift,
  onShiftChange,
}: {
  date: string;
  staff: string;
  shift: string;
  onShiftChange: (s: string) => void;
}) {
  const [pkg, setPkg] = useState<DailyWorkPackage | null>(null);
  const [calls, setCalls] = useState<CallFollowRecord[]>([]);
  const [reviews, setReviews] = useState<ReviewRegisterRecord[]>([]);
  const [competitors, setCompetitors] = useState<CompetitorChatRecord[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [rev, setRev] = useState(0);
  const [supervisorOpen, setSupervisorOpen] = useState(false);

  const hydrate = useCallback(() => {
    if (!staff) {
      setPkg(null);
      return;
    }
    const dt = loadDailyTemplates();
    const wt = loadWeeklyTemplates();
    const c = loadCalls();
    const r = loadReviews();
    const comp = loadCompetitors();
    setCalls(c);
    setReviews(r);
    setCompetitors(comp);
    const { pkg: raw } = readMergedPackage(date, staff, shift, dt, wt);
    let p = syncDailyTaskCounts(raw, c, r);
    p = applyWeeklyProgress(p, comp);
    const week = getWeekRange(date);
    const prog = competitorProgress(comp, week.start, week.end, staff);
    const wInst = p.weeklyTasks.find((w) => w.weekStartDate === week.start);
    const cc = countCallsForStaff(c, date, staff);
    const rr = countReviewsForStaff(r, date, staff);
    const rates = computePackageRates(p, cc, rr, wInst, prog.weeklyDone);
    const reviewDay = r.filter((x) => x.date === date && x.staffName === staff);
    p = {
      ...p,
      completionRate: rates.completionRate,
      weeklyCompletionRate: rates.weeklyCompletionRate,
      status: rates.done >= rates.total && prog.weeklyDone ? '已完成' : '进行中',
    };
    p = { ...p, dailyTasks: applyOverdueToTasks(p.dailyTasks, p.date, cc, rr, reviewDay, p.date, p.employeeName) };
    setPkg(p);
    upsertPackage(p, true);
  }, [date, staff, shift]);

  useEffect(() => {
    hydrate();
  }, [hydrate, rev]);

  useEffect(() => {
    const fn = () => setRev((x) => x + 1);
    window.addEventListener(WORKSPACE_STORAGE_UPDATED, fn);
    return () => window.removeEventListener(WORKSPACE_STORAGE_UPDATED, fn);
  }, []);

  const persist = useCallback((next: DailyWorkPackage) => {
    const c = loadCalls();
    const r = loadReviews();
    const comp = loadCompetitors();
    let p = syncDailyTaskCounts(next, c, r);
    p = applyWeeklyProgress(p, comp);
    const week = getWeekRange(p.date);
    const prog = competitorProgress(comp, week.start, week.end, p.employeeName);
    const wInst = p.weeklyTasks.find((w) => w.weekStartDate === week.start);
    const cc = countCallsForStaff(c, p.date, p.employeeName);
    const rr = countReviewsForStaff(r, p.date, p.employeeName);
    const rates = computePackageRates(p, cc, rr, wInst, prog.weeklyDone);
    const reviewDay = r.filter((x) => x.date === p.date && x.staffName === p.employeeName);
    p = {
      ...p,
      completionRate: rates.completionRate,
      weeklyCompletionRate: rates.weeklyCompletionRate,
      status: rates.done >= rates.total && prog.weeklyDone ? '已完成' : '进行中',
    };
    p = { ...p, dailyTasks: applyOverdueToTasks(p.dailyTasks, p.date, cc, rr, reviewDay, p.date, p.employeeName) };
    upsertPackage(p, true);
    setPkg(p);
  }, []);

  const showToast = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(''), 3200);
  };

  const updateTask = (taskId: string, patch: Partial<DailyTaskInstance>) => {
    if (!pkg) return;
    const dailyTasks = pkg.dailyTasks.map((t) => (t.id === taskId ? { ...t, ...patch, updatedAt: isoNow() } : t));
    persist({ ...pkg, dailyTasks });
  };

  const patchTaskForm = (taskKey: string, formPatch: Record<string, unknown>) => {
    if (!pkg) return;
    const dailyTasks = pkg.dailyTasks.map((t) =>
      t.taskKey === taskKey ? { ...t, formData: { ...t.formData, ...formPatch }, updatedAt: isoNow() } : t,
    );
    persist({ ...pkg, dailyTasks });
  };

  const stats = useMemo(() => {
    if (!pkg) return null;
    const cc = countCallsForStaff(calls, pkg.date, pkg.employeeName);
    const rr = countReviewsForStaff(reviews, pkg.date, pkg.employeeName);
    const week = getWeekRange(pkg.date);
    const prog = competitorProgress(competitors, week.start, week.end, pkg.employeeName);
    const wInst = pkg.weeklyTasks.find((w) => w.weekStartDate === week.start);
    const r0 = computePackageRates(pkg, cc, rr, wInst, prog.weeklyDone);
    const undone = pkg.dailyTasks.filter((t) => t.status !== 'completed').length;
    return { ...r0, undone, prog, week };
  }, [pkg, calls, reviews, competitors]);

  const submitTask = (task: DailyTaskInstance, asComplete: boolean) => {
    const cc = countCallsForStaff(calls, date, staff);
    const rr = countReviewsForStaff(reviews, date, staff);
    const reviewRows = reviews.filter((x) => x.date === date && x.staffName === staff);
    const chkOpts = { calls: cc, reviews: rr, reviewRows, date, staff };
    if (task.needReview && asComplete) {
      const chk = canMarkTaskComplete(task, chkOpts);
      if (!chk.ok) {
        showToast(chk.reason ?? '校验未通过');
        return;
      }
      updateTask(task.id, {
        status: 'pending_review',
        submittedForReviewAt: isoNow(),
        completedCount: task.taskKey === 'calls_three' ? cc : task.completedCount,
      });
      showToast('已提交主管审核');
      return;
    }
    if (asComplete) {
      const chk = canMarkTaskComplete(task, chkOpts);
      if (!chk.ok) {
        showToast(chk.reason ?? '无法完成');
        return;
      }
      updateTask(task.id, { status: 'completed', completedCount: Math.max(task.completedCount, task.targetCount) });
      showToast('已标记完成');
    }
  };

  const markInProgress = (taskId: string) => {
    updateTask(taskId, { status: 'in_progress' });
  };

  /** 待审核列表（本机全部客服） */
  const pendingList = useMemo(() => {
    const packs = loadPackages();
    const rows: { pkgId: string; task: DailyTaskInstance; employee: string; date: string }[] = [];
    for (const p of packs) {
      for (const t of p.dailyTasks) {
        if (t.status === 'pending_review') rows.push({ pkgId: p.id, task: t, employee: p.employeeName, date: p.date });
      }
    }
    return rows;
  }, [pkg, rev]);

  const approveTask = (pkgId: string, taskId: string, ok: boolean, note: string) => {
    const list = loadPackages();
    const p = list.find((x: DailyWorkPackage) => x.id === pkgId);
    if (!p) return;
    const dailyTasks = p.dailyTasks.map((t: DailyTaskInstance) =>
      t.id === taskId
        ? {
            ...t,
            status: (ok ? 'completed' : 'rejected') as DailyPackageTaskStatus,
            reviewDecision: ok ? ('approved' as const) : ('rejected' as const),
            reviewNote: note,
            updatedAt: isoNow(),
          }
        : t,
    );
    const idx = list.findIndex((x: DailyWorkPackage) => x.id === pkgId);
    list[idx] = { ...p, dailyTasks, updatedAt: isoNow() };
    savePackages(list, { silent: true });
    setRev((x) => x + 1);
    showToast(ok ? '已通过' : '已驳回');
  };

  const addCall = (row: Omit<CallFollowRecord, 'id' | 'createdAt'>) => {
    const next: CallFollowRecord = { ...row, id: rid(), createdAt: isoNow() };
    const list = [...calls, next];
    saveCalls(list);
    setCalls(list);
    setRev((x) => x + 1);
  };

  const addReview = (row: Omit<ReviewRegisterRecord, 'id' | 'createdAt' | 'status'>) => {
    const next: ReviewRegisterRecord = {
      ...row,
      id: rid(),
      createdAt: isoNow(),
      status: 'incomplete',
    };
    const list = [...reviews, next];
    saveReviews(list);
    setReviews(list);
    setRev((x) => x + 1);
  };

  const addCompetitor = (row: Omit<CompetitorChatRecord, 'id' | 'createdAt'>) => {
    const next: CompetitorChatRecord = { ...row, id: rid(), createdAt: isoNow() };
    const list = [...competitors, next];
    saveCompetitors(list);
    setCompetitors(list);
    setRev((x) => x + 1);
  };

  if (!staff) {
    return <p className="text-sm text-slate-mid">请先选择当前客服。</p>;
  }
  if (!pkg || !stats) {
    return <p className="text-sm text-slate-mid">加载中…</p>;
  }

  const incompleteDaily = stats.done < stats.total;
  const incompleteWeekly = !stats.prog.weeklyDone;
  const incompleteBanner = incompleteDaily || incompleteWeekly;

  return (
    <div className="space-y-6">
      {toast ? (
        <div className="rounded-lg border border-mint-pulse/40 bg-mint-pulse/10 px-3 py-2 text-sm text-coal-ink">{toast}</div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3 rounded-[10px] border border-ash bg-ledger-white p-3">
        <label className="text-xs text-graphite">
          班次
          <select className="input-field mt-1 block text-sm" value={shift} onChange={(e) => onShiftChange(e.target.value)}>
            <option value="day">白班</option>
            <option value="night">晚班</option>
            <option value="all">全班</option>
          </select>
        </label>
        <p className="text-xs text-slate-mid sm:ml-auto">业务日 {date} · 与「每日工作包」数据存本机 LocalStorage</p>
      </div>

      {incompleteBanner ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {incompleteDaily ? (
            <span>
              今日必做尚未全部完成（{stats.done}/{stats.total}）。请优先处理标红/灰色任务，并在截止前提交需审核项。
            </span>
          ) : null}
          {incompleteDaily && incompleteWeekly ? <br /> : null}
          {incompleteWeekly ? <span>本周「竞品聊天」尚未达标（需 3 家且三个产品方向各至少 1 家）。</span> : null}
        </div>
      ) : null}

      {/* 顶部概览 */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {[
          { k: '总数', v: String(stats.total), c: 'border-ash bg-ledger-white' },
          { k: '已完成', v: String(stats.done), c: 'border-emerald-200 bg-emerald-50' },
          { k: '未完成', v: String(stats.undone), c: 'border-slate-200 bg-slate-50' },
          { k: '逾期', v: String(stats.overdue), c: 'border-red-200 bg-red-50' },
          { k: '今日完成率', v: `${stats.completionRate}%`, c: 'border-sky-200 bg-sky-50' },
          { k: '本周任务完成率', v: `${stats.weeklyCompletionRate}%`, c: 'border-violet-200 bg-violet-50' },
        ].map((x) => (
          <div key={x.k} className={cn('rounded-card border px-4 py-3 text-center', x.c)}>
            <p className="text-xs text-graphite">{x.k}</p>
            <p className="mt-1 font-display text-lg font-bold text-coal-ink">{x.v}</p>
          </div>
        ))}
      </div>

      {/* 今日必做 */}
      <section>
        <h3 className="mb-3 font-display text-base font-semibold text-coal-ink">今日必做任务</h3>
        <div className="space-y-2">
          {pkg.dailyTasks.map((task) => (
            <Card key={task.id} elevated className="border border-ash p-0 overflow-hidden">
              <button
                type="button"
                className="flex w-full items-start gap-3 p-4 text-left hover:bg-ash/30"
                onClick={() => setExpanded((e) => (e === task.id ? null : task.id))}
              >
                <span className={cn('mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium', statusBadgeClass(task.status))}>
                  {statusLabel(task.status)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-coal-ink">{task.taskName}</p>
                  <p className="mt-0.5 text-xs text-slate-mid line-clamp-2">{task.description}</p>
                  <p className="mt-1 text-xs text-graphite">
                    完成方式：{task.completionMethod} · 目标 {task.targetCount} · 已完成 {task.completedCount}
                    {task.needProof ? ' · 需截图' : ''}
                    {task.needReview ? ' · 需审核' : ''}
                  </p>
                </div>
                <span className="text-xs text-slate-mid">{expanded === task.id ? '收起' : '展开'}</span>
              </button>
              {expanded === task.id ? (
                <div className="border-t border-ash bg-elevated/40 p-4 space-y-3">
                  <TaskDetailForm
                    date={date}
                    staff={staff}
                    task={task}
                    onPatchForm={(fd) => patchTaskForm(task.taskKey, fd)}
                    onAddProof={() => readFileAsProof((pi) => updateTask(task.id, { proofImages: [...task.proofImages, pi] }))}
                    onRemoveProof={(id) => updateTask(task.id, { proofImages: task.proofImages.filter((p) => p.id !== id) })}
                    onRemark={(v) => updateTask(task.id, { remark: v })}
                    onRefresh={() => setRev((x) => x + 1)}
                  />
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn-ghost text-sm" onClick={() => markInProgress(task.id)}>
                      标记进行中
                    </button>
                    {task.needReview ? (
                      <button type="button" className="btn-primary text-sm" onClick={() => submitTask(task, true)}>
                        提交审核
                      </button>
                    ) : (
                      <button type="button" className="btn-primary text-sm" onClick={() => submitTask(task, true)}>
                        标记完成
                      </button>
                    )}
                  </div>
                  {task.status === 'rejected' && task.reviewNote ? (
                    <p className="text-xs text-red-700">驳回原因：{task.reviewNote}</p>
                  ) : null}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      </section>

      {/* 今日数据填写 */}
      <section>
        <h3 className="mb-3 font-display text-base font-semibold text-coal-ink">今日数据填写区</h3>
        <Card className="border border-ash p-4 space-y-3">
          <p className="text-xs text-slate-mid">与「日报：每日销售额数据」「日工作回执」任务表单同步；结构化填报请用「留资跟进表」。</p>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {[
              ['todaySales', '今日销售额'],
              ['todayOrders', '今日订单数'],
              ['todayInquiries', '今日询单量'],
              ['todayLeads', '今日留咨数'],
              ['todayDeals', '今日成交客户数'],
              ['todayKeyCustomers', '今日重点客户'],
              ['todayIssues', '今日问题反馈'],
              ['reportLink', '日报截图或表格链接'],
            ].map(([key, label]) => (
              <label key={key} className="text-xs text-graphite">
                {label}
                <input
                  className="input-field mt-1 w-full text-sm"
                  value={String(pkg.dailyTasks.find((t) => t.taskKey === 'daily_sales_report')?.formData[key] ?? '')}
                  onChange={(e) => patchTaskForm('daily_sales_report', { [key]: e.target.value })}
                />
              </label>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {[
              ['personalSales', '个人日销'],
              ['inquiryCount', '询单量'],
              ['personalLeads', '个人留咨数'],
              ['dealCount', '成交单数'],
              ['noDealReason', '未成交原因'],
              ['workSummary', '今日工作总结'],
              ['receiptLink', '回执截图或链接'],
            ].map(([key, label]) => (
              <label key={key} className="text-xs text-graphite">
                {label}
                <input
                  className="input-field mt-1 w-full text-sm"
                  value={String(pkg.dailyTasks.find((t) => t.taskKey === 'presale_daily_receipt')?.formData[key] ?? '')}
                  onChange={(e) => patchTaskForm('presale_daily_receipt', { [key]: e.target.value })}
                />
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/lead-follow?tab=daily" className="btn-primary inline-flex items-center text-sm">
              留资跟进表 · 日报/询单量登记
            </Link>
            <Link href="/dashboard/lead-follow?tab=today" className="btn-ghost inline-flex items-center text-sm">
              今日留资登记
            </Link>
            <Link href="/dashboard/daily-sales" className="btn-ghost inline-flex items-center text-sm">
              每日销售额数据（原模板）
            </Link>
            <Link href="/dashboard/kpi-daily" className="btn-ghost inline-flex items-center text-sm">
              KPI 每日上传中心
            </Link>
          </div>
        </Card>
      </section>

      {/* 留资电联 */}
      <section>
        <h3 className="mb-3 font-display text-base font-semibold text-coal-ink">留资 / 电联跟进区</h3>
        <CallSection date={date} staff={staff} calls={calls.filter((c) => c.date === date && c.staffName === staff)} onAdd={addCall} />
      </section>

      {/* 抖音留资 */}
      <section>
        <h3 className="mb-3 font-display text-base font-semibold text-coal-ink">抖音留资信息跟踪</h3>
        <p className="mb-2 text-xs text-slate-mid">
          建议在{' '}
          <Link href="/dashboard/lead-follow?tab=douyin" className="text-sky-800 underline">
            留资跟进表 · 抖音留资电联跟踪
          </Link>{' '}
          登记以便与工作包任务自动联动。
        </p>
        <DouyinSection
          form={pkg.dailyTasks.find((t) => t.taskKey === 'douyin_leads_follow')?.formData ?? {}}
          onChange={(fd) => patchTaskForm('douyin_leads_follow', fd)}
        />
      </section>

      {/* 评价登记 */}
      <section>
        <h3 className="mb-3 font-display text-base font-semibold text-coal-ink">评价登记区</h3>
        <ReviewSection
          date={date}
          staff={staff}
          reviews={reviews.filter((r) => r.date === date && r.staffName === staff)}
          onAdd={addReview}
        />
      </section>

      {/* 本周竞品 */}
      <section>
        <h3 className="mb-3 font-display text-base font-semibold text-coal-ink">本周任务 · 竞品聊天</h3>
        {!stats.prog.weeklyDone ? (
          <p className="mb-2 text-xs text-amber-800">
            进度提醒：本周需至少 3 家店铺，且单室真空机 / 双室真空机 / 封箱机方向各至少 1 家。当前已完成店铺数：{stats.prog.shopCount}。
          </p>
        ) : (
          <p className="mb-2 text-xs text-emerald-800">本周竞品任务已满足要求。</p>
        )}
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          {['单室真空机', '双室真空机', '封箱机'].map((dir) => (
            <span
              key={dir}
              className={cn(
                'rounded-full border px-2 py-1',
                (stats.prog.byDir[dir] ?? 0) >= 1 ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-slate-50 text-slate-mid',
              )}
            >
              {dir}：{(stats.prog.byDir[dir] ?? 0) >= 1 ? '已覆盖' : '未完成'}
            </span>
          ))}
        </div>
        <CompetitorSection week={stats.week} staff={staff} rows={competitors} onAdd={addCompetitor} />
      </section>

      {/* 主管审核 */}
      <section>
        <button type="button" className="text-sm font-medium text-coal-ink underline" onClick={() => setSupervisorOpen((o) => !o)}>
          {supervisorOpen ? '收起' : '展开'}主管审核（待审 {pendingList.length}）
        </button>
        {supervisorOpen ? (
          <Card className="mt-2 border border-ash p-4">
            {pendingList.length === 0 ? (
              <p className="text-sm text-slate-mid">暂无待审核项。</p>
            ) : (
              <ul className="space-y-3">
                {pendingList.map((row) => (
                  <li key={`${row.pkgId}-${row.task.id}`} className="rounded-lg border border-ash/80 p-3 text-sm">
                    <p className="font-medium text-coal-ink">
                      {row.employee} · {row.date} · {row.task.taskName}
                    </p>
                    <SupervisorRow onApprove={(ok, note) => approveTask(row.pkgId, row.task.id, ok, note)} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : null}
      </section>
    </div>
  );
}

function SupervisorRow({ onApprove }: { onApprove: (ok: boolean, note: string) => void }) {
  const [note, setNote] = useState('');
  return (
    <div className="mt-2 flex flex-wrap items-end gap-2">
      <input className="input-field min-w-[12rem] flex-1 text-sm" placeholder="审核备注 / 驳回原因" value={note} onChange={(e) => setNote(e.target.value)} />
      <button type="button" className="btn-primary text-sm" onClick={() => onApprove(true, note)}>
        通过
      </button>
      <button type="button" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" onClick={() => onApprove(false, note || '未填写原因')}>
        驳回
      </button>
    </div>
  );
}

function TaskDetailForm({
  date,
  staff,
  task,
  onPatchForm,
  onAddProof,
  onRemoveProof,
  onRemark,
  onRefresh,
}: {
  date: string;
  staff: string;
  task: DailyTaskInstance;
  onPatchForm: (fd: Record<string, unknown>) => void;
  onAddProof: () => void;
  onRemoveProof: (proofId: string) => void;
  onRemark: (v: string) => void;
  onRefresh: () => void;
}) {
  const fd = task.formData;
  if (task.taskKey === 'daily_sales_report') {
    return (
      <DailySalesReportTaskBlock
        date={date}
        staff={staff}
        task={task}
        onPatchForm={onPatchForm}
        onRemark={onRemark}
        onRefresh={onRefresh}
      />
    );
  }
  if (task.taskKey === 'moments_post') {
    return (
      <div className="space-y-2">
        <label className="text-xs text-graphite">
          发布内容类型
          <select
            className="input-field mt-1 w-full max-w-xs text-sm"
            value={String(fd.publishType ?? '')}
            onChange={(e) => onPatchForm({ publishType: e.target.value })}
          >
            <option value="">请选择</option>
            {['产品', '案例', '客户反馈', '活动', '知识'].map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-graphite">
          备注
          <input className="input-field mt-1 w-full text-sm" value={task.remark} onChange={(e) => onRemark(e.target.value)} />
        </label>
        <ProofList images={task.proofImages} onRemove={onRemoveProof} />
        <button type="button" className="btn-ghost text-sm" onClick={onAddProof}>
          上传朋友圈截图
        </button>
      </div>
    );
  }
  if (task.taskKey === 'crm_old_follow_daily') {
    return (
      <div className="space-y-2 text-sm text-graphite">
        <p>
          今日应回访 <strong className="text-coal-ink">{String(fd.crmTotal ?? task.targetCount)}</strong>，已回访{' '}
          <strong className="text-emerald-800">{String(fd.crmDone ?? task.completedCount)}</strong>，未回访{' '}
          <strong className="text-amber-800">{String(fd.crmPending ?? Math.max(0, task.targetCount - task.completedCount))}</strong>
        </p>
        <Link href="/dashboard/old-customer-crm?tab=follow" className="inline-flex text-sky-800 underline">
          打开老客户 CRM · 回访任务
        </Link>
        <p className="text-xs text-slate-mid">在 CRM 中勾选完成回访后，此处进度会自动更新；全部完成后可点击「标记完成」。</p>
      </div>
    );
  }
  if (task.taskKey === 'data_summary_sheet') {
    return (
      <div className="space-y-2">
        <label className="text-xs text-graphite">
          表格名称
          <input className="input-field mt-1 w-full text-sm" value={String(fd.dataSummaryName ?? '')} onChange={(e) => onPatchForm({ dataSummaryName: e.target.value })} />
        </label>
        <label className="text-xs text-graphite">
          表格链接
          <input className="input-field mt-1 w-full text-sm" value={String(fd.dataSummaryLink ?? '')} onChange={(e) => onPatchForm({ dataSummaryLink: e.target.value })} />
        </label>
        <label className="flex items-center gap-2 text-sm text-graphite">
          <input type="checkbox" checked={fd.dataSummaryChecked === true} onChange={(e) => onPatchForm({ dataSummaryChecked: e.target.checked })} />
          今日已填写
        </label>
        <ProofList images={task.proofImages} onRemove={onRemoveProof} />
        <button type="button" className="btn-ghost text-sm" onClick={onAddProof}>
          上传填写截图
        </button>
        <label className="text-xs text-graphite">
          备注
          <input className="input-field mt-1 w-full text-sm" value={task.remark} onChange={(e) => onRemark(e.target.value)} />
        </label>
      </div>
    );
  }
  return (
    <div className="space-y-2 text-sm text-slate-mid">
      <p>详细字段请在上方「今日数据填写区」「留资/电联」「评价登记」等分区填写；此处可补充备注。</p>
      <label className="text-xs text-graphite block">
        备注
        <input className="input-field mt-1 w-full text-sm" value={task.remark} onChange={(e) => onRemark(e.target.value)} />
      </label>
      {task.needProof ? (
        <>
          <ProofList images={task.proofImages} onRemove={onRemoveProof} />
          <button type="button" className="btn-ghost text-sm" onClick={onAddProof}>
            上传截图
          </button>
        </>
      ) : null}
    </div>
  );
}

function ProofList({ images, onRemove }: { images: ProofImage[]; onRemove?: (id: string) => void }) {
  if (!images.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {images.map((im) => (
        <div key={im.id} className="relative shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={im.dataUrl} alt="" className="h-20 w-20 rounded border border-ash object-cover" />
          {onRemove ? (
            <button
              type="button"
              className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1 text-[10px] font-medium text-white shadow hover:bg-red-700"
              title="删除截图"
              onClick={() => onRemove(im.id)}
            >
              ×
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function CallSection({
  date,
  staff,
  calls,
  onAdd,
}: {
  date: string;
  staff: string;
  calls: CallFollowRecord[];
  onAdd: (r: Omit<CallFollowRecord, 'id' | 'createdAt'>) => void;
}) {
  const [form, setForm] = useState({
    customerName: '',
    phone: '',
    source: '',
    product: '',
    connected: true,
    result: '',
    nextFollowAt: '',
    remark: '',
  });
  return (
    <Card className="border border-ash p-4 space-y-3">
      <p className="text-xs text-slate-mid">已登记 {calls.length} 条（电联任务按条数统计）。</p>
      <ul className="max-h-40 space-y-1 overflow-auto text-xs text-graphite">
        {calls.map((c) => (
          <li key={c.id}>
            {c.customerName} · {c.phone} · {c.product} · {c.connected ? '接通' : '未接通'} · {c.result}
          </li>
        ))}
      </ul>
      <div className="grid gap-2 md:grid-cols-3">
        <input className="input-field text-sm" placeholder="客户名称/昵称" value={form.customerName} onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))} />
        <input className="input-field text-sm" placeholder="电话" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
        <input className="input-field text-sm" placeholder="来源" value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} />
        <input className="input-field text-sm" placeholder="咨询产品" value={form.product} onChange={(e) => setForm((f) => ({ ...f, product: e.target.value }))} />
        <input className="input-field text-sm" placeholder="电联结果" value={form.result} onChange={(e) => setForm((f) => ({ ...f, result: e.target.value }))} />
        <input className="input-field text-sm" type="date" placeholder="下次跟进" value={form.nextFollowAt} onChange={(e) => setForm((f) => ({ ...f, nextFollowAt: e.target.value }))} />
        <input className="input-field text-sm md:col-span-2" placeholder="备注" value={form.remark} onChange={(e) => setForm((f) => ({ ...f, remark: e.target.value }))} />
        <label className="flex items-center gap-2 text-sm text-graphite">
          <input type="checkbox" checked={form.connected} onChange={(e) => setForm((f) => ({ ...f, connected: e.target.checked }))} />
          是否接通
        </label>
      </div>
      <button
        type="button"
        className="btn-primary text-sm"
        onClick={() => {
          if (!form.customerName.trim()) return;
          onAdd({ ...form, date, staffName: staff });
          setForm({ customerName: '', phone: '', source: '', product: '', connected: true, result: '', nextFollowAt: '', remark: '' });
        }}
      >
        添加电联记录
      </button>
    </Card>
  );
}

function DouyinSection({ form, onChange }: { form: Record<string, unknown>; onChange: (fd: Record<string, unknown>) => void }) {
  const leads = (form.douyinLeads as Record<string, unknown>[]) ?? [];
  const [row, setRow] = useState({
    leadName: '',
    phone: '',
    leadAt: '',
    staff: '',
    called: false,
    callAt: '',
    result: '',
    nextAt: '',
    remark: '',
  });
  return (
    <Card className="border border-ash p-4 space-y-3">
      <div className="grid gap-2 md:grid-cols-3">
        <input className="input-field text-sm" placeholder="留资客户" value={row.leadName} onChange={(e) => setRow((r) => ({ ...r, leadName: e.target.value }))} />
        <input className="input-field text-sm" placeholder="电话" value={row.phone} onChange={(e) => setRow((r) => ({ ...r, phone: e.target.value }))} />
        <input className="input-field text-sm" type="datetime-local" value={row.leadAt} onChange={(e) => setRow((r) => ({ ...r, leadAt: e.target.value }))} />
        <input className="input-field text-sm" placeholder="负责客服" value={row.staff} onChange={(e) => setRow((r) => ({ ...r, staff: e.target.value }))} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={row.called} onChange={(e) => setRow((r) => ({ ...r, called: e.target.checked }))} />
          是否已电联
        </label>
        <input className="input-field text-sm" type="datetime-local" value={row.callAt} onChange={(e) => setRow((r) => ({ ...r, callAt: e.target.value }))} />
        <input className="input-field text-sm md:col-span-2" placeholder="电联结果" value={row.result} onChange={(e) => setRow((r) => ({ ...r, result: e.target.value }))} />
        <input className="input-field text-sm" type="date" placeholder="下次跟进" value={row.nextAt} onChange={(e) => setRow((r) => ({ ...r, nextAt: e.target.value }))} />
        <input className="input-field text-sm md:col-span-2" placeholder="备注" value={row.remark} onChange={(e) => setRow((r) => ({ ...r, remark: e.target.value }))} />
      </div>
      <button
        type="button"
        className="btn-primary text-sm"
        onClick={() => {
          if (!row.leadName.trim()) return;
          onChange({ douyinLeads: [...leads, { ...row }], douyinLeadName: row.leadName, douyinCalled: row.called ? '是' : '否' });
          setRow({ leadName: '', phone: '', leadAt: '', staff: '', called: false, callAt: '', result: '', nextAt: '', remark: '' });
        }}
      >
        添加留资记录
      </button>
      <ul className="text-xs text-graphite space-y-1">
        {leads.map((l, i) => (
          <li key={i}>{String(l.leadName)} · {String(l.phone)} · 电联 {l.called ? '是' : '否'}</li>
        ))}
      </ul>
    </Card>
  );
}

function ReviewSection({
  date,
  staff,
  reviews,
  onAdd,
}: {
  date: string;
  staff: string;
  reviews: ReviewRegisterRecord[];
  onAdd: (r: Omit<ReviewRegisterRecord, 'id' | 'createdAt' | 'status'>) => void;
}) {
  const [form, setForm] = useState({ shop: '', product: '', orderId: '', reviewType: '文字', remark: '' });
  const [shots, setShots] = useState<ProofImage[]>([]);
  return (
    <Card className="border border-ash p-4 space-y-3">
      <ul className="max-h-32 space-y-1 overflow-auto text-xs">
        {reviews.map((r) => (
          <li key={r.id}>
            {r.shop} / {r.product} / {r.orderId} / {r.reviewType}
          </li>
        ))}
      </ul>
      <div className="grid gap-2 md:grid-cols-3">
        <input className="input-field text-sm" placeholder="店铺" value={form.shop} onChange={(e) => setForm((f) => ({ ...f, shop: e.target.value }))} />
        <input className="input-field text-sm" placeholder="产品" value={form.product} onChange={(e) => setForm((f) => ({ ...f, product: e.target.value }))} />
        <input className="input-field text-sm" placeholder="客户订单号" value={form.orderId} onChange={(e) => setForm((f) => ({ ...f, orderId: e.target.value }))} />
        <select className="input-field text-sm" value={form.reviewType} onChange={(e) => setForm((f) => ({ ...f, reviewType: e.target.value }))}>
          {['文字', '图片', '视频', '追评'].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <input className="input-field text-sm md:col-span-2" placeholder="备注" value={form.remark} onChange={(e) => setForm((f) => ({ ...f, remark: e.target.value }))} />
      </div>
      <button type="button" className="btn-ghost text-sm" onClick={() => readFileAsProof((p) => setShots((s) => [...s, p]))}>
        上传评价截图
      </button>
      <ProofList images={shots} />
      <button
        type="button"
        className="btn-primary text-sm"
        onClick={() => {
          if (!form.shop.trim()) return;
          onAdd({ ...form, date, staffName: staff, screenshot: shots });
          setForm({ shop: '', product: '', orderId: '', reviewType: '文字', remark: '' });
          setShots([]);
        }}
      >
        添加评价记录
      </button>
    </Card>
  );
}

function CompetitorSection({
  week,
  staff,
  rows,
  onAdd,
}: {
  week: { start: string; end: string };
  staff: string;
  rows: CompetitorChatRecord[];
  onAdd: (r: Omit<CompetitorChatRecord, 'id' | 'createdAt'>) => void;
}) {
  const mine = rows.filter((r) => r.staffName === staff && r.weekStartDate === week.start);
  const [form, setForm] = useState({
    productDirection: '单室真空机',
    shopName: '',
    platform: '',
    consultContent: '',
    quote: '',
    sellingPoints: '',
    afterSales: '',
    done: false,
  });
  const [shots, setShots] = useState<ProofImage[]>([]);
  return (
    <Card className="border border-ash p-4 space-y-3">
      <ul className="max-h-36 space-y-1 overflow-auto text-xs">
        {mine.map((r) => (
          <li key={r.id}>
            {r.productDirection} · {r.shopName} · {r.done ? '已完成' : '草稿'}
          </li>
        ))}
      </ul>
      <div className="grid gap-2 md:grid-cols-3">
        <select className="input-field text-sm" value={form.productDirection} onChange={(e) => setForm((f) => ({ ...f, productDirection: e.target.value }))}>
          {['单室真空机', '双室真空机', '封箱机'].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <input className="input-field text-sm" placeholder="竞品店铺名称" value={form.shopName} onChange={(e) => setForm((f) => ({ ...f, shopName: e.target.value }))} />
        <input className="input-field text-sm" placeholder="平台" value={form.platform} onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))} />
        <input className="input-field text-sm md:col-span-3" placeholder="咨询内容" value={form.consultContent} onChange={(e) => setForm((f) => ({ ...f, consultContent: e.target.value }))} />
        <input className="input-field text-sm" placeholder="对方报价" value={form.quote} onChange={(e) => setForm((f) => ({ ...f, quote: e.target.value }))} />
        <input className="input-field text-sm" placeholder="对方卖点" value={form.sellingPoints} onChange={(e) => setForm((f) => ({ ...f, sellingPoints: e.target.value }))} />
        <input className="input-field text-sm" placeholder="对方售后承诺" value={form.afterSales} onChange={(e) => setForm((f) => ({ ...f, afterSales: e.target.value }))} />
        <label className="flex items-center gap-2 text-sm md:col-span-3">
          <input type="checkbox" checked={form.done} onChange={(e) => setForm((f) => ({ ...f, done: e.target.checked }))} />
          标记为有效完成记录
        </label>
      </div>
      <button type="button" className="btn-ghost text-sm" onClick={() => readFileAsProof((p) => setShots((s) => [...s, p]))}>
        上传聊天截图
      </button>
      <ProofList images={shots} onRemove={(id) => setShots((s) => s.filter((x) => x.id !== id))} />
      <button
        type="button"
        className="btn-primary text-sm"
        onClick={() => {
          if (!form.shopName.trim()) return;
          onAdd({
            ...form,
            weekStartDate: week.start,
            weekEndDate: week.end,
            staffName: staff,
            screenshots: shots,
          });
          setForm({
            productDirection: '单室真空机',
            shopName: '',
            platform: '',
            consultContent: '',
            quote: '',
            sellingPoints: '',
            afterSales: '',
            done: false,
          });
          setShots([]);
        }}
      >
        保存竞品记录
      </button>
    </Card>
  );
}
