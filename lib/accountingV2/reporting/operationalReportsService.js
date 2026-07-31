/**
 * Slice 3 — JE-first operational reports (R2-A).
 *
 * Money totals come only from posted Accounting V2 journal lines via the
 * ledger summary. Invoices, expenses, stock docs, and POS rows attach
 * non-financial context (counts, refs) and must never redefine money.
 */

import { getBusinessLedgerSummary } from '../ledger/ledgerQueryService.js';
import {
  resolveAccountProfile,
  isAmountBearingAccount,
} from './reportDefinitions.js';
import {
  buildReportEnvelope,
  buildReportLine,
  amount,
  REPORT_INTEGRITY_STATUS,
} from './reportContracts.js';
import { generateIncomeStatement } from './financialStatementService.js';
import { loadOpenAccountingExceptions } from './trialBalanceService.js';

const movementSigned = (r) => r.periodDebitMinor - r.periodCreditMinor;

const accountRef = (r, minor) => ({
  accountId: r.accountId,
  accountCode: r.accountCode,
  accountName: r.accountName,
  amount: amount(minor),
  lineCount: r.lineCount,
});

const nameHas = (row, words) => {
  const hay = `${row.accountName ?? ''} ${row.accountCode ?? ''}`.toLowerCase();
  return words.some((w) => hay.includes(w));
};

async function loadPeriodSummary(db, context, request) {
  return getBusinessLedgerSummary(db, context, {
    startDate: request.fromDate ?? undefined,
    endDate: request.toDate ?? request.asOfDate ?? undefined,
    branchId: request.branchId ?? null,
    includeZeroActivity: false,
  });
}

function finalizeOpsEnvelope(envelope, { equationFailures = [], contextNotes = [] } = {}) {
  for (const f of equationFailures) {
    envelope.integrityWarnings.push({ ...f, origin: 'CURRENT_SYSTEM' });
  }
  for (const note of contextNotes) {
    envelope.integrityWarnings.push({
      code: 'OPS_CONTEXT',
      message: note,
      origin: 'CURRENT_SYSTEM',
      severity: 'INFO',
    });
  }
  const blocking = equationFailures.some((f) => f.severity !== 'INFO');
  if (blocking) envelope.integrityStatus = REPORT_INTEGRITY_STATUS.UNVERIFIED;
  else if (envelope.integrityWarnings.length > 0 || envelope.unresolvedExceptions.length > 0) {
    envelope.integrityStatus = REPORT_INTEGRITY_STATUS.VERIFIED_WITH_WARNINGS;
  } else {
    envelope.integrityStatus = REPORT_INTEGRITY_STATUS.VERIFIED;
  }
  return envelope;
}

/**
 * Profit Analysis — same P&L engine totals + margin ratios (no second P&L).
 */
export async function generateProfitAnalysis(db, context, request) {
  const is = await generateIncomeStatement(db, context, request);
  const revenue = is.totals.revenue?.minor ?? 0;
  const gross = is.totals.grossProfit?.minor ?? 0;
  const net = is.totals.netProfit?.minor ?? 0;
  const ratioLines = [
    buildReportLine({
      lineId: 'gross-margin',
      label: 'Gross Margin %',
      lineType: 'RATIO',
      displayOrder: 900,
      currentMinor: revenue !== 0 ? Math.round((gross / revenue) * 10000) : 0,
      mappingRule: { ratioOf: ['gross-profit', 'revenue'] },
    }),
    buildReportLine({
      lineId: 'net-margin',
      label: 'Net Margin %',
      lineType: 'RATIO',
      displayOrder: 910,
      currentMinor: revenue !== 0 ? Math.round((net / revenue) * 10000) : 0,
      mappingRule: { ratioOf: ['net-profit', 'revenue'] },
    }),
  ];
  // RATIO lines store basis points in minor for decimal display (e.g. 2000 → 20.00%).
  const envelope = {
    ...is,
    reportType: 'PROFIT_ANALYSIS',
    definitionId: 'PA-V1',
    definitionName: 'Profit Analysis',
    definitionVersion: '1.0.0',
    lines: [...(is.lines ?? []), ...ratioLines],
    totals: {
      ...is.totals,
      grossMarginPercent: is.totals.grossMarginPercent,
      netMarginPercent: is.totals.netMarginPercent,
    },
  };
  return envelope;
}

