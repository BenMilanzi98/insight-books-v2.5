/**
 * Phase 8 — canonical Period Resolution Service (§15).
 *
 * Resolves the financial year and accounting period for a posting entirely
 * server-side from the POSTING date. Deny-by-default: no matching year, no
 * matching period, overlapping coverage, closed/locked periods, wrong
 * business, unauthorized backdating and unauthorized future-dating are all
 * typed rejections. There is never a silent fallback to the current period.
 */

import {
  ClosedAccountingPeriodError,
  InvalidAccountingPeriodError,
  InvalidPostingDateError,
} from '../domain/errors.js';
import { ACCOUNTING_PERMISSIONS } from '../permissions.js';
import { getCalendarConfig } from './calendarConfigService.js';
import { evaluatePostingDate } from './datePolicy.js';
import { toDateOnly, isoDate } from './periodGeneration.js';
import { AccountingPeriodStatus, FinancialYearStatus } from './periodEnums.js';

const ids = (context) => ({ requestId: context.requestId, correlationId: context.correlationId });

/** Best-effort audit of a rejected posting attempt into a controlled period. */
async function auditRejectedAttempt(db, context, params, code, detail) {
  try {
    await db.auditLog.create({
      data: {
        action: 'acctv2.period.postingRejected',
        entityType: 'AcctV2AccountingPeriod',
        entityId: detail.periodId ?? 'none',
        userId: context.userId,
        tenantId: context.businessId,
        details: JSON.stringify({
          code,
          postingDate: detail.postingDate ?? null,
          sourceModule: params.sourceModule ?? null,
          eventType: params.eventType ?? null,
          requestId: context.requestId ?? null,
          correlationId: context.correlationId ?? null,
          scope: 'accountingV2',
        }),
      },
    });
  } catch {
    // Auditing must never turn a controlled rejection into a crash.
  }
}

/**
 * Resolve financial year + accounting period for a posting (canonical, V2).
 *
 * @param {object} db Prisma client or transaction client
 * @param {import('../domain/accountingContext.js').AccountingContext} context
 * @param {object} params
 * @param {string} params.transactionDate ISO date
 * @param {string|null} [params.requestedPostingDate]
 * @param {string} [params.sourceModule]
 * @param {string} [params.sourceType]
 * @param {string} [params.eventType]
 * @param {string} [params.postingMode]
 * @param {string} [params.reason] backdating/adjustment reason from the workflow
 * @param {(key: string) => boolean} [params.hasPermission]
 * @param {Date} [params.now] test injection
 * @returns {Promise<object>} resolution per the §15 contract
 */
