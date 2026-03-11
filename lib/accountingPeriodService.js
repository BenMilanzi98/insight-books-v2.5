import prisma from './prisma';

const PERIOD_TYPES = ['Monthly', 'Yearly'];

/** Financial year is calendar year: always starts 1 January, ends 31 December. */
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
