'use client';

import { useCallback, useEffect, useState } from 'react';
import { WORKSPACE_STORAGE_UPDATED } from '@/lib/workspace-events';
import { loadSopTemplates, saveSopTemplates } from '@/lib/shift-sop/storage';
import { ShiftSopAdminPanel } from '@/components/shift-sop/ShiftSopAdminPanel';

export function ConfigCenterSopPanel({ canEdit }: { canEdit: boolean }) {
  const [templates, setTemplates] = useState(() => loadSopTemplates());

  const reload = useCallback(() => setTemplates(loadSopTemplates()), []);

  useEffect(() => {
    reload();
    const fn = () => reload();
    window.addEventListener(WORKSPACE_STORAGE_UPDATED, fn);
    return () => window.removeEventListener(WORKSPACE_STORAGE_UPDATED, fn);
  }, [reload]);

  if (!canEdit) {
    return (
      <p className="p-4 text-sm text-[var(--color-slate-mid)]">
        全局 SOP 时间轴模板仅管理员 / 主管可编辑；您当前为只读。
      </p>
    );
  }

  return (
    <div className="p-2">
      <p className="mb-3 text-xs text-[var(--color-slate-mid)]">
        此处修改的是「白班 / 晚班」标准流程模板（LocalStorage：<code className="rounded bg-[var(--color-ash)] px-1">shift_sop_templates</code>
        ）。客服端今日任务中心仅按模板执行，不包含本配置页。
      </p>
      <ShiftSopAdminPanel
        templates={templates}
        onSave={(t) => {
          saveSopTemplates(t);
          setTemplates(t);
        }}
      />
    </div>
  );
}
