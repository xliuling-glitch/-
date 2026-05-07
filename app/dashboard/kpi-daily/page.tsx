import { KpiDailyUploadApp } from '@/components/kpi-daily/KpiDailyUploadApp';

export default function KpiDailyPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight text-coal-ink">每日 KPI 自动汇总与确认中心</h2>
        <p className="mt-1 text-sm text-slate-mid">
          自动汇总日报、留资、抖音电联、评价、朋友圈、AI、老客户与复购等本地数据；客服核对备注后提交，主管审核。不在此重复填报业务字段。汇总存{' '}
          <code className="rounded bg-ash px-1">daily_kpi_summary</code>，手工 KPI 历史仍在 <code className="rounded bg-ash px-1">kpi-daily-center-v1</code>。
        </p>
      </div>
      <KpiDailyUploadApp />
    </div>
  );
}
