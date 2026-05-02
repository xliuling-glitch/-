import { DynamicTable } from '@/components/dynamic-table';
export default function Page(){return <div><h2 className='text-xl font-semibold mb-3'>客户跟进</h2><DynamicTable moduleKey='followups' defaultColumns={['跟进日期','客服姓名','客户名称','跟进方式','跟进类型','跟进结果']} /></div>}