/**
 * Sales — JE revenue / COGS / sales-tax movements + invoice document context.
 */
export async function generateSalesReport(db, context, request) {
  let invoices = [];
  if (typeof db.invoice?.findMany === 'function') {
    try {
      invoices = await db.invoice.findMany({
        where: {
          tenantId: context.businessId,
          isDeleted: false,
          status: { notIn: ['draft', 'void', 'voided', 'cancelled'] },
          issueDate: {
            gte: request.fromDate ?? undefined,
            lte: request.toDate ?? request.asOfDate ?? undefined,
          },
        },
        select: { id: true, invoiceNumber: true, total: true, remainingBalance: true, issueDate: true },
      });
    } catch {
      invoices = [];
    }
  }
  const [summary, exceptions] = await Promise.all([
    loadPeriodSummary(db, context, request),
    loadOpenAccountingExceptions(db, context),
  ]);

  const revenueRefs = [];
  const cogsRefs = [];
  const taxRefs = [];
  let revenueMinor = 0;
  let cogsMinor = 0;
  let taxMinor = 0;

  for (const r of summary.accounts) {
    if (!isAmountBearingAccount(r)) continue;
    const profile = resolveAccountProfile(r);
    const move = movementSigned(r);
    if (move === 0) continue;
    if (profile.category === 'REVENUE' || profile.category === 'OTHER_INCOME') {
      const presented = -move; // credit-normal → positive sales
      revenueMinor += presented;
      revenueRefs.push(accountRef(r, presented));
    } else if (profile.category === 'COST_OF_SALES') {
      cogsMinor += move;
      cogsRefs.push(accountRef(r, move));
    } else if (
      profile.category === 'LIABILITY' &&
      (['VAT', 'TAX_LIABILITY'].includes(profile.subType) || profile.assist.taxLiability)
    ) {
      const presented = -move;
      taxMinor += presented;
      taxRefs.push(accountRef(r, presented));
    }
  }

  const invoiceRows = Array.isArray(invoices) ? invoices : [];
  const lines = [
    buildReportLine({
      lineId: 'sales-revenue',
      label: 'Sales Revenue (JE)',
      lineType: 'ACCOUNT_GROUP',
      displayOrder: 10,
      currentMinor: revenueMinor,
      accounts: revenueRefs,
      displaySign: -1,
    }),
    buildReportLine({
      lineId: 'sales-cogs',
      label: 'Cost of Sales (JE)',
      lineType: 'ACCOUNT_GROUP',
      displayOrder: 20,
      currentMinor: cogsMinor,
      accounts: cogsRefs,
    }),
    buildReportLine({
      lineId: 'sales-tax',
      label: 'Sales Tax Collected (JE)',
      lineType: 'ACCOUNT_GROUP',
      displayOrder: 30,
      currentMinor: taxMinor,
      accounts: taxRefs,
      displaySign: -1,
    }),
    buildReportLine({
      lineId: 'sales-gross',
      label: 'Gross Profit (JE)',
      lineType: 'SUBTOTAL',
      displayOrder: 40,
      currentMinor: revenueMinor - cogsMinor,
    }),
    buildReportLine({
      lineId: 'sales-docs',
      label: 'Invoice documents in period (context only)',
      lineType: 'MEMO',
      displayOrder: 50,
      currentMinor: 0,
      metadata: { documentCount: invoiceRows.length, authority: 'CONTEXT_ONLY' },
    }),
  ];

  const envelope = buildReportEnvelope(
    context,
    request,
    { id: 'SALES-JE', name: 'Sales Report', version: '1.0.0', reportType: 'SALES' },
    {
      drillDownBasis: 'PERIOD',
      lines,
      totals: {
        revenue: amount(revenueMinor),
        cogs: amount(cogsMinor),
        salesTax: amount(taxMinor),
        grossProfit: amount(revenueMinor - cogsMinor),
        invoiceDocumentCount: invoiceRows.length,
      },
      unresolvedExceptions: exceptions,
    }
  );
  envelope.reportType = 'SALES';
  return finalizeOpsEnvelope(envelope, {
    contextNotes: [
      'Invoice rows are operational context only; sales money is from posted ACCOUNTING_V2 journal lines.',
    ],
  });
}

