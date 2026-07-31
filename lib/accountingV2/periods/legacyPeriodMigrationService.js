/**
 * Phase 8 — legacy period migration (§57).
 *
 * Stage 1 (preview): inventory legacy `AccountingPeeriod` rows and journal
 * assignments; detect overlaps/gaps/cross-business references; propose the
 * canonical calendar. Stage 2/3 (execute): create canonical years + periods,
 * alias legacy monthly periods (`legacyPeriodId`), carry forward CLOSED
 * status with history, and assign canonical period references to posted V2
 * journals from their POSTING dates — only where exactly one canonical
 * period covers the date. Dates and amounts are never modified; nothing is
 * deleted; unresolved rows remain exceptions.
 */

import { AccountingValidationError } from '../domain/errors.js';
import { recordAccountingAudit } from '../infrastructure/auditTrail.js';
import { getCalendarConfig } from './calendarConfigService.js';
import {
  computeFinancialYearRange,
  financialYearCode,
  financialYearName,
  generateMonthlyPeriods,
  toDateOnly,
  isoDate,
} from './periodGeneration.js';
import { AccountingPeriodStatus, FinancialYearStatus, PeriodStatusAction } from './periodEnums.js';

const ids = (context) => ({ requestId: context.requestId, correlationId: context.correlationId });
const DAY = 24 * 60 * 60 * 1000;

/** The financial-year start year (per config anchor) containing a date. */
function fyStartYearFor(date, fyStartMonth, fyStartDay) {
  const d = toDateOnly(date);
  const anchorThisYear = computeFinancialYearRange({
    startYear: d.getUTCFullYear(),
    startMonth: fyStartMonth,
    startDay: fyStartDay,
  });
  return d >= anchorThisYear.startDate ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
}

/**
 * Stage 1 — read-only inventory and proposal.
 */
