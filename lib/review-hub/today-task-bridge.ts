import type { ReviewAssignment } from './types';
import type { TaskAssignment } from '@/lib/today-tasks/types';
import { loadTodayTasks, saveTodayTasks } from '@/lib/today-tasks/storage';
import { emitWorkspaceStorageUpdated } from '@/lib/workspace-events';

export const REVIEW_HUB_TASK_ASSIGNMENT_PREFIX = 'rev-hub-asg-';

export function reviewHubLinkedAssignmentId(reviewAssignmentId: string): string {
  return `${REVIEW_HUB_TASK_ASSIGNMENT_PREFIX}${reviewAssignmentId}`;
}

function toTaskAssignment(a: ReviewAssignment): TaskAssignment {
  const ts = a.createdAt || new Date().toISOString();
  return {
    id: reviewHubLinkedAssignmentId(a.id),
    title: `【评价】${a.shop}·${a.title}（目标${a.targetCount}条，截止${a.dueDate}）`,
    description: `请在「评价管理中心 → 我的任务」选择本任务并提交订单号等；此处为每日待办打卡（与评价中心记录配合使用）。`,
    staffNames: [...a.assignees],
    recurrence: 'daily',
    startTime: '09:00',
    endTime: '23:59',
    priority: 'P2',
    completionMode: 'checkbox',
    quantityTarget: 1,
    shiftLabel: '',
    active: true,
    kpiTag: false,
    requiresSupervisorReview: false,
    taskType: '评价管理',
    shiftCode: 'all',
    createdBy: '评价管理中心',
    createdAt: ts,
    updatedAt: ts,
  };
}

/** 单条创建/更新后写入今日任务（去重同 id） */
export function upsertReviewHubAssignmentInTodayTasks(a: ReviewAssignment): void {
  if (typeof window === 'undefined') return;
  if (!a.assignees?.length) return;
  const state = loadTodayTasks();
  const tid = reviewHubLinkedAssignmentId(a.id);
  const keep = state.assignments.filter((x) => x.id !== tid);
  const ta = toTaskAssignment(a);
  saveTodayTasks({ ...state, assignments: [...keep, ta] });
  emitWorkspaceStorageUpdated();
}

/** 删除评价任务时移除今日任务中的对应分配及完成记录 */
export function removeReviewHubAssignmentFromTodayTasks(reviewAssignmentId: string): void {
  if (typeof window === 'undefined') return;
  const tid = reviewHubLinkedAssignmentId(reviewAssignmentId);
  const state = loadTodayTasks();
  const nextAssignments = state.assignments.filter((x) => x.id !== tid);
  if (nextAssignments.length === state.assignments.length) return;
  const completions = { ...state.completions };
  for (const k of Object.keys(completions)) {
    if (k.startsWith(`${tid}::`)) delete completions[k];
  }
  saveTodayTasks({ ...state, assignments: nextAssignments, completions });
  emitWorkspaceStorageUpdated();
}

/**
 * 以评价中心为源，重建所有「评价管理」类今日分配（用于首次进入页回填、与 LS 手工修改对齐）。
 */
export function syncAllReviewAssignmentsToTodayTasks(assignments: ReviewAssignment[]): void {
  if (typeof window === 'undefined') return;
  const state = loadTodayTasks();
  const prefix = REVIEW_HUB_TASK_ASSIGNMENT_PREFIX;
  const keep = state.assignments.filter((x) => !x.id.startsWith(prefix));
  const generated = assignments.filter((a) => a.assignees?.length).map(toTaskAssignment);
  const validIds = new Set(generated.map((g) => g.id));
  const completions = { ...state.completions };
  for (const k of Object.keys(completions)) {
    const aid = k.split('::')[0] ?? '';
    if (aid.startsWith(prefix) && !validIds.has(aid)) delete completions[k];
  }
  saveTodayTasks({ ...state, assignments: [...keep, ...generated], completions });
  emitWorkspaceStorageUpdated();
}
