/**
 * Spread aged open AR/AP into forecast months by simple bucket → month index.
 * Buckets align with Accounting V2 aging labels.
 */

export const AGING_TO_MONTH_OFFSET = Object.freeze({
  current: 0,
  d1_30: 0,
  d31_60: 1,
  d61_90: 2,
  d91_120: 3,
  d120_plus: 3,
});

/**
 * @param {Array<{ bucket: string, minor: number }>} bucketTotals
 * @param {number} periodsCount
 * @returns {number[]} length = periodsCount, amounts in same unit as minor
 */
export function scheduleOpenBalancesByMonth(bucketTotals = [], periodsCount = 1) {
  const n = Math.max(1, Number(periodsCount) || 1);
  const months = Array.from({ length: n }, () => 0);
  for (const row of bucketTotals) {
    const amt = Number(row.minor) || 0;
    if (!amt) continue;
    const offset = AGING_TO_MONTH_OFFSET[row.bucket] ?? 0;
    const idx = Math.min(n - 1, Math.max(0, offset));
    months[idx] += amt;
  }
  return months.map((v) => Math.round(v));
}

export function totalScheduled(months) {
  return (months || []).reduce((s, v) => s + (Number(v) || 0), 0);
}
