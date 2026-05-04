'use client';

import { useRef, useState } from 'react';

type Props = {
  title: string;
  description: string;
  templateHref: string;
  templateLabel: string;
  action: string;
  uploadUrl: string;
  onDone: () => void;
  /** 是否在卡片底部显示「需数据库」说明，默认 true */
  showDatabaseHint?: boolean;
};

type DailyPreview = {
  createdRows?: Array<Record<string, unknown>>;
  updatedRows?: Array<Record<string, unknown>>;
  maxShown?: number;
  hasMore?: boolean;
};

type FollowupPreview = {
  leadsNew?: Array<Record<string, unknown>>;
  followupsNew?: Array<Record<string, unknown>>;
  maxShown?: number;
  hasMore?: boolean;
};

function PreviewTable({
  title,
  rows,
  columns,
}: {
  title: string;
  rows: Record<string, unknown>[];
  columns: { key: string; label: string; fmt?: (v: unknown) => string }[];
}) {
  if (!rows.length) return null;
  return (
    <div className="mt-3">
      <p className="mb-1 text-xs font-semibold text-graphite">{title}</p>
      <div className="max-h-52 overflow-auto rounded-lg border border-ash bg-white text-xs">
        <table className="w-full min-w-[520px] border-collapse text-left">
          <thead className="sticky top-0 bg-ash/90 text-graphite">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className="border-b border-ash px-2 py-1.5 font-medium">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-ash/60 last:border-0">
                {columns.map((c) => (
                  <td key={c.key} className="px-2 py-1.5 tabular-nums text-coal-ink">
                    {c.fmt ? c.fmt(r[c.key]) : String(r[c.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Excel 另存为 CSV 常见为 application/vnd.ms-excel；过窄的 accept 会导致选不到文件、像「点了没反应」 */
const CSV_ACCEPT = '.csv,.CSV,text/csv,text/plain,application/csv,application/vnd.ms-excel';

export function CsvTemplateUpload({
  title,
  description,
  templateHref,
  templateLabel,
  action,
  uploadUrl,
  onDone,
  showDatabaseHint = true,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dailyPreview, setDailyPreview] = useState<DailyPreview | null>(null);
  const [followPreview, setFollowPreview] = useState<FollowupPreview | null>(null);

  const openPicker = () => {
    setErr(null);
    setMsg(null);
    setDailyPreview(null);
    setFollowPreview(null);
    // 推迟到下一帧再打开文件框，避免部分环境下与 React 点击合成事件冲突导致不弹出
    requestAnimationFrame(() => {
      inputRef.current?.click();
    });
  };

  const run = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setErr(null);
    setDailyPreview(null);
    setFollowPreview(null);
    setMsg('正在上传并解析…');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(uploadUrl, {
        method: 'POST',
        body: fd,
        credentials: 'include',
      });
      const raw = await res.text();
      let data: Record<string, unknown> = {};
      try {
        data = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        setMsg(null);
        setErr(raw.trim() ? raw.slice(0, 500) : `服务器返回异常（HTTP ${res.status}）`);
        return;
      }
      if (!res.ok) {
        setMsg(null);
        const e0 = data.errors;
        setErr(
          Array.isArray(e0)
            ? (e0 as string[]).join('；')
            : typeof data.error === 'string'
              ? data.error
              : raw.slice(0, 300) || `请求失败（${res.status}）`,
        );
        return;
      }
      const parts: string[] = [];
      if (typeof data.created === 'number') parts.push(`新增 ${data.created}`);
      if (typeof data.updated === 'number') parts.push(`更新 ${data.updated}`);
      if (typeof data.skipped === 'number' && data.skipped > 0) parts.push(`跳过 ${data.skipped}`);
      if (typeof data.leadsCreated === 'number') parts.push(`线索新增 ${data.leadsCreated}`);
      if (typeof data.leadsSkipped === 'number' && data.leadsSkipped > 0) parts.push(`线索已存在 ${data.leadsSkipped}`);
      if (typeof data.logsCreated === 'number') parts.push(`跟进日志新增 ${data.logsCreated}`);
      if (typeof data.logsSkipped === 'number' && data.logsSkipped > 0) parts.push(`跟进已存在 ${data.logsSkipped}`);
      if (typeof data.staffSkipped === 'number' && data.staffSkipped > 0) parts.push(`非本人行 ${data.staffSkipped}`);
      const summary = parts.join(' · ');
      setMsg(
        summary ||
          '处理结束：未新增/未更新任何行（请确认 CSV 内有数据行，且客服姓名与当前登录账号一致；管理员可导入全员）。',
      );
      if (Array.isArray(data.errors) && data.errors.length) {
        setErr(`提示：${(data.errors as string[]).slice(0, 5).join('；')}${(data.errors as string[]).length > 5 ? '…' : ''}`);
      }

      const pv = data.preview as Record<string, unknown> | undefined;
      if (pv && Array.isArray(pv.createdRows)) {
        const cr = (pv.createdRows as Record<string, unknown>[]) ?? [];
        const ur = (pv.updatedRows as Record<string, unknown>[]) ?? [];
        if (cr.length || ur.length || pv.hasMore) {
          setDailyPreview({
            createdRows: cr,
            updatedRows: ur,
            maxShown: typeof pv.maxShown === 'number' ? pv.maxShown : 40,
            hasMore: !!pv.hasMore,
          });
        }
      } else if (pv && Array.isArray(pv.leadsNew)) {
        const ln = (pv.leadsNew as Record<string, unknown>[]) ?? [];
        const fn = (pv.followupsNew as Record<string, unknown>[]) ?? [];
        if (ln.length || fn.length || pv.hasMore) {
          setFollowPreview({
            leadsNew: ln,
            followupsNew: fn,
            maxShown: typeof pv.maxShown === 'number' ? pv.maxShown : 40,
            hasMore: !!pv.hasMore,
          });
        }
      }

      try {
        onDone();
      } catch (loadErr) {
        setErr((loadErr instanceof Error ? loadErr.message : '刷新列表失败') + '（数据可能已写入，请手动刷新页面）');
      }
    } catch (er) {
      setMsg(null);
      setErr(er instanceof Error ? er.message : '网络错误，上传未完成');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="rounded-[10px] border border-ash bg-elevated p-4 shadow-subtle">
      <h3 className="text-sm font-semibold text-coal-ink">{title}</h3>
      <p className="mt-1 text-xs text-slate-mid">{description}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <a href={templateHref} download className="btn-ghost text-xs">
          {templateLabel}
        </a>
        <input ref={inputRef} type="file" accept={CSV_ACCEPT} className="hidden" onChange={(e) => void run(e)} />
        <button type="button" className="btn-primary text-xs" disabled={busy} onClick={openPicker}>
          {busy ? '导入中…' : action}
        </button>
      </div>
      <div className="mt-2 min-h-[2.5rem] text-sm">
        {msg ? <p className="text-coal-ink">{msg}</p> : null}
        {err ? <p className="text-red-600">{err}</p> : null}
      </div>

      {dailyPreview ? (
        <div className="mt-3 border-t border-ash/80 pt-3">
          <p className="text-xs font-semibold text-coal-ink">本次导入明细（样例，最多各 {dailyPreview.maxShown ?? 40} 条）</p>
          {dailyPreview.hasMore ? (
            <p className="mt-1 text-[11px] text-stone">尚有更多行未在下方列出，请以汇总数字为准或到表格中核对。</p>
          ) : null}
          <PreviewTable
            title="新增写入"
            rows={dailyPreview.createdRows ?? []}
            columns={[
              { key: 'date', label: '日期' },
              { key: 'staff', label: '客服' },
              { key: 'shop', label: '店铺' },
              { key: 'reception', label: '接待' },
              { key: 'aftersale', label: '售后' },
              { key: 'invalidInquiry', label: '无效' },
              { key: 'presale', label: '售前' },
              { key: 'deals', label: '成交' },
              { key: 'sales', label: '日销额' },
            ]}
          />
          <PreviewTable
            title="覆盖更新"
            rows={dailyPreview.updatedRows ?? []}
            columns={[
              { key: 'date', label: '日期' },
              { key: 'staff', label: '客服' },
              { key: 'shop', label: '店铺' },
              { key: 'reception', label: '接待' },
              { key: 'aftersale', label: '售后' },
              { key: 'invalidInquiry', label: '无效' },
              { key: 'presale', label: '售前' },
              { key: 'deals', label: '成交' },
              { key: 'sales', label: '日销额' },
            ]}
          />
        </div>
      ) : null}

      {followPreview ? (
        <div className="mt-3 border-t border-ash/80 pt-3">
          <p className="text-xs font-semibold text-coal-ink">本次导入明细（样例，每类最多 {followPreview.maxShown ?? 40} 条）</p>
          {followPreview.hasMore ? (
            <p className="mt-1 text-[11px] text-stone">尚有更多行未在下方列出，请以汇总数字为准或到询单转化列表中核对。</p>
          ) : null}
          <PreviewTable
            title="新建线索"
            rows={followPreview.leadsNew ?? []}
            columns={[
              { key: 'date', label: '日期' },
              { key: 'staff', label: '客服' },
              { key: 'shop', label: '店铺' },
              { key: 'buyerId', label: '旺旺' },
              { key: 'model', label: '型号' },
            ]}
          />
          <PreviewTable
            title="新建跟进（第 1 次）"
            rows={followPreview.followupsNew ?? []}
            columns={[
              { key: 'date', label: '日期' },
              { key: 'staff', label: '客服' },
              { key: 'buyerId', label: '旺旺' },
              { key: 'status', label: '状态' },
              {
                key: 'isDeal',
                label: '成交',
                fmt: (v) => (v === true || v === 'true' || v === 1 ? '是' : '否'),
              },
              {
                key: 'dealAmount',
                label: '金额',
                fmt: (v) => (v == null || v === '' ? '—' : String(v)),
              },
            ]}
          />
        </div>
      ) : null}

      {showDatabaseHint ? (
        <p className="mt-3 border-t border-ash/60 pt-2 text-[11px] leading-relaxed text-stone">
          说明：导入走服务器接口并写入数据库。本地预览需配置 <code className="rounded bg-ash px-1">DATABASE_URL</code>（如
          SQLite <code className="rounded bg-ash px-1">file:./prisma/dev.db</code>）并执行{' '}
          <code className="rounded bg-ash px-1">npx prisma migrate deploy</code>
          ；无可用数据库时页面仍可打开，但导入会失败。
        </p>
      ) : null}
    </div>
  );
}
