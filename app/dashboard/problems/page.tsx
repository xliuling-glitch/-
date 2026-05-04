'use client';

import { useCallback, useEffect, useState } from 'react';

type LoadState = {
  date: string;
  staffName: string;
  username: string;
  todayIssues: string;
  tomorrowPlan: string;
  updatedAt: string | null;
};

type HistoryItem = {
  id: number;
  date: string;
  todayIssues: string;
  tomorrowPlan: string;
  updatedAt: string;
};

export default function Page() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [staffName, setStaffName] = useState('');
  const [username, setUsername] = useState('');
  const [todayIssues, setTodayIssues] = useState('');
  const [tomorrowPlan, setTomorrowPlan] = useState('');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const loadForm = useCallback(async (d: string) => {
    setAuthError('');
    setSaveMsg('');
    setLoading(true);
    const r = await fetch(`/api/daily-reflection?date=${encodeURIComponent(d)}`);
    if (r.status === 401) {
      setAuthError('请先登录后再填写复盘（登录账号即视为当前客服）。');
      setStaffName('');
      setLoading(false);
      return;
    }
    const data = (await r.json()) as LoadState;
    setStaffName(data.staffName);
    setUsername(data.username);
    setTodayIssues(data.todayIssues);
    setTomorrowPlan(data.tomorrowPlan);
    setUpdatedAt(data.updatedAt);
    setLoading(false);
  }, []);

  const loadHistory = useCallback(async () => {
    const r = await fetch('/api/daily-reflection?history=1&take=30');
    if (!r.ok) return;
    const d = await r.json();
    setHistory(d.items || []);
  }, []);

  useEffect(() => {
    void loadForm(date);
  }, [date, loadForm]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const save = async () => {
    setSaving(true);
    setSaveMsg('');
    const r = await fetch('/api/daily-reflection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, todayIssues, tomorrowPlan }),
    });
    setSaving(false);
    if (r.status === 401) {
      setAuthError('登录已失效，请重新登录。');
      return;
    }
    if (!r.ok) {
      setSaveMsg('保存失败，请稍后重试。');
      return;
    }
    const j = await r.json();
    setUpdatedAt(j.updatedAt ?? null);
    setSaveMsg('已保存');
    void loadHistory();
  };

  const applyHistoryRow = (item: HistoryItem) => {
    setDate(item.date);
    setTodayIssues(item.todayIssues);
    setTomorrowPlan(item.tomorrowPlan);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-coal-ink">问题复盘</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-mid">
          每位客服按业务日记录当日遇到的问题，以及对明天的思考与解决方案。日期默认当天，可按需调整；客服姓名取自当前登录账号。
        </p>
      </div>

      {authError ? (
        <p className="rounded-[10px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{authError}</p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4 rounded-[10px] border border-ash bg-elevated p-5 shadow-subtle">
          <div className="flex flex-wrap items-end gap-4">
            <label className="text-sm text-graphite">
              业务日期
              <input
                type="date"
                className="input-field mt-1 block min-w-[11rem]"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <div className="text-sm text-graphite">
              <span className="block text-xs font-medium uppercase tracking-wide text-stone">当前客服</span>
              <span className="mt-1 block font-semibold text-coal-ink">{loading ? '…' : staffName || '—'}</span>
              {username ? <span className="text-xs text-slate-mid">（{username}）</span> : null}
            </div>
            {updatedAt ? (
              <span className="text-xs text-slate-mid">上次保存：{new Date(updatedAt).toLocaleString('zh-CN')}</span>
            ) : null}
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-coal-ink">今天遇到的问题</span>
            <textarea
              className="input-field min-h-[140px] w-full resize-y py-2"
              value={todayIssues}
              onChange={(e) => setTodayIssues(e.target.value)}
              placeholder="记录今日接待、流程、协作或产品上遇到的卡点…"
              disabled={!!authError}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-coal-ink">对明天的思考与解决方案</span>
            <textarea
              className="input-field min-h-[140px] w-full resize-y py-2"
              value={tomorrowPlan}
              onChange={(e) => setTomorrowPlan(e.target.value)}
              placeholder="打算如何改进、需要谁配合、优先级如何…"
              disabled={!!authError}
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn-primary text-sm" disabled={!!authError || saving} onClick={() => void save()}>
              {saving ? '保存中…' : '保存'}
            </button>
            <button
              type="button"
              className="btn-ghost text-sm"
              onClick={() => {
                setDate(today);
                void loadForm(today);
              }}
            >
              切回今天
            </button>
            {saveMsg ? <span className="text-sm font-medium text-mint-pulse">{saveMsg}</span> : null}
          </div>
        </div>

        <aside className="rounded-[10px] border border-ash bg-ledger-white p-4">
          <h3 className="text-sm font-semibold text-coal-ink">我的近期复盘</h3>
          <p className="mt-1 text-xs text-slate-mid">点击一条可载入该日内容（改日期后仍可再保存）。</p>
          <ul className="mt-3 max-h-[min(52vh,480px)] space-y-2 overflow-y-auto text-sm">
            {history.length === 0 ? (
              <li className="text-stone">暂无记录，填写并保存后即出现在此。</li>
            ) : (
              history.map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    className="w-full rounded-lg border border-ash/80 bg-white px-3 py-2 text-left transition hover:border-graphite/30 hover:bg-parchment/50"
                    onClick={() => applyHistoryRow(h)}
                  >
                    <span className="font-medium text-coal-ink">{h.date}</span>
                    <span className="mt-0.5 block truncate text-xs text-slate-mid">
                      {h.todayIssues
                        ? h.todayIssues.length > 40
                          ? `${h.todayIssues.slice(0, 40)}…`
                          : h.todayIssues
                        : '（未填问题）'}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </aside>
      </div>
    </div>
  );
}
