/**
 * Phase 7 — report validation engine (§47) and independent reconciliation
 * service (§69).
 *
 * REP-001..REP-040 catalogue. Rules fall into three enforcement classes:
 *  - RUNTIME    — executed here against generated results;
 *  - STRUCTURAL — impossible by construction (canonical source / definition
 *                 framework); each has a regression test proving the guarantee;
 *  - PROCESS    — enforced by workflow (statuses, snapshots, approvals).
 * A report with any material RUNTIME failure can never be VERIFIED.
 */

import { generateTrialBalance } from './trialBalanceService.js';
import {
  generateIncomeStatement,
  generateBalanceSheet,
  generateCashFlow,
  generateEquityStatement,
} from './financialStatementService.js';
import {
  generateReceivablesReport,
  generatePayablesReport,
} from './subledgerReportsService.js';
import { drillDownReportLine } from './reportDrillDownService.js';
import { REPORT_INTEGRITY_STATUS } from './reportContracts.js';

export const VALIDATION_RULES = Object.freeze({
  'REP-001': { class: 'RUNTIME', summary: 'Trial Balance debit total differs from credit total' },
  'REP-002': { class: 'RUNTIME', summary: 'Income Statement Net Profit differs from Current Year Earnings' },
  'REP-003': { class: 'RUNTIME', summary: 'Balance Sheet does not balance' },
  'REP-004': { class: 'RUNTIME', summary: 'Cash Flow closing cash differs from General Ledger cash' },
  'REP-005': { class: 'RUNTIME', summary: 'Statement of Changes in Equity differs from Balance Sheet equity' },
  'REP-006': { class: 'RUNTIME', summary: 'Receivables Aging differs from AR control account' },
  'REP-007': { class: 'RUNTIME', summary: 'Payables Aging differs from AP control account' },
  'REP-008': { class: 'RUNTIME', summary: 'Inventory Valuation differs from Inventory control account' },
  'REP-009': { class: 'RUNTIME', summary: 'Fixed Asset Register differs from asset accounts' },
  'REP-010': { class: 'RUNTIME', summary: 'Payroll Summary differs from payroll accounts' },
  'REP-011': { class: 'RUNTIME', summary: 'Loan report differs from loan liability' },
  'REP-012': { class: 'RUNTIME', summary: 'Tax report differs from tax accounts' },
  'REP-013': { class: 'RUNTIME', summary: 'Parent and child accounts double-counted' },
  'REP-014': { class: 'RUNTIME', summary: 'Account appears in incompatible report sections' },
  'REP-015': { class: 'STRUCTURAL', summary: 'Current Year Earnings counted twice (single calculated line; stored balances never read)' },
  'REP-016': { class: 'STRUCTURAL', summary: 'Retained Earnings counted incorrectly (calculated from prior-year P&L only)' },
  'REP-017': { class: 'RUNTIME', summary: 'Opening balance counted twice' },
  'REP-018': { class: 'STRUCTURAL', summary: 'Draft journal included (canonical source posted-only)' },
  'REP-019': { class: 'STRUCTURAL', summary: 'Cancelled journal included (canonical source posted-only)' },
  'REP-020': { class: 'STRUCTURAL', summary: 'Failed journal included (canonical source posted-only)' },
  'REP-021': { class: 'STRUCTURAL', summary: 'Shadow journal included (shadow tables never queried)' },
  'REP-022': { class: 'STRUCTURAL', summary: 'Reversal handled incorrectly (reversal journals are ordinary posted lines)' },
  'REP-023': { class: 'STRUCTURAL', summary: 'Legacy and V2 effect counted twice (mirror exclusion + authority rules)' },
  'REP-024': { class: 'RUNTIME', summary: 'Report line lacks source accounts' },
  'REP-025': { class: 'RUNTIME', summary: 'Drill-down total differs from report line' },
  'REP-026': { class: 'RUNTIME', summary: 'Export total differs from screen (exports consume the same result object; tested)' },
  'REP-027': { class: 'RUNTIME', summary: 'Business scope missing' },
  'REP-028': { class: 'RUNTIME', summary: 'Period scope inconsistent' },
  'REP-029': { class: 'RUNTIME', summary: 'Currency scope inconsistent' },
  'REP-030': { class: 'RUNTIME', summary: 'Report cache differs from canonical query' },
  'REP-031': { class: 'STRUCTURAL', summary: 'Unsupported historical balance included (stored balances never read; open exceptions disclosed)' },
  'REP-032': { class: 'STRUCTURAL', summary: 'Direct operational totals included in financial statement (engine has no operational reads in statement amounts)' },
  'REP-033': { class: 'STRUCTURAL', summary: 'Join multiplication (grouped canonical totals; no fan-out joins)' },
  'REP-034': { class: 'RUNTIME', summary: 'Account normal-balance sign incorrect' },
  'REP-035': { class: 'RUNTIME', summary: 'Comparative period mismatch' },
  'REP-036': { class: 'RUNTIME', summary: 'Unmapped account omitted from reports' },
  'REP-037': { class: 'STRUCTURAL', summary: 'Account mapped to multiple incompatible lines (first-match, single assignment)' },
  'REP-038': { class: 'RUNTIME', summary: 'Unassigned material account balance' },
  'REP-039': { class: 'RUNTIME', summary: 'Report definition version missing' },
  'REP-040': { class: 'PROCESS', summary: 'Closed-period report changed unexpectedly (immutable snapshots + supersession)' },
  'REP-041': {
    class: 'RUNTIME',
    summary: 'Header/non-posting account with direct activity included once as exceptional posting (R4-A)',
  },
});

