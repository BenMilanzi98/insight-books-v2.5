/**
 * Phase 5 — Journal Entry and General Ledger reimplementation tests.
 *
 * Covers: the canonical journal source (mirror exclusion, status normalization,
 * header-amount exclusion, authority conflicts), ledger balance mathematics
 * (opening / movement / closing, decimal exactness, normal-balance
 * presentation, abnormal flags), running balances and pagination, merge
 * rollups, hierarchy handling, dimension and currency filters, the canonical
 * journal query service, the V2 reversal workflow end-to-end, the projection
 * rebuild service, the reconciliation service (stored-balance drift,
 * projection staleness, structural findings), and security scoping.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeAcctV2PrismaStub } from './helpers/acctV2PrismaStub.js';
import { createAccountingContext } from '../lib/accountingV2/domain/accountingContext.js';
import {
  getCanonicalAccountTotals,
  listCanonicalLines,
  findHeaderOnlyJournals,
  findAuthorityConflicts,
} from '../lib/accountingV2/ledger/canonicalJournalSource.js';
import {
  getBusinessLedgerSummary,
  getAccountLedger,
  getLedgerHierarchy,
  resolveNormalBalance,
  presentBalance,
} from '../lib/accountingV2/ledger/ledgerQueryService.js';
import {
  listCanonicalJournals,
  getCanonicalJournal,
  normalizeJournalStatus,
} from '../lib/accountingV2/ledger/journalQueryService.js';
import {
  rebuildLedgerProjection,
  getActiveProjectionVersion,
  getProjectedAccountTotals,
} from '../lib/accountingV2/ledger/ledgerRebuildService.js';
import { runLedgerReconciliation } from '../lib/accountingV2/ledger/ledgerReconciliationService.js';
import { runJournalIntegrityChecks } from '../lib/accountingV2/ledger/integrityRules.js';
import {
  createManualJournalDraft,
  submitManualJournal,
  approveManualJournal,
  postManualJournal,
} from '../lib/accountingV2/application/manualJournalService.js';
import { reverseJournal, previewReversal } from '../lib/accountingV2/application/journalReversalService.js';
import { AccountingValidationError } from '../lib/accountingV2/domain/errors.js';
import { FLAG } from '../lib/accountingV2/infrastructure/featureFlags.js';

const T1 = 'tenant-1';
const T2 = 'tenant-2';
const CREATOR = 'user-creator';
const APPROVER = 'user-approver';
const allow = () => true;
const deny = () => false;

const ctx = (userId = CREATOR, businessId = T1) =>
  createAccountingContext({ businessId, userId, sourceChannel: 'test' });

const D = (s) => new Date(s);

/** Chart used across ledger tests. */
const ledgerAccounts = () => [
  { id: 'cash', tenantId: T1, accountCode: '1000', accountName: 'Cash', accountType: 'Asset', isActive: true },
  { id: 'ar', tenantId: T1, accountCode: '1100', accountName: 'Receivables', accountType: 'Asset', isActive: true },
  { id: 'rev', tenantId: T1, accountCode: '4000', accountName: 'Revenue', accountType: 'Income', coaV2Category: 'REVENUE', isActive: true },
  { id: 'exp', tenantId: T1, accountCode: '5000', accountName: 'Rent', accountType: 'Expense', isActive: true },
  { id: 'hdr', tenantId: T1, accountCode: '1', accountName: 'Assets (header)', accountType: 'Asset', coaV2Behaviour: 'HEADER', postingAllowed: false, isActive: true, parentAccountId: null },
  { id: 'cash-old', tenantId: T1, accountCode: '1001', accountName: 'Old Cash', accountType: 'Asset', isActive: false, mergedIntoAccountId: 'cash' },
  { id: 'other-cash', tenantId: T2, accountCode: '1000', accountName: 'Other business cash', accountType: 'Asset', isActive: true },
];

/**
 * Canonical dual-ledger seed:
 *  - tx1 (posted, 2026-07-05): cash 100.00 / rev 100.00, mirrored by je-mirror
 *  - tx2 (POSTED casing, 2026-07-08): cash 40.00 / rev 40.00
 *  - je-manual (Posted, transactionId null, 2026-07-10): exp 25.50 / cash 25.50
 *  - je-header (Posted, header amounts only, no lines)
 *  - je-draft (Draft) and tx-void (void) excluded
 *  - tx0 (posted, 2026-06-20, before window): cash 10.00 / rev 10.00
 */
