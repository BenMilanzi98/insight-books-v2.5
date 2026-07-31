/**
 * Close Readiness Engine — consumes canonical GL/TB and module feeds.
 */

import { generateTrialBalance } from '../../accountingV2/reporting/trialBalanceService.js';
import { AccountingPeriodStatus, FinancialYearStatus } from '../../accountingV2/periods/periodEnums.js';
import { requireApprovedClosingConfiguration, resolveDestinationAccountId } from './configService.js';
import { CloseMethod, ReadinessStatus } from '../domain/enums.js';
import { runModuleCloseChecks } from './moduleCloseChecks.js';

function iso(d) {
  return new Date(d).toISOString().slice(0, 10);
}

async function safeCount(fn) {
  try {
    return await fn();
  } catch {
    return null;
  }
}

/**
 * Assess year-end readiness for a financial year.
 */
export async function assessYearEndReadiness(db, context, { financialYearId }) {
  const checks = [];
  const push = (check) => checks.push(check);

  const fy = await db.acctV2FinancialYear.findFirst({
    where: { id: financialYearId, tenantId: context.businessId },
    include: { periods: { orderBy: { sequence: 'asc' } } },
  });
  if (!fy) {
    return { status: ReadinessStatus.BLOCKED, checks: [{ code: 'FY_MISSING', status: 'FAILED', message: 'Financial year not found.' }] };
  }

  // Configuration
  let cfg = null;
  try {
    cfg = await requireApprovedClosingConfiguration(db, context.businessId);
    push({ code: 'YE_CLOSE_METHOD', status: 'PASSED', message: `Closing method ${cfg.closeMethod}` });
    if (!resolveDestinationAccountId(cfg)) {
      push({ code: 'YE_DESTINATION', status: 'FAILED', blocking: true, message: 'Profit destination account missing.' });
    } else {
      push({ code: 'YE_DESTINATION', status: 'PASSED', message: 'Profit destination configured.' });
    }
    if (
      (cfg.closeMethod === CloseMethod.INCOME_SUMMARY_TO_RETAINED_EARNINGS ||
        cfg.closeMethod === CloseMethod.PARTNER_CAPITAL_ALLOCATION) &&
      cfg.incomeSummaryEnabled &&
      !cfg.incomeSummaryAccountId
    ) {
      push({ code: 'YE_INCOME_SUMMARY', status: 'FAILED', blocking: true, message: 'Income Summary account missing.' });
    }
  } catch (err) {
    push({ code: 'YE_CONFIG', status: 'FAILED', blocking: true, message: err.message || 'Closing configuration missing.' });
  }

  // Periods: all non-final CLOSED; final OPEN/CLOSING/REOPENED
  const periods = fy.periods || [];
  const finalPeriod = periods.find((p) => p.isYearEndPeriod) || periods[periods.length - 1];
  const nonFinal = periods.filter((p) => p.id !== finalPeriod?.id && !p.isAdjustmentPeriod);
  const nonFinalOpen = nonFinal.filter((p) => p.status !== AccountingPeriodStatus.CLOSED);
  if (nonFinalOpen.length) {
    push({
      code: 'YE_PERIODS_FINAL',
      status: 'FAILED',
      blocking: true,
      message: `${nonFinalOpen.length} non-final period(s) not CLOSED.`,
      evidence: { periodCodes: nonFinalOpen.map((p) => p.code) },
    });
  } else {
    push({ code: 'YE_PERIODS_FINAL', status: 'PASSED', message: 'Non-final periods are CLOSED.' });
  }
  if (finalPeriod) {
    const ok = [AccountingPeriodStatus.OPEN, AccountingPeriodStatus.CLOSING, AccountingPeriodStatus.REOPENED].includes(
      finalPeriod.status
    );
    push({
      code: 'YE_FINAL_PERIOD',
      status: ok ? 'PASSED' : 'FAILED',
      blocking: !ok,
      message: ok
        ? `Final period ${finalPeriod.code} is ${finalPeriod.status} (available for YE journals).`
        : `Final period ${finalPeriod.code} is ${finalPeriod.status}; reopen or leave OPEN/CLOSING for closing journals.`,
    });
  }

  if ([FinancialYearStatus.CLOSED, FinancialYearStatus.ARCHIVED].includes(fy.status)) {
    push({ code: 'YE_FY_STATUS', status: 'FAILED', blocking: true, message: `Financial year is already ${fy.status}.` });
  } else {
    push({ code: 'YE_FY_STATUS', status: 'PASSED', message: `Financial year status ${fy.status}.` });
  }

  // Trial Balance
  try {
    const tb = await generateTrialBalance(db, context, {
      fromDate: iso(fy.startDate),
      toDate: iso(fy.endDate),
      asOfDate: iso(fy.endDate),
      includeZeroBalances: false,
      reportType: 'TRIAL_BALANCE',
    });
    const balanced = tb.equations?.closingBalanced && tb.equations?.movementBalanced;
    push({
      code: 'YE_TB_BALANCED',
      status: balanced ? 'PASSED' : 'FAILED',
      blocking: !balanced,
      message: balanced ? 'Trial Balance balances.' : 'Trial Balance unbalanced.',
      evidence: { status: tb.trialBalanceStatus || tb.status },
    });
  } catch (err) {
    push({ code: 'YE_TB_BALANCED', status: 'FAILED', blocking: true, message: `TB generation failed: ${err.message}` });
  }

  // Journals stuck in POSTING
  const postingCount = await safeCount(() =>
    db.journalEntry.count({
      where: { tenantId: context.businessId, status: { in: ['POSTING', 'Posting'] } },
    })
  );
  if (postingCount != null) {
    push({
      code: 'YE_NO_POSTING_STATE',
      status: postingCount === 0 ? 'PASSED' : 'FAILED',
      blocking: postingCount > 0,
      message: postingCount === 0 ? 'No journals in POSTING state.' : `${postingCount} journal(s) still POSTING.`,
    });
  }

  // Bank recon feed (optional module)
  if (typeof db.bankRecReconciliation?.count === 'function') {
    const completed = await db.bankRecReconciliation.count({
      where: {
        tenantId: context.businessId,
        status: { in: ['COMPLETED', 'APPROVED'] },
        statementDate: { gte: fy.startDate, lte: fy.endDate },
      },
    });
    const open = await db.bankRecReconciliation.count({
      where: {
        tenantId: context.businessId,
        status: { in: ['IN_PROGRESS', 'DRAFT', 'READY_FOR_REVIEW'] },
        statementDate: { gte: fy.startDate, lte: fy.endDate },
      },
    });
    push({
      code: 'YE_BANK_RECONCILED',
      status: open === 0 ? (completed > 0 ? 'PASSED' : 'PASSED_WITH_WARNING') : 'FAILED',
      blocking: open > 0,
      message:
        open > 0
          ? `${open} bank reconciliation(s) incomplete.`
          : completed > 0
            ? `${completed} bank reconciliation(s) completed for the year.`
            : 'No bank reconciliations found for the year (warning).',
    });
  } else {
    push({ code: 'YE_BANK_RECONCILED', status: 'PASSED_WITH_WARNING', message: 'Bank recon module unavailable; manual evidence required.' });
  }

  // Module close checks (AR/AP/inventory/payroll/assets/loans/tax/equity)
  try {
    const moduleChecks = await runModuleCloseChecks(db, context, fy);
    for (const c of moduleChecks) push(c);
  } catch (err) {
    push({
      code: 'YE_MODULE_CHECKS',
      status: 'PASSED_WITH_WARNING',
      message: `Module close checks failed to run: ${err.message}`,
    });
  }

  // Next year
  const nextYear = await db.acctV2FinancialYear.findFirst({
    where: {
      tenantId: context.businessId,
      startDate: { gt: fy.endDate },
    },
    orderBy: { startDate: 'asc' },
  });
  if (nextYear) {
    push({ code: 'YE_NEXT_YEAR', status: 'PASSED', message: `Next year ${nextYear.code} exists.` });
  } else if (cfg?.automaticNextYearCreation) {
    push({ code: 'YE_NEXT_YEAR', status: 'PASSED_WITH_WARNING', message: 'Next year missing; will be created on close if enabled.' });
  } else {
    push({ code: 'YE_NEXT_YEAR', status: 'FAILED', blocking: true, message: 'Next financial year not ready.' });
  }

  // Open material exceptions on YE close
  const openEx = await safeCount(() =>
    db.closeV2YearEndCloseException.count({
      where: {
        tenantId: context.businessId,
        financialYearId,
        status: { in: ['OPEN', 'UNDER_REVIEW', 'AWAITING_ADJUSTMENT'] },
        severity: { in: ['HIGH', 'CRITICAL'] },
      },
    })
  );
  if (openEx != null && openEx > 0) {
    push({ code: 'YE_EXCEPTIONS', status: 'FAILED', blocking: true, message: `${openEx} material open exception(s).` });
  }

  const failed = checks.filter((c) => c.status === 'FAILED' && c.blocking !== false && c.blocking !== undefined ? c.blocking : c.status === 'FAILED');
  const blocking = checks.filter((c) => c.blocking === true || (c.status === 'FAILED' && c.blocking !== false));
  const warnings = checks.filter((c) => c.status === 'PASSED_WITH_WARNING');

  let status = ReadinessStatus.READY;
  if (blocking.length) {
    const recon = blocking.some((c) => String(c.code).includes('BANK') || String(c.code).includes('RECONCILE'));
    const config = blocking.some((c) => String(c.code).includes('CONFIG') || String(c.code).includes('METHOD') || String(c.code).includes('DESTINATION'));
    if (config) status = ReadinessStatus.REQUIRES_CONFIGURATION;
    else if (recon) status = ReadinessStatus.REQUIRES_RECONCILIATION;
    else status = ReadinessStatus.BLOCKED;
  } else if (warnings.length) {
    status = ReadinessStatus.READY_WITH_WARNINGS;
  }

  return {
    status,
    financialYearId: fy.id,
    financialYearCode: fy.code,
    closingMethod: cfg?.closeMethod || null,
    checks,
    summary: {
      total: checks.length,
      passed: checks.filter((c) => c.status === 'PASSED').length,
      warnings: warnings.length,
      failed: failed.length,
      blocking: blocking.length,
    },
    finalPeriod: finalPeriod
      ? { id: finalPeriod.id, code: finalPeriod.code, status: finalPeriod.status, endDate: iso(finalPeriod.endDate) }
      : null,
  };
}
