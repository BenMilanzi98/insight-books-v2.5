/**
 * Opening-balance batch workflow (Phase 4 controlled framework).
 *
 * A batch (`AcctV2OpeningBalanceBatch`) is unique per (business, effectiveDate,
 * version). Lines are stored in batch metadata until posting; the OPENING_BALANCE
 * template converts the approved batch into one balanced journal through the
 * central engine. Historical openings are NEVER migrated automatically here.
 *
 * Rules enforced:
 *  - balanced lines before the batch can even be created;
 *  - AR lines require a customer dimension, AP lines require a supplier dimension;
 *  - supporting evidence reference is mandatory;
 *  - approval (separate approver) is mandatory;
 *  - a posted batch is immutable; corrections require reversal/adjustment.
 */

import prisma from '../../prisma.js';
import { executePosting, previewPosting } from '../engine/postingEngine.js';
import { createJournalDraft } from '../domain/journalDraft.js';
import { validateDraftAccounts } from '../engine/accountValidation.js';
import {
  AccountingEventType,
  AccountingSourceModule,
} from '../domain/enums.js';
import {
  AccountingValidationError,
  ApprovalInvalidError,
  CrossTenantAccountingError,
  SourceAlreadyPostedError,
} from '../domain/errors.js';
import { recordAccountingAudit } from '../infrastructure/auditTrail.js';
import { ACCOUNTING_PERMISSIONS } from '../permissions.js';

export const OpeningBalanceBatchStatus = Object.freeze({
  DRAFT: 'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  POSTED: 'POSTED',
  CANCELLED: 'CANCELLED',
});

const BATCH_TRANSITIONS = Object.freeze({
  DRAFT: ['PENDING_APPROVAL', 'CANCELLED'],
  PENDING_APPROVAL: ['APPROVED', 'DRAFT', 'CANCELLED'],
  APPROVED: ['POSTED', 'CANCELLED'],
  POSTED: [],
  CANCELLED: [],
});

const ids = (context) => ({ requestId: context.requestId, correlationId: context.correlationId });

function requirePermission(hasPermission, key, context) {
  if (!hasPermission(key)) {
    throw new ApprovalInvalidError(`Missing permission: ${key}.`, { ...ids(context), httpStatus: 403 });
  }
}

function assertBatchTransition(context, from, to) {
  if (from === to) return;
  if (!BATCH_TRANSITIONS[from]?.includes(to)) {
    throw new AccountingValidationError(
      `Opening-balance batch cannot change from ${from} to ${to}.`,
      [{ path: 'status', message: `illegal transition ${from} → ${to}` }],
      ids(context)
    );
  }
}

async function loadBatch(db, context, batchId) {
  const batch = await db.acctV2OpeningBalanceBatch.findFirst({ where: { id: batchId } });
  if (!batch) {
    throw new AccountingValidationError('Opening-balance batch not found.', [
      { path: 'batchId', message: 'unknown batch' },
    ], ids(context));
  }
  if (batch.tenantId !== context.businessId) {
    throw new CrossTenantAccountingError({ ...ids(context), diagnostic: { batchId } });
  }
  return batch;
}

/**
 * Validate opening-balance lines: structure, balance, accounts and the
 * AR-customer / AP-supplier dimension requirements (via account validation).
 */
async function validateBatchLines(db, context, input, hasPermission) {
  if (!Array.isArray(input.lines) || input.lines.length < 2) {
    throw new AccountingValidationError('Opening balances require at least two lines.', [
      { path: 'lines', message: 'minimum two lines' },
    ], ids(context));
  }
  const effective = String(input.effectiveDate).slice(0, 10);
  const draft = createJournalDraft({
    description: input.description ?? `Opening balances as at ${effective}`,
    transactionDate: effective,
    postingDate: effective,
    sourceReference: {
      sourceModule: AccountingSourceModule.OPENING_BALANCES,
      sourceType: 'OpeningBalanceBatch',
      sourceId: 'draft',
      eventType: AccountingEventType.OPENING_BALANCE_POSTED,
    },
    currency: input.currency ?? context.currency,
    exchangeRate: 1,
    lines: input.lines,
    metadata: {},
  });
  // Account validation also enforces control-account dimensions (AR→customerId,
  // AP→supplierId) per line.
  await validateDraftAccounts(db, context, draft, { isManual: false, hasPermission });
  return draft;
}

/**
 * Create a batch. Unique per (business, effectiveDate, version) — a duplicate
 * fails on the database constraint, never silently.
 */
