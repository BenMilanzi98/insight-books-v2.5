/**
 * Phase 7 — Trial Balance Engine.
 *
 * Reads canonical posted Journal Entry Lines exclusively (through the Phase 5
 * General Ledger Query Service). Per account: opening debit/credit, period
 * debit/credit movement, closing debit/credit, raw net balance, normal-balance
 * presentation, abnormal flag, line count. Totals must balance; when they do
 * not, the exact difference and affected accounts are disclosed and the status
 * is UNBALANCED — never hidden, never plugged (§10–12).
 */

import { getBusinessLedgerSummary } from '../ledger/ledgerQueryService.js';
import {
  buildReportEnvelope,
  amount,
  TRIAL_BALANCE_STATUS,
  REPORT_INTEGRITY_STATUS,
} from './reportContracts.js';
import { minorToDecimalString } from '../domain/money.js';

const OPEN_ANOMALY_STATUSES = [
  'DETECTED',
  'UNDER_INVESTIGATION',
  'EVIDENCE_INCOMPLETE',
  'READY_FOR_REVIEW',
  'APPROVED_FOR_REPAIR',
  'REPAIR_SCHEDULED',
  'REPAIRING',
  'REPAIR_FAILED',
];

/** Split a signed (debit-positive) balance into debit/credit columns. */
function splitSigned(signedMinor) {
  return {
    debitMinor: signedMinor > 0 ? signedMinor : 0,
    creditMinor: signedMinor < 0 ? -signedMinor : 0,
  };
}

/**
 * Load open Phase 6 historical exceptions for disclosure (§35 of the rules:
 * material unresolved exceptions must be disclosed; historical unresolved
 * exceptions are distinguished from current-system defects).
 */
export async function loadOpenAccountingExceptions(db, context) {
  if (!db.acctV2HistoricalAnomaly) return [];
  const rows = await db.acctV2HistoricalAnomaly.findMany({
    where: { tenantId: context.businessId, status: { in: OPEN_ANOMALY_STATUSES } },
  });
  return rows.map((a) => ({
    findingCode: a.findingCode,
    anomalyType: a.anomalyType,
    severity: a.severity,
    status: a.status,
    accountId: a.accountId ?? null,
    financialImpact: a.financialImpact ?? null,
    origin: 'HISTORICAL_EXCEPTION',
  }));
}

/**
 * Generate the Trial Balance.
 * @param {import('@prisma/client').PrismaClient} db
 * @param {object} context AccountingContext
 * @param {object} request normalized report request (normalizeReportRequest)
 */
