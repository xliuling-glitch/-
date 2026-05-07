'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { CsvTemplateUpload } from '@/components/csv-template-upload';
import type { DailyTaskInstance } from '@/lib/daily-work-package/types';

type SalesRow = {
  id: number;
  date: string;
  staff: string;
  shop: string;
  reception: number;
  aftersale: number;
  invalidInquiry: number;
  presale: number;
  deals: number;
  sales: number;
};

export function DailySalesReportTaskBlock({
  date,
  staff,
  task,
  onPatchForm,
  onRemark,
  onRefresh,
}: {
  date: string;
  staff: string;
  task: DailyTaskInstance;
  onPatchForm: (fd: Record<string, unknown>) => void;
  onRemark: (v: string) => void;
  onRefresh: () => void;
}) {
  const [todayRows, setTodayRows] = useState<SalesRow[]>([]);
  const [histRows, setHistRows] = useState<SalesRow[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!staff) {
      setTodayRows([]);
      setHistRows([]);
      return;
    }
    setLoadErr(null);
    try {
      const [tRes, hRes] = await Promise.all([
        fetch(`/api/daily-sales?date=${encodeURIComponent(date)}&staff=${encodeURIComponent(staff)}`, { credentials: 'include' }),
        fetch(`/api/daily-sales?staff=${encodeURIComponent(staff)}`, { credentials: 'include' }),
      ]);
      const t0 = (await tRes.json()) as unknown;
      const h0 = (await hRes.json()) as unknown;
      const tArr = Array.isArray(t0) ? (t0 as SalesRow[]) : [];
      const hArr = Array.isArray(h0) ? (h0 as SalesRow[]) : [];
      setTodayRows(tArr);
      const sorted = [...hArr].sort((a, b) => (b.date + b.id).localeCompare(a.date + a.id));
      setHistRows(sorted.slice(0, 60));
    } catch {
      setLoadErr('加载日销数据失败，请检查网络或登录状态。');
    }
  }, [date, staff]);

  useEffect(() => {
    void load();
  }, [load, task.updatedAt, String(task.formData?.dailySalesAcknowledged), String(task.formData?.dailySalesLastRefresh)]);

  const ack = task.formData?.dailySalesAcknowledged === true;
  const manualCore =
    String(task.formData?.todaySales ?? '').trim() !== '' ||
    String(task.formData?.todayOrders ?? '').trim() !== '' ||
    String(task.formData?.todayInquiries ?? '').trim() !== '';

  return (
    <div className="space-y-4 text-sm text-graphite">
      <p className="text-xs text-slate-mid">
        与侧栏「每日销售额数据」使用同一套 CSV 模板与导入接口；导入成功后数据写入系统，请在下方核对今日行并点击「确认已保存」。
        <Link href="/dashboard/lead-follow?tab=daily" className="ml-2 text-sky-800 underline">
          留资跟进表 · 日报登记
        </Link>
        <Link href="/dashboard/daily-sales" className="ml-2 text-sky-800 underline">
          完整日销页
        </Link>
      </p>

      <CsvTemplateUpload
        title="客服日销询单表 · CSV 导入"
        description="沿用《客服日销询单表_模板》表头；导入后会在下方显示今日已录入行，请务必点击「确认已保存」后再标记任务完成。"
        templateHref="/templates/客服日销询单表_模板.csv"
        templateLabel="下载标准模板"
        action="选择 CSV 导入"
        uploadUrl="/api/daily-sales/import"
        showDatabaseHint={false}
        onDone={() => {
          onPatchForm({
            dailySalesAcknowledged: false,
            dailySalesLastImportAt: new Date().toISOString(),
            dailySalesLastRefresh: Date.now(),
          });
          void load();
          onRefresh();
        }}
      />

      {loadErr ? <p className="text-xs text-red-600">{loadErr}</p> : null}

      {todayRows.length > 0 ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
          <p className="text-xs font-semibold text-emerald-950">
            今日已录入 {todayRows.length} 条店铺日销数据，请核对无误后点击「确认已保存」。
          </p>
          <MiniSalesTable rows={todayRows} />
        </div>
      ) : (
        <p className="text-xs text-amber-800">
          今日尚未从系统读取到您的日销行（可先导入 CSV，或在侧栏「每日销售额数据」中录入；亦可在上方「今日数据填写区」填写核心数字）。
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn-primary text-sm"
          disabled={!staff || (todayRows.length === 0 && !manualCore)}
          onClick={() => {
            onPatchForm({
              dailySalesAcknowledged: true,
              dailySalesSavedAt: new Date().toISOString(),
              dailySalesLastRefresh: Date.now(),
            });
            void load();
            onRefresh();
          }}
        >
          确认已保存
        </button>
        {ack ? <span className="text-xs text-emerald-800">已确认保存，可点击上方「标记完成」。</span> : null}
      </div>

      <label className="text-xs text-graphite block">
        备注
        <input className="input-field mt-1 w-full text-sm" value={task.remark} onChange={(e) => onRemark(e.target.value)} />
      </label>

      <div className="border-t border-ash pt-3">
        <p className="text-xs font-semibold text-coal-ink">我的历史每日销售额（最近 60 条）</p>
        <p className="mt-0.5 text-[11px] text-slate-mid">按日期倒序；与侧栏日销数据源一致。</p>
        {histRows.length === 0 ? (
          <p className="mt-2 text-xs text-slate-mid">暂无历史记录。</p>
        ) : (
          <div className="mt-2 max-h-64 overflow-auto rounded-lg border border-ash bg-white">
            <MiniSalesTable rows={histRows} />
          </div>
        )}
      </div>
    </div>
  );
}

function MiniSalesTable({ rows }: { rows: SalesRow[] }) {
  return (
    <table className="mt-2 w-full min-w-[640px] border-collapse text-left text-xs">
      <thead className="sticky top-0 bg-ash/90 text-graphite">
        <tr>
          <th className="border-b border-ash px-2 py-1.5">日期</th>
          <th className="border-b border-ash px-2 py-1.5">店铺</th>
          <th className="border-b border-ash px-2 py-1.5">接待</th>
          <th className="border-b border-ash px-2 py-1.5">售前</th>
          <th className="border-b border-ash px-2 py-1.5">成交</th>
          <th className="border-b border-ash px-2 py-1.5">销售额</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-b border-ash/50">
            <td className="px-2 py-1.5 tabular-nums">{r.date}</td>
            <td className="px-2 py-1.5">{r.shop}</td>
            <td className="px-2 py-1.5 tabular-nums">{r.reception}</td>
            <td className="px-2 py-1.5 tabular-nums">{r.presale}</td>
            <td className="px-2 py-1.5 tabular-nums">{r.deals}</td>
            <td className="px-2 py-1.5 tabular-nums">{r.sales}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
