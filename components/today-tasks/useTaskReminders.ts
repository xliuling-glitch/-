'use client';

import { useEffect, useRef } from 'react';
import type { TaskInstance } from '@/lib/today-tasks/types';
import { computeStatus, isSatisfied, parseTodayEnd, parseTodayStart } from '@/lib/today-tasks/engine';

/** 开始前 5 分钟、结束后逾期各提醒一次（需通知权限；页面需保持打开） */
export function useTaskReminders(instances: TaskInstance[], enabled: boolean) {
  const startFired = useRef(new Set<string>());
  const overdueFired = useRef(new Set<string>());

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const tryNotify = (title: string, body: string) => {
      if (Notification.permission === 'granted') {
        new Notification(title, { body, tag: 'today-task' });
      }
    };

    const now = new Date();

    for (const inst of instances) {
      if (isSatisfied(inst.completionMode, inst.completion, inst.quantityTarget)) continue;

      const start = parseTodayStart(inst.date, inst.startTime);
      const remindAt = new Date(start.getTime() - 5 * 60 * 1000);
      if (remindAt > now && !startFired.current.has(inst.instanceKey)) {
        const delay = remindAt.getTime() - now.getTime();
        const t = setTimeout(() => {
          if (isSatisfied(inst.completionMode, inst.completion, inst.quantityTarget)) return;
          startFired.current.add(inst.instanceKey);
          tryNotify('任务即将开始', `${inst.title}（${inst.startTime}）`);
        }, delay);
        timers.push(t);
      }

      const end = parseTodayEnd(inst.date, inst.endTime, now);
      if (end > now) {
        const delay = end.getTime() - now.getTime() + 500;
        const t2 = setTimeout(() => {
          if (isSatisfied(inst.completionMode, inst.completion, inst.quantityTarget)) return;
          if (overdueFired.current.has(inst.instanceKey)) return;
          overdueFired.current.add(inst.instanceKey);
          const st = computeStatus(inst, new Date());
          if (st === 'overdue') {
            tryNotify('任务已逾期', `${inst.title} 已超结束时间 ${inst.endTime}`);
          }
        }, delay);
        timers.push(t2);
      }
    }

    return () => timers.forEach(clearTimeout);
  }, [instances, enabled]);
}

export function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return Promise.resolve('denied');
  if (Notification.permission === 'granted') return Promise.resolve('granted');
  return Notification.requestPermission();
}
