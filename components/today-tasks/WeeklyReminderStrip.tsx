'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { Card } from '@/components/ui';
import { loadCompetitors } from '@/lib/daily-work-package/storage';
import { getWeekRange } from '@/lib/daily-work-package/storage';
import { competitorProgress } from '@/lib/daily-work-package/logic';

export function WeeklyReminderStrip({ date, staff }: { date: string; staff: string }) {
  const prog = useMemo(() => {
    if (!staff) return null;
    const week = getWeekRange(date);
    return competitorProgress(loadCompetitors(), week.start, week.end, staff);
  }, [date, staff]);

  if (!staff) return null;

  return (
    <Card className="border border-ash p-4">
      <h3 className="font-display text-base font-semibold text-coal-ink">本周任务提醒 · 竞品聊天</h3>
      {prog?.weeklyDone ? (
        <p className="mt-2 text-sm text-emerald-800">本周竞品任务已满足要求。</p>
      ) : (
        <p className="mt-2 text-sm text-amber-900">
          本周需至少 3 家店铺且三个方向各 1 家；当前已完成 {prog?.shopCount ?? 0} 家。请在展开的工作包中登记竞品聊天。
        </p>
      )}
      <Link href="/dashboard/tasks?expand=wp" className="mt-2 inline-block text-sm font-medium text-sky-800 underline">
        打开工作包竞品区（本页下方可展开）
      </Link>
    </Card>
  );
}
