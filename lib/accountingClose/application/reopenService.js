/**
 * Controlled financial-year reopening with impact analysis.
 * Never deletes original close runs, journals, or snapshots.
 */

import { FinancialYearStatus } from '../../accountingV2/periods/periodEnums.js';
import { recordAccountingAudit } from '../../accountingV2/infrastructure/auditTrail.js';
import {
  YearEndCloseRunStatus,
  CloseStatusAction,
  ClosingBatchStatus,
} from '../domain/enums.js';
import {
  YearReopenApprovalRequiredError,
  FinancialYearNotReadyError,
  CloseChecklistBlockedError,
} from '../domain/errors.js';
import { loadCloseRun, createYearEndCloseRun } from './closeRunService.js';
import { reverseClosingJournals } from './closingReversalService.js';

export async function buildReopeningImpactAnalysis(db, context, financialYearId) {
  const fy = await db.acctV2FinancialYear.findFirst({
    where: { id: financialYearId, tenantId: context.businessId },
    include: { periods: true },
  });
  if (!fy) throw new FinancialYearNotReadyError('Financial year not found.');
  if (fy.status !== FinancialYearStatus.CLOSED && fy.status !== FinancialYearStatus.REOPENED) {
    throw new FinancialYearNotReadyError(`Financial year is ${fy.status}, not CLOSED.`);
  }

  const closeRun = await db.closeV2YearEndCloseRun.findFirst({
    where: {
      tenantId: context.businessId,
      financialYearId,
      status: YearEndCloseRunStatus.COMPLETED,
    },
    orderBy: { closeVersion: 'desc' },
    include: { batches: true, snapshots: true },
  });

  const postedBatch = closeRun?.batches?.find((b) => b.status === ClosingBatchStatus.POSTED);
  const nextYear = await db.acctV2FinancialYear.findFirst({
    where: {
      tenantId: context.businessId,
      startDate: { gt: fy.endDate },
    },
    orderBy: { startDate: 'asc' },
  });

  let nextYearJournalCount = 0;
  if (nextYear) {
    nextYearJournalCount = await db.journalEntry.count({
      where: {
        tenantId: context.businessId,
        entryDate: { gte: nextYear.startDate, lte: nextYear.endDate },
        status: { in: ['Posted', 'POSTED'] },
      },
    });
  }

  let riskLevel = 'LOW';
  if (nextYearJournalCount > 0) riskLevel = 'HIGH';
  if (nextYearJournalCount > 50 || Number(closeRun?.finalProfitOrLossMinor || 0) !== 0) {
    riskLevel = riskLevel === 'HIGH' ? 'CRITICAL' : 'HIGH';
  }

  return {
    financialYearId: fy.id,
    financialYearCode: fy.code,
    originalCloseVersion: closeRun?.closeVersion || null,
    closeRunId: closeRun?.id || null,
    closingJournalEntryId: postedBatch?.journalEntryId || null,
    closingBatchId: postedBatch?.id || null,
    retainedEarningsImpactMinor: String(closeRun?.finalProfitOrLossMinor ?? 0),
    snapshotCount: closeRun?.snapshots?.length || 0,
    snapshotsPreserved: true,
    originalClosePreserved: true,
    nextYear: nextYear ? { id: nextYear.id, code: nextYear.code, postedJournals: nextYearJournalCount } : null,
    riskLevel,
    requiresElevatedApproval: ['HIGH', 'CRITICAL'].includes(riskLevel),
    notes: [
      'Original close run, closing journals, and annual snapshots remain immutable.',
      'Closing journal reversal must be explicit after reopen approval.',
      'Re-close creates a new close version.',
    ],
  };
}

export async function requestYearReopen(db, context, { financialYearId, reason, expectedCorrections }) {
  if (!reason || String(reason).trim().length < 10) {
    throw new CloseChecklistBlockedError('Reopening requires a detailed reason (min 10 characters).');
  }
  const impact = await buildReopeningImpactAnalysis(db, context, financialYearId);
  const req = await db.closeV2YearReopenRequest.create({
    data: {
      tenantId: context.businessId,
      financialYearId,
      closeRunId: impact.closeRunId,
      reason: String(reason).trim(),
      expectedCorrections: expectedCorrections || null,
      status: 'PENDING',
      impactAnalysis: impact,
      riskLevel: impact.riskLevel,
      requestedBy: context.userId,
      requestId: context.requestId || null,
      correlationId: context.correlationId || null,
    },
  });

  if (impact.closeRunId) {
    await db.closeV2YearEndCloseRun.update({
      where: { id: impact.closeRunId },
      data: { status: YearEndCloseRunStatus.REOPEN_REQUESTED },
    });
  }

  return req;
}