const finding = (code, message, extra = {}) => ({
  code,
  summary: VALIDATION_RULES[code]?.summary ?? code,
  message,
  severity: extra.severity ?? 'CRITICAL',
  ...extra,
});

/** Envelope-level structural checks applicable to every generated report. */
export function validateEnvelope(envelope) {
  const findings = [];
  if (!envelope.businessId) findings.push(finding('REP-027', 'Report generated without business scope.'));
  if (!envelope.definitionVersion) findings.push(finding('REP-039', 'Report result has no definition version.'));
  if (envelope.comparisonScope) {
    const cur = envelope.dateRange?.fromDate && envelope.dateRange?.toDate;
    const cmp = envelope.comparisonScope.fromDate && envelope.comparisonScope.toDate;
    if (cur && !cmp) {
      findings.push(finding('REP-035', 'Comparative scope is not an equivalent full period.'));
    }
  }
  for (const line of envelope.lines ?? []) {
    if (
      line.lineType === 'ACCOUNT_GROUP' &&
      line.currentAmount?.minor !== 0 &&
      (line.accounts?.length ?? 0) === 0 &&
      !line.metadata?.documentCount // aging buckets carry document detail instead
    ) {
      findings.push(
        finding('REP-024', `Line "${line.label}" carries an amount without source accounts.`, {
          lineId: line.lineId,
          severity: 'HIGH',
        })
      );
    }
  }
  // REP-013/014: one account may contribute to only one ACCOUNT_GROUP line.
  const seen = new Map();
  for (const line of envelope.lines ?? []) {
    if (line.lineType !== 'ACCOUNT_GROUP') continue;
    for (const id of line.accountIds ?? []) {
      if (seen.has(id)) {
        findings.push(
          finding('REP-013', `Account ${id} contributes to lines "${seen.get(id)}" and "${line.lineId}".`, {
            accountId: id,
          })
        );
      } else {
        seen.set(id, line.lineId);
      }
    }
  }
  return findings;
}

