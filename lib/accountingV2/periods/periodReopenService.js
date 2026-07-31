/**
 * Phase 8 — controlled period reopening (§37–§40).
 *
 * Request (reason + expected corrections) → impact analysis → approval by a
 * different authorized user → REOPENED with restricted correction scope and
 * a re-close deadline. The original close run and its snapshots are never
 * deleted; a re-close creates a new run version and new snapshots.
 */

import { AccountingValidationError } from '../domain/errors.js';
import { recordAccountingAudit } from '../infrastructure/auditTrail.js';
import { enqueueOutboxMessage } from '../infrastructure/outbox.js';
import { getCalendarConfig } from './calendarConfigService.js';
import { getPeriodForBusiness, transitionPeriod } from './periodLifecycleService.js';
import { toDateOnly, isoDate } from './periodGeneration.js';
import {
  AccountingPeriodStatus,
  PeriodStatusAction,
  ReopenRequestStatus,
  CloseRunStatus,
} from './periodEnums.js';

const ids = (context) => ({ requestId: context.requestId, correlationId: context.correlationId });
const DAY = 24 * 60 * 60 * 1000;

/**
 * Reopening impact analysis (§38): everything affected by reopening the
 * period, computed from canonical data. Read-only.
 */
export async function computeReopenImpact(db, context, periodId) {
  const period = await getPeriodForBusiness(db, context, periodId);
  const windowStart = toDateOnly(period.startDate);
  const windowEnd = new Date(toDateOnly(period.endDate).getTime() + DAY - 1);

  const [journalCount, closeRuns, laterPeriods, laterYears, exceptions] = await Promise.all([
    db.journalEntry.count({
      where: {
        tenantId: context.businessId,
        status: { in: ['POSTED', 'Posted'] },
        entryDate: { gte: windowStart, lte: windowEnd },
      },
    }),
    db.acctV2PeriodCloseRun.findMany({
      where: { tenantId: context.businessId, accountingPeriodId: period.id },
      orderBy: { closeNumber: 'desc' },
    }),
    db.acctV2AccountingPeriod.findMany({
      where: {
        tenantId: context.businessId,
        startDate: { gt: toDateOnly(period.endDate) },
      },
      orderBy: { startDate: 'asc' },
      take: 24,
    }),
    db.acctV2FinancialYear.findMany({
      where: { tenantId: context.businessId, startDate: { gt: toDateOnly(period.endDate) } },
    }),
    db.acctV2PeriodCloseException.findMany({
      where: { tenantId: context.businessId, accountingPeriodId: period.id },
    }),
  ]);

  const completedRun = closeRuns.find((r) => r.status === CloseRunStatus.COMPLETED) ?? null;
  const snapshots = completedRun?.snapshotReferences ?? [];
  const closedLaterPeriods = laterPeriods.filter((p) => p.status === AccountingPeriodStatus.CLOSED);

  return {
    period: {
      id: period.id,
      code: period.code,
      name: period.name,
      status: period.status,
      startDate: isoDate(windowStart),
      endDate: isoDate(toDateOnly(period.endDate)),
    },
    journalsInPeriod: journalCount,
    closeRunCount: closeRuns.length,
    latestCloseRun: completedRun
      ? { id: completedRun.id, closeNumber: completedRun.closeNumber, closedBy: completedRun.closedBy, completedAt: completedRun.completedAt }
      : null,
    reportSnapshotsAffected: snapshots,
    downstreamPeriods: laterPeriods.map((p) => ({ id: p.id, code: p.code, status: p.status })),
    downstreamClosedPeriodCount: closedLaterPeriods.length,
    downstreamOpeningBalancesAffected: closedLaterPeriods.length > 0,
    yearEndImplication: laterYears.some((y) => y.status === 'CLOSED')
      ? 'A later financial year is closed; reopening has year-end implications requiring elevated review.'
      : null,
    exceptions: exceptions.map((e) => ({ id: e.id, category: e.category, severity: e.severity, status: e.status })),
    generatedAt: new Date().toISOString(),
  };
}

/** Submit a reopening request for a CLOSED period. */
export async function requestReopen(db, context, periodId, { reason, expectedCorrections = null }) {
  if (!reason || String(reason).trim().length < 10) {
    throw new AccountingValidationError('Reopening requires a detailed reason (at least 10 characters).', ids(context));
  }
  const period = await getPeriodForBusiness(db, context, periodId);
  if (period.status !== AccountingPeriodStatus.CLOSED) {
    throw new AccountingValidationError(`Only CLOSED periods can be reopened (current: ${period.status}).`, ids(context));
  }
  const pending = await db.acctV2PeriodReopenRequest.findFirst({
    where: {
      tenantId: context.businessId,
      accountingPeriodId: period.id,
      status: { in: [ReopenRequestStatus.PENDING, ReopenRequestStatus.APPROVED] },
    },
  });
  if (pending) {
    throw new AccountingValidationError('A reopening request is already pending for this period.', ids(context));
  }

  const impact = await computeReopenImpact(db, context, periodId);
  const request = await db.$transaction(async (tx) => {
    const row = await tx.acctV2PeriodReopenRequest.create({
      data: {
        tenantId: context.businessId,
        financialYearId: period.financialYearId,
        accountingPeriodId: period.id,
        reason,
        expectedCorrections,
        status: ReopenRequestStatus.PENDING,
        impactAnalysis: impact,
        requestedBy: context.userId,
        requestId: context.requestId ?? null,
        correlationId: context.correlationId ?? null,
      },
    });
    await tx.acctV2PeriodStatusHistory.create({
      data: {
        tenantId: context.businessId,
        financialYearId: period.financialYearId,
        accountingPeriodId: period.id,
        previousStatus: period.status,
        newStatus: period.status,
        action: PeriodStatusAction.REQUEST_REOPEN,
        reason,
        requestedBy: context.userId,
        executedBy: context.userId,
        requestId: context.requestId ?? null,
        correlationId: context.correlationId ?? null,
        metadata: { reopenRequestId: row.id },
      },
    });
    return row;
  });

  await recordAccountingAudit(
    {
      action: 'acctv2.period.reopenRequested',
      entityType: 'AcctV2PeriodReopenRequest',
      entityId: request.id,
      userId: context.userId,
      tenantId: context.businessId,
      newValues: { periodId: period.id, expectedCorrections },
      reason,
      requestId: context.requestId,
      correlationId: context.correlationId,
    },
    db
  );
  return { request, impact };
}

