import { describe, expect, it } from 'vitest';
import { toCents, centsToAmount, derivedBalanceCents, makeFinding, SEVERITY } from '../lib/accountingAudit/findings.js';
import { runJournalIntegrityAudit } from '../lib/accountingAudit/journalIntegrityAudit.js';
import { runTrialBalanceAudit } from '../lib/accountingAudit/trialBalanceAudit.js';
import { runCapitalEquityAudit } from '../lib/accountingAudit/capitalEquityAudit.js';
import { runPeriodsAudit, runReversalsAudit } from '../lib/accountingAudit/periodsReversalsAudit.js';

/**
 * In-memory Prisma stub. The audit engine must be read-only, so the stub only
 * implements read methods; any write access throws, proving the engine never writes.
 */
function makePrismaStub(data) {
  const {
    transactions = [],
    journalEntries = [],
    tenants = [],
    accounts = [],
    accountingPeriods = [],
    equityAccounts = [],
  } = data;

  const wrapLines = (txn) => ({ ...txn, lines: txn.lines || [] });

  const filterWhere = (rows, where = {}) =>
    rows.filter((r) => {
      for (const [key, cond] of Object.entries(where)) {
        if (cond === undefined) continue;
        if (key === 'lines') continue;
        if (cond && typeof cond === 'object' && !Array.isArray(cond)) {
          if ('in' in cond && !cond.in.includes(r[key])) return false;
          if ('notIn' in cond && cond.notIn.includes(r[key])) return false;
          if ('not' in cond && r[key] === cond.not) return false;
          if ('gte' in cond && !(r[key] >= cond.gte)) return false;
          if ('lte' in cond && !(r[key] <= cond.lte)) return false;
        } else if (r[key] !== cond) {
          return false;
        }
      }
      return true;
    });

  const forbidWrite = (op) => async () => {
    throw new Error(`Audit engine attempted write operation: ${op}`);
  };

  return {
    transaction: {
      findMany: async ({ where = {}, take, cursor, skip }) => {
        let rows = filterWhere(transactions, where).map(wrapLines);
        if (where.isReversal !== undefined) rows = rows.filter((r) => r.isReversal === where.isReversal);
        rows.sort((a, b) => (a.id < b.id ? -1 : 1));
        if (cursor) {
          const idx = rows.findIndex((r) => r.id === cursor.id);
          rows = rows.slice(idx + (skip || 0));
        }
        return take ? rows.slice(0, take) : rows;
      },
      findUnique: async ({ where }) => {
        const row = transactions.find((t) => t.id === where.id);
        return row ? wrapLines(row) : null;
      },
      count: async ({ where = {} }) => filterWhere(transactions, where).length,
      groupBy: async ({ by, where = {}, having }) => {
        const rows = filterWhere(transactions, where).filter((r) => {
          if (where.sourceType?.not === null && !r.sourceType) return false;
          if (where.sourceId?.not === null && !r.sourceId) return false;
          if (where.reversedTransactionId?.not === null && !r.reversedTransactionId) return false;
          if (where.status?.in && !where.status.in.includes(r.status)) return false;
          return true;
        });
        const groups = new Map();
        for (const r of rows) {
          const key = by.map((k) => r[k]).join('|');
          if (!groups.has(key)) groups.set(key, { keys: Object.fromEntries(by.map((k) => [k, r[k]])), count: 0 });
          groups.get(key).count += 1;
        }
        let out = [...groups.values()].map((g) => ({ ...g.keys, _count: { id: g.count } }));
        if (having?.id?._count?.gt !== undefined) out = out.filter((g) => g._count.id > having.id._count.gt);
        return out;
      },
      create: forbidWrite('transaction.create'),
      update: forbidWrite('transaction.update'),
      delete: forbidWrite('transaction.delete'),
    },
    transactionLine: {
      groupBy: async ({ where = {} }) => {
        const parentWhere = where.transaction || {};
        const eligible = filterWhere(transactions, parentWhere);
        const groups = new Map();
        for (const t of eligible) {
          for (const l of t.lines || []) {
            const g = groups.get(l.accountId) || { debitAmount: 0, creditAmount: 0 };
            g.debitAmount += Number(l.debitAmount || 0);
            g.creditAmount += Number(l.creditAmount || 0);
            groups.set(l.accountId, g);
          }
        }
        return [...groups.entries()].map(([accountId, sums]) => ({
          accountId,
          _sum: { debitAmount: sums.debitAmount, creditAmount: sums.creditAmount },
        }));
      },
      findMany: async ({ where = {} }) => {
        const parentWhere = where.transaction || {};
        const eligible = filterWhere(transactions, parentWhere);
        const out = [];
        for (const t of eligible) {
          for (const l of t.lines || []) {
            if (where.accountId && l.accountId !== where.accountId) continue;
            out.push({ ...l, transaction: t });
          }
        }
        return out;
      },
      aggregate: async () => ({ _sum: { debitAmount: 0, creditAmount: 0 } }),
    },
    journalEntry: {
      findMany: async ({ where = {}, take, cursor, skip }) => {
        let rows = filterWhere(journalEntries, where).map(wrapLines);
        if (where.lines?.none) rows = rows.filter((r) => (r.lines || []).length === 0);
        rows.sort((a, b) => (a.id < b.id ? -1 : 1));
        if (cursor) {
          const idx = rows.findIndex((r) => r.id === cursor.id);
          rows = rows.slice(idx + (skip || 0));
        }
        return take ? rows.slice(0, take) : rows;
      },
      groupBy: async ({ by, where = {}, having }) => {
        const rows = filterWhere(journalEntries, where).filter((r) => {
          if (where.sourceType?.not === null && !r.sourceType) return false;
          if (where.sourceId?.not === null && !r.sourceId) return false;
          return true;
        });
        const groups = new Map();
        for (const r of rows) {
          const key = by.map((k) => r[k]).join('|');
          if (!groups.has(key)) groups.set(key, { keys: Object.fromEntries(by.map((k) => [k, r[k]])), count: 0 });
          groups.get(key).count += 1;
        }
        let out = [...groups.values()].map((g) => ({ ...g.keys, _count: { id: g.count } }));
        if (having?.id?._count?.gt !== undefined) out = out.filter((g) => g._count.id > having.id._count.gt);
        return out;
      },
    },
    journalEntryLine: {
      groupBy: async () => [],
      findMany: async ({ where = {} }) => {
        const parentWhere = where.journalEntry || {};
        const eligible = filterWhere(journalEntries, parentWhere);
        const out = [];
        for (const je of eligible) {
          for (const l of je.lines || []) {
            if (where.accountId && l.accountId !== where.accountId) continue;
            out.push({ ...l, journalEntry: je });
          }
        }
        return out;
      },
      aggregate: async () => ({ _sum: { debitAmount: 0, creditAmount: 0 } }),
    },
    tenant: { findMany: async () => tenants },
    account: {
      findMany: async ({ where = {} }) => {
        let rows = accounts;
        if (where.tenantId) rows = rows.filter((a) => a.tenantId === where.tenantId);
        if (where.accountType) rows = rows.filter((a) => a.accountType === where.accountType);
        if (where.id?.in) rows = rows.filter((a) => where.id.in.includes(a.id));
        if (where.accountCode?.in) rows = rows.filter((a) => where.accountCode.in.includes(a.accountCode));
        return rows;
      },
    },
    accountingPeriod: { findMany: async () => accountingPeriods },
    equityAccount: { findMany: async () => equityAccounts },
    $queryRaw: async () => [],
  };
}

