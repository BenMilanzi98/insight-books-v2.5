import prisma from './prisma';

const PERIOD_TYPES = ['Monthly', 'Yearly'];

/**
 * Financial period policy:
 * - **Yearly** periods follow each tenant's `TenantSettings.fiscalYearStartMonth` (default 1 = 1 Jan–31 Dec).
 * - Quarters remain calendar-based (Jan–Mar, etc.).
 * - **Monthly** periods are full calendar months (1st through last day).
 * - Payroll and reports use these boundaries where applicable.
 */
/** Default financial year anchor when fiscal month = January. */
const FINANCIAL_YEAR_START_MONTH = 0; // January
const FINANCIAL_YEAR_START_DAY = 1;

/**
 * Align a date to the start of the calendar year (1 January). Used for yearly accounting periods.
 * @param {Date|string} date - Any date in the year
 * @returns {Date} 1 January at 00:00:00 of that year
 */
export function startOfCalendarYear(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return new Date(new Date().getFullYear(), 0, 1);
  return new Date(d.getFullYear(), FINANCIAL_YEAR_START_MONTH, FINANCIAL_YEAR_START_DAY);
}

/**
 * End of calendar year (31 December) for a given date's year.
 * @param {Date|string} date - Any date in the year
 * @returns {Date} 31 December 23:59:59.999 of that year
 */
export function endOfCalendarYear(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) {
    const y = new Date().getFullYear();
    return new Date(y, 11, 31, 23, 59, 59, 999);
  }
  return new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999);
}

/**
 * First month of fiscal year (1–12) from TenantSettings; defaults to 1 (calendar year).
 * @param {string} tenantId
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} [tx]
 */
export async function getTenantFiscalYearStartMonth(tenantId, tx = prisma) {
  try {
    const row = await tx.tenantSettings.findUnique({
      where: { tenantId },
      select: { fiscalYearStartMonth: true },
    });
    const m = Number(row?.fiscalYearStartMonth);
    if (!Number.isFinite(m) || m < 1 || m > 12) return 1;
    return m;
  } catch {
    return 1;
  }
}

/**
 * Start of the financial year that contains `date` (00:00:00 local).
 * @param {Date|string} date
 * @param {number} fiscalStartMonth1to12 1 = January (same as calendar year)
 */
export function startOfFinancialYearForDate(date, fiscalStartMonth1to12) {
  const m = Number(fiscalStartMonth1to12);
  if (!Number.isFinite(m) || m < 1 || m > 12 || m === 1) {
    return startOfCalendarYear(date);
  }
  const d = date instanceof Date ? new Date(date) : new Date(date);
  if (Number.isNaN(d.getTime())) return startOfCalendarYear(new Date());
  const month = d.getMonth() + 1;
  const y = d.getFullYear();
  const startY = month >= m ? y : y - 1;
  return new Date(startY, m - 1, 1, 0, 0, 0, 0);
}

/**
 * Last instant of the financial year that contains `date`.
 * @param {Date|string} date
 * @param {number} fiscalStartMonth1to12
 */
export function endOfFinancialYearForDate(date, fiscalStartMonth1to12) {
  const m = Number(fiscalStartMonth1to12);
  if (!Number.isFinite(m) || m < 1 || m > 12 || m === 1) {
    return endOfCalendarYear(date);
  }
  const start = startOfFinancialYearForDate(date, m);
  const nextStart = new Date(start);
  nextStart.setFullYear(nextStart.getFullYear() + 1);
  return new Date(nextStart.getTime() - 1);
}

/**
 * Calendar quarter boundaries (aligned to 1 January start of year).
 * Q1 = Jan–Mar, Q2 = Apr–Jun, Q3 = Jul–Sep, Q4 = Oct–Dec.
 * @param {number} quarter - 1, 2, 3, or 4
 * @param {number} year - Full year (e.g. 2025)
 * @returns {{ start: Date, end: Date }} start at 00:00:00, end at 23:59:59.999
 */
export function getCalendarQuarterRange(quarter, year) {
  const q = Math.max(1, Math.min(4, Math.floor(quarter)));
  const y = Number(year) || new Date().getFullYear();
  const startMonth = (q - 1) * 3; // 0, 3, 6, 9
  const start = new Date(y, startMonth, 1, 0, 0, 0, 0);
  const end = new Date(y, startMonth + 3, 0, 23, 59, 59, 999); // last day of quarter
  return { start, end };
}

/**
 * Get quarter number (1–4) for a given date. Q1=Jan–Mar, Q2=Apr–Jun, Q3=Jul–Sep, Q4=Oct–Dec.
 */
export function getCalendarQuarter(date) {
  const d = date instanceof Date ? date : new Date(date);
  return Math.floor(d.getMonth() / 3) + 1;
}

export function normalizePeriodType(value) {
  if (!value) return 'Monthly';
  const normalized = value.toString().trim();
  if (normalized.toLowerCase() === 'monthly') return 'Monthly';
  if (normalized.toLowerCase() === 'yearly') return 'Yearly';
  return normalized;
}

export async function getCurrentPeriod(tenantId, tx = prisma, date = new Date()) {
  try {
    if (!tenantId) {
      return null;
    }
    
    // Ensure date is a valid Date object
    const queryDate = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(queryDate.getTime())) {
      console.warn('Invalid date provided to getCurrentPeriod, using current date');
      date = new Date();
    } else {
      date = queryDate;
    }
    
    return await tx.accountingPeriod.findFirst({
      where: {
        tenantId,
        status: 'open',
        startDate: { lte: date },
        endDate: { gte: date },
      },
      orderBy: { startDate: 'desc' },
    });
  } catch (error) {
    console.error('Error in getCurrentPeriod:', error);
    // Return null instead of throwing to allow the API to continue
    return null;
  }
}

export async function checkPeriodLock(tenantId, entryDate, tx = prisma) {
  if (!entryDate) return { isLocked: false };

  try {
    const lockedPeriod = await tx.accountingPeriod.findFirst({
      where: {
        tenantId,
        status: 'closed',
        startDate: { lte: entryDate },
        endDate: { gte: entryDate },
      },
      select: { id: true, name: true, startDate: true, endDate: true },
    });

    if (lockedPeriod) {
      return {
        isLocked: true,
        periodId: lockedPeriod.id,
        periodName: lockedPeriod.name,
        startDate: lockedPeriod.startDate,
        endDate: lockedPeriod.endDate,
        error: `Cannot post in closed accounting period: ${lockedPeriod.name}`,
      };
    }
  } catch (error) {
    // If accounting periods are not configured, allow posting.
  }

  return { isLocked: false };
}

export async function assertPeriodOpen(tenantId, entryDate, tx = prisma) {
  const lockCheck = await checkPeriodLock(tenantId, entryDate, tx);
  if (lockCheck.isLocked) {
    const error = new Error(lockCheck.error || 'Accounting period is locked.');
    error.code = 'PERIOD_LOCKED';
    error.period = lockCheck;
    throw error;
  }
}

export { PERIOD_TYPES };
