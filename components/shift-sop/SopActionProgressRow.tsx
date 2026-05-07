'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { SopActionTemplate, SopProgressRecord, SopSlotTemplate } from '@/lib/shift-sop/types';
import { formatActionTypeLabel } from '@/lib/shift-sop/time-utils';
import { relatedModuleHref, RELATED_MODULE_LABELS } from '@/lib/shift-sop/links';
import { getProgressRow } from '@/lib/shift-sop/storage';

export function readSopProofFileAsDataUrl(onData: (url: string) => void) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = () => {
    const f = input.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => onData(String(r.result));
    r.readAsDataURL(f);
  };
  input.click();
}

/** 单条 SOP 动作的完成、备注、截图（时间轴与「当前时间待办」共用；逾期时段仍可操作） */
export function SopActionProgressRow({
  slot,
  action,
  date,
  staff,
  progress,
  isSlotEnded,
  onPatch,
}: {
  slot: SopSlotTemplate;
  action: SopActionTemplate;
  date: string;
  staff: string;
  progress: SopProgressRecord[];
  isSlotEnded: boolean;
  onPatch: (
    slot: SopSlotTemplate,
    action: SopActionTemplate,
    partial: Partial<Pick<SopProgressRecord, 'status' | 'remark' | 'proofImages' | 'completedAt'>>,
  ) => void;
}) {
  const row = staff ? getProgressRow(progress, date, staff, action.id) : undefined;
  const done = row?.status === 'done';
  const deferred = row?.status === 'deferred';
  const skipped = row?.status === 'skipped';
  const href = relatedModuleHref(action.relatedModule, {
    businessDate: date,
    draftDouyinRow: action.relatedModule === 'lead_follow_douyin',
  });
  const needWarn = action.isRequired && !done && !skipped && isSlotEnded;

  return (
    <div
      className={cn(
        'rounded-lg border p-2 text-sm',
        done ? 'border-emerald-200 bg-emerald-50/60' : needWarn ? 'border-red-200 bg-red-50/50' : 'border-ash/80 bg-white',
      )}
    >
      <div className="flex flex-wrap items-start gap-2">
        <label className="flex cursor-pointer items-start gap-2 pt-0.5">
          <input
            type="checkbox"
            className="mt-1"
            disabled={!staff}
            checked={done || skipped}
            onChange={(e) => {
              if (!staff) return;
              if (e.target.checked) onPatch(slot, action, { status: 'done' });
              else onPatch(slot, action, { status: 'pending', completedAt: '' });
            }}
          />
        </label>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-coal-ink">{action.actionText}</span>
            <span
              className={cn(
                'rounded px-1.5 py-0.5 text-[10px] font-medium',
                action.actionType === 'required' ? 'bg-red-100 text-red-800' : undefined,
                action.actionType === 'jump' ? 'bg-violet-100 text-violet-800' : undefined,
                action.actionType === 'guide' ? 'bg-sky-100 text-sky-800' : undefined,
                action.actionType === 'learning' ? 'bg-slate-100 text-slate-600' : undefined,
              )}
            >
              {formatActionTypeLabel(action.actionType)}
              {action.isRequired ? ' · 必做' : ''}
            </span>
            {action.needProof ? <span className="text-[10px] text-amber-800">需截图</span> : null}
            {deferred ? <span className="text-[10px] font-medium text-amber-900">已延期</span> : null}
          </div>
          {href ? (
            <div className="mt-1 flex flex-wrap gap-2">
              <Link href={href} className="text-xs font-medium text-sky-800 underline">
                跳转填写（{RELATED_MODULE_LABELS[action.relatedModule]}）
              </Link>
            </div>
          ) : null}
          <label className="mt-2 block text-xs text-graphite">
            备注 / 延期说明
            <textarea
              className="input-field mt-1 min-h-[48px] w-full text-xs"
              disabled={!staff}
              placeholder={deferred ? '已标记延期，请说明原因' : '可选填'}
              value={row?.remark ?? ''}
              onChange={(e) => onPatch(slot, action, { remark: e.target.value })}
            />
          </label>
          <div className="mt-1 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-ghost text-xs"
              disabled={!staff}
              onClick={() =>
                readSopProofFileAsDataUrl((url) => {
                  const imgs = [...(row?.proofImages ?? []), url];
                  onPatch(slot, action, { proofImages: imgs });
                })
              }
            >
              上传截图
            </button>
            <button
              type="button"
              className="btn-ghost text-xs"
              disabled={!staff}
              onClick={() => onPatch(slot, action, { status: 'deferred' })}
            >
              标记延期
            </button>
            {!action.isRequired ? (
              <button
                type="button"
                className="btn-ghost text-xs"
                disabled={!staff}
                onClick={() => onPatch(slot, action, { status: skipped ? 'pending' : 'skipped' })}
              >
                {skipped ? '取消跳过' : '跳过（指导项）'}
              </button>
            ) : null}
          </div>
          {row?.proofImages?.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {row.proofImages.map((src, i) => (
                <div key={i} className="relative shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-14 w-14 rounded border border-ash object-cover" />
                  <button
                    type="button"
                    className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1 text-[10px] font-medium text-white shadow hover:bg-red-700"
                    disabled={!staff}
                    title="删除截图"
                    onClick={() => {
                      const imgs = row.proofImages!.filter((_, j) => j !== i);
                      onPatch(slot, action, { proofImages: imgs });
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
