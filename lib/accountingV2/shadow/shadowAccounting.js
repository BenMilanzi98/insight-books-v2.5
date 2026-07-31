/**
 * Accounting V2 — shadow accounting.
 *
 * Persists proposed journals to the isolated AcctV2Shadow* tables and compares them
 * line-by-line against the legacy postings for the same source. Shadow rows are never
 * read by any production report — enforced by table separation and boundary tests.
 */

import { assertTransactionClient } from '../infrastructure/transactionBoundary.js';
import { findLegacyPostingsBySource } from '../infrastructure/legacy/legacyPostingAdapter.js';
import { ShadowComparisonStatus, AuditSeverity, ArchitectureVersion } from '../domain/enums.js';
import { minorToDecimalString } from '../domain/money.js';
import { toMinor } from '../../money.js';

/**
 * Persist a shadow journal proposal for a registered event.
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {import('../domain/accountingContext.js').AccountingContext} context
 * @param {string} eventRegistryId
 * @param {import('../domain/journalDraft.js').JournalDraft} draft
 */
export async function persistShadowJournal(tx, context, eventRegistryId, draft) {
  assertTransactionClient(tx);
  return tx.acctV2ShadowJournal.create({
    data: {
      tenantId: context.businessId,
      eventRegistryId,
      description: draft.description,
      transactionDate: new Date(draft.transactionDate),
      postingDate: new Date(draft.postingDate),
      currency: draft.currency,
      exchangeRate: String(draft.exchangeRate),
      totalDebit: minorToDecimalString(draft.totals.debitMinor),
      totalCredit: minorToDecimalString(draft.totals.creditMinor),
      status: 'PROPOSED',
      architectureVersion: ArchitectureVersion.TRANSITION_V2,
      metadata: Object.keys(draft.metadata).length > 0 ? draft.metadata : undefined,
      lines: {
        create: draft.lines.map((line, i) => ({
          accountId: line.accountId,
          debit: line.debit ? line.debit.decimal : '0',
          credit: line.credit ? line.credit.decimal : '0',
          description: line.description,
          sequence: line.sequence || i + 1,
          dimensions: Object.keys(line.dimensions).length > 0 ? line.dimensions : undefined,
        })),
      },
    },
    include: { lines: true },
  });
}

/**
 * Aggregate legacy posting lines into per-account debit/credit minor totals.
 * @param {{transactions: Array<{lines: Array<object>}>}} legacy
 */
function legacyTotalsByAccount(legacy) {
  /** @type {Map<string, {debitMinor: number, creditMinor: number}>} */
  const map = new Map();
  for (const txn of legacy.transactions) {
    for (const line of txn.lines ?? []) {
      const entry = map.get(line.accountId) ?? { debitMinor: 0, creditMinor: 0 };
      entry.debitMinor += toMinor(line.debitAmount ?? 0);
      entry.creditMinor += toMinor(line.creditAmount ?? 0);
      map.set(line.accountId, entry);
    }
  }
  return map;
}

/**
 * Compare a shadow journal against the legacy postings for the same source.
 * Pure comparison logic is exported separately for testability.
 *
 * @param {import('../domain/journalDraft.js').JournalDraft} draft
 * @param {{transactions: object[], journalEntries: object[]}} legacy
 * @returns {{status: string, severity: string, differences: object[], legacyDebitMinor: number|null, legacyCreditMinor: number|null, explanation: string}}
 */
