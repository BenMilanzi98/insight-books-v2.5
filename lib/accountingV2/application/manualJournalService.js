/**
 * Manual + adjustment journal workflow (Phase 4 controlled pilot).
 *
 * Draft → (submit) → PendingApproval → (approve) → Approved → POST via the
 * central posting engine. The draft row lives in the shared `JournalEntry`
 * table with `architectureVersion = 'ACCOUNTING_V2'`; pre-posted statuses
 * ('Draft', 'PendingApproval', 'Approved') are invisible to legacy reports,
 * which only read `status = 'Posted'`.
 *
 * All state transitions are enforced server-side through the V2 status machine.
 * Separation of duties: the approver must differ from the creator. Posting is
 * delegated to the engine — this service never writes journal lines as posted.
 */

import prisma from '../../prisma.js';
import { executePosting, previewPosting } from '../engine/postingEngine.js';
import { validateDraftAccounts } from '../engine/accountValidation.js';
import { createJournalDraft } from '../domain/journalDraft.js';
import {
  PERSISTED_JOURNAL_STATUS,
  domainJournalStatus,
  assertJournalStatusTransition,
  assertJournalMutationAllowed,
} from '../domain/journalStatus.js';
import { JournalStatus, AccountingEventType, AccountingSourceModule, ArchitectureVersion } from '../domain/enums.js';
import {
  AccountingValidationError,
  ApprovalInvalidError,
  CrossTenantAccountingError,
  JournalImmutableError,
} from '../domain/errors.js';
import { recordAccountingAudit } from '../infrastructure/auditTrail.js';
import { ACCOUNTING_PERMISSIONS } from '../permissions.js';

const ADJUSTMENT_CATEGORIES = Object.freeze([
  'RECLASSIFICATION',
  'ACCRUAL',
  'PREPAYMENT',
  'CORRECTION',
  'TAX_ADJUSTMENT',
  'INVENTORY_ADJUSTMENT',
  'AUDIT_ADJUSTMENT',
  'PRIOR_PERIOD_ADJUSTMENT',
  'OPENING_BALANCE_CORRECTION',
]);

const ids = (context) => ({ requestId: context.requestId, correlationId: context.correlationId });

function requirePermission(hasPermission, key, context) {
  if (!hasPermission(key)) {
    throw new ApprovalInvalidError(`Missing permission: ${key}.`, {
      ...ids(context),
      httpStatus: 403,
    });
  }
}

