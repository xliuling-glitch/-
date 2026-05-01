import { ListPage } from '@/components/list-page';
export default function Page(){return <ListPage title='客户管理' cols={['客户编号','客户名称','平台','等级','负责客服','下次跟进']} rows={[['C001','王老板','淘宝天猫店','H高价值','周晨','2026-05-02'],['C005','赵先生','抖音','G成长型','李客服','2026-05-01']]}/>}
