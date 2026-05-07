'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Card } from '@/components/ui';
import { cn } from '@/lib/utils';
import { computeDailyRequired } from '@/lib/daily-required/compute';
import type { DailyRequiredKey } from '@/lib/daily-required/types';
import { loadDailyRequiredAcks, upsertAck, saveDailyRequiredAcks } from '@/lib/daily-required/storage';
import { leadFollowQuery } from '@/lib/shift-sop/links';

function itemHref(key: DailyRequiredKey, date: string): string | undefined {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;
  switch (key) {
    case 'daily_inquiry':
      return leadFollowQuery('daily', d ? { date: d } : undefined);
    case 'lead_register':
      return leadFollowQuery('today', d ? { date: d } : undefined);
    case 'review_register':
      return '/dashboard/reviews';
    case 'douyin_call':
      return leadFollowQuery('douyin', d ? { date: d, add: '1' } : { add: '1' });
    case 'competitor_weekly':
    case 'data_summary':
      return '/dashboard/tasks';
    default:
      return undefined;
  }
}

export function DailyRequiredSection({ date, staff }: { date: string; staff: string }) {
  const [tick, setTick] = useState(0);
  const items = useMemo(() => computeDailyRequired(date, staff), [date, staff]);
  const acks = useMemo(
    () => loadDailyRequiredAcks().filter((a) => a.date === date && a.employeeName === staff),
    [date, staff, tick],
  );

  const ackDone = (key: DailyRequiredKey) => acks.find((a) => a.key === key)?.manualDone ?? false;

  const toggleAck = (key: DailyRequiredKey) => {
    const list = loadDailyRequiredAcks();
    const cur = ackDone(key);
    saveDailyRequiredAcks(upsertAck(list, { date, employeeName: staff, key, manualDone: !cur, remark: '' }));
    setTick((x) => x + 1);
  };

  if (!staff) return null;

  return (
    <Card className="border border-ash p-4">
      <h3 className="font-display text-base font-semibold text-coal-ink">结班必交项</h3>
      <p className="mt-1 text-xs text-slate-mid">系统自动根据登记数据判断；可勾选「已确认」作为补充记录。</p>
      <ul className="mt-3 space-y-2">
        {items.map((it) => {
          const manual = ackDone(it.key);
          const ok = it.done || manual;
          const href = itemHref(it.key, date);
          return (
            <li
              key={it.key}
              className={cn(
                'flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm',
                ok ? 'border-emerald-200 bg-emerald-50/50' : 'border-ash bg-white',
              )}
            >
              <div className="flex items-center gap-2">
                <span className={cn('h-2 w-2 shrink-0 rounded-full', ok ? 'bg-emerald-500' : 'bg-slate-300')} title={ok ? '已满足' : '待完成'} />
                <span className={cn(ok ? 'text-emerald-900' : 'text-coal-ink')}>{it.label}</span>
                {!it.done && !manual ? <span className="text-xs text-slate-mid">（未完成）</span> : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {href ? (
                  <Link href={href} className="text-xs text-sky-800 underline">
                    去填写
                  </Link>
                ) : null}
                <label className="flex items-center gap-1 text-xs text-graphite">
                  <input type="checkbox" checked={manual} onChange={() => toggleAck(it.key)} />
                  已确认
                </label>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
