/**
 * Posting engine — journal persistence (Phase 4).
 *
 * The ONLY approved writer of V2 journals. Persists into the shared
 * `JournalEntry` + `JournalEntryLine` tables with the additive V2 columns:
 * exact decimal totals, journal number, period linkage, template identity,
 * architecture version and the unique accounting-event link. All writes run
 * inside the caller's posting transaction.
 *
 * Immutability: posted V2 journals are frozen — `updatePostedJournalAnnotation`
 * is the only sanctioned update path and it accepts non-financial notes only.
 */

import { assertTransactionClient } from '../infrastructure/transactionBoundary.js';
import { assertSameBusiness } from '../domain/accountingContext.js';
import { ArchitectureVersion, JournalStatus } from '../domain/enums.js';
import { PERSISTED_JOURNAL_STATUS, assertJournalMutationAllowed } from '../domain/journalStatus.js';
import { minorToDecimalString } from '../domain/money.js';
import { JournalPersistenceError, JournalImmutableError, AccountingValidationError } from '../domain/errors.js';

/** Map a draft line to the persisted JournalEntryLine shape. */
function lineData(line, index, draft) {
  return {
    lineNumber: line.sequence || index + 1,
    accountId: line.accountId,
    debitAmount: line.debit ? line.debit.decimal : '0',
    creditAmount: line.credit ? line.credit.decimal : '0',
    baseDebit: line.baseDebit ? line.baseDebit.decimal : line.debit ? line.debit.decimal : '0',
    baseCredit: line.baseCredit ? line.baseCredit.decimal : line.credit ? line.credit.decimal : '0',
    currency: draft.currency,
    taxCode: line.taxReference ?? null,
    description: line.description ?? null,
    dimensions: line.dimensions && Object.keys(line.dimensions).length > 0 ? line.dimensions : undefined,
  };
}

/**
 * Create a new POSTED journal from a validated draft (single transaction).
 *
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {import('../domain/accountingContext.js').AccountingContext} context
 * @param {object} params
 * @param {import('../domain/journalDraft.js').JournalDraft} params.draft
 * @param {string} params.journalNumber
 * @param {{templateId: string, templateVersion: number}} params.template
 * @param {string} params.accountingEventId
 * @param {{accountingPeriodId: string|null, financialYearLabel: string}} params.period
 * @param {string} params.postingMode
 * @param {{approvedById?: string|null, approvedAt?: Date|null}} [params.approval]
 * @param {string} [params.entryType]
 * @param {object} [params.adjustment] {category, reason, relatedJournalId}
 * @returns {Promise<object>} persisted journal with lines
 */
