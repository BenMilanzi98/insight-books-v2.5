/**
 * Phase 9 Stage 3B — Customer credit note → Posting Engine cutover.
 */

import { AccountingEventType, AccountingSourceModule } from '../domain/enums.js';
import { amountString, contextFromSession, submitViaCutover, toIsoDate } from './baseAdapter.js';

export async function postCreditNoteAccounting({
  db,
  tenantId,
  userId,
  creditNoteId,
  hasPermission = () => true,
  currency = 'MWK',
}) {
  const note = await db.creditNote.findFirst({
    where: { id: creditNoteId, tenantId },
    include: { client: { select: { id: true } } },
  }).catch(() => null);

  if (!note) throw new Error("Source note not found for V2 posting");

  const context = contextFromSession({
    tenantId,
    userId,
    currency: note.currency || currency,
  });

  return submitViaCutover({
    db,
    context,
    moduleKey: AccountingSourceModule.SALES,
    eventType: AccountingEventType.CUSTOMER_CREDIT_NOTE_POSTED,
    hasPermission,
    buildEngineInput: async () => ({
      sourceReference: {
        sourceModule: AccountingSourceModule.SALES,
        sourceType: 'CreditNote',
        sourceId: note.id,
        sourceNumber: note.noteNumber,
        eventType: AccountingEventType.CUSTOMER_CREDIT_NOTE_POSTED,
      },
      transactionDate: toIsoDate(note.noteDate),
      requestedPostingDate: toIsoDate(note.noteDate),
      currency: note.currency || currency,
      totalAmount: amountString(note.amount ?? note.totalAmount),
      taxAmount: amountString(note.taxAmount ?? 0),
      description: `Credit Note ${note.noteNumber} - ${note.reason || 'Amount adjustment'}`,
      dimensions: { customerId: note.clientId },
      metadata: {},
      payload: null,
    }),
  });
}
