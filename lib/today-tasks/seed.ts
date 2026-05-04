import type { TodayTaskState } from './types';
import { loadTodayTasks } from './storage';

export function getInitialTaskState(): TodayTaskState {
  const s = loadTodayTasks();
  if (s.templates.length > 0 || s.assignments.length > 0) return s;
  const t = new Date().toISOString();
  return {
    templates: [
      {
        id: 'tpl-welcome',
        name: '标准日班（示例）',
        description: '可在「任务模板」中编辑或删除',
        defaultPriority: 'P2',
        completionMode: 'checkbox',
        createdAt: t,
      },
    ],
    assignments: [
      {
        id: 'asg-welcome',
        title: '处理今日店铺消息与留资',
        staffNames: ['周晨'],
        recurrence: 'daily',
        startTime: '09:00',
        endTime: '11:30',
        priority: 'P1',
        completionMode: 'checkbox',
        quantityTarget: 1,
        shiftLabel: '上午',
        active: true,
        kpiTag: false,
        createdAt: t,
      },
    ],
    completions: {},
  };
}
