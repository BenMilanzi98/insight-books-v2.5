/**
 * Phase 8 — canonical financial-year creation and lifecycle.
 *
 * Workflow (§10): preview → validate → atomic create (year + all twelve
 * periods, or nothing) → open. Deleting a financial year is not exposed by
 * any V2 service; years with journals can never be removed.
 */

import { AccountingValidationError, InvalidAccountingPeriodError } from '../domain/errors.js';
import { recordAccountingAudit } from '../infrastructure/auditTrail.js';
import { getCalendarConfig } from './calendarConfigService.js';
import {
  computeFinancialYearRange,
  financialYearCode,
  financialYearName,
  generateMonthlyPeriods,
  validatePeriodCoverage,
  toDateOnly,
} from './periodGeneration.js';
import { FinancialYearStatus, AccountingPeriodStatus, PeriodStatusAction } from './periodEnums.js';

const ids = (context) => ({ requestId: context.requestId, correlationId: context.correlationId });

/**
 * Preview a financial year and its generated periods without writing.
 * @param {number} startYear the calendar year the financial year starts in
 */
export async function previewFinancialYear(db, context, { startYear }) {
  const config = await getCalendarConfig(db, context);
  const year = Number(startYear);
  if (!Number.isInteger(year) || year < 1990 || year > 2200) {
    throw new AccountingValidationError('startYear must be a plausible calendar year.', ids(context));
  }
  const range = computeFinancialYearRange({
    startYear: year,
    startMonth: config.fyStartMonth,
    startDay: config.fyStartDay,
  });
  const fyCode = financialYearCode(range.startDate);
  const periods = generateMonthlyPeriods({ fyCode, ...range });
  const coverageIssues = validatePeriodCoverage(range, periods);

  const overlapping = await db.acctV2FinancialYear.findFirst({
    where: {
      tenantId: context.businessId,
      startDate: { lte: range.endDate },
      endDate: { gte: range.startDate },
    },
    select: { id: true, code: true, startDate: true, endDate: true },
  });

  return {
    financialYear: {
      code: fyCode,
      name: financialYearName(range.startDate, range.endDate),
      startDate: range.startDate,
      endDate: range.endDate,
      numberOfPeriods: periods.length,
      periodFrequency: 'MONTHLY',
    },
    periods,
    issues: [
      ...coverageIssues,
      ...(overlapping ? [`Overlaps existing financial year ${overlapping.code}.`] : []),
    ],
    config: { fyStartMonth: config.fyStartMonth, fyStartDay: config.fyStartDay, timezone: config.timezone },
  };
}

/**
 * Atomically create a financial year with all its monthly periods (DRAFT).
 * Nothing is written when any validation fails.
 */
export async function createFinancialYear(db, context, { startYear }) {
  const preview = await previewFinancialYear(db, context, { startYear });
  if (preview.issues.length > 0) {
    throw new AccountingValidationError(
      `Financial year cannot be created: ${preview.issues.join(' ')}`,
      ids(context)
    );
  }

  const created = await db.$transaction(async (tx) => {
    const fy = await tx.acctV2FinancialYear.create({
      data: {
        tenantId: context.businessId,
        name: preview.financialYear.name,
        code: preview.financialYear.code,
        startDate: preview.financialYear.startDate,
        endDate: preview.financialYear.endDate,
        numberOfPeriods: preview.periods.length,
        periodFrequency: 'MONTHLY',
        status: FinancialYearStatus.DRAFT,
        createdBy: context.userId,
      },
    });
    const periods = [];
    for (const p of preview.periods) {
      periods.push(
        await tx.acctV2AccountingPeriod.create({
          data: {
            tenantId: context.businessId,
            financialYearId: fy.id,
            periodNumber: p.periodNumber,
            sequence: p.sequence,
            name: p.name,
            code: p.code,
            startDate: p.startDate,
            endDate: p.endDate,
            status: AccountingPeriodStatus.DRAFT,
            isAdjustmentPeriod: false,
            isYearEndPeriod: p.periodNumber === preview.periods.length,
            createdBy: context.userId,
          },
        })
      );
    }
    // Post-creation coverage re-validation: any defect rolls the whole year back.
    const issues = validatePeriodCoverage(fy, periods);
    if (issues.length > 0) {
      throw new AccountingValidationError(`Period generation failed validation: ${issues.join(' ')}`, ids(context));
    }
    await tx.acctV2PeriodStatusHistory.create({
      data: {
        tenantId: context.businessId,
        financialYearId: fy.id,
        previousStatus: null,
        newStatus: FinancialYearStatus.DRAFT,
        action: PeriodStatusAction.CREATE,
        executedBy: context.userId,
        requestId: context.requestId ?? null,
        correlationId: context.correlationId ?? null,
        metadata: { periodCount: periods.length },
      },
    });
    return { financialYear: fy, periods };
  });

  await recordAccountingAudit(
    {
      action: 'acctv2.financialYear.create',
      entityType: 'AcctV2FinancialYear',
      entityId: created.financialYear.id,
      userId: context.userId,
      tenantId: context.businessId,
      newValues: { code: created.financialYear.code, periods: created.periods.length },
      requestId: context.requestId,
      correlationId: context.correlationId,
    },
    db
  );
  return created;
}