export async function generateTrialBalance(db, context, request) {
  const scope = {
    startDate: request.fromDate ?? undefined,
    endDate: request.toDate ?? request.asOfDate ?? undefined,
    branchId: request.branchId ?? null,
    includeZeroActivity: request.includeZeroBalances,
  };
  const [summary, exceptions] = await Promise.all([
    getBusinessLedgerSummary(db, context, scope),
    loadOpenAccountingExceptions(db, context),
  ]);

  let comparativeByAccount = null;
  if (request.comparison) {
    const comparative = await getBusinessLedgerSummary(db, context, {
      startDate: request.comparison.fromDate ?? undefined,
      endDate: request.comparison.toDate ?? request.comparison.asOfDate ?? undefined,
      branchId: request.branchId ?? null,
      includeZeroActivity: request.includeZeroBalances,
    });
    comparativeByAccount = new Map(comparative.accounts.map((r) => [r.accountId, r]));
  }

  let openingDebitMinor = 0;
  let openingCreditMinor = 0;
  let closingDebitMinor = 0;
  let closingCreditMinor = 0;

  const rows = summary.accounts.map((r) => {
    const opening = splitSigned(r.opening.signedMinor);
    const closing = splitSigned(r.closing.signedMinor);
    // R4-A: clean headers are presentation-only and do not enter equation totals.
    // Exceptional headers (direct activity) count once.
    const countsInEquation = !r.isHeader || Boolean(r.exceptionalPostingAccount);
    if (countsInEquation) {
      openingDebitMinor += opening.debitMinor;
      openingCreditMinor += opening.creditMinor;
      closingDebitMinor += closing.debitMinor;
      closingCreditMinor += closing.creditMinor;
    }
    const comparative = comparativeByAccount?.get(r.accountId) ?? null;
    return {
      accountId: r.accountId,
      accountCode: r.accountCode,
      accountName: r.accountName,
      accountType: r.accountType,
      category: r.category,
      parentAccountId: r.parentAccountId,
      isHeader: r.isHeader,
      exceptionalPostingAccount: Boolean(r.exceptionalPostingAccount),
      normalBalance: r.normalBalance,
      openingDebit: amount(opening.debitMinor),
      openingCredit: amount(opening.creditMinor),
      periodDebit: amount(r.periodDebitMinor),
      periodCredit: amount(r.periodCreditMinor),
      closingDebit: amount(closing.debitMinor),
      closingCredit: amount(closing.creditMinor),
      rawNetMinor: r.closing.signedMinor,
      presentation: r.closing,
      abnormalBalance: r.closing.abnormal,
      lineCount: r.lineCount,
      comparativeClosing: comparative
        ? {
            ...splitSigned(comparative.closing.signedMinor),
            decimal: comparative.closing.display,
          }
        : null,
      warningStatus: r.exceptionalPostingAccount
        ? 'EXCEPTIONAL_HEADER_POSTING'
        : r.normalBalanceWarning
          ? 'NORMAL_BALANCE_UNCONFIGURED'
          : r.closing.abnormal
            ? 'ABNORMAL_BALANCE'
            : null,
      drillDown: { accountId: r.accountId, scope: { ...scope, includeZeroActivity: undefined } },
    };
  });

  // Equations (§11): opening, movement and closing must each balance.
  const equations = {
    openingBalanced: openingDebitMinor === openingCreditMinor,
    openingDifference: amount(openingDebitMinor - openingCreditMinor),
    movementBalanced: summary.totals.balanced,
    movementDifference: amount(summary.totals.differenceMinor),
    closingBalanced: closingDebitMinor === closingCreditMinor,
    closingDifference: amount(closingDebitMinor - closingCreditMinor),
  };

  const structuralBlockers = summary.anomalies.filter((a) => a.rule === 'GL-113');
  const warnings = [
    ...summary.anomalies.map((a) => ({
      code: a.rule,
      message: a.message,
      accountId: a.accountId ?? null,
      origin: 'CURRENT_SYSTEM',
    })),
    ...exceptions.map((e) => ({
      code: e.anomalyType,
      message: `Open historical exception ${e.findingCode} (${e.severity}).`,
      accountId: e.accountId,
      origin: 'HISTORICAL_EXCEPTION',
    })),
  ];

  const balanced = equations.movementBalanced && equations.closingBalanced && equations.openingBalanced;
  let status;
  if (structuralBlockers.length > 0) status = TRIAL_BALANCE_STATUS.BLOCKED;
  else if (!balanced) status = TRIAL_BALANCE_STATUS.UNBALANCED;
  else if (warnings.length > 0) status = TRIAL_BALANCE_STATUS.BALANCED_WITH_WARNINGS;
  else status = TRIAL_BALANCE_STATUS.BALANCED;

  const unbalancedAccounts =
    status === TRIAL_BALANCE_STATUS.UNBALANCED
      ? rows.filter((r) => r.abnormalBalance).map((r) => r.accountId)
      : [];

  const envelope = buildReportEnvelope(context, request, { id: 'TB-STANDARD', name: 'Trial Balance', version: '1.0.0' }, {
    trialBalanceStatus: status,
    lines: rows,
    totals: {
      openingDebit: amount(openingDebitMinor),
      openingCredit: amount(openingCreditMinor),
      periodDebit: amount(summary.totals.periodDebitMinor),
      periodCredit: amount(summary.totals.periodCreditMinor),
      closingDebit: amount(closingDebitMinor),
      closingCredit: amount(closingCreditMinor),
      difference: amount(summary.totals.differenceMinor),
      differenceDisplay: minorToDecimalString(summary.totals.differenceMinor),
    },
    equations,
    integrityWarnings: warnings,
    unresolvedExceptions: exceptions,
    affectedAccounts: unbalancedAccounts,
  });

  envelope.integrityStatus =
    status === TRIAL_BALANCE_STATUS.BALANCED
      ? REPORT_INTEGRITY_STATUS.VERIFIED
      : status === TRIAL_BALANCE_STATUS.BALANCED_WITH_WARNINGS
        ? REPORT_INTEGRITY_STATUS.VERIFIED_WITH_WARNINGS
        : status === TRIAL_BALANCE_STATUS.BLOCKED
          ? REPORT_INTEGRITY_STATUS.BLOCKED
          : REPORT_INTEGRITY_STATUS.UNVERIFIED;
  return envelope;
}
