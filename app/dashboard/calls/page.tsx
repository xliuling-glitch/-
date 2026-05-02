import { DynamicTable } from '@/components/dynamic-table';
export default function Page(){return <div><h2 className='text-xl font-semibold mb-3'>电联管理</h2><DynamicTable moduleKey='calls' defaultColumns={['电联日期','客服姓名','客户名称','通话时长','是否接通','是否有效电联']} /></div>}
