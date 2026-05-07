'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui';
import { cn } from '@/lib/utils';
import { WORKSPACE_STORAGE_UPDATED } from '@/lib/workspace-events';
import type {
  CustomerAfterSalesRecord,
  CustomerCategory,
  CustomerGrowthPlanRecord,
  CustomerStatus,
  GrowthStage,
  OldCustomerFollowTask,
  OldCustomerProfile,
  RepurchaseOpportunity,
} from '@/lib/old-customer-crm/types';
import {
  loadAfterSales,
  loadFollowTasks,
  loadGrowthRecords,
  loadProfiles,
  loadRepurchase,
  rid,
  isoNow,
  saveAfterSales,
  saveFollowTasks,
  saveProfiles,
  saveRepurchase,
} from '@/lib/old-customer-crm/storage';
import { recommendCustomerCategory } from '@/lib/old-customer-crm/recommend-category';
import { buildStandardFollowMilestones, withFollowIds } from '@/lib/old-customer-crm/milestone-templates';

const TABS: { id: string; label: string }[] = [
  { id: 'profiles', label: '客户档案库' },
  { id: 'follow', label: '老客户回访任务' },
  { id: 'repurchase', label: '复购跟踪' },
  { id: 'segment', label: '客户分层' },
  { id: 'growth', label: '欧信客户成长计划' },
  { id: 'aftersales', label: '售后记录' },
  { id: 'dashboard', label: '老客户数据看板' },
];

const INDUSTRIES = ['熟食', '海鲜', '干货', '食品厂', '电商仓储', '其他'];
const CATEGORIES: CustomerCategory[] = ['一次性低价客户', '正常复购客户', '成长型客户', '高价值客户'];
const STAGES: GrowthStage[] = [
  '阶段1：新手开店客户',
  '阶段2：稳定经营客户',
  '阶段3：多店/加盟客户',
  '阶段4：小工厂/批量生产客户',
];
const STATUSES: CustomerStatus[] = ['正常', '待回访', '有售后', '沉默', '重点维护'];

function catBadge(c: CustomerCategory) {
  const map: Record<CustomerCategory, string> = {
    一次性低价客户: 'bg-slate-100 text-slate-700 border-slate-200',
    正常复购客户: 'bg-sky-100 text-sky-900 border-sky-200',
    成长型客户: 'bg-amber-100 text-amber-950 border-amber-300',
    高价值客户: 'bg-emerald-200 text-emerald-950 border-emerald-400 font-semibold',
  };
  return map[c] ?? 'bg-ash text-graphite';
}