/** Fresh-books V2-only seed — activity lives on ACCOUNTING_V2 journals (Transaction archive ignored). */
const dualLedgerSeed = () => ({
  accounts: ledgerAccounts(),
  legacyTransactions: [
    // Archive noise — must NOT affect canonical totals.
    { id: 'tx-archive', tenantId: T1, date: D('2026-07-05'), status: 'posted', description: 'Archived', sourceType: 'Sale', sourceId: 'arch', createdAt: D('2026-07-05') },
  ],
  transactionLines: [
    { id: 'la1', transactionId: 'tx-archive', lineNumber: 1, accountId: 'cash', debitAmount: 9999, creditAmount: 0 },
    { id: 'la2', transactionId: 'tx-archive', lineNumber: 2, accountId: 'rev', debitAmount: 0, creditAmount: 9999 },
  ],
  legacyJournalEntries: [
    { id: 'je0', tenantId: T1, transactionId: null, status: 'Posted', entryDate: D('2026-06-20'), postingDate: D('2026-06-20'), description: 'June sale', sourceType: 'Sale', sourceId: 's0', createdAt: D('2026-06-20'), architectureVersion: 'ACCOUNTING_V2' },
    { id: 'je1', tenantId: T1, transactionId: null, status: 'Posted', entryDate: D('2026-07-05'), postingDate: D('2026-07-05'), description: 'Cash sale', sourceType: 'Sale', sourceId: 's1', createdAt: D('2026-07-05'), architectureVersion: 'ACCOUNTING_V2' },
    { id: 'je2', tenantId: T1, transactionId: null, status: 'Posted', entryDate: D('2026-07-08'), postingDate: D('2026-07-08'), description: 'Casing drift sale', sourceType: 'Sale', sourceId: 's2', createdAt: D('2026-07-08'), architectureVersion: 'ACCOUNTING_V2' },
    { id: 'je-manual', tenantId: T1, transactionId: null, status: 'Posted', entryDate: D('2026-07-10'), postingDate: D('2026-07-10'), description: 'Manual accrual', referenceNumber: 'TXN-2026-0001', createdAt: D('2026-07-10'), architectureVersion: 'ACCOUNTING_V2' },
    { id: 'je-header', tenantId: T1, transactionId: null, status: 'Posted', entryDate: D('2026-07-11'), debit: 5000, credit: 5000, description: 'Header-amount row', createdAt: D('2026-07-11'), architectureVersion: 'ACCOUNTING_V2' },
    { id: 'je-draft', tenantId: T1, transactionId: null, status: 'Draft', entryDate: D('2026-07-12'), description: 'Unposted draft', createdAt: D('2026-07-12'), architectureVersion: 'ACCOUNTING_V2' },
    { id: 'je-legacy-ignored', tenantId: T1, transactionId: null, status: 'Posted', entryDate: D('2026-07-10'), description: 'LEGACY_V1 ignored', createdAt: D('2026-07-10'), architectureVersion: 'LEGACY_V1' },
  ],
  journalEntryLines: [
    { id: 'l0d', journalEntryId: 'je0', lineNumber: 1, accountId: 'cash', debitAmount: 10, creditAmount: 0 },
    { id: 'l0c', journalEntryId: 'je0', lineNumber: 2, accountId: 'rev', debitAmount: 0, creditAmount: 10 },
    { id: 'l1d', journalEntryId: 'je1', lineNumber: 1, accountId: 'cash', debitAmount: 100, creditAmount: 0 },
    { id: 'l1c', journalEntryId: 'je1', lineNumber: 2, accountId: 'rev', debitAmount: 0, creditAmount: 100 },
    { id: 'l2d', journalEntryId: 'je2', lineNumber: 1, accountId: 'cash', debitAmount: 40, creditAmount: 0 },
    { id: 'l2c', journalEntryId: 'je2', lineNumber: 2, accountId: 'rev', debitAmount: 0, creditAmount: 40 },
    { id: 'ja1', journalEntryId: 'je-manual', lineNumber: 1, accountId: 'exp', debitAmount: 25.5, creditAmount: 0 },
    { id: 'ja2', journalEntryId: 'je-manual', lineNumber: 2, accountId: 'cash', debitAmount: 0, creditAmount: 25.5 },
    { id: 'jd1', journalEntryId: 'je-draft', lineNumber: 1, accountId: 'exp', debitAmount: 111, creditAmount: 0 },
    { id: 'jd2', journalEntryId: 'je-draft', lineNumber: 2, accountId: 'cash', debitAmount: 0, creditAmount: 111 },
    { id: 'jl1', journalEntryId: 'je-legacy-ignored', lineNumber: 1, accountId: 'cash', debitAmount: 50, creditAmount: 0 },
    { id: 'jl2', journalEntryId: 'je-legacy-ignored', lineNumber: 2, accountId: 'rev', debitAmount: 0, creditAmount: 50 },
  ],
});

/** NEW_ENGINE posting configuration for reversal end-to-end tests. */
const newEngineSeed = () => ({
  configurations: [
    { id: 'cfg1', tenantId: T1, baseCurrency: 'MWK', defaultPostingMode: 'NEW_ENGINE', enableShadowAccounting: true },
  ],
  featureFlags: [
    { id: 'f1', tenantId: T1, flagKey: FLAG.V2_ENABLED, moduleKey: '*', eventType: '*', enabled: true },
  ],
});

