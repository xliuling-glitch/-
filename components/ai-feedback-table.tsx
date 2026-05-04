'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { matrixToCsvBom, parseCsvToMatrix } from '@/lib/csv-utf8';

export const AI_FEEDBACK_COLUMNS = [
  '日期',
  '客服',
  '单室主',
  '单室副',
  '双室',
  '封箱',
  '捆扎',
  '分装',
  '封包',
  '外抽',
  '大米',
  '压缩',
  '其他',
  '总询单',
  '总成交',
  '转化率',
  '单室总询单',
  '运用AI次数',
] as const;

export type AiFeedbackColumn = (typeof AI_FEEDBACK_COLUMNS)[number];

const MODULE_KEY = 'ai_feedback';

type Row = { id: string } & Record<string, string>;

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function emptyRow(): Row {
  const r: Row = { id: newId() };
  for (const c of AI_FEEDBACK_COLUMNS) r[c] = '';
  return r;
}

function parseNum(s: string) {
  const n = parseFloat(String(s).replace(/%/g, '').trim());
  return Number.isFinite(n) ? n : NaN;
}

export function AiFeedbackTable() {
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadMsg, setLoadMsg] = useState('');
  const [importMsg, setImportMsg] = useState('');
  const [appendImport, setAppendImport] = useState(false);

  const load = useCallback(async () => {
    setLoadMsg('');
    try {
      const r = await fetch(`/api/table-data?moduleKey=${MODULE_KEY}`);
      const d = await r.json();
      if (d?.rows && Array.isArray(d.rows) && d.rows.length) {
        setRows(
          d.rows.map((x: any, i: number) => {
            const row = emptyRow();
            row.id = String(x.id ?? newId());
            for (const c of AI_FEEDBACK_COLUMNS) {
              row[c] = x[c] != null ? String(x[c]) : '';
            }
            return row;
          }),
        );
      } else {
        setRows([emptyRow()]);
      }
    } catch {
      setLoadMsg('加载失败，请刷新重试');
      setRows([emptyRow()]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const persist = async (next: Row[]) => {
    setSaving(true);
    await fetch('/api/table-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        moduleKey: MODULE_KEY,
        columns: [...AI_FEEDBACK_COLUMNS],
        rows: next.map(({ id, ...rest }) => ({ id, ...rest })),
      }),
    });
    setSaving(false);
  };

  const download = (filename: string, csv: string) => {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const exportTemplate = () => {
    const matrix = [[...AI_FEEDBACK_COLUMNS]];
    download('AI运用反馈_空白模板.csv', matrixToCsvBom(matrix));
  };

  const exportData = () => {
    const matrix = [
      [...AI_FEEDBACK_COLUMNS],
      ...rows.map((r) => AI_FEEDBACK_COLUMNS.map((c) => r[c] ?? '')),
    ];
    download(`AI运用反馈_导出_${new Date().toISOString().slice(0, 10)}.csv`, matrixToCsvBom(matrix));
  };

  const onImportFile = async (f: File) => {
    setImportMsg('');
    const text = await f.text();
    const matrix = parseCsvToMatrix(text);
    if (!matrix.length) {
      setImportMsg('文件为空');
      return;
    }
    const head = matrix[0].map((h) => h.trim());
    const idx: Record<string, number> = {};
    head.forEach((h, i) => {
      idx[h] = i;
    });
    const missing = AI_FEEDBACK_COLUMNS.filter((c) => idx[c] === undefined);
    if (missing.length) {
      setImportMsg(`表头缺少列（将留空）：${missing.join('、')}`);
    }
    const dataRows = matrix.slice(1);
    const mapped: Row[] = dataRows.map((cells) => {
      const row = emptyRow();
      for (const c of AI_FEEDBACK_COLUMNS) {
        const j = idx[c];
        row[c] = j !== undefined && cells[j] != null ? String(cells[j]) : '';
      }
      return row;
    });
    if (!mapped.length) {
      setImportMsg('没有数据行，仅更新了表头认知（未新增行）');
      return;
    }
    if (appendImport) {
      setRows((prev) => [...prev, ...mapped.map((row) => ({ ...row, id: newId() }))]);
      setImportMsg((m) => (m ? `${m} 已追加 ${mapped.length} 行。` : `已追加 ${mapped.length} 行。`));
    } else {
      setRows(mapped);
    }
  };

  const updateCell = (id: string, col: string, value: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [col]: value } : r)));
  };

  const fillConversionRate = (id: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const q = parseNum(r['总询单']);
        const d = parseNum(r['总成交']);
        if (!Number.isFinite(q) || q <= 0 || !Number.isFinite(d)) return r;
        const pct = ((d / q) * 100).toFixed(2);
        return { ...r, 转化率: `${pct}%` };
      }),
    );
  };

  const fillSingleRoomTotal = (id: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const a = parseNum(r['单室主']);
        const b = parseNum(r['单室副']);
        if (!Number.isFinite(a) && !Number.isFinite(b)) return r;
        const sum = (Number.isFinite(a) ? a : 0) + (Number.isFinite(b) ? b : 0);
        return { ...r, 单室总询单: String(sum) };
      }),
    );
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (id: string) => setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)));

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const fillTodayDate = (id: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, 日期: today } : r)));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-[#f1f1f1] bg-[#fafafa] p-3 text-sm text-[#5a5957]">
        <span className="font-medium text-[#1c1a17]">导入 / 导出</span>
        <span className="hidden sm:inline">先用「空白模板」在 Excel 填好，再「导入 CSV」；也可在线编辑后保存。</span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-graphite">
          <input type="checkbox" checked={appendImport} onChange={(e) => setAppendImport(e.target.checked)} className="rounded border-ash" />
          追加导入（接到表格末尾，不删已有行）
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary text-sm" onClick={exportTemplate}>
          下载空白模板
        </button>
        <button type="button" className="btn-ghost text-sm" onClick={exportData}>
          导出当前数据
        </button>
        <label className="inline-flex cursor-pointer items-center justify-center rounded-full bg-emerald-tag px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90">
          导入 CSV
          <input
            type="file"
            accept=".csv,.txt"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void onImportFile(f);
            }}
          />
        </label>
        <button type="button" className="btn-ghost text-sm" onClick={addRow}>
          新增一行
        </button>
        <button type="button" className="btn-primary text-sm" onClick={() => persist(rows)}>
          {saving ? '保存中…' : '保存到数据库'}
        </button>
      </div>

      {(loadMsg || importMsg) && (
        <p className={`text-sm ${loadMsg ? 'text-red-600' : 'text-amber-700'}`}>{loadMsg || importMsg}</p>
      )}

      <div className="table-wrap max-h-[min(70vh,720px)] overflow-auto rounded-[10px] border border-[#f1f1f1] bg-white p-1 shadow-sm">
        <table className="w-full min-w-[1400px] border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-[#fafafa] shadow-sm">
            <tr className="border-b border-ash text-left text-graphite">
              {AI_FEEDBACK_COLUMNS.map((c) => (
                <th
                  key={c}
                  className={`whitespace-nowrap px-2 py-2.5 text-xs font-semibold sm:text-sm ${
                    c === '日期' ? 'sticky left-0 z-20 border-r border-ash/80 bg-[#fafafa]' : ''
                  } ${c === '客服' ? 'sticky left-[110px] z-20 border-r border-ash bg-[#fafafa]' : ''}`}
                  style={c === '日期' ? { minWidth: 110 } : c === '客服' ? { minWidth: 96 } : { minWidth: 72 }}
                >
                  {c}
                </th>
              ))}
              <th className="whitespace-nowrap px-2 py-2.5 text-xs font-semibold sm:text-sm">快捷操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-ash/80 hover:bg-[#fafafa]/80">
                {AI_FEEDBACK_COLUMNS.map((c) => (
                  <td
                    key={c}
                    className={`p-1 ${c === '日期' ? 'sticky left-0 z-[1] border-r border-ash/60 bg-white' : ''} ${
                      c === '客服' ? 'sticky left-[110px] z-[1] border-r border-ash/80 bg-white' : ''
                    }`}
                  >
                    <input
                      className={`input-field w-full min-w-0 py-1.5 text-sm ${
                        ['总询单', '总成交', '单室主', '单室副', '双室', '封箱', '捆扎', '分装', '封包', '外抽', '大米', '压缩', '其他', '单室总询单', '运用AI次数'].includes(c)
                          ? 'text-right tabular-nums'
                          : ''
                      }`}
                      value={r[c] ?? ''}
                      onChange={(e) => updateCell(r.id, c, e.target.value)}
                      placeholder={c === '日期' ? 'YYYY-MM-DD' : ''}
                    />
                  </td>
                ))}
                <td className="whitespace-nowrap p-1 align-top">
                  <div className="flex flex-col gap-0.5 text-xs">
                    <button type="button" className="text-left text-graphite underline hover:text-coal-ink" onClick={() => fillTodayDate(r.id)}>
                      填今日日期
                    </button>
                    <button type="button" className="text-left text-graphite underline hover:text-coal-ink" onClick={() => fillSingleRoomTotal(r.id)}>
                      汇总单室询单
                    </button>
                    <button type="button" className="text-left text-graphite underline hover:text-coal-ink" onClick={() => fillConversionRate(r.id)}>
                      计算转化率
                    </button>
                    <button type="button" className="text-left text-red-600 underline" onClick={() => removeRow(r.id)}>
                      删除行
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-[#7e7d7b]">
        「汇总单室询单」= 单室主 + 单室副；「计算转化率」= 总成交 ÷ 总询单 × 100%（需总询单大于 0）。导入时表头须与模板一致；若缺少某列，该列将留空并提示。
      </p>
    </div>
  );
}
