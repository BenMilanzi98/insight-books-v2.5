/**
 * Posting engine — accounting period resolution (Phase 4).
 *
 * Wraps the current period implementation (`AccountingPeriod` table) behind one
 * engine-facing contract, ready for the Phase 8 replacement. Unlike the legacy
 * `checkPeriodLock` (which silently allows posting when the period query fails),
 * the engine's resolution is explicit:
 *   - a date inside a CLOSED period is a typed rejection;
 *   - a date inside a REOPENED period requires the reopened-posting permission;
 *   - a date with no covering period is an error when the business has periods
 *     configured (no silent pass-through), and a policy-documented warning
 *     otherwise;
 *   - backdating before the current open period requires permission;
 *   - the period is resolved server-side from the POSTING date — the caller
 *     never selects a raw period id.
 */

import {
  ClosedAccountingPeriodError,
  InvalidAccountingPeriodError,
  InvalidPostingDateError,
} from '../domain/errors.js';
import { ACCOUNTING_PERMISSIONS } from '../permissions.js';
import { isFlagEnabled, PERIOD_FLAGS } from '../infrastructure/featureFlags.js';
import { resolvePeriodV2 } from '../periods/periodResolutionService.js';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Future-dated postings beyond this horizon are rejected (approved policy). */
const MAX_FUTURE_DAYS = 31;

/**
 * @typedef {object} PeriodResolution
 * @property {string|null} accountingPeriodId
 * @property {string|null} periodName
 * @property {string} periodStatus 'OPEN' | 'REOPENED' | 'UNCONFIGURED'
 * @property {string} postingDate ISO date actually used
 * @property {string} transactionDate ISO date preserved from the source
 * @property {string} financialYearLabel e.g. "FY2026"
 * @property {boolean} backdated
 * @property {string[]} warnings
 */

/**
 * Resolve and authorize the accounting period for a posting.
 *
 * @param {import('@prisma/client').Prisma.TransactionClient|import('@prisma/client').PrismaClient} db
 * @param {import('../domain/accountingContext.js').AccountingContext} context
 * @param {object} params
 * @param {string} params.transactionDate ISO date
 * @param {string|null} [params.requestedPostingDate] ISO date
 * @param {string[]} [params.userPermissions] granted permission keys (server-derived)
 * @param {(permission: string) => boolean} [params.hasPermission]
 * @returns {Promise<PeriodResolution>}
 */
export async function resolvePostingPeriod(db, context, params) {
  // Phase 8: when the canonical resolver is enabled for this business, the
  // financial calendar (AcctV2FinancialYear/AcctV2AccountingPeriod) is
  // authoritative and the legacy AccountingPeriod table is no longer consulted.
  const useV2 = await isFlagEnabled(db, PERIOD_FLAGS.RESOLVER_V2, {
    tenantId: context.businessId,
    moduleKey: params.sourceModule,
    eventType: params.eventType,
  });
  if (useV2) {
    const resolution = await resolvePeriodV2(db, context, {
      transactionDate: params.transactionDate,
      requestedPostingDate: params.requestedPostingDate,
      sourceModule: params.sourceModule,
      sourceType: params.sourceType,
      eventType: params.eventType,
      reason: params.reason,
      hasPermission: params.hasPermission,
    });
    return Object.freeze({
      accountingPeriodId: resolution.accountingPeriodId,
      periodName: resolution.periodName,
      periodStatus: resolution.periodStatus,
      postingDate: resolution.resolvedPostingDate,
      transactionDate: resolution.transactionDate,
      financialYearLabel: resolution.financialYearCode,
      financialYearId: resolution.financialYearId,
      backdated: resolution.isBackdated,
      requiresApproval: resolution.requiresApproval,
      resolutionRule: resolution.resolutionRule,
      warnings: resolution.warnings,
    });
  }

  const ids = { requestId: context.requestId, correlationId: context.correlationId };
  const warnings = [];
  const transactionDate = params.transactionDate;
  const postingDate = params.requestedPostingDate ?? params.transactionDate;
  const postingDateValue = new Date(`${postingDate}T00:00:00.000Z`);
  if (Number.isNaN(postingDateValue.getTime())) {
    throw new InvalidPostingDateError('Posting date is not a valid date.', ids);
  }

  const now = Date.now();
  if (postingDateValue.getTime() - now > MAX_FUTURE_DAYS * DAY_MS) {
    throw new InvalidPostingDateError(
      `Posting date is more than ${MAX_FUTURE_DAYS} days in the future.`,
      ids
    );
  }

  const can = params.hasPermission ?? ((key) => (params.userPermissions ?? context.permissions ?? []).includes(key));

  // All covering periods for the posting date — business-scoped, explicit statuses.
  const covering = await db.accountingPeriod.findMany({
    where: {
      tenantId: context.businessId,
      startDate: { lte: postingDateValue },
      endDate: { gte: postingDateValue },
    },
    select: { id: true, name: true, status: true, startDate: true, endDate: true },
    orderBy: { startDate: 'desc' },
  });

  const closed = covering.find((p) => String(p.status).toLowerCase() === 'closed');
  if (closed) {
    throw new ClosedAccountingPeriodError(
      `Cannot post in closed accounting period: ${closed.name}.`,
      { ...ids, diagnostic: { periodId: closed.id } }
    );
  }

  const open = covering.find((p) => ['open', 'reopened'].includes(String(p.status).toLowerCase()));

  const anyPeriods = covering.length > 0
    ? true
    : (await db.accountingPeriod.findFirst({
        where: { tenantId: context.businessId },
        select: { id: true },
      })) != null;

  if (!open && anyPeriods) {
    // Periods are configured for this business but none covers the date — an
    // explicit gap/overlap error, never a silent pass (Phase 1 finding P1-08).
    throw new InvalidAccountingPeriodError(
      'No open accounting period covers the posting date. Check period configuration.',
      { ...ids, diagnostic: { postingDate } }
    );
  }
  if (!anyPeriods) {
    warnings.push('Business has no accounting periods configured; posting proceeds under the unconfigured-period policy.');
  }

  const periodStatus = !anyPeriods
    ? 'UNCONFIGURED'
    : String(open.status).toLowerCase() === 'reopened'
      ? 'REOPENED'
      : 'OPEN';

  if (periodStatus === 'REOPENED' && !can(ACCOUNTING_PERMISSIONS.PERIODS_REOPEN)) {
    throw new ClosedAccountingPeriodError(
      'This period was reopened; posting into it requires reopened-period authorization.',
      { ...ids, diagnostic: { periodId: open.id } }
    );
  }

  // Backdating: posting date earlier than the start of the latest open period.
  let backdated = false;
  if (anyPeriods) {
    const latestOpen = await db.accountingPeriod.findFirst({
      where: { tenantId: context.businessId, status: 'open' },
      orderBy: { startDate: 'desc' },
      select: { startDate: true },
    });
    if (latestOpen && postingDateValue.getTime() < new Date(latestOpen.startDate).getTime()) {
      backdated = true;
      if (!can(ACCOUNTING_PERMISSIONS.POSTING_BACKDATE)) {
        throw new InvalidPostingDateError(
          'Backdated posting requires backdating permission.',
          { ...ids, diagnostic: { postingDate } }
        );
      }
      warnings.push('Posting is backdated into an earlier open period; the action is audited.');
    }
  }

  return Object.freeze({
    accountingPeriodId: open?.id ?? null,
    periodName: open?.name ?? null,
    periodStatus,
    postingDate,
    transactionDate,
    financialYearLabel: `FY${postingDateValue.getUTCFullYear()}`,
    backdated,
    warnings,
  });
}