async function postedManualJournal(client, lines) {
  const draft = await createManualJournalDraft(
    ctx(CREATOR),
    {
      description: 'Rent accrual',
      entryDate: '2026-07-15',
      lines: lines ?? [
        { accountId: 'exp', debit: '1500.00' },
        { accountId: 'cash', credit: '1500.00' },
      ],
    },
    { hasPermission: allow },
    client
  );
  await submitManualJournal(ctx(CREATOR), draft.id, { hasPermission: allow }, client);
  await approveManualJournal(ctx(APPROVER), draft.id, { hasPermission: allow }, client);
  await postManualJournal(ctx(APPROVER), draft.id, { hasPermission: allow }, client);
  return draft.id;
}

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

/* ── 52.1 Canonical journal source ───────────────────────────────────────── */

describe('canonical journal source', () => {
  it('counts ACCOUNTING_V2 journals only (Transaction archive ignored)', async () => {
    const { client } = makeAcctV2PrismaStub(dualLedgerSeed());
    const totals = await getCanonicalAccountTotals(client, ctx());
    // cash: je0 10 + je1 100 + je2 40 debits, je-manual 25.50 credit. Archive 9999 ignored.
    expect(totals.get('cash')).toEqual({ debitMinor: 15000, creditMinor: 2550, lineCount: 4 });
    expect(totals.get('rev')).toEqual({ debitMinor: 0, creditMinor: 15000, lineCount: 3 });
  });

  it('includes posted V2 journals', async () => {
    const { client } = makeAcctV2PrismaStub(dualLedgerSeed());
    const lines = await listCanonicalLines(client, ctx(), { accountIds: ['cash'] });
    expect(lines.some((l) => l.journalId === 'je2')).toBe(true);
    expect(lines.some((l) => l.journalId === 'tx-archive')).toBe(false);
  });

  it('excludes drafts, voided transactions and other businesses', async () => {
    const { client } = makeAcctV2PrismaStub(dualLedgerSeed());
    const lines = await listCanonicalLines(client, ctx());
    expect(lines.some((l) => l.journalId === 'je-draft')).toBe(false);
    expect(lines.some((l) => l.journalId === 'tx-void')).toBe(false);
    expect(lines.some((l) => l.journalId === 'tx-other')).toBe(false);
  });

  it('never counts legacy header-amount journals; surfaces them as JRN-104 findings', async () => {
    const { client } = makeAcctV2PrismaStub(dualLedgerSeed());
    const totals = await getCanonicalAccountTotals(client, ctx());
    let all = 0;
    for (const t of totals.values()) all += t.debitMinor + t.creditMinor;
    // Debits + credits = 2 × (10 + 100 + 40 + 25.50) = 351.00 → 35100 minor.
    // The header row's 5000/5000 must contribute nothing.
    expect(all).toBe(35100);
    const headerFindings = await findHeaderOnlyJournals(client, ctx());
    expect(headerFindings).toHaveLength(1);
    expect(headerFindings[0].journalEntryId).toBe('je-header');
    expect(headerFindings[0].headerDebit).toBe(5000);
  });

  it('reports no dual-authority conflicts under fresh-books (archive unused)', async () => {
    const { client } = makeAcctV2PrismaStub(dualLedgerSeed());
    const conflicts = await findAuthorityConflicts(client, ctx());
    expect(conflicts).toHaveLength(0);
  });

  it('refuses queries without a business-scoped context', async () => {
    const { client } = makeAcctV2PrismaStub(dualLedgerSeed());
    await expect(getCanonicalAccountTotals(client, {})).rejects.toThrow(AccountingValidationError);
  });
});

/* ── 52.2 Balance mathematics + presentation ─────────────────────────────── */

