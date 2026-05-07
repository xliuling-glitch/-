import { emitWorkspaceStorageUpdated } from '@/lib/workspace-events';
import type {
  CustomerAfterSalesRecord,
  CustomerGrowthPlanRecord,
  OldCustomerFollowTask,
  OldCustomerProfile,
  RepurchaseOpportunity,
} from './types';
import {
  LS_CUSTOMER_AFTER_SALES_RECORDS,
  LS_CUSTOMER_GROWTH_PLAN_RECORDS,
  LS_OLD_CUSTOMER_FOLLOW_TASKS,
  LS_OLD_CUSTOMER_PROFILES,
  LS_REPURCHASE_OPPORTUNITIES,
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
  return `crm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function isoNow() {
  return new Date().toISOString();
}

export function loadProfiles(): OldCustomerProfile[] {
  if (typeof window === 'undefined') return [];
  return safeParse<OldCustomerProfile[]>(localStorage.getItem(LS_OLD_CUSTOMER_PROFILES), []);
}

export function saveProfiles(list: OldCustomerProfile[]) {
  localStorage.setItem(LS_OLD_CUSTOMER_PROFILES, JSON.stringify(list));
  emitWorkspaceStorageUpdated();
}

export function loadFollowTasks(): OldCustomerFollowTask[] {
  if (typeof window === 'undefined') return [];
  return safeParse<OldCustomerFollowTask[]>(localStorage.getItem(LS_OLD_CUSTOMER_FOLLOW_TASKS), []);
}

export function saveFollowTasks(list: OldCustomerFollowTask[]) {
  localStorage.setItem(LS_OLD_CUSTOMER_FOLLOW_TASKS, JSON.stringify(list));
  emitWorkspaceStorageUpdated();
}

export function loadRepurchase(): RepurchaseOpportunity[] {
  if (typeof window === 'undefined') return [];
  return safeParse<RepurchaseOpportunity[]>(localStorage.getItem(LS_REPURCHASE_OPPORTUNITIES), []);
}

export function saveRepurchase(list: RepurchaseOpportunity[]) {
  localStorage.setItem(LS_REPURCHASE_OPPORTUNITIES, JSON.stringify(list));
  emitWorkspaceStorageUpdated();
}

export function loadAfterSales(): CustomerAfterSalesRecord[] {
  if (typeof window === 'undefined') return [];
  return safeParse<CustomerAfterSalesRecord[]>(localStorage.getItem(LS_CUSTOMER_AFTER_SALES_RECORDS), []);
}

export function saveAfterSales(list: CustomerAfterSalesRecord[]) {
  localStorage.setItem(LS_CUSTOMER_AFTER_SALES_RECORDS, JSON.stringify(list));
  emitWorkspaceStorageUpdated();
}

export function loadGrowthRecords(): CustomerGrowthPlanRecord[] {
  if (typeof window === 'undefined') return [];
  return safeParse<CustomerGrowthPlanRecord[]>(localStorage.getItem(LS_CUSTOMER_GROWTH_PLAN_RECORDS), []);
}

export function saveGrowthRecords(list: CustomerGrowthPlanRecord[]) {
  localStorage.setItem(LS_CUSTOMER_GROWTH_PLAN_RECORDS, JSON.stringify(list));
  emitWorkspaceStorageUpdated();
}
