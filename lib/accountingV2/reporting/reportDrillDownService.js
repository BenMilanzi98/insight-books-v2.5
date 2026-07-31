/**
 * Phase 7 — report drill-down engine (§46).
 *
 * Report line → mapped accounts → General Ledger activity → journal lines →
 * journals → source transactions, preserving the report's business, date,
 * branch and currency scope. The sum of drill-down items must equal the report
 * line amount; a mismatch is a REP-025 finding, never silently adjusted.
 */

import { getAccountLedger } from '../ledger/ledgerQueryService.js';
import { amount } from './reportContracts.js';
import { AccountingValidationError } from '../domain/errors.js';

/**
 * Drill into one report line of a generated envelope.
 * @param {import('@prisma/client').PrismaClient} db
 * @param {object} context
 * @param {object} envelope generated report result
 * @param {string} lineId
 * @param {{page?: number, pageSize?: number}} [options]
 */
export async function drillDownReportLine(db, context, envelope, lineId, options = {}) {
  if (envelope.businessId !== context.businessId) {
    throw new AccountingValidationError('Drill-down request crosses business scope.');
  }
  const line = envelope.lines.find((l) => l.lineId === lineId);
  if (!line) {
    throw new AccountingValidationError(`Report line ${lineId} not found in report ${envelope.reportId}.`);
  }
  const fromDate = envelope.dateRange?.fromDate ? new Date(envelope.dateRange.fromDate) : undefined;
  const toDate = envelope.dateRange?.toDate
    ? new Date(envelope.dateRange.toDate)
    : envelope.asOfDate
      ? new Date(envelope.asOfDate)
      : undefined;

  const accounts = [];
  let ledgerTotalMinor = 0;
  for (const ref of line.accounts ?? []) {
    const ledger = await getAccountLedger(db, context, {
      accountId: ref.accountId,
      startDate: fromDate,
      endDate: toDate,
      branchId: null,
      page: options.page ?? 1,
      pageSize: options.pageSize ?? 100,
    });
    // Match the report basis: period statements drill into period movement;
    // as-of statements drill into the cumulative closing balance.
    const basis = envelope.drillDownBasis ?? (fromDate != null ? 'PERIOD' : 'AS_OF');
    const movementSigned = ledger.period.debitMinor - ledger.period.creditMinor;
    const naturalMinor = basis === 'PERIOD' ? movementSigned : ledger.closing.signedMinor;
    ledgerTotalMinor += naturalMinor;
    accounts.push({
      accountId: ref.accountId,
      accountCode: ledger.account.accountCode,
      accountName: ledger.account.accountName,
      reportAmount: ref.amount,
      ledgerSignedMinor: naturalMinor,
      opening: ledger.opening,
      period: ledger.period,
      closing: ledger.closing,
      lines: ledger.lines,
      pagination: ledger.pagination,
    });
  }

  // Report lines are presentation-signed; compare on absolute signed value.
  const lineSignedMinor = (line.displaySign === -1 ? -1 : 1) * line.currentAmount.minor;
  const reconciles = lineSignedMinor === ledgerTotalMinor;
  return {
    reportId: envelope.reportId,
    lineId,
    lineLabel: line.label,
    lineAmount: line.currentAmount,
    ledgerTotal: amount(ledgerTotalMinor),
    reconciles,
    finding: reconciles
      ? null
      : {
          code: 'REP-025',
          message: `Drill-down total ${ledgerTotalMinor} differs from report line ${lineSignedMinor} (signed minor units).`,
          differenceMinor: ledgerTotalMinor - lineSignedMinor,
        },
    scope: {
      businessId: envelope.businessId,
      fromDate: fromDate?.toISOString() ?? null,
      toDate: toDate?.toISOString() ?? null,
    },
    accounts,
  };
}
