import { DynamicTable } from '@/components/dynamic-table';
export default function Page(){return <div><h2 className='text-xl font-semibold mb-3'>今日任务中心</h2><DynamicTable moduleKey='tasks' defaultColumns={['任务日期','客服姓名','任务类型','截止时间','任务状态','优先级','主管备注']} /></div>}