const T = 'tenant-1';

function balancedTxn(id, overrides = {}) {
  return {
    id,
    tenantId: T,
    reference: `REF-${id}`,
    status: 'posted',
    sourceType: 'sale',
    sourceId: `src-${id}`,
    isReversal: false,
    postedDate: new Date('2026-06-01'),
    date: new Date('2026-06-01'),
    createdAt: new Date('2026-06-01'),
    lines: [
      { id: `${id}-l1`, accountId: 'acc-cash', debitAmount: 100, creditAmount: 0 },
      { id: `${id}-l2`, accountId: 'acc-rev', debitAmount: 0, creditAmount: 100 },
    ],
    ...overrides,
  };
}

describe('findings helpers', () => {
  it('converts decimals to exact cents without float drift', () => {
    expect(toCents('0.1')).toBe(10);
    expect(toCents('0.2')).toBe(20);
    expect(toCents('1000000')).toBe(100000000);
    expect(toCents('19.99')).toBe(1999);
    expect(toCents('-5.5')).toBe(-550);
    expect(centsToAmount(toCents('0.1') + toCents('0.2'))).toBe(0.3);
  });

  it('derives balances per normal side', () => {
    expect(derivedBalanceCents({ accountType: 'Asset' }, 1000, 400)).toBe(600);
    expect(derivedBalanceCents({ accountType: 'Equity' }, 400, 1000)).toBe(600);
    expect(derivedBalanceCents({ accountType: null, normalBalance: 'Debit' }, 1000, 400)).toBe(600);
  });

  it('builds findings with required forensic fields', () => {
    const f = makeFinding({
      ruleCode: 'TB-001',
      severity: SEVERITY.CRITICAL,
      category: 'trial_balance',
      description: 'x',
    });
    expect(f.ruleCode).toBe('TB-001');
    expect(f.createdAt).toBeTruthy();
    expect(f.confidence).toBe('confirmed');
  });
});