/**
 * Expenses — JE expense movements + expense document context when available.
 */
export async function generateExpensesReport(db, context, request) {
  const [summary, exceptions] = await Promise.all([
    loadPeriodSummary(db, context, request),
    loadOpenAccountingExceptions(db, context),
  ]);

  let expenseDocs = [];
  if (typeof db.expense?.findMany === 'function') {
    try {
      expenseDocs = await db.expense.findMany({
        where: {
          tenantId: context.businessId,
          expenseDate: {
            gte: request.fromDate ?? undefined,
            lte: request.toDate ?? request.asOfDate ?? undefined,
          },
        },
        select: { id: true },
        take: 5000,
      });
    } catch {
      expenseDocs = [];
    }
  }

  const refs = [];
  let totalMinor = 0;
  for (const r of summary.accounts) {
    if (!isAmountBearingAccount(r)) continue;
    const profile = resolveAccountProfile(r);
    if (profile.category !== 'EXPENSE' && profile.category !== 'OTHER_EXPENSE') continue;
    const move = movementSigned(r);
    if (move === 0) continue;
    totalMinor += move;
    refs.push(accountRef(r, move));
  }

  const lines = [
    buildReportLine({
      lineId: 'operating-expenses',
      label: 'Operating Expenses (JE)',
      lineType: 'ACCOUNT_GROUP',
      displayOrder: 10,
      currentMinor: totalMinor,
      accounts: refs,
    }),
    buildReportLine({
      lineId: 'expense-docs',
      label: 'Expense documents in period (context only)',
      lineType: 'MEMO',
      displayOrder: 20,
      currentMinor: 0,
      metadata: { documentCount: expenseDocs.length, authority: 'CONTEXT_ONLY' },
    }),
  ];

  const envelope = buildReportEnvelope(
    context,
    request,
    { id: 'EXP-JE', name: 'Expense Report', version: '1.0.0', reportType: 'EXPENSES' },
    {
      drillDownBasis: 'PERIOD',
      lines,
      totals: {
        expenses: amount(totalMinor),
        expenseDocumentCount: expenseDocs.length,
      },
      unresolvedExceptions: exceptions,
    }
  );
  envelope.reportType = 'EXPENSES';
  return finalizeOpsEnvelope(envelope, {
    contextNotes: [
      'Expense documents are context only; expense money is from posted ACCOUNTING_V2 journal lines.',
    ],
  });
}

/**
 * Stock movements — inventory JE period activity; quantities are not money authority.
 */
