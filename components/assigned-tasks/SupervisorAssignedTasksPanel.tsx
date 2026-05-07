'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui';
import type { AssignedTask, AssignedTaskPriority } from '@/lib/assigned-tasks/types';
import type { RelatedModule } from '@/lib/shift-sop/types';
import { loadAssignedTasks, rid, saveAssignedTasks, isoNow } from '@/lib/assigned-tasks/storage';
import { RELATED_MODULE_LABELS } from '@/lib/shift-sop/links';
import { WORKSPACE_STORAGE_UPDATED } from '@/lib/workspace-events';

const MODULE_KEYS: RelatedModule[] = [
  'none',
  'lead_follow_douyin',
  'lead_follow_detail',
  'lead_follow_no_deal',
  'tasks_package',
  'kpi_daily',
  'reviews',
  'old_crm',
  'competitor_weekly',
  'calls_manage',
];

const PRI: AssignedTaskPriority[] = ['P0', 'P1', 'P2', 'P3'];

export function SupervisorAssignedTasksPanel({ date, roster, auditorName }: { date: string; roster: string[]; auditorName: string }) {
  const [tasks, setTasks] = useState<AssignedTask[]>([]);
  const [pick, setPick] = useState<Record<string, boolean>>({});
  const [taskName, setTaskName] = useState('');
  const [description, setDescription] = useState('');
  const [taskType, setTaskType] = useState('临时');
  const [priority, setPriority] = useState<AssignedTaskPriority>('P2');
  const [completionMethod, setCompletionMethod] = useState('完成后在此标记');
  const [targetCount, setTargetCount] = useState(1);
  const [needProof, setNeedProof] = useState(false);
  const [needReview, setNeedReview] = useState(false);
  const [relatedModule, setRelatedModule] = useState<RelatedModule>('none');

  const refresh = () => setTasks(loadAssignedTasks());

  useEffect(() => {
    refresh();
    const fn = () => refresh();
    window.addEventListener(WORKSPACE_STORAGE_UPDATED, fn);
    return () => window.removeEventListener(WORKSPACE_STORAGE_UPDATED, fn);
  }, []);

  const dayTasks = useMemo(() => tasks.filter((t) => t.date === date), [tasks, date]);

  const selected = roster.filter((n) => pick[n]);

  const createBatch = () => {
    if (!taskName.trim() || selected.length === 0) return;
    const now = isoNow();
    const base = loadAssignedTasks();
    const rows: AssignedTask[] = selected.map((assignedTo) => ({
      id: rid(),
      date,
      taskName: taskName.trim(),
      taskType,
      assignedTo,
      assignedBy: auditorName,
      priority,
      deadline: date,
      completionMethod,
      targetCount: Math.max(1, targetCount),
      completedCount: 0,
      needProof,
      needReview,
      relatedModule,
      description: description.trim(),
      status: 'not_started' as const,
      proofImages: [],
      rejectReason: '',
      createdAt: now,
      updatedAt: now,
    }));
    saveAssignedTasks([...base, ...rows]);
    refresh();
    setTaskName('');
    setDescription('');
  };

  const approve = (id: string) => {
    const now = isoNow();
    const list = loadAssignedTasks();
    saveAssignedTasks(list.map((t) => (t.id === id ? { ...t, status: 'done' as const, updatedAt: now } : t)));
    refresh();
  };

  const reject = (id: string, reason: string) => {
    const now = isoNow();
    const list = loadAssignedTasks();
    saveAssignedTasks(
      list.map((t) => (t.id === id ? { ...t, status: 'rejected' as const, rejectReason: reason, updatedAt: now } : t)),
    );
    refresh();
  };

  return (
    <div className="space-y-4">
      <Card className="border border-ash p-4">
        <h3 className="font-display text-base font-semibold text-coal-ink">临时任务分配</h3>
        <p className="mt-1 text-xs text-slate-mid">
          支持多选客服批量下发；任务将出现在各客服「今日任务中心 → 主管临时分配任务」。截止与上方业务日一致（当日），逾期指超过该业务日日末后仍未闭环。
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-graphite sm:col-span-2">
            任务名称
            <input className="input-field mt-1 w-full text-sm" value={taskName} onChange={(e) => setTaskName(e.target.value)} />
          </label>
          <label className="text-xs text-graphite sm:col-span-2">
            说明
            <textarea className="input-field mt-1 min-h-[48px] w-full text-sm" value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <label className="text-xs text-graphite">
            类型
            <input className="input-field mt-1 w-full text-sm" value={taskType} onChange={(e) => setTaskType(e.target.value)} />
          </label>
          <label className="text-xs text-graphite">
            优先级
            <select className="input-field mt-1 w-full text-sm" value={priority} onChange={(e) => setPriority(e.target.value as AssignedTaskPriority)}>
              {PRI.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-graphite">
            目标次数
            <input type="number" min={1} className="input-field mt-1 w-full text-sm" value={targetCount} onChange={(e) => setTargetCount(Number(e.target.value) || 1)} />
          </label>
          <label className="text-xs text-graphite sm:col-span-2">
            完成方式说明
            <input className="input-field mt-1 w-full text-sm" value={completionMethod} onChange={(e) => setCompletionMethod(e.target.value)} />
          </label>
          <label className="text-xs text-graphite sm:col-span-2">
            关联模块（跳转）
            <select className="input-field mt-1 w-full text-sm" value={relatedModule} onChange={(e) => setRelatedModule(e.target.value as RelatedModule)}>
              {MODULE_KEYS.map((k) => (
                <option key={k} value={k}>
                  {RELATED_MODULE_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-graphite">
            <input type="checkbox" checked={needProof} onChange={(e) => setNeedProof(e.target.checked)} />
            需截图
          </label>
          <label className="flex items-center gap-2 text-xs text-graphite">
            <input type="checkbox" checked={needReview} onChange={(e) => setNeedReview(e.target.checked)} />
            需主管审核
          </label>
        </div>
        <div className="mt-3">
          <p className="text-xs font-medium text-graphite">分配给</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {roster.map((n) => (
              <label key={n} className="flex items-center gap-1 text-xs">
                <input type="checkbox" checked={!!pick[n]} onChange={() => setPick((p) => ({ ...p, [n]: !p[n] }))} />
                {n}
              </label>
            ))}
          </div>
        </div>
        <button type="button" className="btn-primary mt-3 text-sm" onClick={createBatch}>
          批量下发
        </button>
      </Card>

      <Card className="border border-ash p-4">
        <h3 className="font-display text-base font-semibold text-coal-ink">业务日 {date} · 临时任务列表</h3>
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-[960px] w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-ash bg-ash/40 text-left text-xs text-graphite">
                {['客服', '任务', '优先级', '截止', '进度', '状态', '审核', '关联模块'].map((h) => (
                  <th key={h} className="px-2 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dayTasks.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-2 py-4 text-center text-slate-mid">
                    暂无记录
                  </td>
                </tr>
              ) : (
                dayTasks.map((t) => (
                  <SupervisorTaskRow key={t.id} t={t} onApprove={() => approve(t.id)} onReject={(reason) => reject(t.id, reason)} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function SupervisorTaskRow({
  t,
  onApprove,
  onReject,
}: {
  t: AssignedTask;
  onApprove: () => void;
  onReject: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <tr className="border-b border-ash/80">
      <td className="px-2 py-1">{t.assignedTo}</td>
      <td className="px-2 py-1 max-w-[200px]">{t.taskName}</td>
      <td className="px-2 py-1">{t.priority}</td>
      <td className="px-2 py-1 whitespace-nowrap">{t.date}（当日）</td>
      <td className="px-2 py-1">
        {t.completedCount}/{t.targetCount}
      </td>
      <td className="px-2 py-1">{t.status}</td>
      <td className="px-2 py-1">
        {t.status === 'pending_review' ? (
          <div className="flex flex-col gap-1">
            <button type="button" className="btn-primary text-xs py-1" onClick={onApprove}>
              通过
            </button>
            <input className="input-field text-xs" placeholder="驳回原因" value={reason} onChange={(e) => setReason(e.target.value)} />
            <button type="button" className="btn-ghost text-xs text-red-800" onClick={() => onReject(reason || '未填写')}>
              驳回
            </button>
          </div>
        ) : (
          '—'
        )}
      </td>
      <td className="px-2 py-1 text-xs text-slate-mid">{RELATED_MODULE_LABELS[t.relatedModule]}</td>
    </tr>
  );
}
