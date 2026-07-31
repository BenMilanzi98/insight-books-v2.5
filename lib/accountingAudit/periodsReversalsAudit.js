/**
 * Accounting periods + reversals audit. READ-ONLY.
 */

import { SEVERITY, CONFIDENCE, POSTED_STATUSES, makeFinding, toCents, centsToAmount } from './findings.js';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ tenantId?: string|null }} scope
 */
export async function runPeriodsAudit(prisma, scope = {}) {
  const findings = [];

  const periods = await prisma.accountingPeriod.findMany({
    where: { ...(scope.tenantId ? { tenantId: scope.tenantId } : {}) },
    orderBy: [{ tenantId: 'asc' }, { periodType: 'asc' }, { startDate: 'asc' }],
  });

  const byTenantType = new Map();
  for (const p of periods) {
    const key = `${p.tenantId}:${p.periodType}`;
    if (!byTenantType.has(key)) byTenantType.set(key, []);
    byTenantType.get(key).push(p);
  }

  for (const [key, list] of byTenantType) {
    const [tenantId, periodType] = key.split(':');
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1];
      const cur = list[i];
      if (cur.startDate < prev.endDate) {
        findings.push(
          makeFinding({
            ruleCode: 'PER-003',
            severity: SEVERITY.HIGH,
            category: 'accounting_periods',
            tenantId,
            entityType: 'AccountingPeriod',
            entityId: cur.id,
            description: `${periodType} period "${cur.name}" overlaps previous period "${prev.name}".`,
            evidence: {
              previous: { start: prev.startDate, end: prev.endDate },
              current: { start: cur.startDate, end: cur.endDate },
            },
          })
        );
      }
      const gapMs = cur.startDate.getTime() - prev.endDate.getTime();
      if (periodType === 'Monthly' && gapMs > 26 * 60 * 60 * 1000) {
        findings.push(
          makeFinding({
            ruleCode: 'PER-003',
            severity: SEVERITY.MEDIUM,
            category: 'accounting_periods',
            tenantId,
            entityType: 'AccountingPeriod',
            entityId: cur.id,
            description: `Gap between monthly periods "${prev.name}" and "${cur.name}" — transactions dated in the gap escape period control.`,
            confidence: CONFIDENCE.CONFIRMED,
          })
        );
      }
    }
  }

  // Reopened without reason
  for (const p of periods) {
    if (p.reopenedAt && !p.reopenReason) {
      findings.push(
        makeFinding({
          ruleCode: 'PER-004',
          severity: SEVERITY.MEDIUM,
          category: 'accounting_periods',
          tenantId: p.tenantId,
          entityType: 'AccountingPeriod',
          entityId: p.id,
          description: `Period "${p.name}" was reopened without a recorded reason.`,
        })
      );
    }
  }

  // Posted transactions dated inside closed periods
  const closedViolationsAll = await prisma.$queryRaw`
    SELECT t.id, t."tenantId", t.date, t.reference, t."sourceType", t."createdAt", p.name AS period_name, p."closedAt"
    FROM "Transaction" t
    JOIN "AccountingPeriod" p ON p."tenantId" = t."tenantId"
      AND t.date >= p."startDate" AND t.date <= p."endDate"
      AND p.status = 'closed'
    WHERE lower(t.status) = 'posted'
      AND (p."closedAt" IS NULL OR t."createdAt" > p."closedAt")`;
  const closedViolations = scope.tenantId
    ? closedViolationsAll.filter((r) => r.tenantId === scope.tenantId)
    : closedViolationsAll;
  for (const row of closedViolations) {
    findings.push(
      makeFinding({
        ruleCode: 'PER-002',
        severity: SEVERITY.CRITICAL,
        category: 'accounting_periods',
        tenantId: row.tenantId,
        entityType: 'Transaction',
        entityId: row.id,
        description: `Transaction ${row.reference || row.id} was created after period "${row.period_name}" was closed but dated inside it.`,
        evidence: { transactionDate: row.date, createdAt: row.createdAt, periodClosedAt: row.closedAt },
      })
    );
  }

  // Transactions with no period coverage at all
  const uncovered = await prisma.$queryRaw`
    SELECT t.id, t."tenantId", t.date, t.reference
    FROM "Transaction" t
    WHERE lower(t.status) = 'posted'
      AND NOT EXISTS (
        SELECT 1 FROM "AccountingPeriod" p
        WHERE p."tenantId" = t."tenantId" AND t.date >= p."startDate" AND t.date <= p."endDate"
      )`;
  for (const row of uncovered) {
    if (scope.tenantId && row.tenantId !== scope.tenantId) continue;
    findings.push(
      makeFinding({
        ruleCode: 'PER-001',
        severity: SEVERITY.HIGH,
        category: 'accounting_periods',
        tenantId: row.tenantId,
        entityType: 'Transaction',
        entityId: row.id,
        description: `Posted transaction ${row.reference || row.id} dated ${row.date?.toISOString?.().slice(0, 10) ?? row.date} is not covered by any accounting period.`,
        recommendation: 'Phase 2: auto-generate periods for the full financial year from transaction dates.',
      })
    );
  }

  return { findings, periods };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ tenantId?: string|null }} scope
 */