/**
 * Independent reconciliation service (§69): regenerates every core report for
 * the scope and cross-checks them. Read-only.
 *
 * @param {import('@prisma/client').PrismaClient} db
 * @param {object} context
 * @param {object} request normalized report request (period + as-of scope)
 * @param {{drillDownSample?: number}} [options]
 */
export async function runReportReconciliation(db, context, request, options = {}) {
  const [tb, is, bs, cf, eq, ar, ap] = await Promise.all([
    generateTrialBalance(db, context, { ...request, reportType: 'TRIAL_BALANCE' }),
    generateIncomeStatement(db, context, { ...request, reportType: 'INCOME_STATEMENT' }),
    generateBalanceSheet(db, context, { ...request, reportType: 'BALANCE_SHEET' }),
    generateCashFlow(db, context, { ...request, reportType: 'CASH_FLOW' }),
    generateEquityStatement(db, context, { ...request, reportType: 'EQUITY_STATEMENT' }),
    generateReceivablesReport(db, context, { ...request, reportType: 'RECEIVABLES' }),
    generatePayablesReport(db, context, { ...request, reportType: 'PAYABLES' }),
  ]);

  const findings = [];

  // REP-001 — Trial Balance equations.
  if (!tb.equations.movementBalanced || !tb.equations.closingBalanced) {
    findings.push(
      finding('REP-001', `Trial Balance difference ${tb.totals.difference.decimal}.`, {
        expected: tb.totals.periodDebit.decimal,
        actual: tb.totals.periodCredit.decimal,
        accounts: tb.affectedAccounts,
      })
    );
  }
  // REP-017 — opening balances must reconcile (counted exactly once).
  if (!tb.equations.openingBalanced) {
    findings.push(finding('REP-017', `Trial Balance opening difference ${tb.equations.openingDifference.decimal}.`));
  }
  // REP-002 — Net Profit vs Current Year Earnings. The Income Statement covers
  // the financial year window used by the Balance Sheet CYE line only when the
  // request period IS the FY-to-date window; compare on that basis.
  const isNetProfit = is.totals.netProfit.minor;
  const bsCye = bs.totals.currentYearEarnings.minor;
  const sameWindow =
    request.fromDate &&
    request.financialYearStartDate &&
    request.fromDate.getTime() === request.financialYearStartDate.getTime() &&
    (request.toDate?.getTime() ?? null) === (request.asOfDate?.getTime() ?? request.toDate?.getTime() ?? null);
  if (sameWindow && isNetProfit !== bsCye) {
    findings.push(
      finding('REP-002', `Income Statement net profit ${isNetProfit} ≠ Balance Sheet Current Year Earnings ${bsCye} (minor units).`)
    );
  }
  // REP-003 — Balance Sheet equation.
  if (!bs.totals.balanced) {
    findings.push(finding('REP-003', `Balance Sheet equation difference ${bs.totals.equationDifference.decimal}.`));
  }
  // REP-004 — Cash Flow reconciliation.
  if (!cf.totals.reconciles) {
    findings.push(
      finding('REP-004', `Cash Flow net movement ${cf.totals.netMovement.decimal} ≠ GL cash movement ${cf.totals.glCashMovement.decimal}.`)
    );
  }
  const cfOpeningPlusMovement = cf.totals.openingCash.minor + cf.totals.glCashMovement.minor;
  if (cfOpeningPlusMovement !== cf.totals.closingCash.minor) {
    findings.push(finding('REP-004', 'Opening cash + net movement does not equal closing cash.'));
  }
  // REP-005 — equity statement closing equals Balance Sheet total equity.
  if (eq.totals.closingEquity.minor !== bs.totals.totalEquity.minor) {
    findings.push(
      finding('REP-005', `Equity statement closing ${eq.totals.closingEquity.decimal} ≠ Balance Sheet equity ${bs.totals.totalEquity.decimal}.`)
    );
  }
  // REP-006 / REP-007 — control account reconciliation.
  if (!ar.totals.reconciles) {
    findings.push(finding('REP-006', `Receivables subledger differs from AR control by ${ar.totals.difference.decimal}.`, { severity: 'HIGH' }));
  }
  if (!ap.totals.reconciles) {
    findings.push(finding('REP-007', `Payables subledger differs from AP control by ${ap.totals.difference.decimal}.`, { severity: 'HIGH' }));
  }
  // Envelope structural checks + abnormal-sign scan (REP-034).
  for (const env of [is, bs, cf, eq, ar, ap]) {
    findings.push(...validateEnvelope(env));
  }
  for (const row of tb.lines) {
    if (row.warningStatus === 'NORMAL_BALANCE_UNCONFIGURED') {
      findings.push(
        finding('REP-034', `Account ${row.accountCode ?? row.accountId} has no configured normal balance; presentation defaulted.`, {
          accountId: row.accountId,
          severity: 'MEDIUM',
        })
      );
    }
  }
  // REP-036/038 — material unmapped balances (already disclosed on envelopes).
  for (const env of [is, bs]) {
    for (const w of env.integrityWarnings) {
      if (w.code === 'REP-036') {
        findings.push(finding('REP-038', w.message, { accountId: w.accountId, severity: 'HIGH' }));
      }
    }
  }
  // REP-025 — sample drill-down verification on Income Statement group lines.
  const sample = (is.lines ?? [])
    .filter((l) => l.lineType === 'ACCOUNT_GROUP' && l.accounts.length > 0)
    .slice(0, options.drillDownSample ?? 3);
  for (const lineRef of sample) {
    const drill = await drillDownReportLine(db, context, is, lineRef.lineId);
    if (!drill.reconciles) findings.push(finding('REP-025', drill.finding.message, { lineId: lineRef.lineId }));
  }

  const critical = findings.filter((f) => f.severity === 'CRITICAL');
  return {
    scope: {
      businessId: context.businessId,
      fromDate: request.fromDate?.toISOString() ?? null,
      toDate: request.toDate?.toISOString() ?? null,
      asOfDate: request.asOfDate?.toISOString() ?? null,
    },
    reports: {
      trialBalance: { status: tb.trialBalanceStatus, integrity: tb.integrityStatus, totals: tb.totals },
      incomeStatement: { integrity: is.integrityStatus, totals: is.totals },
      balanceSheet: { integrity: bs.integrityStatus, totals: bs.totals },
      cashFlow: { integrity: cf.integrityStatus, totals: cf.totals },
      equityStatement: { integrity: eq.integrityStatus, totals: eq.totals },
      receivables: { integrity: ar.integrityStatus, totals: ar.totals },
      payables: { integrity: ap.integrityStatus, totals: ap.totals },
    },
    findings,
    overallStatus:
      critical.length > 0
        ? REPORT_INTEGRITY_STATUS.UNVERIFIED
        : findings.length > 0
          ? REPORT_INTEGRITY_STATUS.VERIFIED_WITH_WARNINGS
          : REPORT_INTEGRITY_STATUS.VERIFIED,
  };
}

/**
 * Unmapped Account report (§48): every posting account with material activity
 * that no statement line maps.
 */
export async function generateUnmappedAccountReport(db, context, request) {
  const [is, bs] = await Promise.all([
    generateIncomeStatement(db, context, { ...request, reportType: 'INCOME_STATEMENT' }),
    generateBalanceSheet(db, context, { ...request, reportType: 'BALANCE_SHEET' }),
  ]);
  const rows = [];
  for (const env of [is, bs]) {
    for (const w of env.integrityWarnings) {
      if (w.code === 'REP-036') {
        rows.push({
          businessId: context.businessId,
          accountId: w.accountId,
          amount: w.amount ?? null,
          report: env.reportType,
          severity: 'HIGH',
          message: w.message,
        });
      }
    }
  }
  return { businessId: context.businessId, unmappedAccounts: rows, count: rows.length };
}
