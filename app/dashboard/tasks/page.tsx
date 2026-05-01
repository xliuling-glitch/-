'use client';
import { ListPage } from '@/components/list-page';
export default function Page(){const gen=async()=>{await fetch('/api/tasks/generate',{method:'POST'});alert('已生成今日任务');};return <div><button onClick={gen} className='mb-3 bg-emerald-600 text-white px-3 py-1 rounded'>生成今日任务</button><ListPage title='今日任务中心' cols={['任务日期','客服','任务类型','截止时间','状态','操作']} rows={[['2026-05-01','周晨','平台登录','08:30','已完成','完成任务'],['2026-05-01','张治国','抖音留资电联','19:30','进行中','新增电联']]}/></div>}
