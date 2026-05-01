'use client';
import { useEffect, useState } from 'react';

export default function Page({ params }: { params: { id: string } }) {
  const [c, setC] = useState<any>(null);
  useEffect(() => { fetch(`/api/customers/${params.id}`).then(r => r.json()).then(setC); }, [params.id]);
  if (!c) return <div>加载中...</div>;
  return <div className='space-y-3'><h2 className='text-xl font-semibold'>客户详情 - {c.name}</h2><div className='bg-white border rounded p-4'><p>编号：{c.code}</p><p>平台：{c.platform}</p><p>等级：{c.level}</p><p>负责客服：{c.owner?.name}</p></div><div className='grid grid-cols-3 gap-3'><div className='bg-white border rounded p-4'>跟进记录 {c.followUps?.length}</div><div className='bg-white border rounded p-4'>电联记录 {c.calls?.length}</div><div className='bg-white border rounded p-4'>复购提醒 {c.reminders?.length}</div></div></div>;
}
