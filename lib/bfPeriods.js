/**
 * Period keys for Budget & Forecast: monthly (yyyy-MM), quarterly (yyyy-Qn), yearly (yyyy).
 */

function endOfUtcMonth(year, month0) {
  return new Date(Date.UTC(year, month0 + 1, 0, 23, 59, 59, 999));
}

function quarterFromMonth0(m) {
  return Math.floor(m / 3) + 1;
}

/** @param {Date} date */
export function dateToPeriodKey(date, periodType) {
  const d = new Date(date);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  if (periodType === 'yearly') {
    return String(y);
  }
  if (periodType === 'quarterly') {
    return `${y}-Q${quarterFromMonth0(m)}`;
  }
  const mm = String(m + 1).padStart(2, '0');
  return `${y}-${mm}`;
}

/**
 * Inclusive calendar range for a period key, UTC date boundaries.
 * @returns {{ start: Date, end: Date } | null}
 */
export function periodKeyToRange(periodKey, periodType) {
  if (periodType === 'yearly') {
    const y = parseInt(periodKey, 10);
    if (Number.isNaN(y)) return null;
    return {
      start: new Date(Date.UTC(y, 0, 1, 0, 0, 0, 0)),
      end: new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999)),
    };
  }
  if (periodType === 'quarterly') {
    const m = /^(\d{4})-Q([1-4])$/.exec(periodKey);
    if (!m) return null;
    const y = parseInt(m[1], 10);
    const q = parseInt(m[2], 10);
    const m0 = (q - 1) * 3;
    return {
      start: new Date(Date.UTC(y, m0, 1, 0, 0, 0, 0)),
      end: endOfUtcMonth(y, m0 + 2),
    };
  }
  const m = /^(\d{4})-(\d{2})$/.exec(periodKey);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10) - 1;
  if (mo < 0 || mo > 11) return null;
  return {
    start: new Date(Date.UTC(y, mo, 1, 0, 0, 0, 0)),
    end: endOfUtcMonth(y, mo),
  };
}

export function intersectRange(aStart, aEnd, bStart, bEnd) {
  const s = new Date(Math.max(aStart.getTime(), bStart.getTime()));
  const e = new Date(Math.min(aEnd.getTime(), bEnd.getTime()));
  if (s.getTime() > e.getTime()) return null;
  return { start: s, end: e };
}

/**
 * All period keys between header start/end for the given period type.
 * @param {Date|string} startDate
 * @param {Date|string} endDate
 */
export function listPeriodKeysInRange(startDate, endDate, periodType) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const keys = [];

  if (periodType === 'yearly') {
    for (let y = start.getUTCFullYear(); y <= end.getUTCFullYear(); y++) {
      keys.push(String(y));
    }
    return keys;
  }

  if (periodType === 'quarterly') {
    let y = start.getUTCFullYear();
    let q = quarterFromMonth0(start.getUTCMonth());
    const endY = end.getUTCFullYear();
    const endQ = quarterFromMonth0(end.getUTCMonth());
    for (;;) {
      keys.push(`${y}-Q${q}`);
      if (y === endY && q === endQ) break;
      q += 1;
      if (q > 4) {
        q = 1;
        y += 1;
      }
    }
    return keys;
  }

  let cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const endM = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  while (cur.getTime() <= endM.getTime()) {
    keys.push(dateToPeriodKey(cur, 'monthly'));
    cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1));
  }
  return keys;
}

export function assertPeriodKeyAllowed(periodKey, periodType, headerStart, headerEnd) {
  const allowed = new Set(listPeriodKeysInRange(headerStart, headerEnd, periodType));
  if (!allowed.has(periodKey)) {
    throw new Error(`Period "${periodKey}" is outside this plan's range or invalid for ${periodType}.`);
  }
}