/**
 * Approve and execute a reopening. Separation of duties: the approver must
 * differ from the requester. Snapshots are preserved; the period becomes
 * REOPENED with a restricted correction scope and a re-close deadline.
 */
export async function approveReopen(db, context, reopenRequestId, { correctionScope = null, comment = null } = {}) {
  const request = await db.acctV2PeriodReopenRequest.findFirst({
    where: { id: reopenRequestId, tenantId: context.businessId },
  });
  if (!request) throw new AccountingValidationError('Reopening request not found for this business.', ids(context));
  if (request.status !== ReopenRequestStatus.PENDING) {
    throw new AccountingValidationError(`Cannot approve a request in status ${request.status}.`, ids(context));
  }
  if (request.requestedBy === context.userId) {
    throw new AccountingValidationError(
      'Separation of duties: the requester cannot approve their own reopening request.',
      ids(context)
    );
  }
  const period = await getPeriodForBusiness(db, context, request.accountingPeriodId);
  if (period.status !== AccountingPeriodStatus.CLOSED) {
    throw new AccountingValidationError(`Period is no longer CLOSED (current: ${period.status}).`, ids(context));
  }
  const config = await getCalendarConfig(db, context);
  const recloseDeadline = new Date(Date.now() + (config.recloseDeadlineDays ?? 14) * DAY);

  const result = await db.$transaction(async (tx) => {
    const approved = await tx.acctV2PeriodReopenRequest.update({
      where: { id: request.id },
      data: {
        status: ReopenRequestStatus.EXECUTED,
        approvedBy: context.userId,
        approvedAt: new Date(),
        executedAt: new Date(),
        correctionScope,
        recloseDeadline,
        metadata: { ...(request.metadata ?? {}), approvalComment: comment },
      },
    });
    const reopened = await transitionPeriod(tx, context, period, AccountingPeriodStatus.REOPENED, PeriodStatusAction.REOPEN, {
      reason: request.reason,
      requestedBy: request.requestedBy,
      approvedBy: context.userId,
      extraData: {
        reopenDate: new Date(),
        reopenedBy: context.userId,
        reopenReason: request.reason,
      },
      metadata: { reopenRequestId: request.id, recloseDeadline: recloseDeadline.toISOString() },
    });
    await enqueueOutboxMessage(tx, context, {
      aggregateType: 'AcctV2AccountingPeriod',
      aggregateId: period.id,
      eventType: 'PERIOD_REOPENED',
      payload: {
        periodId: period.id,
        periodCode: period.code,
        reopenRequestId: request.id,
        recloseDeadline: recloseDeadline.toISOString(),
      },
    });
    return { request: approved, period: reopened };
  });

  await recordAccountingAudit(
    {
      action: 'acctv2.period.reopened',
      entityType: 'AcctV2AccountingPeriod',
      entityId: period.id,
      userId: context.userId,
      tenantId: context.businessId,
      previousValues: { status: AccountingPeriodStatus.CLOSED },
      newValues: { status: AccountingPeriodStatus.REOPENED, reopenRequestId: request.id },
      reason: request.reason,
      requestId: context.requestId,
      correlationId: context.correlationId,
    },
    db
  );
  return result;
}

/** Reject a pending reopening request (audited, request preserved). */
export async function rejectReopen(db, context, reopenRequestId, { rejectionReason }) {
  if (!rejectionReason) {
    throw new AccountingValidationError('Rejecting a reopening request requires a reason.', ids(context));
  }
  const request = await db.acctV2PeriodReopenRequest.findFirst({
    where: { id: reopenRequestId, tenantId: context.businessId },
  });
  if (!request) throw new AccountingValidationError('Reopening request not found for this business.', ids(context));
  if (request.status !== ReopenRequestStatus.PENDING) {
    throw new AccountingValidationError(`Cannot reject a request in status ${request.status}.`, ids(context));
  }
  const updated = await db.acctV2PeriodReopenRequest.update({
    where: { id: request.id },
    data: { status: ReopenRequestStatus.REJECTED, rejectedBy: context.userId, rejectionReason },
  });
  await recordAccountingAudit(
    {
      action: 'acctv2.period.reopenRejected',
      entityType: 'AcctV2PeriodReopenRequest',
      entityId: request.id,
      userId: context.userId,
      tenantId: context.businessId,
      newValues: { status: ReopenRequestStatus.REJECTED },
      reason: rejectionReason,
      requestId: context.requestId,
      correlationId: context.correlationId,
    },
    db
  );
  return updated;
}

/** Reopening requests for a period (newest first). */
export async function listReopenRequests(db, context, periodId) {
  return db.acctV2PeriodReopenRequest.findMany({
    where: { tenantId: context.businessId, accountingPeriodId: periodId },
    orderBy: { requestedAt: 'desc' },
  });
}
