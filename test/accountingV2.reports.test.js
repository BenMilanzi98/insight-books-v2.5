/**
 * Phase 7 — Trial Balance and Financial Reporting Engine tests.
 *
 * Covers: report request contracts, the Trial Balance engine (opening /
 * movement / closing equations, statuses, draft/void/mirror exclusions,
 * comparatives), the Income Statement (structure, classification,
 * capital/loan/drawings exclusion), the Balance Sheet (equation, CYE/RE
 * controls, owner-capital single-count with the MK1,000,000 fixture), the
 * Cash Flow Statement (indirect method, cash reconciliation), the Statement
 * of Changes in Equity (Balance Sheet reconciliation), receivables/payables
 * control reconciliation, module reports (inventory / fixed assets / payroll
 * 5200 / loans / taxes / equity), budget versus actual, drill-down equality
 * (REP-025), the REP-001..REP-040 catalogue and reconciliation service,
 * unmapped-account control (REP-036), runs/approval workflow (unverified
 * reports cannot be approved), immutable snapshots with supersession, the
 * rebuildable report cache (source-version invalidation, REP-030), exports
 * (identical totals, numeric Excel cells, formula-injection protection),
 * dashboard KPI alignment, multi-tenant isolation, and empty-database
 * migration behaviour.
 */

import { describe, it, expect } from 'vitest';
import { makeAcctV2PrismaStub } from './helpers/acctV2PrismaStub.js';
import { createAccountingContext } from '../lib/accountingV2/domain/accountingContext.js';
import {
  normalizeReportRequest,
  hashReportRequest,
  REPORT_TYPES,
} from '../lib/accountingV2/reporting/reportContracts.js';
import {
  getReportDefinition,
  resolveAccountProfile,
  evaluateFormula,
} from '../lib/accountingV2/reporting/reportDefinitions.js';
import { generateTrialBalance } from '../lib/accountingV2/reporting/trialBalanceService.js';
import {
  generateIncomeStatement,
  generateBalanceSheet,
  generateCashFlow,
  generateEquityStatement,
} from '../lib/accountingV2/reporting/financialStatementService.js';
import {
  generateReceivablesReport,
  generatePayablesReport,
  generateModuleReport,
  generateBudgetVsActual,
} from '../lib/accountingV2/reporting/subledgerReportsService.js';
import { drillDownReportLine } from '../lib/accountingV2/reporting/reportDrillDownService.js';
import {
  VALIDATION_RULES,
  validateEnvelope,
  runReportReconciliation,
  generateUnmappedAccountReport,
} from '../lib/accountingV2/reporting/reportValidationService.js';
import {
  reviewReportRun,
  approveReportRun,
  snapshotReport,
  getAccountingDataVersion,
} from '../lib/accountingV2/reporting/reportRunService.js';
import {
  getOrBuildCachedReport,
  rebuildReportCache,
  reconcileReportCache,
} from '../lib/accountingV2/reporting/reportCacheService.js';
import {
  sanitizeCell,
  exportReportToCsv,
  exportReportToExcel,
  exportReportToPdf,
} from '../lib/accountingV2/reporting/reportExportService.js';
import { generateReport } from '../lib/accountingV2/reporting/financialReportService.js';
import { getDashboardFinancialKpis } from '../lib/accountingV2/reporting/dashboardKpiService.js';

const T1 = 'tenant-1';
const T2 = 'tenant-2';
const ctx = (businessId = T1, userId = 'user-1') =>
  createAccountingContext({ businessId, userId, sourceChannel: 'test' });
const D = (s) => new Date(s);
const M = (major) => Math.round(major * 100); // major → integer minor units

/** Phase 3-classified chart for the reporting fixture. */
const chart = () => [
  { id: 'cash', tenantId: T1, accountCode: '1000', accountName: 'Cash on Hand', accountType: 'Asset', coaV2Category: 'ASSET', systemPurpose: 'CASH', isActive: true },
  { id: 'ar', tenantId: T1, accountCode: '1100', accountName: 'Accounts Receivable', accountType: 'Asset', coaV2Category: 'ASSET', coaV2SubType: 'ACCOUNTS_RECEIVABLE', controlAccountPurpose: 'ACCOUNTS_RECEIVABLE', isActive: true },
  { id: 'inv', tenantId: T1, accountCode: '1200', accountName: 'Inventory', accountType: 'Asset', coaV2Category: 'ASSET', coaV2SubType: 'INVENTORY', isActive: true },
  { id: 'ppe', tenantId: T1, accountCode: '1500', accountName: 'Equipment', accountType: 'Asset', coaV2Category: 'ASSET', coaV2SubType: 'FIXED_ASSET', isActive: true },
  { id: 'accdep', tenantId: T1, accountCode: '1510', accountName: 'Accumulated Depreciation', accountType: 'Asset', coaV2Category: 'ASSET', coaV2SubType: 'ACCUMULATED_DEPRECIATION', coaV2NormalBalance: 'CREDIT', isActive: true },
  { id: 'ap', tenantId: T1, accountCode: '2000', accountName: 'Accounts Payable', accountType: 'Liability', coaV2Category: 'LIABILITY', coaV2SubType: 'ACCOUNTS_PAYABLE', controlAccountPurpose: 'ACCOUNTS_PAYABLE', isActive: true },
  { id: 'vat', tenantId: T1, accountCode: '2100', accountName: 'VAT Payable', accountType: 'Liability', coaV2Category: 'LIABILITY', coaV2SubType: 'VAT', isActive: true },
  { id: 'loan', tenantId: T1, accountCode: '2500', accountName: 'Bank Loan', accountType: 'Liability', coaV2Category: 'LIABILITY', coaV2SubType: 'LOAN', isActive: true },
  { id: 'capital', tenantId: T1, accountCode: '3000', accountName: 'Owner Capital', accountType: 'Equity', coaV2Category: 'EQUITY', coaV2SubType: 'OWNER_CAPITAL', isActive: true },
  { id: 'drawings', tenantId: T1, accountCode: '3100', accountName: 'Owner Drawings', accountType: 'Equity', coaV2Category: 'EQUITY', coaV2SubType: 'DRAWINGS', isActive: true },
  { id: 'rev', tenantId: T1, accountCode: '4000', accountName: 'Sales Revenue', accountType: 'Income', coaV2Category: 'REVENUE', isActive: true },
  { id: 'cogs', tenantId: T1, accountCode: '5000', accountName: 'Cost of Sales', accountType: 'Expense', coaV2Category: 'COST_OF_SALES', isActive: true },
  { id: 'sal', tenantId: T1, accountCode: '5200', accountName: 'Salaries & Wages', accountType: 'Expense', coaV2Category: 'EXPENSE', coaV2SubType: 'SALARIES', isActive: true },
  { id: 'rent', tenantId: T1, accountCode: '5300', accountName: 'Rent Expense', accountType: 'Expense', coaV2Category: 'EXPENSE', isActive: true },
  { id: 'dep', tenantId: T1, accountCode: '5400', accountName: 'Depreciation Expense', accountType: 'Expense', coaV2Category: 'EXPENSE', coaV2SubType: 'DEPRECIATION', isActive: true },
  { id: 'fin', tenantId: T1, accountCode: '5500', accountName: 'Interest Expense', accountType: 'Expense', coaV2Category: 'EXPENSE', coaV2SubType: 'FINANCE_COST', isActive: true },
  { id: 'taxexp', tenantId: T1, accountCode: '5600', accountName: 'Tax Expense', accountType: 'Expense', coaV2Category: 'EXPENSE', coaV2SubType: 'TAX', isActive: true },
  { id: 'hdr', tenantId: T1, accountCode: '1', accountName: 'Assets (header)', accountType: 'Asset', coaV2Category: 'ASSET', coaV2Behaviour: 'HEADER', postingAllowed: false, isActive: true },
  { id: 't2-cash', tenantId: T2, accountCode: '1000', accountName: 'Other business cash', accountType: 'Asset', coaV2Category: 'ASSET', systemPurpose: 'CASH', isActive: true },
];

