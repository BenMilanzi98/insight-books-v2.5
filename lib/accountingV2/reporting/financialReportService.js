/**
 * Phase 7 — Financial Report Service facade.
 *
 * The single entry point every surface uses (API routes, exports, dashboard,
 * reconciliation, UI). One report type → one generator → one result contract;
 * screens and exports can never diverge because they consume the same
 * completed envelope.
 */

import { normalizeReportRequest, hashReportRequest, REPORT_TYPES } from './reportContracts.js';
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
  generateModuleReport,
  generateBudgetVsActual,
} from './subledgerReportsService.js';
import {
  generateProfitAnalysis,
  generateSalesReport,
  generateExpensesReport,
  generateStockMovementsReport,
  generateInventoryLossReport,
  generateDailyPosReport,
} from './operationalReportsService.js';
import { validateEnvelope } from './reportValidationService.js';
import { getOrBuildCachedReport } from './reportCacheService.js';
import { recordReportRun } from './reportRunService.js';
import { logAccountingOperation } from '../observability/accountingLogger.js';

const GENERATORS = Object.freeze({
  [REPORT_TYPES.TRIAL_BALANCE]: generateTrialBalance,
  [REPORT_TYPES.INCOME_STATEMENT]: generateIncomeStatement,
  [REPORT_TYPES.BALANCE_SHEET]: generateBalanceSheet,
  [REPORT_TYPES.CASH_FLOW]: generateCashFlow,
  [REPORT_TYPES.EQUITY_STATEMENT]: generateEquityStatement,
  [REPORT_TYPES.RECEIVABLES]: generateReceivablesReport,
  [REPORT_TYPES.PAYABLES]: generatePayablesReport,
  [REPORT_TYPES.INVENTORY]: (db, ctx, req) => generateModuleReport(db, ctx, req, 'INVENTORY'),
  [REPORT_TYPES.FIXED_ASSETS]: (db, ctx, req) => generateModuleReport(db, ctx, req, 'FIXED_ASSETS'),
  [REPORT_TYPES.PAYROLL]: (db, ctx, req) => generateModuleReport(db, ctx, req, 'PAYROLL'),
  [REPORT_TYPES.LOANS]: (db, ctx, req) => generateModuleReport(db, ctx, req, 'LOANS'),
  [REPORT_TYPES.TAXES]: (db, ctx, req) => generateModuleReport(db, ctx, req, 'TAXES'),
  [REPORT_TYPES.EQUITY]: (db, ctx, req) => generateModuleReport(db, ctx, req, 'EQUITY'),
  [REPORT_TYPES.BUDGET_VS_ACTUAL]: generateBudgetVsActual,
  [REPORT_TYPES.PROFIT_ANALYSIS]: generateProfitAnalysis,
  [REPORT_TYPES.SALES]: generateSalesReport,
  [REPORT_TYPES.EXPENSES]: generateExpensesReport,
  [REPORT_TYPES.STOCK_MOVEMENTS]: generateStockMovementsReport,
  [REPORT_TYPES.INVENTORY_LOSS]: generateInventoryLossReport,
  [REPORT_TYPES.DAILY_POS]: generateDailyPosReport,
});

/**
 * Generate a report through the canonical engine.
 * @param {import('@prisma/client').PrismaClient} db
 * @param {object} context AccountingContext (business from session)
 * @param {string} reportType
 * @param {object} rawParams client-supplied filters (validated)
 * @param {{useCache?: boolean, recordRun?: boolean}} [options]
 */
export async function generateReport(db, context, reportType, rawParams = {}, options = {}) {
  const request = normalizeReportRequest(context, reportType, rawParams);
  const generator = GENERATORS[reportType];
  if (!generator) {
    throw new Error(`No generator registered for report type ${reportType}.`);
  }
  const startedAt = Date.now();
  const filtersHash = hashReportRequest(request);

  let envelope;
  let cacheInfo = null;
  if (options.useCache && db.acctV2ReportCache) {
    const cached = await getOrBuildCachedReport(db, context, request, filtersHash, () =>
      generator(db, context, request)
    );
    envelope = cached.envelope;
    cacheInfo = cached.cache;
  } else {
    envelope = await generator(db, context, request);
  }

  // Envelope-level structural validation on every generation.
  const structuralFindings = validateEnvelope(envelope);
  if (structuralFindings.length > 0) {
    envelope.integrityWarnings = [...(envelope.integrityWarnings ?? []), ...structuralFindings];
    if (structuralFindings.some((f) => f.severity === 'CRITICAL')) {
      envelope.integrityStatus = 'UNVERIFIED';
    }
  }
  envelope.cache = cacheInfo;

  let run = null;
  if (options.recordRun !== false && db.acctV2ReportRun) {
    run = await recordReportRun(db, context, envelope, request);
    envelope.runId = run.id;
  }

  logAccountingOperation({
    operation: 'report.generate',
    businessId: context.businessId,
    reportType,
    definitionVersion: envelope.definitionVersion,
    integrityStatus: envelope.integrityStatus,
    durationMs: Date.now() - startedAt,
    requestId: context.requestId ?? null,
    correlationId: context.correlationId ?? null,
    cacheHit: cacheInfo?.hit ?? false,
  });
  return { envelope, request, run };
}
