'use client';

import type { KpiDailyAuditStatus, KpiDailySubmission } from '@/lib/kpi-daily/types';
import { formatAmountYuan } from '@/lib/format-amount';

const AUDIT_LABEL: Record<KpiDailyAuditStatus, string> = {
  draft: '草稿',
  pending_review: '待审核',
  approved: '已通过',
  rejected: '已驳回',
};

function fmtPct(n: number | null) {
  if (n == null || Number.isNaN(n)) return '—';
  return `${Number(n).toFixed(1)}%`;
}

function fmtText(s: string, empty = '—') {
  const t = String(s ?? '').trim();
  return t ? t : empty;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-ash/80 bg-[#fafaf8] p-3">
      <h4 className="border-b border-ash/60 pb-2 text-xs font-bold tracking-wide text-graphite">{title}</h4>
      <div className="pt-2">{children}</div>
    </section>
  );
}

function FieldTable({ rows }: { rows: { label: string; value: React.ReactNode }[] }) {
  return (
    <table className="w-full border-collapse text-sm">
      <tbody>
        {rows.map(({ label, value }) => (
          <tr key={label} className="border-b border-ash/50 last:border-0">
            <th className="w-[38%] max-w-[10rem] py-1.5 pr-3 text-left align-top font-normal text-graphite">{label}</th>
            <td className="py-1.5 font-medium text-coal-ink">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function collectProofUrls(s: KpiDailySubmission): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of [s.proofImages, s.aiProofImages, s.reviewProofImages]) {
    if (!Array.isArray(list)) continue;
    for (const u of list) {
      if (typeof u === 'string' && u.length > 0 && !seen.has(u)) {
        seen.add(u);
        out.push(u);
      }
    }
  }
  return out;
}

export function KpiSubmissionDetailPanel({ submission: s }: { submission: KpiDailySubmission }) {
  const proofs = collectProofUrls(s);
  const shiftLabel = s.shift === 'night' ? '晚班' : '白班';

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-ash bg-white px-3 py-2.5 text-sm">
        <span className="font-semibold text-coal-ink">
          {s.employeeName}
          <span className="mx-1.5 font-normal text-stone">·</span>
          {s.date}
        </span>
        <span
          className="rounded-full border px-2 py-0.5 text-xs font-medium"
          style={{
            borderColor: 'var(--color-ash)',
            backgroundColor:
              s.auditStatus === 'approved' ? 'rgba(16, 185, 129, 0.12)' : s.auditStatus === 'rejected' ? 'rgba(244, 63, 94, 0.1)' : 'rgba(245, 158, 11, 0.12)',
            color: s.auditStatus === 'approved' ? '#047857' : s.auditStatus === 'rejected' ? '#be123c' : '#b45309',
          }}
        >
          {AUDIT_LABEL[s.auditStatus]}
        </span>
        <span className="text-xs text-stone">{s.storeName || '—'}</span>
        <span className="text-xs text-stone">{shiftLabel}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="基础与备注">
          <FieldTable
            rows={[
              { label: '任务类型', value: fmtText(s.taskType) },
              { label: '备注', value: <span className="font-normal whitespace-pre-wrap">{fmtText(s.remark)}</span> },
              { label: '提交时间', value: s.submittedAt ? s.submittedAt.slice(0, 19).replace('T', ' ') : '—' },
              { label: '创建 / 更新', value: `${s.createdAt?.slice(0, 19).replace('T', ' ') ?? '—'} / ${s.updatedAt?.slice(0, 19).replace('T', ' ') ?? '—'}` },
              { label: '记录 ID', value: <span className="break-all font-mono text-xs font-normal">{s.id}</span> },
            ]}
          />
        </Section>

        <Section title="审核信息">
          <FieldTable
            rows={[
              { label: '审核人', value: fmtText(s.auditor) },
              { label: '驳回原因', value: <span className="font-normal text-rose-800">{fmtText(s.rejectReason)}</span> },
              { label: '主管备注', value: <span className="font-normal whitespace-pre-wrap">{fmtText(s.managerRemark)}</span> },
            ]}
          />
        </Section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="AI 运用">
          <FieldTable
            rows={[
              { label: 'AI 使用次数', value: s.aiUseCount },
              { label: '话术条数', value: s.aiScriptCount },
              { label: '案例条数', value: s.aiCaseCount },
              { label: 'AI 合计分', value: s.aiTotalScore?.toFixed(2) ?? '—' },
              { label: '说明', value: <span className="font-normal whitespace-pre-wrap">{fmtText(s.aiRemark)}</span> },
            ]}
          />
        </Section>

        <Section title="留资">
          <FieldTable
            rows={[
              { label: '今日留资总量', value: s.todayLeadCount },
              { label: 'A 类 / B 类 / C 类', value: `${s.leadA} / ${s.leadB} / ${s.leadC}` },
              { label: '无效留资', value: s.invalidLead },
              { label: '高质量留资分', value: s.highQualityLeadScore?.toFixed(2) ?? '—' },
              { label: '说明', value: <span className="font-normal whitespace-pre-wrap">{fmtText(s.leadRemark)}</span> },
            ]}
          />
        </Section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="电联">
          <FieldTable
            rows={[
              { label: '应电联', value: s.shouldCallCount },
              { label: '已电联', value: s.calledCount },
              { label: '有效电联', value: s.validCallCount },
              { label: '进阶客户', value: s.advancedCustomerCount },
              { label: '逾期跟进', value: s.overdueFollowCount },
              { label: '电联完成率', value: fmtPct(s.callCompletionRate) },
              { label: '有效电联率', value: fmtPct(s.validCallRate) },
              { label: '说明', value: <span className="font-normal whitespace-pre-wrap">{fmtText(s.callRemark)}</span> },
            ]}
          />
        </Section>

        <Section title="销售">
          <FieldTable
            rows={[
              { label: '订单数', value: s.orderCount },
              { label: '销售额', value: formatAmountYuan(s.salesAmount) },
              { label: '退款额', value: formatAmountYuan(s.refundAmount) },
              { label: '净销售额', value: formatAmountYuan(s.netSalesAmount) },
              { label: '说明', value: <span className="font-normal whitespace-pre-wrap">{fmtText(s.salesRemark)}</span> },
            ]}
          />
        </Section>
      </div>

      <Section title="评价">
        <FieldTable
          rows={[
            { label: '文字 / 图片 / 视频 / 追评', value: `${s.textReviewCount} / ${s.imageReviewCount} / ${s.videoReviewCount} / ${s.followReviewCount}` },
            { label: '评价计分（加权）', value: s.reviewScoreCount?.toFixed(2) ?? '—' },
            { label: '有效评价分（展示）', value: s.effectiveReviewScore?.toFixed(2) ?? '—' },
            { label: '说明', value: <span className="font-normal whitespace-pre-wrap">{fmtText(s.reviewRemark)}</span> },
          ]}
        />
      </Section>

      {proofs.length > 0 ? (
        <Section title="凭证截图">
          <p className="mb-2 text-xs text-stone">共 {proofs.length} 张，点击可在新标签打开。</p>
          <div className="flex max-h-64 flex-wrap gap-2 overflow-y-auto">
            {proofs.map((src, i) => (
              <a key={i} href={src} target="_blank" rel="noreferrer" className="block shrink-0 overflow-hidden rounded border border-ash bg-white shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`凭证 ${i + 1}`} className="h-24 w-auto max-w-[200px] object-contain" />
              </a>
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  );
}
