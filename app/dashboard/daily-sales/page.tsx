'use client';
import { useEffect, useMemo, useState } from 'react';
import { CsvTemplateUpload } from '@/components/csv-template-upload';

const headers = ['店铺','姓名','接待人数','售后人数','无效询单','售前人数','成交人数','日销售额'];

export default function Page(){
  const today=new Date().toISOString().slice(0,10);
  const [date,setDate]=useState(today); const [staff,setStaff]=useState(''); const [shops,setShops]=useState<string[]>(['天猫旗舰店']);
  const [rows,setRows]=useState<any[]>([]);
  const [f,setF]=useState({shop:'天猫旗舰店',staff:'周晨',reception:0,aftersale:0,invalidInquiry:0,presale:0,deals:0,sales:0});
  const load=async()=>{const [sales,opts]=await Promise.all([fetch(`/api/daily-sales?date=${date}&staff=${staff}`).then(r=>r.json()),fetch('/api/options').then(r=>r.json())]);setRows(sales);setShops(opts.shops||['天猫旗舰店']);if((opts.shops||[]).length)setF(v=>({...v,shop:v.shop||opts.shops[0]}));};
  useEffect(()=>{load()},[date,staff]);
  const add=async()=>{await fetch('/api/daily-sales',{method:'POST',body:JSON.stringify({...f,date})});load();};
  const total = useMemo(()=>rows.reduce((s,r)=>s+Number(r.sales||0),0),[rows]);
  const exportCsv=()=>{const head='date,shop,staff,reception,aftersale,invalidInquiry,presale,deals,sales\n';const body=rows.map(r=>`${r.date},${r.shop},${r.staff},${r.reception},${r.aftersale},${r.invalidInquiry},${r.presale},${r.deals},${r.sales}`).join('\n');const blob=new Blob([head+body],{type:'text/csv'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`daily_sales_${date}.csv`;a.click();};
  return <div className='space-y-3'><h2 className='text-xl font-semibold'>每日销售额数据（个人日销）</h2>
  <CsvTemplateUpload
    title="客服日销询单表 · CSV 批量导入"
    description="沿用《客服日销询单表_模板》表头，或旧系统「日报」导出列（含 id、created_at 等会自动忽略）。同一日期+客服+店铺已存在则覆盖数字；仅新增行会计入今日活动统计。普通客服仅能导入本人姓名行。"
    templateHref="/templates/客服日销询单表_模板.csv"
    templateLabel="下载标准模板"
    action="选择 CSV 导入"
    uploadUrl="/api/daily-sales/import"
    onDone={load}
  />
  <div className='flex gap-2'><input type='date' className='border p-2' value={date} onChange={e=>setDate(e.target.value)}/><input className='border p-2' placeholder='筛选客服' value={staff} onChange={e=>setStaff(e.target.value)}/><button className='btn-ghost text-sm' onClick={exportCsv}>导出CSV</button></div>
  <div className='bg-white border rounded p-3'>
    <div className='grid grid-cols-8 gap-2 mb-2 text-xs text-slate-500'>{headers.map(h=><div key={h}>{h}</div>)}</div>
    <div className='grid grid-cols-8 gap-2'>
      <select className='border p-2' value={f.shop} onChange={e=>setF({...f,shop:e.target.value})}>{shops.map(s=><option key={s}>{s}</option>)}</select>
      <input className='border p-2' placeholder='姓名' value={f.staff} onChange={e=>setF({...f,staff:e.target.value})}/>
      <input className='border p-2' placeholder='接待人数' type='number' value={f.reception} onChange={e=>setF({...f,reception:Number(e.target.value)})}/>
      <input className='border p-2' placeholder='售后人数' type='number' value={f.aftersale} onChange={e=>setF({...f,aftersale:Number(e.target.value)})}/>
      <input className='border p-2' placeholder='无效询单' type='number' value={f.invalidInquiry} onChange={e=>setF({...f,invalidInquiry:Number(e.target.value)})}/>
      <input className='border p-2' placeholder='售前人数' type='number' value={f.presale} onChange={e=>setF({...f,presale:Number(e.target.value)})}/>
      <input className='border p-2' placeholder='成交人数' type='number' value={f.deals} onChange={e=>setF({...f,deals:Number(e.target.value)})}/>
      <input className='border p-2' placeholder='日销售额' type='number' value={f.sales} onChange={e=>setF({...f,sales:Number(e.target.value)})}/>
    </div>
    <button className='btn-primary mt-2 w-full text-sm' onClick={add}>提交</button>
  </div><div className='bg-white border rounded p-3'>今日提交情况：{rows.length} 条；数据明细总销售额：¥{total}</div><div className='bg-white border rounded p-3 overflow-auto'><table className='w-full text-sm'><thead><tr><th>日期</th><th>店铺</th><th>姓名</th><th>接待</th><th>售后</th><th>无效询单</th><th>售前</th><th>成交</th><th>日销</th></tr></thead><tbody>{rows.map((r,i)=><tr key={i} className='border-t'><td>{r.date}</td><td>{r.shop}</td><td>{r.staff}</td><td>{r.reception}</td><td>{r.aftersale}</td><td>{r.invalidInquiry}</td><td>{r.presale}</td><td>{r.deals}</td><td>{r.sales}</td></tr>)}</tbody></table></div></div>
}
