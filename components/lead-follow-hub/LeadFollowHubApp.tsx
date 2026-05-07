'use client';

import Link from 'next/link';
import { leadFollowQuery } from '@/lib/shift-sop/links';
import type { ChangeEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui';
import { cn } from '@/lib/utils';
import { formatAmountYuan } from '@/lib/format-amount';
import { WORKSPACE_STORAGE_UPDATED } from '@/lib/workspace-events';
import { getWeekRange } from '@/lib/daily-work-package/storage';
import type {
  DailyInquiryReport,
  DouyinLeadFollowRecord,
  LeadConversionSettings,
  LeadFollowRecord,
  NoDealInquiryReflection,
} from '@/lib/lead-follow-hub/types';
import {
  loadDailyInquiryReports,
  saveDailyInquiryReports,
  loadLeadFollowRecords,
  saveLeadFollowRecords,
  loadDouyinLeadFollowRecords,
  saveDouyinLeadFollowRecords,
  loadLeadConversionSettings,
  saveLeadConversionSettings,
  loadNoDealInquiryReflections,
  saveNoDealInquiryReflections,
  rid,
  isoNow,
  saveLeadFollowLastSnapshot,
  loadLeadFollowLastSnapshot,
  getLeadFollowPrefillLastEnabled,
  setLeadFollowPrefillLastEnabled,
  applyLeadFollowPrefillFromSnapshot,
} from '@/lib/lead-follow-hub/storage';
import { exportLeadFollowRecordsCsv, parseCsvRaw, rowsToLeadFollowRecords } from '@/lib/lead-follow-hub/lead-follow-csv';
import {
  aggregateByStaffStore,
  aggregateStaffStoreRange,
  aggregateStoreRange,
  leadRate,
  isValidLead,
} from '@/lib/lead-follow-hub/stats';

const TABS: { id: string; label: string }[] = [
  { id: 'today', label: '今日留资登记' },
  { id: 'detail', label: '留资跟进明细' },
  { id: 'no-deal', label: '未成交询单反思' },
  { id: 'daily', label: '日报/询单量登记' },
  { id: 'douyin', label: '抖音留资电联跟踪' },
  { id: 'store', label: '店铺留资率统计' },
  { id: 'staff', label: '客服留资率统计' },
  { id: 'config', label: '留资字段配置' },
];

function monthRangeYmd(anchor: string): { start: string; end: string } {
  const [y, m] = anchor.split('-').map((x) => parseInt(x, 10));
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

function emptyLead(date: string, employeeName: string, storeName: string): LeadFollowRecord {
  const t = isoNow();
  return {
    id: rid(),
    date,
    storeName,
    employeeName,
    inquiryType: '',
    productModel: '',
    customerType: '',
    customerPlatformId: '',
    phone: '',
    customerWechat: '',
    hasAddedWechat: false,
    hasSentInterceptPayment: false,
    isDeal: false,
    currentStatus: '',
    statusRemark: '',
    dealAmount: 0,
    purchaseIntent: '',
    customerLevel: '',
    firstCallDate: '',
    firstCallResult: '',
    secondCallDate: '',
    secondCallResult: '',
    thirdCallDate: '',
    thirdCallResult: '',
    fourthCallDate: '',
    fourthCallResult: '',
    sourcePlatform: '',
    isDouyinLead: false,
    douyinCallStatus: '',
    nextFollowTime: '',
    remark: '',
    createdAt: t,
    updatedAt: t,
  };
}

function emptyDaily(date: string, employeeName: string, storeName: string): DailyInquiryReport {
  const t = isoNow();
  return {
    id: rid(),
    date,
    employeeName,
    storeName,
    inquiryCount: 0,
    afterSalesCount: 0,
    invalidCount: 0,
    presalesValidCount: 0,
    dealCustomerCount: 0,
    dailySalesAmount: 0,
    remark: '',
    createdAt: t,
    updatedAt: t,
  };
}

function emptyDouyin(date: string, employeeName: string): DouyinLeadFollowRecord {
  const t = isoNow();
  return {
    id: rid(),
    date,
    employeeName,
    customerName: '',
    phone: '',
    douyinSource: '',
    hasCalled: false,
    callTime: '',
    callResult: '',
    nextFollowTime: '',
    isDeal: false,
    dealAmount: 0,
    remark: '',
    createdAt: t,
    updatedAt: t,
  };
}

function emptyNoDealReflection(date: string, employeeName: string, storeName: string): NoDealInquiryReflection {
  const t = isoNow();
  return {
    id: rid(),
    date,
    storeName,
    employeeName,
    customerRef: '',
    inquirySummary: '',
    reasonCategory: '',
    reasonNote: '',
    reflection: '',
    improvement: '',
    createdAt: t,
    updatedAt: t,
  };
}

function parseList(raw: string): string[] {
  return raw
    .split(/[,，\n]/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 留资明细表单：购买欲望 / 客户分类标准选项（CSV 存字面量） */
const LEAD_PURCHASE_INTENT_STARS = ['1星', '2星', '3星', '4星', '5星'] as const;
const LEAD_CUSTOMER_LEVELS = ['L1', 'L2', 'L3', 'L4', 'L5'] as const;

function LeadFollowCsvBar({
  exportRows,
  defaultImportDate,
  userName,
  canViewAll,
  leads,
  setLeads,
}: {
  exportRows: LeadFollowRecord[];
  defaultImportDate: string;
  userName: string;
  canViewAll: boolean;
  leads: LeadFollowRecord[];
  setLeads: (v: LeadFollowRecord[]) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const doExport = () => {
    const csv = exportLeadFollowRecordsCsv(exportRows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `留资跟进表_${defaultImportDate}_${exportRows.length}条.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const onPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const text = await f.text();
    const grid = parseCsvRaw(text);
    const res = rowsToLeadFollowRecords(grid, {
      defaultDate: defaultImportDate,
      viewerName: userName,
      canImportAll: canViewAll,
    });
    if (!res.ok) {
      window.alert(res.error);
      return;
    }
    const msg = [`已导入 ${res.records.length} 条`, res.skipped ? `跳过 ${res.skipped} 行` : null, ...res.warnings.slice(0, 5)]
      .filter(Boolean)
      .join('；');
    if (res.warnings.length > 5) window.alert(`${msg}\n…另有 ${res.warnings.length - 5} 条警告见控制台`);
    else window.alert(msg);
    if (res.warnings.length) console.warn(res.warnings);
    saveLeadFollowRecords([...leads, ...res.records]);
    setLeads(loadLeadFollowRecords());
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-ash bg-white/80 px-3 py-2">
      <span className="text-xs font-medium text-graphite">表格导入导出</span>
      <a href="/templates/留资跟进表_标准模板.csv" download className="btn-ghost text-xs">
        下载模板
      </a>
      <button type="button" className="btn-ghost text-xs" onClick={doExport}>
        导出 CSV（当前列表）
      </button>
      <button type="button" className="btn-primary text-xs" onClick={() => fileRef.current?.click()}>
        导入 CSV
      </button>
      <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(ev) => void onPick(ev)} />
      <span className="text-[11px] text-slate-mid">
        列与手工表单一致；普通客服仅能导入「客服名称」为本人({userName || '—'})的行。
      </span>
    </div>
  );
}

export function LeadFollowHubApp() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab = TABS.some((x) => x.id === tabParam) ? tabParam! : 'today';

  const setTab = (id: string) => {
    const q = new URLSearchParams(searchParams.toString());
    q.set('tab', id);
    router.replace(`/dashboard/lead-follow?${q.toString()}`);
  };

  const [hubDate, setHubDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [userName, setUserName] = useState('');
  const [role, setRole] = useState<string | null>(null);
  const [reports, setReports] = useState<DailyInquiryReport[]>([]);
  const [leads, setLeads] = useState<LeadFollowRecord[]>([]);
  const [douyinRows, setDouyinRows] = useState<DouyinLeadFollowRecord[]>([]);
  const [noDealReflections, setNoDealReflections] = useState<NoDealInquiryReflection[]>([]);
  const [settings, setSettings] = useState<LeadConversionSettings | null>(null);

  const [apiOpts, setApiOpts] = useState<Record<string, string[]>>({});

  useEffect(() => {
    fetch('/api/session')
      .then((r) => r.json())
      .then((j) => {
        const u = j?.user;
        if (u?.name) setUserName(String(u.name));
        if (u?.role) setRole(String(u.role));
      })
      .catch(() => {});
    fetch('/api/options')
      .then(async (r) => (r.ok ? r.json() : {}))
      .then((o) => {
        if (o && typeof o === 'object') setApiOpts(o as Record<string, string[]>);
      })
      .catch(() => {});
  }, []);

  const refreshLocal = useCallback(() => {
    setReports(loadDailyInquiryReports());
    setLeads(loadLeadFollowRecords());
    setDouyinRows(loadDouyinLeadFollowRecords());
    setNoDealReflections(loadNoDealInquiryReflections());
    setSettings(loadLeadConversionSettings());
  }, []);

  useEffect(() => {
    refreshLocal();
  }, [refreshLocal]);

  useEffect(() => {
    const d = searchParams.get('date');
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) setHubDate(d);
  }, [searchParams]);

  /** 从今日任务等跳转：?tab=douyin&add=1 自动插入一条空白抖音留资行，并去掉 add 避免刷新重复 */
  useEffect(() => {
    if (tab !== 'douyin' || searchParams.get('add') !== '1') return;

    const rowDate = (() => {
      const d = searchParams.get('date');
      if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
      return hubDate;
    })();
    const staff = userName || '客服';
    const existing = loadDouyinLeadFollowRecords();
    const recentEmpty = existing.some(
      (x) =>
        x.date === rowDate &&
        x.employeeName === staff &&
        !String(x.customerName || '').trim() &&
        !String(x.phone || '').trim() &&
        Date.parse(x.createdAt) > Date.now() - 12000,
    );
    if (!recentEmpty) {
      const r = emptyDouyin(rowDate, staff);
      saveDouyinLeadFollowRecords([...existing, r]);
      setDouyinRows(loadDouyinLeadFollowRecords());
    }

    const q = new URLSearchParams(searchParams.toString());
    q.delete('add');
    router.replace(`/dashboard/lead-follow?${q.toString()}`);
  }, [searchParams, tab, hubDate, userName, router]);

  useEffect(() => {
    const onEvt = () => refreshLocal();
    window.addEventListener(WORKSPACE_STORAGE_UPDATED, onEvt);
    return () => window.removeEventListener(WORKSPACE_STORAGE_UPDATED, onEvt);
  }, [refreshLocal]);

  const canViewAll = role === 'admin' || role === 'manager';

  const merged = useMemo(() => {
    const s = settings ?? loadLeadConversionSettings();
    const shops = s.shops?.length ? s.shops : apiOpts.shops ?? [];
    const inquiryTypes = s.inquiryTypes?.length ? s.inquiryTypes : apiOpts.inquiry_types ?? [];
    const customerTypes = s.customerTypes?.length ? s.customerTypes : apiOpts.customer_types ?? [];
    const statusOptions = s.statusOptions?.length ? s.statusOptions : apiOpts.status_options ?? [];
    const lostReasons = s.lostReasons?.length ? s.lostReasons : apiOpts.lost_reasons ?? [];
    return { shops, inquiryTypes, customerTypes, statusOptions, lostReasons, targetLeadRate: s.targetLeadRate };
  }, [settings, apiOpts]);

  const staffFilterForLists = canViewAll ? '' : userName;

  const overview = useMemo(() => {
    const st = settings ?? loadLeadConversionSettings();
    const dayReports = reports.filter((r) => r.date === hubDate && (canViewAll ? true : r.employeeName === userName));
    const dayLeads = leads.filter((l) => l.date === hubDate && (canViewAll ? true : l.employeeName === userName));
    const dayDy = douyinRows.filter((d) => d.date === hubDate && (canViewAll ? true : d.employeeName === userName));
    const totalInquiry = dayReports.reduce((a, r) => a + Math.max(0, Number(r.inquiryCount) || 0), 0);
    const totalLeads = dayLeads.filter((l) => isValidLead(l, st)).length;
    const avgRate = leadRate(totalInquiry, totalLeads);
    const deals = dayLeads.filter((l) => l.isDeal).length;
    const dealAmt = dayLeads.filter((l) => l.isDeal).reduce((a, l) => a + (Number(l.dealAmount) || 0), 0);
    const dyUncalled = dayDy.filter((d) => !d.hasCalled).length;
    const unfollow = dayLeads.filter((l) => {
      const hasCall = [l.firstCallDate, l.secondCallDate, l.thirdCallDate, l.fourthCallDate].some((x) => String(x || '').trim());
      return !hasCall && !l.isDeal;
    }).length;
    return { totalInquiry, totalLeads, avgRate, deals, dealAmt, dyUncalled, unfollow };
  }, [reports, leads, douyinRows, hubDate, userName, canViewAll, settings]);

  const rateColor = (rate: number, inquiry: number) => {
    const target = merged.targetLeadRate ?? 0.25;
    if (!inquiry || inquiry <= 0) return 'text-slate-600';
    return rate >= target ? 'text-emerald-700' : 'text-red-600';
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-coal-ink">留资跟进表</h2>
          <p className="mt-1 text-sm text-slate-mid">
            结构化登记日报询单量与留资明细，自动汇总留资率；含<strong className="font-medium text-coal-ink">未成交询单反思</strong>
            独立登记表（应对 SOP「思考未成交原因」）。数据存本机 LocalStorage。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label className="flex items-center gap-2 text-graphite">
            业务日期
            <input type="date" className="input-field w-auto" value={hubDate} onChange={(e) => setHubDate(e.target.value)} />
          </label>
          <span className="rounded-full border border-ash bg-white px-3 py-1 text-xs text-graphite">
            当前账号：{userName || '…'} {role ? `· ${role}` : ''}
          </span>
          <Link href="/dashboard/tasks" className="btn-ghost text-sm">
            返回今日任务中心
          </Link>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {[
          ['今日总咨询量', String(overview.totalInquiry)],
          ['今日总留资数', String(overview.totalLeads)],
          ['今日平均留资率', `${(overview.avgRate * 100).toFixed(1)}%`],
          ['今日成交数', String(overview.deals)],
          ['今日成交金额', formatAmountYuan(overview.dealAmt)],
          ['抖音留资未电联', String(overview.dyUncalled)],
          ['今日未跟进客户数', String(overview.unfollow)],
        ].map(([k, v]) => {
          const isDy = k === '抖音留资未电联';
          const dyHref =
            isDy && overview.dyUncalled > 0
              ? leadFollowQuery('douyin', { date: hubDate, add: '1' })
              : null;
          const inner = (
            <>
              <div className="text-xs text-slate-mid">{k}</div>
              <div className="mt-1 font-semibold text-coal-ink">{v}</div>
            </>
          );
          return dyHref ? (
            <Link key={String(k)} href={dyHref} className="block">
              <Card className="border border-ash p-3 transition-colors hover:border-sky-300 hover:bg-sky-50/40">{inner}</Card>
            </Link>
          ) : (
            <Card key={String(k)} className="border border-ash p-3">
              {inner}
            </Card>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-1 border-b border-ash pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={cn(
              'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              tab === t.id ? 'bg-coal-ink text-white' : 'bg-white text-graphite hover:bg-ash/60',
            )}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {settings ? (
        <>
          {tab === 'today' ? (
            <TodayRegisterTab
              hubDate={hubDate}
              userName={userName}
              canViewAll={canViewAll}
              staffFilter={staffFilterForLists}
              leads={leads}
              setLeads={setLeads}
              merged={merged}
              targetLeadRate={merged.targetLeadRate}
            />
          ) : null}
          {tab === 'detail' ? (
            <DetailTab hubDate={hubDate} userName={userName} canViewAll={canViewAll} leads={leads} setLeads={setLeads} merged={merged} />
          ) : null}
          {tab === 'no-deal' ? (
            <NoDealReflectionTab
              hubDate={hubDate}
              userName={userName}
              canViewAll={canViewAll}
              merged={merged}
              reflections={noDealReflections}
              setReflections={setNoDealReflections}
            />
          ) : null}
          {tab === 'daily' ? (
            <DailyReportTab
              hubDate={hubDate}
              userName={userName}
              canViewAll={canViewAll}
              reports={reports}
              setReports={setReports}
              merged={merged}
            />
          ) : null}
          {tab === 'douyin' ? (
            <DouyinTab hubDate={hubDate} userName={userName} canViewAll={canViewAll} rows={douyinRows} setRows={setDouyinRows} />
          ) : null}
          {tab === 'store' ? (
            <StoreStatsTab reports={reports} leads={leads} settings={settings} hubDate={hubDate} rateColorClass={rateColor} />
          ) : null}
          {tab === 'staff' ? (
            <StaffStatsTab reports={reports} leads={leads} settings={settings} hubDate={hubDate} rateColorClass={rateColor} />
          ) : null}
          {tab === 'config' ? (
            <ConfigTab
              role={role}
              settings={settings}
              setSettings={setSettings}
              apiOpts={apiOpts}
              merged={merged}
            />
          ) : null}
        </>
      ) : (
        <p className="text-sm text-slate-mid">加载配置…</p>
      )}
    </div>
  );
}

type MergedOptions = {
  shops: string[];
  inquiryTypes: string[];
  customerTypes: string[];
  statusOptions: string[];
  lostReasons: string[];
};

const NO_DEAL_REASON_FALLBACK = [
  '价格敏感',
  '信任不足',
  '尺寸/规格不合',
  '时效/物流顾虑',
  '竞品对比流失',
  '客户沉默/失联',
  '需求不匹配',
  '其他',
];

function NoDealReflectionTab({
  hubDate,
  userName,
  canViewAll,
  merged,
  reflections,
  setReflections,
}: {
  hubDate: string;
  userName: string;
  canViewAll: boolean;
  merged: MergedOptions;
  reflections: NoDealInquiryReflection[];
  setReflections: (v: NoDealInquiryReflection[]) => void;
}) {
  const [pickStaff, setPickStaff] = useState('');
  const storeDefault = merged.shops?.[0] ?? '店铺';

  const reasonOptions = useMemo(() => {
    const raw = merged.lostReasons?.length ? merged.lostReasons : NO_DEAL_REASON_FALLBACK;
    const seen = new Set<string>();
    const out: string[] = [];
    for (const x of raw) {
      const t = String(x).trim();
      if (!t || seen.has(t)) continue;
      seen.add(t);
      out.push(t);
    }
    if (!seen.has('其他')) out.push('其他');
    return out;
  }, [merged.lostReasons]);

  const rows = useMemo(() => {
    return reflections.filter((r) => {
      if (r.date !== hubDate) return false;
      if (!canViewAll && r.employeeName !== userName) return false;
      if (canViewAll && pickStaff && r.employeeName !== pickStaff) return false;
      return true;
    });
  }, [reflections, hubDate, userName, canViewAll, pickStaff]);

  const persistAll = (next: NoDealInquiryReflection[]) => {
    saveNoDealInquiryReflections(next);
    setReflections(loadNoDealInquiryReflections());
  };

  const saveRow = (row: NoDealInquiryReflection) => {
    const updated = { ...row, updatedAt: isoNow() };
    persistAll(reflections.map((x) => (x.id === updated.id ? updated : x)));
  };

  const addRow = () => {
    const emp = (canViewAll ? pickStaff || userName : userName) || '客服';
    const row = emptyNoDealReflection(hubDate, emp, storeDefault);
    persistAll([...reflections, row]);
  };

  const removeRow = (id: string) => {
    if (!confirm('确定删除该条未成交反思？')) return;
    persistAll(reflections.filter((x) => x.id !== id));
  };

  return (
    <Card className="border border-ash p-4 space-y-3">
      <p className="text-sm text-graphite">
        针对<strong className="text-coal-ink">当日未成交询单</strong>
        逐条做原因归类与自我反思；可与「留资跟进明细」中客户记录对照填写，互不替代。白班 SOP「深度复盘」跳转本页。
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {canViewAll ? (
          <input
            className="input-field max-w-[200px] text-sm"
            placeholder="筛选客服姓名"
            value={pickStaff}
            onChange={(e) => setPickStaff(e.target.value)}
          />
        ) : (
          <span className="text-sm text-graphite">登记人：{userName || '…'}</span>
        )}
        <button type="button" className="btn-primary text-sm" onClick={addRow}>
          新增一行反思
        </button>
        <span className="text-xs text-slate-mid">业务日 {hubDate} · 已填 {rows.length} 条</span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1100px] w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-ash bg-ash/40 text-left text-xs text-graphite">
              {[
                '日期',
                '店铺',
                '客服',
                '客户标识',
                '询单摘要',
                '未成交主因',
                '原因补充',
                '反思记录',
                '改进/明日动作',
                '操作',
              ].map((h) => (
                <th key={h} className="whitespace-nowrap px-2 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-2 py-6 text-center text-slate-mid">
                  暂无记录，点击「新增一行反思」填写今日未成交询单。
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-ash/80 align-top">
                  <td className="px-2 py-1 whitespace-nowrap text-graphite">{r.date}</td>
                  <td className="px-2 py-1">
                    <select
                      className="input-field w-[120px] text-xs"
                      value={r.storeName}
                      onChange={(e) => saveRow({ ...r, storeName: e.target.value })}
                    >
                      {(merged.shops.length ? merged.shops : ['店铺']).map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1">
                    <input
                      className="input-field w-[88px] text-xs"
                      disabled={!canViewAll}
                      value={r.employeeName}
                      onChange={(e) => saveRow({ ...r, employeeName: e.target.value })}
                      title={canViewAll ? '' : '普通客服不可改他人姓名'}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      className="input-field min-w-[100px] text-xs"
                      placeholder="旺旺/昵称"
                      value={r.customerRef}
                      onChange={(e) => saveRow({ ...r, customerRef: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      className="input-field min-w-[140px] text-xs"
                      placeholder="询价要点、顾虑"
                      value={r.inquirySummary}
                      onChange={(e) => saveRow({ ...r, inquirySummary: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <select
                      className="input-field w-[130px] text-xs"
                      value={r.reasonCategory}
                      onChange={(e) => saveRow({ ...r, reasonCategory: e.target.value })}
                    >
                      <option value="">请选择</option>
                      {reasonOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                      {r.reasonCategory && !reasonOptions.includes(r.reasonCategory) ? (
                        <option value={r.reasonCategory}>{r.reasonCategory}（自定义）</option>
                      ) : null}
                    </select>
                  </td>
                  <td className="px-2 py-1">
                    <input
                      className="input-field min-w-[120px] text-xs"
                      placeholder="细化说明"
                      value={r.reasonNote}
                      onChange={(e) => saveRow({ ...r, reasonNote: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <textarea
                      className="input-field min-h-[56px] min-w-[180px] text-xs"
                      placeholder="聊天记录复盘、话术问题等"
                      value={r.reflection}
                      onChange={(e) => saveRow({ ...r, reflection: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <textarea
                      className="input-field min-h-[56px] min-w-[160px] text-xs"
                      placeholder="明日跟进动作"
                      value={r.improvement}
                      onChange={(e) => saveRow({ ...r, improvement: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-1 whitespace-nowrap">
                    <button type="button" className="text-red-700 underline text-xs" onClick={() => removeRow(r.id)}>
                      删除
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-mid">
        数据键：<code className="rounded bg-ash/60 px-1">no_deal_inquiry_reflections</code>
        （LocalStorage）。「未成交主因」选项来自「留资字段配置 → 未成交原因」，未配置时使用内置清单。
      </p>
    </Card>
  );
}

function TodayRegisterTab({
  hubDate,
  userName,
  canViewAll,
  staffFilter,
  leads,
  setLeads,
  merged,
  targetLeadRate,
}: {
  hubDate: string;
  userName: string;
  canViewAll: boolean;
  staffFilter: string;
  leads: LeadFollowRecord[];
  setLeads: (v: LeadFollowRecord[]) => void;
  merged: MergedOptions;
  targetLeadRate: number;
}) {
  const [pickStaff, setPickStaff] = useState('');
  const staffKey = canViewAll ? pickStaff || '' : staffFilter;
  const storeDefault = merged.shops?.[0] ?? '';
  const [prefillLast, setPrefillLast] = useState(() => getLeadFollowPrefillLastEnabled());

  const rows = useMemo(() => {
    return leads.filter((l) => {
      if (l.date !== hubDate) return false;
      if (!staffKey) return true;
      return l.employeeName === staffKey;
    });
  }, [leads, hubDate, staffKey]);

  const [editing, setEditing] = useState<LeadFollowRecord | null>(null);

  const saveOne = (row: LeadFollowRecord) => {
    const next = { ...row, updatedAt: isoNow() };
    saveLeadFollowRecords(leads.map((x) => (x.id === next.id ? next : x)));
    saveLeadFollowLastSnapshot(next);
    setLeads(loadLeadFollowRecords());
    setEditing(null);
  };

  const addNew = () => {
    const emp = staffKey || userName || '客服';
    let row = emptyLead(hubDate, emp, storeDefault || '店铺');
    if (prefillLast) row = applyLeadFollowPrefillFromSnapshot(row, loadLeadFollowLastSnapshot());
    const next = [...leads, row];
    saveLeadFollowRecords(next);
    setLeads(loadLeadFollowRecords());
    setEditing(row);
  };

  const remove = (id: string) => {
    if (!confirm('确定删除该留资记录？')) return;
    saveLeadFollowRecords(leads.filter((x) => x.id !== id));
    setLeads(loadLeadFollowRecords());
    setEditing((e) => (e?.id === id ? null : e));
  };

  return (
    <div className="space-y-3">
      <Card className="border border-ash p-4 space-y-3">
        <LeadFollowCsvBar
          exportRows={rows}
          defaultImportDate={hubDate}
          userName={userName}
          canViewAll={canViewAll}
          leads={leads}
          setLeads={setLeads}
        />
        <div className="flex flex-wrap items-center gap-2">
          {canViewAll ? (
            <input
              className="input-field max-w-[200px]"
              placeholder="筛选客服姓名"
              value={pickStaff}
              onChange={(e) => setPickStaff(e.target.value)}
            />
          ) : (
            <p className="text-sm text-graphite">默认仅显示本人：{userName}</p>
          )}
          <button type="button" className="btn-primary text-sm" onClick={addNew}>
            新增留资客户
          </button>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-graphite">
            <input
              type="checkbox"
              checked={prefillLast}
              onChange={(e) => {
                const on = e.target.checked;
                setPrefillLast(on);
                setLeadFollowPrefillLastEnabled(on);
              }}
            />
            新增时带入上次模板（店铺/客服/类型等，不含旺旺电话与跟进）
          </label>
        </div>

        {editing ? (
          <LeadEditForm
            row={editing}
            merged={merged}
            onChange={setEditing}
            onSave={() => saveOne(editing)}
            onCancel={() => setEditing(null)}
            onApplyLastTemplate={() =>
              setEditing((prev) => (prev ? applyLeadFollowPrefillFromSnapshot(prev, loadLeadFollowLastSnapshot()) : prev))
            }
          />
        ) : null}

        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-ash bg-ash/40 text-left text-xs text-graphite">
                {[
                  '日期',
                  '店铺',
                  '客服',
                  '咨询类型',
                  '型号',
                  '客户类型',
                  '旺旺/ID',
                  '电话',
                  '微信',
                  '已加微',
                  '成交',
                  '当日状态',
                  '状态备注',
                  '成交金额',
                  '购买欲',
                  '客户分类',
                  '操作',
                ].map((h) => (
                  <th key={h} className="whitespace-nowrap px-2 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-ash/80 hover:bg-ash/30">
                  <td className="px-2 py-1 whitespace-nowrap">{r.date}</td>
                  <td className="px-2 py-1">{r.storeName}</td>
                  <td className="px-2 py-1">{r.employeeName}</td>
                  <td className="px-2 py-1">{r.inquiryType}</td>
                  <td className="px-2 py-1">{r.productModel}</td>
                  <td className="px-2 py-1">{r.customerType}</td>
                  <td className="px-2 py-1">{r.customerPlatformId}</td>
                  <td className="px-2 py-1">{r.phone}</td>
                  <td className="px-2 py-1">{r.customerWechat}</td>
                  <td className="px-2 py-1">{r.hasAddedWechat ? '是' : '否'}</td>
                  <td className="px-2 py-1">{r.isDeal ? '是' : '否'}</td>
                  <td className="px-2 py-1">{r.currentStatus}</td>
                  <td className="px-2 py-1 max-w-[140px] truncate">{r.statusRemark}</td>
                  <td className="px-2 py-1">{r.dealAmount}</td>
                  <td className="px-2 py-1">{r.purchaseIntent}</td>
                  <td className="px-2 py-1">{r.customerLevel}</td>
                  <td className="px-2 py-1 whitespace-nowrap">
                    <button type="button" className="text-sky-800 underline text-xs mr-2" onClick={() => setEditing({ ...r })}>
                      编辑
                    </button>
                    <button type="button" className="text-red-700 underline text-xs" onClick={() => remove(r.id)}>
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-mid">
          有效留资口径：电话 / 微信 / 已加微 任一满足即计入留资率分子（可在「留资字段配置」预留收紧）。目标留资率 {(targetLeadRate * 100).toFixed(0)}%。
        </p>
      </Card>
    </div>
  );
}

function LeadEditForm({
  row,
  merged,
  onChange,
  onSave,
  onCancel,
  onApplyLastTemplate,
}: {
  row: LeadFollowRecord;
  merged: {
    shops: string[];
    inquiryTypes: string[];
    customerTypes: string[];
    statusOptions: string[];
    lostReasons: string[];
  };
  onChange: (r: LeadFollowRecord) => void;
  onSave: () => void;
  onCancel: () => void;
  /** 将上次保存的模板合并进当前行（清空客户联系方式与跟进字段） */
  onApplyLastTemplate?: () => void;
}) {
  const tf = (k: keyof LeadFollowRecord, v: string | number | boolean) => onChange({ ...row, [k]: v });
  return (
    <div className="grid gap-2 rounded-lg border border-dashed border-ash p-3 md:grid-cols-3 lg:grid-cols-4">
      <label className="text-xs text-graphite">
        店铺
        <select className="input-field mt-1 w-full" value={row.storeName} onChange={(e) => tf('storeName', e.target.value)}>
          {(merged.shops.length ? merged.shops : ['未配置']).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-graphite">
        客服名称
        <input className="input-field mt-1 w-full" value={row.employeeName} onChange={(e) => tf('employeeName', e.target.value)} />
      </label>
      <label className="text-xs text-graphite">
        咨询类型
        <select className="input-field mt-1 w-full" value={row.inquiryType} onChange={(e) => tf('inquiryType', e.target.value)}>
          <option value="">请选择</option>
          {(merged.inquiryTypes.length ? merged.inquiryTypes : ['—']).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-graphite">
        产品型号
        <input className="input-field mt-1 w-full" value={row.productModel} onChange={(e) => tf('productModel', e.target.value)} />
      </label>
      <label className="text-xs text-graphite">
        客户类型
        <select className="input-field mt-1 w-full" value={row.customerType} onChange={(e) => tf('customerType', e.target.value)}>
          <option value="">请选择</option>
          {(merged.customerTypes.length ? merged.customerTypes : ['—']).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-graphite">
        旺旺名字/ID
        <input className="input-field mt-1 w-full" value={row.customerPlatformId} onChange={(e) => tf('customerPlatformId', e.target.value)} />
      </label>
      <label className="text-xs text-graphite">
        电话
        <input className="input-field mt-1 w-full" value={row.phone} onChange={(e) => tf('phone', e.target.value)} />
      </label>
      <label className="text-xs text-graphite">
        客户微信
        <input className="input-field mt-1 w-full" value={row.customerWechat} onChange={(e) => tf('customerWechat', e.target.value)} />
      </label>
      <label className="flex items-center gap-2 text-sm text-graphite mt-5">
        <input type="checkbox" checked={row.hasAddedWechat} onChange={(e) => tf('hasAddedWechat', e.target.checked)} />
        是否已加微信
      </label>
      <label className="flex items-center gap-2 text-sm text-graphite mt-5">
        <input type="checkbox" checked={row.hasSentInterceptPayment} onChange={(e) => tf('hasSentInterceptPayment', e.target.checked)} />
        是否发送截留款
      </label>
      <label className="text-xs text-graphite">
        是否成交
        <select
          className="input-field mt-1 w-full"
          value={row.isDeal ? '是' : '否'}
          onChange={(e) => tf('isDeal', e.target.value === '是')}
        >
          <option value="否">否</option>
          <option value="是">是</option>
        </select>
      </label>
      <label className="text-xs text-graphite">
        当日状态
        <select className="input-field mt-1 w-full" value={row.currentStatus} onChange={(e) => tf('currentStatus', e.target.value)}>
          <option value="">请选择</option>
          {(merged.statusOptions.length ? merged.statusOptions : ['—']).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-graphite md:col-span-2">
        状态备注
        <input className="input-field mt-1 w-full" value={row.statusRemark} onChange={(e) => tf('statusRemark', e.target.value)} />
      </label>
      <label className="text-xs text-graphite">
        成交金额
        <input
          type="number"
          className="input-field mt-1 w-full"
          value={row.dealAmount || ''}
          onChange={(e) => tf('dealAmount', Number(e.target.value) || 0)}
        />
      </label>
      <label className="text-xs text-graphite">
        客户购买欲望
        <select
          className="input-field mt-1 w-full"
          value={row.purchaseIntent}
          onChange={(e) => tf('purchaseIntent', e.target.value)}
        >
          <option value="">请选择</option>
          {LEAD_PURCHASE_INTENT_STARS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
          {row.purchaseIntent && !(LEAD_PURCHASE_INTENT_STARS as readonly string[]).includes(row.purchaseIntent) ? (
            <option value={row.purchaseIntent}>{row.purchaseIntent}（旧数据）</option>
          ) : null}
        </select>
      </label>
      <label className="text-xs text-graphite">
        客户分类
        <select
          className="input-field mt-1 w-full"
          value={row.customerLevel}
          onChange={(e) => tf('customerLevel', e.target.value)}
        >
          <option value="">请选择</option>
          {LEAD_CUSTOMER_LEVELS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
          {row.customerLevel && !(LEAD_CUSTOMER_LEVELS as readonly string[]).includes(row.customerLevel) ? (
            <option value={row.customerLevel}>{row.customerLevel}（旧数据）</option>
          ) : null}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm text-graphite mt-5">
        <input type="checkbox" checked={row.isDouyinLead} onChange={(e) => tf('isDouyinLead', e.target.checked)} />
        抖音留资
      </label>
      <label className="text-xs text-graphite md:col-span-2">
        来源平台
        <input className="input-field mt-1 w-full" value={row.sourcePlatform} onChange={(e) => tf('sourcePlatform', e.target.value)} />
      </label>
      <label className="text-xs text-graphite md:col-span-2">
        抖音电联状态
        <input className="input-field mt-1 w-full" value={row.douyinCallStatus} onChange={(e) => tf('douyinCallStatus', e.target.value)} />
      </label>
      <div className="md:col-span-4 border-t border-ash pt-2 text-xs font-semibold text-coal-ink">电联跟进</div>
      <label className="text-xs text-graphite">
        第一次电联（日期）
        <input type="date" className="input-field mt-1 w-full" value={row.firstCallDate} onChange={(e) => tf('firstCallDate', e.target.value)} />
      </label>
      <label className="text-xs text-graphite md:col-span-2">
        第一次结果 / 未购买原因
        <input className="input-field mt-1 w-full" list={`lost-reasons-${row.id}`} value={row.firstCallResult} onChange={(e) => tf('firstCallResult', e.target.value)} />
        <datalist id={`lost-reasons-${row.id}`}>
          {(merged.lostReasons.length ? merged.lostReasons : []).map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </label>
      <label className="text-xs text-graphite">
        第二次电联
        <input type="date" className="input-field mt-1 w-full" value={row.secondCallDate} onChange={(e) => tf('secondCallDate', e.target.value)} />
      </label>
      <label className="text-xs text-graphite md:col-span-2">
        第二次结果
        <input className="input-field mt-1 w-full" value={row.secondCallResult} onChange={(e) => tf('secondCallResult', e.target.value)} />
      </label>
      <label className="text-xs text-graphite">
        第三次电联
        <input type="date" className="input-field mt-1 w-full" value={row.thirdCallDate} onChange={(e) => tf('thirdCallDate', e.target.value)} />
      </label>
      <label className="text-xs text-graphite md:col-span-2">
        第三次结果
        <input className="input-field mt-1 w-full" value={row.thirdCallResult} onChange={(e) => tf('thirdCallResult', e.target.value)} />
      </label>
      <label className="text-xs text-graphite">
        第四次电联
        <input type="date" className="input-field mt-1 w-full" value={row.fourthCallDate} onChange={(e) => tf('fourthCallDate', e.target.value)} />
      </label>
      <label className="text-xs text-graphite md:col-span-2">
        第四次结果
        <input className="input-field mt-1 w-full" value={row.fourthCallResult} onChange={(e) => tf('fourthCallResult', e.target.value)} />
      </label>
      <label className="text-xs text-graphite md:col-span-2">
        下次跟进时间
        <input type="datetime-local" className="input-field mt-1 w-full" value={row.nextFollowTime} onChange={(e) => tf('nextFollowTime', e.target.value)} />
      </label>
      <label className="text-xs text-graphite md:col-span-4">
        备注
        <input className="input-field mt-1 w-full" value={row.remark} onChange={(e) => tf('remark', e.target.value)} />
      </label>
      <div className="md:col-span-4 flex flex-wrap gap-2 pt-2">
        {onApplyLastTemplate ? (
          <button type="button" className="btn-ghost text-sm" onClick={onApplyLastTemplate}>
            填入上次模板信息
          </button>
        ) : null}
        <button type="button" className="btn-primary text-sm" onClick={onSave}>
          保存
        </button>
        <button type="button" className="btn-ghost text-sm" onClick={onCancel}>
          取消
        </button>
      </div>
    </div>
  );
}

function DetailTab({
  hubDate,
  userName,
  canViewAll,
  leads,
  setLeads,
  merged,
}: {
  hubDate: string;
  userName: string;
  canViewAll: boolean;
  leads: LeadFollowRecord[];
  setLeads: (v: LeadFollowRecord[]) => void;
  merged: MergedOptions;
}) {
  const [fDate, setFDate] = useState('');
  const [fShop, setFShop] = useState('');
  const [fStaff, setFStaff] = useState('');
  const [fDeal, setFDeal] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fLevel, setFLevel] = useState('');
  const [fCalled, setFCalled] = useState('');
  const [fDy, setFDy] = useState('');

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      const d = fDate || hubDate;
      if (l.date !== d) return false;
      if (!canViewAll && l.employeeName !== userName) return false;
      if (fShop && l.storeName !== fShop) return false;
      if (fStaff && l.employeeName !== fStaff) return false;
      if (fDeal === 'yes' && !l.isDeal) return false;
      if (fDeal === 'no' && l.isDeal) return false;
      if (fStatus && l.currentStatus !== fStatus) return false;
      if (fLevel && l.customerLevel !== fLevel) return false;
      if (fDy === 'yes' && !l.isDouyinLead) return false;
      if (fDy === 'no' && l.isDouyinLead) return false;
      const anyCall = [l.firstCallDate, l.secondCallDate, l.thirdCallDate, l.fourthCallDate].some((x) => String(x || '').trim());
      if (fCalled === 'yes' && !anyCall) return false;
      if (fCalled === 'no' && anyCall) return false;
      return true;
    });
  }, [leads, hubDate, fDate, fShop, fStaff, fDeal, fStatus, fLevel, fCalled, fDy, canViewAll, userName]);

  const [editing, setEditing] = useState<LeadFollowRecord | null>(null);

  const listDate = fDate || hubDate;

  return (
    <Card className="border border-ash p-4 space-y-3">
      <LeadFollowCsvBar
        exportRows={filtered}
        defaultImportDate={listDate}
        userName={userName}
        canViewAll={canViewAll}
        leads={leads}
        setLeads={setLeads}
      />
      <div className="flex flex-wrap gap-2 text-sm">
        <input type="date" className="input-field w-auto" value={fDate || hubDate} onChange={(e) => setFDate(e.target.value)} />
        <select className="input-field w-auto" value={fShop} onChange={(e) => setFShop(e.target.value)}>
          <option value="">全部店铺</option>
          {merged.shops.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {canViewAll ? (
          <input className="input-field max-w-[140px]" placeholder="客服" value={fStaff} onChange={(e) => setFStaff(e.target.value)} />
        ) : null}
        <select className="input-field w-auto" value={fDeal} onChange={(e) => setFDeal(e.target.value)}>
          <option value="">成交不限</option>
          <option value="yes">已成交</option>
          <option value="no">未成交</option>
        </select>
        <select className="input-field w-auto" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
          <option value="">状态不限</option>
          {merged.statusOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select className="input-field w-auto" value={fLevel} onChange={(e) => setFLevel(e.target.value)}>
          <option value="">分类不限</option>
          {LEAD_CUSTOMER_LEVELS.map((lv) => (
            <option key={lv} value={lv}>
              {lv}
            </option>
          ))}
        </select>
        <select className="input-field w-auto" value={fCalled} onChange={(e) => setFCalled(e.target.value)}>
          <option value="">电联不限</option>
          <option value="yes">已电联</option>
          <option value="no">未电联</option>
        </select>
        <select className="input-field w-auto" value={fDy} onChange={(e) => setFDy(e.target.value)}>
          <option value="">抖音不限</option>
          <option value="yes">抖音留资</option>
          <option value="no">非抖音</option>
        </select>
      </div>

      {editing ? (
        <LeadEditForm
          row={editing}
          merged={merged}
          onChange={setEditing}
          onSave={() => {
            const next = { ...editing, updatedAt: isoNow() };
            saveLeadFollowRecords(leads.map((x) => (x.id === next.id ? next : x)));
            saveLeadFollowLastSnapshot(next);
            setLeads(loadLeadFollowRecords());
            setEditing(null);
          }}
          onCancel={() => setEditing(null)}
          onApplyLastTemplate={() =>
            setEditing((prev) => (prev ? applyLeadFollowPrefillFromSnapshot(prev, loadLeadFollowLastSnapshot()) : prev))
          }
        />
      ) : null}

      <div className="overflow-x-auto">
        <table className="min-w-[1200px] w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-ash bg-ash/40 text-left text-xs text-graphite">
              {[
                '日期',
                '店铺',
                '客服',
                '咨询类型',
                '型号',
                '客户ID',
                '电话',
                '微信',
                '成交',
                '当前状态',
                '一电',
                '一结果',
                '二电',
                '二结果',
                '三电',
                '三结果',
                '四电',
                '四结果',
                '下次跟进',
                '操作',
              ].map((h) => (
                <th key={h} className="whitespace-nowrap px-2 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-ash/80">
                <td className="px-2 py-1 whitespace-nowrap">{r.date}</td>
                <td className="px-2 py-1">{r.storeName}</td>
                <td className="px-2 py-1">{r.employeeName}</td>
                <td className="px-2 py-1">{r.inquiryType}</td>
                <td className="px-2 py-1">{r.productModel}</td>
                <td className="px-2 py-1">{r.customerPlatformId}</td>
                <td className="px-2 py-1">{r.phone}</td>
                <td className="px-2 py-1">{r.customerWechat}</td>
                <td className="px-2 py-1">{r.isDeal ? '是' : '否'}</td>
                <td className="px-2 py-1">{r.currentStatus}</td>
                <td className="px-2 py-1 whitespace-nowrap">{r.firstCallDate}</td>
                <td className="px-2 py-1">{r.firstCallResult}</td>
                <td className="px-2 py-1 whitespace-nowrap">{r.secondCallDate}</td>
                <td className="px-2 py-1">{r.secondCallResult}</td>
                <td className="px-2 py-1 whitespace-nowrap">{r.thirdCallDate}</td>
                <td className="px-2 py-1">{r.thirdCallResult}</td>
                <td className="px-2 py-1 whitespace-nowrap">{r.fourthCallDate}</td>
                <td className="px-2 py-1">{r.fourthCallResult}</td>
                <td className="px-2 py-1 whitespace-nowrap">{r.nextFollowTime}</td>
                <td className="px-2 py-1">
                  <button type="button" className="text-sky-800 underline text-xs" onClick={() => setEditing({ ...r })}>
                    编辑
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function DailyReportTab({
  hubDate,
  userName,
  canViewAll,
  reports,
  setReports,
  merged,
}: {
  hubDate: string;
  userName: string;
  canViewAll: boolean;
  reports: DailyInquiryReport[];
  setReports: (v: DailyInquiryReport[]) => void;
  merged: MergedOptions;
}) {
  const rows = useMemo(() => {
    return reports.filter((r) => {
      if (r.date !== hubDate) return false;
      if (!canViewAll && r.employeeName !== userName) return false;
      return true;
    });
  }, [reports, hubDate, userName, canViewAll]);

  const addRow = () => {
    const store = merged.shops[0] || '店铺';
    const row = emptyDaily(hubDate, userName || '客服', store);
    saveDailyInquiryReports([...reports, row]);
    setReports(loadDailyInquiryReports());
  };

  const save = (row: DailyInquiryReport) => {
    const next = { ...row, updatedAt: isoNow() };
    saveDailyInquiryReports(reports.map((x) => (x.id === next.id ? next : x)));
    setReports(loadDailyInquiryReports());
  };

  const del = (id: string) => {
    if (!confirm('删除该条日报？')) return;
    saveDailyInquiryReports(reports.filter((x) => x.id !== id));
    setReports(loadDailyInquiryReports());
  };

  return (
    <Card className="border border-ash p-4 space-y-3">
      <p className="text-sm text-graphite">同一客服同一天可登记多店铺；保存后留资率统计自动按日期+客服+店铺对齐。</p>
      <button type="button" className="btn-primary text-sm" onClick={addRow}>
        新增一行
      </button>
      <div className="overflow-x-auto">
        <table className="min-w-[1000px] w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-ash bg-ash/40 text-left text-xs text-graphite">
              {['日期', '客服', '店铺', '当日咨询量', '售后咨询', '无效咨询', '售前有效', '成交人数', '日销售额', '备注', '操作'].map((h) => (
                <th key={h} className="whitespace-nowrap px-2 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-ash/80">
                <td className="px-2 py-1">{r.date}</td>
                <td className="px-2 py-1">
                  <input className="input-field w-[100px]" value={r.employeeName} onChange={(e) => save({ ...r, employeeName: e.target.value })} />
                </td>
                <td className="px-2 py-1">
                  <select className="input-field w-[120px]" value={r.storeName} onChange={(e) => save({ ...r, storeName: e.target.value })}>
                    {(merged.shops.length ? merged.shops : ['店铺']).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1">
                  <input type="number" className="input-field w-[80px]" value={r.inquiryCount} onChange={(e) => save({ ...r, inquiryCount: Number(e.target.value) || 0 })} />
                </td>
                <td className="px-2 py-1">
                  <input type="number" className="input-field w-[72px]" value={r.afterSalesCount} onChange={(e) => save({ ...r, afterSalesCount: Number(e.target.value) || 0 })} />
                </td>
                <td className="px-2 py-1">
                  <input type="number" className="input-field w-[72px]" value={r.invalidCount} onChange={(e) => save({ ...r, invalidCount: Number(e.target.value) || 0 })} />
                </td>
                <td className="px-2 py-1">
                  <input type="number" className="input-field w-[72px]" value={r.presalesValidCount} onChange={(e) => save({ ...r, presalesValidCount: Number(e.target.value) || 0 })} />
                </td>
                <td className="px-2 py-1">
                  <input type="number" className="input-field w-[72px]" value={r.dealCustomerCount} onChange={(e) => save({ ...r, dealCustomerCount: Number(e.target.value) || 0 })} />
                </td>
                <td className="px-2 py-1">
                  <input type="number" className="input-field w-[88px]" value={r.dailySalesAmount} onChange={(e) => save({ ...r, dailySalesAmount: Number(e.target.value) || 0 })} />
                </td>
                <td className="px-2 py-1">
                  <input className="input-field min-w-[120px]" value={r.remark} onChange={(e) => save({ ...r, remark: e.target.value })} />
                </td>
                <td className="px-2 py-1">
                  <button type="button" className="text-red-700 underline text-xs" onClick={() => del(r.id)}>
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function DouyinTab({
  hubDate,
  userName,
  canViewAll,
  rows,
  setRows,
}: {
  hubDate: string;
  userName: string;
  canViewAll: boolean;
  rows: DouyinLeadFollowRecord[];
  setRows: (v: DouyinLeadFollowRecord[]) => void;
}) {
  const list = useMemo(() => {
    return rows.filter((r) => {
      if (r.date !== hubDate) return false;
      if (!canViewAll && r.employeeName !== userName) return false;
      return true;
    });
  }, [rows, hubDate, userName, canViewAll]);

  const stats = useMemo(() => {
    const total = list.length;
    const called = list.filter((d) => d.hasCalled).length;
    const pending = total - called;
    const rate = total ? called / total : 0;
    const deals = list.filter((d) => d.isDeal).length;
    return { total, called, pending, rate, deals };
  }, [list]);

  const add = () => {
    const r = emptyDouyin(hubDate, userName || '客服');
    saveDouyinLeadFollowRecords([...rows, r]);
    setRows(loadDouyinLeadFollowRecords());
  };

  const save = (row: DouyinLeadFollowRecord) => {
    const next = { ...row, updatedAt: isoNow() };
    saveDouyinLeadFollowRecords(rows.map((x) => (x.id === next.id ? next : x)));
    setRows(loadDouyinLeadFollowRecords());
  };

  const del = (id: string) => {
    if (!confirm('删除？')) return;
    saveDouyinLeadFollowRecords(rows.filter((x) => x.id !== id));
    setRows(loadDouyinLeadFollowRecords());
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-5">
        {[
          ['今日抖音留资数', String(stats.total)],
          ['已电联', String(stats.called)],
          ['未电联', String(stats.pending)],
          ['电联率', `${(stats.rate * 100).toFixed(1)}%`],
          ['成交数', String(stats.deals)],
        ].map(([k, v]) => (
          <Card key={String(k)} className="border border-ash p-3 text-sm">
            <div className="text-xs text-slate-mid">{k}</div>
            <div className="font-semibold">{v}</div>
          </Card>
        ))}
      </div>
      <Card className="border border-ash p-4 space-y-3">
        <button type="button" className="btn-primary text-sm" onClick={add}>
          新增抖音留资
        </button>
        <div className="overflow-x-auto">
          <table className="min-w-[1000px] w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-ash bg-ash/40 text-left text-xs text-graphite">
                {['日期', '客服', '留资客户', '电话', '抖音来源', '已电联', '电联时间', '电联结果', '下次跟进', '成交', '成交金额', '备注', '操作'].map((h) => (
                  <th key={h} className="whitespace-nowrap px-2 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id} className="border-b border-ash/80">
                  <td className="px-2 py-1">{r.date}</td>
                  <td className="px-2 py-1">
                    <input className="input-field w-[90px]" value={r.employeeName} onChange={(e) => save({ ...r, employeeName: e.target.value })} />
                  </td>
                  <td className="px-2 py-1">
                    <input className="input-field w-[100px]" value={r.customerName} onChange={(e) => save({ ...r, customerName: e.target.value })} />
                  </td>
                  <td className="px-2 py-1">
                    <input className="input-field w-[100px]" value={r.phone} onChange={(e) => save({ ...r, phone: e.target.value })} />
                  </td>
                  <td className="px-2 py-1">
                    <input className="input-field w-[100px]" value={r.douyinSource} onChange={(e) => save({ ...r, douyinSource: e.target.value })} />
                  </td>
                  <td className="px-2 py-1">
                    <input type="checkbox" checked={r.hasCalled} onChange={(e) => save({ ...r, hasCalled: e.target.checked })} />
                  </td>
                  <td className="px-2 py-1">
                    <input className="input-field w-[140px]" type="datetime-local" value={r.callTime} onChange={(e) => save({ ...r, callTime: e.target.value })} />
                  </td>
                  <td className="px-2 py-1">
                    <input className="input-field w-[120px]" value={r.callResult} onChange={(e) => save({ ...r, callResult: e.target.value })} />
                  </td>
                  <td className="px-2 py-1">
                    <input className="input-field w-[120px]" type="datetime-local" value={r.nextFollowTime} onChange={(e) => save({ ...r, nextFollowTime: e.target.value })} />
                  </td>
                  <td className="px-2 py-1">
                    <select
                      className="input-field w-[72px] text-xs py-1"
                      value={r.isDeal ? '是' : '否'}
                      onChange={(e) => save({ ...r, isDeal: e.target.value === '是' })}
                    >
                      <option value="否">否</option>
                      <option value="是">是</option>
                    </select>
                  </td>
                  <td className="px-2 py-1">
                    <input type="number" className="input-field w-[80px]" value={r.dealAmount || ''} onChange={(e) => save({ ...r, dealAmount: Number(e.target.value) || 0 })} />
                  </td>
                  <td className="px-2 py-1">
                    <input className="input-field min-w-[100px]" value={r.remark} onChange={(e) => save({ ...r, remark: e.target.value })} />
                  </td>
                  <td className="px-2 py-1">
                    <button type="button" className="text-red-700 underline text-xs" onClick={() => del(r.id)}>
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function StoreStatsTab({
  reports,
  leads,
  settings,
  hubDate,
  rateColorClass,
}: {
  reports: DailyInquiryReport[];
  leads: LeadFollowRecord[];
  settings: LeadConversionSettings;
  hubDate: string;
  rateColorClass: (rate: number, inquiry: number) => string;
}) {
  const [mode, setMode] = useState<'day' | 'week' | 'month'>('day');
  const range = useMemo(() => {
    if (mode === 'day') return { start: hubDate, end: hubDate };
    if (mode === 'week') return getWeekRange(hubDate);
    return monthRangeYmd(hubDate);
  }, [mode, hubDate]);

  const rows = useMemo(() => {
    if (mode === 'day') return aggregateByStaffStore(hubDate, reports, leads, settings);
    return aggregateStoreRange(range.start, range.end, reports, leads, settings);
  }, [mode, hubDate, range, reports, leads, settings]);

  const target = settings.targetLeadRate ?? 0.25;

  return (
    <Card className="border border-ash p-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        {(['day', 'week', 'month'] as const).map((m) => (
          <button
            key={m}
            type="button"
            className={cn('rounded-lg px-3 py-1 text-sm', mode === m ? 'bg-coal-ink text-white' : 'bg-white border border-ash')}
            onClick={() => setMode(m)}
          >
            {m === 'day' ? '按日' : m === 'week' ? '按周' : '按月'}
          </button>
        ))}
        <span className="text-xs text-slate-mid self-center">区间：{range.start} ~ {range.end} · 目标留资率 {(target * 100).toFixed(0)}%</span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[720px] w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-ash bg-ash/40 text-left text-xs text-graphite">
              {['店铺', '总咨询量', '总留资数', '留资率', '成交数', '成交金额'].map((h) => (
                <th key={h} className="px-2 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((x) => (
              <tr key={x.store} className="border-b border-ash/80">
                <td className="px-2 py-1 font-medium">{x.store}</td>
                <td className="px-2 py-1">{x.inquiry}</td>
                <td className="px-2 py-1">{x.leadCount}</td>
                <td className={cn('px-2 py-1 font-semibold', rateColorClass(x.rate, x.inquiry))}>{(x.rate * 100).toFixed(1)}%</td>
                <td className="px-2 py-1">{x.deals}</td>
                <td className="px-2 py-1">{formatAmountYuan(x.dealAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function StaffStatsTab({
  reports,
  leads,
  settings,
  hubDate,
  rateColorClass,
}: {
  reports: DailyInquiryReport[];
  leads: LeadFollowRecord[];
  settings: LeadConversionSettings;
  hubDate: string;
  rateColorClass: (rate: number, inquiry: number) => string;
}) {
  const [mode, setMode] = useState<'day' | 'week' | 'month'>('day');
  const [fStaff, setFStaff] = useState('');
  const [fShop, setFShop] = useState('');
  const [sortDesc, setSortDesc] = useState(true);

  const range = useMemo(() => {
    if (mode === 'day') return { start: hubDate, end: hubDate };
    if (mode === 'week') return getWeekRange(hubDate);
    return monthRangeYmd(hubDate);
  }, [mode, hubDate]);

  const rows = useMemo(() => {
    let base =
      mode === 'day'
        ? aggregateByStaffStore(hubDate, reports, leads, settings)
        : aggregateStaffStoreRange(range.start, range.end, reports, leads, settings);
    if (fStaff) base = base.filter((x) => x.employee.includes(fStaff));
    if (fShop) base = base.filter((x) => x.store === fShop);
    base = [...base].sort((a, b) => (sortDesc ? b.rate - a.rate : a.rate - b.rate));
    return base;
  }, [mode, hubDate, range, reports, leads, settings, fStaff, fShop, sortDesc]);

  const shops = useMemo(() => [...new Set(reports.map((r) => r.storeName).concat(leads.map((l) => l.storeName)))], [reports, leads]);

  const target = settings.targetLeadRate ?? 0.25;

  return (
    <Card className="border border-ash p-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        {(['day', 'week', 'month'] as const).map((m) => (
          <button
            key={m}
            type="button"
            className={cn('rounded-lg px-3 py-1 text-sm', mode === m ? 'bg-coal-ink text-white' : 'bg-white border border-ash')}
            onClick={() => setMode(m)}
          >
            {m === 'day' ? '按日' : m === 'week' ? '按周' : '按月'}
          </button>
        ))}
        <input className="input-field max-w-[140px]" placeholder="客服筛选" value={fStaff} onChange={(e) => setFStaff(e.target.value)} />
        <select className="input-field w-auto" value={fShop} onChange={(e) => setFShop(e.target.value)}>
          <option value="">全部店铺</option>
          {shops.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button type="button" className="btn-ghost text-sm" onClick={() => setSortDesc((x) => !x)}>
          留资率排序：{sortDesc ? '高→低' : '低→高'}
        </button>
        <span className="text-xs text-slate-mid self-center">
          {range.start} ~ {range.end} · 目标 {(target * 100).toFixed(0)}%
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[800px] w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-ash bg-ash/40 text-left text-xs text-graphite">
              {['客服', '店铺', '当日咨询量', '留资数', '留资率', '成交数', '成交金额'].map((h) => (
                <th key={h} className="px-2 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((x, i) => (
              <tr key={`${x.employee}-${x.store}-${i}`} className="border-b border-ash/80">
                <td className="px-2 py-1">{x.employee}</td>
                <td className="px-2 py-1">{x.store}</td>
                <td className="px-2 py-1">{x.inquiry}</td>
                <td className="px-2 py-1">{x.leadCount}</td>
                <td className={cn('px-2 py-1 font-semibold', rateColorClass(x.rate, x.inquiry))}>{(x.rate * 100).toFixed(1)}%</td>
                <td className="px-2 py-1">{x.deals}</td>
                <td className="px-2 py-1">{formatAmountYuan(x.dealAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ConfigTab({
  role,
  settings,
  setSettings,
  apiOpts,
  merged,
}: {
  role: string | null;
  settings: LeadConversionSettings;
  setSettings: (s: LeadConversionSettings) => void;
  apiOpts: Record<string, string[]>;
  merged: MergedOptions;
}) {
  const canEdit = role === 'admin' || role === 'manager';
  const [draft, setDraft] = useState(settings);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const save = () => {
    saveLeadConversionSettings(draft);
    setSettings(loadLeadConversionSettings());
  };

  return (
    <Card className="border border-ash p-4 space-y-4">
      {!canEdit ? (
        <p className="text-sm text-amber-800">当前账号无配置权限（需管理员或主管）。仍可读取系统选项中心的默认值。</p>
      ) : null}
      <label className="block text-xs text-graphite">
        目标留资率（0~1，例如 0.25 表示 25%）
        <input
          type="number"
          step={0.01}
          className="input-field mt-1 max-w-[200px]"
          disabled={!canEdit}
          value={draft.targetLeadRate}
          onChange={(e) => setDraft({ ...draft, targetLeadRate: Math.min(1, Math.max(0, Number(e.target.value) || 0)) })}
        />
      </label>
      <label className="flex items-center gap-2 text-sm text-graphite">
        <input
          type="checkbox"
          disabled={!canEdit}
          checked={draft.strictLeadRules}
          onChange={(e) => setDraft({ ...draft, strictLeadRules: e.target.checked })}
        />
        严格留资口径（预留，后续可收紧规则）
      </label>
      {(
        [
          ['shops', '店铺（每行或用逗号分隔，覆盖系统选项）'],
          ['inquiryTypes', '咨询类型'],
          ['customerTypes', '客户类型'],
          ['statusOptions', '跟进状态'],
          ['lostReasons', '未成交原因'],
        ] as const
      ).map(([key, label]) => (
        <label key={key} className="block text-xs text-graphite">
          {label}
          <textarea
            className="input-field mt-1 min-h-[72px] w-full font-mono text-sm"
            disabled={!canEdit}
            value={(draft[key] as string[]).join(', ')}
            onChange={(e) => setDraft({ ...draft, [key]: parseList(e.target.value) })}
          />
        </label>
      ))}
      <p className="text-xs text-slate-mid">
        系统选项快照（只读）：店铺 {apiOpts.shops?.join('、') || '—'}；留空上方列表则使用此处合并结果。
      </p>
      <p className="text-xs text-slate-mid">当前生效店铺预览：{merged.shops.join('、') || '未配置'}</p>
      <button type="button" className="btn-primary text-sm" disabled={!canEdit} onClick={save}>
        保存配置
      </button>
    </Card>
  );
}