export function compareProposalWithLegacy(draft, legacy) {
  const differences = [];

  if (!legacy.transactions.length && !legacy.journalEntries.length) {
    return {
      status: ShadowComparisonStatus.MISSING_LEGACY_POSTING,
      severity: AuditSeverity.HIGH,
      differences: [],
      legacyDebitMinor: null,
      legacyCreditMinor: null,
      explanation: 'No legacy posting exists for this source; V2 proposal has no comparator.',
    };
  }

  if (legacy.transactions.length > 1) {
    return {
      status: ShadowComparisonStatus.DUPLICATE_LEGACY_POSTING,
      severity: AuditSeverity.CRITICAL,
      differences: legacy.transactions.map((t) => ({ kind: 'legacy_transaction', id: t.id })),
      legacyDebitMinor: null,
      legacyCreditMinor: null,
      explanation: `Source has ${legacy.transactions.length} posted legacy transactions.`,
    };
  }

  const legacyByAccount = legacyTotalsByAccount(legacy);
  let legacyDebitMinor = 0;
  let legacyCreditMinor = 0;
  for (const totals of legacyByAccount.values()) {
    legacyDebitMinor += totals.debitMinor;
    legacyCreditMinor += totals.creditMinor;
  }

  if (legacyDebitMinor !== legacyCreditMinor) {
    return {
      status: ShadowComparisonStatus.UNBALANCED_LEGACY,
      severity: AuditSeverity.CRITICAL,
      differences: [{ kind: 'legacy_totals', debitMinor: legacyDebitMinor, creditMinor: legacyCreditMinor }],
      legacyDebitMinor,
      legacyCreditMinor,
      explanation: 'Legacy posting is itself unbalanced.',
    };
  }

  /** @type {Map<string, {debitMinor: number, creditMinor: number}>} */
  const proposedByAccount = new Map();
  for (const line of draft.lines) {
    const entry = proposedByAccount.get(line.accountId) ?? { debitMinor: 0, creditMinor: 0 };
    entry.debitMinor += line.debit?.minor ?? 0;
    entry.creditMinor += line.credit?.minor ?? 0;
    proposedByAccount.set(line.accountId, entry);
  }

  const allAccounts = new Set([...legacyByAccount.keys(), ...proposedByAccount.keys()]);
  let accountDifference = false;
  let amountDifference = false;
  for (const accountId of allAccounts) {
    const l = legacyByAccount.get(accountId);
    const p = proposedByAccount.get(accountId);
    if (!l || !p) {
      accountDifference = true;
      differences.push({ kind: 'account', accountId, legacy: l ?? null, proposed: p ?? null });
    } else if (l.debitMinor !== p.debitMinor || l.creditMinor !== p.creditMinor) {
      amountDifference = true;
      differences.push({ kind: 'amount', accountId, legacy: l, proposed: p });
    }
  }

  let status = ShadowComparisonStatus.EXACT_MATCH;
  let severity = AuditSeverity.INFORMATIONAL;
  let explanation = 'Proposed journal matches legacy posting per account and amount.';
  if (accountDifference) {
    status = ShadowComparisonStatus.ACCOUNT_DIFFERENCE;
    severity = AuditSeverity.HIGH;
    explanation = 'Proposed journal uses different accounts than the legacy posting.';
  } else if (amountDifference) {
    status = ShadowComparisonStatus.AMOUNT_DIFFERENCE;
    severity = AuditSeverity.HIGH;
    explanation = 'Proposed journal amounts differ from the legacy posting.';
  }

  return { status, severity, differences, legacyDebitMinor, legacyCreditMinor, explanation };
}

/**
 * Run and persist a shadow comparison for a stored shadow journal.
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {import('../domain/accountingContext.js').AccountingContext} context
 * @param {object} shadowJournal persisted row (with eventRegistryId)
 * @param {import('../domain/journalDraft.js').JournalDraft} draft
 * @param {{transactions: object[], journalEntries: object[]}} legacy
 */
export async function persistShadowComparison(tx, context, shadowJournal, draft, legacy) {
  assertTransactionClient(tx);
  const result = compareProposalWithLegacy(draft, legacy);
  return tx.acctV2ShadowComparison.create({
    data: {
      tenantId: context.businessId,
      shadowJournalId: shadowJournal.id,
      eventRegistryId: shadowJournal.eventRegistryId,
      legacyTransactionId: legacy.transactions[0]?.id ?? null,
      legacyJournalEntryId: legacy.journalEntries[0]?.id ?? null,
      legacyDebit: result.legacyDebitMinor != null ? minorToDecimalString(result.legacyDebitMinor) : null,
      legacyCredit: result.legacyCreditMinor != null ? minorToDecimalString(result.legacyCreditMinor) : null,
      proposedDebit: minorToDecimalString(draft.totals.debitMinor),
      proposedCredit: minorToDecimalString(draft.totals.creditMinor),
      status: result.status,
      severity: result.severity,
      differences: result.differences.length > 0 ? result.differences : undefined,
      explanation: result.explanation,
    },
  });
}

export { findLegacyPostingsBySource };