export function OldCustomerCrmApp() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState('profiles');
  const [rev, setRev] = useState(0);
  const [profiles, setProfiles] = useState<OldCustomerProfile[]>([]);
  const [follows, setFollows] = useState<OldCustomerFollowTask[]>([]);
  const [rep, setRep] = useState<RepurchaseOpportunity[]>([]);
  const [after, setAfter] = useState<CustomerAfterSalesRecord[]>([]);
  const [q, setQ] = useState('');
  const [fStaff, setFStaff] = useState('');
  const [fCat, setFCat] = useState('');
  const [fStage, setFStage] = useState('');
  const [fStatus, setFStatus] = useState('');

  const reload = useCallback(() => {
    setProfiles(loadProfiles());
    setFollows(loadFollowTasks());
    setRep(loadRepurchase());
    setAfter(loadAfterSales());
  }, []);

  useEffect(() => {
    reload();
  }, [reload, rev]);

  useEffect(() => {
    const fn = () => setRev((x) => x + 1);
    window.addEventListener(WORKSPACE_STORAGE_UPDATED, fn);
    return () => window.removeEventListener(WORKSPACE_STORAGE_UPDATED, fn);
  }, []);

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t && TABS.some((x) => x.id === t)) setTab(t);
  }, [searchParams]);

  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
      if (fStaff && p.ownerEmployee !== fStaff) return false;
      if (fCat && p.customerCategory !== fCat) return false;
      if (fStage && p.growthStage !== fStage) return false;
      if (fStatus && p.customerStatus !== fStatus) return false;
      if (q.trim()) {
        const s = `${p.customerName} ${p.phone} ${p.orderNo} ${p.deviceModel}`.toLowerCase();
        if (!s.includes(q.trim().toLowerCase())) return false;
      }
      return true;
    });
  }, [profiles, q, fStaff, fCat, fStage, fStatus]);

  const staffOptions = useMemo(() => {
    const s = new Set<string>();
    profiles.forEach((p) => s.add(p.ownerEmployee));
    follows.forEach((f) => s.add(f.ownerEmployee));
    return [...s].filter(Boolean);
  }, [profiles, follows]);

  const dash = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthFollows = follows.filter((f) => f.followDate.startsWith(ym));
    const repSum = rep.reduce((a, r) => a + (Number(r.actualAmount) || 0), 0);
    const growthCnt = profiles.filter((p) => p.customerCategory === '成长型客户').length;
    const hvCnt = profiles.filter((p) => p.customerCategory === '高价值客户').length;
    const risk = profiles.filter((p) => p.customerStatus === '有售后' || p.hasAfterSalesRecord).length;
    return {
      total: profiles.length,
      monthShould: monthFollows.length,
      monthDone: monthFollows.filter((f) => f.isCompleted).length,
      monthTodo: monthFollows.filter((f) => !f.isCompleted).length,
      repSum,
      growthCnt,
      hvCnt,
      risk,
      followRate: monthFollows.length ? Math.round((monthFollows.filter((f) => f.isCompleted).length / monthFollows.length) * 100) : 0,
    };
  }, [profiles, follows, rep]);

  const upsertProfile = (p: OldCustomerProfile) => {
    const list = [...profiles];
    const i = list.findIndex((x) => x.id === p.id);
    if (i >= 0) list[i] = p;
    else list.push(p);
    saveProfiles(list);
    reload();
  };

  const deleteProfile = (id: string) => {
    if (!confirm('确定删除该客户档案？关联回访/复购记录请自行检查。')) return;
    saveProfiles(profiles.filter((p) => p.id !== id));
    reload();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight text-coal-ink">老客户 CRM 跟踪体系</h2>
        <p className="mt-1 text-sm text-slate-mid">
          成交客户档案、回访节点、复购与售后沉淀；数据存本机 LocalStorage。与「今日任务中心」每日工作包联动「老客户回访」任务。
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'rounded-full px-4 py-2 text-sm font-medium transition',
              tab === t.id ? 'bg-coal-ink text-white' : 'bg-ash/80 text-graphite hover:bg-ash',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card className="border border-ash p-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-graphite">
            搜索
            <input className="input-field mt-1 block text-sm" placeholder="姓名/电话/订单/型号" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <label className="text-xs text-graphite">
            归属客服
            <select className="input-field mt-1 block min-w-[7rem] text-sm" value={fStaff} onChange={(e) => setFStaff(e.target.value)}>
              <option value="">全部</option>
              {staffOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-graphite">
            客户分类
            <select className="input-field mt-1 block min-w-[8rem] text-sm" value={fCat} onChange={(e) => setFCat(e.target.value)}>
              <option value="">全部</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-graphite">
            成长阶段
            <select className="input-field mt-1 block min-w-[10rem] text-sm" value={fStage} onChange={(e) => setFStage(e.target.value)}>
              <option value="">全部</option>
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-graphite">
            客户状态
            <select className="input-field mt-1 block min-w-[7rem] text-sm" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
              <option value="">全部</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      {tab === 'profiles' && (
        <ProfilesTab
          rows={filteredProfiles}
          onSave={upsertProfile}
          onDelete={deleteProfile}
          onGenFollow={(p) => {
            const raw = buildStandardFollowMilestones(p.purchaseDate || isoNow().slice(0, 10), p.id, p.customerName, p.ownerEmployee);
            saveFollowTasks([...loadFollowTasks(), ...withFollowIds(raw)]);
            reload();
          }}
          onRecommend={(p) => {
            const rec = recommendCustomerCategory(p, rep);
            upsertProfile({ ...p, recommendedCategory: rec, updatedAt: isoNow() });
          }}
        />
      )}
      {tab === 'follow' && <FollowTab rows={follows} onSave={saveFollowTasks} reload={reload} filterStaff={fStaff} />}
      {tab === 'repurchase' && <RepurchaseTab rows={rep} onSave={saveRepurchase} reload={reload} profiles={profiles} />}
      {tab === 'segment' && <SegmentTab rows={filteredProfiles} />}
      {tab === 'growth' && <GrowthTab profiles={profiles} />}
      {tab === 'aftersales' && <AfterSalesTab rows={after} profiles={profiles} onSave={saveAfterSales} reload={reload} />}
      {tab === 'dashboard' && (
        <DashboardTab dash={dash} profiles={filteredProfiles} follows={follows} rep={rep} />
      )}
    </div>
  );
}

