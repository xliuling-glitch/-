import { DynamicTable } from '@/components/dynamic-table';
export default function Page(){return <div><h2 className='text-xl font-semibold mb-3'>系统设置</h2><DynamicTable moduleKey='settings' defaultColumns={['配置项','配置值','说明']} /></div>}
