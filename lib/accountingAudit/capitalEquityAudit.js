/**
 * Capital & equity forensic audit — reconciles every equity account between:
 *   (a) journal-derived balance from posted lines (both ledgers)
 *   (b) stored Account.balance
 *   (c) legacy header-amount JournalEntry rows (no lines)
 * and traces capital double-counting (the "MK1,000,000 shows as MK2,000,000" class).
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

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ tenantId?: string|null }} scope
 */
export async function runCapitalEquityAudit(prisma, scope = {}) {
  const findings = [];
  const traces = [];

  const equityAccounts = await prisma.account.findMany({
    where: {
      accountType: 'Equity',
      ...(scope.tenantId ? { tenantId: scope.tenantId } : {}),
    },
    select: {
      id: true,
      tenantId: true,
      accountCode: true,
      accountName: true,
      parentAccountId: true,
      balance: true,
      isActive: true,
    },
  });

  for (const account of equityAccounts) {
    // (a) posted Transaction lines
    const txnLines = await prisma.transactionLine.findMany({
      where: {
        accountId: account.id,
        transaction: { status: { in: POSTED_STATUSES } },
      },
      select: {
        debitAmount: true,
        creditAmount: true,
        transaction: {
          select: { id: true, reference: true, sourceType: true, sourceId: true, date: true, isReversal: true },
        },
      },
    });

    // (b) posted line-based JournalEntry lines (excluding Transaction mirrors)
    const jeLines = await prisma.journalEntryLine.findMany({
      where: {
        accountId: account.id,
        journalEntry: { status: { in: POSTED_STATUSES }, transactionId: null },
      },
      select: {
        debitAmount: true,
        creditAmount: true,
        journalEntry: { select: { id: true, referenceNumber: true, sourceType: true, sourceId: true } },
      },
    });

    // (c) legacy header-amount JournalEntry rows pointing at this account
    const legacyHeaders = await prisma.journalEntry.findMany({
      where: {
        accountId: account.id,
        status: { in: POSTED_STATUSES },
        transactionId: null,
        lines: { none: {} },
      },
      select: { id: true, referenceNumber: true, sourceType: true, sourceId: true, debit: true, credit: true },
    });

    const txnCr = txnLines.reduce((s, l) => s + toCents(l.creditAmount), 0);
    const txnDr = txnLines.reduce((s, l) => s + toCents(l.debitAmount), 0);
    const jeCr = jeLines.reduce((s, l) => s + toCents(l.creditAmount), 0);
    const jeDr = jeLines.reduce((s, l) => s + toCents(l.debitAmount), 0);
    const legacyCr = legacyHeaders.reduce((s, j) => s + toCents(j.credit), 0);
    const legacyDr = legacyHeaders.reduce((s, j) => s + toCents(j.debit), 0);

    const derived = txnCr - txnDr + (jeCr - jeDr); // equity: credit-normal
    const derivedWithLegacy = derived + (legacyCr - legacyDr);
    const stored = toCents(account.balance);

    traces.push({
      tenantId: account.tenantId,
      accountId: account.id,
      accountCode: account.accountCode,
      accountName: account.accountName,
      storedBalance: centsToAmount(stored),
      derivedFromLines: centsToAmount(derived),
      derivedWithLegacyHeaders: centsToAmount(derivedWithLegacy),
      transactionLineCount: txnLines.length,
      journalLineCount: jeLines.length,
      legacyHeaderCount: legacyHeaders.length,
      sources: [
        ...txnLines.map((l) => ({
          ledger: 'Transaction',
          ref: l.transaction.reference,
          sourceType: l.transaction.sourceType,
          sourceId: l.transaction.sourceId,
          debit: String(l.debitAmount),
          credit: String(l.creditAmount),
          isReversal: l.transaction.isReversal,
        })),
        ...jeLines.map((l) => ({
          ledger: 'JournalEntry(lines)',
          ref: l.journalEntry.referenceNumber,
          sourceType: l.journalEntry.sourceType,
          sourceId: l.journalEntry.sourceId,
          debit: String(l.debitAmount),
          credit: String(l.creditAmount),
        })),
        ...legacyHeaders.map((j) => ({
          ledger: 'JournalEntry(header-legacy)',
          ref: j.referenceNumber,
          sourceType: j.sourceType,
          sourceId: j.sourceId,
          debit: String(j.debit ?? 0),
          credit: String(j.credit ?? 0),
        })),
      ],
    });

    if (stored !== derived) {
      const legacyExplains = stored === derivedWithLegacy;
      findings.push(
        makeFinding({
          ruleCode: legacyExplains ? 'CAP-005' : 'GL-002',
          severity: legacyExplains ? SEVERITY.HIGH : SEVERITY.CRITICAL,
          category: 'capital_equity',
          tenantId: account.tenantId,
          entityType: 'Account',
          entityId: account.id,
          description:
            `Equity account ${account.accountCode} ${account.accountName}: stored balance ` +
            `${centsToAmount(stored)} vs line-derived ${centsToAmount(derived)}.` +
            (legacyExplains
              ? ` The gap is exactly the legacy header-amount journals (${legacyHeaders
                  .map((j) => j.referenceNumber)
                  .join(', ')}). Line-based reports will show ${centsToAmount(derived)} while ` +
                `the stored/CoA balance shows ${centsToAmount(stored)} — this is the class of defect where ` +
                'displayed capital disagrees with posted capital.'
              : ''),
          differenceAmount: centsToAmount(stored - derived),
          confidence: legacyExplains ? CONFIDENCE.CONFIRMED : CONFIDENCE.HIGHLY_LIKELY,
          evidence: {
            legacyHeaderRefs: legacyHeaders.map((j) => j.referenceNumber),
          },
        })
      );
    }

    // Duplicate capital postings: same sourceType+sourceId hitting this equity account twice
    const bySource = new Map();
    for (const l of txnLines) {
      if (!l.transaction.sourceType || !l.transaction.sourceId || l.transaction.isReversal) continue;
      const key = `${l.transaction.sourceType}:${l.transaction.sourceId}`;
      bySource.set(key, (bySource.get(key) || []).concat(l.transaction.reference));
    }
    for (const [key, refs] of bySource) {
      if (refs.length > 1) {
        findings.push(
          makeFinding({
            ruleCode: 'CAP-001',
            severity: SEVERITY.CRITICAL,
            category: 'capital_equity',
            tenantId: account.tenantId,
            entityType: 'Account',
            entityId: account.id,
            description: `Capital source ${key} posted ${refs.length} times to ${account.accountCode} (${refs.join(', ')}).`,
          })
        );
      }
    }
  }

  // Parent+child equity double-count hazard for report rollups
  const byTenant = new Map();
  for (const a of equityAccounts) {
    if (!byTenant.has(a.tenantId)) byTenant.set(a.tenantId, []);
    byTenant.get(a.tenantId).push(a);
  }
  for (const [tenantId, list] of byTenant) {
    const withBalance = list.filter((a) => toCents(a.balance) !== 0);
    for (const a of withBalance) {
      const parent = list.find((p) => p.id === a.parentAccountId);
      if (parent && toCents(parent.balance) !== 0) {
        findings.push(
          makeFinding({
            ruleCode: 'CAP-002',
            severity: SEVERITY.HIGH,
            category: 'capital_equity',
            tenantId,
            entityType: 'Account',
            entityId: a.id,
            description:
              `Equity child ${a.accountCode} (${centsToAmount(toCents(a.balance))}) and its parent ` +
              `${parent.accountCode} (${centsToAmount(toCents(parent.balance))}) both carry non-zero stored balances — ` +
              'any report summing both levels doubles capital.',
          })
        );
      }
    }
  }

  // Operational vs GL: EquityAccount table (if used) vs journal-derived
  const equityRows = await prisma.equityAccount.findMany({
    where: { ...(scope.tenantId ? { tenantId: scope.tenantId } : {}) },
  });
  for (const row of equityRows) {
    findings.push(
      makeFinding({
        ruleCode: 'CAP-005',
        severity: SEVERITY.MEDIUM,
        category: 'capital_equity',
        tenantId: row.tenantId,
        entityType: 'EquityAccount',
        entityId: row.id,
        confidence: CONFIDENCE.REVIEW,
        description:
          `EquityAccount operational row "${row.accountName}" stores its own currentBalance (${row.currentBalance}) ` +
          'independently of the GL — any report combining it with GL-derived equity double-counts.',
      })
    );
  }

  return { findings, traces };
}