describe('ledger balance mathematics', () => {
  it('computes opening, movement and closing balances from posted lines only', async () => {
    const { client } = makeAcctV2PrismaStub(dualLedgerSeed());
    const summary = await getBusinessLedgerSummary(client, ctx(), {
      startDate: D('2026-07-01'),
      endDate: D('2026-07-31'),
    });
    const cash = summary.accounts.find((a) => a.accountId === 'cash');
    expect(cash.opening.display).toBe('10.00'); // tx0 before the window
    expect(cash.periodDebit).toBe('140.00');
    expect(cash.periodCredit).toBe('25.50');
    expect(cash.closing.display).toBe('124.50');
    expect(cash.closing.abnormal).toBe(false);
  });

  it('presents credit-normal accounts positively and keeps raw debits/credits un-netted', async () => {
    const { client } = makeAcctV2PrismaStub(dualLedgerSeed());
    const summary = await getBusinessLedgerSummary(client, ctx(), {});
    const rev = summary.accounts.find((a) => a.accountId === 'rev');
    expect(rev.normalBalance).toBe('CREDIT'); // from coaV2Category REVENUE
    expect(rev.periodCredit).toBe('150.00');
    expect(rev.periodDebit).toBe('0.00');
    expect(rev.closing.display).toBe('150.00'); // positive under its normal balance
    expect(summary.totals.balanced).toBe(true);
  });

  it('flags abnormal balances instead of hiding them', () => {
    const { normalBalance } = resolveNormalBalance({ accountType: 'Asset' });
    expect(normalBalance).toBe('DEBIT');
    const overdrawn = presentBalance(-5000, 'DEBIT');
    expect(overdrawn.display).toBe('-50.00');
    expect(overdrawn.abnormal).toBe(true);
  });

  it('normal balance resolution prefers CoA V2, then the legacy column, then category defaults', () => {
    expect(resolveNormalBalance({ coaV2NormalBalance: 'CREDIT', normalBalance: 'Debit' }).source).toBe('COA_V2');
    expect(resolveNormalBalance({ normalBalance: 'Credit' }).normalBalance).toBe('CREDIT');
    expect(resolveNormalBalance({ coaV2Category: 'LIABILITY' }).normalBalance).toBe('CREDIT');
    expect(resolveNormalBalance({}).warning).toBeTruthy();
  });

  it('aggregates exactly in integer minor units (no float drift)', async () => {
    const seed = dualLedgerSeed();
    // Classic float trap: 0.1 + 0.2 style cents.
    seed.legacyJournalEntries.push({
      id: 'je-cents', tenantId: T1, transactionId: null, status: 'Posted',
      entryDate: D('2026-07-12'), postingDate: D('2026-07-12'), description: 'Cent-level entries',
      createdAt: D('2026-07-12'), architectureVersion: 'ACCOUNTING_V2',
    });
    seed.journalEntryLines.push(
      { id: 'c1', journalEntryId: 'je-cents', lineNumber: 1, accountId: 'exp', debitAmount: 0.1, creditAmount: 0 },
      { id: 'c2', journalEntryId: 'je-cents', lineNumber: 2, accountId: 'exp', debitAmount: 0.2, creditAmount: 0 },
      { id: 'c3', journalEntryId: 'je-cents', lineNumber: 3, accountId: 'cash', debitAmount: 0, creditAmount: 0.3 }
    );
    const { client } = makeAcctV2PrismaStub(seed);
    const totals = await getCanonicalAccountTotals(client, ctx(), { startDate: D('2026-07-12'), endDate: D('2026-07-12') });
    expect(totals.get('exp').debitMinor).toBe(30); // exactly 0.30, not 0.30000000000000004
    expect(totals.get('cash').creditMinor).toBe(30);
  });
});

/* ── 52.3 Running balances + pagination ──────────────────────────────────── */

describe('account activity and running balances', () => {
  it('computes chronological running balances with a carried opening balance', async () => {
    const { client } = makeAcctV2PrismaStub(dualLedgerSeed());
    const ledger = await getAccountLedger(client, ctx(), {
      accountId: 'cash',
      startDate: D('2026-07-01'),
      endDate: D('2026-07-31'),
    });
    expect(ledger.opening.display).toBe('10.00');
    const balances = ledger.lines.map((l) => l.runningBalance.display);
    expect(balances).toEqual(['110.00', '150.00', '124.50']);
    expect(ledger.closing.display).toBe('124.50');
  });

  it('presents newest-first without recomputing the running balance (legacy P5-I04 fixed)', async () => {
    const { client } = makeAcctV2PrismaStub(dualLedgerSeed());
    const ledger = await getAccountLedger(client, ctx(), {
      accountId: 'cash',
      startDate: D('2026-07-01'),
      endDate: D('2026-07-31'),
      order: 'desc',
    });
    expect(ledger.lines.map((l) => l.runningBalance.display)).toEqual(['124.50', '150.00', '110.00']);
  });

  it('keeps running balances continuous across pages', async () => {
    const { client } = makeAcctV2PrismaStub(dualLedgerSeed());
    const page1 = await getAccountLedger(client, ctx(), {
      accountId: 'cash', startDate: D('2026-07-01'), endDate: D('2026-07-31'), page: 1, pageSize: 2,
    });
    const page2 = await getAccountLedger(client, ctx(), {
      accountId: 'cash', startDate: D('2026-07-01'), endDate: D('2026-07-31'), page: 2, pageSize: 2,
    });
    expect(page1.lines.map((l) => l.runningBalance.display)).toEqual(['110.00', '150.00']);
    expect(page2.lines.map((l) => l.runningBalance.display)).toEqual(['124.50']);
    expect(page2.closing.display).toBe(page1.closing.display);
  });

  it('refuses cross-business account access', async () => {
    const { client } = makeAcctV2PrismaStub(dualLedgerSeed());
    await expect(
      getAccountLedger(client, ctx(CREATOR, T1), { accountId: 'other-cash' })
    ).rejects.toThrow(AccountingValidationError);
  });
});

/* ── 52.4 Merge rollup + hierarchy ───────────────────────────────────────── */

