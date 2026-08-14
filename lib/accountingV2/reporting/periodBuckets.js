/**
 * Build calendar month or quarter buckets covering [fromDate, toDate] inclusive.
 * Uses local date parts from the Date objects (report requests are calendar dates).
 *
 * @param {Date|null|undefined} fromDate
 * @param {Date|null|undefined} toDate
 * @param {'MONTH'|'QUARTER'} groupBy
 * @returns {Array<{ key: string, label: string, fromDate: Date, toDate: Date }>}
 */
export function buildPeriodBuckets(fromDate, toDate, groupBy = 'MONTH') {
  if (!(fromDate instanceof Date) || !(toDate instanceof Date)) return [];
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) return [];
  if (fromDate.getTime() > toDate.getTime()) return [];

  const mode = String(groupBy || 'MONTH').toUpperCase() === 'QUARTER' ? 'QUARTER' : 'MONTH';
  const buckets = [];

  if (mode === 'MONTH') {
    let y = fromDate.getFullYear();
    let m = fromDate.getMonth();
    const endY = toDate.getFullYear();
    const endM = toDate.getMonth();
    while (y < endY || (y === endY && m <= endM)) {
      const start = new Date(y, m, 1, 0, 0, 0, 0);
      const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
      const clippedFrom = start < fromDate ? new Date(fromDate) : start;
      const clippedTo = end > toDate ? new Date(toDate) : end;
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      const label = start.toLocaleString('en-US', { month: 'short', year: 'numeric' });
      buckets.push({ key, label, fromDate: clippedFrom, toDate: clippedTo });
      m += 1;
      if (m > 11) {
        m = 0;
        y += 1;
      }
    }
    return buckets;
  }

  // Quarters
  const qIndex = (d) => Math.floor(d.getMonth() / 3);
  let y = fromDate.getFullYear();
  let q = qIndex(fromDate);
  const endY = toDate.getFullYear();
  const endQ = qIndex(toDate);
  while (y < endY || (y === endY && q <= endQ)) {
    const startMonth = q * 3;
    const start = new Date(y, startMonth, 1, 0, 0, 0, 0);
    const end = new Date(y, startMonth + 3, 0, 23, 59, 59, 999);
    const clippedFrom = start < fromDate ? new Date(fromDate) : start;
    const clippedTo = end > toDate ? new Date(toDate) : end;
    const key = `${y}-Q${q + 1}`;
    const label = `Q${q + 1} ${y}`;
    buckets.push({ key, label, fromDate: clippedFrom, toDate: clippedTo });
    q += 1;
    if (q > 3) {
      q = 0;
      y += 1;
    }
  }
  return buckets;
}

/**
 * Assemble periodAmounts aligned to buckets from a map of periodKey → minor.
 * @param {string[]} periodKeys
 * @param {Map<string, number>|Record<string, number>} minorsByKey
 */
export function alignPeriodAmounts(periodKeys, minorsByKey) {
  const get =
    minorsByKey instanceof Map
      ? (k) => minorsByKey.get(k) ?? 0
      : (k) => minorsByKey[k] ?? 0;
  return periodKeys.map((key) => {
    const minor = Number(get(key)) || 0;
    return {
      key,
      amount: {
        minor,
        decimal: (minor / 100).toFixed(2),
      },
    };
  });
}
