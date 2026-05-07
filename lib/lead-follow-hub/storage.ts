import { emitWorkspaceStorageUpdated } from '@/lib/workspace-events';
import type {
  DailyInquiryReport,
  DouyinLeadFollowRecord,
  LeadConversionSettings,
  LeadFollowRecord,
  NoDealInquiryReflection,
} from './types';
import {
  LS_DAILY_INQUIRY_REPORTS,
  LS_DOUYIN_LEAD_FOLLOW_RECORDS,
  LS_LEAD_CONVERSION_SETTINGS,
  LS_LEAD_FOLLOW_LAST_SNAPSHOT,
  LS_LEAD_FOLLOW_PREFILL_LAST,
  LS_LEAD_FOLLOW_RECORDS,
  LS_NO_DEAL_INQUIRY_REFLECTIONS,
} from './storage-keys';

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function rid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `lf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function isoNow() {
  return new Date().toISOString();
}

const DEFAULT_SETTINGS: LeadConversionSettings = {
  targetLeadRate: 0.25,
  strictLeadRules: false,
  shops: [],
  inquiryTypes: [],
  customerTypes: [],
  statusOptions: [],
  lostReasons: [],
};

export function loadDailyInquiryReports(): DailyInquiryReport[] {
  if (typeof window === 'undefined') return [];
  return safeParse<DailyInquiryReport[]>(localStorage.getItem(LS_DAILY_INQUIRY_REPORTS), []);
}

export function saveDailyInquiryReports(list: DailyInquiryReport[]) {
  localStorage.setItem(LS_DAILY_INQUIRY_REPORTS, JSON.stringify(list));
  emitWorkspaceStorageUpdated();
}

export function loadLeadFollowRecords(): LeadFollowRecord[] {
  if (typeof window === 'undefined') return [];
  return safeParse<LeadFollowRecord[]>(localStorage.getItem(LS_LEAD_FOLLOW_RECORDS), []);
}

export function saveLeadFollowRecords(list: LeadFollowRecord[]) {
  localStorage.setItem(LS_LEAD_FOLLOW_RECORDS, JSON.stringify(list));
  emitWorkspaceStorageUpdated();
}

export function loadDouyinLeadFollowRecords(): DouyinLeadFollowRecord[] {
  if (typeof window === 'undefined') return [];
  return safeParse<DouyinLeadFollowRecord[]>(localStorage.getItem(LS_DOUYIN_LEAD_FOLLOW_RECORDS), []);
}

export function saveDouyinLeadFollowRecords(list: DouyinLeadFollowRecord[]) {
  localStorage.setItem(LS_DOUYIN_LEAD_FOLLOW_RECORDS, JSON.stringify(list));
  emitWorkspaceStorageUpdated();
}

export function loadNoDealInquiryReflections(): NoDealInquiryReflection[] {
  if (typeof window === 'undefined') return [];
  return safeParse<NoDealInquiryReflection[]>(localStorage.getItem(LS_NO_DEAL_INQUIRY_REFLECTIONS), []);
}

export function saveNoDealInquiryReflections(list: NoDealInquiryReflection[]) {
  localStorage.setItem(LS_NO_DEAL_INQUIRY_REFLECTIONS, JSON.stringify(list));
  emitWorkspaceStorageUpdated();
}

export function loadLeadConversionSettings(): LeadConversionSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS };
  const s = safeParse<Partial<LeadConversionSettings> | null>(localStorage.getItem(LS_LEAD_CONVERSION_SETTINGS), null);
  if (!s) return { ...DEFAULT_SETTINGS };
  return { ...DEFAULT_SETTINGS, ...s };
}

export function saveLeadConversionSettings(s: LeadConversionSettings) {
  localStorage.setItem(LS_LEAD_CONVERSION_SETTINGS, JSON.stringify(s));
  emitWorkspaceStorageUpdated();
}

const SNAPSHOT_KEYS: (keyof LeadFollowRecord)[] = [
  'storeName',
  'employeeName',
  'inquiryType',
  'productModel',
  'customerType',
  'sourcePlatform',
  'isDouyinLead',
  'douyinCallStatus',
  'purchaseIntent',
  'customerLevel',
];

/** 保存最近一次成功保存的留资行模板字段（不含客户标识与跟进内容） */
export function saveLeadFollowLastSnapshot(row: LeadFollowRecord) {
  if (typeof window === 'undefined') return;
  const o: Partial<LeadFollowRecord> = {};
  for (const k of SNAPSHOT_KEYS) {
    (o as Record<string, unknown>)[k] = row[k];
  }
  localStorage.setItem(LS_LEAD_FOLLOW_LAST_SNAPSHOT, JSON.stringify(o));
}

export function loadLeadFollowLastSnapshot(): Partial<LeadFollowRecord> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LS_LEAD_FOLLOW_LAST_SNAPSHOT);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<LeadFollowRecord>;
  } catch {
    return null;
  }
}

export function getLeadFollowPrefillLastEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const v = localStorage.getItem(LS_LEAD_FOLLOW_PREFILL_LAST);
  if (v === null || v === '') return true;
  return v === '1' || v === 'true';
}

export function setLeadFollowPrefillLastEnabled(on: boolean) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LS_LEAD_FOLLOW_PREFILL_LAST, on ? '1' : '0');
}

/** 套用上次模板：保留 base 的 id/date/时间戳，清空客户与跟进字段 */
export function applyLeadFollowPrefillFromSnapshot(base: LeadFollowRecord, snap: Partial<LeadFollowRecord> | null): LeadFollowRecord {
  if (!snap) return base;
  return {
    ...base,
    storeName: String(snap.storeName || base.storeName || ''),
    employeeName: String(snap.employeeName || base.employeeName || ''),
    inquiryType: snap.inquiryType ?? '',
    productModel: '',
    customerType: snap.customerType ?? '',
    sourcePlatform: snap.sourcePlatform ?? '',
    isDouyinLead: !!snap.isDouyinLead,
    douyinCallStatus: snap.douyinCallStatus ?? '',
    purchaseIntent: snap.purchaseIntent ?? '',
    customerLevel: snap.customerLevel ?? '',
    customerPlatformId: '',
    phone: '',
    customerWechat: '',
    hasAddedWechat: false,
    hasSentInterceptPayment: false,
    isDeal: false,
    currentStatus: '',
    statusRemark: '',
    dealAmount: 0,
    firstCallDate: '',
    firstCallResult: '',
    secondCallDate: '',
    secondCallResult: '',
    thirdCallDate: '',
    thirdCallResult: '',
    fourthCallDate: '',
    fourthCallResult: '',
    nextFollowTime: '',
    remark: '',
  };
}