export async function approveYearReopen(db, context, requestId) {
  const req = await db.closeV2YearReopenRequest.findFirst({
    where: { id: requestId, tenantId: context.businessId },
  });
  if (!req) throw new CloseChecklistBlockedError('Reopen request not found.');
  if (req.status !== 'PENDING') throw new CloseChecklistBlockedError(`Request is ${req.status}.`);
  if (req.requestedBy === context.userId) {
    throw new YearReopenApprovalRequiredError('Requester cannot approve their own reopening.');
  }

  return db.closeV2YearReopenRequest.update({
    where: { id: requestId },
    data: {
      status: 'APPROVED',
      approvedBy: context.userId,
      approvedAt: new Date(),
    },
  });
}

/**
 * Execute reopen: FY → REOPENED, prior close run remains COMPLETED (or marked with reopen marker),
 * create new close version scaffolding via createYearEndCloseRun after status update.
 */
export async function executeYearReopen(
  db,
  context,
  requestId,
  { reverseClosingJournals = false, hasPermission = null, postingDate = null } = {}
) {
  const options = { hasPermission, postingDate };
  const req = await db.closeV2YearReopenRequest.findFirst({
    where: { id: requestId, tenantId: context.businessId },
  });
  if (!req) throw new CloseChecklistBlockedError('Reopen request not found.');
  if (req.status !== 'APPROVED') {
    throw new YearReopenApprovalRequiredError('Reopening is not approved.');
  }

  const fy = await db.acctV2FinancialYear.findFirst({
    where: { id: req.financialYearId, tenantId: context.businessId },
  });

  await db.$transaction(async (tx) => {
    await tx.acctV2FinancialYear.update({
      where: { id: fy.id },
      data: {
        status: FinancialYearStatus.REOPENED,
        reopenedBy: context.userId,
        reopenedAt: new Date(),
        reopenReason: req.reason,
      },
    });

    if (req.closeRunId) {
      // Keep COMPLETED history; mark reopen linkage in metadata — do not delete
      const prior = await tx.closeV2YearEndCloseRun.findUnique({ where: { id: req.closeRunId } });
      await tx.closeV2YearEndCloseRun.update({
        where: { id: req.closeRunId },
        data: {
          status: YearEndCloseRunStatus.SUPERSEDED,
          reopenedBy: context.userId,
          reopenedAt: new Date(),
          metadata: {
            ...(prior?.metadata || {}),
            supersededReason: 'YEAR_REOPENED',
            reopenRequestId: req.id,
            reverseClosingJournalsRequested: reverseClosingJournals,
          },
        },
      });
      await tx.closeV2CloseStatusHistory.create({
        data: {
          tenantId: context.businessId,
          financialYearId: fy.id,
          closeRunId: req.closeRunId,
          previousStatus: YearEndCloseRunStatus.COMPLETED,
          newStatus: YearEndCloseRunStatus.SUPERSEDED,
          action: CloseStatusAction.REOPEN,
          reason: req.reason,
          executedBy: context.userId,
        },
      });
    }

    await tx.closeV2YearReopenRequest.update({
      where: { id: requestId },
      data: { status: 'EXECUTED', executedAt: new Date() },
    });
  });

  // New close version for re-close workflow
  const newRun = await createYearEndCloseRun(db, context, { financialYearId: fy.id });

  let reversalResult = null;
  if (reverseClosingJournals && req.closeRunId) {
    try {
      reversalResult = await reverseClosingJournals(db, context, req.closeRunId, {
        reason: `Year reopen ${requestId}: ${req.reason}`,
        hasPermission: options.hasPermission,
        postingDate: options.postingDate || null,
      });
    } catch (err) {
      reversalResult = {
        error: String(err.message || err),
        note: 'Reopen succeeded; closing journal reversal failed and must be retried explicitly.',
      };
    }
  }

  await recordAccountingAudit(
    {
      action: 'closev2.financialYear.reopened',
      entityType: 'AcctV2FinancialYear',
      entityId: fy.id,
      userId: context.userId,
      tenantId: context.businessId,
      newValues: {
        reopenRequestId: requestId,
        newCloseRunId: newRun.id,
        reverseClosingJournals,
        reversalJournalEntryId: reversalResult?.reversal?.journalEntryId || null,
        priorSnapshotsPreserved: true,
      },
      requestId: context.requestId,
      correlationId: context.correlationId,
    },
    db
  );

  return {
    financialYearId: fy.id,
    status: FinancialYearStatus.REOPENED,
    newCloseRun: newRun,
    reverseClosingJournals,
    reversalResult,
    note: reverseClosingJournals
      ? 'Year reopened. Closing journal reversal attempted via Posting Engine; originals preserved.'
      : 'Year reopened. Post corrections, then re-close under the new close version.',
  };
}

export async function getCloseRun(db, context, closeRunId) {
  return loadCloseRun(db, context, closeRunId);
}