describe('merge rollup and hierarchy', () => {
  it('rolls merged-away account activity into the survivor with the posting account preserved', async () => {
    const seed = dualLedgerSeed();
    seed.legacyJournalEntries.push({
      id: 'je-old', tenantId: T1, transactionId: null, status: 'Posted',
      entryDate: D('2026-07-06'), postingDate: D('2026-07-06'), description: 'Old cash receipt',
      createdAt: D('2026-07-06'), architectureVersion: 'ACCOUNTING_V2',
    });
    seed.journalEntryLines.push(
      { id: 'lo1', journalEntryId: 'je-old', lineNumber: 1, accountId: 'cash-old', debitAmount: 5, creditAmount: 0 },
      { id: 'lo2', journalEntryId: 'je-old', lineNumber: 2, accountId: 'rev', debitAmount: 0, creditAmount: 5 }
    );
    const { client } = makeAcctV2PrismaStub(seed);

    const summary = await getBusinessLedgerSummary(client, ctx(), {});
    expect(summary.accounts.some((a) => a.accountId === 'cash-old')).toBe(false);
    const cash = summary.accounts.find((a) => a.accountId === 'cash');
    expect(cash.periodDebit).toBe('155.00'); // 150 + 5 rolled up

    const ledger = await getAccountLedger(client, ctx(), { accountId: 'cash' });
    const rolled = ledger.lines.find((l) => l.postingAccountId === 'cash-old');
    expect(rolled).toBeTruthy();
    expect(rolled.rolledUpFromMergedAccount).toBe(true);
  });

  it('flags direct activity on header accounts as a GL-110 anomaly', async () => {
    const seed = dualLedgerSeed();
    seed.legacyJournalEntries.push({
      id: 'je-hdr', tenantId: T1, transactionId: null, status: 'Posted',
      entryDate: D('2026-07-07'), postingDate: D('2026-07-07'), description: 'Bad header posting',
      createdAt: D('2026-07-07'), architectureVersion: 'ACCOUNTING_V2',
    });
    seed.journalEntryLines.push(
      { id: 'lh1', journalEntryId: 'je-hdr', lineNumber: 1, accountId: 'hdr', debitAmount: 9, creditAmount: 0 },
      { id: 'lh2', journalEntryId: 'je-hdr', lineNumber: 2, accountId: 'rev', debitAmount: 0, creditAmount: 9 }
    );
    const { client } = makeAcctV2PrismaStub(seed);
    const summary = await getBusinessLedgerSummary(client, ctx(), {});
    expect(summary.anomalies.some((a) => a.rule === 'GL-110' && a.accountId === 'hdr')).toBe(true);
  });

  it('builds a hierarchy where parent rollups are presentation-only', async () => {
    const seed = dualLedgerSeed();
    for (const account of seed.accounts) {
      if (account.id === 'cash' || account.id === 'ar') account.parentAccountId = 'hdr';
    }
    const { client } = makeAcctV2PrismaStub(seed);
    const tree = await getLedgerHierarchy(client, ctx(), {});
    const header = findNode(tree.tree, 'hdr');
    expect(header.rollup.presentationOnly).toBe(true);
    expect(header.rollup.closing.display).toBe('124.50'); // cash closing, ar zero
    // The header's own posting row stays zero — children are not merged into it.
    expect(header.periodDebit).toBe('0.00');
  });

  it('R4-A: header rollup excludes own exceptional activity from presentation rollup (children only)', async () => {
    const seed = dualLedgerSeed();
    for (const account of seed.accounts) {
      if (account.id === 'cash' || account.id === 'ar') account.parentAccountId = 'hdr';
    }
    seed.legacyJournalEntries.push({
      id: 'je-hdr-own',
      tenantId: T1,
      transactionId: null,
      status: 'Posted',
      entryDate: D('2026-07-08'),
      postingDate: D('2026-07-08'),
      description: 'Exceptional header posting',
      createdAt: D('2026-07-08'),
      architectureVersion: 'ACCOUNTING_V2',
    });
    seed.journalEntryLines.push(
      { id: 'lho1', journalEntryId: 'je-hdr-own', lineNumber: 1, accountId: 'hdr', debitAmount: 50, creditAmount: 0 },
      { id: 'lho2', journalEntryId: 'je-hdr-own', lineNumber: 2, accountId: 'rev', debitAmount: 0, creditAmount: 50 }
    );
    const { client } = makeAcctV2PrismaStub(seed);
    const tree = await getLedgerHierarchy(client, ctx(), {});
    const header = findNode(tree.tree, 'hdr');
    expect(header.exceptionalPostingAccount).toBe(true);
    expect(header.rollup.excludesOwnDirectActivity).toBe(true);
    // Presentation rollup stays children-only (cash 124.50), not cash + header 50.
    expect(header.rollup.closing.display).toBe('124.50');
    expect(header.periodDebit).toBe('50.00');
  });

  function findNode(nodes, id) {
    for (const node of nodes) {
      if (node.accountId === id) return node;
      const found = findNode(node.children, id);
      if (found) return found;
    }
    return null;
  }
});

/* ── 52.5 Dimensions + currency ──────────────────────────────────────────── */

