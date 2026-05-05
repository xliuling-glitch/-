'use client';

import { TodayTasksApp } from '@/components/today-tasks/TodayTasksApp';

export default function TasksPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight text-coal-ink">今日任务中心</h2>
        <p className="mt-1 text-sm text-slate-mid">
          时间段待办、优先级、完成打卡与凭证；支持浏览器通知（开始前 5 分钟 / 逾期）。状态颜色：已完成绿、进行中蓝、未开始灰、逾期红、待主管审核黄。
        </p>
      </div>
      <TodayTasksApp />
    </div>
  );
}