export async function createPostedJournal(tx, context, params) {
  assertTransactionClient(tx);
  const { draft } = params;
  if (draft.totals.debitMinor !== draft.totals.creditMinor) {
    throw new AccountingValidationError('Refusing to persist an unbalanced journal.');
  }
  try {
    return await tx.journalEntry.create({
      data: {
        tenantId: context.businessId,
        branchId: context.branchId ?? null,
        entryDate: new Date(draft.transactionDate),
        postingDate: new Date(draft.postingDate),
        referenceNumber: params.journalNumber, // legacy-visible reference
        journalNumber: params.journalNumber,
        description: draft.description,
        entryType: params.entryType ?? 'Regular',
        sourceType: draft.sourceReference.sourceType,
        sourceId: draft.sourceReference.sourceId,
        status: PERSISTED_JOURNAL_STATUS[JournalStatus.POSTED],
        createdById: context.userId,
        postedById: context.userId,
        postedDate: new Date(),
        currency: draft.currency,
        baseCurrency: context.baseCurrency,
        exchangeRate: String(draft.exchangeRate),
        totalDebit: minorToDecimalString(draft.totals.debitMinor),
        totalCredit: minorToDecimalString(draft.totals.creditMinor),
        accountingPeriodId: params.period.accountingPeriodId,
        financialYearLabel: params.period.financialYearLabel,
        templateId: params.template.templateId,
        templateVersion: params.template.templateVersion,
        architectureVersion: ArchitectureVersion.ACCOUNTING_V2,
        accountingEventId: params.accountingEventId,
        postingMode: params.postingMode,
        approvedById: params.approval?.approvedById ?? null,
        approvedAt: params.approval?.approvedAt ?? null,
        adjustmentCategory: params.adjustment?.category ?? null,
        adjustmentReason: params.adjustment?.reason ?? null,
        relatedJournalId: params.adjustment?.relatedJournalId ?? null,
        // Reversal linkage (Phase 5): set at creation because these fields are
        // frozen on posted V2 journals by the database trigger.
        originalJournalId: params.reversal?.originalJournalId ?? null,
        reversalStatus: params.reversal?.reversalStatus ?? null,
        metadata: Object.keys(draft.metadata).length > 0 ? draft.metadata : undefined,
        lines: { create: draft.lines.map((l, i) => lineData(l, i, draft)) },
      },
      include: { lines: true },
    });
  } catch (err) {
    const prismaCode = err && typeof err === 'object' ? err.code : undefined;
    const prismaTarget = err && typeof err === 'object' ? err.meta?.target : undefined;
    const cause = err instanceof Error ? err.message : String(err);
    console.error('[acctv2] createPostedJournal failed', {
      businessId: context.businessId,
      journalNumber: params.journalNumber,
      prismaCode,
      prismaTarget,
      cause,
    });
    if (prismaCode === 'P2002') {
      // Unique violation on accountingEventId, journalNumber, or (tenantId, referenceNumber).
      throw new JournalPersistenceError({
        requestId: context.requestId,
        correlationId: context.correlationId,
        retryable: false,
        diagnostic: { code: 'P2002', target: prismaTarget, cause },
      });
    }
    throw new JournalPersistenceError({
      requestId: context.requestId,
      correlationId: context.correlationId,
      diagnostic: { cause, code: prismaCode, target: prismaTarget },
    });
  }
}

/**
 * Promote an existing V2 DRAFT/APPROVED journal row (manual or adjustment
 * journal) to POSTED in place. The row's existing lines become the posted lines;
 * the engine re-derives totals from the validated draft.
 *
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {import('../domain/accountingContext.js').AccountingContext} context
 * @param {string} journalId existing draft row id
 * @param {object} params same shape as createPostedJournal minus draft lines
 */
export async function promoteDraftToPosted(tx, context, journalId, params) {
  assertTransactionClient(tx);
  const { draft } = params;
  const existing = await tx.journalEntry.findFirst({ where: { id: journalId } });
  if (!existing) {
    throw new JournalPersistenceError({
      requestId: context.requestId,
      correlationId: context.correlationId,
      retryable: false,
      diagnostic: { journalId, reason: 'draft row disappeared' },
    });
  }
  assertSameBusiness(context, existing, 'journal draft');
  if (existing.status === 'Posted') {
    throw new JournalImmutableError({
      requestId: context.requestId,
      correlationId: context.correlationId,
    });
  }
  if (draft.totals.debitMinor !== draft.totals.creditMinor) {
    throw new AccountingValidationError('Refusing to post an unbalanced journal.');
  }

  const journal = await tx.journalEntry.update({
    where: { id: journalId },
    data: {
      status: PERSISTED_JOURNAL_STATUS[JournalStatus.POSTED],
      postedById: context.userId,
      postedDate: new Date(),
      postingDate: new Date(draft.postingDate),
      journalNumber: params.journalNumber,
      currency: draft.currency,
      baseCurrency: context.baseCurrency,
      exchangeRate: String(draft.exchangeRate),
      totalDebit: minorToDecimalString(draft.totals.debitMinor),
      totalCredit: minorToDecimalString(draft.totals.creditMinor),
      accountingPeriodId: params.period.accountingPeriodId,
      financialYearLabel: params.period.financialYearLabel,
      templateId: params.template.templateId,
      templateVersion: params.template.templateVersion,
      architectureVersion: ArchitectureVersion.ACCOUNTING_V2,
      accountingEventId: params.accountingEventId,
      postingMode: params.postingMode,
    },
    include: { lines: true },
  });
  return journal;
}

/**
 * Mark a posted V2 journal as REVERSED and link its reversal journal (Phase 5).
 * The only permitted mutation of a posted journal besides annotations: reversal
 * linkage fields plus the forward-only Posted → Reversed status transition —
 * exactly the set the database trigger leaves unfrozen. Runs inside the
 * reversal posting transaction so linkage is atomic with the reversal journal.
 *
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {import('../domain/accountingContext.js').AccountingContext} context
 * @param {string} originalJournalId
 * @param {{reversalJournalId: string}} params
 */
