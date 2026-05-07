import type { SopSlotTemplate, SopActionType } from './types';

/** 解析为当天从 0 点起的分钟数；24:00 → 1440 */
export function timeToMinutes(t: string): number {
  const s = t.trim();
  if (s === '24:00' || s === '24:00:00') return 1440;
  const [h, m = '0'] = s.split(':');
  const hh = Number(h);
  const mm = Number(m);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return 0;
  return Math.min(1440, hh * 60 + mm);
}

export function nowMinutes(d = new Date()): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function findCurrentSlot(slots: SopSlotTemplate[], d = new Date()): SopSlotTemplate | null {
  const now = nowMinutes(d);
  const ordered = [...slots].filter((s) => s.enabled).sort((a, b) => a.sort - b.sort || timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  for (const s of ordered) {
    const a = timeToMinutes(s.startTime);
    const b = timeToMinutes(s.endTime);
    if (b <= a && b < 1440) continue;
    const end = b > a ? b : b + 1440;
    const cur = now >= a && now < end;
    if (cur) return s;
  }
  return null;
}

/** 时段是否已完全结束（用于逾期判断） */
export function isSlotEnded(slot: SopSlotTemplate, d = new Date()): boolean {
  return nowMinutes(d) >= timeToMinutes(slot.endTime);
}

export function formatActionTypeLabel(t: SopActionType): string {
  const m: Record<SopActionType, string> = {
    required: '必做',
    guide: '指导',
    learning: '学习',
    jump: '跳转填写',
  };
  return m[t] ?? t;
}
