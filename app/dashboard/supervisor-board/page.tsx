import { SupervisorBoardApp } from '@/components/supervisor-board/SupervisorBoardApp';

export default function SupervisorBoardPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight text-coal-ink">主管数据看板</h2>
        <p className="mt-1 text-sm text-slate-mid">
          聚合「今日任务中心」与「KPI 每日上传中心」LocalStorage 数据：总览、客服排名、异常提醒、KPI 快捷审核与趋势进度条；支持异常处理状态持久化。
        </p>
      </div>
      <SupervisorBoardApp />
    </div>
  );
}
