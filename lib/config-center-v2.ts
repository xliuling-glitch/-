/** 系统配置中心 2.0：结构化配置 + 与旧版「每行一个」选项同步 */

export const CONFIG_CENTER_V2_KEY = 'config_center_v2';

export const LEGACY_OPTION_KEYS = [
  'shops',
  'inquiry_types',
  'customer_types',
  'status_options',
  'lost_reasons',
  'staff_roster',
] as const;

export type LegacyOptionKey = (typeof LEGACY_OPTION_KEYS)[number];

export type LegacyOptions = Record<LegacyOptionKey, string[]>;

export const DEFAULT_LEGACY: LegacyOptions = {
  shops: ['天猫旗舰店', '淘宝店', '拼多多店', '抖音店', '京东店'],
  inquiry_types: ['真空机', '封箱机', '封口机', '捆扎机', '打包机', '其他'],
  customer_types: ['新客户', '重点客户', '老客户', '同行/采购', '其他'],
  status_options: [
    '待跟进',
    '初步建议',
    '方案报价',
    '协商议价',
    '物料测试',
    '比较价格',
    '已停滞',
    '成交',
    '其他',
  ],
  lost_reasons: ['价格高', '竞品对比', '仅咨询', '暂时没需求', '规格不匹配', '发货/售后顾虑', '无货/等货', '其他'],
  staff_roster: ['陶柳青', '张治国', '张林其', '周晨'],
};

function rid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export interface BaseRow {
  id: string;
  enabled: boolean;
  sortOrder: number;
  remark: string;
}

export interface ShopRow extends BaseRow {
  name: string;
  platform: string;
  owner: string;
  joinKpi: boolean;
  joinReviewTask: boolean;
}

export interface InquiryTypeRow extends BaseRow {
  name: string;
  productLine: string;
}

export interface CustomerTypeRow extends BaseRow {
  name: string;
  highValue: boolean;
  /** 说明 */
  description: string;
}

export interface FollowupStatusRow extends BaseRow {
  name: string;
  stage: string;
  countsAsValidFollowup: boolean;
  isDealStatus: boolean;
  isLostStatus: boolean;
}

export interface LostReasonRow extends BaseRow {
  name: string;
  category: string;
  keyReview: boolean;
}

export interface StaffRow extends BaseRow {
  displayName: string;
  loginUsername: string;
  roleName: string;
  team: string;
  joinSchedule: boolean;
  joinKpi: boolean;
  nightShiftOk: boolean;
}

export interface KpiMetricRow extends BaseRow {
  name: string;
  weight: number;
  targetPeriod: string;
  calcMethod: string;
}

export interface TodayTaskTemplateRow extends BaseRow {
  name: string;
  taskType: string;
  shiftApplicable: string;
  defaultStartTime: string;
  defaultEndTime: string;
  defaultPriority: string;
  completionMode: string;
  needReview: boolean;
}

export interface ReviewTaskRuleRow extends BaseRow {
  name: string;
  reviewType: string;
  kpiWeight: number;
  needScreenshot: boolean;
  needOrderNo: boolean;
  needManagerApproval: boolean;
}

export interface ReminderRuleRow extends BaseRow {
  name: string;
  scene: string;
  leadMinutes: number;
  targetRole: string;
  channel: string;
}

export interface RolePermissionRow extends BaseRow {
  name: string;
  code: string;
  permissionsSummary: string;
}

/** 基础字典：自定义键值项，供扩展下拉或标签 */
export interface BasicDictRow extends BaseRow {
  dictKey: string;
  label: string;
  value: string;
}

export interface ConfigCenterV2 {
  version: 2;
  shops: ShopRow[];
  inquiryTypes: InquiryTypeRow[];
  customerTypes: CustomerTypeRow[];
  followupStatuses: FollowupStatusRow[];
  lostReasons: LostReasonRow[];
  staff: StaffRow[];
  kpiMetrics: KpiMetricRow[];
  todayTaskTemplates: TodayTaskTemplateRow[];
  reviewTaskRules: ReviewTaskRuleRow[];
  reminderRules: ReminderRuleRow[];
  rolePermissions: RolePermissionRow[];
  basicDict: BasicDictRow[];
}

function baseRow(sort: number, remark = ''): BaseRow {
  return { id: rid(), enabled: true, sortOrder: sort, remark };
}