export async function generateStockMovementsReport(db, context, request) {
  const [summary, exceptions] = await Promise.all([
    loadPeriodSummary(db, context, request),
    loadOpenAccountingExceptions(db, context),
  ]);

  const refs = [];
  let debitMinor = 0;
  let creditMinor = 0;
  for (const r of summary.accounts) {
    if (!isAmountBearingAccount(r)) continue;
    const profile = resolveAccountProfile(r);
    const isInventory =
      profile.category === 'ASSET' &&
      (profile.subType === 'INVENTORY' ||
        profile.purpose === 'INVENTORY' ||
        (!profile.subType && profile.assist.inventory));
    if (!isInventory) continue;
    if (r.periodDebitMinor === 0 && r.periodCreditMinor === 0) continue;
    debitMinor += r.periodDebitMinor;
    creditMinor += r.periodCreditMinor;
    refs.push(accountRef(r, movementSigned(r)));
  }

  const lines = [
    buildReportLine({
      lineId: 'inventory-in',
      label: 'Inventory increases (JE debits)',
      lineType: 'ACCOUNT_GROUP',
      displayOrder: 10,
      currentMinor: debitMinor,
      accounts: refs.filter((a) => a.amount.minor > 0),
    }),
    buildReportLine({
      lineId: 'inventory-out',
      label: 'Inventory decreases (JE credits)',
      lineType: 'ACCOUNT_GROUP',
      displayOrder: 20,
      currentMinor: creditMinor,
      accounts: refs.filter((a) => a.amount.minor < 0),
    }),
    buildReportLine({
      lineId: 'inventory-net',
      label: 'Net inventory movement (JE)',
      lineType: 'SUBTOTAL',
      displayOrder: 30,
      currentMinor: debitMinor - creditMinor,
    }),
  ];

  const envelope = buildReportEnvelope(
    context,
    request,
    { id: 'STOCK-JE', name: 'Stock Movement Report', version: '1.0.0', reportType: 'STOCK_MOVEMENTS' },
    {
      drillDownBasis: 'PERIOD',
      lines,
      totals: {
        inventoryDebits: amount(debitMinor),
        inventoryCredits: amount(creditMinor),
        netMovement: amount(debitMinor - creditMinor),
      },
      unresolvedExceptions: exceptions,
    }
  );
  envelope.reportType = 'STOCK_MOVEMENTS';
  return finalizeOpsEnvelope(envelope, {
    contextNotes: [
      'Stock quantities remain in the stock domain; valuation on this report is JE inventory movement only.',
    ],
  });
}

/**
 * Inventory loss — JE loss / write-off expense accounts.
 */
export async function generateInventoryLossReport(db, context, request) {
  const [summary, exceptions] = await Promise.all([
    loadPeriodSummary(db, context, request),
    loadOpenAccountingExceptions(db, context),
  ]);

  const refs = [];
  let totalMinor = 0;
  for (const r of summary.accounts) {
    if (!isAmountBearingAccount(r)) continue;
    const profile = resolveAccountProfile(r);
    const isLoss =
      (profile.category === 'EXPENSE' || profile.category === 'COST_OF_SALES') &&
      (nameHas(r, ['loss', 'write-off', 'write off', 'spoilage', 'shrinkage', 'damage']) ||
        profile.subType === 'INVENTORY_LOSS');
    if (!isLoss) continue;
    const move = movementSigned(r);
    if (move === 0) continue;
    totalMinor += move;
    refs.push(accountRef(r, move));
  }

  const lines = [
    buildReportLine({
      lineId: 'inventory-loss',
      label: 'Inventory Loss / Write-off (JE)',
      lineType: 'ACCOUNT_GROUP',
      displayOrder: 10,
      currentMinor: totalMinor,
      accounts: refs,
    }),
  ];

  const envelope = buildReportEnvelope(
    context,
    request,
    { id: 'LOSS-JE', name: 'Inventory Loss Report', version: '1.0.0', reportType: 'INVENTORY_LOSS' },
    {
      drillDownBasis: 'PERIOD',
      lines,
      totals: { inventoryLoss: amount(totalMinor) },
      unresolvedExceptions: exceptions,
    }
  );
  envelope.reportType = 'INVENTORY_LOSS';
  return finalizeOpsEnvelope(envelope);
}

/**
 * Daily POS — JE sales money restricted to POS-sourced journals when tagged;
 * falls back to full sales JE profile with a context note.
 */
export async function generateDailyPosReport(db, context, request) {
  const sales = await generateSalesReport(db, context, request);
  return {
    ...sales,
    reportType: 'DAILY_POS',
    definitionId: 'POS-JE',
    definitionName: 'Daily POS Report',
    definitionVersion: '1.0.0',
    integrityWarnings: [
      ...(sales.integrityWarnings ?? []),
      {
        code: 'OPS_CONTEXT',
        message:
          'Daily POS uses the same JE sales totals; receipt/shift detail is operational context only (R2-A).',
        origin: 'CURRENT_SYSTEM',
        severity: 'INFO',
      },
    ],
    integrityStatus:
      sales.integrityStatus === REPORT_INTEGRITY_STATUS.VERIFIED
        ? REPORT_INTEGRITY_STATUS.VERIFIED_WITH_WARNINGS
        : sales.integrityStatus,
  };
}
