/**
 * Canonical Transaction Reversal Engine façade.
 *
 * GL always goes through reverseSourceJournals / reverseJournal (V2).
 * This module owns the TransactionReversal register + request/approve/execute lifecycle.
 */

import prisma from '../prisma.js';
import {
  validateReversalEligibility,
  validateReversalReason,
  checkAccountingPeriodLock,
  createTransactionReversal,
  createInvoiceReversal,
  createExpenseReversal,
  createPaymentReversal,
  createSaleReversal,
  createSupplierPaymentReversal,
  calculateReversalImpact,
} from '../transactionReversalService.js';
import { PERIOD_POLICY, REVERSAL_STATUS, SOURCE_TYPES } from './constants.js';
import { assertSeparateApprover, resolveReversalSodPolicy } from './sodPolicy.js';


function assertSourceType(sourceType) {
  if (!SOURCE_TYPES.includes(sourceType)) {
    const err = new Error(`Unsupported source type: ${sourceType}`);
    err.code = 'UNSUPPORTED_SOURCE_TYPE';
    throw err;
  }
}

/** True when Prisma client + table support the TransactionReversal register. */
function registerEnabled(db = prisma) {
  return Boolean(db?.transactionReversal?.create);
}


function documentDateFrom(transaction) {
  if (!transaction) return null;
  return (
    transaction.date ||
    transaction.issueDate ||
    transaction.paymentDate ||
    transaction.saleDate ||
    null
  );
}

export async function findRegisterRow({ tenantId, sourceType, sourceId, db = prisma }) {
  if (!registerEnabled(db)) return null;
  return db.transactionReversal.findUnique({
    where: {
      tenantId_sourceType_sourceId: { tenantId, sourceType, sourceId },
    },
  });
}

/**
 * Create or refresh a REQUESTED reversal register row (does not post GL).
 */
export async function requestTransactionReversal({
  tenantId,
  userId,
  sourceType,
  sourceId,
  reason,
  idempotencyKey = null,
  crossPeriodDisclosure = false,
  impactSnapshot = null,
  db = prisma,
}) {
  assertSourceType(sourceType);
  if (!registerEnabled(db)) {
    const err = new Error(
      'TransactionReversal register is unavailable. Run prisma migrate + generate, then restart the app.'
    );
    err.code = 'REGISTER_UNAVAILABLE';
    throw err;
  }

  const reasonValidation = validateReversalReason(reason);
  if (!reasonValidation.isValid) {
    const err = new Error(reasonValidation.error);
    err.code = 'INVALID_REASON';
    throw err;
  }

  const eligibility = await validateReversalEligibility({
    transactionId: sourceId,
    transactionType: sourceType,
    tenantId,
  });
  if (!eligibility.isValid) {
    const err = new Error(eligibility.error);
    err.code = 'NOT_ELIGIBLE';
    throw err;
  }

  const existing = await findRegisterRow({ tenantId, sourceType, sourceId, db });
  if (existing?.status === REVERSAL_STATUS.COMPLETED) {
    const err = new Error('This transaction has already been reversed.');
    err.code = 'ALREADY_REVERSED';
    err.register = existing;
    throw err;
  }
  if (existing?.status === REVERSAL_STATUS.EXECUTING) {
    const err = new Error('A reversal is already in progress for this transaction.');
    err.code = 'REVERSAL_IN_PROGRESS';
    err.register = existing;
    throw err;
  }

  const originalDocumentDate = documentDateFrom(eligibility.transaction);
  const data = {
    status: REVERSAL_STATUS.REQUESTED,
    reason: reasonValidation.reason,
    requestedById: userId,
    requestedAt: new Date(),
    approvedById: null,
    approvedAt: null,
    executedById: null,
    executedAt: null,
    rejectedAt: null,
    rejectionReason: null,
    periodPolicy: PERIOD_POLICY.REVERSE_IN_CURRENT_OPEN_PERIOD,
    crossPeriodDisclosure: Boolean(crossPeriodDisclosure),
    originalDocumentDate,
    postingDate: null,
    reversalDocumentId: null,
    originalJournalEntryId: null,
    reversalJournalEntryId: null,
    idempotencyKey: idempotencyKey || existing?.idempotencyKey || null,
    impactSnapshot: impactSnapshot ?? existing?.impactSnapshot ?? null,
    errorCode: null,
    errorMessage: null,
  };

  if (existing) {
    return db.transactionReversal.update({
      where: { id: existing.id },
      data,
    });
  }

  return db.transactionReversal.create({
    data: {
      tenantId,
      sourceType,
      sourceId,
      ...data,
    },
  });
}