/**
 * Open a DRAFT financial year: year → OPEN, all DRAFT periods → OPEN, and
 * the year becomes the business's single current year.
 */
export async function openFinancialYear(db, context, financialYearId) {
  const fy = await db.acctV2FinancialYear.findFirst({
    where: { id: financialYearId, tenantId: context.businessId },
  });
  if (!fy) throw new InvalidAccountingPeriodError('Financial year not found for this business.', ids(context));
  if (fy.status !== FinancialYearStatus.DRAFT) {
    throw new AccountingValidationError(`Only DRAFT financial years can be opened (current: ${fy.status}).`, ids(context));
  }

  const result = await db.$transaction(async (tx) => {
    const others = await tx.acctV2FinancialYear.findMany({
      where: { tenantId: context.businessId, isCurrent: true },
      select: { id: true },
    });
    for (const other of others) {
      await tx.acctV2FinancialYear.update({ where: { id: other.id }, data: { isCurrent: false } });
    }
    const opened = await tx.acctV2FinancialYear.update({
      where: { id: fy.id },
      data: { status: FinancialYearStatus.OPEN, isCurrent: true, openedAt: new Date(), approvedBy: context.userId },
    });
    const periods = await tx.acctV2AccountingPeriod.findMany({
      where: { financialYearId: fy.id, tenantId: context.businessId, status: AccountingPeriodStatus.DRAFT },
    });
    for (const p of periods) {
      await tx.acctV2AccountingPeriod.update({ where: { id: p.id }, data: { status: AccountingPeriodStatus.OPEN } });
      await tx.acctV2PeriodStatusHistory.create({
        data: {
          tenantId: context.businessId,
          financialYearId: fy.id,
          accountingPeriodId: p.id,
          previousStatus: AccountingPeriodStatus.DRAFT,
          newStatus: AccountingPeriodStatus.OPEN,
          action: PeriodStatusAction.OPEN,
          executedBy: context.userId,
          requestId: context.requestId ?? null,
          correlationId: context.correlationId ?? null,
        },
      });
    }
    await tx.acctV2PeriodStatusHistory.create({
      data: {
        tenantId: context.businessId,
        financialYearId: fy.id,
        previousStatus: FinancialYearStatus.DRAFT,
        newStatus: FinancialYearStatus.OPEN,
        action: PeriodStatusAction.OPEN,
        executedBy: context.userId,
        requestId: context.requestId ?? null,
        correlationId: context.correlationId ?? null,
      },
    });
    return opened;
  });

  await recordAccountingAudit(
    {
      action: 'acctv2.financialYear.open',
      entityType: 'AcctV2FinancialYear',
      entityId: fy.id,
      userId: context.userId,
      tenantId: context.businessId,
      newValues: { status: FinancialYearStatus.OPEN, isCurrent: true },
      requestId: context.requestId,
      correlationId: context.correlationId,
    },
    db
  );
  return result;
}

/** List financial years for the business (most recent first). */
export async function listFinancialYears(db, context) {
  return db.acctV2FinancialYear.findMany({
    where: { tenantId: context.businessId },
    orderBy: { startDate: 'desc' },
  });
}

/** Get one financial year with its periods, business-scoped. */
export async function getFinancialYear(db, context, financialYearId) {
  const fy = await db.acctV2FinancialYear.findFirst({
    where: { id: financialYearId, tenantId: context.businessId },
  });
  if (!fy) throw new InvalidAccountingPeriodError('Financial year not found for this business.', ids(context));
  const periods = await db.acctV2AccountingPeriod.findMany({
    where: { financialYearId: fy.id, tenantId: context.businessId },
    orderBy: { periodNumber: 'asc' },
  });
  return { financialYear: fy, periods };
}

/**
 * Guard used before any destructive operation: a financial year with posted
 * journals may never be deleted. (No delete API exists; this documents and
 * enforces the invariant for future callers.)
 */
export async function assertFinancialYearDeletable(db, context, financialYear) {
  const journalCount = await db.transaction.count({
    where: {
      tenantId: context.businessId,
      status: 'posted',
      date: { gte: toDateOnly(financialYear.startDate), lte: toDateOnly(financialYear.endDate) },
    },
  });
  if (journalCount > 0) {
    throw new AccountingValidationError(
      `Financial year ${financialYear.code} has ${journalCount} posted journals and cannot be deleted.`,
      ids(context)
    );
  }
}