export async function runReversalsAudit(prisma, scope = {}) {
  const findings = [];
  const tenantWhere = scope.tenantId ? { tenantId: scope.tenantId } : {};

  const reversals = await prisma.transaction.findMany({
    where: { ...tenantWhere, isReversal: true },
    include: { lines: true },
  });

  for (const rev of reversals) {
    if (!rev.reversedTransactionId) {
      findings.push(
        makeFinding({
          ruleCode: 'REV-001',
          severity: SEVERITY.HIGH,
          category: 'reversals',
          tenantId: rev.tenantId,
          entityType: 'Transaction',
          entityId: rev.id,
          description: `Reversal ${rev.reference || rev.id} has no link to an original transaction.`,
        })
      );
      continue;
    }

    const original = await prisma.transaction.findUnique({
      where: { id: rev.reversedTransactionId },
      include: { lines: true },
    });

    if (!original) {
      findings.push(
        makeFinding({
          ruleCode: 'REV-001',
          severity: SEVERITY.HIGH,
          category: 'reversals',
          tenantId: rev.tenantId,
          entityType: 'Transaction',
          entityId: rev.id,
          description: `Reversal ${rev.reference || rev.id} points to a missing original transaction ${rev.reversedTransactionId}.`,
        })
      );
      continue;
    }

    if (original.tenantId !== rev.tenantId) {
      findings.push(
        makeFinding({
          ruleCode: 'TEN-001',
          severity: SEVERITY.CRITICAL,
          category: 'tenant_isolation',
          tenantId: rev.tenantId,
          entityType: 'Transaction',
          entityId: rev.id,
          description: 'Reversal references an original transaction in a different tenant.',
        })
      );
    }

    // Amount match: reversal total should equal original total
    const revDr = rev.lines.reduce((s, l) => s + toCents(l.debitAmount), 0);
    const origDr = original.lines.reduce((s, l) => s + toCents(l.debitAmount), 0);
    if (revDr !== origDr) {
      findings.push(
        makeFinding({
          ruleCode: 'REV-003',
          severity: SEVERITY.HIGH,
          category: 'reversals',
          tenantId: rev.tenantId,
          entityType: 'Transaction',
          entityId: rev.id,
          description: `Reversal ${rev.reference || rev.id} total (${centsToAmount(revDr)}) differs from original (${centsToAmount(origDr)}).`,
          differenceAmount: centsToAmount(revDr - origDr),
          confidence: CONFIDENCE.REVIEW,
          recommendation: 'May be an intentional partial reversal — confirm with finance team.',
        })
      );
    }

    // Line mirroring: each original debit should appear as credit in reversal (by account)
    const origByAccount = new Map();
    for (const l of original.lines) {
      const cur = origByAccount.get(l.accountId) || { dr: 0, cr: 0 };
      cur.dr += toCents(l.debitAmount);
      cur.cr += toCents(l.creditAmount);
      origByAccount.set(l.accountId, cur);
    }
    for (const l of rev.lines) {
      const orig = origByAccount.get(l.accountId);
      if (!orig) {
        findings.push(
          makeFinding({
            ruleCode: 'REV-003',
            severity: SEVERITY.MEDIUM,
            category: 'reversals',
            tenantId: rev.tenantId,
            entityType: 'TransactionLine',
            entityId: l.id,
            description: `Reversal ${rev.reference || rev.id} posts to account not present in the original transaction.`,
            confidence: CONFIDENCE.REVIEW,
          })
        );
      }
    }
  }

  // Originals reversed more than once (active reversals)
  const multiReversed = await prisma.transaction.groupBy({
    by: ['reversedTransactionId'],
    where: {
      ...tenantWhere,
      isReversal: true,
      status: { in: POSTED_STATUSES },
      reversedTransactionId: { not: null },
    },
    _count: { id: true },
    having: { id: { _count: { gt: 1 } } },
  });
  for (const g of multiReversed) {
    findings.push(
      makeFinding({
        ruleCode: 'REV-002',
        severity: SEVERITY.CRITICAL,
        category: 'reversals',
        tenantId: scope.tenantId ?? null,
        entityType: 'Transaction',
        entityId: g.reversedTransactionId,
        description: `Original transaction ${g.reversedTransactionId} has ${g._count.id} active posted reversals — economic impact reversed more than once.`,
      })
    );
  }

  return { findings, reversalCount: reversals.length };
}
