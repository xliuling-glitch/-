'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  linesToList,
  listToLines,
  type BasicDictRow,
  type ConfigCenterV2,
  type CustomerTypeRow,
  type FollowupStatusRow,
  type InquiryTypeRow,
  type LostReasonRow,
  type ReminderRuleRow,
  type ReviewTaskRuleRow,
  type RolePermissionRow,
  type ShopRow,
  type StaffRow,
  type TodayTaskTemplateRow,
  type LegacyOptions,
} from '@/lib/config-center-v2';
import { ConfigCenterSopPanel } from '@/components/config-center/ConfigCenterSopPanel';
import { ConfigCenterKpiSettingsPanel } from '@/components/config-center/ConfigCenterKpiSettingsPanel';

const TABS = [
  { id: 'basic', label: '基础字典' },
  { id: 'shops', label: '店铺' },
  { id: 'inquiry', label: '咨询类型' },
  { id: 'customer', label: '客户类型' },
  { id: 'status', label: '跟进状态' },
  { id: 'lost', label: '未成交原因' },
  { id: 'staff', label: '员工' },
  { id: 'kpi', label: 'KPI 设置' },
  { id: 'tasks', label: '今日任务模板' },
  { id: 'sop_timeline', label: 'SOP时间轴配置' },
  { id: 'review', label: '评价任务规则' },
  { id: 'remind', label: '提醒规则' },
  { id: 'roles', label: '权限角色' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function rid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function move<T>(rows: T[], i: number, delta: -1 | 1): T[] {
  const j = i + delta;
  if (j < 0 || j >= rows.length) return rows;
  const next = [...rows];
  [next[i], next[j]] = [next[j], next[i]];
  return next.map((r, idx) => ({ ...(r as object), sortOrder: idx })) as T[];
}

function Th({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <th
      className={`border-b border-black/10 bg-[var(--color-ash)] px-2 py-2 text-left text-xs font-semibold text-[var(--color-graphite)] ${className}`}
    >
      {children}
    </th>
  );
}

function cellClass(disabled: boolean) {
  return `border-b border-black/5 px-1 py-1 align-middle ${disabled ? 'opacity-60' : ''}`;
}

function BoolCell({
  v,
  onChange,
  disabled,
}: {
  v: boolean;
  onChange: (b: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <input
      type="checkbox"
      className="h-4 w-4 accent-[var(--color-smolder)]"
      checked={v}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
    />
  );
}

function TextCell({
  v,
  onChange,
  disabled,
  narrow,
}: {
  v: string;
  onChange: (s: string) => void;
  disabled?: boolean;
  narrow?: boolean;
}) {
  return (
    <input
      type="text"
      className={`input-field min-h-0 py-1.5 text-xs ${narrow ? 'max-w-[5.5rem]' : ''}`}
      value={v}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function NumCell({
  v,
  onChange,
  disabled,
  step,
}: {
  v: number;
  onChange: (n: number) => void;
  disabled?: boolean;
  step?: string;
}) {
  return (
    <input
      type="number"
      step={step ?? '1'}
      className="input-field min-h-0 max-w-[6rem] py-1.5 text-xs"
      value={Number.isFinite(v) ? v : 0}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

function RowActions({
  i,
  len,
  onMove,
  onDelete,
  disabled,
}: {
  i: number;
  len: number;
  onMove: (d: -1 | 1) => void;
  onDelete: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-0.5">
      <button type="button" className="btn-ghost px-2 py-0.5 text-[10px]" disabled={disabled || i === 0} onClick={() => onMove(-1)}>
        上移
      </button>
      <button
        type="button"
        className="btn-ghost px-2 py-0.5 text-[10px]"
        disabled={disabled || i >= len - 1}
        onClick={() => onMove(1)}
      >
        下移
      </button>
      <button type="button" className="btn-ghost px-2 py-0.5 text-[10px] text-red-700" disabled={disabled} onClick={onDelete}>
        删除
      </button>
    </div>
  );
}

export function ConfigCenterApp() {
  const [tab, setTab] = useState<TabId>('shops');
  const [config, setConfig] = useState<ConfigCenterV2 | null>(null);
  const [legacyPreview, setLegacyPreview] = useState<LegacyOptions | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [legacyText, setLegacyText] = useState<Record<keyof LegacyOptions, string>>({
    shops: '',
    inquiry_types: '',
    customer_types: '',
    status_options: '',
    lost_reasons: '',
    staff_roster: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/config-center/v2', { credentials: 'include' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || '加载失败');
      setConfig(d.config);
      setLegacyPreview(d.legacyPreview);
      setCanEdit(!!d.canEdit);
      setDirty(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openImport = () => {
    if (legacyPreview) {
      setLegacyText({
        shops: listToLines(legacyPreview.shops),
        inquiry_types: listToLines(legacyPreview.inquiry_types),
        customer_types: listToLines(legacyPreview.customer_types),
        status_options: listToLines(legacyPreview.status_options),
        lost_reasons: listToLines(legacyPreview.lost_reasons),
        staff_roster: listToLines(legacyPreview.staff_roster),
      });
    }
    setImportOpen(true);
  };

  const markDirty = () => setDirty(true);

  const save = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const r = await fetch('/api/config-center/v2', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', config }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || '保存失败');
      setConfig(d.config);
      setLegacyPreview(null);
      void load();
      setDirty(false);
      alert('配置已保存，并已同步旧版下拉选项（/api/options）。');
    } catch (e) {
      alert(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const restoreDefault = async () => {
    if (!confirm('确定恢复为系统默认配置？当前未保存的修改将丢失。')) return;
    setSaving(true);
    try {
      const r = await fetch('/api/config-center/v2', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore_default' }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || '操作失败');
      setConfig(d.config);
      setDirty(false);
      void load();
      alert('已恢复默认并写入数据库。');
    } catch (e) {
      alert(e instanceof Error ? e.message : '操作失败');
    } finally {
      setSaving(false);
    }
  };

  const exportJson = () => {
    if (!config) return;
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `config-center-v2-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importJsonFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const parsed = JSON.parse(String(reader.result));
          if (!canEdit) {
            alert('无权限写入，请联系管理员导入。');
            return;
          }
          const r = await fetch('/api/config-center/v2', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'import_json', config: parsed }),
          });
          const d = await r.json();
          if (!r.ok) throw new Error(d.error || '导入失败');
          setConfig(d.config);
          setDirty(false);
          void load();
          alert('JSON 配置已导入并保存。');
        } catch (e) {
          alert(e instanceof Error ? e.message : '解析或导入失败');
        }
      };
      reader.readAsText(f);
    };
    input.click();
  };

  const applyLegacyImport = async () => {
    if (!canEdit) {
      alert('无权限');
      return;
    }
    const legacy: Partial<LegacyOptions> = {
      shops: linesToList(legacyText.shops),
      inquiry_types: linesToList(legacyText.inquiry_types),
      customer_types: linesToList(legacyText.customer_types),
      status_options: linesToList(legacyText.status_options),
      lost_reasons: linesToList(legacyText.lost_reasons),
      staff_roster: linesToList(legacyText.staff_roster),
    };
    setSaving(true);
    try {
      const r = await fetch('/api/config-center/v2', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'import_legacy', legacy }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || '导入失败');
      setConfig(d.config);
      setImportOpen(false);
      setDirty(false);
      void load();
      alert('已按旧版文本合并到结构化配置并保存。');
    } catch (e) {
      alert(e instanceof Error ? e.message : '导入失败');
    } finally {
      setSaving(false);
    }
  };

  const disabled = !canEdit || saving;

  function applyPatch<K extends keyof ConfigCenterV2>(key: K, fn: (rows: ConfigCenterV2[K]) => ConfigCenterV2[K]) {
    setConfig((c) => (c ? { ...c, [key]: fn(c[key]) } : c));
    markDirty();
  }

  function renderPanel(): ReactNode {
    if (!config) return null;
    const ro = disabled;

    switch (tab) {
      case 'basic':
        return (
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr>
                <Th className="w-10">序</Th>
                <Th>字典键</Th>
                <Th>显示名</Th>
                <Th>值</Th>
                <Th className="w-14">启用</Th>
                <Th>备注</Th>
                <Th className="w-44">操作</Th>
              </tr>
            </thead>
            <tbody>
              {config.basicDict.map((row, i) => (
                <tr key={row.id}>
                  <td className={cellClass(ro)}>{i + 1}</td>
                  <td className={cellClass(ro)}>
                    <TextCell v={row.dictKey} disabled={ro} onChange={(dictKey) => applyPatch('basicDict', (rows) => rows.map((r, j) => (j === i ? { ...r, dictKey } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <TextCell v={row.label} disabled={ro} onChange={(label) => applyPatch('basicDict', (rows) => rows.map((r, j) => (j === i ? { ...r, label } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <TextCell v={row.value} disabled={ro} onChange={(value) => applyPatch('basicDict', (rows) => rows.map((r, j) => (j === i ? { ...r, value } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <BoolCell v={row.enabled} disabled={ro} onChange={(enabled) => applyPatch('basicDict', (rows) => rows.map((r, j) => (j === i ? { ...r, enabled } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <TextCell v={row.remark} disabled={ro} onChange={(remark) => applyPatch('basicDict', (rows) => rows.map((r, j) => (j === i ? { ...r, remark } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <RowActions
                      i={i}
                      len={config.basicDict.length}
                      disabled={ro}
                      onMove={(d) => applyPatch('basicDict', (rows) => move(rows, i, d))}
                      onDelete={() => applyPatch('basicDict', (rows) => rows.filter((_, j) => j !== i))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      case 'shops': {
        const rows = config.shops;
        return (
          <table className="w-full min-w-[960px] border-collapse text-sm">
            <thead>
              <tr>
                <Th className="w-10">序</Th>
                <Th>店铺名称</Th>
                <Th>所属平台</Th>
                <Th>负责人</Th>
                <Th className="w-14">参与 KPI</Th>
                <Th className="w-14">评价任务</Th>
                <Th className="w-14">启用</Th>
                <Th>备注</Th>
                <Th className="w-44">操作</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row: ShopRow, i) => (
                <tr key={row.id}>
                  <td className={cellClass(ro)}>{i + 1}</td>
                  <td className={cellClass(ro)}>
                    <TextCell v={row.name} disabled={ro} onChange={(name) => applyPatch('shops', (rs) => rs.map((r, j) => (j === i ? { ...r, name } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <TextCell v={row.platform} disabled={ro} onChange={(platform) => applyPatch('shops', (rs) => rs.map((r, j) => (j === i ? { ...r, platform } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <TextCell v={row.owner} disabled={ro} onChange={(owner) => applyPatch('shops', (rs) => rs.map((r, j) => (j === i ? { ...r, owner } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <BoolCell v={row.joinKpi} disabled={ro} onChange={(joinKpi) => applyPatch('shops', (rs) => rs.map((r, j) => (j === i ? { ...r, joinKpi } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <BoolCell v={row.joinReviewTask} disabled={ro} onChange={(joinReviewTask) => applyPatch('shops', (rs) => rs.map((r, j) => (j === i ? { ...r, joinReviewTask } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <BoolCell v={row.enabled} disabled={ro} onChange={(enabled) => applyPatch('shops', (rs) => rs.map((r, j) => (j === i ? { ...r, enabled } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <TextCell v={row.remark} disabled={ro} onChange={(remark) => applyPatch('shops', (rs) => rs.map((r, j) => (j === i ? { ...r, remark } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <RowActions
                      i={i}
                      len={rows.length}
                      disabled={ro}
                      onMove={(d) => applyPatch('shops', (rs) => move(rs, i, d))}
                      onDelete={() => applyPatch('shops', (rs) => rs.filter((_, j) => j !== i))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      }
      case 'inquiry':
        return (
          <table className="w-full min-w-[800px] border-collapse text-sm">
            <thead>
              <tr>
                <Th className="w-10">序</Th>
                <Th>咨询类型名称</Th>
                <Th>所属产品线</Th>
                <Th className="w-14">启用</Th>
                <Th>排序</Th>
                <Th>备注</Th>
                <Th className="w-44">操作</Th>
              </tr>
            </thead>
            <tbody>
              {config.inquiryTypes.map((row: InquiryTypeRow, i) => (
                <tr key={row.id}>
                  <td className={cellClass(ro)}>{i + 1}</td>
                  <td className={cellClass(ro)}>
                    <TextCell v={row.name} disabled={ro} onChange={(name) => applyPatch('inquiryTypes', (rs) => rs.map((r, j) => (j === i ? { ...r, name } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <TextCell v={row.productLine} disabled={ro} onChange={(productLine) => applyPatch('inquiryTypes', (rs) => rs.map((r, j) => (j === i ? { ...r, productLine } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <BoolCell v={row.enabled} disabled={ro} onChange={(enabled) => applyPatch('inquiryTypes', (rs) => rs.map((r, j) => (j === i ? { ...r, enabled } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <NumCell v={row.sortOrder} disabled={ro} onChange={(sortOrder) => applyPatch('inquiryTypes', (rs) => rs.map((r, j) => (j === i ? { ...r, sortOrder } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <TextCell v={row.remark} disabled={ro} onChange={(remark) => applyPatch('inquiryTypes', (rs) => rs.map((r, j) => (j === i ? { ...r, remark } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <RowActions
                      i={i}
                      len={config.inquiryTypes.length}
                      disabled={ro}
                      onMove={(d) => applyPatch('inquiryTypes', (rs) => move(rs, i, d))}
                      onDelete={() => applyPatch('inquiryTypes', (rs) => rs.filter((_, j) => j !== i))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      case 'customer':
        return (
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <thead>
              <tr>
                <Th className="w-10">序</Th>
                <Th>客户类型名称</Th>
                <Th className="w-16">高价值</Th>
                <Th className="w-14">启用</Th>
                <Th>排序</Th>
                <Th>说明</Th>
                <Th>备注</Th>
                <Th className="w-44">操作</Th>
              </tr>
            </thead>
            <tbody>
              {config.customerTypes.map((row: CustomerTypeRow, i) => (
                <tr key={row.id}>
                  <td className={cellClass(ro)}>{i + 1}</td>
                  <td className={cellClass(ro)}>
                    <TextCell v={row.name} disabled={ro} onChange={(name) => applyPatch('customerTypes', (rs) => rs.map((r, j) => (j === i ? { ...r, name } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <BoolCell v={row.highValue} disabled={ro} onChange={(highValue) => applyPatch('customerTypes', (rs) => rs.map((r, j) => (j === i ? { ...r, highValue } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <BoolCell v={row.enabled} disabled={ro} onChange={(enabled) => applyPatch('customerTypes', (rs) => rs.map((r, j) => (j === i ? { ...r, enabled } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <NumCell v={row.sortOrder} disabled={ro} onChange={(sortOrder) => applyPatch('customerTypes', (rs) => rs.map((r, j) => (j === i ? { ...r, sortOrder } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <TextCell v={row.description} disabled={ro} onChange={(description) => applyPatch('customerTypes', (rs) => rs.map((r, j) => (j === i ? { ...r, description } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <TextCell v={row.remark} disabled={ro} onChange={(remark) => applyPatch('customerTypes', (rs) => rs.map((r, j) => (j === i ? { ...r, remark } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <RowActions
                      i={i}
                      len={config.customerTypes.length}
                      disabled={ro}
                      onMove={(d) => applyPatch('customerTypes', (rs) => move(rs, i, d))}
                      onDelete={() => applyPatch('customerTypes', (rs) => rs.filter((_, j) => j !== i))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      case 'status':
        return (
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead>
              <tr>
                <Th className="w-10">序</Th>
                <Th>状态名称</Th>
                <Th>所属阶段</Th>
                <Th className="w-16">有效跟进</Th>
                <Th className="w-14">成交</Th>
                <Th className="w-14">流失</Th>
                <Th className="w-14">启用</Th>
                <Th>排序</Th>
                <Th>备注</Th>
                <Th className="w-44">操作</Th>
              </tr>
            </thead>
            <tbody>
              {config.followupStatuses.map((row: FollowupStatusRow, i) => (
                <tr key={row.id}>
                  <td className={cellClass(ro)}>{i + 1}</td>
                  <td className={cellClass(ro)}>
                    <TextCell v={row.name} disabled={ro} onChange={(name) => applyPatch('followupStatuses', (rs) => rs.map((r, j) => (j === i ? { ...r, name } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <TextCell v={row.stage} disabled={ro} onChange={(stage) => applyPatch('followupStatuses', (rs) => rs.map((r, j) => (j === i ? { ...r, stage } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <BoolCell
                      v={row.countsAsValidFollowup}
                      disabled={ro}
                      onChange={(countsAsValidFollowup) =>
                        applyPatch('followupStatuses', (rs) => rs.map((r, j) => (j === i ? { ...r, countsAsValidFollowup } : r)))
                      }
                    />
                  </td>
                  <td className={cellClass(ro)}>
                    <BoolCell v={row.isDealStatus} disabled={ro} onChange={(isDealStatus) => applyPatch('followupStatuses', (rs) => rs.map((r, j) => (j === i ? { ...r, isDealStatus } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <BoolCell v={row.isLostStatus} disabled={ro} onChange={(isLostStatus) => applyPatch('followupStatuses', (rs) => rs.map((r, j) => (j === i ? { ...r, isLostStatus } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <BoolCell v={row.enabled} disabled={ro} onChange={(enabled) => applyPatch('followupStatuses', (rs) => rs.map((r, j) => (j === i ? { ...r, enabled } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <NumCell v={row.sortOrder} disabled={ro} onChange={(sortOrder) => applyPatch('followupStatuses', (rs) => rs.map((r, j) => (j === i ? { ...r, sortOrder } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <TextCell v={row.remark} disabled={ro} onChange={(remark) => applyPatch('followupStatuses', (rs) => rs.map((r, j) => (j === i ? { ...r, remark } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <RowActions
                      i={i}
                      len={config.followupStatuses.length}
                      disabled={ro}
                      onMove={(d) => applyPatch('followupStatuses', (rs) => move(rs, i, d))}
                      onDelete={() => applyPatch('followupStatuses', (rs) => rs.filter((_, j) => j !== i))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      case 'lost':
        return (
          <table className="w-full min-w-[880px] border-collapse text-sm">
            <thead>
              <tr>
                <Th className="w-10">序</Th>
                <Th>原因名称</Th>
                <Th>原因分类</Th>
                <Th className="w-16">重点复盘</Th>
                <Th className="w-14">启用</Th>
                <Th>备注</Th>
                <Th className="w-44">操作</Th>
              </tr>
            </thead>
            <tbody>
              {config.lostReasons.map((row: LostReasonRow, i) => (
                <tr key={row.id}>
                  <td className={cellClass(ro)}>{i + 1}</td>
                  <td className={cellClass(ro)}>
                    <TextCell v={row.name} disabled={ro} onChange={(name) => applyPatch('lostReasons', (rs) => rs.map((r, j) => (j === i ? { ...r, name } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <TextCell v={row.category} disabled={ro} onChange={(category) => applyPatch('lostReasons', (rs) => rs.map((r, j) => (j === i ? { ...r, category } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <BoolCell v={row.keyReview} disabled={ro} onChange={(keyReview) => applyPatch('lostReasons', (rs) => rs.map((r, j) => (j === i ? { ...r, keyReview } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <BoolCell v={row.enabled} disabled={ro} onChange={(enabled) => applyPatch('lostReasons', (rs) => rs.map((r, j) => (j === i ? { ...r, enabled } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <TextCell v={row.remark} disabled={ro} onChange={(remark) => applyPatch('lostReasons', (rs) => rs.map((r, j) => (j === i ? { ...r, remark } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <RowActions
                      i={i}
                      len={config.lostReasons.length}
                      disabled={ro}
                      onMove={(d) => applyPatch('lostReasons', (rs) => move(rs, i, d))}
                      onDelete={() => applyPatch('lostReasons', (rs) => rs.filter((_, j) => j !== i))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      case 'staff':
        return (
          <table className="w-full min-w-[1100px] border-collapse text-sm">
            <thead>
              <tr>
                <Th className="w-10">序</Th>
                <Th>员工姓名</Th>
                <Th>登录账号</Th>
                <Th>角色</Th>
                <Th>所属小组</Th>
                <Th className="w-14">排班</Th>
                <Th className="w-14">KPI</Th>
                <Th className="w-14">晚班</Th>
                <Th className="w-14">启用</Th>
                <Th>备注</Th>
                <Th className="w-44">操作</Th>
              </tr>
            </thead>
            <tbody>
              {config.staff.map((row: StaffRow, i) => (
                <tr key={row.id}>
                  <td className={cellClass(ro)}>{i + 1}</td>
                  <td className={cellClass(ro)}>
                    <TextCell v={row.displayName} disabled={ro} onChange={(displayName) => applyPatch('staff', (rs) => rs.map((r, j) => (j === i ? { ...r, displayName } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <TextCell v={row.loginUsername} disabled={ro} onChange={(loginUsername) => applyPatch('staff', (rs) => rs.map((r, j) => (j === i ? { ...r, loginUsername } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <TextCell v={row.roleName} disabled={ro} onChange={(roleName) => applyPatch('staff', (rs) => rs.map((r, j) => (j === i ? { ...r, roleName } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <TextCell v={row.team} disabled={ro} onChange={(team) => applyPatch('staff', (rs) => rs.map((r, j) => (j === i ? { ...r, team } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <BoolCell v={row.joinSchedule} disabled={ro} onChange={(joinSchedule) => applyPatch('staff', (rs) => rs.map((r, j) => (j === i ? { ...r, joinSchedule } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <BoolCell v={row.joinKpi} disabled={ro} onChange={(joinKpi) => applyPatch('staff', (rs) => rs.map((r, j) => (j === i ? { ...r, joinKpi } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <BoolCell v={row.nightShiftOk} disabled={ro} onChange={(nightShiftOk) => applyPatch('staff', (rs) => rs.map((r, j) => (j === i ? { ...r, nightShiftOk } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <BoolCell v={row.enabled} disabled={ro} onChange={(enabled) => applyPatch('staff', (rs) => rs.map((r, j) => (j === i ? { ...r, enabled } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <TextCell v={row.remark} disabled={ro} onChange={(remark) => applyPatch('staff', (rs) => rs.map((r, j) => (j === i ? { ...r, remark } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <RowActions
                      i={i}
                      len={config.staff.length}
                      disabled={ro}
                      onMove={(d) => applyPatch('staff', (rs) => move(rs, i, d))}
                      onDelete={() => applyPatch('staff', (rs) => rs.filter((_, j) => j !== i))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      case 'kpi':
        return (
          <ConfigCenterKpiSettingsPanel
            canEdit={canEdit}
            ro={ro}
            shops={config.shops.filter((s) => s.enabled).map((s) => s.name)}
            staff={config.staff}
            legacyKpiMetrics={config.kpiMetrics}
            onLegacyKpiPatch={(fn) => applyPatch('kpiMetrics', fn)}
          />
        );
      case 'tasks':
        return (
          <table className="w-full min-w-[1080px] border-collapse text-sm">
            <thead>
              <tr>
                <Th className="w-10">序</Th>
                <Th>任务名称</Th>
                <Th>任务类型</Th>
                <Th>适用班次</Th>
                <Th>开始</Th>
                <Th>结束</Th>
                <Th>优先级</Th>
                <Th>完成方式</Th>
                <Th className="w-14">审核</Th>
                <Th className="w-14">启用</Th>
                <Th>备注</Th>
                <Th className="w-44">操作</Th>
              </tr>
            </thead>
            <tbody>
              {config.todayTaskTemplates.map((row: TodayTaskTemplateRow, i) => (
                <tr key={row.id}>
                  <td className={cellClass(ro)}>{i + 1}</td>
                  <td className={cellClass(ro)}>
                    <TextCell v={row.name} disabled={ro} onChange={(name) => applyPatch('todayTaskTemplates', (rs) => rs.map((r, j) => (j === i ? { ...r, name } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <TextCell v={row.taskType} disabled={ro} onChange={(taskType) => applyPatch('todayTaskTemplates', (rs) => rs.map((r, j) => (j === i ? { ...r, taskType } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <TextCell v={row.shiftApplicable} disabled={ro} onChange={(shiftApplicable) => applyPatch('todayTaskTemplates', (rs) => rs.map((r, j) => (j === i ? { ...r, shiftApplicable } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <TextCell v={row.defaultStartTime} disabled={ro} narrow onChange={(defaultStartTime) => applyPatch('todayTaskTemplates', (rs) => rs.map((r, j) => (j === i ? { ...r, defaultStartTime } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <TextCell v={row.defaultEndTime} disabled={ro} narrow onChange={(defaultEndTime) => applyPatch('todayTaskTemplates', (rs) => rs.map((r, j) => (j === i ? { ...r, defaultEndTime } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <TextCell v={row.defaultPriority} disabled={ro} narrow onChange={(defaultPriority) => applyPatch('todayTaskTemplates', (rs) => rs.map((r, j) => (j === i ? { ...r, defaultPriority } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <TextCell v={row.completionMode} disabled={ro} onChange={(completionMode) => applyPatch('todayTaskTemplates', (rs) => rs.map((r, j) => (j === i ? { ...r, completionMode } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <BoolCell v={row.needReview} disabled={ro} onChange={(needReview) => applyPatch('todayTaskTemplates', (rs) => rs.map((r, j) => (j === i ? { ...r, needReview } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <BoolCell v={row.enabled} disabled={ro} onChange={(enabled) => applyPatch('todayTaskTemplates', (rs) => rs.map((r, j) => (j === i ? { ...r, enabled } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <TextCell v={row.remark} disabled={ro} onChange={(remark) => applyPatch('todayTaskTemplates', (rs) => rs.map((r, j) => (j === i ? { ...r, remark } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <RowActions
                      i={i}
                      len={config.todayTaskTemplates.length}
                      disabled={ro}
                      onMove={(d) => applyPatch('todayTaskTemplates', (rs) => move(rs, i, d))}
                      onDelete={() => applyPatch('todayTaskTemplates', (rs) => rs.filter((_, j) => j !== i))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      case 'review':
        return (
          <table className="w-full min-w-[960px] border-collapse text-sm">
            <thead>
              <tr>
                <Th className="w-10">序</Th>
                <Th>规则名称</Th>
                <Th>评价类型</Th>
                <Th>KPI 权重</Th>
                <Th className="w-14">截图</Th>
                <Th className="w-14">订单号</Th>
                <Th className="w-14">主管审</Th>
                <Th className="w-14">启用</Th>
                <Th>备注</Th>
                <Th className="w-44">操作</Th>
              </tr>
            </thead>
            <tbody>
              {config.reviewTaskRules.map((row: ReviewTaskRuleRow, i) => (
                <tr key={row.id}>
                  <td className={cellClass(ro)}>{i + 1}</td>
                  <td className={cellClass(ro)}>
                    <TextCell v={row.name} disabled={ro} onChange={(name) => applyPatch('reviewTaskRules', (rs) => rs.map((r, j) => (j === i ? { ...r, name } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <TextCell v={row.reviewType} disabled={ro} onChange={(reviewType) => applyPatch('reviewTaskRules', (rs) => rs.map((r, j) => (j === i ? { ...r, reviewType } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <NumCell step="0.1" v={row.kpiWeight} disabled={ro} onChange={(kpiWeight) => applyPatch('reviewTaskRules', (rs) => rs.map((r, j) => (j === i ? { ...r, kpiWeight } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <BoolCell v={row.needScreenshot} disabled={ro} onChange={(needScreenshot) => applyPatch('reviewTaskRules', (rs) => rs.map((r, j) => (j === i ? { ...r, needScreenshot } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <BoolCell v={row.needOrderNo} disabled={ro} onChange={(needOrderNo) => applyPatch('reviewTaskRules', (rs) => rs.map((r, j) => (j === i ? { ...r, needOrderNo } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <BoolCell
                      v={row.needManagerApproval}
                      disabled={ro}
                      onChange={(needManagerApproval) => applyPatch('reviewTaskRules', (rs) => rs.map((r, j) => (j === i ? { ...r, needManagerApproval } : r)))}
                    />
                  </td>
                  <td className={cellClass(ro)}>
                    <BoolCell v={row.enabled} disabled={ro} onChange={(enabled) => applyPatch('reviewTaskRules', (rs) => rs.map((r, j) => (j === i ? { ...r, enabled } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <TextCell v={row.remark} disabled={ro} onChange={(remark) => applyPatch('reviewTaskRules', (rs) => rs.map((r, j) => (j === i ? { ...r, remark } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <RowActions
                      i={i}
                      len={config.reviewTaskRules.length}
                      disabled={ro}
                      onMove={(d) => applyPatch('reviewTaskRules', (rs) => move(rs, i, d))}
                      onDelete={() => applyPatch('reviewTaskRules', (rs) => rs.filter((_, j) => j !== i))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      case 'remind':
        return (
          <table className="w-full min-w-[920px] border-collapse text-sm">
            <thead>
              <tr>
                <Th className="w-10">序</Th>
                <Th>提醒名称</Th>
                <Th>提醒场景</Th>
                <Th>提前(分钟)</Th>
                <Th>提醒对象</Th>
                <Th>提醒方式</Th>
                <Th className="w-14">启用</Th>
                <Th>备注</Th>
                <Th className="w-44">操作</Th>
              </tr>
            </thead>
            <tbody>
              {config.reminderRules.map((row: ReminderRuleRow, i) => (
                <tr key={row.id}>
                  <td className={cellClass(ro)}>{i + 1}</td>
                  <td className={cellClass(ro)}>
                    <TextCell v={row.name} disabled={ro} onChange={(name) => applyPatch('reminderRules', (rs) => rs.map((r, j) => (j === i ? { ...r, name } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <TextCell v={row.scene} disabled={ro} onChange={(scene) => applyPatch('reminderRules', (rs) => rs.map((r, j) => (j === i ? { ...r, scene } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <NumCell v={row.leadMinutes} disabled={ro} onChange={(leadMinutes) => applyPatch('reminderRules', (rs) => rs.map((r, j) => (j === i ? { ...r, leadMinutes } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <TextCell v={row.targetRole} disabled={ro} onChange={(targetRole) => applyPatch('reminderRules', (rs) => rs.map((r, j) => (j === i ? { ...r, targetRole } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <TextCell v={row.channel} disabled={ro} onChange={(channel) => applyPatch('reminderRules', (rs) => rs.map((r, j) => (j === i ? { ...r, channel } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <BoolCell v={row.enabled} disabled={ro} onChange={(enabled) => applyPatch('reminderRules', (rs) => rs.map((r, j) => (j === i ? { ...r, enabled } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <TextCell v={row.remark} disabled={ro} onChange={(remark) => applyPatch('reminderRules', (rs) => rs.map((r, j) => (j === i ? { ...r, remark } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <RowActions
                      i={i}
                      len={config.reminderRules.length}
                      disabled={ro}
                      onMove={(d) => applyPatch('reminderRules', (rs) => move(rs, i, d))}
                      onDelete={() => applyPatch('reminderRules', (rs) => rs.filter((_, j) => j !== i))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      case 'roles':
        return (
          <table className="w-full min-w-[800px] border-collapse text-sm">
            <thead>
              <tr>
                <Th className="w-10">序</Th>
                <Th>角色名称</Th>
                <Th>代码</Th>
                <Th>权限摘要</Th>
                <Th className="w-14">启用</Th>
                <Th>排序</Th>
                <Th>备注</Th>
                <Th className="w-44">操作</Th>
              </tr>
            </thead>
            <tbody>
              {config.rolePermissions.map((row: RolePermissionRow, i) => (
                <tr key={row.id}>
                  <td className={cellClass(ro)}>{i + 1}</td>
                  <td className={cellClass(ro)}>
                    <TextCell v={row.name} disabled={ro} onChange={(name) => applyPatch('rolePermissions', (rs) => rs.map((r, j) => (j === i ? { ...r, name } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <TextCell v={row.code} disabled={ro} narrow onChange={(code) => applyPatch('rolePermissions', (rs) => rs.map((r, j) => (j === i ? { ...r, code } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <TextCell v={row.permissionsSummary} disabled={ro} onChange={(permissionsSummary) => applyPatch('rolePermissions', (rs) => rs.map((r, j) => (j === i ? { ...r, permissionsSummary } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <BoolCell v={row.enabled} disabled={ro} onChange={(enabled) => applyPatch('rolePermissions', (rs) => rs.map((r, j) => (j === i ? { ...r, enabled } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <NumCell v={row.sortOrder} disabled={ro} onChange={(sortOrder) => applyPatch('rolePermissions', (rs) => rs.map((r, j) => (j === i ? { ...r, sortOrder } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <TextCell v={row.remark} disabled={ro} onChange={(remark) => applyPatch('rolePermissions', (rs) => rs.map((r, j) => (j === i ? { ...r, remark } : r)))} />
                  </td>
                  <td className={cellClass(ro)}>
                    <RowActions
                      i={i}
                      len={config.rolePermissions.length}
                      disabled={ro}
                      onMove={(d) => applyPatch('rolePermissions', (rs) => move(rs, i, d))}
                      onDelete={() => applyPatch('rolePermissions', (rs) => rs.filter((_, j) => j !== i))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      case 'sop_timeline':
        return <ConfigCenterSopPanel canEdit={canEdit} />;
      default:
        return null;
    }
  }

  const addRow = () => {
    if (!config) return;
    markDirty();
    setConfig((c) => {
      if (!c) return c;
      switch (tab) {
        case 'basic':
          return {
            ...c,
            basicDict: [
              ...c.basicDict,
              { id: rid(), enabled: true, sortOrder: c.basicDict.length, remark: '', dictKey: '', label: '', value: '' },
            ],
          };
        case 'shops':
          return {
            ...c,
            shops: [
              ...c.shops,
              {
                id: rid(),
                enabled: true,
                sortOrder: c.shops.length,
                remark: '',
                name: '新店铺',
                platform: '',
                owner: '',
                joinKpi: true,
                joinReviewTask: true,
              },
            ],
          };
        case 'inquiry':
          return {
            ...c,
            inquiryTypes: [
              ...c.inquiryTypes,
              { id: rid(), enabled: true, sortOrder: c.inquiryTypes.length, remark: '', name: '新类型', productLine: '' },
            ],
          };
        case 'customer':
          return {
            ...c,
            customerTypes: [
              ...c.customerTypes,
              {
                id: rid(),
                enabled: true,
                sortOrder: c.customerTypes.length,
                remark: '',
                name: '新客户类型',
                highValue: false,
                description: '',
              },
            ],
          };
        case 'status':
          return {
            ...c,
            followupStatuses: [
              ...c.followupStatuses,
              {
                id: rid(),
                enabled: true,
                sortOrder: c.followupStatuses.length,
                remark: '',
                name: '新状态',
                stage: '跟进中',
                countsAsValidFollowup: true,
                isDealStatus: false,
                isLostStatus: false,
              },
            ],
          };
        case 'lost':
          return {
            ...c,
            lostReasons: [
              ...c.lostReasons,
              { id: rid(), enabled: true, sortOrder: c.lostReasons.length, remark: '', name: '新原因', category: '通用', keyReview: false },
            ],
          };
        case 'staff':
          return {
            ...c,
            staff: [
              ...c.staff,
              {
                id: rid(),
                enabled: true,
                sortOrder: c.staff.length,
                remark: '',
                displayName: '新员工',
                loginUsername: '',
                roleName: '客服',
                team: '',
                joinSchedule: true,
                joinKpi: true,
                nightShiftOk: false,
              },
            ],
          };
        case 'kpi':
          return c;
        case 'tasks':
          return {
            ...c,
            todayTaskTemplates: [
              ...c.todayTaskTemplates,
              {
                id: rid(),
                enabled: true,
                sortOrder: c.todayTaskTemplates.length,
                remark: '',
                name: '新任务模板',
                taskType: '例行',
                shiftApplicable: '全班',
                defaultStartTime: '09:00',
                defaultEndTime: '18:00',
                defaultPriority: '中',
                completionMode: '打卡',
                needReview: false,
              },
            ],
          };
        case 'review':
          return {
            ...c,
            reviewTaskRules: [
              ...c.reviewTaskRules,
              {
                id: rid(),
                enabled: true,
                sortOrder: c.reviewTaskRules.length,
                remark: '',
                name: '新规则',
                reviewType: '好评',
                kpiWeight: 1,
                needScreenshot: false,
                needOrderNo: false,
                needManagerApproval: false,
              },
            ],
          };
        case 'remind':
          return {
            ...c,
            reminderRules: [
              ...c.reminderRules,
              {
                id: rid(),
                enabled: true,
                sortOrder: c.reminderRules.length,
                remark: '',
                name: '新提醒',
                scene: '',
                leadMinutes: 30,
                targetRole: '所属客服',
                channel: '站内消息',
              },
            ],
          };
        case 'roles':
          return {
            ...c,
            rolePermissions: [
              ...c.rolePermissions,
              {
                id: rid(),
                enabled: true,
                sortOrder: c.rolePermissions.length,
                remark: '',
                name: '新角色',
                code: 'custom',
                permissionsSummary: '',
              },
            ],
          };
        case 'sop_timeline':
          return c;
        default:
          return c;
      }
    });
  };

  if (loading || !config) {
    return (
      <div className="rounded-2xl border border-black/10 bg-[var(--surface-elevated)] p-8 text-center text-sm text-[var(--color-slate-mid)]">
        正在加载配置…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 border-b border-black/10 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-[var(--color-coal-ink)]">系统配置中心 2.0</h2>
          <p className="mt-1 text-xs text-[var(--color-slate-mid)]">
            结构化维护各模块字典；保存后自动同步旧版 <code className="rounded bg-[var(--color-ash)] px-1">GET /api/options</code> 六类字符串列表，兼容询单转化、日销、评价等页面。
            {!canEdit ? ' 您当前为只读查看，保存与导入需管理员或主管账号。' : null}
            {dirty ? <span className="ml-2 text-amber-800">（有未保存修改）</span> : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary" disabled={disabled || !dirty} onClick={() => void save()}>
            {saving ? '保存中…' : '保存配置'}
          </button>
          <button type="button" className="btn-ghost" disabled={disabled} onClick={openImport}>
            导入旧版文本
          </button>
          <button type="button" className="btn-ghost" disabled={!config} onClick={exportJson}>
            导出 JSON
          </button>
          <button type="button" className="btn-ghost" disabled={disabled} onClick={() => void importJsonFile()}>
            导入 JSON
          </button>
          <button type="button" className="btn-ghost text-red-800" disabled={disabled} onClick={() => void restoreDefault()}>
            恢复默认
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex shrink-0 gap-1 overflow-x-auto rounded-xl border border-black/10 bg-[var(--surface-elevated)] p-1 lg:w-52 lg:flex-col">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-left text-xs font-medium transition lg:text-sm ${
                tab === t.id ? 'bg-[var(--color-coal-ink)] text-white' : 'text-[var(--color-graphite)] hover:bg-[var(--color-ash)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[var(--color-coal-ink)]">{TABS.find((x) => x.id === tab)?.label}</h3>
            {tab === 'sop_timeline' ? null : (
              <button type="button" className="btn-secondary" disabled={disabled} onClick={addRow}>
                新增一行
              </button>
            )}
          </div>
          <div className="overflow-x-auto rounded-xl border border-black/10 bg-[var(--surface-elevated)] p-3 shadow-sm">{renderPanel()}</div>
          <p className="text-[11px] leading-relaxed text-[var(--color-slate-mid)]">
            说明：「排序」列与「上移/下移」均可调整展示顺序；下拉选项以「启用」行为准。员工配置的登录账号与「用户管理」中的账号相互独立，此处用于业务侧名单与备注。
          </p>
        </div>
      </div>

      {importOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-black/10 bg-[var(--surface-elevated)] p-5 shadow-xl">
            <h4 className="font-semibold text-[var(--color-coal-ink)]">导入旧版配置（每行一项）</h4>
            <p className="mt-1 text-xs text-[var(--color-slate-mid)]">与 Python 版一致：每行一个名称。合并规则：同名行保留当前结构化字段，新名称追加，未出现的名称将从对应列表移除。</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {(
                [
                  ['shops', '店铺'],
                  ['inquiry_types', '咨询类型'],
                  ['customer_types', '客户类型'],
                  ['status_options', '跟进状态'],
                  ['lost_reasons', '未成交原因'],
                  ['staff_roster', '员工名单'],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="space-y-1">
                  <div className="text-xs font-medium text-[var(--color-graphite)]">{label}</div>
                  <textarea
                    className="input-field min-h-[100px] resize-y font-mono text-xs"
                    value={legacyText[key]}
                    onChange={(e) => setLegacyText((s) => ({ ...s, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setImportOpen(false)}>
                取消
              </button>
              <button type="button" className="btn-primary" disabled={disabled} onClick={() => void applyLegacyImport()}>
                合并并保存
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