function shopFromName(name: string, i: number, prev?: ShopRow): ShopRow {
  const b = baseRow(i, prev?.remark ?? '');
  return {
    ...b,
    name,
    platform: prev?.platform ?? '',
    owner: prev?.owner ?? '',
    joinKpi: prev?.joinKpi ?? true,
    joinReviewTask: prev?.joinReviewTask ?? true,
    enabled: prev?.enabled ?? true,
  };
}

function inquiryFromName(name: string, i: number, prev?: InquiryTypeRow): InquiryTypeRow {
  const b = baseRow(i, prev?.remark ?? '');
  return {
    ...b,
    name,
    productLine: prev?.productLine ?? '',
    enabled: prev?.enabled ?? true,
  };
}

function customerFromName(name: string, i: number, prev?: CustomerTypeRow): CustomerTypeRow {
  const b = baseRow(i, prev?.remark ?? '');
  return {
    ...b,
    name,
    highValue: prev?.highValue ?? false,
    description: prev?.description ?? '',
    enabled: prev?.enabled ?? true,
  };
}

function statusFromName(name: string, i: number, prev?: FollowupStatusRow): FollowupStatusRow {
  const deal = name.includes('成交');
  const lost = name.includes('停滞') || name.includes('流失') || name.includes('放弃');
  const b = baseRow(i, prev?.remark ?? '');
  return {
    ...b,
    name,
    stage: prev?.stage ?? (deal ? '成交' : lost ? '流失' : '跟进中'),
    countsAsValidFollowup: prev?.countsAsValidFollowup ?? true,
    isDealStatus: prev?.isDealStatus ?? deal,
    isLostStatus: prev?.isLostStatus ?? lost,
    enabled: prev?.enabled ?? true,
  };
}

function lostFromName(name: string, i: number, prev?: LostReasonRow): LostReasonRow {
  const b = baseRow(i, prev?.remark ?? '');
  return {
    ...b,
    name,
    category: prev?.category ?? '通用',
    keyReview: prev?.keyReview ?? false,
    enabled: prev?.enabled ?? true,
  };
}

function staffFromName(name: string, i: number, prev?: StaffRow): StaffRow {
  const b = baseRow(i, prev?.remark ?? '');
  return {
    ...b,
    displayName: name,
    loginUsername: prev?.loginUsername ?? name,
    roleName: prev?.roleName ?? '客服',
    team: prev?.team ?? '',
    joinSchedule: prev?.joinSchedule ?? true,
    joinKpi: prev?.joinKpi ?? true,
    nightShiftOk: prev?.nightShiftOk ?? false,
    enabled: prev?.enabled ?? true,
  };
}

function replaceByName<T extends { id: string; name: string; sortOrder: number; enabled: boolean }>(
  prev: T[],
  names: string[],
  build: (name: string, i: number, prevRow?: T) => T,
): T[] {
  const map = new Map(prev.map((r) => [r.name.trim(), r]));
  const list = names.map((n, i) => {
    const name = n.trim();
    const ex = name ? map.get(name) : undefined;
    return build(name, i, ex);
  });
  return list.filter((r) => r.name);
}

function replaceStaffByDisplay(
  prev: StaffRow[],
  names: string[],
): StaffRow[] {
  const map = new Map(prev.map((r) => [r.displayName.trim(), r]));
  return names
    .map((n, i) => {
      const name = n.trim();
      if (!name) return null;
      const ex = map.get(name);
      return staffFromName(name, i, ex ?? undefined);
    })
    .filter((x): x is StaffRow => x != null);
}

/** 从旧版「每行一个」结构生成完整 v2（含默认扩展模块） */
export function buildV2FromLegacy(legacy: Partial<LegacyOptions>): ConfigCenterV2 {
  const L: LegacyOptions = { ...DEFAULT_LEGACY, ...legacy };
  return {
    version: 2,
    shops: L.shops.map((n, i) => shopFromName(n.trim(), i)),
    inquiryTypes: L.inquiry_types.map((n, i) => inquiryFromName(n.trim(), i)),
    customerTypes: L.customer_types.map((n, i) => customerFromName(n.trim(), i)),
    followupStatuses: L.status_options.map((n, i) => statusFromName(n.trim(), i)),
    lostReasons: L.lost_reasons.map((n, i) => lostFromName(n.trim(), i)),
    staff: L.staff_roster.map((n, i) => staffFromName(n.trim(), i)),
    kpiMetrics: seedKpi(),
    todayTaskTemplates: seedTaskTpl(),
    reviewTaskRules: seedReviewRules(),
    reminderRules: seedReminders(),
    rolePermissions: seedRoles(),
    basicDict: seedBasicDict(),
  };
}

