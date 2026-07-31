/**
 * Phase 8 — controlled period status transitions with immutable history.
 *
 * Every status change flows through `transitionPeriod` inside the caller's
 * transaction: the transition table is enforced, and an append-only
 * `AcctV2PeriodStatusHistory` row is written atomically with the change.
 * Client-supplied statuses are never applied; routes call workflow services
 * (close/reopen), never this module directly with arbitrary statuses.
 */

import { AccountingValidationError, InvalidAccountingPeriodError } from '../domain/errors.js';
import { recordAccountingAudit } from '../infrastructure/auditTrail.js';
import { toDateOnly } from './periodGeneration.js';
import { isPeriodTransitionAllowed, PeriodStatusAction } from './periodEnums.js';

const ids = (context) => ({ requestId: context.requestId, correlationId: context.correlationId });

/** Load a period, enforcing business scope. */
export async function getPeriodForBusiness(db, context, periodId) {
  const period = await db.acctV2AccountingPeriod.findFirst({
    where: { id: periodId, tenantId: context.businessId },
  });
  if (!period) {
    throw new InvalidAccountingPeriodError('Accounting period not found for this business.', ids(context));
  }
  return period;
}

/**
 * Apply a validated status transition and write the history record.
 * Must be called with a transaction client for multi-step workflows.
 *
 * @param {object} tx transaction client
 * @param {object} context accounting context
 * @param {object} period current period row
 * @param {string} newStatus
 * @param {string} action PeriodStatusAction value
 * @param {object} [opts] {reason, requestedBy, approvedBy, extraData, metadata}
 */
export async function transitionPeriod(tx, context, period, newStatus, action, opts = {}) {
  if (!isPeriodTransitionAllowed(period.status, newStatus)) {
    throw new AccountingValidationError(
      `Period status transition ${period.status} → ${newStatus} is not allowed.`,
      ids(context)
    );
  }
  const updated = await tx.acctV2AccountingPeriod.update({
    where: { id: period.id },
    data: { status: newStatus, ...(opts.extraData ?? {}) },
  });
  await tx.acctV2PeriodStatusHistory.create({
    data: {
      tenantId: context.businessId,
      financialYearId: period.financialYearId,
      accountingPeriodId: period.id,
      previousStatus: period.status,
      newStatus,
      action,
      reason: opts.reason ?? null,
      requestedBy: opts.requestedBy ?? null,
      approvedBy: opts.approvedBy ?? null,
      executedBy: context.userId,
      requestId: context.requestId ?? null,
      correlationId: context.correlationId ?? null,
      metadata: opts.metadata ?? null,
    },
  });
  return updated;
}

/** Immutable status history for a period (newest first). */
export async function getPeriodStatusHistory(db, context, periodId) {
  return db.acctV2PeriodStatusHistory.findMany({
    where: { tenantId: context.businessId, accountingPeriodId: periodId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Set or clear a period lock date. Requires a reason; audited. Lock dates
 * are secondary to period status — they never unlock a CLOSED period.
 */
export async function setPeriodLockDate(db, context, periodId, lockDate, reason) {
  if (!reason) throw new AccountingValidationError('Changing a lock date requires a reason.', ids(context));
  const period = await getPeriodForBusiness(db, context, periodId);
  const value = lockDate == null ? null : toDateOnly(lockDate);
  if (lockDate != null && !value) throw new AccountingValidationError('Lock date is not a valid date.', ids(context));

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.acctV2AccountingPeriod.update({
      where: { id: period.id },
      data: { lockDate: value },
    });
    await tx.acctV2PeriodStatusHistory.create({
      data: {
        tenantId: context.businessId,
        financialYearId: period.financialYearId,
        accountingPeriodId: period.id,
        previousStatus: period.status,
        newStatus: period.status,
        action: PeriodStatusAction.LOCK_DATE_CHANGED,
        reason,
        executedBy: context.userId,
        requestId: context.requestId ?? null,
        correlationId: context.correlationId ?? null,
        metadata: { previousLockDate: period.lockDate, newLockDate: value },
      },
    });
    return row;
  });

  await recordAccountingAudit(
    {
      action: 'acctv2.period.lockDateChange',
      entityType: 'AcctV2AccountingPeriod',
      entityId: period.id,
      userId: context.userId,
      tenantId: context.businessId,
      previousValues: { lockDate: period.lockDate },
      newValues: { lockDate: value },
      reason,
      requestId: context.requestId,
      correlationId: context.correlationId,
    },
    db
  );
  return updated;
}
