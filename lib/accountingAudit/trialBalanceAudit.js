/**
 * Trial Balance audit — independent reconstruction from posted journal lines
 * (both ledgers, excluding JournalEntry rows mirroring a Transaction), grouped
 * per tenant, verifying total debits = total credits and flagging parent/child
 * aggregation hazards. READ-ONLY.
 */

import {
  SEVERITY,
  POSTED_STATUSES,
  makeFinding,
  toCents,
  centsToAmount,
} from './findings.js';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ tenantId?: string|null, from?: Date|null, to?: Date|null }} scope
 */
export async function runTrialBalanceAudit(prisma, scope = {}) {
  const findings = [];

  const tenants = scope.tenantId
    ? [{ id: scope.tenantId }]
    : await prisma.tenant.findMany({ select: { id: true, name: true } });

  const perTenant = [];
  const accountRows = [];

  for (const tenant of tenants) {
    const dateFilter =
      scope.from || scope.to
        ? { ...(scope.from ? { gte: scope.from } : {}), ...(scope.to ? { lte: scope.to } : {}) }
        : undefined;

    const txnAgg = await prisma.transactionLine.groupBy({
      by: ['accountId'],
      where: {
        transaction: {
          tenantId: tenant.id,
          status: { in: POSTED_STATUSES },
          ...(dateFilter ? { date: dateFilter } : {}),
        },
      },
      _sum: { debitAmount: true, creditAmount: true },
    });

    const jeAgg = await prisma.journalEntryLine.groupBy({
      by: ['accountId'],
      where: {
        journalEntry: {
          tenantId: tenant.id,
          status: { in: POSTED_STATUSES },
          transactionId: null,
          ...(dateFilter ? { entryDate: dateFilter } : {}),
        },
      },
      _sum: { debitAmount: true, creditAmount: true },
    });

    const totals = new Map();
    const add = (accountId, dr, cr) => {
      const cur = totals.get(accountId) || { dr: 0, cr: 0 };
      cur.dr += dr;
      cur.cr += cr;
      totals.set(accountId, cur);
    };
    for (const g of txnAgg) add(g.accountId, toCents(g._sum.debitAmount), toCents(g._sum.creditAmount));
    for (const g of jeAgg) add(g.accountId, toCents(g._sum.debitAmount), toCents(g._sum.creditAmount));

    let totalDr = 0;
    let totalCr = 0;
    for (const { dr, cr } of totals.values()) {
      totalDr += dr;
      totalCr += cr;
    }

    const accounts = totals.size
      ? await prisma.account.findMany({
          where: { id: { in: [...totals.keys()] } },
          select: {
            id: true,
            accountCode: true,
            accountName: true,
            accountType: true,
            parentAccountId: true,
            tenantId: true,
          },
        })
      : [];
    const accountById = new Map(accounts.map((a) => [a.id, a]));

    for (const [accountId, t] of totals) {
      const a = accountById.get(accountId);
      accountRows.push({
        tenantId: tenant.id,
        accountId,
        accountCode: a?.accountCode ?? null,
        accountName: a?.accountName ?? null,
        accountType: a?.accountType ?? null,
        debits: centsToAmount(t.dr),
        credits: centsToAmount(t.cr),
      });
    }

    perTenant.push({
      tenantId: tenant.id,
      tenantName: tenant.name ?? null,
      accountsWithActivity: totals.size,
      totalDebits: centsToAmount(totalDr),
      totalCredits: centsToAmount(totalCr),
      difference: centsToAmount(totalDr - totalCr),
      balanced: totalDr === totalCr,
    });

    if (totalDr !== totalCr) {
      findings.push(
        makeFinding({
          ruleCode: 'TB-001',
          severity: SEVERITY.CRITICAL,
          category: 'trial_balance',
          tenantId: tenant.id,
          entityType: 'Tenant',
          entityId: tenant.id,
          description: `Independent trial balance does not balance for tenant ${tenant.id}.`,
          expected: 'total debits = total credits',
          actual: `debits ${centsToAmount(totalDr)} / credits ${centsToAmount(totalCr)}`,
          differenceAmount: centsToAmount(totalDr - totalCr),
        })
      );
    }

    // Parent accounts with direct postings AND posted children => aggregation double-count hazard
    for (const [accountId, t] of totals) {
      const a = accountById.get(accountId);
      if (!a) continue;
      const hasPostedChild = accounts.some(
        (other) => other.parentAccountId === accountId && totals.has(other.id)
      );
      if (hasPostedChild && (t.dr !== 0 || t.cr !== 0)) {
        findings.push(
          makeFinding({
            ruleCode: 'TB-003',
            severity: SEVERITY.HIGH,
            category: 'trial_balance',
            tenantId: tenant.id,
            entityType: 'Account',
            entityId: accountId,
            description:
              `Account ${a.accountCode} ${a.accountName} has direct postings AND posted child accounts — ` +
              'any report summing parent totals plus child totals will double-count.',
          })
        );
      }
    }
  }

  return { findings, perTenant, accountRows };
}
