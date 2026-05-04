'use client';
import { useEffect, useMemo, useState } from 'react';

export default function Page(){
  const today = new Date().toISOString().slice(0,10);
  const [date,setDate]=useState(today); const [rows,setRows]=useState<any[]>([]); const [notSubmitted,setNotSubmitted]=useState<string[]>([]); const [staff,setStaff]=useState('全部'); const [roster,setRoster]=useState<string[]>([]);
  const load=async()=>{const [acts,opts]=await Promise.all([fetch(`/api/daily-activity?date=${date}`).then(r=>r.json()),fetch('/api/options').then(r=>r.json())]);setRows(acts);setRoster(opts.staff_roster||[]);const submitted=[...new Set(acts.map((a:any)=>a.staff))];setNotSubmitted((opts.staff_roster||[]).filter((s:string)=>!submitted.includes(s)));};
  useEffect(()=>{load()},[date]);
  const filtered = useMemo(()=> staff==='全部'?rows:rows.filter((r:any)=>r.staff===staff),[rows,staff]);
  const rate = roster.length? Math.round(((roster.length-notSubmitted.length)/roster.length)*100):0;
  const color = rate>=90?'text-green-600':rate>=70?'text-yellow-600':'text-red-600';
  const exportCsv=()=>{const head='staff,leads,followups,deals,amount,lastSubmitAt\n';const body=filtered.map((r:any)=>`${r.staff},${r.leadsAdded},${r.followupsAdded},${r.dealsAdded},${r.dealAmountAdded},${r.lastSubmitAt}`).join('\n');const blob=new Blob([head+body],{type:'text/csv'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`daily_submission_${date}.csv`;a.click();};
  return <div className='space-y-3'><h2 className='text-xl font-semibold'>今日提交情况</h2><div className='flex gap-2 items-center'><input type='date' className='border p-2' value={date} onChange={e=>setDate(e.target.value)}/><select className='border p-2' value={staff} onChange={e=>setStaff(e.target.value)}><option>全部</option>{roster.map(s=><option key={s}>{s}</option>)}</select><button className='btn-ghost text-sm' onClick={exportCsv}>导出CSV</button><span className={`font-semibold ${color}`}>提交率：{rate}%</span></div><div className='grid grid-cols-2 gap-3'><div className='bg-white border rounded p-3'><h3 className='font-semibold text-green-700'>✅ 已提交</h3><table className='w-full text-sm mt-2'><thead><tr><th>客服</th><th>线索</th><th>跟进</th><th>成交</th><th>提交时间</th></tr></thead><tbody>{filtered.map((r:any)=><tr key={r.id} className='border-t'><td>{r.staff}</td><td>{r.leadsAdded}</td><td>{r.followupsAdded}</td><td>{r.dealsAdded}</td><td>{new Date(r.lastSubmitAt).toLocaleString()}</td></tr>)}</tbody></table></div><div className='bg-white border rounded p-3'><h3 className='font-semibold text-red-700'>❌ 未提交</h3><p className='mt-2'>{notSubmitted.join('、') || '全员已提交'}</p></div></div></div>
}
