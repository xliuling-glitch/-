/** 业务日 YYYY-MM-DD → 自然月 YYYY-MM */
export function yearMonthFromDate(dateStr: string): string {
  return dateStr.slice(0, 7);
}

export function monthStartDate(ym: string): string {
  return `${ym}-01`;
}

export function addCalendarDays(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function completionPct(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 10000) / 100;
}
