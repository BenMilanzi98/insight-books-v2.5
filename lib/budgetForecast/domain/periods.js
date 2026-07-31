/** Build monthly period windows between start and end (inclusive by month). */
export function buildMonthlyPeriods(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const periods = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const endMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  let guard = 0;
  while (cursor <= endMonth && guard < 120) {
    const y = cursor.getUTCFullYear();
    const m = cursor.getUTCMonth();
    const periodStart = new Date(Date.UTC(y, m, 1));
    const periodEnd = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999));
    periods.push({
      periodStart,
      periodEnd,
      monthNumber: m + 1,
      quarterNumber: Math.floor(m / 3) + 1,
      key: `${y}-${String(m + 1).padStart(2, '0')}`,
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    guard += 1;
  }
  return periods;
}

export function buildQuarterlyPeriods(startDate, endDate) {
  const months = buildMonthlyPeriods(startDate, endDate);
  const byQ = new Map();
  for (const p of months) {
    const key = `${p.periodStart.getUTCFullYear()}-Q${p.quarterNumber}`;
    if (!byQ.has(key)) {
      byQ.set(key, {
        key,
        periodStart: p.periodStart,
        periodEnd: p.periodEnd,
        quarterNumber: p.quarterNumber,
        monthNumber: null,
      });
    } else {
      const row = byQ.get(key);
      if (p.periodEnd > row.periodEnd) row.periodEnd = p.periodEnd;
    }
  }
  return [...byQ.values()];
}

/** Annual period keys covering each calendar year touched by the range. */
export function buildAnnualPeriods(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const periods = [];
  let y = start.getUTCFullYear();
  const endY = end.getUTCFullYear();
  while (y <= endY) {
    periods.push({
      key: String(y),
      periodStart: new Date(Date.UTC(y, 0, 1)),
      periodEnd: new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999)),
      monthNumber: null,
      quarterNumber: null,
    });
    y += 1;
  }
  return periods;
}

export function buildPeriods(frequency, startDate, endDate) {
  const f = String(frequency || 'MONTHLY').toUpperCase();
  if (f === 'QUARTERLY') return buildQuarterlyPeriods(startDate, endDate);
  if (f === 'ANNUAL' || f === 'YEARLY') return buildAnnualPeriods(startDate, endDate);
  return buildMonthlyPeriods(startDate, endDate);
}

export function spreadEvenly(annualMinor, periodCount) {
  const n = Math.max(1, periodCount);
  const base = Math.floor(annualMinor / n);
  const rem = annualMinor - base * n;
  return Array.from({ length: n }, (_, i) => base + (i === n - 1 ? rem : 0));
}

export function parsePeriodKey(key) {
  const s = String(key || '');
  const ym = /^(\d{4})-(\d{2})$/.exec(s);
  if (ym) {
    const y = Number(ym[1]);
    const m = Number(ym[2]) - 1;
    return {
      periodStart: new Date(Date.UTC(y, m, 1)),
      periodEnd: new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999)),
      monthNumber: m + 1,
      quarterNumber: Math.floor(m / 3) + 1,
      key: s,
    };
  }
  const yq = /^(\d{4})-Q([1-4])$/.exec(s);
  if (yq) {
    const y = Number(yq[1]);
    const q = Number(yq[2]);
    const m0 = (q - 1) * 3;
    return {
      periodStart: new Date(Date.UTC(y, m0, 1)),
      periodEnd: new Date(Date.UTC(y, m0 + 3, 0, 23, 59, 59, 999)),
      monthNumber: null,
      quarterNumber: q,
      key: s,
    };
  }
  const yy = /^(\d{4})$/.exec(s);
  if (yy) {
    const y = Number(yy[1]);
    return {
      periodStart: new Date(Date.UTC(y, 0, 1)),
      periodEnd: new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999)),
      monthNumber: null,
      quarterNumber: null,
      key: s,
    };
  }
  return null;
}
