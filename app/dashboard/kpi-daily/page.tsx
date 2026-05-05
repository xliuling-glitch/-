import { KpiDailyUploadApp } from '@/components/kpi-daily/KpiDailyUploadApp';

export default function KpiDailyPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight text-coal-ink">KPI 每日上传中心</h2>
        <p className="mt-1 text-sm text-slate-mid">
          客服按日填报 AI、留资、电联、销售与评价等数据；提交后进入待审，仅「已通过」计入统计与主管看板。支持与「今日任务中心」KPI 任务联动。数据存本机 LocalStorage。
        </p>
      </div>
      <KpiDailyUploadApp />
    </div>
  );
}