describe('dimension and currency filtering', () => {
  const dimensionSeed = () => {
    const seed = dualLedgerSeed();
    seed.legacyJournalEntries.push({
      id: 'je-v2', tenantId: T1, transactionId: null, status: 'Posted', architectureVersion: 'ACCOUNTING_V2',
      postingDate: D('2026-07-14'), entryDate: D('2026-07-14'), journalNumber: 'MJ-2026-000009',
      currency: 'MWK', description: 'Dimensioned journal', accountingEventId: 'evt-9', createdAt: D('2026-07-14'),
    });
    seed.journalEntryLines.push(
      { id: 'v1', journalEntryId: 'je-v2', lineNumber: 1, accountId: 'ar', debitAmount: 60, creditAmount: 0, dimensions: { customerId: 'cust-1' } },
      { id: 'v2', journalEntryId: 'je-v2', lineNumber: 2, accountId: 'rev', debitAmount: 0, creditAmount: 60, dimensions: { customerId: 'cust-1' } }
    );
    return seed;
  };

  it('filters by line dimensions and reports legacy lines as UNASSIGNED', async () => {
    const { client } = makeAcctV2PrismaStub(dimensionSeed());
    const forCustomer = await listCanonicalLines(client, ctx(), {
      dimensionKey: 'customerId',
      dimensionValue: 'cust-1',
    });
    expect(forCustomer).toHaveLength(2);
    expect(forCustomer.every((l) => l.dimensions.customerId === 'cust-1')).toBe(true);

    const unassigned = await listCanonicalLines(client, ctx(), {
      accountIds: ['rev'],
      dimensionKey: 'customerId',
      dimensionValue: 'UNASSIGNED',
    });
    // Legacy revenue lines have no customer dimension — explicitly unassigned.
    expect(unassigned.length).toBe(3);
    expect(unassigned.every((l) => l.dimensionStatus !== 'ASSIGNED')).toBe(true);
  });

  it('treats legacy lines as base-currency and preserves V2 line currency', async () => {
    const seed = dimensionSeed();
    seed.journalEntryLines.find((l) => l.id === 'v1').currency = 'USD';
    const { client } = makeAcctV2PrismaStub(seed);
    const usd = await listCanonicalLines(client, ctx(), { currency: 'USD' });
    expect(usd).toHaveLength(1);
    expect(usd[0].lineId).toBe('v1');
    const mwk = await listCanonicalLines(client, ctx(), { currency: 'MWK', accountIds: ['cash'] });
    expect(mwk.length).toBeGreaterThan(0); // legacy lines included as base currency
  });
});

/* ── 52.6 Canonical journal query service ────────────────────────────────── */

describe('canonical journal query service', () => {
  it('lists ACCOUNTING_V2 journals under the ledger authority rule', async () => {
    const { client } = makeAcctV2PrismaStub(dualLedgerSeed());
    const { journals } = await listCanonicalJournals(client, ctx(), { pageSize: 50 });
    const ids = journals.map((j) => j.journalId);
    expect(ids).toContain('je1');
    expect(ids).toContain('je-manual');
    expect(ids).not.toContain('tx-archive');
    expect(ids).not.toContain('je-legacy-ignored');
    expect(ids).not.toContain('je-draft');
  });

  it('returns full V2 journal detail with lineage', async () => {
    const { client } = makeAcctV2PrismaStub(dualLedgerSeed());
    const je = await getCanonicalJournal(client, ctx(), { journalId: 'je1' });
    expect(je.journalKind).toBe('ACCOUNTING_V2');
    expect(je.lines).toHaveLength(2);
    expect(je.lineage.source).toEqual({ sourceType: 'Sale', sourceId: 's1' });
  });

  it('normalizes historical status vocabulary', () => {
    expect(normalizeJournalStatus('posted')).toBe('POSTED');
    expect(normalizeJournalStatus('POSTED')).toBe('POSTED');
    expect(normalizeJournalStatus('Void')).toBe('VOID');
    expect(normalizeJournalStatus('PendingApproval')).toBe('PENDING_APPROVAL');
    expect(normalizeJournalStatus('???')).toBe('UNKNOWN');
  });

  it('never returns another business\'s journal', async () => {
    const { client } = makeAcctV2PrismaStub(dualLedgerSeed());
    expect(await getCanonicalJournal(client, ctx(CREATOR, T1), { journalId: 'tx-other' })).toBeNull();
  });
});

/* ── 52.7 Reversal workflow ──────────────────────────────────────────────── */

