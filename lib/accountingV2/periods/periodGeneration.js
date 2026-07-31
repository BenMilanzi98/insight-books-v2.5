/**
 * Phase 8 — automatic financial-year and monthly period generation.
 *
 * Pure functions over date-only UTC values (all canonical calendar dates are
 * stored at UTC midnight; start and end dates are inclusive). Real month
 * lengths are used throughout — never a fixed 30-day duration — so
 * 28/29/30/31-day months and leap years are correct by construction.
 */

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Date-only UTC construction (month is 1–12). */
export function utcDate(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day));
}

/** Normalize any date/ISO input to date-only UTC midnight. */
export function toDateOnly(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** ISO date (YYYY-MM-DD) for a date-only value. */
export function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

/** Days in a (year, month 1–12) — leap-year aware. */
export function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Compute the inclusive financial-year range starting (startYear, startMonth,
 * startDay) and spanning exactly twelve months. The end date is the day
 * before the same anchor one year later (leap-day safe: a 29 Feb start
 * clamps to 28 Feb in non-leap years, matching standard treatment).
 */
export function computeFinancialYearRange({ startYear, startMonth = 1, startDay = 1 }) {
  const clampedDay = Math.min(startDay, daysInMonth(startYear, startMonth));
  const startDate = utcDate(startYear, startMonth, clampedDay);
  const nextAnchorDay = Math.min(startDay, daysInMonth(startYear + 1, startMonth));
  const nextAnchor = utcDate(startYear + 1, startMonth, nextAnchorDay);
  const endDate = new Date(nextAnchor.getTime() - 24 * 60 * 60 * 1000);
  return { startDate, endDate };
}

/** Financial-year code, e.g. FY2026 (labelled by the starting year). */
export function financialYearCode(startDate) {
  return `FY${startDate.getUTCFullYear()}`;
}

/** Financial-year display name, e.g. "FY2026 (Jul 2026 – Jun 2027)". */
export function financialYearName(startDate, endDate) {
  const s = `${MONTH_NAMES[startDate.getUTCMonth()].slice(0, 3)} ${startDate.getUTCFullYear()}`;
  const e = `${MONTH_NAMES[endDate.getUTCMonth()].slice(0, 3)} ${endDate.getUTCFullYear()}`;
  return `${financialYearCode(startDate)} (${s} – ${e})`;
}

/**
 * Generate the twelve monthly periods for a financial year.
 *
 * With a day-1 anchor, periods are exact calendar months. With a mid-month
 * anchor day D, each period runs from day D (clamped to the month's length)
 * to the day before the next month's anchor.
 *
 * @param {{fyCode: string, startDate: Date, endDate: Date}} fy
 * @returns {Array<{periodNumber:number, sequence:number, name:string, code:string, startDate:Date, endDate:Date}>}
 */
export function generateMonthlyPeriods(fy) {
  const periods = [];
  const anchorDay = fy.startDate.getUTCDate();
  let cursor = new Date(fy.startDate.getTime());

  for (let n = 1; n <= 12; n += 1) {
    const y = cursor.getUTCFullYear();
    const m = cursor.getUTCMonth() + 1;
    const nextY = m === 12 ? y + 1 : y;
    const nextM = m === 12 ? 1 : m + 1;
    const nextStartDay = Math.min(anchorDay, daysInMonth(nextY, nextM));
    const nextStart = n === 12
      ? new Date(fy.endDate.getTime() + 24 * 60 * 60 * 1000)
      : utcDate(nextY, nextM, nextStartDay);
    const endDate = new Date(nextStart.getTime() - 24 * 60 * 60 * 1000);

    periods.push({
      periodNumber: n,
      sequence: n,
      name: `${MONTH_NAMES[m - 1]} ${y}`,
      code: `${fy.fyCode}-P${String(n).padStart(2, '0')}`,
      startDate: new Date(cursor.getTime()),
      endDate,
    });
    cursor = nextStart;
  }
  return periods;
}

/**
 * Validate that generated periods exactly cover the financial year with no
 * gaps, no overlaps, deterministic numbering and no dates outside the year.
 * @returns {string[]} issue descriptions (empty = valid)
 */
export function validatePeriodCoverage(fy, periods) {
  const issues = [];
  const sorted = [...periods].sort((a, b) => a.periodNumber - b.periodNumber);
  if (sorted.length === 0) return ['Financial year has no periods.'];

  if (sorted[0].startDate.getTime() !== fy.startDate.getTime()) {
    issues.push('First period does not start on the financial-year start date.');
  }
  if (sorted[sorted.length - 1].endDate.getTime() !== fy.endDate.getTime()) {
    issues.push('Final period does not end on the financial-year end date.');
  }
  const seen = new Set();
  for (let i = 0; i < sorted.length; i += 1) {
    const p = sorted[i];
    if (seen.has(p.periodNumber)) issues.push(`Duplicate period number ${p.periodNumber}.`);
    seen.add(p.periodNumber);
    if (p.startDate.getTime() > p.endDate.getTime()) {
      issues.push(`Period ${p.periodNumber} starts after it ends.`);
    }
    if (p.startDate < fy.startDate || p.endDate > fy.endDate) {
      issues.push(`Period ${p.periodNumber} lies outside the financial year.`);
    }
    if (i > 0) {
      const prev = sorted[i - 1];
      const expectedStart = prev.endDate.getTime() + 24 * 60 * 60 * 1000;
      if (p.startDate.getTime() > expectedStart) {
        issues.push(`Gap between period ${prev.periodNumber} and ${p.periodNumber}.`);
      }
      if (p.startDate.getTime() < expectedStart) {
        issues.push(`Overlap between period ${prev.periodNumber} and ${p.periodNumber}.`);
      }
    }
  }
  return issues;
}