/** Load a V2 journal row business-scoped, or throw. */
async function loadJournal(db, context, journalId) {
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

/**
 * Structural + account validation of the caller's lines, shared by create/update.
 * Returns the validated in-memory draft (never persisted directly).
 */
async function validateInputLines(db, context, input, hasPermission) {
  const draft = createJournalDraft({
    description: input.description,
    transactionDate: input.entryDate,
    postingDate: input.entryDate,
    sourceReference: {
      // structural placeholder; real source reference is derived at posting time
      sourceModule: AccountingSourceModule.MANUAL_JOURNAL,
      sourceType: 'JournalEntry',
      sourceId: 'draft',
      eventType: AccountingEventType.MANUAL_JOURNAL_POSTED,
    },
    currency: input.currency ?? context.currency,
    exchangeRate: input.exchangeRate ?? 1,
    dimensions: input.dimensions ?? {},
    lines: input.lines,
    metadata: {},
  });
  await validateDraftAccounts(db, context, draft, { isManual: true, hasPermission });
  return draft;
}

/** Map validated draft lines to persisted JournalEntryLine create data. */
function lineCreateData(draft) {
  return draft.lines.map((line, i) => ({
    lineNumber: line.sequence || i + 1,
    accountId: line.accountId,
    debitAmount: line.debit?.decimal ?? '0',
    creditAmount: line.credit?.decimal ?? '0',
    currency: draft.currency,
    description: line.description ?? null,
    taxCode: line.taxReference ?? null,
    dimensions: Object.keys(line.dimensions).length > 0 ? line.dimensions : undefined,
  }));
}

/* ────────────────────────────────────────────────────────────────────────────
 * Draft lifecycle
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Create a manual (or adjustment) journal draft.
 * @param {import('../domain/accountingContext.js').AccountingContext} context
 * @param {object} input {description, entryDate, currency?, lines, attachments?, adjustment?}
 * @param {{hasPermission: (key: string) => boolean}} options
 * @param {import('@prisma/client').PrismaClient} [db]
 */
export async function createManualJournalDraft(context, input, options, db = prisma) {
  const isAdjustment = input.adjustment != null;
  requirePermission(
    options.hasPermission,
    isAdjustment ? ACCOUNTING_PERMISSIONS.JOURNAL_CREATE_ADJUSTMENT : ACCOUNTING_PERMISSIONS.JOURNAL_CREATE,
    context
  );

  if (isAdjustment) {
    if (!ADJUSTMENT_CATEGORIES.includes(input.adjustment.category)) {
      throw new AccountingValidationError('Invalid adjustment category.', [
        { path: 'adjustment.category', message: `must be one of: ${ADJUSTMENT_CATEGORIES.join(', ')}` },
      ], ids(context));
    }
    if (!input.adjustment.reason || !String(input.adjustment.reason).trim()) {
      throw new AccountingValidationError('Adjustment journals require a documented reason.', [
        { path: 'adjustment.reason', message: 'required' },
      ], ids(context));
    }
  }

  const draft = await validateInputLines(db, context, input, options.hasPermission);

  const row = await db.journalEntry.create({
    data: {
      tenantId: context.businessId,
      branchId: context.branchId ?? null,
      entryDate: new Date(input.entryDate),
      description: input.description,
      entryType: isAdjustment ? 'Adjustment' : 'Regular',
      status: PERSISTED_JOURNAL_STATUS[JournalStatus.DRAFT],
      createdById: context.userId,
      currency: draft.currency,
      exchangeRate: String(draft.exchangeRate ?? 1),
      architectureVersion: ArchitectureVersion.ACCOUNTING_V2,
      adjustmentCategory: isAdjustment ? input.adjustment.category : null,
      adjustmentReason: isAdjustment ? input.adjustment.reason : null,
      relatedJournalId: isAdjustment ? input.adjustment.relatedJournalId ?? null : null,
      metadata: {
        attachments: input.attachments ?? [],
        dimensions: input.dimensions ?? {},
      },
      lines: { create: lineCreateData(draft) },
    },
    include: { lines: true },
  });

  await recordAccountingAudit(
    {
      action: 'acctv2.journal.draftCreated',
      entityType: 'JournalEntry',
      entityId: row.id,
      userId: context.userId,
      tenantId: context.businessId,
      newValues: {
        entryType: row.entryType,
        lineCount: row.lines.length,
        adjustmentCategory: row.adjustmentCategory,
      },
      requestId: context.requestId,
      correlationId: context.correlationId,
    },
    db
  );
  return row;
}

/**
 * Replace the lines/description of a DRAFT journal. Any other status is refused;
 * posted journals are immutable.
 */
export async function updateManualJournalDraft(context, journalId, input, options, db = prisma) {
  requirePermission(options.hasPermission, ACCOUNTING_PERMISSIONS.JOURNAL_CREATE, context);
  const row = await loadJournal(db, context, journalId);
  assertJournalMutationAllowed(row, { lines: true, description: input.description });
  if (domainJournalStatus(row.status) !== JournalStatus.DRAFT) {
    throw new AccountingValidationError('Only draft journals can be edited.', [
      { path: 'status', message: `current status: ${row.status}` },
    ], ids(context));
  }

  const draft = await validateInputLines(
    db,
    context,
    {
      description: input.description ?? row.description,
      entryDate: input.entryDate ?? row.entryDate.toISOString().slice(0, 10),
      currency: input.currency ?? row.currency ?? context.currency,
      dimensions: input.dimensions ?? row.metadata?.dimensions ?? {},
      lines: input.lines,
    },
    options.hasPermission
  );

  const [, updated] = await db.$transaction([
    db.journalEntryLine.deleteMany({ where: { journalEntryId: row.id } }),
    db.journalEntry.update({
      where: { id: row.id },
      data: {
        description: input.description ?? row.description,
        entryDate: input.entryDate ? new Date(input.entryDate) : row.entryDate,
        currency: draft.currency,
        lines: { create: lineCreateData(draft) },
      },
      include: { lines: true },
    }),
  ]);
  return updated;
}

/** Draft → PendingApproval. */
export async function submitManualJournal(context, journalId, options, db = prisma) {
  requirePermission(options.hasPermission, ACCOUNTING_PERMISSIONS.JOURNAL_SUBMIT, context);
  const row = await loadJournal(db, context, journalId);
  assertJournalStatusTransition(domainJournalStatus(row.status), JournalStatus.PENDING_APPROVAL);
  return db.journalEntry.update({
    where: { id: row.id },
    data: { status: PERSISTED_JOURNAL_STATUS[JournalStatus.PENDING_APPROVAL] },
  });
}

/** PendingApproval → Approved (separation of duties enforced). */
export async function approveManualJournal(context, journalId, options, db = prisma) {
  requirePermission(options.hasPermission, ACCOUNTING_PERMISSIONS.JOURNAL_APPROVE, context);
  const row = await loadJournal(db, context, journalId);
  assertJournalStatusTransition(domainJournalStatus(row.status), JournalStatus.APPROVED);
  if (row.createdById && row.createdById === context.userId) {
    throw new ApprovalInvalidError(
      'Separation of duties: the approver must be different from the creator.',
      ids(context)
    );
  }
  const updated = await db.journalEntry.update({
    where: { id: row.id },
    data: {
      status: PERSISTED_JOURNAL_STATUS[JournalStatus.APPROVED],
      approvedById: context.userId,
      approvedAt: new Date(),
    },
  });
  await recordAccountingAudit(
    {
      action: 'acctv2.journal.approved',
      entityType: 'JournalEntry',
      entityId: row.id,
      userId: context.userId,
      tenantId: context.businessId,
      requestId: context.requestId,
      correlationId: context.correlationId,
    },
    db
  );
  return updated;
}

/** PendingApproval → Draft (rejection with reason). */
export async function rejectManualJournal(context, journalId, reason, options, db = prisma) {
  requirePermission(options.hasPermission, ACCOUNTING_PERMISSIONS.JOURNAL_APPROVE, context);
  const row = await loadJournal(db, context, journalId);
  assertJournalStatusTransition(domainJournalStatus(row.status), JournalStatus.DRAFT);
  const updated = await db.journalEntry.update({
    where: { id: row.id },
    data: {
      status: PERSISTED_JOURNAL_STATUS[JournalStatus.DRAFT],
      notes: [row.notes, `Rejected by approver: ${reason ?? 'no reason given'}`].filter(Boolean).join('\n'),
    },
  });
  await recordAccountingAudit(
    {
      action: 'acctv2.journal.rejected',
      entityType: 'JournalEntry',
      entityId: row.id,
      userId: context.userId,
      tenantId: context.businessId,
      reason: reason ?? null,
      requestId: context.requestId,
      correlationId: context.correlationId,
    },
    db
  );
  return updated;
}

/** Draft/PendingApproval → Cancelled. Posted journals can never be cancelled. */
export async function cancelManualJournal(context, journalId, options, db = prisma) {
  requirePermission(options.hasPermission, ACCOUNTING_PERMISSIONS.JOURNAL_CREATE, context);
  const row = await loadJournal(db, context, journalId);
  if (domainJournalStatus(row.status) === JournalStatus.POSTED) {
    throw new JournalImmutableError(ids(context));
  }
  assertJournalStatusTransition(domainJournalStatus(row.status), JournalStatus.CANCELLED);
  return db.journalEntry.update({
    where: { id: row.id },
    data: { status: PERSISTED_JOURNAL_STATUS[JournalStatus.CANCELLED] },
  });
}

/* ────────────────────────────────────────────────────────────────────────────
 * Posting (delegates to the central engine)
 * ──────────────────────────────────────────────────────────────────────────── */

function postingInputForJournal(context, row, options) {
  const isAdjustment = row.entryType === 'Adjustment';
  const approvalOverride = options.approvalOverride ?? null;
  const rowMetadata =
    row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata) ? row.metadata : {};
  return {
    context,
    sourceReference: {
      sourceModule: AccountingSourceModule.MANUAL_JOURNAL,
      sourceType: 'JournalEntry',
      sourceId: row.id,
      sourceNumber: row.referenceNumber ?? null,
      eventType: isAdjustment
        ? AccountingEventType.ADJUSTMENT_POSTED
        : AccountingEventType.MANUAL_JOURNAL_POSTED,
    },
    transactionDate: row.entryDate.toISOString().slice(0, 10),
    requestedPostingDate: options.postingDate ?? null,
    currency: row.currency ?? context.currency,
    exchangeRate: row.exchangeRate ? String(row.exchangeRate) : 1,
    description: row.description,
    dimensions: row.metadata?.dimensions ?? {},
    attachmentReferences: row.metadata?.attachments ?? [],
    metadata: {
      ...rowMetadata,
      ...(approvalOverride ? { approvalOverride } : {}),
    },
    initiatedBy: context.userId,
    hasPermission: options.hasPermission,
  };
}

/**
 * Post an APPROVED journal through the central engine. The engine enforces
 * mode, idempotency, the legacy guard, validation and atomic persistence.
 */
export async function postManualJournal(context, journalId, options, db = prisma) {
  const row = await loadJournal(db, context, journalId);
  requirePermission(
    options.hasPermission,
    row.entryType === 'Adjustment' ? ACCOUNTING_PERMISSIONS.JOURNAL_POST_ADJUSTMENT : ACCOUNTING_PERMISSIONS.JOURNAL_POST,
    context
  );
  return executePosting(postingInputForJournal(context, row, options), db);
}

/** Read-only preview of what posting this journal would produce. */
export async function previewManualJournal(context, journalId, options, db = prisma) {
  requirePermission(options.hasPermission, ACCOUNTING_PERMISSIONS.POSTING_PREVIEW, context);
  const row = await loadJournal(db, context, journalId);
  return previewPosting(postingInputForJournal(context, row, options), db);
}

export { ADJUSTMENT_CATEGORIES };