describe('journal integrity audit', () => {
  it('accepts balanced journals without findings (no false positives)', async () => {
    const prisma = makePrismaStub({ transactions: [balancedTxn('t1'), balancedTxn('t2')] });
    const { findings, stats } = await runJournalIntegrityAudit(prisma, {});
    expect(stats.transactionsScanned).toBe(2);
    expect(findings.filter((f) => f.ruleCode === 'JRN-001')).toHaveLength(0);
  });

  it('detects unbalanced journals (JRN-001)', async () => {
    const bad = balancedTxn('t3');
    bad.lines[1].creditAmount = 90;
    const prisma = makePrismaStub({ transactions: [bad] });
    const { findings } = await runJournalIntegrityAudit(prisma, {});
    const hit = findings.find((f) => f.ruleCode === 'JRN-001');
    expect(hit).toBeTruthy();
    expect(hit.differenceAmount).toBe(10);
    expect(hit.severity).toBe('critical');
  });

  it('detects journals with no lines and single lines (JRN-002)', async () => {
    const noLines = balancedTxn('t4', { lines: [] });
    const oneLine = balancedTxn('t5');
    oneLine.lines = [oneLine.lines[0]];
    const prisma = makePrismaStub({ transactions: [noLines, oneLine] });
    const { findings } = await runJournalIntegrityAudit(prisma, {});
    expect(findings.filter((f) => f.ruleCode === 'JRN-002')).toHaveLength(2);
  });

  it('detects lines with both debit and credit (JRN-003)', async () => {
    const bad = balancedTxn('t6');
    bad.lines[0] = { ...bad.lines[0], debitAmount: 100, creditAmount: 100 };
    bad.lines[1] = { ...bad.lines[1], debitAmount: 100, creditAmount: 100 };
    const prisma = makePrismaStub({ transactions: [bad] });
    const { findings } = await runJournalIntegrityAudit(prisma, {});
    expect(findings.filter((f) => f.ruleCode === 'JRN-003')).toHaveLength(2);
  });

  it('detects duplicate posted sources (JRN-006)', async () => {
    const a = balancedTxn('t7', { sourceType: 'invoice', sourceId: 'inv-1' });
    const b = balancedTxn('t8', { sourceType: 'invoice', sourceId: 'inv-1' });
    const prisma = makePrismaStub({ transactions: [a, b] });
    const { findings } = await runJournalIntegrityAudit(prisma, {});
    const dup = findings.find((f) => f.ruleCode === 'JRN-006');
    expect(dup).toBeTruthy();
    expect(dup.entityId).toBe('invoice:inv-1');
  });

  it('flags legacy header-amount journal entries (JRN-009)', async () => {
    const prisma = makePrismaStub({
      journalEntries: [
        {
          id: 'je1',
          tenantId: T,
          status: 'Posted',
          referenceNumber: 'LEG-1',
          debit: 5000,
          credit: 0,
          accountId: 'acc-cap',
          lines: [],
        },
      ],
    });
    const { findings } = await runJournalIntegrityAudit(prisma, {});
    expect(findings.find((f) => f.ruleCode === 'JRN-009')).toBeTruthy();
  });

  it('respects tenant scoping', async () => {
    const other = balancedTxn('t9', { tenantId: 'tenant-2' });
    other.lines[1].creditAmount = 1; // unbalanced, but out of scope
    const prisma = makePrismaStub({ transactions: [balancedTxn('t10'), other] });
    const { findings, stats } = await runJournalIntegrityAudit(prisma, { tenantId: T });
    expect(stats.transactionsScanned).toBe(1);
    expect(findings.filter((f) => f.ruleCode === 'JRN-001')).toHaveLength(0);
  });
});

