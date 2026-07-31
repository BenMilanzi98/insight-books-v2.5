/**
 * Slice 3 — JE-first operational reports (R2-A) reconcile to core statement totals.
 */

import { describe, it, expect } from 'vitest';
import { makeAcctV2PrismaStub } from '../helpers/acctV2PrismaStub.js';
import { createAccountingContext } from '../../lib/accountingV2/domain/accountingContext.js';
import { normalizeReportRequest } from '../../lib/accountingV2/reporting/reportContracts.js';
import { generateIncomeStatement } from '../../lib/accountingV2/reporting/financialStatementService.js';
import { generateReport } from '../../lib/accountingV2/reporting/financialReportService.js';
import { mapLegacyReportIdToV2Type } from '../../lib/accountingV2/reporting/legacyReportRedirectMap.js';
import { REPORT_TYPES } from '../../lib/accountingV2/reporting/reportContracts.js';

const T1 = 'tenant-1';
const ctx = () => createAccountingContext({ businessId: T1, userId: 'user-1', sourceChannel: 'test' });
const D = (s) => new Date(s);
const M = (major) => Math.round(major * 100);
const JULY = { fromDate: '2026-07-01', toDate: '2026-07-31T23:59:59.999Z', asOfDate: '2026-07-31T23:59:59.999Z' };

const chart = () => [
  { id: 'cash', tenantId: T1, accountCode: '1000', accountName: 'Cash', accountType: 'Asset', coaV2Category: 'ASSET', systemPurpose: 'CASH', isActive: true },
  { id: 'ar', tenantId: T1, accountCode: '1100', accountName: 'AR', accountType: 'Asset', coaV2Category: 'ASSET', coaV2SubType: 'ACCOUNTS_RECEIVABLE', isActive: true },
  { id: 'inv', tenantId: T1, accountCode: '1200', accountName: 'Inventory', accountType: 'Asset', coaV2Category: 'ASSET', coaV2SubType: 'INVENTORY', isActive: true },
  { id: 'vat', tenantId: T1, accountCode: '2100', accountName: 'VAT Payable', accountType: 'Liability', coaV2Category: 'LIABILITY', coaV2SubType: 'VAT', isActive: true },
  { id: 'rev', tenantId: T1, accountCode: '4000', accountName: 'Sales Revenue', accountType: 'Income', coaV2Category: 'REVENUE', isActive: true },
  { id: 'cogs', tenantId: T1, accountCode: '5000', accountName: 'Cost of Sales', accountType: 'Expense', coaV2Category: 'COST_OF_SALES', isActive: true },
  { id: 'rent', tenantId: T1, accountCode: '5300', accountName: 'Rent Expense', accountType: 'Expense', coaV2Category: 'EXPENSE', isActive: true },
  { id: 'loss', tenantId: T1, accountCode: '5700', accountName: 'Inventory Shrinkage Loss', accountType: 'Expense', coaV2Category: 'EXPENSE', isActive: true },
];

const v2Je = (id, date, lines) => ({
  header: {
    id,
    tenantId: T1,
    transactionId: null,
    status: 'Posted',
    entryDate: D(date),
    postingDate: D(date),
    description: id,
    createdAt: D(date),
    architectureVersion: 'ACCOUNTING_V2',
  },
  lines: lines.map(([accountId, debit, credit], i) => ({
    id: `${id}-l${i}`,
    journalEntryId: id,
    lineNumber: i + 1,
    accountId,
    debitAmount: debit,
    creditAmount: credit,
  })),
});