export async function createOpeningBalanceBatch(context, input, options, db = prisma) {
  requirePermission(options.hasPermission, ACCOUNTING_PERMISSIONS.OPENING_BALANCES_CREATE, context);
  if (!input.evidenceReference || !String(input.evidenceReference).trim()) {
    throw new AccountingValidationError('Opening balances require a supporting-evidence reference.', [
      { path: 'evidenceReference', message: 'required' },
    ], ids(context));
  }
  const draft = await validateBatchLines(db, context, input, options.hasPermission);

  try {
    const batch = await db.acctV2OpeningBalanceBatch.create({
      data: {
        tenantId: context.businessId,
        effectiveDate: new Date(String(input.effectiveDate).slice(0, 10)),
        version: input.version ?? 1,
        status: OpeningBalanceBatchStatus.DRAFT,
        description: input.description ?? null,
        evidenceReference: input.evidenceReference,
        createdBy: context.userId,
        metadata: {
          lines: draft.lines.map((l) => ({
            accountId: l.accountId,
            debit: l.debit?.decimal ?? null,
            credit: l.credit?.decimal ?? null,
            description: l.description,
            dimensions: l.dimensions,
          })),
          currency: draft.currency,
        },
      },
    });
    await recordAccountingAudit(
      {
        action: 'acctv2.openingBalance.batchCreated',
        entityType: 'AcctV2OpeningBalanceBatch',
        entityId: batch.id,
        userId: context.userId,
        tenantId: context.businessId,
        newValues: { effectiveDate: input.effectiveDate, version: batch.version, lineCount: draft.lines.length },
        requestId: context.requestId,
        correlationId: context.correlationId,
      },
      db
    );
    return batch;
  } catch (err) {
    if (err && typeof err === 'object' && err.code === 'P2002') {
      throw new AccountingValidationError(
        'An opening-balance batch already exists for this business, effective date and version.',
        [{ path: 'effectiveDate', message: 'duplicate batch' }],
        ids(context)
      );
    }
    throw err;
  }
}

/** DRAFT → PENDING_APPROVAL. */
export async function submitOpeningBalanceBatch(context, batchId, options, db = prisma) {
  requirePermission(options.hasPermission, ACCOUNTING_PERMISSIONS.OPENING_BALANCES_CREATE, context);
  const batch = await loadBatch(db, context, batchId);
  assertBatchTransition(context, batch.status, OpeningBalanceBatchStatus.PENDING_APPROVAL);
  return db.acctV2OpeningBalanceBatch.update({
    where: { id: batch.id },
    data: { status: OpeningBalanceBatchStatus.PENDING_APPROVAL },
  });
}

/** PENDING_APPROVAL → APPROVED (separate approver unless C2 allowSelfApproval). */
export async function approveOpeningBalanceBatch(context, batchId, options, db = prisma) {
  requirePermission(options.hasPermission, ACCOUNTING_PERMISSIONS.OPENING_BALANCES_APPROVE, context);
  const batch = await loadBatch(db, context, batchId);
  assertBatchTransition(context, batch.status, OpeningBalanceBatchStatus.APPROVED);
  if (
    batch.createdBy &&
    batch.createdBy === context.userId &&
    !options.allowSelfApproval
  ) {
    throw new ApprovalInvalidError(
      'Separation of duties: the approver must be different from the batch creator.',
      ids(context)
    );
  }
  const updated = await db.acctV2OpeningBalanceBatch.update({
    where: { id: batch.id },
    data: {
      status: OpeningBalanceBatchStatus.APPROVED,
      approvedBy: context.userId,
      approvedAt: new Date(),
    },
  });
  await recordAccountingAudit(
    {
      action: 'acctv2.openingBalance.batchApproved',
      entityType: 'AcctV2OpeningBalanceBatch',
      entityId: batch.id,
      userId: context.userId,
      tenantId: context.businessId,
      requestId: context.requestId,
      correlationId: context.correlationId,
    },
    db
  );
  return updated;
}

/** Any pre-posted status → CANCELLED. Posted batches are immutable. */
export async function cancelOpeningBalanceBatch(context, batchId, options, db = prisma) {
  requirePermission(options.hasPermission, ACCOUNTING_PERMISSIONS.OPENING_BALANCES_CREATE, context);
  const batch = await loadBatch(db, context, batchId);
  if (batch.status === OpeningBalanceBatchStatus.POSTED) {
    throw new SourceAlreadyPostedError({ ...ids(context), diagnostic: { batchId } });
  }
  assertBatchTransition(context, batch.status, OpeningBalanceBatchStatus.CANCELLED);
  return db.acctV2OpeningBalanceBatch.update({
    where: { id: batch.id },
    data: { status: OpeningBalanceBatchStatus.CANCELLED },
  });
}

function postingInputForBatch(context, batch, options) {
  return {
    context,
    sourceReference: {
      sourceModule: AccountingSourceModule.OPENING_BALANCES,
      sourceType: 'OpeningBalanceBatch',
      sourceId: batch.id,
      eventType: AccountingEventType.OPENING_BALANCE_POSTED,
      eventVersion: batch.version,
    },
    transactionDate: batch.effectiveDate.toISOString().slice(0, 10),
    currency: batch.metadata?.currency ?? context.currency,
    description: batch.description ?? undefined,
    initiatedBy: context.userId,
    hasPermission: options.hasPermission,
  };
}

/** Post an APPROVED batch through the central engine. */
export async function postOpeningBalanceBatch(context, batchId, options, db = prisma) {
  requirePermission(options.hasPermission, ACCOUNTING_PERMISSIONS.OPENING_BALANCES_POST, context);
  const batch = await loadBatch(db, context, batchId);
  return executePosting(postingInputForBatch(context, batch, options), db);
}

/** Read-only preview of the opening-balance journal. */
export async function previewOpeningBalanceBatch(context, batchId, options, db = prisma) {
  requirePermission(options.hasPermission, ACCOUNTING_PERMISSIONS.POSTING_PREVIEW, context);
  const batch = await loadBatch(db, context, batchId);
  return previewPosting(postingInputForBatch(context, batch, options), db);
}