function seedKpi(): KpiMetricRow[] {
  const defs = [
    { name: '有效询单量', weight: 0.25, targetPeriod: '日', calcMethod: '系统统计' },
    { name: '成交转化率', weight: 0.25, targetPeriod: '周', calcMethod: '成交数/询单数' },
    { name: '跟进完成率', weight: 0.2, targetPeriod: '日', calcMethod: '已完成跟进/计划跟进' },
    { name: '客户满意度', weight: 0.15, targetPeriod: '月', calcMethod: '评价均分' },
    { name: '复购贡献', weight: 0.15, targetPeriod: '月', calcMethod: '复购金额占比' },
  ];
  return defs.map((d, i) => ({
    ...baseRow(i),
    ...d,
    enabled: true,
  }));
}

function seedTaskTpl(): TodayTaskTemplateRow[] {
  return [
    {
      ...baseRow(0),
      name: '早班开店检查',
      taskType: '例行',
      shiftApplicable: '早班',
      defaultStartTime: '08:30',
      defaultEndTime: '09:00',
      defaultPriority: '中',
      completionMode: '打卡',
      needReview: false,
      enabled: true,
    },
    {
      ...baseRow(1),
      name: '晚班复盘填写',
      taskType: '报表',
      shiftApplicable: '晚班',
      defaultStartTime: '21:00',
      defaultEndTime: '22:00',
      defaultPriority: '高',
      completionMode: '提交表单',
      needReview: true,
      enabled: true,
    },
  ];
}

function seedReviewRules(): ReviewTaskRuleRow[] {
  return [
    {
      ...baseRow(0),
      name: '天猫好评晒图',
      reviewType: '好评+晒图',
      kpiWeight: 1,
      needScreenshot: true,
      needOrderNo: true,
      needManagerApproval: false,
      enabled: true,
    },
    {
      ...baseRow(1),
      name: '抖音评价',
      reviewType: '短视频评价',
      kpiWeight: 0.8,
      needScreenshot: true,
      needOrderNo: false,
      needManagerApproval: true,
      enabled: true,
    },
  ];
}

function seedReminders(): ReminderRuleRow[] {
  return [
      {
        ...baseRow(0),
        name: '跟进超时提醒',
        scene: '客户超过48小时未跟进',
        leadMinutes: 60,
        targetRole: '所属客服',
        channel: '站内消息',
        enabled: true,
      },
      {
        ...baseRow(1),
        name: '评价任务截止',
        scene: '当日评价任务未完成',
        leadMinutes: 120,
        targetRole: '主管',
        channel: '企业微信',
        enabled: true,
      },
    ];
}

function seedRoles(): RolePermissionRow[] {
  return [
    { ...baseRow(0), name: '管理员', code: 'admin', permissionsSummary: '全部菜单与配置', enabled: true },
    { ...baseRow(1), name: '主管', code: 'manager', permissionsSummary: '团队数据、排班、审核', enabled: true },
    { ...baseRow(2), name: '客服', code: 'staff', permissionsSummary: '本人客户、任务、日报', enabled: true },
  ];
}

function seedBasicDict(): BasicDictRow[] {
  return [
    { ...baseRow(0), dictKey: 'intent_level_hint', label: '意向等级说明', value: '1-5 星', enabled: true },
    { ...baseRow(1), dictKey: 'default_channel', label: '默认跟进渠道', value: '微信', enabled: true },
  ];
}

export function createDefaultV2(): ConfigCenterV2 {
  return buildV2FromLegacy(DEFAULT_LEGACY);
}

/** 供 GET /api/options：从 v2 推导旧版字符串数组（仅启用项，按 sortOrder） */
export function legacyOptionsFromV2(v2: ConfigCenterV2): LegacyOptions {
  const pick = <T extends { enabled: boolean; sortOrder: number }>(rows: T[], nameOf: (r: T) => string) =>
    [...rows]
      .filter((r) => r.enabled)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(nameOf)
      .filter(Boolean);

  return {
    shops: pick(v2.shops, (r) => r.name),
    inquiry_types: pick(v2.inquiryTypes, (r) => r.name),
    customer_types: pick(v2.customerTypes, (r) => r.name),
    status_options: pick(v2.followupStatuses, (r) => r.name),
    lost_reasons: pick(v2.lostReasons, (r) => r.name),
    staff_roster: pick(v2.staff, (r) => r.displayName),
  };
}