describe('trial balance audit', () => {
  it('balances for valid double-entry data (TB-001 absent)', async () => {
    const prisma = makePrismaStub({
      tenants: [{ id: T, name: 'Tenant One' }],
      transactions: [balancedTxn('t1'), balancedTxn('t2')],
      accounts: [
        { id: 'acc-cash', tenantId: T, accountCode: '1110', accountName: 'Cash', accountType: 'Asset', parentAccountId: null },
        { id: 'acc-rev', tenantId: T, accountCode: '4000', accountName: 'Revenue', accountType: 'Revenue', parentAccountId: null },
      ],
    });
    const { findings, perTenant } = await runTrialBalanceAudit(prisma, {});
    expect(perTenant[0].balanced).toBe(true);
    expect(findings.filter((f) => f.ruleCode === 'TB-001')).toHaveLength(0);
  });

  it('detects an unbalanced ledger (TB-001)', async () => {
    const bad = balancedTxn('t1');
    bad.lines[1].creditAmount = 60;
    const prisma = makePrismaStub({
      tenants: [{ id: T }],
      transactions: [bad],
      accounts: [
        { id: 'acc-cash', tenantId: T, accountCode: '1110', accountType: 'Asset', parentAccountId: null },
        { id: 'acc-rev', tenantId: T, accountCode: '4000', accountType: 'Revenue', parentAccountId: null },
      ],
    });
    const { findings } = await runTrialBalanceAudit(prisma, {});
    const hit = findings.find((f) => f.ruleCode === 'TB-001');
    expect(hit).toBeTruthy();
    expect(hit.differenceAmount).toBe(40);
  });

  it('flags parent accounts with direct postings and posted children (TB-003)', async () => {
    const parentPosted = balancedTxn('t1');
    parentPosted.lines = [
      { id: 'l1', accountId: 'acc-parent', debitAmount: 50, creditAmount: 0 },
      { id: 'l2', accountId: 'acc-rev', debitAmount: 0, creditAmount: 50 },
    ];
    const childPosted = balancedTxn('t2');
    childPosted.lines = [
      { id: 'l3', accountId: 'acc-child', debitAmount: 70, creditAmount: 0 },
      { id: 'l4', accountId: 'acc-rev', debitAmount: 0, creditAmount: 70 },
    ];
    const prisma = makePrismaStub({
      tenants: [{ id: T }],
      transactions: [parentPosted, childPosted],
      accounts: [
        { id: 'acc-parent', tenantId: T, accountCode: '1100', accountType: 'Asset', parentAccountId: null },
        { id: 'acc-child', tenantId: T, accountCode: '1110', accountType: 'Asset', parentAccountId: 'acc-parent' },
        { id: 'acc-rev', tenantId: T, accountCode: '4000', accountType: 'Revenue', parentAccountId: null },
      ],
    });
    const { findings } = await runTrialBalanceAudit(prisma, {});
    expect(findings.find((f) => f.ruleCode === 'TB-003')).toBeTruthy();
  });
});

