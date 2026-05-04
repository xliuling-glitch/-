'use client';

import { AiFeedbackTable } from '@/components/ai-feedback-table';

export default function Page() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-coal-ink">AI运用反馈</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-mid">
          按业务日登记每位客服在各品类的询单与成交、AI 使用次数。可先「下载空白模板」在 Excel 中批量填写，再通过「导入 CSV」回填；支持在线编辑后「保存到数据库」。
        </p>
      </div>
      <AiFeedbackTable />
    </div>
  );
}
