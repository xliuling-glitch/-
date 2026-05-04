'use client';

import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';

type Row = {
  id: number;
  date: string;
  type: string;
  screenshot: string | null;
  note: string | null;
  points: number | null;
  playCount: number | null;
};

export default function Page() {
  const today = new Date().toISOString().slice(0, 10);
  const [rows, setRows] = useState<Row[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState('朋友圈');
  const [note, setNote] = useState('');
  const [points, setPoints] = useState('');
  const [playCount, setPlayCount] = useState('');
  const [savingId, setSavingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const data = await (await fetch(`/api/social-media?date=${today}`)).json();
    setRows(data);
  }, [today]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    const fd = new FormData();
    if (file) fd.append('file', file);
    fd.append('type', type);
    fd.append('note', note);
    fd.append('userId', '1');
    if (points.trim() !== '') fd.append('points', points.trim());
    if (playCount.trim() !== '') fd.append('playCount', playCount.trim());
    await fetch('/api/social-media', { method: 'POST', body: fd });
    setFile(null);
    setNote('');
    setPoints('');
    setPlayCount('');
    load();
  };

  const patchMetrics = async (id: number, payload: { points?: number | null; playCount?: number | null; note?: string }) => {
    setSavingId(id);
    try {
      await fetch('/api/social-media', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...payload }),
      });
      await load();
    } finally {
      setSavingId(null);
    }
  };

  const remove = async (id: number) => {
    await fetch(`/api/social-media?id=${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-heading-sm font-bold tracking-tight text-[#1c1a17]">朋友圈 / 视频号</h2>
        <p className="mt-1 text-sm text-[#7e7d7b]">
          提交截图时可一并填写<strong className="font-semibold text-[#1c1a17]">点赞数</strong>（朋友圈）或
          <strong className="font-semibold text-[#1c1a17]">播放量</strong>（视频号）；提交后也可在卡片内修改更新。
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-[10px] border border-[#f1f1f1] bg-white p-4 shadow-[rgba(95,99,106,0.08)_0px_0px_0px_1px]">
        <label className="text-sm text-[#5a5957]">
          类型
          <select
            className="input-field mt-1 min-w-[120px]"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="朋友圈">朋友圈</option>
            <option value="视频号">视频号</option>
          </select>
        </label>
        <label className="min-w-[140px] flex-1 text-sm text-[#5a5957]">
          备注
          <input className="input-field mt-1" placeholder="可选" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <label className="w-28 text-sm text-[#5a5957]">
          点赞数
          <input
            className="input-field mt-1"
            type="number"
            min={0}
            placeholder="—"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
          />
        </label>
        <label className="w-32 text-sm text-[#5a5957]">
          播放量
          <input
            className="input-field mt-1"
            type="number"
            min={0}
            placeholder="—"
            value={playCount}
            onChange={(e) => setPlayCount(e.target.value)}
          />
        </label>
        <label className="text-sm text-[#5a5957]">
          截图
          <input type="file" accept="image/*" className="mt-1 block text-xs" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </label>
        <button type="button" className="btn-primary text-sm" onClick={submit}>
          提交
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {rows.map((r) => (
          <SocialCard
            key={r.id}
            row={r}
            saving={savingId === r.id}
            onPatch={patchMetrics}
            onRemove={() => remove(r.id)}
          />
        ))}
      </div>

      {rows.length === 0 ? <p className="text-sm text-[#969594]">今日暂无记录，请提交截图与数据。</p> : null}
    </div>
  );
}

function SocialCard({
  row,
  saving,
  onPatch,
  onRemove,
}: {
  row: Row;
  saving: boolean;
  onPatch: (id: number, p: { points?: number | null; playCount?: number | null; note?: string }) => void;
  onRemove: () => void;
}) {
  const [localPoints, setLocalPoints] = useState(row.points != null ? String(row.points) : '');
  const [localPlay, setLocalPlay] = useState(row.playCount != null ? String(row.playCount) : '');
  const [localNote, setLocalNote] = useState(row.note ?? '');

  useEffect(() => {
    setLocalPoints(row.points != null ? String(row.points) : '');
    setLocalPlay(row.playCount != null ? String(row.playCount) : '');
    setLocalNote(row.note ?? '');
  }, [row.id, row.points, row.playCount, row.note]);

  const save = () => {
    const parseNum = (s: string) => {
      const t = s.trim();
      if (t === '') return null as number | null;
      const n = Number(t);
      return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
    };
    onPatch(row.id, {
      points: parseNum(localPoints),
      playCount: parseNum(localPlay),
      note: localNote,
    });
  };

  return (
    <div className="rounded-[10px] border border-[#f1f1f1] bg-[#fafafa] p-3">
      <div className="flex items-start justify-between gap-2 text-sm">
        <span className="font-semibold text-[#1c1a17]">{row.type}</span>
        <span className="text-xs text-[#7e7d7b]">{new Date(row.date).toLocaleString('zh-CN')}</span>
      </div>

      {row.screenshot ? (
        <div className="relative mt-2 h-32 w-full overflow-hidden rounded-lg bg-[#f1f1f1]">
          <Image src={row.screenshot} alt="截图" fill className="object-cover" sizes="(max-width:768px) 100vw, 280px" />
        </div>
      ) : (
        <div className="mt-2 h-32 rounded-lg bg-[#f1f1f1]" />
      )}

      <div className="mt-3 space-y-2">
        <label className="block text-xs text-[#5a5957]">
          点赞数（朋友圈）
          <input
            className="input-field mt-0.5 py-1.5 text-sm"
            type="number"
            min={0}
            value={localPoints}
            onChange={(e) => setLocalPoints(e.target.value)}
          />
        </label>
        <label className="block text-xs text-[#5a5957]">
          播放量（视频号）
          <input
            className="input-field mt-0.5 py-1.5 text-sm"
            type="number"
            min={0}
            value={localPlay}
            onChange={(e) => setLocalPlay(e.target.value)}
          />
        </label>
        <label className="block text-xs text-[#5a5957]">
          备注
          <input className="input-field mt-0.5 py-1.5 text-sm" value={localNote} onChange={(e) => setLocalNote(e.target.value)} />
        </label>
        <div className="flex flex-wrap gap-2 pt-1">
          <button type="button" className="btn-primary flex-1 py-2 text-xs disabled:opacity-50" disabled={saving} onClick={save}>
            {saving ? '保存中…' : '更新数据'}
          </button>
          <button type="button" className="btn-ghost py-2 text-xs text-red-700 hover:border-red-200" onClick={onRemove}>
            删除
          </button>
        </div>
      </div>
    </div>
  );
}
