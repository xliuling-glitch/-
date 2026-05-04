import { SmartScheduleApp } from '@/components/smart-schedule/SmartScheduleApp';

export default function Page() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight text-[#1c1a17]">排班管理</h2>
        <p className="mt-1 max-w-3xl text-sm text-[#7e7d7b]">
          售前客服智能排班（本地 LocalStorage，可后续接数据库）。支持规则配置、一键生成、月历微调、统计与异常检查。当前版稳定后计划补充：节假日规则、新老客服搭配、晚班补贴统计、请假申请（设计文档「排班管理 · 后续版本规划」）。
        </p>
      </div>
      <SmartScheduleApp />
    </div>
  );
}