export async function previewLegacyPeriodMigration(db, context, { now = new Date() } = {}) {
  const config = await getCalendarConfig(db, context);
  const legacyPeriods = await db.accountingPeriod.findMany({
    where: { tenantId: context.businessId },
    orderBy: { startDate: 'asc' },
  });
  const monthly = legacyPeriods.filter((p) => p.periodType === 'Monthly');
  const yearly = legacyPeriods.filter((p) => p.periodType === 'Yearly');

  // Overlaps among monthly rows (Yearly rows overlap Monthly by legacy design
  // and are treated as aliases, not calendar authorities).
  const overlaps = [];
  for (let i = 1; i < monthly.length; i += 1) {
    if (toDateOnly(monthly[i].startDate) <= toDateOnly(monthly[i - 1].endDate)) {
      overlaps.push({ a: monthly[i - 1].id, b: monthly[i].id });
    }
  }
  const gaps = [];
  for (let i = 1; i < monthly.length; i += 1) {
    const expected = toDateOnly(monthly[i - 1].endDate).getTime() + DAY;
    if (toDateOnly(monthly[i].startDate).getTime() > expected) {
      gaps.push({ after: monthly[i - 1].id, before: monthly[i].id });
    }
  }

  // Posted journals without a canonical period reference.
  const unassignedJournals = await db.journalEntry.count({
    where: { tenantId: context.businessId, status: { in: ['POSTED', 'Posted'] }, accountingPeriodId: null },
  });
  const earliestJournal = await db.journalEntry.findFirst({
    where: { tenantId: context.businessId, status: { in: ['POSTED', 'Posted'] } },
    orderBy: { entryDate: 'asc' },
  });
  const latestJournal = await db.journalEntry.findFirst({
    where: { tenantId: context.businessId, status: { in: ['POSTED', 'Posted'] } },
    orderBy: { entryDate: 'desc' },
  });

  // Proposed canonical year range: cover legacy periods AND journal dates AND today.
  const anchors = [
    ...legacyPeriods.map((p) => p.startDate),
    ...(earliestJournal ? [earliestJournal.entryDate] : []),
    now,
  ].filter(Boolean);
  const ends = [
    ...legacyPeriods.map((p) => p.endDate),
    ...(latestJournal ? [latestJournal.entryDate] : []),
    now,
  ].filter(Boolean);
  const minDate = new Date(Math.min(...anchors.map((d) => toDateOnly(d).getTime())));
  const maxDate = new Date(Math.max(...ends.map((d) => toDateOnly(d).getTime())));
  const firstFyYear = fyStartYearFor(minDate, config.fyStartMonth, config.fyStartDay);
  const lastFyYear = fyStartYearFor(maxDate, config.fyStartMonth, config.fyStartDay);

  const proposedYears = [];
  for (let year = firstFyYear; year <= lastFyYear; year += 1) {
    const range = computeFinancialYearRange({ startYear: year, startMonth: config.fyStartMonth, startDay: config.fyStartDay });
    proposedYears.push({ code: financialYearCode(range.startDate), startDate: isoDate(range.startDate), endDate: isoDate(range.endDate) });
  }

  const existingCanonical = await db.acctV2FinancialYear.count({ where: { tenantId: context.businessId } });

  return {
    businessId: context.businessId,
    legacy: {
      totalPeriods: legacyPeriods.length,
      monthlyPeriods: monthly.length,
      yearlyPeriods: yearly.length,
      closedPeriods: legacyPeriods.filter((p) => String(p.status).toLowerCase() === 'closed').length,
      overlaps,
      gaps,
    },
    journals: {
      unassignedPosted: unassignedJournals,
      earliestDate: earliestJournal ? isoDate(toDateOnly(earliestJournal.entryDate)) : null,
      latestDate: latestJournal ? isoDate(toDateOnly(latestJournal.entryDate)) : null,
    },
    proposal: { financialYears: proposedYears, existingCanonicalYears: existingCanonical },
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Stages 2–3 — execute the migration for one business. Idempotent: existing
 * canonical years are kept; journal assignment only fills NULL references.
 * @param {{dryRun?: boolean, now?: Date}} [options]
 */
export async function executeLegacyPeriodMigration(db, context, { dryRun = false, now = new Date() } = {}) {
  const preview = await previewLegacyPeriodMigration(db, context, { now });
  if (dryRun) return { dryRun: true, preview, created: [], assignedJournals: 0 };

  const config = await getCalendarConfig(db, context);
  const legacyMonthly = await db.accountingPeriod.findMany({
    where: { tenantId: context.businessId, periodType: 'Monthly' },
  });
  const created = [];
  let mappedLegacy = 0;
  let carriedClosed = 0;

  for (const fyProposal of preview.proposal.financialYears) {
    const existing = await db.acctV2FinancialYear.findFirst({
      where: { tenantId: context.businessId, code: fyProposal.code },
    });
    if (existing) continue;

    const range = { startDate: toDateOnly(fyProposal.startDate), endDate: toDateOnly(fyProposal.endDate) };
    const fyCode = fyProposal.code;
    const periods = generateMonthlyPeriods({ fyCode, ...range });
    const today = toDateOnly(now);
    const isCurrent = range.startDate <= today && range.endDate >= today;

    // Atomic per-year creation: the year, its periods, aliases and history
    // commit together or not at all.
    const result = await db.$transaction(async (tx) => {
      const fy = await tx.acctV2FinancialYear.create({
        data: {
          tenantId: context.businessId,
          name: financialYearName(range.startDate, range.endDate),
          code: fyCode,
          startDate: range.startDate,
          endDate: range.endDate,
          numberOfPeriods: periods.length,
          status: FinancialYearStatus.OPEN,
          isCurrent,
          openedAt: new Date(),
          createdBy: context.userId,
          metadata: { migratedFromLegacy: true },
        },
      });
      let closedInYear = 0;
      let mappedInYear = 0;
      for (const p of periods) {
        // Alias: the single legacy monthly period covering this canonical month.
        const matches = legacyMonthly.filter(
          (lp) =>
            toDateOnly(lp.startDate) <= p.endDate &&
            toDateOnly(lp.endDate) >= p.startDate
        );
        const alias = matches.length === 1 ? matches[0] : null;
        const legacyClosed = alias && String(alias.status).toLowerCase() === 'closed';
        if (alias) mappedInYear += 1;
        if (legacyClosed) closedInYear += 1;

        const periodRow = await tx.acctV2AccountingPeriod.create({
          data: {
            tenantId: context.businessId,
            financialYearId: fy.id,
            periodNumber: p.periodNumber,
            sequence: p.sequence,
            name: p.name,
            code: p.code,
            startDate: p.startDate,
            endDate: p.endDate,
            status: legacyClosed ? AccountingPeriodStatus.CLOSED : AccountingPeriodStatus.OPEN,
            isAdjustmentPeriod: false,
            isYearEndPeriod: p.periodNumber === periods.length,
            legacyPeriodId: alias?.id ?? null,
            closeDate: legacyClosed ? alias.closedAt ?? new Date() : null,
            closedBy: legacyClosed ? alias.closedById ?? null : null,
            closeReason: legacyClosed ? 'Migrated: period was closed in the legacy system.' : null,
            createdBy: context.userId,
            metadata: { migratedFromLegacy: true, ambiguousLegacyMatches: matches.length > 1 ? matches.map((m) => m.id) : undefined },
          },
        });
        await tx.acctV2PeriodStatusHistory.create({
          data: {
            tenantId: context.businessId,
            financialYearId: fy.id,
            accountingPeriodId: periodRow.id,
            previousStatus: null,
            newStatus: periodRow.status,
            action: PeriodStatusAction.MIGRATED,
            reason: legacyClosed
              ? 'Migrated from legacy closed period; original close metadata preserved.'
              : 'Migrated from legacy calendar.',
            executedBy: context.userId,
            requestId: context.requestId ?? null,
            correlationId: context.correlationId ?? null,
            metadata: { legacyPeriodId: alias?.id ?? null },
          },
        });
      }
      return { fy, closedInYear, mappedInYear };
    });
    created.push({ code: fyCode, financialYearId: result.fy.id, periods: periods.length });
    mappedLegacy += result.mappedInYear;
    carriedClosed += result.closedInYear;
  }

  // Stage 3 — assign canonical period references to posted journals from
  // their POSTING/entry dates, only where exactly one canonical period
  // covers the date. The date itself is never modified.
  const canonicalPeriods = await db.acctV2AccountingPeriod.findMany({
    where: { tenantId: context.businessId, isAdjustmentPeriod: false },
    orderBy: { startDate: 'asc' },
  });
  const yearsById = new Map(
    (await db.acctV2FinancialYear.findMany({ where: { tenantId: context.businessId } })).map((y) => [y.id, y])
  );
  const unassigned = await db.journalEntry.findMany({
    where: { tenantId: context.businessId, status: { in: ['POSTED', 'Posted'] }, accountingPeriodId: null },
    select: { id: true, entryDate: true, postingDate: true },
  });
  let assignedJournals = 0;
  const unresolved = [];
  for (const journal of unassigned) {
    const anchor = journal.postingDate ?? journal.entryDate;
    if (!anchor) {
      unresolved.push({ journalId: journal.id, reason: 'NO_DATE' });
      continue;
    }
    const date = toDateOnly(anchor);
    const covering = canonicalPeriods.filter(
      (p) => toDateOnly(p.startDate) <= date && toDateOnly(p.endDate) >= date
    );
    if (covering.length !== 1) {
      unresolved.push({ journalId: journal.id, reason: covering.length === 0 ? 'NO_COVERING_PERIOD' : 'AMBIGUOUS' });
      continue;
    }
    const fy = yearsById.get(covering[0].financialYearId);
    await db.journalEntry.update({
      where: { id: journal.id },
      data: { accountingPeriodId: covering[0].id, financialYearLabel: fy?.code ?? null },
    });
    assignedJournals += 1;
  }

  await recordAccountingAudit(
    {
      action: 'acctv2.period.legacyMigration',
      entityType: 'AcctV2FinancialYear',
      entityId: created[0]?.financialYearId ?? 'none',
      userId: context.userId,
      tenantId: context.businessId,
      newValues: {
        yearsCreated: created.length,
        legacyPeriodsMapped: mappedLegacy,
        closedStatusCarried: carriedClosed,
        journalsAssigned: assignedJournals,
        unresolvedJournals: unresolved.length,
      },
      reason: 'Legacy period migration batch',
      requestId: context.requestId,
      correlationId: context.correlationId,
    },
    db
  );

  return {
    dryRun: false,
    preview,
    created,
    legacyPeriodsMapped: mappedLegacy,
    closedStatusCarried: carriedClosed,
    assignedJournals,
    unresolved,
  };
}

/** Guard: strict flags must not be enabled before migration is complete. */
export async function assertMigrationComplete(db, context) {
  const unassigned = await db.journalEntry.count({
    where: { tenantId: context.businessId, status: { in: ['POSTED', 'Posted'] }, accountingPeriodId: null },
  });
  if (unassigned > 0) {
    throw new AccountingValidationError(
      `${unassigned} posted journals still lack a canonical period reference; complete migration before enabling strict period controls.`,
      ids(context)
    );
  }
}
