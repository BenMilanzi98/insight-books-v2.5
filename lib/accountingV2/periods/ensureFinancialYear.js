/**
 * Ensure an OPEN financial year covers a posting date for a tenant.
 * Defaults: calendar year Jan 1 – Dec 31 (fyStartMonth=1, fyStartDay=1).
 * Tenants customize via TenantSettings.fiscalYearStartMonth and/or
 * AcctV2FinancialCalendarConfig (Financial Calendar V2).
 */

import prisma from '../../prisma.js';
import { createAccountingContext } from '../domain/accountingContext.js';
import { AccountingValidationError } from '../domain/errors.js';
import { getCalendarConfig, CALENDAR_CONFIG_DEFAULTS } from './calendarConfigService.js';
import { createFinancialYear, openFinancialYear } from './financialYearService.js';
import { computeFinancialYearRange, toDateOnly } from './periodGeneration.js';
import { FinancialYearStatus } from './periodEnums.js';

/**
 * Prefer a client that can start `$transaction`. Interactive tx clients from
 * `prisma.$transaction` (e.g. sale create) do not expose `$transaction`.
 */
function writeClient(db) {
  return typeof db?.$transaction === 'function' ? db : prisma;
}

/**
 * Calendar year in which the financial year covering `date` starts.
 * @param {Date|string} date
 * @param {number} fyStartMonth 1–12
 * @param {number} [fyStartDay=1]
 */
export function financialYearStartYearForDate(date, fyStartMonth = 1, fyStartDay = 1) {
  const d = toDateOnly(date);
  if (!d) throw new RangeError('Invalid date for financial year resolution.');
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const month = Number(fyStartMonth) || 1;
  const startDay = Number(fyStartDay) || 1;
  if (m < month || (m === month && day < startDay)) return y - 1;
  return y;
}

/**
 * Align AcctV2FinancialCalendarConfig with TenantSettings.fiscalYearStartMonth
 * when the tenant has set a custom month and no conflicting persisted override
 * is required. Creates the config row with defaults (Jan 1) if missing.
 */
export async function ensureCalendarConfigForTenant(db, context) {
  let settingsMonth = null;
  try {
    const settings = await db.tenantSettings.findUnique({
      where: { tenantId: context.businessId },
      select: { fiscalYearStartMonth: true },
    });
    const m = Number(settings?.fiscalYearStartMonth);
    if (Number.isInteger(m) && m >= 1 && m <= 12) settingsMonth = m;
  } catch {
    // TenantSettings may be incomplete on older DBs.
  }

  const existing = await db.acctV2FinancialCalendarConfig.findUnique({
    where: { tenantId: context.businessId },
  });

  if (!existing) {
    const fyStartMonth = settingsMonth ?? CALENDAR_CONFIG_DEFAULTS.fyStartMonth;
    await db.acctV2FinancialCalendarConfig.create({
      data: {
        tenantId: context.businessId,
        ...CALENDAR_CONFIG_DEFAULTS,
        fyStartMonth,
        createdBy: context.userId,
        updatedBy: context.userId,
      },
    });
  }

  return getCalendarConfig(db, context);
}

/**
 * Ensure an OPEN AcctV2FinancialYear (with monthly periods) covers postingDate.
 * Safe for concurrent callers (unique on tenantId+code).
 *
 * @param {object} db
 * @param {{ tenantId: string, userId?: string|null, postingDate?: Date|string|null, requestId?: string, correlationId?: string }} args
 */
export async function ensureOpenFinancialYearForDate(db, args) {
  const tenantId = args?.tenantId;
  if (!tenantId) throw new AccountingValidationError('tenantId is required to ensure a financial year.');

  const userId = args.userId || 'system';
  const context = createAccountingContext({
    businessId: tenantId,
    userId,
    permissions: [],
    sourceChannel: 'system',
    requestId: args.requestId,
    correlationId: args.correlationId,
  });

  const writer = writeClient(db);
  await ensureCalendarConfigForTenant(writer, context);
  const config = await getCalendarConfig(writer, context);
  const postingDate = toDateOnly(args.postingDate || new Date());
  const startYear = financialYearStartYearForDate(
    postingDate,
    config.fyStartMonth,
    config.fyStartDay
  );

  const findCovering = () =>
    writer.acctV2FinancialYear.findMany({
      where: {
        tenantId,
        startDate: { lte: postingDate },
        endDate: { gte: postingDate },
      },
      orderBy: { startDate: 'desc' },
    });

  let years = await findCovering();
  if (years.length > 1) {
    throw new AccountingValidationError(
      `Overlapping financial years cover ${postingDate.toISOString().slice(0, 10)} (${years.map((y) => y.code).join(', ')}).`
    );
  }

  if (years.length === 1) {
    const fy = years[0];
    if (fy.status === FinancialYearStatus.DRAFT) {
      await openFinancialYear(writer, context, fy.id);
      return writer.acctV2FinancialYear.findFirst({ where: { id: fy.id, tenantId } });
    }
    if (fy.status === FinancialYearStatus.CLOSED || fy.status === FinancialYearStatus.ARCHIVED) {
      return fy;
    }
    return fy;
  }

  // No covering year — create + open for this fiscal start year.
  try {
    const created = await createFinancialYear(writer, context, { startYear });
    await openFinancialYear(writer, context, created.financialYear.id);
    return created.financialYear;
  } catch (error) {
    // Concurrent create or overlap race — re-read covering years.
    years = await findCovering();
    if (years.length === 1) {
      const fy = years[0];
      if (fy.status === FinancialYearStatus.DRAFT) {
        await openFinancialYear(writer, context, fy.id);
        return writer.acctV2FinancialYear.findFirst({ where: { id: fy.id, tenantId } });
      }
      return fy;
    }
    // Maybe FY exists but dates don't cover due to custom calendar — try by code.
    const range = computeFinancialYearRange({
      startYear,
      startMonth: config.fyStartMonth,
      startDay: config.fyStartDay,
    });
    const byCode = await writer.acctV2FinancialYear.findFirst({
      where: { tenantId, code: `FY${range.startDate.getUTCFullYear()}` },
    });
    if (byCode) {
      if (byCode.status === FinancialYearStatus.DRAFT) {
        await openFinancialYear(writer, context, byCode.id);
      }
      return byCode;
    }
    throw error;
  }
}

/**
 * Provision current (and optionally next) open financial year for a new tenant.
 */
export async function provisionTenantFinancialCalendar(db, { tenantId, userId, asOfDate } = {}) {
  return ensureOpenFinancialYearForDate(db, {
    tenantId,
    userId,
    postingDate: asOfDate || new Date(),
  });
}
