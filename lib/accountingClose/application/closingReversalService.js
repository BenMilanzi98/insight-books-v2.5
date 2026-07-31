/**
 * Explicit Closing Journal reversal — never deletes originals.
 */

import { reverseJournal } from '../../accountingV2/application/journalReversalService.js';
import { ACCOUNTING_PERMISSIONS } from '../../accountingV2/permissions.js';
import { recordAccountingAudit } from '../../accountingV2/infrastructure/auditTrail.js';
import { ClosingBatchStatus } from '../domain/enums.js';
import { CloseChecklistBlockedError, ClosingJournalAlreadyPostedError } from '../domain/errors.js';
import { loadCloseRun } from './closeRunService.js';

/**
 * Reverse the posted Closing Journal for a (typically SUPERSEDED / reopened) close run.
 */
export async function reverseClosingJournals(db, context, closeRunId, options = {}) {
  const run = await loadCloseRun(db, context, closeRunId);
  const batch = run.batches.find((b) => b.status === ClosingBatchStatus.POSTED);
  if (!batch?.journalEntryId) {
    throw new CloseChecklistBlockedError('No posted Closing Journal Batch to reverse.');
  }
  if (batch.status === ClosingBatchStatus.REVERSED) {
    throw new ClosingJournalAlreadyPostedError('Closing batch already reversed.');
  }

  const reason =
    options.reason ||
    `YEA-REV Closing journal reversal for close run ${run.id} version ${run.closeVersion}`;

  const hasPermission =
    options.hasPermission ||
    ((key) => key === ACCOUNTING_PERMISSIONS.JOURNAL_REVERSE || key === ACCOUNTING_PERMISSIONS.JOURNAL_POST);

  const result = await reverseJournal(
    context,
    batch.journalEntryId,
    {
      reason,
      postingDate: options.postingDate || null,
      hasPermission,
    },
    db
  );

  await db.closeV2ClosingJournalBatch.update({
    where: { id: batch.id },
    data: {
      status: ClosingBatchStatus.REVERSED,
      metadata: {
        ...(batch.metadata || {}),
        reversal: {
          reversedAt: new Date().toISOString(),
          reversedBy: context.userId,
          reversalJournalEntryId: result.journalEntryId || result.journal?.id || null,
          reason,
        },
      },
    },
  });

  await recordAccountingAudit(
    {
      action: 'closev2.closingBatch.reversed',
      entityType: 'CloseV2ClosingJournalBatch',
      entityId: batch.id,
      userId: context.userId,
      tenantId: context.businessId,
      newValues: {
        originalJournalEntryId: batch.journalEntryId,
        reversalJournalEntryId: result.journalEntryId || result.journal?.id || null,
        closeRunId,
      },
      reason,
      requestId: context.requestId,
      correlationId: context.correlationId,
    },
    db
  );

  return {
    batchId: batch.id,
    originalJournalEntryId: batch.journalEntryId,
    reversal: result,
    note: 'Original Closing Journal preserved; reversal posted via Posting Engine.',
  };
}