function ProfilesTab({
  rows,
  onSave,
  onDelete,
  onGenFollow,
  onRecommend,
}: {
  rows: OldCustomerProfile[];
  onSave: (p: OldCustomerProfile) => void;
  onDelete: (id: string) => void;
  onGenFollow: (p: OldCustomerProfile) => void;
  onRecommend: (p: OldCustomerProfile) => void;
}) {
  const empty: OldCustomerProfile = {
    id: rid(),
    customerName: '',
    phone: '',
    wechatOrPlatformId: '',
    storeName: '',
    ownerEmployee: '',
    industry: '熟食',
    region: '',
    customerStatus: '正常',
    purchasedDevice: '',
    deviceModel: '',
    purchaseDate: new Date().toISOString().slice(0, 10),
    orderNo: '',
    orderAmount: 0,
    hasConsumablePurchase: false,
    hasAccessoryPurchase: false,
    hasAfterSalesRecord: false,
    dailyUsage: '',
    isBeginner: false,
    isHighFrequencyCommercial: false,
    usageScenario: '',
    hasExpansionPotential: false,
    customerCategory: '成长型客户',
    growthStage: '阶段1：新手开店客户',
    recommendedCategory: '',
    remark: '',
    createdAt: isoNow(),
    updatedAt: isoNow(),
  };
  const [draft, setDraft] = useState<OldCustomerProfile | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button type="button" className="btn-primary text-sm" onClick={() => setDraft({ ...empty, id: rid(), createdAt: isoNow(), updatedAt: isoNow() })}>
          新增客户档案
        </button>
      </div>
      {draft ? (
        <ProfileEditor
          value={draft}
          onChange={setDraft}
          onClose={() => setDraft(null)}
          onSubmit={() => {
            onSave({ ...draft, updatedAt: isoNow() });
            setDraft(null);
          }}
        />
      ) : null}
      <div className="overflow-x-auto rounded-card border border-ash bg-ledger-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-ash bg-elevated text-xs text-graphite">
            <tr>
              <th className="p-2">客户ID</th>
              <th className="p-2">客户</th>
              <th className="p-2">电话</th>
              <th className="p-2">归属</th>
              <th className="p-2">分类</th>
              <th className="p-2">成长阶段</th>
              <th className="p-2">设备/订单</th>
              <th className="p-2">状态</th>
              <th className="p-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr
                key={p.id}
                className={cn(
                  'border-b border-ash/60',
                  p.customerCategory === '高价值客户' ? 'bg-emerald-50/60' : undefined,
                  (p.customerStatus === '有售后' || p.hasAfterSalesRecord) ? 'bg-red-50/50' : undefined,
                )}
              >
                <td className="p-2 font-mono text-xs text-slate-mid" title={p.id}>
                  {p.id.slice(0, 8)}…
                </td>
                <td className="p-2 font-medium text-coal-ink">{p.customerName}</td>
                <td className="p-2 text-graphite">{p.phone}</td>
                <td className="p-2">{p.ownerEmployee}</td>
                <td className="p-2">
                  <span className={cn('rounded-md border px-2 py-0.5 text-xs', catBadge(p.customerCategory))}>{p.customerCategory}</span>
                  {p.recommendedCategory ? (
                    <span className="ml-1 text-[10px] text-slate-mid">推荐:{p.recommendedCategory}</span>
                  ) : null}
                </td>
                <td className="p-2 text-xs text-graphite">{p.growthStage}</td>
                <td className="p-2 text-xs">
                  {p.purchasedDevice} {p.deviceModel}
                  <div className="text-slate-mid">{p.orderNo}</div>
                </td>
                <td className="p-2 text-xs">{p.customerStatus}</td>
                <td className="p-2 space-x-1 whitespace-nowrap">
                  <button type="button" className="btn-ghost text-xs" onClick={() => setDraft({ ...p })}>
                    编辑
                  </button>
                  <button type="button" className="btn-ghost text-xs" onClick={() => onRecommend(p)}>
                    系统推荐分类
                  </button>
                  <button type="button" className="btn-ghost text-xs" onClick={() => onGenFollow(p)}>
                    生成标准回访
                  </button>
                  <button type="button" className="text-xs text-red-700 underline" onClick={() => onDelete(p.id)}>
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="p-4 text-sm text-slate-mid">暂无档案，请点击「新增客户档案」。</p> : null}
      </div>
    </div>
  );
}

