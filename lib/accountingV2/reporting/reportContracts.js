/**
 * Phase 7 — Financial Reporting Engine: request and result contracts.
 *
 * Every report surface (screen, API, export, dashboard) exchanges these two
 * shapes. Requests are normalized and validated server-side (business always
 * from the session context, never the client); results are a standard envelope
 * whose amounts are integer minor units with decimal-string presentation.
 */

import crypto from 'node:crypto';
import { AccountingValidationError } from '../domain/errors.js';
import { minorToDecimalString } from '../domain/money.js';
import { REPORT_TYPES } from './reportTypes.js';

export { REPORT_TYPES };

/** Report integrity statuses (rule §49). */
export const REPORT_INTEGRITY_STATUS = Object.freeze({
  VERIFIED: 'VERIFIED',
  VERIFIED_WITH_WARNINGS: 'VERIFIED_WITH_WARNINGS',
  UNVERIFIED: 'UNVERIFIED',
  BLOCKED: 'BLOCKED',
});

/** Trial Balance statuses (§12). */
export const TRIAL_BALANCE_STATUS = Object.freeze({
  BALANCED: 'BALANCED',
  BALANCED_WITH_WARNINGS: 'BALANCED_WITH_WARNINGS',
  UNBALANCED: 'UNBALANCED',
  BLOCKED: 'BLOCKED',
});

/** Report run / approval workflow statuses (§50). */
export const REPORT_RUN_STATUS = Object.freeze({
  GENERATED: 'GENERATED',
  REVIEWED: 'REVIEWED',
  APPROVED: 'APPROVED',
  SUPERSEDED: 'SUPERSEDED',
});

export const REPORT_LINE_TYPES = Object.freeze([
  'TITLE',
  'SECTION',
  'SUBSECTION',
  'ACCOUNT',
  'ACCOUNT_GROUP',
  'CALCULATED_TOTAL',
  'SUBTOTAL',
  'GRAND_TOTAL',
  'RATIO',
  'MEMO',
  'DISCLOSURE',
  'VARIANCE',
  'WARNING',
]);

const toDate = (value, path) => {
  if (value == null || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new AccountingValidationError(`Invalid date for ${path}.`, [
      { path, message: 'not a valid date' },
    ]);
  }
  return d;
};

/**
 * Normalize and validate a report request. The business ALWAYS comes from the
 * accounting context (session); any client-provided businessId is ignored.
 * Formal reports never include unposted journals — `includeUnposted` is
 * rejected if truthy.
 *
 * @param {object} context AccountingContext (businessId, userId, requestId, correlationId)
 * @param {string} reportType one of REPORT_TYPES
 * @param {object} [raw] client parameters
 * @returns {object} normalized request
 */
export function normalizeReportRequest(context, reportType, raw = {}) {
  if (!Object.values(REPORT_TYPES).includes(reportType)) {
    throw new AccountingValidationError(`Unknown report type: ${reportType}`, [
      { path: 'reportType', message: 'unsupported' },
    ]);
  }
  if (raw.includeUnposted) {
    throw new AccountingValidationError(
      'Formal reports never include unposted journals (includeUnposted must be false).',
      [{ path: 'includeUnposted', message: 'must be false' }]
    );
  }
  const fromDate = toDate(raw.fromDate, 'fromDate');
  const toDateV = toDate(raw.toDate, 'toDate');
  const asOfDate = toDate(raw.asOfDate, 'asOfDate') ?? toDateV;
  if (fromDate && toDateV && fromDate.getTime() > toDateV.getTime()) {
    throw new AccountingValidationError('fromDate must not be after toDate.', [
      { path: 'fromDate', message: 'after toDate' },
    ]);
  }
  const comparison =
    raw.comparisonFromDate || raw.comparisonToDate || raw.comparisonAsOfDate
      ? {
          fromDate: toDate(raw.comparisonFromDate, 'comparisonFromDate'),
          toDate: toDate(raw.comparisonToDate, 'comparisonToDate'),
          asOfDate:
            toDate(raw.comparisonAsOfDate, 'comparisonAsOfDate') ??
            toDate(raw.comparisonToDate, 'comparisonToDate'),
        }
      : null;
  // Comparative columns must compare equivalent scopes: a period report needs a
  // comparison period; an as-of report needs a comparison as-of date (§43).
  if (comparison && fromDate && toDateV && !(comparison.fromDate && comparison.toDate)) {
    throw new AccountingValidationError(
      'Comparative scope must be a full equivalent period (comparisonFromDate and comparisonToDate).',
      [{ path: 'comparisonFromDate', message: 'incomplete comparative period' }]
    );
  }

  return Object.freeze({
    businessId: context.businessId,
    reportType,
    financialYearLabel: raw.financialYearLabel ?? null,
    accountingPeriodId: raw.accountingPeriodId ?? null,
    fromDate,
    toDate: toDateV,
    asOfDate,
    /** Financial-year start used for Current Year Earnings / Retained Earnings split. */
    financialYearStartDate:
      toDate(raw.financialYearStartDate, 'financialYearStartDate') ??
      (asOfDate ? new Date(Date.UTC(asOfDate.getUTCFullYear(), 0, 1)) : null),
    comparison,
    branchId: raw.branchId ?? null,
    departmentId: raw.departmentId ?? null,
    projectId: raw.projectId ?? null,
    costCentreId: raw.costCentreId ?? null,
    currency: raw.currency ?? null,
    presentationCurrency: raw.presentationCurrency ?? null,
    includeZeroBalances: Boolean(raw.includeZeroBalances),
    includeDeprecatedAccounts: raw.includeDeprecatedAccounts !== false,
    includeAccountDetails: raw.includeAccountDetails !== false,
    includeComparatives: Boolean(comparison),
    includeBudget: Boolean(raw.includeBudget),
    includeUnposted: false,
    reportBasis: raw.reportBasis ?? 'ACCRUAL',
    reportDefinitionId: raw.reportDefinitionId ?? null,
    reportDefinitionVersion: raw.reportDefinitionVersion ?? null,
    outputFormat: raw.outputFormat ?? 'JSON',
    requestId: context.requestId ?? null,
    correlationId: context.correlationId ?? null,
  });
}

