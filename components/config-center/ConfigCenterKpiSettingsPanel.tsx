'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode, type SetStateAction } from 'react';
import type { ConfigCenterV2, KpiMetricRow, StaffRow } from '@/lib/config-center-v2';
import { runKpiMetricPreview, type KpiPreviewResult } from '@/lib/kpi-settings/compute-preview';
import {
  loadKpiDataMappings,
  loadKpiFormulas,
  loadKpiIndicators,
  loadKpiScoreRules,
  loadKpiTargets,
  loadKpiWarningRules,
  resetKpiSettingsToDefaults,
  saveKpiDataMappings,
  saveKpiFormulas,
  saveKpiIndicators,
  saveKpiScoreRules,
  saveKpiTargets,
  saveKpiWarningRules,
} from '@/lib/kpi-settings/storage';
import type {
  KpiDataMappingRow,
  KpiFormulaConfigRow,
  KpiIndicatorConfigRow,
  KpiScoreRuleRow,
  KpiTargetConfigRow,
  KpiWarningRuleRow,
} from '@/lib/kpi-settings/types';

const SUB_TABS = [
  { id: 'indicators', label: 'KPI 指标配置' },
  { id: 'mappings', label: '数据源映射' },
  { id: 'formulas', label: '公式与派生' },
  { id: 'targets', label: '个人/月度目标' },
  { id: 'scores', label: '评分规则' },
  { id: 'warnings', label: '预警规则' },
  { id: 'preview', label: 'KPI 计算预览' },
] as const;

type SubId = (typeof SUB_TABS)[number]['id'];

function rid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function prevMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
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

function cell(ro: boolean) {
  return `border-b border-black/5 px-1 py-1 align-middle text-xs ${ro ? 'opacity-60' : ''}`;
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

function BoolCell({ v, onChange, disabled }: { v: boolean; onChange: (b: boolean) => void; disabled?: boolean }) {
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
      <button type="button" className="btn-ghost px-2 py-0.5 text-[10px]" disabled={disabled || i >= len - 1} onClick={() => onMove(1)}>
        下移
      </button>
      <button type="button" className="btn-ghost px-2 py-0.5 text-[10px] text-red-700" disabled={disabled} onClick={onDelete}>
        删除
      </button>
    </div>
  );
}

function move<T extends { sortOrder: number }>(rows: T[], i: number, delta: -1 | 1): T[] {
  const j = i + delta;
  if (j < 0 || j >= rows.length) return rows;
  const next = [...rows];
  [next[i], next[j]] = [next[j], next[i]];
  return next.map((r, idx) => ({ ...r, sortOrder: idx })) as T[];
}

type Props = {
  canEdit: boolean;
  ro: boolean;
  shops: string[];
  staff: StaffRow[];
  legacyKpiMetrics: KpiMetricRow[];
  onLegacyKpiPatch: (fn: (rows: ConfigCenterV2['kpiMetrics']) => ConfigCenterV2['kpiMetrics']) => void;
};

