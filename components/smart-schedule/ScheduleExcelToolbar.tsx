'use client';

import { useCallback, useState } from 'react';
import type { MonthPlan, Staff } from '@/lib/smart-schedule/types';
import { downloadScheduleExcelTemplate, importScheduleFromExcel } from '@/lib/smart-schedule/excel-schedule';

type Props = {
  staff: Staff[];
  viewYear: number;
  viewMonth: number;
  onImported: (plan: MonthPlan) => void;
  onJumpToMonth: (y: number, m: number) => void;
};

export function ScheduleExcelToolbar({ staff, viewYear, viewMonth, onImported, onJumpToMonth }: Props) {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');

  const downloadTpl = useCallback(() => {
    setFeedback('');
    try {
      downloadScheduleExcelTemplate(viewYear, viewMonth, staff);
      setFeedback('已下载 CSV 模板（UTF-8 BOM，Excel / WPS 可直接打开）。填写后请用「另存为 → CSV UTF-8」保存再导入。');
    } catch (e) {
      setFeedback(`下载失败：${e instanceof Error ? e.message : String(e)}`);
    }
  }, [staff, viewYear, viewMonth]);

  const onFile = useCallback(
    async (file: File | null) => {
      if (!file) return;
      setBusy(true);
      setFeedback('');
      try {
        const { plan, errors, warnings } = await importScheduleFromExcel(file, staff, viewYear, viewMonth);
        if (!plan || errors.length) {
          setFeedback(['导入失败：', ...errors].join('\n'));
          return;
        }
        onJumpToMonth(plan.year, plan.month);
        onImported(plan);
        const w =
          warnings.length > 0
            ? `\n提示（${warnings.length} 条，最多展示 12 条）：\n${warnings.slice(0, 12).join('\n')}${warnings.length > 12 ? '\n…' : ''}`
            : '';
        setFeedback(`已导入并保存到本地：${plan.year} 年 ${plan.month} 月。${w}`);
      } catch (e) {
        setFeedback(`导入异常：${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setBusy(false);
      }
    },
    [staff, viewYear, viewMonth, onImported, onJumpToMonth],
  );

  return (
    <div className="space-y-2 rounded-[10px] border border-[#e8e4dc] bg-[#faf8f4] p-4">
      <div className="text-sm font-semibold text-coal-ink">排班表导入 / 导出</div>
      <p className="text-xs leading-relaxed text-slate-mid">
        使用 <strong>CSV</strong>（Excel 可直接打开）：首行「姓名」+ 各日期（YYYY-MM-DD 或 1–31）；班次填 白 / 晚 / 休。编辑后请<strong>另存为 CSV UTF-8</strong> 再导入。直接上传 .xlsx 需本地安装 xlsx 库（见导入失败提示）。
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary text-sm" onClick={downloadTpl}>
          下载排班模板（CSV）
        </button>
        <label className="inline-flex cursor-pointer items-center justify-center rounded-full bg-emerald-tag px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50">
          {busy ? '导入中…' : '导入 CSV 并保存'}
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={busy}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              void onFile(f ?? null);
            }}
          />
        </label>
      </div>
      {feedback ? (
        <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded border border-ash bg-white p-2 text-xs text-graphite">{feedback}</pre>
      ) : null}
    </div>
  );
}