/** Deterministic hash of the scope-relevant request fields (cache key, audit). */
export function hashReportRequest(request) {
  const scope = {
    businessId: request.businessId,
    reportType: request.reportType,
    fromDate: request.fromDate?.toISOString() ?? null,
    toDate: request.toDate?.toISOString() ?? null,
    asOfDate: request.asOfDate?.toISOString() ?? null,
    financialYearStartDate: request.financialYearStartDate?.toISOString() ?? null,
    comparison: request.comparison
      ? {
          fromDate: request.comparison.fromDate?.toISOString() ?? null,
          toDate: request.comparison.toDate?.toISOString() ?? null,
          asOfDate: request.comparison.asOfDate?.toISOString() ?? null,
        }
      : null,
    branchId: request.branchId,
    includeZeroBalances: request.includeZeroBalances,
    reportDefinitionVersion: request.reportDefinitionVersion,
  };
  return crypto.createHash('sha256').update(JSON.stringify(scope)).digest('hex');
}

/** Present a minor-unit amount for the result contract. */
export function amount(minor) {
  return { minor, decimal: minorToDecimalString(minor) };
}

/**
 * Build the standard result envelope (§9). `lines`, `totals`, `validation`
 * and report-specific fields are supplied by the generating service.
 */
export function buildReportEnvelope(context, request, definition, body) {
  const generatedAt = new Date();
  const envelope = {
    reportId: crypto.randomUUID(),
    reportType: request.reportType,
    reportName: definition?.name ?? request.reportType,
    businessId: context.businessId,
    financialYear: request.financialYearLabel,
    accountingPeriodId: request.accountingPeriodId,
    dateRange: {
      fromDate: request.fromDate?.toISOString() ?? null,
      toDate: request.toDate?.toISOString() ?? null,
    },
    asOfDate: request.asOfDate?.toISOString() ?? null,
    comparisonScope: request.comparison
      ? {
          fromDate: request.comparison.fromDate?.toISOString() ?? null,
          toDate: request.comparison.toDate?.toISOString() ?? null,
          asOfDate: request.comparison.asOfDate?.toISOString() ?? null,
        }
      : null,
    currency: request.presentationCurrency ?? request.currency ?? 'MWK',
    generatedAt: generatedAt.toISOString(),
    generatedBy: context.userId,
    definitionId: definition?.id ?? null,
    definitionVersion: definition?.version ?? null,
    architectureVersion: 'ACCTV2',
    reportStatus: REPORT_RUN_STATUS.GENERATED,
    integrityStatus: REPORT_INTEGRITY_STATUS.UNVERIFIED,
    integrityWarnings: [],
    unresolvedExceptions: [],
    requestId: request.requestId,
    correlationId: request.correlationId,
    filtersHash: hashReportRequest(request),
    sourcePolicy: {
      source: 'canonical posted journal lines (General Ledger Query Service)',
      storedBalancesUsed: false,
      operationalTotalsInStatementAmounts: false,
      arithmetic: 'integer minor units',
    },
    ...body,
  };
  envelope.resultChecksum = crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        reportType: envelope.reportType,
        filtersHash: envelope.filtersHash,
        definitionVersion: envelope.definitionVersion,
        lines: envelope.lines ?? null,
        totals: envelope.totals ?? null,
      })
    )
    .digest('hex');
  return envelope;
}

/**
 * Build a standard report line (§9). Amounts are minor units; presentation
 * strings are derived, never authoritative.
 */
export function buildReportLine({
  lineId,
  code = null,
  label,
  lineType,
  hierarchyLevel = 0,
  parentLineId = null,
  displayOrder = 0,
  currentMinor = 0,
  comparativeMinor = null,
  budgetMinor = null,
  accounts = [],
  mappingRule = null,
  normalBalance = null,
  displaySign = 1,
  warningStatus = null,
  metadata = null,
}) {
  if (!REPORT_LINE_TYPES.includes(lineType)) {
    throw new AccountingValidationError(`Invalid report line type: ${lineType}`);
  }
  const varianceMinor = comparativeMinor == null ? null : currentMinor - comparativeMinor;
  return {
    lineId,
    code,
    label,
    lineType,
    hierarchyLevel,
    parentLineId,
    displayOrder,
    currentAmount: amount(currentMinor),
    comparativeAmount: comparativeMinor == null ? null : amount(comparativeMinor),
    varianceAmount: varianceMinor == null ? null : amount(varianceMinor),
    variancePercentage:
      varianceMinor == null || comparativeMinor === 0
        ? null
        : Number(((varianceMinor / Math.abs(comparativeMinor)) * 100).toFixed(2)),
    budgetAmount: budgetMinor == null ? null : amount(budgetMinor),
    budgetVariance: budgetMinor == null ? null : amount(currentMinor - budgetMinor),
    accountIds: accounts.map((a) => a.accountId),
    accountCodes: accounts.map((a) => a.accountCode).filter(Boolean),
    accountNames: accounts.map((a) => a.accountName).filter(Boolean),
    accounts,
    mappingRule,
    normalBalance,
    displaySign,
    drillDownAvailable: accounts.length > 0,
    warningStatus,
    metadata,
  };
}
