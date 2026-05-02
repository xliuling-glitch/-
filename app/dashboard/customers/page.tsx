import { DynamicTable } from '@/components/dynamic-table';
export default function Page(){return <div><h2 className='text-xl font-semibold mb-3'>客户管理</h2><DynamicTable moduleKey='customers' defaultColumns={['客户编号','客户名称','平台来源','客户等级','负责客服','下次跟进日期']} /></div>}
