/**
 * 金额展示：中文千分位 +「元」，不使用 k/K 等缩写。
 */
export function formatAmountYuan(n: number, maximumFractionDigits: number = 2): string {
  const x = Number(n);
  if (!Number.isFinite(x)) return '—';
  return `${x.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits })}元`;
}
