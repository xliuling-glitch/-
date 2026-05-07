/** KPI 指标类型 */
export type KpiIndicatorType = 'count' | 'amount' | 'ratio' | 'formula' | 'weighted';

/** 统计周期 */
export type KpiStatPeriod = 'daily' | 'weekly' | 'monthly';

/** 统计对象 */
export type KpiStatSubject = 'employee' | 'store' | 'employee_store';

/** 展示格式 */
export type KpiDisplayFormat = 'number' | 'amount' | 'percent';

export interface KpiIndicatorConfigRow {
  id: string;
  enabled: boolean;
  sortOrder: number;
  name: string;
  code: string;
  indicatorType: KpiIndicatorType;
  statPeriod: KpiStatPeriod;
  statSubject: KpiStatSubject;
  weight: number;
  displayFormat: KpiDisplayFormat;
  remark: string;
}

export type KpiAggregateType = 'count' | 'sum' | 'avg' | 'weighted' | 'formula';

export interface KpiDataMappingRow {
  id: string;
  enabled: boolean;
  sortOrder: number;
  metricCode: string;
  sourceModule: string;
  sourceKey: string;
  field: string;
  aggregateType: KpiAggregateType;
  /** 记录中与业务日匹配的字段名，默认 date */
  matchDate: string;
  /** 与客服匹配的字段名 */
  matchEmployee: string;
  /** 与店铺匹配的字段名；空表示不按店铺过滤 */
  matchStore: string;
  /** 逗号分隔字段路径，用于 count 前去重 */
  dedupeFields: string;
  /** JSON：有效数据规则，如 [{"field":"phone","op":"notEmpty"}] */
  validRulesJson: string;
  onlyApproved: boolean;
  auditStatusField: string;
  approvedValue: string;
  /** weighted 时 JSON：如 review 权重、AI 系数 */
  extraJson: string;
  remark: string;
}

export interface KpiFormulaConfigRow {
  id: string;
  enabled: boolean;
  sortOrder: number;
  metricCode: string;
  /** 使用其它指标编码，如 leadCount / inquiryCount */
  expression: string;
  displayFormat: KpiDisplayFormat;
  remark: string;
}

export interface KpiTargetConfigRow {
  id: string;
  enabled: boolean;
  sortOrder: number;
  /** YYYY-MM */
  month: string;
  employeeName: string;
  storeName: string;
  metricCode: string;
  targetValue: number;
  weight: number;
  remark: string;
}

export interface KpiScoreRuleRow {
  id: string;
  enabled: boolean;
  sortOrder: number;
  metricCode: string;
  /** 满分对应完成率，默认 1 = 100% */
  fullScoreAtRate: number;
  /** 封顶完成率，默认 1.2 */
  capRatio: number;
  warnBelowRate: number;
  criticalBelowRate: number;
  allowOverBonus: boolean;
  remark: string;
}

export type KpiWarningSeverity = 'info' | 'warn' | 'critical';

export interface KpiWarningRuleRow {
  id: string;
  enabled: boolean;
  sortOrder: number;
  metricCode: string;
  /** 如 lt:0.2 表示实际值（比例指标为小数）< 0.2 */
  condition: string;
  severity: KpiWarningSeverity;
  message: string;
  remark: string;
}

export type KpiSettingsBundle = {
  version: 1;
  indicators: KpiIndicatorConfigRow[];
};

export type KpiMappingsBundle = { version: 1; mappings: KpiDataMappingRow[] };
export type KpiFormulasBundle = { version: 1; formulas: KpiFormulaConfigRow[] };
export type KpiTargetsBundle = { version: 1; targets: KpiTargetConfigRow[] };
export type KpiScoresBundle = { version: 1; rules: KpiScoreRuleRow[] };
export type KpiWarningsBundle = { version: 1; rules: KpiWarningRuleRow[] };
