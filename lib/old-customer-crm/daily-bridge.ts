import type { DailyTaskInstance, DailyWorkPackage } from '@/lib/daily-work-package/types';
import { rid, isoNow, loadFollowTasks } from './storage';

const CRM_TASK_KEY = 'crm_old_follow_daily';

function buildCrmTaskInstance(
  total: number,
  completed: number,
  existing?: DailyTaskInstance,
): DailyTaskInstance {
  const pending = total - completed;
  const status = pending === 0 ? 'completed' : completed > 0 ? 'in_progress' : 'incomplete';
  return {
    id: existing?.id ?? rid(),
    taskKey: CRM_TASK_KEY,
    taskName: '老客户回访',
    taskType: 'CRM',
    description: `今日计划回访 ${total} 位老客户，已完成 ${completed}，未回访 ${pending}。请在「老客户CRM」中完成回访并勾选完成。`,
    completionMethod: '完成当日全部回访任务或在 CRM 中更新状态',
    targetCount: Math.max(total, 1),
    completedCount: completed,
    needProof: false,
    needReview: false,
    status,
    proofImages: existing?.proofImages ?? [],
    formData: {
      ...(existing?.formData ?? {}),
      crmTotal: total,
      crmDone: completed,
      crmPending: pending,
    },
    remark: existing?.remark ?? '',
    updatedAt: isoNow(),
  };
}

/** 将「老客户回访」动态任务合并进每日工作包（不写入任务模板） */
export function mergeCrmFollowIntoPackage(pkg: DailyWorkPackage): DailyWorkPackage {
  const tasks = loadFollowTasks();
  const todays = tasks.filter((t) => t.followDate === pkg.date && t.ownerEmployee === pkg.employeeName);
  const others = pkg.dailyTasks.filter((t) => t.taskKey !== CRM_TASK_KEY);
  const existing = pkg.dailyTasks.find((t) => t.taskKey === CRM_TASK_KEY);
  if (todays.length === 0) {
    return { ...pkg, dailyTasks: others };
  }
  const completed = todays.filter((t) => t.isCompleted).length;
  const inst = buildCrmTaskInstance(todays.length, completed, existing);
  return { ...pkg, dailyTasks: [...others, inst] };
}

export function crmFollowSummaryForDay(date: string, staff: string) {
  const tasks = loadFollowTasks();
  const todays = tasks.filter((t) => t.followDate === date && t.ownerEmployee === staff);
  const completed = todays.filter((t) => t.isCompleted).length;
  return { total: todays.length, completed, pending: todays.length - completed };
}
