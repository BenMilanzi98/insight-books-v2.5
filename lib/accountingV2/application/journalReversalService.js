/**
 * Phase 5 — V2 journal reversal workflow.
 *
 * Reversal is the ONLY correction path for posted V2 journals (ADR-002).
 * A reversal:
 *   - creates a NEW posted journal through the central posting engine
 *     (REVERSAL_JOURNAL template, REVERSAL_POSTED event) that mirrors every
 *     line of the original with debit and credit swapped;
 *   - links both directions atomically inside the posting transaction
 *     (original → Reversed + reversedByJournalId; reversal → originalJournalId);
 *   - never edits or deletes the original — both journals remain in the ledger
 *     and net to zero from the reversal date onward.
 *
 * Repeated reversal of the same journal is blocked three ways: the source
 * validator (unreversed check), the accounting-event identity (one
 * REVERSAL_POSTED per journal), and the status machine (Reversed is terminal).
 *
 * Legacy transactions/journals keep their existing legacy reversal path;
 * this service refuses them explicitly.
 */

import prisma from '../../prisma.js';
import { executePosting, previewPosting } from '../engine/postingEngine.js';
import { AccountingSourceModule, AccountingEventType } from '../domain/enums.js';
import { AccountingValidationError, ApprovalInvalidError, CrossTenantAccountingError } from '../domain/errors.js';
import { ACCOUNTING_PERMISSIONS } from '../permissions.js';

const ids = (context) => ({ requestId: context.requestId, correlationId: context.correlationId });

async function loadOriginal(db, context, journalId) {
  const row = await db.journalEntry.findFirst({
    where: { id: journalId },
    include: { lines: { orderBy: { lineNumber: 'asc' } } },
  });
  if (!row) {
    throw new AccountingValidationError('Journal not found.', [
      { path: 'journalId', message: 'unknown journal' },
    ], ids(context));
  }
  if (row.tenantId !== context.businessId) {
    throw new CrossTenantAccountingError({ ...ids(context), diagnostic: { journalId } });
  }
  return row;
}

function reversalPostingInput(context, original, { reason, postingDate, hasPermission }) {
  return {
    context,
    sourceReference: {
      sourceModule: AccountingSourceModule.MANUAL_JOURNAL,
      sourceType: 'JournalEntry',
      sourceId: original.id,
      sourceNumber: original.journalNumber ?? original.referenceNumber ?? null,
      eventType: AccountingEventType.REVERSAL_POSTED,
    },
    transactionDate: (postingDate ?? new Date().toISOString()).slice(0, 10),
    requestedPostingDate: postingDate ?? null,
    currency: original.currency ?? context.currency,
    exchangeRate: original.exchangeRate != null ? String(original.exchangeRate) : 1,
    description: `Reversal of ${original.journalNumber ?? original.referenceNumber ?? original.id}: ${reason}`,
    dimensions: original.metadata?.dimensions ?? {},
    metadata: { reversalReason: reason, originalJournalId: original.id },
    initiatedBy: context.userId,
    hasPermission,
  };
}

/**
 * Reverse a posted V2 journal.
 * @param {import('../domain/accountingContext.js').AccountingContext} context
 * @param {string} journalId original journal id
 * @param {{reason: string, postingDate?: string|null, hasPermission: (k: string) => boolean}} options
 * @param {import('@prisma/client').PrismaClient} [db]
 */
export async function reverseJournal(context, journalId, options, db = prisma) {
  if (!options.hasPermission(ACCOUNTING_PERMISSIONS.JOURNAL_REVERSE)) {
    throw new ApprovalInvalidError(`Missing permission: ${ACCOUNTING_PERMISSIONS.JOURNAL_REVERSE}.`, {
      ...ids(context),
      httpStatus: 403,
    });
  }
  if (!options.reason || !String(options.reason).trim()) {
    throw new AccountingValidationError('A documented reason is required to reverse a journal.', [
      { path: 'reason', message: 'required' },
    ], ids(context));
  }
  const original = await loadOriginal(db, context, journalId);
  // Deep validation (V2-only, posted, unreversed) is enforced again by the
  // reversal source validator inside the posting transaction.
  return executePosting(reversalPostingInput(context, original, options), db);
}

/** Read-only preview of the reversal journal that would be created. */
export async function previewReversal(context, journalId, options, db = prisma) {
  if (!options.hasPermission(ACCOUNTING_PERMISSIONS.JOURNAL_REVERSE)) {
    throw new ApprovalInvalidError(`Missing permission: ${ACCOUNTING_PERMISSIONS.JOURNAL_REVERSE}.`, {
      ...ids(context),
      httpStatus: 403,
    });
  }
  const original = await loadOriginal(db, context, journalId);
  return previewPosting(
    reversalPostingInput(context, original, { ...options, reason: options.reason ?? 'preview' }),
    db
  );
}
