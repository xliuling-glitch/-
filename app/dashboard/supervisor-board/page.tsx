import { SupervisorBoardApp } from '@/components/supervisor-board/SupervisorBoardApp';

export default function SupervisorBoardPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight text-coal-ink">SOP执行进度检查台</h2>
        <p className="mt-1 text-sm text-slate-mid">
          面向主管：查看各客服当日 SOP 执行、结班必交与临时任务审核；经营类 KPI 请在各业务模块查看。
        </p>
      </div>
      <SupervisorBoardApp />
    </div>
  );
}
