import { DynamicTable } from '@/components/dynamic-table';
export default function Page(){return <div><h2 className='text-xl font-semibold mb-3'>评价管理</h2><DynamicTable moduleKey='reviews' defaultColumns={['日期','客服姓名','客户名称','平台','评价状态','备注']} /></div>}
