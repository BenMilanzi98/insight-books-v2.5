/**
 * Journal integrity audit — validates both ledgers:
 *  - Transaction/TransactionLine (primary GL written by lib/accountingEngine/postGlEntry.js)
 *  - JournalEntry/JournalEntryLine (secondary/manual-journal ledger)
 * READ-ONLY.
 */

import {
  SEVERITY,
  CONFIDENCE,
  POSTED_STATUSES,
  makeFinding,
  toCents,
  centsToAmount,
} from './findings.js';

const BATCH = 500;

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ tenantId?: string|null, from?: Date|null, to?: Date|null }} scope
 */
export async function runJournalIntegrityAudit(prisma, scope = {}) {
  const findings = [];
  const stats = {
    transactionsScanned: 0,
    journalEntriesScanned: 0,
    unbalancedTransactions: 0,
    unbalancedJournalEntries: 0,
  };

  const txnWhere = {
    ...(scope.tenantId ? { tenantId: scope.tenantId } : {}),
    ...(scope.from || scope.to
      ? { date: { ...(scope.from ? { gte: scope.from } : {}), ...(scope.to ? { lte: scope.to } : {}) } }
      : {}),
  };

  // ---- Pass 1: Transaction ledger, batched ----
  let cursor = null;
  for (;;) {
    const batch = await prisma.transaction.findMany({
      where: txnWhere,
      include: { lines: true },
      orderBy: { id: 'asc' },
      take: BATCH,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (!batch.length) break;
    cursor = batch[batch.length - 1].id;
    stats.transactionsScanned += batch.length;

    for (const txn of batch) {
      const drCents = txn.lines.reduce((s, l) => s + toCents(l.debitAmount), 0);
      const crCents = txn.lines.reduce((s, l) => s + toCents(l.creditAmount), 0);

      if (txn.lines.length === 0) {
        findings.push(
          makeFinding({
            ruleCode: 'JRN-002',
            severity: SEVERITY.CRITICAL,
            category: 'journal_integrity',
            tenantId: txn.tenantId,
            entityType: 'Transaction',
            entityId: txn.id,
            description: `Transaction ${txn.reference || txn.id} has no lines.`,
            evidence: { reference: txn.reference, sourceType: txn.sourceType, status: txn.status },
          })
        );
      } else if (txn.lines.length === 1) {
        findings.push(
          makeFinding({
            ruleCode: 'JRN-002',
            severity: SEVERITY.CRITICAL,
            category: 'journal_integrity',
            tenantId: txn.tenantId,
            entityType: 'Transaction',
            entityId: txn.id,
            description: `Transaction ${txn.reference || txn.id} has a single line (double entry impossible).`,
            evidence: { reference: txn.reference, sourceType: txn.sourceType, status: txn.status },
          })
        );
      }

      if (drCents !== crCents) {
        stats.unbalancedTransactions += 1;
        findings.push(
          makeFinding({
            ruleCode: 'JRN-001',
            severity: SEVERITY.CRITICAL,
            category: 'journal_integrity',
            tenantId: txn.tenantId,
            entityType: 'Transaction',
            entityId: txn.id,
            description: `Transaction ${txn.reference || txn.id} debits ≠ credits.`,
            expected: 'total debits = total credits',
            actual: `debit ${centsToAmount(drCents)} / credit ${centsToAmount(crCents)}`,
            differenceAmount: centsToAmount(drCents - crCents),
            evidence: {
              reference: txn.reference,
              sourceType: txn.sourceType,
              sourceId: txn.sourceId,
              date: txn.date,
              status: txn.status,
            },
          })
        );
      }

      for (const line of txn.lines) {
        const d = toCents(line.debitAmount);
        const c = toCents(line.creditAmount);
        if (d > 0 && c > 0) {
          findings.push(
            makeFinding({
              ruleCode: 'JRN-003',
              severity: SEVERITY.HIGH,
              category: 'journal_integrity',
              tenantId: txn.tenantId,
              entityType: 'TransactionLine',
              entityId: line.id,
              description: 'Line has both debit and credit amounts.',
              evidence: { transactionId: txn.id, debit: String(line.debitAmount), credit: String(line.creditAmount) },
            })
          );
        }
        if (d === 0 && c === 0) {
          findings.push(
            makeFinding({
              ruleCode: 'JRN-004',
              severity: SEVERITY.MEDIUM,
              category: 'journal_integrity',
              tenantId: txn.tenantId,
              entityType: 'TransactionLine',
              entityId: line.id,
              description: 'Line has neither debit nor credit amount.',
              evidence: { transactionId: txn.id },
            })
          );
        }
        if (d < 0 || c < 0) {
          findings.push(
            makeFinding({
              ruleCode: 'JRN-004',
              severity: SEVERITY.HIGH,
              category: 'journal_integrity',
              tenantId: txn.tenantId,
              entityType: 'TransactionLine',
              entityId: line.id,
              description: 'Line has a negative debit or credit amount.',
              evidence: { transactionId: txn.id, debit: String(line.debitAmount), credit: String(line.creditAmount) },
            })
          );
        }
      }

      const isPosted = POSTED_STATUSES.includes(txn.status);
      if (isPosted && !txn.postedDate) {
        findings.push(
          makeFinding({
            ruleCode: 'JRN-007',
            severity: SEVERITY.MEDIUM,
            category: 'journal_integrity',
            tenantId: txn.tenantId,
            entityType: 'Transaction',
            entityId: txn.id,
            description: `Posted transaction ${txn.reference || txn.id} has no posting date.`,
          })
        );
      }
      if (isPosted && !txn.sourceType) {
        findings.push(
          makeFinding({
            ruleCode: 'JRN-005',
            severity: SEVERITY.MEDIUM,
            category: 'journal_integrity',
            tenantId: txn.tenantId,
            entityType: 'Transaction',
            entityId: txn.id,
            confidence: CONFIDENCE.REVIEW,
            description: `Posted transaction ${txn.reference || txn.id} has no source module reference.`,
          })
        );
      }
    }
  }

  // ---- Pass 2: JournalEntry secondary ledger ----
  const jeWhere = {
    ...(scope.tenantId ? { tenantId: scope.tenantId } : {}),
  };
  let jeCursor = null;
  for (;;) {
    const batch = await prisma.journalEntry.findMany({
      where: jeWhere,
      include: { lines: true },
      orderBy: { id: 'asc' },
      take: BATCH,
      ...(jeCursor ? { cursor: { id: jeCursor }, skip: 1 } : {}),
    });
    if (!batch.length) break;
    jeCursor = batch[batch.length - 1].id;
    stats.journalEntriesScanned += batch.length;

    for (const je of batch) {
      const isPosted = POSTED_STATUSES.includes(je.status);
      const drCents = je.lines.reduce((s, l) => s + toCents(l.debitAmount), 0);
      const crCents = je.lines.reduce((s, l) => s + toCents(l.creditAmount), 0);
      const legacyHeaderAmounts = toCents(je.debit) !== 0 || toCents(je.credit) !== 0;

      // Header-level debit/credit with zero lines = legacy single-sided journal rows.
      if (isPosted && je.lines.length === 0 && legacyHeaderAmounts) {
        findings.push(
          makeFinding({
            ruleCode: 'JRN-009',
            severity: SEVERITY.HIGH,
            category: 'journal_integrity',
            tenantId: je.tenantId,
            entityType: 'JournalEntry',
            entityId: je.id,
            description:
              `Posted JournalEntry ${je.referenceNumber || je.id} stores amounts on the header ` +
              `(debit=${je.debit}, credit=${je.credit}) with no lines — legacy single-sided journal shape. ` +
              'One header row alone cannot balance; it is only balanced if a paired row exists.',
            confidence: CONFIDENCE.CONFIRMED,
            evidence: {
              referenceNumber: je.referenceNumber,
              sourceType: je.sourceType,
              sourceId: je.sourceId,
              headerDebit: je.debit,
              headerCredit: je.credit,
            },
            recommendation: 'Phase 2: migrate legacy header-amount journals into balanced line-based entries.',
          })
        );
      } else if (isPosted && je.lines.length > 0 && drCents !== crCents) {
        stats.unbalancedJournalEntries += 1;
        findings.push(
          makeFinding({
            ruleCode: 'JRN-001',
            severity: SEVERITY.CRITICAL,
            category: 'journal_integrity',
            tenantId: je.tenantId,
            entityType: 'JournalEntry',
            entityId: je.id,
            description: `JournalEntry ${je.referenceNumber || je.id} debits ≠ credits.`,
            differenceAmount: centsToAmount(drCents - crCents),
            evidence: { referenceNumber: je.referenceNumber, sourceType: je.sourceType },
          })
        );
      }

      if (isPosted && !je.tenantId) {
        findings.push(
          makeFinding({
            ruleCode: 'TEN-002',
            severity: SEVERITY.CRITICAL,
            category: 'tenant_isolation',
            tenantId: null,
            entityType: 'JournalEntry',
            entityId: je.id,
            description: `Posted JournalEntry ${je.referenceNumber || je.id} has NULL tenantId (schema allows it).`,
          })
        );
      }
    }
  }

  // ---- Duplicate posted sources (Transaction ledger) ----
  const dupGroups = await prisma.transaction.groupBy({
    by: ['tenantId', 'sourceType', 'sourceId'],
    where: {
      ...txnWhere,
      status: { in: POSTED_STATUSES },
      isReversal: false,
      sourceType: { not: null },
      sourceId: { not: null },
    },
    _count: { id: true },
    having: { id: { _count: { gt: 1 } } },
  });
  for (const g of dupGroups) {
    findings.push(
      makeFinding({
        ruleCode: 'JRN-006',
        severity: SEVERITY.CRITICAL,
        category: 'duplicate_posting',
        tenantId: g.tenantId,
        entityType: 'Transaction.source',
        entityId: `${g.sourceType}:${g.sourceId}`,
        description: `Source ${g.sourceType} ${g.sourceId} has ${g._count.id} active posted transactions.`,
        confidence: CONFIDENCE.HIGHLY_LIKELY,
        recommendation: 'Phase 2: review and reverse the duplicate with evidence.',
      })
    );
  }

  // ---- Duplicate posted sources (JournalEntry ledger) ----
  const jeDupGroups = await prisma.journalEntry.groupBy({
    by: ['tenantId', 'sourceType', 'sourceId'],
    where: {
      ...(scope.tenantId ? { tenantId: scope.tenantId } : {}),
      status: { in: POSTED_STATUSES },
      sourceType: { not: null },
      sourceId: { not: null },
    },
    _count: { id: true },
    having: { id: { _count: { gt: 1 } } },
  });
  for (const g of jeDupGroups) {
    findings.push(
      makeFinding({
        ruleCode: 'JRN-006',
        severity: SEVERITY.HIGH,
        category: 'duplicate_posting',
        tenantId: g.tenantId,
        entityType: 'JournalEntry.source',
        entityId: `${g.sourceType}:${g.sourceId}`,
        description: `JournalEntry source ${g.sourceType} ${g.sourceId} appears on ${g._count.id} posted entries.`,
        confidence: CONFIDENCE.POSSIBLE,
        recommendation: 'Review whether entries are paired legacy header rows or true duplicates.',
      })
    );
  }

  return { findings, stats };
}