describe('capital & equity audit', () => {
  it('confirms stored-vs-derived gaps explained by legacy header journals (CAP-005)', async () => {
    const prisma = makePrismaStub({
      accounts: [
        {
          id: 'acc-cap',
          tenantId: T,
          accountCode: '3102',
          accountName: 'Capital contribution',
          accountType: 'Equity',
          parentAccountId: null,
          balance: 5000,
          isActive: true,
        },
      ],
      journalEntries: [
        {
          id: 'je1',
          tenantId: T,
          status: 'Posted',
          transactionId: null,
          accountId: 'acc-cap',
          referenceNumber: 'LEG-CR',
          debit: 0,
          credit: 5000,
          lines: [],
        },
      ],
    });
    const { findings, traces } = await runCapitalEquityAudit(prisma, {});
    const hit = findings.find((f) => f.ruleCode === 'CAP-005');
    expect(hit).toBeTruthy();
    expect(hit.confidence).toBe('confirmed');
    expect(traces[0].derivedFromLines).toBe(0);
    expect(traces[0].derivedWithLegacyHeaders).toBe(5000);
    expect(traces[0].storedBalance).toBe(5000);
  });

  it('detects duplicate capital postings for the same source (CAP-001)', async () => {
    const capTxn = (id) => ({
      id,
      tenantId: T,
      reference: `CAP-${id}`,
      status: 'posted',
      sourceType: 'capital_contribution',
      sourceId: 'contrib-1',
      isReversal: false,
      date: new Date('2026-06-01'),
      createdAt: new Date('2026-06-01'),
      lines: [
        { id: `${id}-l1`, accountId: 'acc-cash', debitAmount: 1000000, creditAmount: 0 },
        { id: `${id}-l2`, accountId: 'acc-cap', debitAmount: 0, creditAmount: 1000000 },
      ],
    });
    const prisma = makePrismaStub({
      accounts: [
        { id: 'acc-cap', tenantId: T, accountCode: '3100', accountName: "Owner's Capital", accountType: 'Equity', balance: 2000000, isActive: true, parentAccountId: null },
      ],
      transactions: [capTxn('c1'), capTxn('c2')],
    });
    const { findings, traces } = await runCapitalEquityAudit(prisma, {});
    const dup = findings.find((f) => f.ruleCode === 'CAP-001');
    expect(dup).toBeTruthy();
    expect(dup.description).toContain('capital_contribution:contrib-1');
    // The MK1M-posted-twice-shows-MK2M trace:
    expect(traces[0].derivedFromLines).toBe(2000000);
  });

  it('flags parent+child equity balances (CAP-002)', async () => {
    const prisma = makePrismaStub({
      accounts: [
        { id: 'eq-parent', tenantId: T, accountCode: '3000', accountName: 'Equity', accountType: 'Equity', balance: 1000, isActive: true, parentAccountId: null },
        { id: 'eq-child', tenantId: T, accountCode: '3100', accountName: 'Owner Capital', accountType: 'Equity', balance: 1000, isActive: true, parentAccountId: 'eq-parent' },
      ],
    });
    const { findings } = await runCapitalEquityAudit(prisma, {});
    expect(findings.find((f) => f.ruleCode === 'CAP-002')).toBeTruthy();
  });
});

describe('periods & reversals audit', () => {
  it('detects overlapping periods (PER-003)', async () => {
    const prisma = makePrismaStub({
      accountingPeriods: [
        { id: 'p1', tenantId: T, name: 'Jun', periodType: 'Monthly', startDate: new Date('2026-06-01'), endDate: new Date('2026-06-30'), status: 'open' },
        { id: 'p2', tenantId: T, name: 'Jun-b', periodType: 'Monthly', startDate: new Date('2026-06-15'), endDate: new Date('2026-07-15'), status: 'open' },
      ],
    });
    const { findings } = await runPeriodsAudit(prisma, {});
    expect(findings.find((f) => f.ruleCode === 'PER-003')).toBeTruthy();
  });

  it('detects reopened periods without reason (PER-004)', async () => {
    const prisma = makePrismaStub({
      accountingPeriods: [
        { id: 'p1', tenantId: T, name: 'May', periodType: 'Monthly', startDate: new Date('2026-05-01'), endDate: new Date('2026-05-31'), status: 'open', reopenedAt: new Date(), reopenReason: null },
      ],
    });
    const { findings } = await runPeriodsAudit(prisma, {});
    expect(findings.find((f) => f.ruleCode === 'PER-004')).toBeTruthy();
  });

  it('detects reversals without originals and double reversals (REV-001/REV-002)', async () => {
    const orphanRev = balancedTxn('r1', { isReversal: true, reversedTransactionId: null });
    const original = balancedTxn('o1');
    const rev1 = balancedTxn('r2', { isReversal: true, reversedTransactionId: 'o1' });
    const rev2 = balancedTxn('r3', { isReversal: true, reversedTransactionId: 'o1' });
    const prisma = makePrismaStub({ transactions: [orphanRev, original, rev1, rev2] });
    const { findings } = await runReversalsAudit(prisma, {});
    expect(findings.find((f) => f.ruleCode === 'REV-001')).toBeTruthy();
    expect(findings.find((f) => f.ruleCode === 'REV-002')).toBeTruthy();
  });

  it('detects reversal amount mismatches (REV-003)', async () => {
    const original = balancedTxn('o1');
    const rev = balancedTxn('r1', { isReversal: true, reversedTransactionId: 'o1' });
    rev.lines = [
      { id: 'rl1', accountId: 'acc-cash', debitAmount: 0, creditAmount: 90 },
      { id: 'rl2', accountId: 'acc-rev', debitAmount: 90, creditAmount: 0 },
    ];
    const prisma = makePrismaStub({ transactions: [original, rev] });
    const { findings } = await runReversalsAudit(prisma, {});
    const hit = findings.find((f) => f.ruleCode === 'REV-003');
    expect(hit).toBeTruthy();
    expect(hit.differenceAmount).toBe(-10);
  });
});