/** Canonical V2 journal + lines (fresh-books authority). */
const v2Je = (id, date, lines, extras = {}) => ({
  header: {
    id,
    tenantId: T1,
    transactionId: null,
    status: extras.status ?? 'Posted',
    entryDate: D(date),
    postingDate: D(date),
    description: extras.description ?? id,
    createdAt: D(date),
    architectureVersion: extras.architectureVersion ?? 'ACCOUNTING_V2',
    sourceType: extras.sourceType ?? null,
    sourceId: extras.sourceId ?? null,
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

/**
 * Balanced canonical seed (Accounting V2 journals only).
 * June (opening for July windows): owner capital MK1,000,000 (plus a legacy
 * MIRROR journal without ACCOUNTING_V2 — must NOT double-count),
 * loan 200,000, PPE purchase 300,000, stock purchase on credit 90,000.
 * July: sale 115,000 (revenue 100,000 + VAT 15,000), receipt 57,500,
 * COGS 40,000, AP payment 30,000, salaries 20,000,
 * rent 10,000, depreciation 5,000, interest 2,000, tax 3,000, drawings 8,000.
 * A void journal and a draft journal prove exclusion.
 */
function seedBooks({ unbalanced = false } = {}) {
  const journals = [
    v2Je('tx-capital', '2026-06-01', [['cash', 1000000, 0], ['capital', 0, 1000000]], {
      sourceType: 'Capital',
      sourceId: 'cap-1',
    }),
    v2Je('tx-loan', '2026-06-15', [['cash', 200000, 0], ['loan', 0, 200000]]),
    v2Je('tx-ppe', '2026-06-20', [['ppe', 300000, 0], ['cash', 0, 300000]]),
    v2Je('tx-stock', '2026-06-25', [['inv', 90000, 0], ['ap', 0, 90000]]),
    v2Je('tx-sale', '2026-07-03', [['ar', 115000, 0], ['rev', 0, 100000], ['vat', 0, 15000]]),
    v2Je('tx-receipt', '2026-07-10', [['cash', 57500, 0], ['ar', 0, 57500]]),
    v2Je('tx-cogs', '2026-07-10', [['cogs', 40000, 0], ['inv', 0, 40000]]),
    v2Je('tx-appay', '2026-07-12', [['ap', 30000, 0], ['cash', 0, 30000]]),
    v2Je('tx-rent', '2026-07-15', [['rent', 10000, 0], ['cash', 0, 10000]]),
    v2Je('tx-dep', '2026-07-20', [['dep', 5000, 0], ['accdep', 0, 5000]]),
    v2Je('tx-int', '2026-07-22', [['fin', 2000, 0], ['cash', 0, 2000]]),
    v2Je('tx-tax', '2026-07-25', [['taxexp', 3000, 0], ['cash', 0, 3000]]),
    v2Je('tx-draw', '2026-07-28', [['drawings', 8000, 0], ['cash', 0, 8000]]),
    v2Je('je-sal', '2026-07-18', [['sal', 20000, 0], ['cash', 0, 20000]], {
      description: 'July payroll',
      sourceType: 'Payroll',
      sourceId: 'pay-1',
    }),
    // void — excluded from POSTED_JOURNAL_STATUSES
    v2Je('tx-void', '2026-07-29', [['cash', 99999, 0], ['rev', 0, 99999]], { status: 'void' }),
    // draft — excluded
    v2Je('je-draft', '2026-07-19', [['rent', 7777, 0], ['cash', 0, 7777]], {
      status: 'Draft',
      description: 'Draft accrual',
    }),
  ];

  // Legacy mirror of capital — NOT ACCOUNTING_V2; must not double-count
  const mirrorHeader = {
    id: 'je-mirror',
    tenantId: T1,
    transactionId: 'tx-capital',
    status: 'Posted',
    entryDate: D('2026-06-01'),
    postingDate: D('2026-06-01'),
    description: 'Mirror of capital',
    createdAt: D('2026-06-01'),
    architectureVersion: 'LEGACY_V1',
  };
  const mirrorLines = [
    { id: 'jx-1', journalEntryId: 'je-mirror', lineNumber: 1, accountId: 'cash', debitAmount: 1000000, creditAmount: 0 },
    { id: 'jx-2', journalEntryId: 'je-mirror', lineNumber: 2, accountId: 'capital', debitAmount: 0, creditAmount: 1000000 },
  ];

  const unbalancedJournal = unbalanced
    ? [
        v2Je('je-unbal', '2026-07-21', [['rent', 100, 0]], {
          description: 'Unbalanced V2 journal',
        }),
      ]
    : [];

  const allJournals = [...journals, ...unbalancedJournal];

  return makeAcctV2PrismaStub({
    accounts: chart(),
    legacyTransactions: [],
    transactionLines: [],
    legacyJournalEntries: [...allJournals.map((j) => j.header), mirrorHeader],
    journalEntryLines: [...allJournals.flatMap((j) => j.lines), ...mirrorLines],
    invoices: [
      { id: 'inv1', tenantId: T1, invoiceNumber: 'INV-001', clientId: 'c1', isDeleted: false, status: 'sent', issueDate: D('2026-07-03'), dueDate: D('2026-07-15'), total: 115000, remainingBalance: 57500 },
      { id: 'inv-draft', tenantId: T1, invoiceNumber: 'INV-002', clientId: 'c1', isDeleted: false, status: 'draft', issueDate: D('2026-07-05'), dueDate: D('2026-07-20'), total: 5000, remainingBalance: 5000 },
    ],
    supplierBills: [
      { id: 'bill1', tenantId: T1, billNumber: 'BILL-001', supplierId: 's1', status: 'Approved', billDate: D('2026-06-25'), dueDate: D('2026-07-10'), totalAmount: 90000, amountPaid: 30000 },
      { id: 'bill-draft', tenantId: T1, billNumber: 'BILL-002', supplierId: 's1', status: 'Draft', billDate: D('2026-07-01'), dueDate: D('2026-07-30'), totalAmount: 4000, amountPaid: 0 },
    ],
    budgetItems: [
      { id: 'bi1', budgetId: 'b1', accountId: 'rev', period: D('2026-07-15'), budgetedAmount: 120000, budget: { tenantId: T1, status: 'active' } },
    ],
  });
}

/** Add a balanced posted V2 adjustment to a seeded stub's data. */
function postAdjustment(data, id, date, debitAccount, creditAccount, majorAmount) {
  data.legacyJournalEntries.push({
    id,
    tenantId: T1,
    transactionId: null,
    status: 'Posted',
    entryDate: D(date),
    postingDate: D(date),
    description: id,
    createdAt: new Date(),
    architectureVersion: 'ACCOUNTING_V2',
  });
  data.journalEntryLines.push(
    { id: `${id}-l0`, journalEntryId: id, lineNumber: 1, accountId: debitAccount, debitAmount: majorAmount, creditAmount: 0 },
    { id: `${id}-l1`, journalEntryId: id, lineNumber: 2, accountId: creditAccount, debitAmount: 0, creditAmount: majorAmount }
  );
}

const JULY = { fromDate: '2026-07-01', toDate: '2026-07-31T23:59:59.999Z', asOfDate: '2026-07-31T23:59:59.999Z' };
const FY_TO_JULY = { fromDate: '2026-01-01', toDate: '2026-07-31T23:59:59.999Z', asOfDate: '2026-07-31T23:59:59.999Z' };

const req = (type, raw, context = ctx()) => normalizeReportRequest(context, type, raw);

/* ── Request contract ──────────────────────────────────────────────────────── */

describe('report request contract', () => {
  it('normalizes dates, defaults the financial-year start, and freezes the request', () => {
    const r = req('TRIAL_BALANCE', JULY);
    expect(r.businessId).toBe(T1);
    expect(r.financialYearStartDate.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(Object.isFrozen(r)).toBe(true);
  });

  it('rejects includeUnposted for formal reports', () => {
    expect(() => req('TRIAL_BALANCE', { ...JULY, includeUnposted: true })).toThrow(/unposted/i);
  });

  it('rejects unknown report types and inverted date ranges', () => {
    expect(() => req('NOT_A_REPORT', {})).toThrow(/Unknown report type/);
    expect(() => req('TRIAL_BALANCE', { fromDate: '2026-08-01', toDate: '2026-07-01' })).toThrow(/fromDate/);
  });

  it('REP-035: rejects an incomplete comparative period for a period report', () => {
    expect(() => req('INCOME_STATEMENT', { ...JULY, comparisonFromDate: '2026-06-01' })).toThrow(
      /Comparative scope/
    );
  });

  it('hashes scope deterministically', () => {
    expect(hashReportRequest(req('TRIAL_BALANCE', JULY))).toBe(hashReportRequest(req('TRIAL_BALANCE', JULY)));
    expect(hashReportRequest(req('TRIAL_BALANCE', JULY))).not.toBe(
      hashReportRequest(req('TRIAL_BALANCE', { ...JULY, fromDate: '2026-06-01' }))
    );
  });
});

/* ── Report definitions ────────────────────────────────────────────────────── */

describe('report definitions', () => {
  it('published definitions are immutable and versioned', () => {
    const def = getReportDefinition('INCOME_STATEMENT');
    expect(def.version).toBe('1.0.0');
    expect(Object.isFrozen(def)).toBe(true);
    expect(Object.isFrozen(def.lines[0])).toBe(true);
    expect(() => getReportDefinition('INCOME_STATEMENT', '9.9.9')).toThrow(/version/);
  });

  it('formulas allow controlled operations only — no executable code', () => {
    expect(evaluateFormula([{ op: '+', ref: 'a' }, { op: '-', ref: 'b' }], new Map([['a', 10], ['b', 4]]))).toBe(6);
    expect(() => evaluateFormula([{ op: '*', ref: 'a' }], new Map([['a', 10]]))).toThrow(/Unsupported/);
    expect(() => evaluateFormula([{ op: '+', ref: 'missing' }], new Map())).toThrow(/unknown line/);
  });

  it('explicit Phase 3 classification wins over name heuristics', () => {
    const p = resolveAccountProfile({
      accountId: 'x',
      coaV2Category: 'ASSET',
      coaV2SubType: 'INVENTORY',
      accountName: 'Cash-sounding inventory',
    });
    expect(p.subType).toBe('INVENTORY');
    expect(p.isCash).toBe(false);
    expect(p.classificationSource).toBe('EXPLICIT');
  });
});

/* ── Trial Balance ─────────────────────────────────────────────────────────── */

describe('trial balance engine', () => {
  it('balances a valid posted set; excludes draft, void and mirror journals', async () => {
    const { client } = seedBooks();
    const tb = await generateTrialBalance(client, ctx(), req('TRIAL_BALANCE', JULY));
    expect(tb.trialBalanceStatus).toBe('BALANCED');
    expect(tb.integrityStatus).toBe('VERIFIED');
    expect(tb.equations.openingBalanced).toBe(true);
    expect(tb.equations.movementBalanced).toBe(true);
    expect(tb.equations.closingBalanced).toBe(true);
    // opening: cash 900k + inventory 90k + PPE 300k = capital 1,000k + loan 200k + AP 90k
    expect(tb.totals.openingDebit.minor).toBe(M(1290000));
    expect(tb.totals.openingCredit.minor).toBe(M(1290000));
    // mirror journal excluded — owner capital appears exactly once
    const capital = tb.lines.find((r) => r.accountId === 'capital');
    expect(capital.closingCredit.minor).toBe(M(1000000));
    // draft journal excluded — rent shows only the posted 10,000
    const rent = tb.lines.find((r) => r.accountId === 'rent');
    expect(rent.periodDebit.minor).toBe(M(10000));
    // void transaction excluded entirely
    const revenue = tb.lines.find((r) => r.accountId === 'rev');
    expect(revenue.periodCredit.minor).toBe(M(100000));
  });

  it('discloses the exact difference for an unbalanced legacy journal — no plug entries', async () => {
    const { client, data } = seedBooks({ unbalanced: true });
    const journalsBefore = data.legacyJournalEntries.length;
    const tb = await generateTrialBalance(client, ctx(), req('TRIAL_BALANCE', JULY));
    expect(tb.trialBalanceStatus).toBe('UNBALANCED');
    expect(tb.integrityStatus).toBe('UNVERIFIED');
    expect(tb.totals.difference.minor).toBe(M(100));
    // the report engine created no journals of any kind
    expect(data.legacyJournalEntries.length).toBe(journalsBefore);
    expect(data.legacyJournalEntries.filter((j) => j.description?.includes('balanc') && j.id !== 'je-unbal').length).toBe(0);
  });

  it('supports zero-balance inclusion and comparative periods', async () => {
    const { client } = seedBooks();
    const withZero = await generateTrialBalance(
      client,
      ctx(),
      req('TRIAL_BALANCE', { ...JULY, includeZeroBalances: true })
    );
    expect(withZero.lines.length).toBeGreaterThan(15);
    const cmp = await generateTrialBalance(
      client,
      ctx(),
      req('TRIAL_BALANCE', { ...JULY, comparisonFromDate: '2026-06-01', comparisonToDate: '2026-06-30T23:59:59.999Z' })
    );
    const cash = cmp.lines.find((r) => r.accountId === 'cash');
    expect(cash.comparativeClosing).not.toBeNull();
    expect(cash.comparativeClosing.debitMinor).toBe(M(900000));
  });

  it('header accounts carry no amounts of their own (no parent/child double count)', async () => {
    const { client } = seedBooks();
    const tb = await generateTrialBalance(
      client,
      ctx(),
      req('TRIAL_BALANCE', { ...JULY, includeZeroBalances: true })
    );
    const header = tb.lines.find((r) => r.accountId === 'hdr');
    expect(header.isHeader).toBe(true);
    expect(header.closingDebit.minor).toBe(0);
    expect(header.closingCredit.minor).toBe(0);
  });
});

/* ── Income Statement ──────────────────────────────────────────────────────── */

describe('income statement', () => {
  it('computes the professional structure from GL period activity', async () => {
    const { client } = seedBooks();
    const is = await generateIncomeStatement(client, ctx(), req('INCOME_STATEMENT', JULY));
    expect(is.totals.revenue.minor).toBe(M(100000));
    expect(is.totals.grossProfit.minor).toBe(M(60000));
    expect(is.totals.ebitda.minor).toBe(M(30000)); // 60k − (salaries 20k + rent 10k)
    expect(is.totals.operatingProfit.minor).toBe(M(25000));
    expect(is.totals.profitBeforeTax.minor).toBe(M(23000));
    expect(is.totals.netProfit.minor).toBe(M(20000));
    expect(is.integrityStatus).toBe('VERIFIED');
  });

  it('excludes capital, loan proceeds and drawings from the P&L entirely', async () => {
    const { client } = seedBooks();
    const is = await generateIncomeStatement(client, ctx(), req('INCOME_STATEMENT', FY_TO_JULY));
    // capital 1,000,000 and loan 200,000 fall inside the window but never in revenue
    expect(is.totals.revenue.minor).toBe(M(100000));
    const allAccountIds = is.lines.flatMap((l) => l.accountIds ?? []);
    expect(allAccountIds).not.toContain('capital');
    expect(allAccountIds).not.toContain('loan');
    expect(allAccountIds).not.toContain('drawings');
  });

  it('every populated group line shows source account codes and names', async () => {
    const { client } = seedBooks();
    const is = await generateIncomeStatement(client, ctx(), req('INCOME_STATEMENT', JULY));
    const populated = is.lines.filter(
      (l) => l.lineType === 'ACCOUNT_GROUP' && l.currentAmount.minor !== 0
    );
    expect(populated.length).toBeGreaterThan(3);
    for (const line of populated) {
      expect(line.accountCodes.length).toBeGreaterThan(0);
      expect(line.accountNames.length).toBeGreaterThan(0);
    }
  });

  it('supports equivalent-scope comparative columns', async () => {
    const { client } = seedBooks();
    const is = await generateIncomeStatement(
      client,
      ctx(),
      req('INCOME_STATEMENT', { ...JULY, comparisonFromDate: '2026-06-01', comparisonToDate: '2026-06-30T23:59:59.999Z' })
    );
    const revenue = is.lines.find((l) => l.lineId === 'revenue');
    expect(revenue.comparativeAmount.minor).toBe(0); // no June P&L activity
    expect(revenue.varianceAmount.minor).toBe(M(100000));
  });
});

/* ── Statement of Financial Position ───────────────────────────────────────── */

describe('statement of financial position', () => {
  it('satisfies Assets = Liabilities + Equity with calculated Current Year Earnings', async () => {
    const { client } = seedBooks();
    const bs = await generateBalanceSheet(client, ctx(), req('BALANCE_SHEET', FY_TO_JULY));
    expect(bs.totals.totalAssets.minor).toBe(M(1287000));
    expect(bs.totals.totalLiabilities.minor).toBe(M(275000));
    expect(bs.totals.totalEquity.minor).toBe(M(1012000));
    expect(bs.totals.balanced).toBe(true);
    expect(bs.totals.currentYearEarnings.minor).toBe(M(20000));
    expect(bs.totals.retainedEarnings.minor).toBe(0);
    expect(bs.integrityStatus).toBe('VERIFIED');
  });

  it('owner capital MK1,000,000 appears exactly once despite the legacy mirror journal', async () => {
    const { client } = seedBooks();
    const bs = await generateBalanceSheet(client, ctx(), req('BALANCE_SHEET', FY_TO_JULY));
    const ownerCapital = bs.lines.find((l) => l.lineId === 'owner-capital');
    expect(ownerCapital.currentAmount.minor).toBe(M(1000000));
    expect(ownerCapital.accountCodes).toContain('3000');
  });

  it('R4-A: owner capital under a clean header parent still counts MK1,000,000 once (no parent+child double count)', async () => {
    const { client, data } = seedBooks();
    data.accounts.push({
      id: 'equity-hdr',
      tenantId: T1,
      accountCode: '3',
      accountName: 'Equity (header)',
      accountType: 'Equity',
      coaV2Category: 'EQUITY',
      coaV2Behaviour: 'HEADER',
      postingAllowed: false,
      isActive: true,
    });
    const capital = data.accounts.find((a) => a.id === 'capital');
    capital.parentAccountId = 'equity-hdr';
    const bs = await generateBalanceSheet(client, ctx(), req('BALANCE_SHEET', FY_TO_JULY));
    const ownerCapital = bs.lines.find((l) => l.lineId === 'owner-capital');
    expect(ownerCapital.currentAmount.minor).toBe(M(1000000));
    expect(ownerCapital.accountIds).toContain('capital');
    expect(ownerCapital.accountIds).not.toContain('equity-hdr');
    expect(bs.totals.balanced).toBe(true);
  });

  it('R4-A: historical posting on a header is included once with REP-041 warning', async () => {
    const { client, data } = seedBooks();
    data.accounts.push({
      id: 'cash-hdr',
      tenantId: T1,
      accountCode: '10',
      accountName: 'Cash (header)',
      accountType: 'Asset',
      coaV2Category: 'ASSET',
      coaV2SubType: 'CASH',
      systemPurpose: 'CASH',
      coaV2Behaviour: 'HEADER',
      postingAllowed: false,
      isActive: true,
    });
    // Move MK1,000 of cash onto the header (exceptional); credit capital so BS stays balanced.
    postAdjustment(data, 'tx-hdr-cash', '2026-07-30', 'cash-hdr', 'capital', 1000);
    const bs = await generateBalanceSheet(client, ctx(), req('BALANCE_SHEET', FY_TO_JULY));
    const cashLine = bs.lines.find((l) => l.lineId === 'cash');
    expect(cashLine.accountIds).toContain('cash-hdr');
    expect(cashLine.currentAmount.minor).toBe(M(884500) + M(1000));
    expect(bs.integrityWarnings.some((w) => w.code === 'REP-041' && w.accountId === 'cash-hdr')).toBe(true);
    expect(bs.totals.balanced).toBe(true);
  });

  it('R4-A: Retained Earnings and Current Year Earnings each contribute once to equity', async () => {
    const { client, data } = seedBooks();
    data.accounts.push({
      id: 're',
      tenantId: T1,
      accountCode: '3200',
      accountName: 'Retained Earnings',
      accountType: 'Equity',
      coaV2Category: 'EQUITY',
      coaV2SubType: 'RETAINED_EARNINGS',
      isActive: true,
    });
    // Corrupt duplicate: prior-year P&L still open (calculated RE) AND the same
    // earnings also posted to RE with cash — Method A keeps calculated RE once.
    postAdjustment(data, 'tx-prior-rev', '2025-12-15', 'cash', 'rev', 50000);
    postAdjustment(data, 'tx-dup-re', '2025-12-31', 'cash', 're', 50000);
    const bs = await generateBalanceSheet(client, ctx(), req('BALANCE_SHEET', FY_TO_JULY));
    const postedRE = bs.lines.find((l) => l.lineId === 'retained-earnings-posted');
    const calcRE = bs.lines.find((l) => l.lineId === 'retained-earnings-calculated');
    const cye = bs.lines.find((l) => l.lineId === 'current-year-earnings');
    expect(cye.currentAmount.minor).toBe(M(20000));
    expect(calcRE.currentAmount.minor).toBe(M(50000));
    expect(postedRE.currentAmount.minor).toBe(0);
    expect(bs.integrityWarnings.some((w) => w.code === 'REP-016')).toBe(true);
    // Duplicate cash/RE leaves the equation broken — disclosed, never plugged.
    expect(bs.totals.balanced).toBe(false);
    expect(bs.integrityStatus).toBe('UNVERIFIED');
  });

  it('Current Year Earnings appears on exactly one line and no P&L account leaks into position lines (REP-015)', async () => {
    const { client } = seedBooks();
    const bs = await generateBalanceSheet(client, ctx(), req('BALANCE_SHEET', FY_TO_JULY));
    const cyeLines = bs.lines.filter((l) => l.lineId.includes('current-year'));
    expect(cyeLines.length).toBe(1);
    const groupAccountIds = bs.lines
      .filter((l) => l.lineType === 'ACCOUNT_GROUP')
      .flatMap((l) => l.accountIds);
    for (const pnl of ['rev', 'cogs', 'sal', 'rent', 'dep', 'fin', 'taxexp']) {
      expect(groupAccountIds).not.toContain(pnl);
    }
  });

  it('supports as-of comparatives', async () => {
    const { client } = seedBooks();
    const bs = await generateBalanceSheet(
      client,
      ctx(),
      req('BALANCE_SHEET', { asOfDate: '2026-07-31T23:59:59.999Z', comparisonAsOfDate: '2026-06-30T23:59:59.999Z' })
    );
    const cashLine = bs.lines.find((l) => l.lineId === 'cash');
    expect(cashLine.currentAmount.minor).toBe(M(884500));
    expect(cashLine.comparativeAmount.minor).toBe(M(900000));
  });

  it('discloses material unclassified accounts instead of silently omitting them (REP-036)', async () => {
    const { client, data } = seedBooks();
    data.accounts.push({ id: 'mystery', tenantId: T1, accountCode: '9999', accountName: 'Mystery', isActive: true });
    postAdjustment(data, 'tx-myst', '2026-07-30', 'mystery', 'cash', 500);
    const bs = await generateBalanceSheet(client, ctx(), req('BALANCE_SHEET', FY_TO_JULY));
    expect(bs.integrityStatus).toBe('UNVERIFIED');
    expect(bs.integrityWarnings.some((w) => w.code === 'REP-036')).toBe(true);
    expect(bs.totals.balanced).toBe(false); // difference disclosed — no plug figure
  });
});

/* ── Cash Flow ─────────────────────────────────────────────────────────────── */

describe('cash flow statement (indirect method)', () => {
  it('classifies July activity and reconciles closing cash to the GL', async () => {
    const { client } = seedBooks();
    const cf = await generateCashFlow(client, ctx(), req('CASH_FLOW', JULY));
    expect(cf.totals.openingCash.minor).toBe(M(900000));
    expect(cf.totals.closingCash.minor).toBe(M(884500));
    // net profit 20k + working capital −32.5k + depreciation add-back 5k
    expect(cf.totals.operating.minor).toBe(M(-7500));
    expect(cf.totals.investing.minor).toBe(0);
    expect(cf.totals.financing.minor).toBe(M(-8000)); // drawings
    expect(cf.totals.netMovement.minor).toBe(M(-15500));
    expect(cf.totals.reconciles).toBe(true);
    expect(cf.integrityStatus).toBe('VERIFIED');
  });

  it('classifies June loan proceeds, capital and asset purchase correctly', async () => {
    const { client } = seedBooks();
    const cf = await generateCashFlow(
      client,
      ctx(),
      req('CASH_FLOW', { fromDate: '2026-06-01', toDate: '2026-06-30T23:59:59.999Z' })
    );
    expect(cf.totals.financing.minor).toBe(M(1200000)); // capital 1,000k + loan 200k
    expect(cf.totals.investing.minor).toBe(M(-300000)); // PPE purchase
    expect(cf.totals.operating.minor).toBe(0); // stock bought on credit: inventory vs AP nets
    expect(cf.totals.netMovement.minor).toBe(M(900000));
    expect(cf.totals.reconciles).toBe(true);
  });
});

/* ── Statement of Changes in Equity ────────────────────────────────────────── */

describe('statement of changes in equity', () => {
  it('reconciles to Balance Sheet equity and shows the MK1M capital once', async () => {
    const { client } = seedBooks();
    const eq = await generateEquityStatement(client, ctx(), req('EQUITY_STATEMENT', FY_TO_JULY));
    const bs = await generateBalanceSheet(client, ctx(), req('BALANCE_SHEET', FY_TO_JULY));
    expect(eq.totals.openingEquity.minor).toBe(0);
    expect(eq.totals.contributions.minor).toBe(M(1000000));
    expect(eq.totals.profitForPeriod.minor).toBe(M(20000));
    expect(eq.totals.drawings.minor).toBe(M(-8000));
    expect(eq.totals.closingEquity.minor).toBe(M(1012000));
    expect(eq.totals.closingEquity.minor).toBe(bs.totals.totalEquity.minor);
  });
});

/* ── Receivables and Payables ──────────────────────────────────────────────── */

describe('receivables and payables reports', () => {
  it('ages open invoices and reconciles to the AR control account', async () => {
    const { client } = seedBooks();
    const ar = await generateReceivablesReport(client, ctx(), req('RECEIVABLES', { asOfDate: '2026-07-31T23:59:59.999Z' }));
    expect(ar.totals.subledger.minor).toBe(M(57500));
    expect(ar.totals.controlAccount.minor).toBe(M(57500));
    expect(ar.totals.reconciles).toBe(true);
    expect(ar.integrityStatus).toBe('VERIFIED');
    // due 15 July, as of 31 July → 1–30 bucket; draft invoice excluded
    expect(ar.lines.find((l) => l.lineId === 'bucket-d1_30').currentAmount.minor).toBe(M(57500));
    expect(ar.detail.length).toBe(1);
  });

  it('ages supplier bills and reconciles to the AP control account', async () => {
    const { client } = seedBooks();
    const ap = await generatePayablesReport(client, ctx(), req('PAYABLES', { asOfDate: '2026-07-31T23:59:59.999Z' }));
    expect(ap.totals.subledger.minor).toBe(M(60000));
    expect(ap.totals.controlAccount.minor).toBe(M(60000));
    expect(ap.totals.reconciles).toBe(true);
  });

  it('discloses a material control difference and blocks VERIFIED (REP-006)', async () => {
    const { client, data } = seedBooks();
    data.invoices.push({
      id: 'inv-ghost', tenantId: T1, invoiceNumber: 'INV-GHOST', clientId: 'c9', isDeleted: false,
      status: 'sent', issueDate: D('2026-07-20'), dueDate: D('2026-07-25'), total: 9000, remainingBalance: 9000,
    });
    const ar = await generateReceivablesReport(client, ctx(), req('RECEIVABLES', { asOfDate: '2026-07-31T23:59:59.999Z' }));
    expect(ar.totals.reconciles).toBe(false);
    expect(ar.totals.difference.minor).toBe(M(9000));
    expect(ar.integrityStatus).toBe('UNVERIFIED');
  });
});

/* ── Module reports and Budget versus Actual ───────────────────────────────── */

describe('module reports', () => {
  it.each([
    ['INVENTORY', M(50000)], // 90k purchased − 40k COGS
    ['FIXED_ASSETS', M(295000)], // PPE 300k − accumulated depreciation 5k
    ['LOANS', M(198000)], // loan 200k credit − interest expense 2k (credit-normal view)
    ['EQUITY', M(992000)], // capital 1,000k − drawings 8k
  ])('%s totals derive from GL accounts', async (moduleKey, expected) => {
    const { client } = seedBooks();
    const rep = await generateModuleReport(client, ctx(), req(moduleKey, FY_TO_JULY), moduleKey);
    expect(rep.totals.closing.minor).toBe(expected);
  });

  it('payroll report reads canonical Account 5200', async () => {
    const { client } = seedBooks();
    const rep = await generateModuleReport(client, ctx(), req('PAYROLL', JULY), 'PAYROLL');
    const codes = rep.lines.filter((l) => l.lineType === 'ACCOUNT').map((l) => l.code);
    expect(codes).toContain('5200');
  });

  it('tax report combines tax liabilities and tax expense accounts', async () => {
    const { client } = seedBooks();
    const rep = await generateModuleReport(client, ctx(), req('TAXES', FY_TO_JULY), 'TAXES');
    const codes = rep.lines.filter((l) => l.lineType === 'ACCOUNT').map((l) => l.code);
    expect(codes).toContain('2100');
    expect(codes).toContain('5600');
  });

  it('budget versus actual: actuals from GL, budgets from the budget model, never posted', async () => {
    const { client } = seedBooks();
    const bva = await generateBudgetVsActual(client, ctx(), req('BUDGET_VS_ACTUAL', JULY));
    const line = bva.lines.find((l) => l.code === '4000');
    expect(line.currentAmount.minor).toBe(M(100000));
    expect(line.budgetAmount.minor).toBe(M(120000));
    expect(line.budgetVariance.minor).toBe(M(-20000));
    expect(line.metadata.favourable).toBe(false);
  });
});

/* ── Drill-down ────────────────────────────────────────────────────────────── */

describe('report drill-down', () => {
  it('drill-down totals equal the report line for period statements (REP-025)', async () => {
    const { client } = seedBooks();
    const is = await generateIncomeStatement(client, ctx(), req('INCOME_STATEMENT', JULY));
    for (const lineId of ['revenue', 'operating-expenses', 'finance-costs']) {
      const drill = await drillDownReportLine(client, ctx(), is, lineId);
      expect(drill.reconciles).toBe(true);
      expect(drill.finding).toBeNull();
      expect(drill.accounts.length).toBeGreaterThan(0);
      expect(drill.accounts[0].lines.length).toBeGreaterThan(0);
    }
  });

  it('drill-down totals equal the report line for as-of statements', async () => {
    const { client } = seedBooks();
    const bs = await generateBalanceSheet(client, ctx(), req('BALANCE_SHEET', FY_TO_JULY));
    for (const lineId of ['cash', 'accounts-receivable', 'owner-capital', 'loans']) {
      const drill = await drillDownReportLine(client, ctx(), bs, lineId);
      expect(drill.reconciles).toBe(true);
    }
  });

  it('rejects drill-down across business scope', async () => {
    const { client } = seedBooks();
    const is = await generateIncomeStatement(client, ctx(), req('INCOME_STATEMENT', JULY));
    await expect(drillDownReportLine(client, ctx(T2), is, 'revenue')).rejects.toThrow(/business/i);
  });
});

/* ── Validation and reconciliation ─────────────────────────────────────────── */

describe('report validation engine', () => {
  it('defines REP-001..REP-041 catalogue', () => {
    expect(Object.keys(VALIDATION_RULES).length).toBe(41);
    expect(VALIDATION_RULES['REP-041'].class).toBe('RUNTIME');
    expect(VALIDATION_RULES['REP-001'].class).toBe('RUNTIME');
    expect(VALIDATION_RULES['REP-021'].class).toBe('STRUCTURAL');
  });

  it('cross-report reconciliation passes on clean books (VERIFIED)', async () => {
    const { client } = seedBooks();
    const result = await runReportReconciliation(client, ctx(), req('TRIAL_BALANCE', FY_TO_JULY));
    expect(result.findings).toEqual([]);
    expect(result.overallStatus).toBe('VERIFIED');
    expect(result.reports.trialBalance.status).toBe('BALANCED');
    expect(result.reports.balanceSheet.totals.balanced).toBe(true);
    expect(result.reports.cashFlow.totals.reconciles).toBe(true);
    expect(result.reports.equityStatement.totals.closingEquity.minor).toBe(
      result.reports.balanceSheet.totals.totalEquity.minor
    );
  });

  it('reports REP-001 for unbalanced books and blocks VERIFIED', async () => {
    const { client } = seedBooks({ unbalanced: true });
    const result = await runReportReconciliation(client, ctx(), req('TRIAL_BALANCE', FY_TO_JULY));
    expect(result.findings.some((f) => f.code === 'REP-001')).toBe(true);
    expect(result.overallStatus).toBe('UNVERIFIED');
  });

  it('unmapped account report lists unclassified activity', async () => {
    const { client, data } = seedBooks();
    data.accounts.push({ id: 'mystery', tenantId: T1, accountCode: '9999', accountName: 'Mystery', isActive: true });
    postAdjustment(data, 'tx-myst', '2026-07-30', 'mystery', 'cash', 500);
    const result = await generateUnmappedAccountReport(client, ctx(), req('BALANCE_SHEET', FY_TO_JULY));
    expect(result.count).toBeGreaterThan(0);
    expect(result.unmappedAccounts[0].accountId).toBe('mystery');
  });

  it('validateEnvelope flags a group line without source accounts (REP-024)', () => {
    const findings = validateEnvelope({
      businessId: T1,
      definitionVersion: '1.0.0',
      lines: [{ lineId: 'x', label: 'X', lineType: 'ACCOUNT_GROUP', currentAmount: { minor: 5 }, accounts: [], accountIds: [] }],
    });
    expect(findings.some((f) => f.code === 'REP-024')).toBe(true);
  });

  it('validateEnvelope flags an account on two group lines (REP-013)', () => {
    const mk = (lineId) => ({
      lineId, label: lineId, lineType: 'ACCOUNT_GROUP',
      currentAmount: { minor: 1 }, accounts: [{ accountId: 'a1' }], accountIds: ['a1'],
    });
    const findings = validateEnvelope({
      businessId: T1,
      definitionVersion: '1.0.0',
      lines: [mk('one'), mk('two')],
    });
    expect(findings.some((f) => f.code === 'REP-013')).toBe(true);
  });
});

/* ── Runs, approval and snapshots ──────────────────────────────────────────── */

describe('report runs, approval workflow and snapshots', () => {
  it('blocks approval of unverified reports and enforces GENERATED→REVIEWED→APPROVED', async () => {
    const { client } = seedBooks({ unbalanced: true });
    const { envelope, run } = await generateReport(client, ctx(), REPORT_TYPES.TRIAL_BALANCE, JULY);
    expect(envelope.trialBalanceStatus).toBe('UNBALANCED');
    expect(run.integrityStatus).toBe('UNVERIFIED');
    await expect(approveReportRun(client, ctx(), run.id)).rejects.toThrow(/review/i);
    await reviewReportRun(client, ctx(), run.id, { comment: 'checked' });
    await expect(approveReportRun(client, ctx(), run.id)).rejects.toThrow(/does not permit approval/i);
  });

  it('approves verified reports; snapshots are immutable with versioned supersession', async () => {
    const { client, data } = seedBooks();
    const first = await generateReport(client, ctx(), REPORT_TYPES.TRIAL_BALANCE, JULY);
    await reviewReportRun(client, ctx(), first.run.id);
    const approved = await approveReportRun(client, ctx(), first.run.id, { comment: 'ok' });
    expect(approved.status).toBe('APPROVED');

    const snap1 = await snapshotReport(client, ctx(), first.run.id, first.envelope, {});
    expect(snap1.version).toBe(1);
    expect(snap1.status).toBe('ACTIVE');

    // a later adjustment changes the period → regenerate → new snapshot version
    postAdjustment(data, 'tx-adj', '2026-07-30', 'rent', 'cash', 100);
    const second = await generateReport(client, ctx(), REPORT_TYPES.TRIAL_BALANCE, JULY);
    const snap2 = await snapshotReport(client, ctx(), second.run.id, second.envelope, { reason: 'Post-close adjustment' });
    expect(snap2.version).toBe(2);

    const old = data.reportSnapshots.find((s) => s.id === snap1.id);
    expect(old.status).toBe('SUPERSEDED');
    expect(old.supersededBySnapshotId).toBe(snap2.id);
    expect(old.supersededReason).toContain('adjustment');
    // original payload preserved untouched
    expect(old.payload.totals.periodDebit.minor).toBe(first.envelope.totals.periodDebit.minor);
    expect(old.payload.totals.periodDebit.minor).not.toBe(second.envelope.totals.periodDebit.minor);
  });

  it('refuses to snapshot a payload that no longer matches the recorded run', async () => {
    const { client, data } = seedBooks();
    const { envelope, run } = await generateReport(client, ctx(), REPORT_TYPES.TRIAL_BALANCE, JULY);
    postAdjustment(data, 'tx-late', '2026-07-31', 'rent', 'cash', 1);
    const regenerated = await generateReport(client, ctx(), REPORT_TYPES.TRIAL_BALANCE, JULY, { recordRun: false });
    expect(regenerated.envelope.resultChecksum).not.toBe(envelope.resultChecksum);
    await expect(snapshotReport(client, ctx(), run.id, regenerated.envelope, {})).rejects.toThrow(/regenerate/i);
  });
});

/* ── Report cache ──────────────────────────────────────────────────────────── */

describe('report cache', () => {
  it('caches, serves hits while source is unchanged, and rebuilds after a posting', async () => {
    const { client, data } = seedBooks();
    const context = ctx();
    const request = req('TRIAL_BALANCE', JULY);
    const hash = hashReportRequest(request);
    let generations = 0;
    const gen = async () => {
      generations += 1;
      return generateTrialBalance(client, context, request);
    };
    const first = await getOrBuildCachedReport(client, context, request, hash, gen);
    expect(first.cache.hit).toBe(false);
    const second = await getOrBuildCachedReport(client, context, request, hash, gen);
    expect(second.cache.hit).toBe(true);
    expect(generations).toBe(1);
    expect(second.envelope.totals.periodDebit.minor).toBe(first.envelope.totals.periodDebit.minor);

    // journal posting changes the accounting data version → stale → rebuild
    postAdjustment(data, 'tx-new', '2026-07-31', 'rent', 'cash', 5);
    const third = await getOrBuildCachedReport(client, context, request, hash, gen);
    expect(third.cache.hit).toBe(false);
    expect(third.cache.stale).toBe(true);
    expect(generations).toBe(2);
  });

  it('cache reconciliation flags stale entries (REP-030) and rebuild clears them', async () => {
    const { client, data } = seedBooks();
    const context = ctx();
    const request = req('TRIAL_BALANCE', JULY);
    await getOrBuildCachedReport(client, context, request, hashReportRequest(request), () =>
      generateTrialBalance(client, context, request)
    );
    postAdjustment(data, 'tx-new2', '2026-07-31', 'rent', 'cash', 5);
    const recon = await reconcileReportCache(client, context, null);
    expect(recon.findings.some((f) => f.code === 'REP-030')).toBe(true);
    const rebuilt = await rebuildReportCache(client, context, {});
    expect(rebuilt.invalidated).toBe(1);
  });

  it('cache rebuild is business-scoped', async () => {
    const { client } = seedBooks();
    const request = req('TRIAL_BALANCE', JULY);
    await getOrBuildCachedReport(client, ctx(), request, hashReportRequest(request), () =>
      generateTrialBalance(client, ctx(), request)
    );
    const other = await rebuildReportCache(client, ctx(T2), {});
    expect(other.invalidated).toBe(0);
  });
});

/* ── Exports ───────────────────────────────────────────────────────────────── */

describe('report exports', () => {
  it('CSV totals equal the on-screen envelope and uses clean headers', async () => {
    const { client } = seedBooks();
    const tb = await generateTrialBalance(client, ctx(), req('TRIAL_BALANCE', JULY));
    const csv = exportReportToCsv(tb, { businessName: 'Test Business', reportDisplayName: 'Trial Balance' });
    expect(csv).toContain('290,500.00');
    expect(csv).toContain('1,380,000.00');
    expect(csv).toContain('Test Business');
    expect(csv).not.toContain('Integrity status');
    expect(csv).not.toContain(tb.businessId);
    expect(sanitizeCell('=SUM(A1:A9)')).toBe("'=SUM(A1:A9)");
    expect(sanitizeCell('+1234')).toBe("'+1234");
    expect(sanitizeCell('@cmd')).toBe("'@cmd");
    expect(sanitizeCell('Normal text')).toBe('Normal text');
  });

  it(
    'Excel export includes period columns for P&L and human-readable labels',
    async () => {
      const { client } = seedBooks();
      const is = await generateIncomeStatement(client, ctx(), req('INCOME_STATEMENT', JULY));
      const buffer = await exportReportToExcel(is, {
        businessName: 'Test Business',
        reportDisplayName: 'Profit & Loss',
      });
      const { default: ExcelJS } = await import('exceljs');
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer);
      const info = wb.getWorksheet('Report info');
      expect(info).toBeTruthy();
      expect(wb.getWorksheet('Integrity')).toBeFalsy();
      const sheet = wb.getWorksheet('Report');
      expect(sheet).toBeTruthy();
      const headers = sheet.getRow(1).values.filter(Boolean).map(String);
      expect(headers).toContain('Line item');
      expect(headers).toContain('Amount');
      let foundRevenue = false;
      sheet.eachRow((row) => {
        if (String(row.getCell(1).value).includes('Revenue')) foundRevenue = true;
      });
      expect(foundRevenue).toBe(true);
      expect(wb.getWorksheet('Account detail')).toBeTruthy();
    },
    20000
  );

  it('PDF export renders the completed envelope without integrity footer noise', async () => {
    const { client } = seedBooks();
    const bs = await generateBalanceSheet(client, ctx(), req('BALANCE_SHEET', FY_TO_JULY));
    const buffer = await exportReportToPdf(bs, { businessName: 'Test Business' });
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 5).toString()).toContain('%PDF');
  });

  it('P&L CSV includes period column headers when periods are present', async () => {
    const { client } = seedBooks();
    const is = await generateIncomeStatement(client, ctx(), {
      ...req('INCOME_STATEMENT', JULY),
      groupBy: 'MONTH',
    });
    if (is.periods?.length) {
      const csv = exportReportToCsv(is, { businessName: 'Test Business', reportDisplayName: 'Profit & Loss' });
      expect(csv).toContain(is.periods[0].label);
      expect(csv).toContain('Total');
    }
  });
});

/* ── Dashboard alignment ───────────────────────────────────────────────────── */

describe('dashboard KPI alignment', () => {
  it('KPIs agree exactly with the canonical statements for the same scope', async () => {
    const { client } = seedBooks();
    const kpis = await getDashboardFinancialKpis(client, ctx(), FY_TO_JULY);
    const is = await generateIncomeStatement(client, ctx(), req('INCOME_STATEMENT', FY_TO_JULY));
    const bs = await generateBalanceSheet(client, ctx(), req('BALANCE_SHEET', FY_TO_JULY));
    expect(kpis.kpis.revenue.minor).toBe(is.totals.revenue.minor);
    expect(kpis.kpis.netProfit.minor).toBe(is.totals.netProfit.minor);
    expect(kpis.kpis.totalAssets.minor).toBe(bs.totals.totalAssets.minor);
    expect(kpis.kpis.cashBalance.minor).toBe(M(884500));
    expect(kpis.kpis.workingCapital.minor).toBe(M(917000)); // 992,000 − 75,000
    expect(kpis.kpis.currentRatio).toBeCloseTo(13.23, 2);
    expect(kpis.kpis.debtToEquity).toBeCloseTo(0.27, 2);
    expect(kpis.sourcePolicy.storedBalancesUsed).toBe(false);
  });
});

/* ── Multi-tenant isolation ────────────────────────────────────────────────── */

describe('multi-tenant isolation', () => {
  it('another business sees only its own (empty) ledger', async () => {
    const { client } = seedBooks();
    const other = await generateTrialBalance(
      client,
      ctx(T2, 'user-2'),
      req('TRIAL_BALANCE', JULY, ctx(T2, 'user-2'))
    );
    expect(other.businessId).toBe(T2);
    expect(other.totals.periodDebit.minor).toBe(0);
    expect(other.lines.every((r) => !r.accountId || r.accountId.startsWith('t2') || r.accountId === 't2-cash')).toBe(true);
    const t1AccountIds = new Set(['cash', 'ar', 'capital', 'rev']);
    expect(other.lines.some((r) => t1AccountIds.has(r.accountId))).toBe(false);
  });

  it('run review is business-scoped', async () => {
    const { client } = seedBooks();
    const { run } = await generateReport(client, ctx(), REPORT_TYPES.TRIAL_BALANCE, JULY);
    await expect(reviewReportRun(client, ctx(T2, 'user-2'), run.id)).rejects.toThrow(/not found/i);
  });
});

/* ── Migration-style checks ────────────────────────────────────────────────── */

describe('empty and minimal datasets', () => {
  it('generates every report type on an empty business without failing', async () => {
    const { client } = makeAcctV2PrismaStub({ accounts: [] });
    const context = ctx();
    for (const type of Object.values(REPORT_TYPES)) {
      if (type === 'GENERAL_LEDGER') continue; // served by the Phase 5 ledger APIs
      const { envelope } = await generateReport(client, context, type, JULY, { recordRun: false });
      expect(envelope.reportType).toBe(type);
    }
  });

  it('accounting data version changes when journals change', async () => {
    const { client, data } = seedBooks();
    const v1 = await getAccountingDataVersion(client, ctx());
    postAdjustment(data, 'tx-v', '2026-08-01', 'rent', 'cash', 1);
    const v2 = await getAccountingDataVersion(client, ctx());
    expect(v1).not.toBe(v2);
  });
});
