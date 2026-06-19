/**
 * Report integrity diagnostics — detect ledger/COA/journal mismatches.
 */
import prisma from '@/lib/prisma.js';
import { roundMoney, parseMoney } from '@/lib/money.js';
import { getPostedGlSurvivorTotalsForPeriod } from '@/lib/trialBalanceReport.js';
import { applyCoaParentRollup, apply3100CapitalBucketAncestorPropagation } from '@/lib/coaChartRollup.js';

/**
 * @param {object} params
 * @param {string} params.tenantId
 * @param {import('@prisma/client').PrismaClient} [params.prisma]
 */
export async function runReportIntegrityCheck({ tenantId, prisma: db = prisma }) {
  const issues = [];
  const warnings = [];

  const accounts = await db.account.findMany({
    where: { tenantId, isActive: true, mergedIntoAccountId: null },
    select: {
      id: true,
      accountCode: true,
      accountName: true,
      accountType: true,
      balance: true,
      parentAccountId: true,
      acceptsNewTransactions: true,
    },
  });

  const liabilities = await db.liability.findMany({
    where: { tenantId, status: { not: 'closed' } },
    select: {
      id: true,
      name: true,
      currentBalance: true,
      glAccountId: true,
      glAccount: { select: { accountCode: true, accountName: true } },
    },
  });

  const epoch = '1970-01-01';
  const today = new Date().toISOString().split('T')[0];

  const glTotals = await getPostedGlSurvivorTotalsForPeriod({
    tenantId,
    branchId: null,
    startDate: epoch,
    endDate: today,
    prisma: db,
  });

  for (const account of accounts) {
    const gl = glTotals.get(account.id);
    const glNet = gl
      ? roundMoney(
          (parseMoney(gl.debitAmount) - parseMoney(gl.creditAmount)) *
            (String(account.accountType).toLowerCase().includes('asset') ||
            String(account.accountType).toLowerCase().includes('expense')
              ? 1
              : -1)
        )
      : 0;
    const cached = parseMoney(account.balance);

    if (Math.abs(cached) > 0.01 && (!gl || (Math.abs(gl.debitAmount) < 0.01 && Math.abs(gl.creditAmount) < 0.01))) {
      issues.push({
        code: 'COA_BALANCE_WITHOUT_GL',
        severity: 'error',
        accountId: account.id,
        accountCode: account.accountCode,
        accountName: account.accountName,
        cachedBalance: cached,
        message: `Account ${account.accountCode} ${account.accountName} has cached balance ${cached} but no posted GL lines.`,
      });
    }
  }

  for (const liab of liabilities) {
    if (!liab.glAccountId) continue;
    const bal = parseMoney(liab.currentBalance);
    if (bal <= 0) continue;
    const gl = glTotals.get(liab.glAccountId);
    const hasGl =
      gl && (Math.abs(parseMoney(gl.debitAmount)) > 0.01 || Math.abs(parseMoney(gl.creditAmount)) > 0.01);
    if (!hasGl) {
      issues.push({
        code: 'LIABILITY_WITHOUT_JOURNAL',
        severity: 'error',
        liabilityId: liab.id,
        liabilityName: liab.name,
        accountCode: liab.glAccount?.accountCode,
        accountName: liab.glAccount?.accountName,
        registerBalance: bal,
        message: `Liability "${liab.name}" shows ${bal} on register but has no posted GL entries on ${liab.glAccount?.accountCode}.`,
      });
    }
  }

  const cap3100 = accounts.find((a) => String(a.accountCode) === '3100');
  const capChildren = accounts.filter(
    (a) => a.parentAccountId === cap3100?.id && /^31\d{2}$/.test(String(a.accountCode || ''))
  );
  if (cap3100 && capChildren.length > 0) {
    const childSum = roundMoney(capChildren.reduce((s, c) => addMoneySafe(s, c.balance), 0));
    const parentBal = parseMoney(cap3100.balance);
    const rollupRows = apply3100CapitalBucketAncestorPropagation(
      applyCoaParentRollup(
        accounts.map((a) => ({
          ...a,
          postedDirectBalance: parseMoney(a.balance),
          currentBalance: parseMoney(a.balance),
        }))
      )
    );
    const capRow = rollupRows.find((a) => a.id === cap3100.id);
    const displayBal = parseMoney(capRow?.currentBalance);
    if (Math.abs(displayBal - childSum) > 0.02 && Math.abs(displayBal - childSum * 2) <= 0.02) {
      issues.push({
        code: 'CAPITAL_DOUBLE_COUNT',
        severity: 'error',
        accountCode: '3100',
        childSum,
        displayBalance: displayBal,
        message: `Owner capital (3100) appears doubled: children sum ${childSum} but 3100 shows ${displayBal}.`,
      });
    }
  }

  const unbalancedJournals = await db.journalEntry.findMany({
    where: { tenantId, status: 'Posted', transactionId: null },
    include: { lines: true },
    take: 500,
  });

  for (const entry of unbalancedJournals) {
    const dr = entry.lines.reduce((s, l) => s + parseMoney(l.debitAmount), 0);
    const cr = entry.lines.reduce((s, l) => s + parseMoney(l.creditAmount), 0);
    if (Math.abs(dr - cr) > 0.02) {
      issues.push({
        code: 'UNBALANCED_JOURNAL',
        severity: 'error',
        journalEntryId: entry.id,
        referenceNumber: entry.referenceNumber,
        debitTotal: dr,
        creditTotal: cr,
        message: `Journal ${entry.referenceNumber} is unbalanced (Dr ${dr} vs Cr ${cr}).`,
      });
    }
  }

  const tb = await getPostedGlSurvivorTotalsForPeriod({
    tenantId,
    branchId: null,
    startDate: epoch,
    endDate: today,
    prisma: db,
  });
  let totalDr = 0;
  let totalCr = 0;
  for (const [, t] of tb) {
    totalDr += parseMoney(t.debitAmount);
    totalCr += parseMoney(t.creditAmount);
  }
  if (Math.abs(totalDr - totalCr) > 0.05) {
    warnings.push({
      code: 'GL_DEBITS_CREDITS_MISMATCH',
      severity: 'warning',
      totalDebits: roundMoney(totalDr),
      totalCredits: roundMoney(totalCr),
      message: `Lifetime GL debits (${roundMoney(totalDr)}) do not equal credits (${roundMoney(totalCr)}). Trial balance may not balance.`,
    });
  }

  return {
    tenantId,
    checkedAt: new Date().toISOString(),
    status: issues.length === 0 ? (warnings.length ? 'warning' : 'ok') : 'error',
    issueCount: issues.length,
    warningCount: warnings.length,
    issues,
    warnings,
  };
}

function addMoneySafe(a, b) {
  return roundMoney(parseMoney(a) + parseMoney(b));
}

export const ReportIntegrityService = { runReportIntegrityCheck };
export default ReportIntegrityService;
