'use client';

import { useEffect, useMemo, useState } from 'react';
import { CsvTemplateUpload } from '@/components/csv-template-upload';

const CHANNELS = ['电话', '微信', '其他', '自定义'] as const;

export default function Page() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [staff, setStaff] = useState('周晨');
  const [leads, setLeads] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [acts, setActs] = useState<any[]>([]);
  const [opts, setOpts] = useState<any>({
    shops: ['天猫旗舰店'],
    inquiry_types: ['真空机'],
    customer_types: ['新客户'],
    status_options: ['待跟进'],
    lost_reasons: ['价格高'],
  });
  const [leadForm, setLeadForm] = useState({
    shop: '天猫旗舰店',
    inquiryType: '真空机',
    model: '',
    customerType: '新客户',
    buyerId: '',
    phone: '',
    wechat: '',
    wechatAdded: true,
    holdSent: false,
    intentLevel: '',
    tier: '',
    note: '',
  });
  const [logScreenshot, setLogScreenshot] = useState<File | null>(null);
  const [logForm, setLogForm] = useState({
    shop: '天猫旗舰店',
    buyerId: '',
    purchaseIntent: '',
    customerCategory: '',
    followedAt: today,
    channel: '微信' as (typeof CHANNELS)[number],
    channelNote: '',
    attemptNo: 1 as 1 | 2 | 3 | 4,
    status: '待跟进',
    statusNote: '',
    isDeal: false,
    dealAmount: '',
    lostReason: '',
    nextAction: '',
  });

  const load = async () => {
    setLeads(await (await fetch(`/api/leads?date=${date}`)).json());
    setLogs(await (await fetch(`/api/followup-logs?date=${date}`)).json());
    setActs(await (await fetch(`/api/daily-activity?date=${date}`)).json());
  };

  useEffect(() => {
    load();
    fetch('/api/options')
      .then((r) => r.json())
      .then((o) => {
        setOpts(o);
        setLeadForm((v) => ({
          ...v,
          shop: o.shops?.[0] || v.shop,
          inquiryType: o.inquiry_types?.[0] || v.inquiryType,
          customerType: o.customer_types?.[0] || v.customerType,
        }));
        setLogForm((v) => ({
          ...v,
          status: o.status_options?.[0] || v.status,
          shop: o.shops?.[0] || v.shop,
          lostReason: o.lost_reasons?.[0] || v.lostReason,
        }));
      });
  }, [date]);

  const submitLead = async () => {
    const r = await fetch('/api/leads', { method: 'POST', body: JSON.stringify({ ...leadForm, date, staff }) });
    if (!r.ok) return alert(await r.text());
    setLeadForm({ ...leadForm, model: '', buyerId: '', phone: '', wechat: '' });
    load();
  };

  const submitLog = async () => {
    const followedAt = logForm.followedAt ? `${logForm.followedAt}T12:00:00` : undefined;
    const base = {
      ...logForm,
      date,
      staff,
      followedAt,
      dealAmount: logForm.dealAmount ? Number(logForm.dealAmount) : null,
    };

    let r: Response;
    if (logScreenshot) {
      const fd = new FormData();
      fd.append('file', logScreenshot);
      fd.append('date', date);
      fd.append('staff', staff);
      fd.append('shop', logForm.shop);
      fd.append('buyerId', logForm.buyerId);
      fd.append('purchaseIntent', logForm.purchaseIntent);
      fd.append('customerCategory', logForm.customerCategory);
      fd.append('followedAt', followedAt || '');
      fd.append('channel', logForm.channel);
      fd.append('channelNote', logForm.channelNote);
      fd.append('attemptNo', String(logForm.attemptNo));
      fd.append('status', logForm.status);
      fd.append('statusNote', logForm.statusNote);
      fd.append('isDeal', logForm.isDeal ? '1' : '0');
      fd.append('dealAmount', logForm.dealAmount || '');
      fd.append('lostReason', logForm.lostReason);
      fd.append('nextAction', logForm.nextAction);
      r = await fetch('/api/followup-logs', { method: 'POST', body: fd });
    } else {
      r = await fetch('/api/followup-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(base),
      });
    }
    if (!r.ok) return alert(await r.text());
    setLogScreenshot(null);
    setLogForm({
      ...logForm,
      buyerId: '',
      purchaseIntent: '',
      customerCategory: '',
      dealAmount: '',
      lostReason: opts.lost_reasons?.[0] || '',
      statusNote: '',
      channelNote: '',
      nextAction: '',
    });
    load();
  };

  const metrics = useMemo(() => {
    const totalLeads = leads.length;
    const totalF = logs.length;
    const dealLogs = logs.filter((x: any) => x.isDeal);
    const dealCnt = dealLogs.length;
    const dealAmt = dealLogs.reduce((s: number, x: any) => s + Number(x.dealAmount || 0), 0);
    return {
      totalLeads,
      totalF,
      dealCnt,
      dealAmt,
      conv: totalLeads ? (dealCnt / totalLeads) * 100 : 0,
      aov: dealCnt ? dealAmt / dealCnt : 0,
    };
  }, [leads, logs]);

  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl font-bold text-[#1c1a17]">询单转化（兼容原 PY 版）</h2>
      <div className="flex flex-wrap gap-2">
        <input type="date" className="input-field w-auto" value={date} onChange={(e) => setDate(e.target.value)} />
        <input className="input-field max-w-[140px]" value={staff} onChange={(e) => setStaff(e.target.value)} placeholder="客服姓名" />
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3 lg:grid-cols-6">
        {[
          ['线索', metrics.totalLeads],
          ['跟进', metrics.totalF],
          ['成交单', metrics.dealCnt],
          ['成交额', metrics.dealAmt],
          ['转化率', `${metrics.conv.toFixed(2)}%`],
          ['客单价', metrics.aov.toFixed(0)],
        ].map(([k, v]) => (
          <div key={String(k)} className="rounded-[10px] border border-[#f1f1f1] bg-white p-3">
            <div className="text-[#7e7d7b]">{k}</div>
            <div className="font-bold text-[#1c1a17]">{String(v)}</div>
          </div>
        ))}
      </div>

      <CsvTemplateUpload
        title="留资跟进表 · CSV 批量导入"
        description="沿用《留资跟进表_标准模板》表头，或旧系统「跟进表」全量导出格式。每行写入线索主档（若不存在）及第 1 次跟进日志；已存在则跳过以免重复。未成交须能从表内推断原因列。普通客服仅能导入本人姓名行。"
        templateHref="/templates/留资跟进表_标准模板.csv"
        templateLabel="下载标准模板"
        action="选择 CSV 导入"
        uploadUrl="/api/leads/import-csv"
        onDone={load}
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-2 rounded-[10px] border border-[#f1f1f1] bg-white p-4">
          <h3 className="font-semibold text-[#1c1a17]">① 线索主档</h3>
          <select className="input-field" value={leadForm.shop} onChange={(e) => setLeadForm({ ...leadForm, shop: e.target.value })}>
            {(opts.shops || []).map((x: string) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <select
            className="input-field"
            value={leadForm.inquiryType}
            onChange={(e) => setLeadForm({ ...leadForm, inquiryType: e.target.value })}
          >
            {(opts.inquiry_types || []).map((x: string) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <input
            className="input-field"
            placeholder="产品型号*"
            value={leadForm.model}
            onChange={(e) => setLeadForm({ ...leadForm, model: e.target.value })}
          />
          <input
            className="input-field"
            placeholder="旺旺ID*"
            value={leadForm.buyerId}
            onChange={(e) => setLeadForm({ ...leadForm, buyerId: e.target.value })}
          />
          <input
            className="input-field"
            placeholder="电话"
            value={leadForm.phone}
            onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
          />
          <input
            className="input-field"
            placeholder="微信"
            value={leadForm.wechat}
            onChange={(e) => setLeadForm({ ...leadForm, wechat: e.target.value })}
          />
          <button type="button" className="btn-primary text-sm" onClick={submitLead}>
            提交留资
          </button>
        </div>

        <div className="space-y-2 rounded-[10px] border border-[#f1f1f1] bg-white p-4">
          <h3 className="font-semibold text-[#1c1a17]">② 跟进日志</h3>
          <p className="text-xs text-[#7e7d7b]">提交后同步到「客户跟进」列表；客户编号/名称与旺旺一致时可同步客户跟进档案。</p>
          <input
            className="input-field"
            placeholder="旺旺ID*"
            value={logForm.buyerId}
            onChange={(e) => setLogForm({ ...logForm, buyerId: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              className="input-field"
              placeholder="客户购买欲望（可填高中低或说明）"
              value={logForm.purchaseIntent}
              onChange={(e) => setLogForm({ ...logForm, purchaseIntent: e.target.value })}
            />
            <input
              className="input-field"
              placeholder="客户分类（可与线索客户类型一致）"
              value={logForm.customerCategory}
              onChange={(e) => setLogForm({ ...logForm, customerCategory: e.target.value })}
            />
          </div>
          <label className="block text-xs text-[#5a5957]">
            本次跟进日期
            <input
              type="date"
              className="input-field mt-1"
              value={logForm.followedAt}
              onChange={(e) => setLogForm({ ...logForm, followedAt: e.target.value })}
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-[#5a5957]">
              跟进方式
              <select
                className="input-field mt-1"
                value={logForm.channel}
                onChange={(e) => setLogForm({ ...logForm, channel: e.target.value as (typeof CHANNELS)[number] })}
              >
                {CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-[#5a5957]">
              第几次跟进
              <select
                className="input-field mt-1"
                value={logForm.attemptNo}
                onChange={(e) => setLogForm({ ...logForm, attemptNo: Number(e.target.value) as 1 | 2 | 3 | 4 })}
              >
                <option value={1}>第 1 次电联</option>
                <option value={2}>第 2 次电联</option>
                <option value={3}>第 3 次电联</option>
                <option value={4}>第 4 次电联</option>
              </select>
            </label>
          </div>
          <label className="block text-xs text-[#5a5957]">
            电联/跟进截图（可选）
            <input
              type="file"
              accept="image/*"
              className="mt-1 block w-full text-xs"
              onChange={(e) => setLogScreenshot(e.target.files?.[0] || null)}
            />
          </label>
          {(logForm.channel === '其他' || logForm.channel === '自定义') && (
            <input
              className="input-field"
              placeholder={logForm.channel === '自定义' ? '请填写自定义方式*' : '补充说明（可选）'}
              value={logForm.channelNote}
              onChange={(e) => setLogForm({ ...logForm, channelNote: e.target.value })}
            />
          )}
          <select className="input-field" value={logForm.shop} onChange={(e) => setLogForm({ ...logForm, shop: e.target.value })}>
            {(opts.shops || []).map((x: string) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <select className="input-field" value={logForm.status} onChange={(e) => setLogForm({ ...logForm, status: e.target.value })}>
            {(opts.status_options || []).map((x: string) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <input
            className="input-field"
            placeholder="跟进说明（可选）"
            value={logForm.statusNote}
            onChange={(e) => setLogForm({ ...logForm, statusNote: e.target.value })}
          />
          <select
            className="input-field"
            value={logForm.isDeal ? '1' : '0'}
            onChange={(e) => setLogForm({ ...logForm, isDeal: e.target.value === '1' })}
          >
            <option value="0">未成交</option>
            <option value="1">已成交</option>
          </select>
          <input
            className="input-field"
            placeholder="成交金额（已成交时必填）"
            value={logForm.dealAmount}
            onChange={(e) => setLogForm({ ...logForm, dealAmount: e.target.value })}
          />
          <select
            className="input-field"
            value={logForm.lostReason}
            onChange={(e) => setLogForm({ ...logForm, lostReason: e.target.value })}
          >
            {(opts.lost_reasons || []).map((x: string) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <input
            className="input-field"
            placeholder="下一步动作（可选）"
            value={logForm.nextAction}
            onChange={(e) => setLogForm({ ...logForm, nextAction: e.target.value })}
          />
          <button type="button" className="btn-primary text-sm" onClick={submitLog}>
            提交跟进
          </button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-[10px] border border-[#f1f1f1] bg-white p-4">
          <h3 className="font-semibold text-[#1c1a17]">③ 今日提交情况</h3>
          <ul className="mt-2 text-sm text-[#5a5957]">
            {acts.map((a: any) => (
              <li key={a.id}>
                {a.staff}：线索 {a.leadsAdded} 跟进 {a.followupsAdded} 成交 {a.dealsAdded}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-[10px] border border-[#f1f1f1] bg-white p-4">
          <h3 className="font-semibold text-[#1c1a17]">④ 数据明细</h3>
          <p className="mt-2 text-sm text-[#5a5957]">
            线索 {leads.length} 条，跟进 {logs.length} 条（含方式/次数/成交标注）
          </p>
        </div>
      </div>
    </div>
  );
}