function ProfileEditor({
  value,
  onChange,
  onClose,
  onSubmit,
}: {
  value: OldCustomerProfile;
  onChange: (v: OldCustomerProfile) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const patch = (p: Partial<OldCustomerProfile>) => onChange({ ...value, ...p });
  return (
    <Card elevated className="border border-ash p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-coal-ink">客户档案</h3>
        <button type="button" className="btn-ghost text-sm" onClick={onClose}>
          关闭
        </button>
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        <Field label="客户姓名/昵称" value={value.customerName} onChange={(v) => patch({ customerName: v })} />
        <Field label="联系电话" value={value.phone} onChange={(v) => patch({ phone: v })} />
        <Field label="微信/旺旺/抖音ID" value={value.wechatOrPlatformId} onChange={(v) => patch({ wechatOrPlatformId: v })} />
        <Field label="所属店铺" value={value.storeName} onChange={(v) => patch({ storeName: v })} />
        <Field label="归属客服" value={value.ownerEmployee} onChange={(v) => patch({ ownerEmployee: v })} />
        <label className="text-xs text-graphite">
          客户行业
          <select className="input-field mt-1 w-full text-sm" value={value.industry} onChange={(e) => patch({ industry: e.target.value })}>
            {INDUSTRIES.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <Field label="客户地区" value={value.region} onChange={(v) => patch({ region: v })} />
        <label className="text-xs text-graphite">
          客户状态
          <select className="input-field mt-1 w-full text-sm" value={value.customerStatus} onChange={(e) => patch({ customerStatus: e.target.value as CustomerStatus })}>
            {STATUSES.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <Field label="购买设备" value={value.purchasedDevice} onChange={(v) => patch({ purchasedDevice: v })} />
        <Field label="设备型号" value={value.deviceModel} onChange={(v) => patch({ deviceModel: v })} />
        <label className="text-xs text-graphite">
          购买时间
          <input type="date" className="input-field mt-1 w-full text-sm" value={value.purchaseDate} onChange={(e) => patch({ purchaseDate: e.target.value })} />
        </label>
        <Field label="订单编号" value={value.orderNo} onChange={(v) => patch({ orderNo: v })} />
        <label className="text-xs text-graphite">
          订单金额
          <input type="number" className="input-field mt-1 w-full text-sm" value={value.orderAmount || 0} onChange={(e) => patch({ orderAmount: Number(e.target.value) || 0 })} />
        </label>
        <label className="flex items-center gap-2 text-sm text-graphite">
          <input type="checkbox" checked={value.hasConsumablePurchase} onChange={(e) => patch({ hasConsumablePurchase: e.target.checked })} />
          买过耗材
        </label>
        <label className="flex items-center gap-2 text-sm text-graphite">
          <input type="checkbox" checked={value.hasAccessoryPurchase} onChange={(e) => patch({ hasAccessoryPurchase: e.target.checked })} />
          买过配件
        </label>
        <label className="flex items-center gap-2 text-sm text-graphite">
          <input type="checkbox" checked={value.hasAfterSalesRecord} onChange={(e) => patch({ hasAfterSalesRecord: e.target.checked })} />
          有售后记录
        </label>
        <Field label="每天使用量" value={value.dailyUsage} onChange={(v) => patch({ dailyUsage: v })} />
        <label className="flex items-center gap-2 text-sm text-graphite">
          <input type="checkbox" checked={value.isBeginner} onChange={(e) => patch({ isBeginner: e.target.checked })} />
          新手
        </label>
        <label className="flex items-center gap-2 text-sm text-graphite">
          <input type="checkbox" checked={value.isHighFrequencyCommercial} onChange={(e) => patch({ isHighFrequencyCommercial: e.target.checked })} />
          商用高频
        </label>
        <label className="flex items-center gap-2 text-sm text-graphite md:col-span-2">
          <input type="checkbox" checked={value.hasExpansionPotential} onChange={(e) => patch({ hasExpansionPotential: e.target.checked })} />
          有扩产可能
        </label>
        <Field label="使用场景" value={value.usageScenario} onChange={(v) => patch({ usageScenario: v })} className="md:col-span-3" />
        <label className="text-xs text-graphite">
          客户分类（可手动调整）
          <select className="input-field mt-1 w-full text-sm" value={value.customerCategory} onChange={(e) => patch({ customerCategory: e.target.value as CustomerCategory })}>
            {CATEGORIES.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-graphite md:col-span-2">
          成长阶段
          <select className="input-field mt-1 w-full text-sm" value={value.growthStage} onChange={(e) => patch({ growthStage: e.target.value as GrowthStage })}>
            {STAGES.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-graphite md:col-span-3">
          备注
          <textarea className="input-field mt-1 min-h-[64px] w-full text-sm" value={value.remark} onChange={(e) => patch({ remark: e.target.value })} />
        </label>
      </div>
      <button type="button" className="btn-primary text-sm" onClick={onSubmit}>
        保存档案
      </button>
    </Card>
  );
}

function Field({ label, value, onChange, className }: { label: string; value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <label className={cn('text-xs text-graphite', className)}>
      {label}
      <input className="input-field mt-1 w-full text-sm" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function FollowTab({
  rows,
  onSave,
  reload,
  filterStaff,
}: {
  rows: OldCustomerFollowTask[];
  onSave: (r: OldCustomerFollowTask[]) => void;
  reload: () => void;
  filterStaff: string;
}) {
  const list = useMemo(() => rows.filter((r) => !filterStaff || r.ownerEmployee === filterStaff), [rows, filterStaff]);
  const toggle = (id: string, done: boolean) => {
    const next = rows.map((r) => (r.id === id ? { ...r, isCompleted: done, updatedAt: isoNow() } : r));
    onSave(next);
    reload();
  };
  return (
    <Card className="border border-ash p-4">
      <p className="mb-3 text-xs text-slate-mid">
        完成回访后请勾选「已完成」；今日任务中心「老客户回访」进度将自动更新。
        <Link href="/dashboard/tasks" className="ml-2 text-sky-800 underline">
          去今日任务中心
        </Link>
      </p>
      <table className="min-w-full text-left text-sm">
        <thead className="border-b text-xs text-graphite">
          <tr>
            <th className="p-2">回访日</th>
            <th className="p-2">客户</th>
            <th className="p-2">客服</th>
            <th className="p-2">类型</th>
            <th className="p-2">方式</th>
            <th className="p-2">完成</th>
            <th className="p-2">结果</th>
          </tr>
        </thead>
        <tbody>
          {list.map((r) => (
            <tr key={r.id} className="border-b border-ash/60">
              <td className="p-2">{r.followDate}</td>
              <td className="p-2">{r.customerName}</td>
              <td className="p-2">{r.ownerEmployee}</td>
              <td className="p-2 text-xs">{r.followType}</td>
              <td className="p-2 text-xs">{r.followMethod}</td>
              <td className="p-2">
                <input type="checkbox" checked={r.isCompleted} onChange={(e) => toggle(r.id, e.target.checked)} />
              </td>
              <td className="p-2 text-xs">{r.followResult || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function RepurchaseTab({
  rows,
  profiles,
  onSave,
  reload,
}: {
  rows: RepurchaseOpportunity[];
  profiles: OldCustomerProfile[];
  onSave: (r: RepurchaseOpportunity[]) => void;
  reload: () => void;
}) {
  const add = () => {
    const p0 = profiles[0];
    const row: RepurchaseOpportunity = {
      id: rid(),
      customerId: p0?.id ?? '',
      customerName: p0?.customerName ?? '',
      purchasedDevice: p0?.purchasedDevice ?? '',
      deviceModel: p0?.deviceModel ?? '',
      recommendedProduct: '真空袋',
      recommendedReason: '使用量高',
      repurchaseStatus: '待提醒',
      estimatedAmount: 0,
      actualAmount: 0,
      ownerEmployee: p0?.ownerEmployee ?? '',
      nextReminderTime: '',
      remark: '',
      createdAt: isoNow(),
      updatedAt: isoNow(),
    };
    onSave([...rows, row]);
    reload();
  };
  const patch = (id: string, patch: Partial<RepurchaseOpportunity>) => {
    onSave(rows.map((r) => (r.id === id ? { ...r, ...patch, updatedAt: isoNow() } : r)));
    reload();
  };
  return (
    <Card className="border border-ash p-4 space-y-3">
      <button type="button" className="btn-primary text-sm" onClick={add}>
        新增复购机会
      </button>
      <table className="min-w-full text-left text-sm">
        <thead className="border-b text-xs text-graphite">
          <tr>
            <th className="p-2">客户</th>
            <th className="p-2">推荐品</th>
            <th className="p-2">状态</th>
            <th className="p-2">预计/实际金额</th>
            <th className="p-2">下次提醒</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-ash/60 align-top">
              <td className="p-2">{r.customerName}</td>
              <td className="p-2">
                <input className="input-field w-full text-xs" value={r.recommendedProduct} onChange={(e) => patch(r.id, { recommendedProduct: e.target.value })} />
              </td>
              <td className="p-2">
                <select className="input-field text-xs" value={r.repurchaseStatus} onChange={(e) => patch(r.id, { repurchaseStatus: e.target.value as RepurchaseOpportunity['repurchaseStatus'] })}>
                  {(['待提醒', '已提醒', '已复购', '暂不需要', '流失'] as const).map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </td>
              <td className="p-2">
                <input type="number" className="input-field mb-1 w-20 text-xs" value={r.estimatedAmount} onChange={(e) => patch(r.id, { estimatedAmount: Number(e.target.value) || 0 })} />
                /
                <input type="number" className="input-field w-20 text-xs" value={r.actualAmount} onChange={(e) => patch(r.id, { actualAmount: Number(e.target.value) || 0 })} />
              </td>
              <td className="p-2">
                <input type="date" className="input-field text-xs" value={r.nextReminderTime} onChange={(e) => patch(r.id, { nextReminderTime: e.target.value })} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function SegmentTab({ rows }: { rows: OldCustomerProfile[] }) {
  const blocks = [
    {
      title: '一次性低价客户',
      desc: '只看便宜，买完联系少。策略：标准售后即可，少投入人工。',
      cat: '一次性低价客户' as CustomerCategory,
    },
    {
      title: '正常复购客户',
      desc: '会买配件、耗材等。策略：定期提醒耗材复购。',
      cat: '正常复购客户' as CustomerCategory,
    },
    {
      title: '成长型客户',
      desc: '小店做大，未来买更多设备。策略：重点维护，推荐升级方案。',
      cat: '成长型客户' as CustomerCategory,
    },
    {
      title: '高价值客户',
      desc: '工厂、连锁、批量采购。策略：专人维护与年度服务。',
      cat: '高价值客户' as CustomerCategory,
    },
  ];
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        {blocks.map((b) => (
          <Card key={b.title} className="border border-ash p-4">
            <h4 className="font-semibold text-coal-ink">{b.title}</h4>
            <p className="mt-1 text-xs text-slate-mid">{b.desc}</p>
            <p className="mt-2 text-xs text-graphite">当前该分层客户数：{rows.filter((r) => r.customerCategory === b.cat).length}</p>
          </Card>
        ))}
      </div>
      <p className="text-xs text-slate-mid">在「客户档案库」中可手动调整分类；亦可在档案行点击「系统推荐分类」。</p>
    </div>
  );
}

function GrowthTab({ profiles }: { profiles: OldCustomerProfile[] }) {
  const [records, setRecords] = useState<CustomerGrowthPlanRecord[]>(() => loadGrowthRecords());
  useEffect(() => {
    setRecords(loadGrowthRecords());
  }, [profiles]);
  const stages = [
    {
      stage: '阶段1：新手开店客户' as GrowthStage,
      rec: ['入门真空机', '小型封口机', '基础耗材包', '新手教程'],
      script: '刚开始做，先买够用的，少踩坑。',
    },
    {
      stage: '阶段2：稳定经营客户' as GrowthStage,
      rec: ['触控款', '440 以上型号', '保养套装', '备用易损件'],
      script: '生意稳定后，设备要更省心，不能因为机器影响出货。',
    },
    {
      stage: '阶段3：多店/加盟客户' as GrowthStage,
      rec: ['多台设备', '统一耗材', '标准化包装方案', '批量采购优惠'],
      script: '多店经营，设备和耗材要统一标准，管理更省心。',
    },
    {
      stage: '阶段4：小工厂/批量生产客户' as GrowthStage,
      rec: ['大规格设备', '封箱/捆扎/打包配套', '年度保养服务', '专属售后'],
      script: '产量上来后，包装效率和停机风险比机器价格更重要。',
    },
  ];
  return (
    <div className="space-y-4">
      {stages.map((s) => (
        <Card key={s.stage} elevated className="border border-ash p-4">
          <h4 className="font-display font-semibold text-coal-ink">{s.stage}</h4>
          <p className="mt-2 text-sm text-graphite">
            <span className="font-medium">推荐：</span>
            {s.rec.join('、')}
          </p>
          <p className="mt-2 text-sm text-slate-mid">
            <span className="font-medium text-coal-ink">核心话术：</span>
            {s.script}
          </p>
        </Card>
      ))}
      <Card className="border border-ash p-4">
        <h4 className="text-sm font-semibold text-coal-ink">成长记录（可选登记）</h4>
        <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-xs text-graphite">
          {records.map((r) => (
            <li key={r.id}>
              {profiles.find((p) => p.id === r.customerId)?.customerName ?? r.customerId} · {r.growthStage} · {r.note}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function AfterSalesTab({
  rows,
  profiles,
  onSave,
  reload,
}: {
  rows: CustomerAfterSalesRecord[];
  profiles: OldCustomerProfile[];
  onSave: (r: CustomerAfterSalesRecord[]) => void;
  reload: () => void;
}) {
  const add = () => {
    const p0 = profiles[0];
    const row: CustomerAfterSalesRecord = {
      id: rid(),
      customerId: p0?.id ?? '',
      deviceModel: p0?.deviceModel ?? '',
      afterSalesTime: new Date().toISOString().slice(0, 16),
      issue: '',
      issueType: '其他',
      handling: '',
      resolved: false,
      satisfaction: '',
      affectsRepurchase: false,
      proofNote: '',
      createdAt: isoNow(),
      updatedAt: isoNow(),
    };
    onSave([...rows, row]);
    reload();
  };
  const patch = (id: string, p: Partial<CustomerAfterSalesRecord>) => {
    onSave(rows.map((r) => (r.id === id ? { ...r, ...p, updatedAt: isoNow() } : r)));
    reload();
  };
  return (
    <Card className="border border-ash p-4 space-y-3">
      <button type="button" className="btn-primary text-sm" onClick={add}>
        新增售后记录
      </button>
      <table className="min-w-full text-left text-sm">
        <thead className="border-b text-xs text-graphite">
          <tr>
            <th className="p-2">时间</th>
            <th className="p-2">客户</th>
            <th className="p-2">问题</th>
            <th className="p-2">类型</th>
            <th className="p-2">解决</th>
            <th className="p-2">满意度</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-ash/60 align-top">
              <td className="p-2">
                <input type="datetime-local" className="input-field text-xs" value={r.afterSalesTime} onChange={(e) => patch(r.id, { afterSalesTime: e.target.value })} />
              </td>
              <td className="p-2 text-xs">{profiles.find((p) => p.id === r.customerId)?.customerName ?? r.customerId}</td>
              <td className="p-2">
                <input className="input-field w-full text-xs" value={r.issue} onChange={(e) => patch(r.id, { issue: e.target.value })} />
              </td>
              <td className="p-2">
                <select className="input-field text-xs" value={r.issueType} onChange={(e) => patch(r.id, { issueType: e.target.value as CustomerAfterSalesRecord['issueType'] })}>
                  {(['不会使用', '配件损耗', '机器故障', '物流问题', '质量疑问', '其他'] as const).map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </td>
              <td className="p-2">
                <input type="checkbox" checked={r.resolved} onChange={(e) => patch(r.id, { resolved: e.target.checked })} />
              </td>
              <td className="p-2">
                <select className="input-field text-xs" value={r.satisfaction} onChange={(e) => patch(r.id, { satisfaction: e.target.value as CustomerAfterSalesRecord['satisfaction'] })}>
                  <option value="">—</option>
                  {(['满意', '一般', '不满意'] as const).map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function DashboardTab({
  dash,
  profiles,
  follows,
  rep,
}: {
  dash: {
    total: number;
    monthShould: number;
    monthDone: number;
    monthTodo: number;
    repSum: number;
    growthCnt: number;
    hvCnt: number;
    risk: number;
    followRate: number;
  };
  profiles: OldCustomerProfile[];
  follows: OldCustomerFollowTask[];
  rep: RepurchaseOpportunity[];
}) {
  const lastFollow = (cid: string) => {
    const fs = follows.filter((f) => f.customerId === cid && f.isCompleted);
    if (!fs.length) return '—';
    return fs.sort((a, b) => b.followDate.localeCompare(a.followDate))[0]!.followDate;
  };
  const nextFollow = (cid: string) => {
    const fs = follows.filter((f) => f.customerId === cid && !f.isCompleted);
    if (!fs.length) return '—';
    return fs.sort((a, b) => a.followDate.localeCompare(b.followDate))[0]!.followDate;
  };
  const repStatus = (cid: string) => rep.find((r) => r.customerId === cid)?.repurchaseStatus ?? '—';

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['老客户总数', String(dash.total)],
          ['本月应回访', String(dash.monthShould)],
          ['已回访', String(dash.monthDone)],
          ['未回访', String(dash.monthTodo)],
          ['回访完成率(本月)', `${dash.followRate}%`],
          ['复购金额(累计实际)', String(dash.repSum)],
          ['成长型客户数', String(dash.growthCnt)],
          ['高价值客户数', String(dash.hvCnt)],
          ['有售后风险/标记', String(dash.risk)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-card border border-ash bg-ledger-white px-3 py-3 text-center">
            <p className="text-xs text-graphite">{k}</p>
            <p className="mt-1 font-display text-lg font-bold text-coal-ink">{v}</p>
          </div>
        ))}
      </div>
      <Card className="border border-amber-200 bg-amber-50/40 p-3 text-xs text-amber-950">
        KPI 联动说明：上列为展示指标，暂不纳入 KPI 总分权重；后续可在 KPI 配置中绑定权重。
      </Card>
      <div className="overflow-x-auto rounded-card border border-ash bg-ledger-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-ash bg-elevated text-xs text-graphite">
            <tr>
              <th className="p-2">客户</th>
              <th className="p-2">归属</th>
              <th className="p-2">分类</th>
              <th className="p-2">成长阶段</th>
              <th className="p-2">设备</th>
              <th className="p-2">最近购买</th>
              <th className="p-2">最近回访</th>
              <th className="p-2">下次回访</th>
              <th className="p-2">复购</th>
              <th className="p-2">状态</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.id} className="border-b border-ash/60">
                <td className="p-2 font-medium">{p.customerName}</td>
                <td className="p-2 text-xs">{p.ownerEmployee}</td>
                <td className="p-2">
                  <span className={cn('rounded border px-1.5 py-0.5 text-xs', catBadge(p.customerCategory))}>{p.customerCategory}</span>
                </td>
                <td className="p-2 text-xs">{p.growthStage}</td>
                <td className="p-2 text-xs">{p.purchasedDevice}</td>
                <td className="p-2 text-xs">{p.purchaseDate}</td>
                <td className="p-2 text-xs">{lastFollow(p.id)}</td>
                <td className="p-2 text-xs">{nextFollow(p.id)}</td>
                <td className="p-2 text-xs">{repStatus(p.id)}</td>
                <td className="p-2 text-xs">{p.customerStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