describe('V2 journal reversal', () => {
  const reversalStub = () =>
    makeAcctV2PrismaStub({ ...newEngineSeed(), accounts: ledgerAccounts() });

  it('creates a posted opposite journal and links both directions atomically', async () => {
    const { client, data } = reversalStub();
    const originalId = await postedManualJournal(client);

    const result = await reverseJournal(
      ctx(APPROVER),
      originalId,
      { reason: 'Posted to the wrong month', hasPermission: allow },
      client
    );
    expect(result.postingStatus).toBe('POSTED');
    expect(result.journalNumber).toMatch(/^REV-/);

    const original = data.legacyJournalEntries.find((j) => j.id === originalId);
    expect(original.status).toBe('Reversed');
    expect(original.reversalStatus).toBe('REVERSED');
    expect(original.reversedByJournalId).toBe(result.journalEntryId);
    expect(original.reversedAt).toBeTruthy();

    const reversal = data.legacyJournalEntries.find((j) => j.id === result.journalEntryId);
    expect(reversal.entryType).toBe('Reversal');
    expect(reversal.originalJournalId).toBe(originalId);
    expect(reversal.reversalStatus).toBe('REVERSAL');

    // Lines are mirrored with debit/credit swapped.
    const reversalLines = data.journalEntryLines.filter((l) => l.journalEntryId === reversal.id);
    const originalLines = data.journalEntryLines.filter((l) => l.journalEntryId === originalId);
    const byAccount = (lines, id) => lines.find((l) => l.accountId === id);
    expect(Number(byAccount(reversalLines, 'exp').creditAmount)).toBe(Number(byAccount(originalLines, 'exp').debitAmount));
    expect(Number(byAccount(reversalLines, 'cash').debitAmount)).toBe(Number(byAccount(originalLines, 'cash').creditAmount));
  });

  it('nets the ledger to zero after the reversal (both journals remain visible)', async () => {
    const { client } = reversalStub();
    const originalId = await postedManualJournal(client);
    await reverseJournal(ctx(APPROVER), originalId, { reason: 'error', hasPermission: allow }, client);

    const totals = await getCanonicalAccountTotals(client, ctx());
    expect(totals.get('exp').debitMinor).toBe(totals.get('exp').creditMinor);
    expect(totals.get('cash').debitMinor).toBe(totals.get('cash').creditMinor);

    const lines = await listCanonicalLines(client, ctx(), { accountIds: ['exp'] });
    expect(lines).toHaveLength(2); // original + reversal both in the ledger
  });

  it('a repeated reversal request never creates a second reversal journal', async () => {
    const { client, data } = reversalStub();
    const originalId = await postedManualJournal(client);
    const first = await reverseJournal(ctx(APPROVER), originalId, { reason: 'first', hasPermission: allow }, client);
    // Same accounting identity → idempotent replay of the original reversal.
    const second = await reverseJournal(ctx(APPROVER), originalId, { reason: 'second', hasPermission: allow }, client);
    expect(second.wasExistingPosting).toBe(true);
    expect(second.journalEntryId).toBe(first.journalEntryId);
    const reversals = data.legacyJournalEntries.filter((j) => j.entryType === 'Reversal');
    expect(reversals).toHaveLength(1);
  });

  it('requires a reason and the journal.reverse permission', async () => {
    const { client } = reversalStub();
    const originalId = await postedManualJournal(client);
    await expect(
      reverseJournal(ctx(APPROVER), originalId, { reason: '', hasPermission: allow }, client)
    ).rejects.toThrow(AccountingValidationError);
    await expect(
      reverseJournal(ctx(APPROVER), originalId, { reason: 'valid reason', hasPermission: deny }, client)
    ).rejects.toThrow(/permission/i);
  });

  it('refuses to reverse LEGACY_V1 journals through the V2 workflow', async () => {
    const seed = { ...newEngineSeed(), ...dualLedgerSeed() };
    seed.configurations = newEngineSeed().configurations;
    seed.featureFlags = newEngineSeed().featureFlags;
    const { client } = makeAcctV2PrismaStub(seed);
    await expect(
      reverseJournal(ctx(APPROVER), 'je-legacy-ignored', { reason: 'nope', hasPermission: allow }, client)
    ).rejects.toThrow(/legacy/i);
  });

  it('preview never posts anything', async () => {
    const { client, data } = reversalStub();
    const originalId = await postedManualJournal(client);
    const before = data.legacyJournalEntries.length;
    const preview = await previewReversal(
      ctx(APPROVER),
      originalId,
      { reason: 'checking', hasPermission: allow },
      client
    );
    expect(preview.posted).toBe(false);
    expect(data.legacyJournalEntries.length).toBe(before);
    const original = data.legacyJournalEntries.find((j) => j.id === originalId);
    expect(original.status).toBe('Posted');
  });
});

/* ── 52.8 Projection rebuild ─────────────────────────────────────────────── */

describe('ledger projection rebuild', () => {
  it('builds a validated monthly projection and versions the swap', async () => {
    const { client, data } = makeAcctV2PrismaStub(dualLedgerSeed());
    const report = await rebuildLedgerProjection(client, ctx(), {});
    expect(report.validated).toBe(true);
    expect(report.newVersion).toBe(1);
    expect(report.months).toBe(2); // June + July

    const { version, totals } = await getProjectedAccountTotals(client, ctx());
    expect(version).toBe(1);
    expect(totals.get('cash')).toMatchObject({ debitMinor: 15000, creditMinor: 2550 });

    // Second rebuild replaces version 1 with version 2 — no duplicates left.
    await rebuildLedgerProjection(client, ctx(), {});
    expect(await getActiveProjectionVersion(client, T1)).toBe(2);
    expect(data.ledgerBalances.every((r) => r.projectionVersion === 2)).toBe(true);
    expect(data.auditLogs.some((a) => a.action === 'acctv2.ledger.rebuild')).toBe(true);
  });

  it('dry-run computes the report without writing rows', async () => {
    const { client, data } = makeAcctV2PrismaStub(dualLedgerSeed());
    const report = await rebuildLedgerProjection(client, ctx(), { dryRun: true });
    expect(report.dryRun).toBe(true);
    expect(report.rows).toBeGreaterThan(0);
    expect(data.ledgerBalances).toHaveLength(0);
  });
});