/**
 * Approve a REQUESTED register row. When SoD is on, approver must differ from requester.
 */
export async function approveTransactionReversal({
  tenantId,
  userId,
  reversalId,
  db = prisma,
}) {
  if (!registerEnabled(db)) {
    const err = new Error('TransactionReversal register is unavailable.');
    err.code = 'REGISTER_UNAVAILABLE';
    throw err;
  }

  const row = await db.transactionReversal.findFirst({
    where: { id: reversalId, tenantId },
  });

  if (!row) {
    const err = new Error('Reversal request not found.');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (row.status === REVERSAL_STATUS.COMPLETED) {
    return row;
  }
  if (![REVERSAL_STATUS.REQUESTED, REVERSAL_STATUS.APPROVED].includes(row.status)) {
    const err = new Error(`Cannot approve reversal in status ${row.status}.`);
    err.code = 'INVALID_STATUS';
    throw err;
  }

  if (row.status === REVERSAL_STATUS.APPROVED) return row;

  const sod = await resolveReversalSodPolicy({ tenantId, db });
  assertSeparateApprover({
    requireSeparateApprover: sod.requireSeparateApprover,
    requestedById: row.requestedById,
    actorUserId: userId,
  });

  return db.transactionReversal.update({
    where: { id: row.id },
    data: {
      status: REVERSAL_STATUS.APPROVED,
      approvedById: userId,
      approvedAt: new Date(),
    },
  });
}

export async function rejectTransactionReversal({
  tenantId,
  userId,
  reversalId,
  rejectionReason = null,
  db = prisma,
}) {
  if (!registerEnabled(db)) {
    const err = new Error('TransactionReversal register is unavailable.');
    err.code = 'REGISTER_UNAVAILABLE';
    throw err;
  }
  const row = await db.transactionReversal.findFirst({
    where: { id: reversalId, tenantId },
  });
  if (!row) {
    const err = new Error('Reversal request not found.');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (![REVERSAL_STATUS.REQUESTED, REVERSAL_STATUS.APPROVED].includes(row.status)) {
    const err = new Error(`Cannot reject reversal in status ${row.status}.`);
    err.code = 'INVALID_STATUS';
    throw err;
  }
  const sod = await resolveReversalSodPolicy({ tenantId, db });
  assertSeparateApprover({
    requireSeparateApprover: sod.requireSeparateApprover,
    requestedById: row.requestedById,
    actorUserId: userId,
  });
  return db.transactionReversal.update({
    where: { id: row.id },
    data: {
      status: REVERSAL_STATUS.REJECTED,
      rejectedAt: new Date(),
      rejectionReason: rejectionReason
        ? String(rejectionReason).slice(0, 1000)
        : 'Rejected',
      approvedById: userId,
      approvedAt: new Date(),
    },
  });
}

export async function listPendingReversalApprovals({ tenantId, db = prisma }) {
  if (!registerEnabled(db)) return [];
  return db.transactionReversal.findMany({
    where: {
      tenantId,
      status: { in: [REVERSAL_STATUS.REQUESTED, REVERSAL_STATUS.APPROVED] },
    },
    orderBy: { requestedAt: 'desc' },
    take: 100,
  });
}


async function runDomainReversal({
  sourceType,
  sourceId,
  reason,
  userId,
  tenantId,
}) {
  switch (sourceType) {
    case 'Transaction':
      return createTransactionReversal({
        transactionId: sourceId,
        reversalReason: reason,
        userId,
        tenantId,
      });
    case 'Invoice':
      return createInvoiceReversal({
        invoiceId: sourceId,
        reversalReason: reason,
        userId,
        tenantId,
      });
    case 'Expense':
      return createExpenseReversal({
        expenseId: sourceId,
        reversalReason: reason,
        userId,
        tenantId,
      });
    case 'Payment':
      return createPaymentReversal({
        paymentId: sourceId,
        reversalReason: reason,
        userId,
        tenantId,
      });
    case 'Sale':
      return createSaleReversal({
        saleId: sourceId,
        reversalReason: reason,
        userId,
        tenantId,
      });
    case 'SupplierPayment':
      return createSupplierPaymentReversal({
        supplierPaymentId: sourceId,
        reversalReason: reason,
        userId,
        tenantId,
      });
    default: {
      const err = new Error(`Unknown transaction type: ${sourceType}`);
      err.code = 'UNSUPPORTED_SOURCE_TYPE';
      throw err;
    }
  }
}

/**
 * Execute a reversal: register → domain create*Reversal (which calls reverseSourceJournals).
 * When requireApproval is false (default for dual-run), request+approve are folded in.
 */
export async function executeTransactionReversal({
  tenantId,
  userId,
  sourceType,
  sourceId,
  reason,
  idempotencyKey = null,
  crossPeriodDisclosure = false,
  requireApproval = false,
  reversalId = null,
  db = prisma,
}) {
  assertSourceType(sourceType);

  const reasonValidation = validateReversalReason(reason);
  if (!reasonValidation.isValid) {
    const err = new Error(reasonValidation.error);
    err.code = 'INVALID_REASON';
    throw err;
  }

  // Dual-run: if register client/table not ready, still execute domain+V2 reverse.
  if (!registerEnabled(db)) {
    const eligibility = await validateReversalEligibility({
      transactionId: sourceId,
      transactionType: sourceType,
      tenantId,
    });
    if (!eligibility.isValid) {
      const err = new Error(eligibility.error);
      err.code = 'NOT_ELIGIBLE';
      throw err;
    }
    const originalDocumentDate = documentDateFrom(eligibility.transaction);
    const periodCheck = await checkAccountingPeriodLock(tenantId, originalDocumentDate);
    if (periodCheck.isLocked) {
      const err = new Error(periodCheck.error);
      err.code = 'PERIOD_LOCKED';
      throw err;
    }
    const result = await runDomainReversal({
      sourceType,
      sourceId,
      reason: reasonValidation.reason,
      userId,
      tenantId,
    });
    return {
      success: true,
      alreadyCompleted: false,
      register: null,
      reversal: result.reversal || result,
      taxReversals: result.taxReversals || [],
      payrollReversalSummary: result.payrollReversalSummary || null,
      originalTransaction: eligibility.transaction,
    };
  }

  let register =
    reversalId
      ? await db.transactionReversal.findFirst({ where: { id: reversalId, tenantId } })
      : await findRegisterRow({ tenantId, sourceType, sourceId, db });

  if (register?.status === REVERSAL_STATUS.COMPLETED) {
    return {
      success: true,
      alreadyCompleted: true,
      register,
      reversal: { id: register.reversalDocumentId },
      taxReversals: [],
    };
  }

  if (!register) {
    register = await requestTransactionReversal({
      tenantId,
      userId,
      sourceType,
      sourceId,
      reason: reasonValidation.reason,
      idempotencyKey,
      crossPeriodDisclosure,
      db,
    });
  }

  const sod = await resolveReversalSodPolicy({ tenantId, db });
  const sodRequired = requireApproval || sod.requireSeparateApprover;

  if (sodRequired && register.status === REVERSAL_STATUS.REQUESTED) {
    const err = new Error('Reversal must be approved by a separate user before execution.');
    err.code = 'APPROVAL_REQUIRED';
    err.register = register;
    throw err;
  }

  if (register.status === REVERSAL_STATUS.REQUESTED) {
    // SoD off: fold approve into execute for the same actor.
    register = await approveTransactionReversal({
      tenantId,
      userId,
      reversalId: register.id,
      db,
    });
  }

  if (sodRequired && register.status === REVERSAL_STATUS.APPROVED) {
    assertSeparateApprover({
      requireSeparateApprover: true,
      requestedById: register.requestedById,
      actorUserId: userId,
    });
  }


  const eligibility = await validateReversalEligibility({
    transactionId: sourceId,
    transactionType: sourceType,
    tenantId,
  });
  if (!eligibility.isValid) {
    await db.transactionReversal.update({
      where: { id: register.id },
      data: {
        status: REVERSAL_STATUS.FAILED,
        errorCode: 'NOT_ELIGIBLE',
        errorMessage: eligibility.error,
      },
    });
    const err = new Error(eligibility.error);
    err.code = 'NOT_ELIGIBLE';
    throw err;
  }

  const originalDocumentDate = documentDateFrom(eligibility.transaction);
  const periodCheck = await checkAccountingPeriodLock(tenantId, originalDocumentDate);
  if (periodCheck.isLocked) {
    await db.transactionReversal.update({
      where: { id: register.id },
      data: {
        status: REVERSAL_STATUS.FAILED,
        errorCode: 'PERIOD_LOCKED',
        errorMessage: periodCheck.error,
        crossPeriodDisclosure: Boolean(crossPeriodDisclosure),
      },
    });
    const err = new Error(periodCheck.error);
    err.code = 'PERIOD_LOCKED';
    throw err;
  }

  let impactSnapshot = register.impactSnapshot;
  try {
    impactSnapshot = await calculateReversalImpact({
      transactionId: sourceId,
      transactionType: sourceType,
      tenantId,
    });
  } catch {
    // Impact preview is best-effort; execution remains authoritative via V2 reverse.
  }

  register = await db.transactionReversal.update({
    where: { id: register.id },
    data: {
      status: REVERSAL_STATUS.EXECUTING,
      impactSnapshot: impactSnapshot ?? undefined,
      originalDocumentDate,
      reason: reasonValidation.reason,
    },
  });

  try {
    const result = await runDomainReversal({
      sourceType,
      sourceId,
      reason: register.reason,
      userId,
      tenantId,
    });
    const reversalData = result.reversal || result;
    const taxReversals = result.taxReversals || [];
    const payrollReversalSummary = result.payrollReversalSummary || null;

    const completed = await db.transactionReversal.update({
      where: { id: register.id },
      data: {
        status: REVERSAL_STATUS.COMPLETED,
        executedById: userId,
        executedAt: new Date(),
        postingDate: new Date(),
        reversalDocumentId: reversalData?.id || null,
        originalJournalEntryId: result.originalJournalEntryId || null,
        reversalJournalEntryId:
          result.reversalJournalEntryId ||
          result.glReversalJournalId ||
          null,
        errorCode: null,
        errorMessage: null,
        metadata: {
          ...(register.metadata && typeof register.metadata === 'object' ? register.metadata : {}),
          taxReversalCount: taxReversals.length,
          payrollReversalSummary: payrollReversalSummary || undefined,
        },
      },
    });

    return {
      success: true,
      alreadyCompleted: false,
      register: completed,
      reversal: reversalData,
      taxReversals,
      payrollReversalSummary,
      originalTransaction: eligibility.transaction,
    };
  } catch (error) {
    await db.transactionReversal.update({
      where: { id: register.id },
      data: {
        status: REVERSAL_STATUS.FAILED,
        errorCode: error.code || 'EXECUTE_FAILED',
        errorMessage: error.message || 'Reversal execution failed',
      },
    });
    throw error;
  }
}


export async function previewTransactionReversalImpact({
  tenantId,
  sourceType,
  sourceId,
}) {
  assertSourceType(sourceType);
  const eligibility = await validateReversalEligibility({
    transactionId: sourceId,
    transactionType: sourceType,
    tenantId,
  });
  const impact = await calculateReversalImpact({
    transactionId: sourceId,
    transactionType: sourceType,
    tenantId,
  });
  return {
    eligibility,
    impact,
    periodPolicy: PERIOD_POLICY.REVERSE_IN_CURRENT_OPEN_PERIOD,
  };
}
