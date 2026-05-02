import { DynamicTable } from '@/components/dynamic-table';
export default function Page(){return <div><h2 className='text-xl font-semibold mb-3'>KPI绩效</h2><DynamicTable moduleKey='kpi' defaultColumns={['统计日期','客服姓名','销售完成率','电联完成率','跟进完成率','KPI得分']} /></div>}
