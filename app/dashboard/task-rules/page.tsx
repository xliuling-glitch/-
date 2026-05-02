import { DynamicTable } from '@/components/dynamic-table';
export default function Page(){return <div><h2 className='text-xl font-semibold mb-3'>task-rules</h2><DynamicTable moduleKey='task-rules' defaultColumns={['日期','客服','状态','备注']} /></div>}
