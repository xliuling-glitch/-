'use client';

import { useState } from 'react';
import type { CompletionMode, Priority, TaskTemplate, TodayTaskState } from '@/lib/today-tasks/types';

const MODES: { v: CompletionMode; l: string }[] = [
  { v: 'checkbox', l: '直接打勾' },
  { v: 'quantity', l: '填写完成数量' },
  { v: 'screenshot', l: '上传/填写截图说明' },
  { v: 'customer', l: '关联客户' },
  { v: 'daily_report', l: '提交日报摘要' },
  { v: 'review_upload', l: '评价类（截屏/审核）' },
  { v: 'calls_metrics', l: '电联（次数+有效通次）' },
];

const PRI: Priority[] = ['P0', 'P1', 'P2', 'P3'];

export function TemplatesPanel({
  data,
  setData,
}: {
  data: TodayTaskState;
  setData: React.Dispatch<React.SetStateAction<TodayTaskState>>;
}) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [pri, setPri] = useState<Priority>('P2');
  const [mode, setMode] = useState<CompletionMode>('checkbox');

  const add = () => {
    if (!name.trim()) return;
    const t: TaskTemplate = {
      id: `tpl-${Date.now()}`,
      name: name.trim(),
      description: desc.trim(),
      defaultPriority: pri,
      completionMode: mode,
      createdAt: new Date().toISOString(),
    };
    setData((s) => ({ ...s, templates: [t, ...s.templates] }));
    setName('');
    setDesc('');
  };

  const remove = (id: string) => setData((s) => ({ ...s, templates: s.templates.filter((x) => x.id !== id) }));

  return (
    <div className="space-y-4">
      <div className="rounded-[10px] border border-ash bg-elevated p-4">
        <h3 className="text-sm font-semibold text-coal-ink">新建模板</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-graphite">
            名称
            <input className="input-field mt-1 block w-full text-sm" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="text-xs text-graphite">
            默认优先级
            <select className="input-field mt-1 block w-full text-sm" value={pri} onChange={(e) => setPri(e.target.value as Priority)}>
              {PRI.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-graphite sm:col-span-2">
            说明
            <input className="input-field mt-1 block w-full text-sm" value={desc} onChange={(e) => setDesc(e.target.value)} />
          </label>
          <label className="text-xs text-graphite sm:col-span-2">
            默认完成方式
            <select className="input-field mt-1 block w-full text-sm" value={mode} onChange={(e) => setMode(e.target.value as CompletionMode)}>
              {MODES.map((m) => (
                <option key={m.v} value={m.v}>
                  {m.l}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button type="button" className="btn-primary mt-3 text-sm" onClick={add}>
          添加模板
        </button>
      </div>

      <div className="overflow-x-auto rounded-[10px] border border-ash bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-ash bg-parchment/50 text-left text-graphite">
              <th className="px-3 py-2">模板名称</th>
              <th className="px-3 py-2">优先级</th>
              <th className="px-3 py-2">完成方式</th>
              <th className="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {data.templates.map((t) => (
              <tr key={t.id} className="border-b border-ash/70">
                <td className="px-3 py-2 font-medium">{t.name}</td>
                <td className="px-3 py-2">{t.defaultPriority}</td>
                <td className="px-3 py-2 text-stone">{MODES.find((m) => m.v === t.completionMode)?.l ?? t.completionMode}</td>
                <td className="px-3 py-2">
                  <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => remove(t.id)}>
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
