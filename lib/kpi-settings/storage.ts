'use client';

import {
  defaultKpiDataMappings,
  defaultKpiFormulas,
  defaultKpiIndicators,
  defaultKpiScoreRules,
  defaultKpiTargets,
  defaultKpiWarningRules,
} from './defaults';
import {
  KPI_DATA_MAPPINGS_KEY,
  KPI_FORMULA_CONFIGS_KEY,
  KPI_INDICATOR_CONFIGS_KEY,
  KPI_SCORE_RULES_KEY,
  KPI_TARGET_CONFIGS_KEY,
  KPI_WARNING_RULES_KEY,
} from './storage-keys';
import type {
  KpiDataMappingRow,
  KpiFormulaConfigRow,
  KpiIndicatorConfigRow,
  KpiScoreRuleRow,
  KpiTargetConfigRow,
  KpiWarningRuleRow,
} from './types';

function parse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadKpiIndicators(): KpiIndicatorConfigRow[] {
  if (typeof window === 'undefined') return defaultKpiIndicators();
  const j = parse<{ indicators?: KpiIndicatorConfigRow[] }>(localStorage.getItem(KPI_INDICATOR_CONFIGS_KEY), {});
  const arr = Array.isArray(j.indicators) ? j.indicators : [];
  return arr.length ? arr : defaultKpiIndicators();
}

export function saveKpiIndicators(rows: KpiIndicatorConfigRow[]) {
  localStorage.setItem(KPI_INDICATOR_CONFIGS_KEY, JSON.stringify({ version: 1, indicators: rows }));
}

export function loadKpiDataMappings(): KpiDataMappingRow[] {
  if (typeof window === 'undefined') return defaultKpiDataMappings();
  const j = parse<{ mappings?: KpiDataMappingRow[] }>(localStorage.getItem(KPI_DATA_MAPPINGS_KEY), {});
  const arr = Array.isArray(j.mappings) ? j.mappings : [];
  return arr.length ? arr : defaultKpiDataMappings();
}

export function saveKpiDataMappings(rows: KpiDataMappingRow[]) {
  localStorage.setItem(KPI_DATA_MAPPINGS_KEY, JSON.stringify({ version: 1, mappings: rows }));
}

export function loadKpiFormulas(): KpiFormulaConfigRow[] {
  if (typeof window === 'undefined') return defaultKpiFormulas();
  const j = parse<{ formulas?: KpiFormulaConfigRow[] }>(localStorage.getItem(KPI_FORMULA_CONFIGS_KEY), {});
  const arr = Array.isArray(j.formulas) ? j.formulas : [];
  return arr.length ? arr : defaultKpiFormulas();
}

export function saveKpiFormulas(rows: KpiFormulaConfigRow[]) {
  localStorage.setItem(KPI_FORMULA_CONFIGS_KEY, JSON.stringify({ version: 1, formulas: rows }));
}

export function loadKpiTargets(): KpiTargetConfigRow[] {
  if (typeof window === 'undefined') return defaultKpiTargets();
  const j = parse<{ targets?: KpiTargetConfigRow[] }>(localStorage.getItem(KPI_TARGET_CONFIGS_KEY), {});
  return Array.isArray(j.targets) ? j.targets : defaultKpiTargets();
}

export function saveKpiTargets(rows: KpiTargetConfigRow[]) {
  localStorage.setItem(KPI_TARGET_CONFIGS_KEY, JSON.stringify({ version: 1, targets: rows }));
}

export function loadKpiScoreRules(): KpiScoreRuleRow[] {
  if (typeof window === 'undefined') return defaultKpiScoreRules();
  const j = parse<{ rules?: KpiScoreRuleRow[] }>(localStorage.getItem(KPI_SCORE_RULES_KEY), {});
  const arr = Array.isArray(j.rules) ? j.rules : [];
  return arr.length ? arr : defaultKpiScoreRules();
}

export function saveKpiScoreRules(rows: KpiScoreRuleRow[]) {
  localStorage.setItem(KPI_SCORE_RULES_KEY, JSON.stringify({ version: 1, rules: rows }));
}

export function loadKpiWarningRules(): KpiWarningRuleRow[] {
  if (typeof window === 'undefined') return defaultKpiWarningRules();
  const j = parse<{ rules?: KpiWarningRuleRow[] }>(localStorage.getItem(KPI_WARNING_RULES_KEY), {});
  const arr = Array.isArray(j.rules) ? j.rules : [];
  return arr.length ? arr : defaultKpiWarningRules();
}

export function saveKpiWarningRules(rows: KpiWarningRuleRow[]) {
  localStorage.setItem(KPI_WARNING_RULES_KEY, JSON.stringify({ version: 1, rules: rows }));
}

/** 恢复内置默认（不删除其它业务 LS） */
export function resetKpiSettingsToDefaults() {
  saveKpiIndicators(defaultKpiIndicators());
  saveKpiDataMappings(defaultKpiDataMappings());
  saveKpiFormulas(defaultKpiFormulas());
  saveKpiTargets(defaultKpiTargets());
  saveKpiScoreRules(defaultKpiScoreRules());
  saveKpiWarningRules(defaultKpiWarningRules());
}
