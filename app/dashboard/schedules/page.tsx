import { DynamicTable } from '@/components/dynamic-table';
export default function Page(){return <div><h2 className='text-xl font-semibold mb-3'>排班管理</h2><DynamicTable moduleKey='schedules' defaultColumns={['日期','客服姓名','班次','上班时间','下班时间','当日角色']} /></div>}
