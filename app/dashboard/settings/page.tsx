'use client';
import { useEffect, useState } from 'react';

const fields = [
  ['shops', '店铺（每行一个）'],
  ['inquiry_types', '咨询类型（每行一个）'],
  ['customer_types', '客户类型（每行一个）'],
  ['status_options', '跟进状态（每行一个）'],
  ['lost_reasons', '未成交原因（每行一个）'],
  ['staff_roster', '员工名单（每行一个）'],
] as const;

export default function Page() {
  const [cfg, setCfg] = useState<Record<string, string[]>>({});
  useEffect(() => { fetch('/api/options').then((r) => r.json()).then(setCfg); }, []);
  const save = async () => {
    await fetch('/api/options', { method: 'POST', body: JSON.stringify(cfg) });
    alert('配置已保存');
  };

  return <div className='space-y-3'>
    <h2 className='text-xl font-semibold'>系统配置中心（兼容原PY版侧边栏）</h2>
    <div className='bg-white border rounded p-4 space-y-3'>
      {fields.map(([k, label]) => <div key={k}><div className='text-sm mb-1'>{label}</div><textarea className='w-full border rounded p-2 h-24' value={(cfg[k] || []).join('\n')} onChange={(e) => setCfg({ ...cfg, [k]: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) })} /></div>)}
      <button className='btn-primary text-sm' onClick={save}>保存配置</button>
    </div>
  </div>;
}
