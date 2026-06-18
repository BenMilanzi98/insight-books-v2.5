import { describe, it, expect } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { loadCoaBulkGlAggregates } from '../lib/coaBulkGlAggregation.js';
import {
  buildMergeRollupContext,
  fetchTenantAccountsForMergeRollup,
} from '../lib/accountMergeRollup.js';
import { buildCoaAccountListWhere } from '../lib/coaAccountListWhere.js';
import { inferCoaNormalBalance } from '../lib/coaMoney.js';
import {
  injectSyntheticDirectPostingLeaves,
  applyCoaParentRollup,
  foldCatchAllBucketTotalsIntoPostedDirect,
} from '../lib/coaChartRollup.js';
import { structureNodeBalanceBreakdown } from '../lib/coaStructureDisplayBalance.js';
import { SYSTEM_COA_STRUCTURE, groupAccountsByCode } from '../lib/coaSystemStructureTree.js';
import { tenantExistsForIntegration } from './helpers/dbIntegrationGuard.js';

const TENANT = 'cmff4eqli02h5jq2grs29src9';
const tenantReady = await tenantExistsForIntegration(TENANT);
const prisma = new PrismaClient();

function buildChartDateRange(from, to) {
  const dateRange = { from: null, to: null, invalid: false };
  if (from) {
    dateRange.from = new Date(from);
    dateRange.from.setHours(0, 0, 0, 0);
  }
  if (to) {
    dateRange.to = new Date(to);
    dateRange.to.setHours(23, 59, 59, 999);
  }
  return dateRange;
}

describe.skipIf(!tenantReady)('tenant expense balances pipeline', () => {
  async function runPipeline(dateFrom, dateTo, glBranchFilter = {}) {
    const sp = new URLSearchParams({ isActive: 'true' });
    if (dateFrom) sp.set('dateFrom', dateFrom);
    if (dateTo) sp.set('dateTo', dateTo);
    const accounts = await prisma.account.findMany({
      where: buildCoaAccountListWhere(TENANT, sp),
      select: {
        id: true,
        accountCode: true,
        accountName: true,
        accountType: true,
        type: true,
        normalBalance: true,
        parentAccountId: true,
        isActive: true,
      },
    });
    const mergeRollupCtx = buildMergeRollupContext(
      await fetchTenantAccountsForMergeRollup(TENANT, prisma)
    );
    const bulk = await loadCoaBulkGlAggregates(prisma, {
      tenantId: TENANT,
      glBranchFilter,
      mergeRollupCtx,
      accounts,
      dateRange: buildChartDateRange(dateFrom, dateTo),
      fiscalYearStartMonth: 1,
    });

    const parentIdsWithChildren = new Set();
    for (const a of accounts) {
      if (a.parentAccountId) parentIdsWithChildren.add(a.parentAccountId);
    }

    const withBal = accounts.map((account) => {
      const ja = bulk.journalBySurvivor.get(account.id) || { debit: 0, credit: 0, lineCount: 0 };
      const tx = bulk.txnBySurvivor.get(account.id) || { debit: 0, credit: 0, lineCount: 0 };
      const nb = inferCoaNormalBalance(account);
      const net =
        nb === 'Debit'
          ? ja.debit + tx.debit - (ja.credit + tx.credit)
          : ja.credit + tx.credit - (ja.debit + tx.debit);
      const lineCount = ja.lineCount + tx.lineCount;
      const hasChildren = parentIdsWithChildren.has(account.id);
      let finalBalance = lineCount > 0 ? net : hasChildren ? 0 : net;
      return {
        ...account,
        postedDirectBalance: finalBalance,
        currentBalance: finalBalance,
        postedEntryCount: lineCount,
        balanceSource: lineCount > 0 ? 'posted_gl' : 'none',
      };
    });

    let pipeline = applyCoaParentRollup(injectSyntheticDirectPostingLeaves(withBal));
    pipeline = applyCoaParentRollup(foldCatchAllBucketTotalsIntoPostedDirect(pipeline));
    return pipeline;
  }

  it('loads non-zero GL for expense leaves without date filter', async () => {
    const pipeline = await runPipeline(null, null);
    const purch = pipeline.find((a) => a.accountCode === '5110');
    const exp5000 = pipeline.find((a) => a.accountCode === '5000');
    expect(Number(purch?.currentBalance) || 0).toBeGreaterThan(0);
    expect(Number(exp5000?.currentBalance) || 0).toBeGreaterThan(0);
    await prisma.$disconnect();
  }, 60000);

  it('loads non-zero GL for expense leaves with export date range', async () => {
    const pipeline = await runPipeline('2025-09-01', '2026-06-15');
    const purch = pipeline.find((a) => a.accountCode === '5110');
    const exp5000 = pipeline.find((a) => a.accountCode === '5000');
    expect(Number(purch?.currentBalance) || 0).toBeGreaterThan(0);
    expect(Number(exp5000?.currentBalance) || 0).toBeGreaterThan(0);
    await prisma.$disconnect();
  }, 60000);

  it('includes null-branch expense GL when a branch filter is active', async () => {
    const pipeline = await runPipeline(null, null, { branchId: 'nonexistent-branch-id' });
    const purch = pipeline.find((a) => a.accountCode === '5110');
    expect(Number(purch?.currentBalance) || 0).toBeGreaterThan(0);
    await prisma.$disconnect();
  }, 60000);
});
