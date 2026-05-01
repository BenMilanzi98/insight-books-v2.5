/**
 * Chart list GL aggregation + rollup invariants (mirrors key behaviors from GET /api/chart-of-accounts).
 */
import { describe, it, expect, vi } from 'vitest';
import { loadCoaBulkGlAggregates } from '../lib/coaBulkGlAggregation.js';

describe('loadCoaBulkGlAggregates (chart route GL)', () => {
  it('sums journal + txn for survivor; journal query requires transactionId null; txn excludes reversals', async () => {
    const journalCalls = [];
    const txnCalls = [];
    const prisma = {
      journalEntryLine: {
        findMany: vi.fn(async (args) => {
          journalCalls.push(args);
          return [
            {
              id: 'jl1',
              accountId: 'a1',
              debitAmount: '100',
              creditAmount: '0',
              journalEntry: { status: 'Posted', entryDate: new Date(2024, 4, 1), postedDate: null },
            },
          ];
        }),
      },
      transactionLine: {
        findMany: vi.fn(async (args) => {
          txnCalls.push(args);
          return [
            {
              id: 'tl1',
              accountId: 'a1',
              debitAmount: '0',
              creditAmount: '40',
              transaction: {
                date: new Date(2024, 4, 2),
                status: 'posted',
                isReversal: false,
              },
            },
          ];
        }),
      },
    };

    const account = {
      id: 'a1',
      accountCode: '1100',
      accountType: 'Asset',
    };

    const r = await loadCoaBulkGlAggregates(prisma, {
      tenantId: 't1',
      glBranchFilter: { branchId: 'b1' },
      mergeRollupCtx: { survivorOf: (id) => id, allIdsRollingInto: () => ['a1'] },
      accounts: [account],
      dateRange: { from: null, to: null, invalid: false },
      fiscalYearStartMonth: 1,
    });

    expect(journalCalls[0].where.journalEntry.transactionId).toBeNull();
    expect(txnCalls[0].where.transaction.isReversal).toBe(false);
    expect(txnCalls[0].where.transaction.branchId).toBe('b1');

    const j = r.journalBySurvivor.get('a1');
    const t = r.txnBySurvivor.get('a1');
    expect(j.debit).toBe(100);
    expect(j.credit).toBe(0);
    expect(t.debit).toBe(0);
    expect(t.credit).toBe(40);
  });

  it('dedupes the same journal line id when returned from BS and IS journal chunk queries', async () => {
    const sameLine = {
      id: 'jl-one',
      accountId: 'a-bs',
      debitAmount: '15',
      creditAmount: '0',
      journalEntry: { status: 'Posted', entryDate: new Date(2024, 5, 1), postedDate: null },
    };
    const prisma = {
      journalEntryLine: {
        findMany: vi.fn(async () => [sameLine]),
      },
      transactionLine: {
        findMany: vi.fn(async () => []),
      },
    };

    const asset = { id: 'a-bs', accountCode: '1100', accountType: 'Asset' };
    const revenue = { id: 'a-is', accountCode: '4000', accountType: 'Income' };
    const mergeRollupCtx = {
      survivorOf: (id) => id,
      allIdsRollingInto: (id) => [id],
    };

    const r = await loadCoaBulkGlAggregates(prisma, {
      tenantId: 't1',
      glBranchFilter: {},
      mergeRollupCtx,
      accounts: [asset, revenue],
      dateRange: {
        from: new Date(2024, 0, 1),
        to: new Date(2024, 11, 31),
        invalid: false,
      },
      fiscalYearStartMonth: 1,
    });

    expect(prisma.journalEntryLine.findMany).toHaveBeenCalled();
    const bsOnly = r.journalBySurvivor.get('a-bs');
    expect(bsOnly.lineCount).toBe(1);
    expect(bsOnly.debit).toBe(15);
  });
});

describe('synthetic direct + parent rollup', () => {
  it('parent total equals sum of child rows including synthetic direct (≤ 0.005 drift)', async () => {
    const { injectSyntheticDirectPostingLeaves, applyCoaParentRollup } = await import('../lib/coaChartRollup.js');
    const { roundCents, COA_RECONCILE_TOLERANCE } = await import('../lib/coaMoney.js');

    const p = {
      id: 'p',
      parentAccountId: null,
      tenantId: 't',
      accountCode: '1000',
      accountType: 'Asset',
      postedDirectBalance: 10,
      currentBalance: 10,
    };
    const c = {
      id: 'c',
      parentAccountId: 'p',
      tenantId: 't',
      accountCode: '1100',
      accountType: 'Asset',
      postedDirectBalance: 25,
      currentBalance: 25,
    };
    const withSynth = injectSyntheticDirectPostingLeaves([p, c]);
    const rolled = applyCoaParentRollup(withSynth);
    const parent = rolled.find((x) => x.id === 'p');
    const kids = rolled.filter((x) => x.parentAccountId === 'p');
    const sumKids = kids.reduce((s, x) => s + (Number(x.currentBalance) || 0), 0);
    expect(Math.abs(roundCents(parent.currentBalance) - roundCents(sumKids))).toBeLessThanOrEqual(
      COA_RECONCILE_TOLERANCE
    );
  });
});
