'use client';

import { useRef, useState } from 'react';
import type { TaskAttachment } from '@/lib/today-tasks/types';
import { compressImageToDataUrl, newAttachmentId } from '@/lib/today-tasks/attachments';

const MAX_ITEMS = 12;

type Props = {
  attachments: TaskAttachment[];
  onChange: (next: TaskAttachment[]) => void;
  /** 与「截图说明」等字段并列时的简短标题 */
  label?: string;
};

export function TaskCredentialsEditor({ attachments, onChange, label = '完成凭证' }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [textDraft, setTextDraft] = useState('');
  const [err, setErr] = useState('');

  const push = (a: TaskAttachment) => {
    if (attachments.length >= MAX_ITEMS) {
      setErr(`最多 ${MAX_ITEMS} 条凭证，请先删除部分再添加。`);
      return;
    }
    setErr('');
    onChange([...attachments, a]);
  };

  const remove = (id: string) => {
    setErr('');
    onChange(attachments.filter((x) => x.id !== id));
  };

  const onPickFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setBusy(true);
    setErr('');
    try {
      for (const file of Array.from(files)) {
        if (attachments.length >= MAX_ITEMS) break;
        const dataUrl = await compressImageToDataUrl(file);
        push({
          id: newAttachmentId(),
          kind: 'image',
          content: dataUrl,
          fileName: file.name,
          addedAt: new Date().toISOString(),
        });
      }
    } catch (er) {
      setErr(er instanceof Error ? er.message : '上传失败');
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };

  const addText = () => {
    const t = textDraft.trim();
    if (!t) {
      setErr('请输入文字内容');
      return;
    }
    push({
      id: newAttachmentId(),
      kind: 'text',
      content: t,
      addedAt: new Date().toISOString(),
    });
    setTextDraft('');
    setErr('');
  };

  return (
    <div className="rounded-lg border border-ash/80 bg-ledger-white/80 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-graphite">{label}</span>
        <span className="text-[11px] text-stone">与当前任务绑定，自动保存</span>
      </div>
      <p className="mt-1 text-[11px] text-slate-mid">支持上传截图（自动压缩）；可追加多条文字说明。评价类任务可与下方链接/备注一并作为审核依据。</p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void onPickFiles(e)} />
        <button
          type="button"
          className="btn-ghost text-xs"
          disabled={busy || attachments.length >= MAX_ITEMS}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? '处理中…' : '上传图片'}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <textarea
          className="input-field min-h-[56px] min-w-[min(100%,16rem)] flex-1 text-sm"
          placeholder="输入文字凭证后点击「添加文字」"
          value={textDraft}
          onChange={(e) => setTextDraft(e.target.value)}
        />
        <button type="button" className="btn-primary self-end text-xs" disabled={attachments.length >= MAX_ITEMS} onClick={addText}>
          添加文字
        </button>
      </div>

      {err ? <p className="mt-2 text-xs text-red-600">{err}</p> : null}

      {attachments.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {attachments.map((a) => (
            <li key={a.id} className="flex gap-2 rounded border border-ash bg-white p-2 text-xs">
              {a.kind === 'image' ? (
                <div className="flex shrink-0 flex-col gap-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.content} alt="" className="h-16 w-16 rounded object-cover ring-1 ring-black/5" />
                </div>
              ) : null}
              <div className="min-w-0 flex-1">
                {a.kind === 'image' ? (
                  <p className="truncate font-medium text-coal-ink">{a.fileName ?? '图片'}</p>
                ) : (
                  <p className="whitespace-pre-wrap break-words text-graphite">{a.content}</p>
                )}
                <p className="mt-0.5 text-[10px] text-stone">{new Date(a.addedAt).toLocaleString('zh-CN')}</p>
              </div>
              <button type="button" className="shrink-0 text-red-600 hover:underline" onClick={() => remove(a.id)}>
                删除
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** 主管看板等只读展示 */
export function TaskAttachmentsPreview({ attachments }: { attachments: TaskAttachment[] | undefined }) {
  const list = attachments ?? [];
  if (list.length === 0) return null;
  return (
    <ul className="mt-2 space-y-2 border-t border-ash/60 pt-2">
      {list.map((a) => (
        <li key={a.id} className="flex gap-2 text-xs">
          {a.kind === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={a.content} alt="" className="h-12 w-12 shrink-0 rounded object-cover ring-1 ring-black/5" />
          ) : null}
          <div className="min-w-0">
            {a.kind === 'image' ? (
              <p className="truncate text-graphite">{a.fileName ?? '图片凭证'}</p>
            ) : (
              <p className="whitespace-pre-wrap break-words text-graphite">{a.content}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