export function ConfigCenterKpiSettingsPanel({ canEdit, ro, shops, staff, legacyKpiMetrics, onLegacyKpiPatch }: Props) {
  const [sub, setSub] = useState<SubId>('indicators');
  const [indicators, setIndicators] = useState<KpiIndicatorConfigRow[]>([]);
  const [mappings, setMappings] = useState<KpiDataMappingRow[]>([]);
  const [formulas, setFormulas] = useState<KpiFormulaConfigRow[]>([]);
  const [targets, setTargets] = useState<KpiTargetConfigRow[]>([]);
  const [scores, setScores] = useState<KpiScoreRuleRow[]>([]);
  const [warnings, setWarnings] = useState<KpiWarningRuleRow[]>([]);
  const [lsDirty, setLsDirty] = useState(false);
  const [savingLs, setSavingLs] = useState(false);

  const [previewDate, setPreviewDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [previewEmployee, setPreviewEmployee] = useState('');
  const [previewStore, setPreviewStore] = useState('');
  const [previewMetric, setPreviewMetric] = useState('inquiryCount');
  const [previewResult, setPreviewResult] = useState<KpiPreviewResult | null>(null);

  const [batchMonth, setBatchMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [batchValue, setBatchValue] = useState(100);
  const [batchMetric, setBatchMetric] = useState('salesAmount');

  const reload = useCallback(() => {
    setIndicators(loadKpiIndicators());
    setMappings(loadKpiDataMappings());
    setFormulas(loadKpiFormulas());
    setTargets(loadKpiTargets());
    setScores(loadKpiScoreRules());
    setWarnings(loadKpiWarningRules());
    setLsDirty(false);
  }, []);

  const patchIndicators = useCallback((fn: SetStateAction<KpiIndicatorConfigRow[]>) => {
    setIndicators(fn);
    setLsDirty(true);
  }, []);
  const patchMappings = useCallback((fn: SetStateAction<KpiDataMappingRow[]>) => {
    setMappings(fn);
    setLsDirty(true);
  }, []);
  const patchFormulas = useCallback((fn: SetStateAction<KpiFormulaConfigRow[]>) => {
    setFormulas(fn);
    setLsDirty(true);
  }, []);
  const patchTargets = useCallback((fn: SetStateAction<KpiTargetConfigRow[]>) => {
    setTargets(fn);
    setLsDirty(true);
  }, []);
  const patchScores = useCallback((fn: SetStateAction<KpiScoreRuleRow[]>) => {
    setScores(fn);
    setLsDirty(true);
  }, []);
  const patchWarnings = useCallback((fn: SetStateAction<KpiWarningRuleRow[]>) => {
    setWarnings(fn);
    setLsDirty(true);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    const names = staff.filter((s) => s.joinKpi !== false).map((s) => s.displayName);
    if (!previewEmployee && names.length) setPreviewEmployee(names[0]);
  }, [staff, previewEmployee]);

  const metricCodes = useMemo(() => indicators.filter((i) => i.enabled).map((i) => i.code), [indicators]);

  const saveAllLs = () => {
    setSavingLs(true);
    try {
      saveKpiIndicators(indicators);
      saveKpiDataMappings(mappings);
      saveKpiFormulas(formulas);
      saveKpiTargets(targets);
      saveKpiScoreRules(scores);
      saveKpiWarningRules(warnings);
      setLsDirty(false);
      alert('KPI 扩展配置已写入本机 LocalStorage（与「保存配置」按钮独立）。');
    } finally {
      setSavingLs(false);
    }
  };

  const copyTargetsLastMonth = () => {
    const pm = prevMonth(batchMonth);
    const prev = targets.filter((t) => t.month === pm);
    if (!prev.length) {
      alert(`${pm} 无目标数据可复制`);
      return;
    }
    const next = prev.map((t) => ({
      ...t,
      id: rid(),
      month: batchMonth,
      sortOrder: targets.length,
    }));
    patchTargets((ts) => [...ts, ...next]);
    alert(`已从 ${pm} 复制 ${next.length} 条到 ${batchMonth}`);
  };

  const batchGenTargets = () => {
    const staffNames = staff.filter((s) => s.enabled && s.joinKpi).map((s) => s.displayName);
    if (!staffNames.length) {
      alert('无参与 KPI 的员工，请在「员工」中勾选「KPI」');
      return;
    }
    const storeOpts = ['', ...shops];
    let added = 0;
    const newRows: KpiTargetConfigRow[] = [];
    for (const emp of staffNames) {
      for (const st of storeOpts) {
        newRows.push({
          id: rid(),
          enabled: true,
          sortOrder: targets.length + added,
          month: batchMonth,
          employeeName: emp,
          storeName: st,
          metricCode: batchMetric,
          targetValue: batchValue,
          weight: 1,
          remark: '批量生成',
        });
        added++;
      }
    }
    patchTargets((ts) => [...ts, ...newRows]);
    alert(`已生成 ${added} 条目标（员工 × 店铺含「全店」空项）`);
  };

  const runPreview = () => {
    if (!previewEmployee) {
      alert('请选择客服');
      return;
    }
    const r = runKpiMetricPreview({
      date: previewDate,
      employeeName: previewEmployee,
      storeName: previewStore,
      metricCode: previewMetric,
      targets,
    });
    setPreviewResult(r);
  };

  const disabledPanel = ro || !canEdit;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 rounded-xl border border-amber-900/20 bg-amber-50/40 p-3 text-xs text-amber-950">
        <p>
          KPI 扩展配置保存在 LocalStorage：
          <code className="mx-1 rounded bg-white/80 px-1">kpi_indicator_configs</code> 等 6 个键，与配置中心 v2 主 JSON 分离；此处「保存 KPI 配置」仅写这些键。
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary text-xs" disabled={disabledPanel || savingLs || !lsDirty} onClick={saveAllLs}>
            {savingLs ? '保存中…' : '保存 KPI 配置'}
          </button>
          <button type="button" className="btn-ghost text-xs" disabled={disabledPanel} onClick={reload}>
            重新加载
          </button>
          <button
            type="button"
            className="btn-ghost text-xs text-red-800"
            disabled={disabledPanel}
            onClick={() => {
              if (!confirm('将 KPI 扩展六项恢复为内置默认，确定？')) return;
              resetKpiSettingsToDefaults();
              reload();
            }}
          >
            恢复 KPI 默认映射
          </button>
        </div>
        {lsDirty ? <span className="text-amber-900">（有未保存的 KPI 扩展修改）</span> : null}
      </div>

      <div className="flex flex-wrap gap-1 border-b border-black/10 pb-2">
        {SUB_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSub(t.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              sub === t.id ? 'bg-[var(--color-coal-ink)] text-white' : 'bg-[var(--color-ash)] text-[var(--color-graphite)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {sub === 'indicators' && (
        <div className="space-y-6">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] border-collapse text-sm">
              <thead>
                <tr>
                  <Th className="w-8">序</Th>
                  <Th>KPI 名称</Th>
                  <Th>编码</Th>
                  <Th>类型</Th>
                  <Th>周期</Th>
                  <Th>对象</Th>
                  <Th>权重</Th>
                  <Th>展示</Th>
                  <Th className="w-12">启用</Th>
                  <Th>备注</Th>
                  <Th className="w-40">操作</Th>
                </tr>
              </thead>
              <tbody>
                {indicators.map((row, i) => (
                  <tr key={row.id}>
                    <td className={cell(ro)}>{i + 1}</td>
                    <td className={cell(ro)}>
                      <TextCell v={row.name} disabled={ro} onChange={(name) => patchIndicators((rs) => rs.map((r, j) => (j === i ? { ...r, name } : r)))} />
                    </td>
                    <td className={cell(ro)}>
                      <TextCell v={row.code} disabled={ro} narrow onChange={(code) => patchIndicators((rs) => rs.map((r, j) => (j === i ? { ...r, code } : r)))} />
                    </td>
                    <td className={cell(ro)}>
                      <select
                        className="input-field max-w-[7rem] py-1.5 text-xs"
                        disabled={ro}
                        value={row.indicatorType}
                        onChange={(e) =>
                          patchIndicators((rs) => rs.map((r, j) => (j === i ? { ...r, indicatorType: e.target.value as KpiIndicatorConfigRow['indicatorType'] } : r)))
                        }
                      >
                        <option value="count">数量</option>
                        <option value="amount">金额</option>
                        <option value="ratio">比例</option>
                        <option value="formula">公式</option>
                        <option value="weighted">加权</option>
                      </select>
                    </td>
                    <td className={cell(ro)}>
                      <select
                        className="input-field max-w-[6rem] py-1.5 text-xs"
                        disabled={ro}
                        value={row.statPeriod}
                        onChange={(e) =>
                          patchIndicators((rs) => rs.map((r, j) => (j === i ? { ...r, statPeriod: e.target.value as KpiIndicatorConfigRow['statPeriod'] } : r)))
                        }
                      >
                        <option value="daily">每日</option>
                        <option value="weekly">每周</option>
                        <option value="monthly">每月</option>
                      </select>
                    </td>
                    <td className={cell(ro)}>
                      <select
                        className="input-field max-w-[8rem] py-1.5 text-xs"
                        disabled={ro}
                        value={row.statSubject}
                        onChange={(e) =>
                          patchIndicators((rs) => rs.map((r, j) => (j === i ? { ...r, statSubject: e.target.value as KpiIndicatorConfigRow['statSubject'] } : r)))
                        }
                      >
                        <option value="employee">客服</option>
                        <option value="store">店铺</option>
                        <option value="employee_store">客服+店铺</option>
                      </select>
                    </td>
                    <td className={cell(ro)}>
                      <NumCell step="0.01" v={row.weight} disabled={ro} onChange={(weight) => patchIndicators((rs) => rs.map((r, j) => (j === i ? { ...r, weight } : r)))} />
                    </td>
                    <td className={cell(ro)}>
                      <select
                        className="input-field max-w-[6rem] py-1.5 text-xs"
                        disabled={ro}
                        value={row.displayFormat}
                        onChange={(e) =>
                          patchIndicators((rs) => rs.map((r, j) => (j === i ? { ...r, displayFormat: e.target.value as KpiIndicatorConfigRow['displayFormat'] } : r)))
                        }
                      >
                        <option value="number">数字</option>
                        <option value="amount">金额</option>
                        <option value="percent">百分比</option>
                      </select>
                    </td>
                    <td className={cell(ro)}>
                      <BoolCell v={row.enabled} disabled={ro} onChange={(enabled) => patchIndicators((rs) => rs.map((r, j) => (j === i ? { ...r, enabled } : r)))} />
                    </td>
                    <td className={cell(ro)}>
                      <TextCell v={row.remark} disabled={ro} onChange={(remark) => patchIndicators((rs) => rs.map((r, j) => (j === i ? { ...r, remark } : r)))} />
                    </td>
                    <td className={cell(ro)}>
                      <RowActions
                        i={i}
                        len={indicators.length}
                        disabled={ro}
                        onMove={(d) => patchIndicators((rs) => move(rs, i, d))}
                        onDelete={() => patchIndicators((rs) => rs.filter((_, j) => j !== i))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            className="btn-secondary text-xs"
            disabled={ro}
            onClick={() => {
              patchIndicators((rs) => [
                ...rs,
                {
                  id: rid(),
                  enabled: true,
                  sortOrder: rs.length,
                  name: '新指标',
                  code: `metric_${rs.length + 1}`,
                  indicatorType: 'count',
                  statPeriod: 'daily',
                  statSubject: 'employee',
                  weight: 0.1,
                  displayFormat: 'number',
                  remark: '',
                },
              ]);
            }}
          >
            新增指标
          </button>

          <div className="rounded-xl border border-black/10 bg-[var(--color-ash)]/30 p-3">
            <h4 className="text-xs font-semibold text-[var(--color-coal-ink)]">兼容：配置中心 v2「KPI 指标」简表</h4>
            <p className="mt-1 text-[11px] text-[var(--color-slate-mid)]">以下行仍随主窗口「保存配置」写入服务端；与上方扩展指标表并存。</p>
            <table className="mt-2 w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr>
                  <Th className="w-8">序</Th>
                  <Th>KPI 名称</Th>
                  <Th>权重</Th>
                  <Th>目标周期</Th>
                  <Th>计算方式</Th>
                  <Th className="w-12">启用</Th>
                  <Th>备注</Th>
                  <Th className="w-40">操作</Th>
                </tr>
              </thead>
              <tbody>
                {legacyKpiMetrics.map((row, i) => (
                  <tr key={row.id}>
                    <td className={cell(ro)}>{i + 1}</td>
                    <td className={cell(ro)}>
                      <TextCell v={row.name} disabled={ro} onChange={(name) => onLegacyKpiPatch((rs) => rs.map((r, j) => (j === i ? { ...r, name } : r)))} />
                    </td>
                    <td className={cell(ro)}>
                      <NumCell step="0.01" v={row.weight} disabled={ro} onChange={(weight) => onLegacyKpiPatch((rs) => rs.map((r, j) => (j === i ? { ...r, weight } : r)))} />
                    </td>
                    <td className={cell(ro)}>
                      <TextCell v={row.targetPeriod} disabled={ro} narrow onChange={(targetPeriod) => onLegacyKpiPatch((rs) => rs.map((r, j) => (j === i ? { ...r, targetPeriod } : r)))} />
                    </td>
                    <td className={cell(ro)}>
                      <TextCell v={row.calcMethod} disabled={ro} onChange={(calcMethod) => onLegacyKpiPatch((rs) => rs.map((r, j) => (j === i ? { ...r, calcMethod } : r)))} />
                    </td>
                    <td className={cell(ro)}>
                      <BoolCell v={row.enabled} disabled={ro} onChange={(enabled) => onLegacyKpiPatch((rs) => rs.map((r, j) => (j === i ? { ...r, enabled } : r)))} />
                    </td>
                    <td className={cell(ro)}>
                      <TextCell v={row.remark} disabled={ro} onChange={(remark) => onLegacyKpiPatch((rs) => rs.map((r, j) => (j === i ? { ...r, remark } : r)))} />
                    </td>
                    <td className={cell(ro)}>
                      <RowActions
                        i={i}
                        len={legacyKpiMetrics.length}
                        disabled={ro}
                        onMove={(d) => onLegacyKpiPatch((rs) => move(rs, i, d))}
                        onDelete={() => onLegacyKpiPatch((rs) => rs.filter((_, j) => j !== i))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              type="button"
              className="btn-secondary mt-2 text-xs"
              disabled={ro}
              onClick={() =>
                onLegacyKpiPatch((rs) => [
                  ...rs,
                  {
                    id: rid(),
                    enabled: true,
                    sortOrder: rs.length,
                    remark: '',
                    name: '新 KPI',
                    weight: 0.1,
                    targetPeriod: '月',
                    calcMethod: '',
                  },
                ])
              }
            >
              新增兼容行
            </button>
          </div>
        </div>
      )}

      {sub === 'mappings' && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1400px] border-collapse text-sm">
            <thead>
              <tr>
                <Th className="w-7">序</Th>
                <Th>指标编码</Th>
                <Th>模块</Th>
                <Th>LS Key</Th>
                <Th>字段</Th>
                <Th>聚合</Th>
                <Th>日期字段</Th>
                <Th>客服字段</Th>
                <Th>店铺字段</Th>
                <Th>去重字段</Th>
                <Th>仅通过</Th>
                <Th>审核字段</Th>
                <Th>通过值</Th>
                <Th className="w-10">启用</Th>
                <Th className="min-w-[120px]">有效规则 JSON</Th>
                <Th className="min-w-[100px]">扩展 JSON</Th>
                <Th className="w-36">操作</Th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((row, i) => (
                <tr key={row.id}>
                  <td className={cell(ro)}>{i + 1}</td>
                  <td className={cell(ro)}>
                    <TextCell v={row.metricCode} disabled={ro} narrow onChange={(metricCode) => patchMappings((rs) => rs.map((r, j) => (j === i ? { ...r, metricCode } : r)))} />
                  </td>
                  <td className={cell(ro)}>
                    <TextCell v={row.sourceModule} disabled={ro} onChange={(sourceModule) => patchMappings((rs) => rs.map((r, j) => (j === i ? { ...r, sourceModule } : r)))} />
                  </td>
                  <td className={cell(ro)}>
                    <TextCell v={row.sourceKey} disabled={ro} onChange={(sourceKey) => patchMappings((rs) => rs.map((r, j) => (j === i ? { ...r, sourceKey } : r)))} />
                  </td>
                  <td className={cell(ro)}>
                    <TextCell v={row.field} disabled={ro} narrow onChange={(field) => patchMappings((rs) => rs.map((r, j) => (j === i ? { ...r, field } : r)))} />
                  </td>
                  <td className={cell(ro)}>
                    <select
                      className="input-field max-w-[6.5rem] py-1 text-xs"
                      disabled={ro}
                      value={row.aggregateType}
                      onChange={(e) =>
                        patchMappings((rs) => rs.map((r, j) => (j === i ? { ...r, aggregateType: e.target.value as KpiDataMappingRow['aggregateType'] } : r)))
                      }
                    >
                      <option value="count">count</option>
                      <option value="sum">sum</option>
                      <option value="avg">avg</option>
                      <option value="weighted">weighted</option>
                      <option value="formula">formula</option>
                    </select>
                  </td>
                  <td className={cell(ro)}>
                    <TextCell v={row.matchDate} disabled={ro} narrow onChange={(matchDate) => patchMappings((rs) => rs.map((r, j) => (j === i ? { ...r, matchDate } : r)))} />
                  </td>
                  <td className={cell(ro)}>
                    <TextCell v={row.matchEmployee} disabled={ro} narrow onChange={(matchEmployee) => patchMappings((rs) => rs.map((r, j) => (j === i ? { ...r, matchEmployee } : r)))} />
                  </td>
                  <td className={cell(ro)}>
                    <TextCell v={row.matchStore} disabled={ro} narrow onChange={(matchStore) => patchMappings((rs) => rs.map((r, j) => (j === i ? { ...r, matchStore } : r)))} />
                  </td>
                  <td className={cell(ro)}>
                    <TextCell v={row.dedupeFields} disabled={ro} onChange={(dedupeFields) => patchMappings((rs) => rs.map((r, j) => (j === i ? { ...r, dedupeFields } : r)))} />
                  </td>
                  <td className={cell(ro)}>
                    <BoolCell v={row.onlyApproved} disabled={ro} onChange={(onlyApproved) => patchMappings((rs) => rs.map((r, j) => (j === i ? { ...r, onlyApproved } : r)))} />
                  </td>
                  <td className={cell(ro)}>
                    <TextCell v={row.auditStatusField} disabled={ro} narrow onChange={(auditStatusField) => patchMappings((rs) => rs.map((r, j) => (j === i ? { ...r, auditStatusField } : r)))} />
                  </td>
                  <td className={cell(ro)}>
                    <TextCell v={row.approvedValue} disabled={ro} narrow onChange={(approvedValue) => patchMappings((rs) => rs.map((r, j) => (j === i ? { ...r, approvedValue } : r)))} />
                  </td>
                  <td className={cell(ro)}>
                    <BoolCell v={row.enabled} disabled={ro} onChange={(enabled) => patchMappings((rs) => rs.map((r, j) => (j === i ? { ...r, enabled } : r)))} />
                  </td>
                  <td className={cell(ro)}>
                    <textarea
                      className="input-field min-h-[48px] w-full resize-y font-mono text-[10px]"
                      disabled={ro}
                      value={row.validRulesJson}
                      onChange={(e) => patchMappings((rs) => rs.map((r, j) => (j === i ? { ...r, validRulesJson: e.target.value } : r)))}
                    />
                  </td>
                  <td className={cell(ro)}>
                    <textarea
                      className="input-field min-h-[48px] w-full resize-y font-mono text-[10px]"
                      disabled={ro}
                      value={row.extraJson}
                      onChange={(e) => patchMappings((rs) => rs.map((r, j) => (j === i ? { ...r, extraJson: e.target.value } : r)))}
                    />
                  </td>
                  <td className={cell(ro)}>
                    <RowActions
                      i={i}
                      len={mappings.length}
                      disabled={ro}
                      onMove={(d) => patchMappings((rs) => move(rs, i, d))}
                      onDelete={() => patchMappings((rs) => rs.filter((_, j) => j !== i))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            className="btn-secondary mt-2 text-xs"
            disabled={ro}
            onClick={() => {
              patchMappings((rs) => [
                ...rs,
                {
                  id: rid(),
                  enabled: true,
                  sortOrder: rs.length,
                  metricCode: 'custom',
                  sourceModule: '',
                  sourceKey: '',
                  field: '',
                  aggregateType: 'sum',
                  matchDate: 'date',
                  matchEmployee: 'employeeName',
                  matchStore: '',
                  dedupeFields: '',
                  validRulesJson: '[]',
                  onlyApproved: false,
                  auditStatusField: '',
                  approvedValue: '',
                  extraJson: '',
                  remark: '',
                },
              ]);
              setLsDirty(true);
            }}
          >
            新增映射
          </button>
        </div>
      )}

      {sub === 'formulas' && (
        <div className="space-y-2">
          <p className="text-xs text-[var(--color-slate-mid)]">
            派生指标表达式中的编码（如 leadCount、inquiryCount）需与「KPI 指标配置」中的编码一致；预览计算已内置实现下列公式，此处用于文档与后续引擎扩展。
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr>
                  <Th className="w-7">序</Th>
                  <Th>指标编码</Th>
                  <Th>表达式</Th>
                  <Th>展示格式</Th>
                  <Th className="w-10">启用</Th>
                  <Th>备注</Th>
                  <Th className="w-36">操作</Th>
                </tr>
              </thead>
              <tbody>
                {formulas.map((row, i) => (
                  <tr key={row.id}>
                    <td className={cell(ro)}>{i + 1}</td>
                    <td className={cell(ro)}>
                      <TextCell v={row.metricCode} disabled={ro} onChange={(metricCode) => patchFormulas((rs) => rs.map((r, j) => (j === i ? { ...r, metricCode } : r)))} />
                    </td>
                    <td className={cell(ro)}>
                      <TextCell v={row.expression} disabled={ro} onChange={(expression) => patchFormulas((rs) => rs.map((r, j) => (j === i ? { ...r, expression } : r)))} />
                    </td>
                    <td className={cell(ro)}>
                      <select
                        className="input-field max-w-[6rem] py-1 text-xs"
                        disabled={ro}
                        value={row.displayFormat}
                        onChange={(e) =>
                          patchFormulas((rs) => rs.map((r, j) => (j === i ? { ...r, displayFormat: e.target.value as KpiFormulaConfigRow['displayFormat'] } : r)))
                        }
                      >
                        <option value="number">数字</option>
                        <option value="amount">金额</option>
                        <option value="percent">百分比</option>
                      </select>
                    </td>
                    <td className={cell(ro)}>
                      <BoolCell v={row.enabled} disabled={ro} onChange={(enabled) => patchFormulas((rs) => rs.map((r, j) => (j === i ? { ...r, enabled } : r)))} />
                    </td>
                    <td className={cell(ro)}>
                      <TextCell v={row.remark} disabled={ro} onChange={(remark) => patchFormulas((rs) => rs.map((r, j) => (j === i ? { ...r, remark } : r)))} />
                    </td>
                    <td className={cell(ro)}>
                      <RowActions
                        i={i}
                        len={formulas.length}
                        disabled={ro}
                        onMove={(d) => patchFormulas((rs) => move(rs, i, d))}
                        onDelete={() => patchFormulas((rs) => rs.filter((_, j) => j !== i))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            className="btn-secondary text-xs"
            disabled={ro}
            onClick={() =>
              patchFormulas((rs) => [
                ...rs,
                {
                  id: rid(),
                  enabled: true,
                  sortOrder: rs.length,
                  metricCode: 'customDerived',
                  expression: 'a / b',
                  displayFormat: 'percent',
                  remark: '',
                },
              ])
            }
          >
            新增公式行
          </button>
        </div>
      )}

      {sub === 'targets' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-2 text-xs">
            <div>
              <div className="mb-0.5 text-[var(--color-graphite)]">目标月份</div>
              <input className="input-field py-1.5 text-xs" type="month" value={batchMonth} disabled={ro} onChange={(e) => setBatchMonth(e.target.value)} />
            </div>
            <button type="button" className="btn-ghost text-xs" disabled={ro} onClick={copyTargetsLastMonth}>
              复制上月到此月
            </button>
            <div>
              <div className="mb-0.5 text-[var(--color-graphite)]">批量指标</div>
              <select className="input-field py-1.5 text-xs" value={batchMetric} disabled={ro} onChange={(e) => setBatchMetric(e.target.value)}>
                {metricCodes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="mb-0.5 text-[var(--color-graphite)]">批量目标值</div>
              <input
                type="number"
                className="input-field max-w-[6rem] py-1.5 text-xs"
                value={batchValue}
                disabled={ro}
                onChange={(e) => setBatchValue(Number(e.target.value))}
              />
            </div>
            <button type="button" className="btn-secondary text-xs" disabled={ro} onClick={batchGenTargets}>
              批量生成（员工×店铺）
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr>
                  <Th className="w-7">序</Th>
                  <Th>月份</Th>
                  <Th>客服</Th>
                  <Th>店铺</Th>
                  <Th>指标</Th>
                  <Th>目标</Th>
                  <Th>权重</Th>
                  <Th className="w-10">启用</Th>
                  <Th>备注</Th>
                  <Th className="w-36">操作</Th>
                </tr>
              </thead>
              <tbody>
                {targets.map((row, i) => (
                  <tr key={row.id}>
                    <td className={cell(ro)}>{i + 1}</td>
                    <td className={cell(ro)}>
                      <TextCell v={row.month} disabled={ro} narrow onChange={(month) => patchTargets((rs) => rs.map((r, j) => (j === i ? { ...r, month } : r)))} />
                    </td>
                    <td className={cell(ro)}>
                      <TextCell v={row.employeeName} disabled={ro} onChange={(employeeName) => patchTargets((rs) => rs.map((r, j) => (j === i ? { ...r, employeeName } : r)))} />
                    </td>
                    <td className={cell(ro)}>
                      <TextCell v={row.storeName} disabled={ro} onChange={(storeName) => patchTargets((rs) => rs.map((r, j) => (j === i ? { ...r, storeName } : r)))} />
                    </td>
                    <td className={cell(ro)}>
                      <TextCell v={row.metricCode} disabled={ro} onChange={(metricCode) => patchTargets((rs) => rs.map((r, j) => (j === i ? { ...r, metricCode } : r)))} />
                    </td>
                    <td className={cell(ro)}>
                      <NumCell step="0.01" v={row.targetValue} disabled={ro} onChange={(targetValue) => patchTargets((rs) => rs.map((r, j) => (j === i ? { ...r, targetValue } : r)))} />
                    </td>
                    <td className={cell(ro)}>
                      <NumCell step="0.01" v={row.weight} disabled={ro} onChange={(weight) => patchTargets((rs) => rs.map((r, j) => (j === i ? { ...r, weight } : r)))} />
                    </td>
                    <td className={cell(ro)}>
                      <BoolCell v={row.enabled} disabled={ro} onChange={(enabled) => patchTargets((rs) => rs.map((r, j) => (j === i ? { ...r, enabled } : r)))} />
                    </td>
                    <td className={cell(ro)}>
                      <TextCell v={row.remark} disabled={ro} onChange={(remark) => patchTargets((rs) => rs.map((r, j) => (j === i ? { ...r, remark } : r)))} />
                    </td>
                    <td className={cell(ro)}>
                      <RowActions
                        i={i}
                        len={targets.length}
                        disabled={ro}
                        onMove={(d) => patchTargets((rs) => move(rs, i, d))}
                        onDelete={() => patchTargets((rs) => rs.filter((_, j) => j !== i))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            className="btn-secondary text-xs"
            disabled={ro}
            onClick={() => {
              patchTargets((rs) => [
                ...rs,
                {
                  id: rid(),
                  enabled: true,
                  sortOrder: rs.length,
                  month: batchMonth,
                  employeeName: previewEmployee || staff[0]?.displayName || '',
                  storeName: '',
                  metricCode: 'salesAmount',
                  targetValue: 0,
                  weight: 1,
                  remark: '',
                },
              ]);
            }}
          >
            新增目标行
          </button>
        </div>
      )}

      {sub === 'scores' && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-sm">
            <thead>
              <tr>
                <Th className="w-7">序</Th>
                <Th>指标编码</Th>
                <Th>满分完成率</Th>
                <Th>封顶比例</Th>
                <Th>预警线</Th>
                <Th>严重线</Th>
                <Th>超额加分</Th>
                <Th className="w-10">启用</Th>
                <Th>备注</Th>
                <Th className="w-36">操作</Th>
              </tr>
            </thead>
            <tbody>
              {scores.map((row, i) => (
                <tr key={row.id}>
                  <td className={cell(ro)}>{i + 1}</td>
                  <td className={cell(ro)}>
                    <TextCell v={row.metricCode} disabled={ro} onChange={(metricCode) => patchScores((rs) => rs.map((r, j) => (j === i ? { ...r, metricCode } : r)))} />
                  </td>
                  <td className={cell(ro)}>
                    <NumCell step="0.01" v={row.fullScoreAtRate} disabled={ro} onChange={(fullScoreAtRate) => patchScores((rs) => rs.map((r, j) => (j === i ? { ...r, fullScoreAtRate } : r)))} />
                  </td>
                  <td className={cell(ro)}>
                    <NumCell step="0.01" v={row.capRatio} disabled={ro} onChange={(capRatio) => patchScores((rs) => rs.map((r, j) => (j === i ? { ...r, capRatio } : r)))} />
                  </td>
                  <td className={cell(ro)}>
                    <NumCell step="0.01" v={row.warnBelowRate} disabled={ro} onChange={(warnBelowRate) => patchScores((rs) => rs.map((r, j) => (j === i ? { ...r, warnBelowRate } : r)))} />
                  </td>
                  <td className={cell(ro)}>
                    <NumCell step="0.01" v={row.criticalBelowRate} disabled={ro} onChange={(criticalBelowRate) => patchScores((rs) => rs.map((r, j) => (j === i ? { ...r, criticalBelowRate } : r)))} />
                  </td>
                  <td className={cell(ro)}>
                    <BoolCell v={row.allowOverBonus} disabled={ro} onChange={(allowOverBonus) => patchScores((rs) => rs.map((r, j) => (j === i ? { ...r, allowOverBonus } : r)))} />
                  </td>
                  <td className={cell(ro)}>
                    <BoolCell v={row.enabled} disabled={ro} onChange={(enabled) => patchScores((rs) => rs.map((r, j) => (j === i ? { ...r, enabled } : r)))} />
                  </td>
                  <td className={cell(ro)}>
                    <TextCell v={row.remark} disabled={ro} onChange={(remark) => patchScores((rs) => rs.map((r, j) => (j === i ? { ...r, remark } : r)))} />
                  </td>
                  <td className={cell(ro)}>
                    <RowActions
                      i={i}
                      len={scores.length}
                      disabled={ro}
                      onMove={(d) => patchScores((rs) => move(rs, i, d))}
                      onDelete={() => patchScores((rs) => rs.filter((_, j) => j !== i))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {sub === 'warnings' && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] border-collapse text-sm">
            <thead>
              <tr>
                <Th className="w-7">序</Th>
                <Th>指标</Th>
                <Th>条件</Th>
                <Th>程度</Th>
                <Th>提醒文案</Th>
                <Th className="w-10">启用</Th>
                <Th>备注</Th>
                <Th className="w-36">操作</Th>
              </tr>
            </thead>
            <tbody>
              {warnings.map((row, i) => (
                <tr key={row.id}>
                  <td className={cell(ro)}>{i + 1}</td>
                  <td className={cell(ro)}>
                    <TextCell v={row.metricCode} disabled={ro} onChange={(metricCode) => patchWarnings((rs) => rs.map((r, j) => (j === i ? { ...r, metricCode } : r)))} />
                  </td>
                  <td className={cell(ro)}>
                    <TextCell v={row.condition} disabled={ro} onChange={(condition) => patchWarnings((rs) => rs.map((r, j) => (j === i ? { ...r, condition } : r)))} />
                  </td>
                  <td className={cell(ro)}>
                    <select
                      className="input-field py-1 text-xs"
                      disabled={ro}
                      value={row.severity}
                      onChange={(e) =>
                        patchWarnings((rs) => rs.map((r, j) => (j === i ? { ...r, severity: e.target.value as KpiWarningRuleRow['severity'] } : r)))
                      }
                    >
                      <option value="info">提示</option>
                      <option value="warn">预警</option>
                      <option value="critical">严重</option>
                    </select>
                  </td>
                  <td className={cell(ro)}>
                    <TextCell v={row.message} disabled={ro} onChange={(message) => patchWarnings((rs) => rs.map((r, j) => (j === i ? { ...r, message } : r)))} />
                  </td>
                  <td className={cell(ro)}>
                    <BoolCell v={row.enabled} disabled={ro} onChange={(enabled) => patchWarnings((rs) => rs.map((r, j) => (j === i ? { ...r, enabled } : r)))} />
                  </td>
                  <td className={cell(ro)}>
                    <TextCell v={row.remark} disabled={ro} onChange={(remark) => patchWarnings((rs) => rs.map((r, j) => (j === i ? { ...r, remark } : r)))} />
                  </td>
                  <td className={cell(ro)}>
                    <RowActions
                      i={i}
                      len={warnings.length}
                      disabled={ro}
                      onMove={(d) => patchWarnings((rs) => move(rs, i, d))}
                      onDelete={() => patchWarnings((rs) => rs.filter((_, j) => j !== i))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            className="btn-secondary mt-2 text-xs"
            disabled={ro}
            onClick={() => {
              patchWarnings((rs) => [
                ...rs,
                {
                  id: rid(),
                  enabled: true,
                  sortOrder: rs.length,
                  metricCode: '',
                  condition: 'lt:0',
                  severity: 'warn',
                  message: '',
                  remark: '',
                },
              ]);
            }}
          >
            新增预警
          </button>
        </div>
      )}

      {sub === 'preview' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 text-xs">
            <div>
              <div className="mb-0.5 text-[var(--color-graphite)]">日期</div>
              <input type="date" className="input-field py-1.5 text-xs" value={previewDate} disabled={ro} onChange={(e) => setPreviewDate(e.target.value)} />
            </div>
            <div>
              <div className="mb-0.5 text-[var(--color-graphite)]">客服</div>
              <select className="input-field min-w-[8rem] py-1.5 text-xs" value={previewEmployee} disabled={ro} onChange={(e) => setPreviewEmployee(e.target.value)}>
                {staff.filter((s) => s.enabled).map((s) => (
                  <option key={s.id} value={s.displayName}>
                    {s.displayName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="mb-0.5 text-[var(--color-graphite)]">店铺（可选）</div>
              <select className="input-field min-w-[8rem] py-1.5 text-xs" value={previewStore} disabled={ro} onChange={(e) => setPreviewStore(e.target.value)}>
                <option value="">全店汇总</option>
                {shops.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="mb-0.5 text-[var(--color-graphite)]">KPI 指标</div>
              <select className="input-field min-w-[10rem] py-1.5 text-xs" value={previewMetric} disabled={ro} onChange={(e) => setPreviewMetric(e.target.value)}>
                {(metricCodes.length ? metricCodes : ['inquiryCount', 'leadCount', 'leadRate']).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" className="btn-primary mt-5 text-xs" onClick={runPreview}>
              预览计算
            </button>
          </div>
          {previewResult ? (
            <div className="rounded-xl border border-black/10 bg-[var(--surface-elevated)] p-4 text-sm">
              <div className="font-semibold text-[var(--color-coal-ink)]">
                结果：<span className="text-[var(--color-smolder)]">{previewResult.displayValue}</span>
              </div>
              <div className="mt-1 text-xs text-[var(--color-slate-mid)]">
                达标：{previewResult.meetsTarget === null ? '—' : previewResult.meetsTarget ? '是' : '否'} {previewResult.targetNote ? `· ${previewResult.targetNote}` : ''}
              </div>
              <ul className="mt-3 list-inside list-disc space-y-1 text-xs text-[var(--color-graphite)]">
                {previewResult.steps.map((s, idx) => (
                  <li key={idx}>
                    <span className="font-medium">{s.label}：</span>
                    {s.detail}
                  </li>
                ))}
              </ul>
              {previewResult.warnings.length > 0 ? (
                <div className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-950">
                  <div className="font-medium">异常 / 提醒</div>
                  <ul className="list-inside list-disc">
                    {previewResult.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-[var(--color-slate-mid)]">选择条件后点击「预览计算」。</p>
          )}
        </div>
      )}
    </div>
  );
}