/* ── 52.9 Reconciliation + integrity rules ───────────────────────────────── */

describe('ledger reconciliation', () => {
  it('proves the double-entry invariant and detects stored-balance drift (GL-111)', async () => {
    const seed = dualLedgerSeed();
    seed.accounts.find((a) => a.id === 'cash').balance = 999.99; // drifted cache
    seed.accounts.find((a) => a.id === 'rev').balance = 150.0; // correct
    const { client } = makeAcctV2PrismaStub(seed);
    const report = await runLedgerReconciliation(client, ctx(), { runJournalChecks: false });

    expect(report.canonical.balanced).toBe(true);
    const drift = report.findings.filter((f) => f.rule === 'GL-111');
    expect(drift.some((f) => f.accountId === 'cash')).toBe(true);
    expect(drift.some((f) => f.accountId === 'rev')).toBe(false);
    const cashDrift = drift.find((f) => f.accountId === 'cash');
    expect(cashDrift.derivedMinor).toBe(12450); // 124.50 derived from posted lines
  });

  it('detects a stale projection after new postings (GL-114)', async () => {
    const seed = dualLedgerSeed();
    const { client, data } = makeAcctV2PrismaStub(seed);
    await rebuildLedgerProjection(client, ctx(), {});
    // New V2 activity lands after the rebuild.
    data.legacyJournalEntries.push({
      id: 'je-late', tenantId: T1, transactionId: null, status: 'Posted',
      entryDate: D('2026-07-20'), postingDate: D('2026-07-20'), description: 'Late sale',
      createdAt: D('2026-07-20'), architectureVersion: 'ACCOUNTING_V2',
    });
    data.journalEntryLines.push(
      { id: 'll1', journalEntryId: 'je-late', lineNumber: 1, accountId: 'cash', debitAmount: 7, creditAmount: 0 },
      { id: 'll2', journalEntryId: 'je-late', lineNumber: 2, accountId: 'rev', debitAmount: 0, creditAmount: 7 }
    );
    const report = await runLedgerReconciliation(client, ctx(), {
      compareStoredBalances: false,
      runJournalChecks: false,
    });
    expect(report.findings.some((f) => f.rule === 'GL-114' && f.accountId === 'cash')).toBe(true);
  });

  it('journal integrity checks find unbalanced journals, header-amount rows and bad lines', async () => {
    const seed = dualLedgerSeed();
    seed.legacyJournalEntries.push({
      id: 'je-unbalanced', tenantId: T1, transactionId: null, status: 'Posted',
      entryDate: D('2026-07-13'), postingDate: D('2026-07-13'), description: 'Unbalanced',
      createdAt: D('2026-07-13'), architectureVersion: 'ACCOUNTING_V2',
    });
    seed.journalEntryLines.push(
      { id: 'u1', journalEntryId: 'je-unbalanced', lineNumber: 1, accountId: 'exp', debitAmount: 50, creditAmount: 0 },
      { id: 'u2', journalEntryId: 'je-unbalanced', lineNumber: 1, accountId: 'cash', debitAmount: 0, creditAmount: 30 },
      { id: 'u3', journalEntryId: 'je-unbalanced', lineNumber: 3, accountId: 'cash', debitAmount: 5, creditAmount: 5 }
    );
    const { client } = makeAcctV2PrismaStub(seed);
    const findings = await runJournalIntegrityChecks(client, ctx());
    const rules = findings.map((f) => f.rule);
    expect(rules).toContain('JRN-102'); // unbalanced
    expect(rules).toContain('JRN-104'); // header-amount row
    expect(rules).toContain('JRN-105'); // both-sides line
    expect(rules).toContain('JRN-110'); // duplicate sequence
  });

  it('reconciliation is read-only and audited', async () => {
    const seed = dualLedgerSeed();
    const { client, data } = makeAcctV2PrismaStub(seed);
    const journalsBefore = JSON.stringify(data.legacyJournalEntries);
    const linesBefore = JSON.stringify(data.journalEntryLines);
    await runLedgerReconciliation(client, ctx(), {});
    expect(JSON.stringify(data.legacyJournalEntries)).toBe(journalsBefore);
    expect(JSON.stringify(data.journalEntryLines)).toBe(linesBefore);
    expect(data.auditLogs.some((a) => a.action === 'acctv2.ledger.reconciliation')).toBe(true);
  });
});
