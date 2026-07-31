/**
 * Ledger reconciliation audit — independently reconstructs every account balance
 * from posted journal lines (both ledgers) and compares against the stored
 * Account.balance snapshot that the posting engine maintains incrementally.
 * READ-ONLY.
 */

import {
  SEVERITY,
  CONFIDENCE,
  POSTED_STATUSES,
  makeFinding,
  toCents,
  centsToAmount,
  derivedBalanceCents,
} from './findings.js';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ tenantId?: string|null }} scope
 */
export async function runLedgerReconciliationAudit(prisma, scope = {}) {
  const findings = [];
  const rows = [];

  const accounts = await prisma.account.findMany({
    where: { ...(scope.tenantId ? { tenantId: scope.tenantId } : {}) },
    select: {
      id: true,
      tenantId: true,
      accountCode: true,
      accountName: true,
      accountType: true,
      normalBalance: true,
      balance: true,
      isActive: true,
      acceptsNewTransactions: true,
      parentAccountId: true,
    },
  });
  const accountById = new Map(accounts.map((a) => [a.id, a]));

  // Aggregate posted TransactionLine amounts per account (DB-side).
  const txnAgg = await prisma.transactionLine.groupBy({
    by: ['accountId'],
    where: {
      transaction: {
        status: { in: POSTED_STATUSES },
        ...(scope.tenantId ? { tenantId: scope.tenantId } : {}),
      },
    },
    _sum: { debitAmount: true, creditAmount: true },
  });

  // Aggregate posted JournalEntryLine amounts per account.
  // NOTE: reporting code excludes journal entries with transactionId set (mirrors);
  // we mirror that rule here so the reconstruction matches reporting intent.
  const jeAgg = await prisma.journalEntryLine.groupBy({
    by: ['accountId'],
    where: {
      journalEntry: {
        status: { in: POSTED_STATUSES },
        transactionId: null,
        ...(scope.tenantId ? { tenantId: scope.tenantId } : {}),
      },
    },
    _sum: { debitAmount: true, creditAmount: true },
  });

  // Legacy header-amount journal entries (no lines, debit/credit on header) are
  // NOT included in either aggregation above — measure their footprint explicitly.
  const legacyHeaderEntries = await prisma.journalEntry.findMany({
    where: {
      status: { in: POSTED_STATUSES },
      transactionId: null,
      accountId: { not: null },
      lines: { none: {} },
      ...(scope.tenantId ? { tenantId: scope.tenantId } : {}),
    },
    select: { id: true, tenantId: true, accountId: true, debit: true, credit: true, referenceNumber: true },
  });

  const totals = new Map(); // accountId -> { dr, cr }
  const add = (accountId, dr, cr) => {
    const cur = totals.get(accountId) || { dr: 0, cr: 0 };
    cur.dr += dr;
    cur.cr += cr;
    totals.set(accountId, cur);
  };
  for (const g of txnAgg) add(g.accountId, toCents(g._sum.debitAmount), toCents(g._sum.creditAmount));
  for (const g of jeAgg) add(g.accountId, toCents(g._sum.debitAmount), toCents(g._sum.creditAmount));

  const legacyTotals = new Map();
  for (const je of legacyHeaderEntries) {
    const cur = legacyTotals.get(je.accountId) || { dr: 0, cr: 0, refs: [] };
    cur.dr += toCents(je.debit);
    cur.cr += toCents(je.credit);
    cur.refs.push(je.referenceNumber || je.id);
    legacyTotals.set(je.accountId, cur);
  }

  for (const account of accounts) {
    const t = totals.get(account.id) || { dr: 0, cr: 0 };
    const legacy = legacyTotals.get(account.id) || null;
    const derived = derivedBalanceCents(account, t.dr, t.cr);
    const stored = toCents(account.balance);
    const diff = stored - derived;

    rows.push({
      tenantId: account.tenantId,
      accountId: account.id,
      accountCode: account.accountCode,
      accountName: account.accountName,
      accountType: account.accountType,
      storedBalance: centsToAmount(stored),
      derivedBalance: centsToAmount(derived),
      difference: centsToAmount(diff),
      lineDebits: centsToAmount(t.dr),
      lineCredits: centsToAmount(t.cr),
      legacyHeaderDebits: legacy ? centsToAmount(legacy.dr) : 0,
      legacyHeaderCredits: legacy ? centsToAmount(legacy.cr) : 0,
    });

    if (diff !== 0) {
      const legacyExplains =
        legacy && derivedBalanceCents(account, t.dr + legacy.dr, t.cr + legacy.cr) === stored;
      findings.push(
        makeFinding({
          ruleCode: 'GL-002',
          severity: legacyExplains ? SEVERITY.HIGH : SEVERITY.CRITICAL,
          category: 'ledger_reconciliation',
          tenantId: account.tenantId,
          entityType: 'Account',
          entityId: account.id,
          description:
            `Stored balance of ${account.accountCode} ${account.accountName} ` +
            `(${centsToAmount(stored)}) differs from journal-derived balance (${centsToAmount(derived)}).` +
            (legacyExplains
              ? ' Difference is fully explained by legacy header-amount JournalEntry rows that line-based reporting excludes.'
              : ''),
          expected: String(centsToAmount(derived)),
          actual: String(centsToAmount(stored)),
          differenceAmount: centsToAmount(diff),
          confidence: legacyExplains ? CONFIDENCE.CONFIRMED : CONFIDENCE.HIGHLY_LIKELY,
          evidence: legacy ? { legacyHeaderJournals: legacy.refs } : null,
          recommendation: legacyExplains
            ? 'Phase 2: migrate legacy header journals to lines OR rebuild stored balances from lines.'
            : 'Phase 2: rebuild stored balance from posted lines after root-cause confirmation.',
        })
      );
    }
  }

  // Cross-tenant line references
  const crossTenantTxnLines = await prisma.$queryRaw`
    SELECT tl.id, t."tenantId" AS txn_tenant, a."tenantId" AS acct_tenant, a."accountCode"
    FROM "TransactionLine" tl
    JOIN "Transaction" t ON t.id = tl."transactionId"
    JOIN "Account" a ON a.id = tl."accountId"
    WHERE a."tenantId" IS DISTINCT FROM t."tenantId"`;
  for (const row of crossTenantTxnLines) {
    findings.push(
      makeFinding({
        ruleCode: 'TEN-001',
        severity: SEVERITY.CRITICAL,
        category: 'tenant_isolation',
        tenantId: row.txn_tenant,
        entityType: 'TransactionLine',
        entityId: row.id,
        description: `Transaction line posts to account ${row.accountCode} owned by another tenant.`,
        evidence: { transactionTenant: row.txn_tenant, accountTenant: row.acct_tenant },
      })
    );
  }

  return { findings, rows, accountCount: accounts.length, legacyHeaderEntryCount: legacyHeaderEntries.length, accountById };
}