/** 将 v2 中六类「名单」与旧版文本对齐，保留已匹配行的扩展字段 */
export function mergeLegacyTextIntoV2(v2: ConfigCenterV2, legacy: Partial<LegacyOptions>): ConfigCenterV2 {
  const next = { ...v2, version: 2 as const };
  if (legacy.shops)
    next.shops = replaceByName(v2.shops, legacy.shops, (name, i, p) => shopFromName(name, i, p));
  if (legacy.inquiry_types)
    next.inquiryTypes = replaceByName(v2.inquiryTypes, legacy.inquiry_types, (name, i, p) =>
      inquiryFromName(name, i, p),
    );
  if (legacy.customer_types)
    next.customerTypes = replaceByName(v2.customerTypes, legacy.customer_types, (name, i, p) =>
      customerFromName(name, i, p),
    );
  if (legacy.status_options)
    next.followupStatuses = replaceByName(v2.followupStatuses, legacy.status_options, (name, i, p) =>
      statusFromName(name, i, p),
    );
  if (legacy.lost_reasons)
    next.lostReasons = replaceByName(v2.lostReasons, legacy.lost_reasons, (name, i, p) =>
      lostFromName(name, i, p),
    );
  if (legacy.staff_roster) next.staff = replaceStaffByDisplay(v2.staff, legacy.staff_roster);
  return renumberSortOrders(next);
}

/** 解析每行文本为字符串数组 */
export function linesToList(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function listToLines(list: string[]): string {
  return list.join('\n');
}

function renumberSortOrders(v2: ConfigCenterV2): ConfigCenterV2 {
  const fix = <T extends { sortOrder: number }>(rows: T[]) => rows.map((r, i) => ({ ...r, sortOrder: i }));
  return {
    ...v2,
    shops: fix(v2.shops),
    inquiryTypes: fix(v2.inquiryTypes),
    customerTypes: fix(v2.customerTypes),
    followupStatuses: fix(v2.followupStatuses),
    lostReasons: fix(v2.lostReasons),
    staff: fix(v2.staff),
    kpiMetrics: fix(v2.kpiMetrics),
    todayTaskTemplates: fix(v2.todayTaskTemplates),
    reviewTaskRules: fix(v2.reviewTaskRules),
    reminderRules: fix(v2.reminderRules),
    rolePermissions: fix(v2.rolePermissions),
    basicDict: fix(v2.basicDict),
  };
}

function isObj(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

/** 宽松校验并补齐缺省数组，避免损坏 JSON 导致白屏 */
export function coerceConfigV2(raw: unknown): ConfigCenterV2 {
  const d = createDefaultV2();
  if (!isObj(raw) || raw.version !== 2) return d;
  const g = <T>(v: unknown, fallback: T[]): T[] => (Array.isArray(v) ? (v as T[]) : fallback);
  return renumberSortOrders({
    version: 2,
    shops: g(raw.shops, d.shops),
    inquiryTypes: g(raw.inquiryTypes, d.inquiryTypes),
    customerTypes: g(raw.customerTypes, d.customerTypes),
    followupStatuses: g(raw.followupStatuses, d.followupStatuses),
    lostReasons: g(raw.lostReasons, d.lostReasons),
    staff: g(raw.staff, d.staff),
    kpiMetrics: g(raw.kpiMetrics, d.kpiMetrics),
    todayTaskTemplates: g(raw.todayTaskTemplates, d.todayTaskTemplates),
    reviewTaskRules: g(raw.reviewTaskRules, d.reviewTaskRules),
    reminderRules: g(raw.reminderRules, d.reminderRules),
    rolePermissions: g(raw.rolePermissions, d.rolePermissions),
    basicDict: g(raw.basicDict, d.basicDict),
  });
}

export async function loadConfigV2FromDb(getSetting: (key: string) => Promise<string | null>): Promise<ConfigCenterV2 | null> {
  const raw = await getSetting(CONFIG_CENTER_V2_KEY);
  if (!raw) return null;
  try {
    return coerceConfigV2(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function loadConfigV2OrFromLegacy(
  getSetting: (key: string) => Promise<string | null>,
  getLegacy: (keys: LegacyOptionKey[]) => Promise<Partial<LegacyOptions>>,
): Promise<ConfigCenterV2> {
  const v2 = await loadConfigV2FromDb(getSetting);
  if (v2) return v2;
  const legacy = await getLegacy([...LEGACY_OPTION_KEYS]);
  return buildV2FromLegacy({ ...DEFAULT_LEGACY, ...legacy });
}
