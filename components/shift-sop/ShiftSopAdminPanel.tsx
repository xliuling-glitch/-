'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui';
import type { RelatedModule, ShiftType, SopActionTemplate, SopActionType, SopSlotTemplate } from '@/lib/shift-sop/types';
import { resetSopTemplatesToBuiltin } from '@/lib/shift-sop/storage';
import { RELATED_MODULE_LABELS } from '@/lib/shift-sop/links';

const MODULE_KEYS: RelatedModule[] = [
  'none',
  'lead_follow_douyin',
  'lead_follow_detail',
  'lead_follow_no_deal',
  'tasks_package',
  'kpi_daily',
  'reviews',
  'old_crm',
  'competitor_weekly',
  'calls_manage',
];

const ACTION_TYPES: SopActionType[] = ['required', 'guide', 'learning', 'jump'];

const ACTION_TYPE_LABEL: Record<SopActionType, string> = {
  required: '必做项',
  guide: '指导项',
  learning: '学习项',
  jump: '跳转填写项',
};

type Props = {
  templates: SopSlotTemplate[];
  onSave: (t: SopSlotTemplate[]) => void;
};

export function ShiftSopAdminPanel({ templates, onSave }: Props) {
  const [shiftEdit, setShiftEdit] = useState<ShiftType>('day');
  const [draft, setDraft] = useState<SopSlotTemplate[]>(templates);

  useEffect(() => {
    setDraft(templates);
  }, [templates]);

  const visible = draft.filter((s) => s.shiftType === shiftEdit).sort((a, b) => a.sort - b.sort);

  const syncSlot = (id: string, patch: Partial<SopSlotTemplate>) => {
    setDraft((d) => d.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const syncAction = (slotId: string, actionId: string, patch: Partial<SopActionTemplate>) => {
    setDraft((d) =>
      d.map((s) => {
        if (s.id !== slotId) return s;
        return {
          ...s,
          actions: s.actions.map((a) => (a.id === actionId ? { ...a, ...patch } : a)),
        };
      }),
    );
  };

  const addAction = (slotId: string) => {
    const nid = `custom-${Date.now()}`;
    setDraft((d) =>
      d.map((s) => {
        if (s.id !== slotId) return s;
        const na: SopActionTemplate = {
          id: nid,
          actionText: '新动作（请编辑）',
          actionType: 'guide',
          isRequired: false,
          needProof: false,
          relatedModule: 'none',
          sort: s.actions.length,
        };
        return { ...s, actions: [...s.actions, na] };
      }),
    );
  };

  const removeAction = (slotId: string, actionId: string) => {
    setDraft((d) =>
      d.map((s) => (s.id === slotId ? { ...s, actions: s.actions.filter((a) => a.id !== actionId) } : s)),
    );
  };

  const addSlot = () => {
    const sort = draft.filter((s) => s.shiftType === shiftEdit).length + 1;
    const id = `custom-slot-${Date.now()}`;
    const slot: SopSlotTemplate = {
      id,
      shiftType: shiftEdit,
      startTime: '09:00',
      endTime: '10:00',
      moduleName: '新模块',
      actions: [
        {
          id: `${id}-a1`,
          actionText: '示例动作',
          actionType: 'guide',
          isRequired: false,
          needProof: false,
          relatedModule: 'none',
          sort: 0,
        },
      ],
      sort,
      enabled: true,
    };
    setDraft((d) => [...d, slot]);
  };

  const removeSlot = (slotId: string) => {
    if (!confirm('删除该时段及其全部动作？')) return;
    setDraft((d) => d.filter((s) => s.id !== slotId));
  };

  const normalizeSort = (list: SopSlotTemplate[]) => {
    const byShift = { day: [] as SopSlotTemplate[], night: [] as SopSlotTemplate[] };
    for (const s of list) {
      byShift[s.shiftType].push(s);
    }
    const fix = (arr: SopSlotTemplate[]) =>
      [...arr].sort((a, b) => a.sort - b.sort).map((s, i) => ({
        ...s,
        sort: i + 1,
        actions: s.actions.map((a, j) => ({ ...a, sort: j })),
      }));
    return [...fix(byShift.day), ...fix(byShift.night)];
  };

  return (
    <div className="space-y-4">
      <Card className="border border-amber-200 bg-amber-50/50 p-4 text-sm text-amber-950">
        <p className="font-medium">管理员 · SOP 时间轴配置</p>
        <p className="mt-1 text-xs">修改后点击底部保存，将写入本机 LocalStorage（shift_sop_templates）。客服端时间轴会即时读到新版本。</p>
      </Card>

      <div className="flex flex-wrap gap-2">
        {(['day', 'night'] as const).map((st) => (
          <button
            key={st}
            type="button"
            className={shiftEdit === st ? 'btn-primary text-sm' : 'btn-ghost text-sm'}
            onClick={() => setShiftEdit(st)}
          >
            {st === 'day' ? '白班模板' : '晚班模板'}
          </button>
        ))}
        <button type="button" className="btn-ghost text-sm" onClick={addSlot}>
          新增时段
        </button>
        <button
          type="button"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          onClick={() => {
            if (!confirm('确定恢复系统内置白班/晚班 SOP？将覆盖当前自定义模板。')) return;
            const built = resetSopTemplatesToBuiltin();
            setDraft(built);
            onSave(built);
          }}
        >
          恢复内置模板
        </button>
      </div>

      <div className="space-y-4">
        {visible.map((slot) => (
          <Card key={slot.id} className="border border-ash p-4">
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs text-graphite">
                开始
                <input
                  className="input-field mt-1 w-[88px] text-sm"
                  value={slot.startTime}
                  onChange={(e) => syncSlot(slot.id, { startTime: e.target.value })}
                />
              </label>
              <label className="text-xs text-graphite">
                结束
                <input
                  className="input-field mt-1 w-[88px] text-sm"
                  value={slot.endTime}
                  onChange={(e) => syncSlot(slot.id, { endTime: e.target.value })}
                />
              </label>
              <label className="text-xs text-graphite flex-1 min-w-[200px]">
                工作模块
                <input
                  className="input-field mt-1 w-full text-sm"
                  value={slot.moduleName}
                  onChange={(e) => syncSlot(slot.id, { moduleName: e.target.value })}
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-graphite">
                <input type="checkbox" checked={slot.enabled} onChange={(e) => syncSlot(slot.id, { enabled: e.target.checked })} />
                启用
              </label>
              <label className="text-xs text-graphite">
                排序
                <input
                  type="number"
                  className="input-field mt-1 w-[72px] text-sm"
                  value={slot.sort}
                  onChange={(e) => syncSlot(slot.id, { sort: Number(e.target.value) || 0 })}
                />
              </label>
              <button type="button" className="text-xs text-red-700 underline" onClick={() => removeSlot(slot.id)}>
                删除时段
              </button>
            </div>

            <div className="mt-3 space-y-2 border-t border-ash pt-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-coal-ink">动作列表</span>
                <button type="button" className="btn-ghost text-xs" onClick={() => addAction(slot.id)}>
                  添加动作
                </button>
              </div>
              {slot.actions.map((act) => (
                <div key={act.id} className="rounded-lg border border-ash/80 bg-ledger-white p-2 text-xs">
                  <label className="block text-graphite">
                    动作内容
                    <textarea
                      className="input-field mt-1 min-h-[40px] w-full text-sm"
                      value={act.actionText}
                      onChange={(e) => syncAction(slot.id, act.id, { actionText: e.target.value })}
                    />
                  </label>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="text-graphite">
                      类型
                      <select
                        className="input-field mt-1 w-full text-sm"
                        value={act.actionType}
                        onChange={(e) => syncAction(slot.id, act.id, { actionType: e.target.value as SopActionType })}
                      >
                        {ACTION_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {ACTION_TYPE_LABEL[t]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-center gap-2 pt-5 text-graphite">
                      <input
                        type="checkbox"
                        checked={act.isRequired}
                        onChange={(e) => syncAction(slot.id, act.id, { isRequired: e.target.checked })}
                      />
                      必做
                    </label>
                    <label className="flex items-center gap-2 pt-5 text-graphite">
                      <input
                        type="checkbox"
                        checked={act.needProof}
                        onChange={(e) => syncAction(slot.id, act.id, { needProof: e.target.checked })}
                      />
                      需截图
                    </label>
                    <label className="text-graphite">
                      关联模块
                      <select
                        className="input-field mt-1 w-full text-sm"
                        value={act.relatedModule}
                        onChange={(e) => syncAction(slot.id, act.id, { relatedModule: e.target.value as RelatedModule })}
                      >
                        {MODULE_KEYS.map((k) => (
                          <option key={k} value={k}>
                            {RELATED_MODULE_LABELS[k]}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <button type="button" className="mt-2 text-red-700 underline" onClick={() => removeAction(slot.id, act.id)}>
                    删除动作
                  </button>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <button type="button" className="btn-primary text-sm" onClick={() => onSave(normalizeSort(draft))}>
        保存 SOP 模板
      </button>
    </div>
  );
}
