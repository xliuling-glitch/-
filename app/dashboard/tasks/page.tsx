'use client';

import { TodayTasksApp } from '@/components/today-tasks/TodayTasksApp';

export default function TasksPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight text-coal-ink">今日任务中心</h2>
        <p className="mt-1 text-sm text-slate-mid">
          今日工作包（任务执行 / 模板与配置 / 分配 / 主管）与「白班·晚班 SOP 时间轴」并列；SOP 按本机时间高亮当前时段，支持打勾、备注、截图与跳转各业务模块。数据存本机 LocalStorage。
        </p>
      </div>
      <TodayTasksApp />
    </div>
  );
}
