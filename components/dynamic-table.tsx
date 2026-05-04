'use client';

import { useEffect, useMemo, useState } from 'react';

export function DynamicTable({ moduleKey, defaultColumns }: { moduleKey: string; defaultColumns: string[] }) {
  const [columns, setColumns] = useState<string[]>(defaultColumns);
  const [history, setHistory] = useState<string[][]>([]);
  const [rows, setRows] = useState<any[]>([{ id: 1 }, { id: 2 }]);
  const [newCol, setNewCol] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/table-data?moduleKey=${moduleKey}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.columns) setColumns(d.columns);
        if (d?.rows) setRows(d.rows);
      });
  }, [moduleKey]);

  const persist = async (nextCols = columns, nextRows = rows) => {
    setSaving(true);
    await fetch('/api/table-data', {
      method: 'POST',
      body: JSON.stringify({ moduleKey, columns: nextCols, rows: nextRows }),
    });
    setSaving(false);
  };

  const saveCols = (next: string[]) => {
    setHistory((h) => [...h.slice(-1), columns]);
    setColumns(next);
  };
  const undo = () => {
    if (!history.length) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setColumns(prev);
  };
  const addCol = () => {
    if (!newCol.trim()) return;
    saveCols([...columns, newCol.trim()]);
    setNewCol('');
  };
  const removeCol = (name: string) => saveCols(columns.filter((c) => c !== name));
  const onCsv = async (f: File) => {
    const text = await f.text();
    const lines = text.trim().split(/\r?\n/);
    if (!lines.length) return;
    const head = lines[0].split(',').map((s) => s.trim());
    saveCols(head);
    const parsed = lines.slice(1).map((line, i) => {
      const vals = line.split(',');
      const obj: any = { id: i + 1 };
      head.forEach((h, idx) => (obj[h] = vals[idx] || ''));
      return obj;
    });
    setRows(parsed);
  };
  const download = (name: string, content: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = name;
    link.click();
    URL.revokeObjectURL(link.href);
  };
  const tableRows = useMemo(() => rows, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <input
          className="input-field max-w-xs"
          value={newCol}
          onChange={(e) => setNewCol(e.target.value)}
          placeholder="新增表头字段"
        />
        <button type="button" className="btn-primary text-sm" onClick={addCol}>
          添加表头
        </button>
        <button type="button" className="btn-ghost text-sm" onClick={undo}>
          恢复上一步
        </button>
        <button
          type="button"
          className="btn-ghost text-sm"
          onClick={() => download(`${moduleKey}_template.csv`, `${columns.join(',')}\n`)}
        >
          下载模板
        </button>
        <button
          type="button"
          className="btn-ghost text-sm"
          onClick={() => {
            const head = columns.join(',');
            const body = rows.map((r) => columns.map((c) => r[c] ?? '').join(',')).join('\n');
            download(`${moduleKey}_export.csv`, `${head}\n${body}`);
          }}
        >
          导出 CSV
        </button>
        <label className="inline-flex cursor-pointer items-center justify-center rounded-full bg-emerald-tag px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90">
          导入 CSV
          <input
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onCsv(e.target.files[0])}
          />
        </label>
        <button type="button" className="btn-ghost text-sm" onClick={() => setRows([...rows, { id: rows.length + 1 }])}>
          新增行
        </button>
        <button type="button" className="btn-primary text-sm" onClick={() => persist()}>
          {saving ? '保存中...' : '保存到数据库'}
        </button>
      </div>
      <div className="table-wrap overflow-auto p-1">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-ash text-left text-graphite">
              {columns.map((c) => (
                <th key={c} className="p-2.5 font-medium">
                  {c}
                  <button type="button" className="ml-2 text-smolder hover:underline" onClick={() => removeCol(c)}>
                    ×
                  </button>
                </th>
              ))}
              <th className="p-2.5 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map((r, i) => (
              <tr key={i} className="border-b border-ash/80">
                {columns.map((c) => (
                  <td key={c} className="p-2">
                    <input
                      className="input-field py-1.5 text-sm"
                      value={r[c] || ''}
                      onChange={(e) =>
                        setRows((prev) => prev.map((x, idx) => (idx === i ? { ...x, [c]: e.target.value } : x)))
                      }
                    />
                  </td>
                ))}
                <td className="p-2 text-xs text-slate-mid">在线填写</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