export async function linkReversal(tx, context, originalJournalId, params) {
  assertTransactionClient(tx);
  const original = await tx.journalEntry.findFirst({ where: { id: originalJournalId } });
  if (!original) {
    throw new JournalPersistenceError({
      requestId: context.requestId,
      correlationId: context.correlationId,
      retryable: false,
      diagnostic: { originalJournalId, reason: 'original journal disappeared' },
    });
  }
  assertSameBusiness(context, original, 'journal');
  if (original.status !== 'Posted') {
    throw new JournalImmutableError({
      requestId: context.requestId,
      correlationId: context.correlationId,
      diagnostic: { status: original.status, reason: 'only posted journals can be marked reversed' },
    });
  }
  return tx.journalEntry.update({
    where: { id: originalJournalId },
    data: {
      status: PERSISTED_JOURNAL_STATUS[JournalStatus.REVERSED],
      reversalStatus: 'REVERSED',
      reversedByJournalId: params.reversalJournalId,
      reversedAt: new Date(),
      reversedById: context.userId,
    },
  });
}

/**
 * Reversal linkage (Phase 5): mark the ORIGINAL posted journal as reversed and
 * point it at its reversal. This is one of only two sanctioned updates to a
 * posted V2 journal (the other is the notes annotation below); it changes no
 * financial figures and performs the Posted → Reversed transition the status
 * machine and database trigger both permit. Runs inside the reversal's
 * posting transaction so the pair is linked atomically.
 *
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {import('../domain/accountingContext.js').AccountingContext} context
 * @param {string} originalJournalId
 * @param {{id: string}} reversalJournal the newly persisted reversal journal
 */
export async function linkReversalToOriginal(tx, context, originalJournalId, reversalJournal) {
  assertTransactionClient(tx);
  const original = await tx.journalEntry.findFirst({ where: { id: originalJournalId } });
  if (!original) {
    throw new JournalPersistenceError({
      requestId: context.requestId,
      correlationId: context.correlationId,
      retryable: false,
      diagnostic: { originalJournalId, reason: 'original journal disappeared during reversal' },
    });
  }
  assertSameBusiness(context, original, 'reversed journal');
  if (original.status !== 'Posted') {
    throw new JournalImmutableError({
      requestId: context.requestId,
      correlationId: context.correlationId,
      diagnostic: { originalJournalId, status: original.status },
    });
  }
  return tx.journalEntry.update({
    where: { id: originalJournalId },
    data: {
      status: PERSISTED_JOURNAL_STATUS[JournalStatus.REVERSED],
      reversalStatus: 'REVERSED',
      reversedByJournalId: reversalJournal.id,
      reversedAt: new Date(),
      reversedById: context.userId,
    },
  });
}

/**
 * The only sanctioned update to a POSTED V2 journal: append a non-financial
 * annotation to `notes`. Every financially meaningful field is rejected.
 *
 * @param {import('@prisma/client').Prisma.TransactionClient|import('@prisma/client').PrismaClient} db
 * @param {import('../domain/accountingContext.js').AccountingContext} context
 * @param {string} journalId
 * @param {Record<string, unknown>} patch
 */
export async function updatePostedJournalAnnotation(db, context, journalId, patch) {
  const row = await db.journalEntry.findFirst({
    where: { id: journalId, tenantId: context.businessId },
  });
  if (!row) {
    throw new AccountingValidationError('Journal not found for this business.');
  }
  assertJournalMutationAllowed(row, patch);
  const allowedKeys = Object.keys(patch).filter((k) => k === 'notes');
  if (allowedKeys.length !== Object.keys(patch).length) {
    throw new JournalImmutableError({
      requestId: context.requestId,
      correlationId: context.correlationId,
      diagnostic: { rejected: Object.keys(patch).filter((k) => k !== 'notes') },
    });
  }
  return db.journalEntry.update({
    where: { id: journalId },
    data: { notes: [row.notes, patch.notes].filter(Boolean).join('\n') },
  });
}