export async function resolvePeriodV2(db, context, params) {
  const can = params.hasPermission ?? ((key) => (context.permissions ?? []).includes(key));
  const warnings = [];

  const config = await getCalendarConfig(db, context);
  const policy = evaluatePostingDate(config, {
    transactionDate: params.transactionDate,
    requestedPostingDate: params.requestedPostingDate,
    now: params.now,
  });
  for (const violation of policy.violations) {
    if (violation.code === 'LOCK_DATE' && can(ACCOUNTING_PERMISSIONS.PERIODS_SET_LOCK_DATE)) {
      warnings.push(`${violation.message} Proceeding under lock-date administration permission; the action is audited.`);
      continue;
    }
    throw new InvalidPostingDateError(violation.message, { ...ids(context), diagnostic: { code: violation.code } });
  }

  const postingDateValue = toDateOnly(policy.resolvedPostingDate);

  // 1. Financial year covering the posting date — business-scoped.
  const years = await db.acctV2FinancialYear.findMany({
    where: {
      tenantId: context.businessId,
      startDate: { lte: postingDateValue },
      endDate: { gte: postingDateValue },
    },
    orderBy: { startDate: 'desc' },
  });
  if (years.length === 0) {
    throw new InvalidAccountingPeriodError(
      `No financial year covers posting date ${policy.resolvedPostingDate}. Create the financial year before posting — the system never falls back to the current period.`,
      { ...ids(context), diagnostic: { postingDate: policy.resolvedPostingDate } }
    );
  }
  if (years.length > 1) {
    throw new InvalidAccountingPeriodError(
      `Overlapping financial years cover ${policy.resolvedPostingDate} (${years.map((y) => y.code).join(', ')}). Resolve calendar integrity finding PER-101 first.`,
      { ...ids(context), diagnostic: { code: 'PER-101' } }
    );
  }
  const fy = years[0];
  if (fy.status === FinancialYearStatus.CLOSED || fy.status === FinancialYearStatus.ARCHIVED) {
    await auditRejectedAttempt(db, context, params, 'FY_CLOSED', { postingDate: policy.resolvedPostingDate });
    throw new ClosedAccountingPeriodError(
      `Financial year ${fy.code} is ${fy.status} and cannot accept ordinary postings. Use the reopening or adjustment workflow.`,
      { ...ids(context), diagnostic: { financialYearId: fy.id } }
    );
  }
  if (fy.status === FinancialYearStatus.DRAFT) {
    throw new InvalidAccountingPeriodError(
      `Financial year ${fy.code} has not been opened yet.`,
      { ...ids(context), diagnostic: { financialYearId: fy.id } }
    );
  }

  // 2. Accounting period covering the posting date within that year.
  const covering = await db.acctV2AccountingPeriod.findMany({
    where: {
      tenantId: context.businessId,
      financialYearId: fy.id,
      startDate: { lte: postingDateValue },
      endDate: { gte: postingDateValue },
      isAdjustmentPeriod: false,
    },
    orderBy: { startDate: 'desc' },
  });
  if (covering.length === 0) {
    throw new InvalidAccountingPeriodError(
      `No accounting period in ${fy.code} covers ${policy.resolvedPostingDate} (calendar gap — PER-103/PER-107).`,
      { ...ids(context), diagnostic: { financialYearId: fy.id, code: 'PER-103' } }
    );
  }
  if (covering.length > 1) {
    throw new InvalidAccountingPeriodError(
      `Overlapping accounting periods cover ${policy.resolvedPostingDate} (${covering.map((p) => p.code).join(', ')}). Resolve PER-102 first.`,
      { ...ids(context), diagnostic: { code: 'PER-102' } }
    );
  }
  const period = covering[0];

  // 3. Period status controls.
  let requiresApproval = false;
  let resolutionRule = 'OPEN_PERIOD_POSTING';
  if (period.status === AccountingPeriodStatus.CLOSED) {
    await auditRejectedAttempt(db, context, params, 'PERIOD_CLOSED', {
      periodId: period.id,
      postingDate: policy.resolvedPostingDate,
    });
    throw new ClosedAccountingPeriodError(
      `Accounting period ${period.name} (${isoDate(toDateOnly(period.startDate))} – ${isoDate(toDateOnly(period.endDate))}, ${fy.code}) is closed. ` +
        'Request a reopening or post an approved current-period adjustment referencing this period.',
      {
        ...ids(context),
        diagnostic: {
          periodId: period.id,
          periodName: period.name,
          financialYear: fy.code,
          requestedPostingDate: policy.resolvedPostingDate,
          sourceModule: params.sourceModule ?? null,
        },
      }
    );
  }
  if (period.status === AccountingPeriodStatus.DRAFT) {
    throw new InvalidAccountingPeriodError(
      `Accounting period ${period.name} has not been opened yet.`,
      { ...ids(context), diagnostic: { periodId: period.id } }
    );
  }
  if (period.status === AccountingPeriodStatus.CLOSING) {
    if (!can(ACCOUNTING_PERMISSIONS.PERIODS_COMPLETE_TASKS) && !can(ACCOUNTING_PERMISSIONS.PERIODS_POST_ADJUSTMENTS)) {
      await auditRejectedAttempt(db, context, params, 'PERIOD_CLOSING', {
        periodId: period.id,
        postingDate: policy.resolvedPostingDate,
      });
      throw new ClosedAccountingPeriodError(
        `Accounting period ${period.name} is being closed. Only authorized close-completion postings are allowed.`,
        { ...ids(context), diagnostic: { periodId: period.id } }
      );
    }
    requiresApproval = true;
    resolutionRule = 'CLOSING_PERIOD_AUTHORIZED_POSTING';
    warnings.push(`Period ${period.name} is closing; this posting is recorded as close-phase activity and audited.`);
  }
  if (period.status === AccountingPeriodStatus.REOPENED) {
    const allowed =
      can(ACCOUNTING_PERMISSIONS.PERIODS_POST_ADJUSTMENTS) || can(ACCOUNTING_PERMISSIONS.PERIODS_REOPEN);
    if (!allowed) {
      await auditRejectedAttempt(db, context, params, 'PERIOD_REOPENED_UNAUTHORIZED', {
        periodId: period.id,
        postingDate: policy.resolvedPostingDate,
      });
      throw new ClosedAccountingPeriodError(
        `Period ${period.name} was reopened for approved corrections only; posting requires reopened-period authorization.`,
        { ...ids(context), diagnostic: { periodId: period.id } }
      );
    }
    requiresApproval = true;
    resolutionRule = 'REOPENED_PERIOD_CORRECTION';
    warnings.push(`Period ${period.name} is reopened; posting is restricted to the approved correction scope and audited.`);
  }

  // 4. Period-level lock date (secondary to status).
  if (period.lockDate && postingDateValue.getTime() <= toDateOnly(period.lockDate).getTime()) {
    if (!can(ACCOUNTING_PERMISSIONS.PERIODS_SET_LOCK_DATE)) {
      throw new InvalidPostingDateError(
        `Posting date ${policy.resolvedPostingDate} is on or before the lock date for ${period.name}.`,
        { ...ids(context), diagnostic: { periodId: period.id, code: 'LOCK_DATE' } }
      );
    }
    warnings.push(`Posting bypasses the ${period.name} lock date under administration permission; the action is audited.`);
  }

  // 5. Backdating: posting into a period EARLIER than the period containing
  // today requires explicit authorization. An earlier date within the
  // current open period is an ordinary posting (§20: prior-period rule).
  const today = toDateOnly(params.now ?? new Date());
  const isBackdated = toDateOnly(period.endDate).getTime() < today.getTime();
  if (isBackdated) {
    const backdatePermission =
      can(ACCOUNTING_PERMISSIONS.POSTING_BACKDATE) || can(ACCOUNTING_PERMISSIONS.PERIODS_POST_BACKDATED);
    if (!backdatePermission) {
      await auditRejectedAttempt(db, context, params, 'BACKDATING_UNAUTHORIZED', {
        periodId: period.id,
        postingDate: policy.resolvedPostingDate,
      });
      throw new InvalidPostingDateError(
        'Backdated posting requires backdating permission.',
        { ...ids(context), diagnostic: { postingDate: policy.resolvedPostingDate } }
      );
    }
    if (policy.requiresBackdatingReason && !params.reason && params.strictBackdatingReason) {
      throw new InvalidPostingDateError(
        'Business policy requires a reason for backdated postings.',
        { ...ids(context), diagnostic: { code: 'BACKDATING_REASON_REQUIRED' } }
      );
    }
    requiresApproval = true;
    warnings.push('Posting is backdated; the action requires approval and is audited.');
  }

  if (policy.isFutureDated && policy.requiresFutureDatingPermission) {
    if (!can(ACCOUNTING_PERMISSIONS.PERIODS_POST_FUTURE_DATED)) {
      throw new InvalidPostingDateError(
        'Future-dated posting requires future-dating permission.',
        { ...ids(context), diagnostic: { postingDate: policy.resolvedPostingDate } }
      );
    }
    requiresApproval = true;
  }
  if (policy.isFutureDated) {
    warnings.push('Posting is future-dated within the configured tolerance.');
  }

  return Object.freeze({
    financialYearId: fy.id,
    financialYearCode: fy.code,
    financialYearStatus: fy.status,
    accountingPeriodId: period.id,
    periodName: period.name,
    periodCode: period.code,
    periodStatus: period.status,
    transactionDate: policy.transactionDate,
    resolvedPostingDate: policy.resolvedPostingDate,
    requestedPostingDate: params.requestedPostingDate ?? null,
    isBackdated,
    isFutureDated: policy.isFutureDated,
    requiresApproval,
    warnings,
    resolutionRule,
    requestId: context.requestId ?? null,
    correlationId: context.correlationId ?? null,
  });
}

/**
 * Dry-run guard for operational modules, imports, webhooks and background
 * jobs (§17): validates a posting date without posting. Returns a safe
 * `{allowed, resolution?, error?}` result instead of throwing.
 */
export async function validatePostingDate(db, context, params) {
  try {
    const resolution = await resolvePeriodV2(db, context, params);
    return { allowed: true, resolution };
  } catch (error) {
    return {
      allowed: false,
      error: {
        code: error.code ?? error.name ?? 'PERIOD_VALIDATION_FAILED',
        message: error.message,
        requestId: context.requestId ?? null,
        correlationId: context.correlationId ?? null,
      },
    };
  }
}