function seed() {
  const journals = [
    v2Je('tx-sale', '2026-07-03', [['ar', 115000, 0], ['rev', 0, 100000], ['vat', 0, 15000]]),
    v2Je('tx-cogs', '2026-07-10', [['cogs', 40000, 0], ['inv', 0, 40000]]),
    v2Je('tx-rent', '2026-07-15', [['rent', 10000, 0], ['cash', 0, 10000]]),
    v2Je('tx-stock-in', '2026-07-05', [['inv', 90000, 0], ['cash', 0, 90000]]),
    v2Je('tx-loss', '2026-07-20', [['loss', 5000, 0], ['inv', 0, 5000]]),
  ];
  return makeAcctV2PrismaStub({
    accounts: chart(),
    legacyTransactions: [],
    transactionLines: [],
    legacyJournalEntries: journals.map((j) => j.header),
    journalEntryLines: journals.flatMap((j) => j.lines),
    invoices: [
      {
        id: 'inv1',
        tenantId: T1,
        invoiceNumber: 'INV-001',
        clientId: 'c1',
        isDeleted: false,
        status: 'sent',
        issueDate: D('2026-07-03'),
        dueDate: D('2026-07-15'),
        total: 115000,
        remainingBalance: 115000,
      },
    ],
  });
}

const req = (type, raw = JULY) => normalizeReportRequest(ctx(), type, raw);

describe('operational JE reports (Slice 3)', () => {
  it('maps legacy ops selectors to dedicated V2 types', () => {
    expect(mapLegacyReportIdToV2Type('sales-report')).toBe(REPORT_TYPES.SALES);
    expect(mapLegacyReportIdToV2Type('expense-report')).toBe(REPORT_TYPES.EXPENSES);
    expect(mapLegacyReportIdToV2Type('stock-movement')).toBe(REPORT_TYPES.STOCK_MOVEMENTS);
    expect(mapLegacyReportIdToV2Type('inventory-loss-report')).toBe(REPORT_TYPES.INVENTORY_LOSS);
    expect(mapLegacyReportIdToV2Type('pos-daily')).toBe(REPORT_TYPES.DAILY_POS);
    expect(mapLegacyReportIdToV2Type('profit-analysis')).toBe(REPORT_TYPES.PROFIT_ANALYSIS);
  });

  it('SALES revenue and COGS reconcile to Income Statement', async () => {
    const { client } = seed();
    const is = await generateIncomeStatement(client, ctx(), req('INCOME_STATEMENT'));
    const { envelope: sales } = await generateReport(client, ctx(), 'SALES', JULY, { recordRun: false });
    expect(sales.totals.revenue.minor).toBe(is.totals.revenue.minor);
    expect(sales.totals.cogs.minor).toBe(M(40000));
    expect(sales.totals.grossProfit.minor).toBe(M(60000));
    expect(sales.totals.invoiceDocumentCount).toBe(1);
  });

  it('PROFIT_ANALYSIS reuses Income Statement net profit', async () => {
    const { client } = seed();
    const is = await generateIncomeStatement(client, ctx(), req('INCOME_STATEMENT'));
    const { envelope: pa } = await generateReport(client, ctx(), 'PROFIT_ANALYSIS', JULY, {
      recordRun: false,
    });
    expect(pa.totals.netProfit.minor).toBe(is.totals.netProfit.minor);
    expect(pa.lines.some((l) => l.lineId === 'gross-margin')).toBe(true);
  });

  it('EXPENSES sums JE expense accounts only', async () => {
    const { client } = seed();
    const { envelope: exp } = await generateReport(client, ctx(), 'EXPENSES', JULY, {
      recordRun: false,
    });
    // rent 10k + loss 5k (both EXPENSE); COGS excluded
    expect(exp.totals.expenses.minor).toBe(M(15000));
  });

  it('STOCK_MOVEMENTS reports inventory JE debits and credits', async () => {
    const { client } = seed();
    const { envelope: stock } = await generateReport(client, ctx(), 'STOCK_MOVEMENTS', JULY, {
      recordRun: false,
    });
    expect(stock.totals.inventoryDebits.minor).toBe(M(90000));
    expect(stock.totals.inventoryCredits.minor).toBe(M(45000)); // COGS 40k + loss 5k
  });

  it('INVENTORY_LOSS picks loss-named expense JE activity', async () => {
    const { client } = seed();
    const { envelope: loss } = await generateReport(client, ctx(), 'INVENTORY_LOSS', JULY, {
      recordRun: false,
    });
    expect(loss.totals.inventoryLoss.minor).toBe(M(5000));
  });
});
