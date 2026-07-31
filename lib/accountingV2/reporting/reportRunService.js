/**
 * Phase 7 — report runs, review/approval workflow (§50) and immutable
 * snapshots (§51).
 *
 * GENERATED → REVIEWED → APPROVED → SUPERSEDED. Approval is metadata only —
 * it can never alter accounting journals. UNVERIFIED and BLOCKED reports
 * cannot be approved as accurate (§49). Snapshots are immutable: superseding
 * creates a new version and marks the old one superseded with a reason.
 */

import crypto from 'node:crypto';
import { AccountingValidationError } from '../domain/errors.js';
import { REPORT_RUN_STATUS, REPORT_INTEGRITY_STATUS } from './reportContracts.js';

/**
 * Cheap accounting-data version for a business: counts and latest timestamps
 * over the canonical journal stores. Any posting, reversal or repair changes
 * it, which invalidates caches and dates report runs.
 */
export async function getAccountingDataVersion(db, context) {
  const tenantId = context.businessId;
  const [txCount, jeCount, lastTx, lastJe] = await Promise.all([
    db.transaction.count({ where: { tenantId } }),
    db.journalEntry.count({ where: { tenantId } }),
    db.transaction.findFirst({ where: { tenantId }, orderBy: { createdAt: 'desc' } }),
    db.journalEntry.findFirst({ where: { tenantId }, orderBy: { createdAt: 'desc' } }),
  ]);
  const stamp = (row) => (row?.createdAt ? new Date(row.createdAt).getTime() : 0);
  return `tx${txCount}:je${jeCount}:${Math.max(stamp(lastTx), stamp(lastJe))}`;
}

/** Persist a generated report envelope as an auditable run record. */
export async function recordReportRun(db, context, envelope, request) {
  const accountingDataVersion = await getAccountingDataVersion(db, context);
  const run = await db.acctV2ReportRun.create({
    data: {
      tenantId: context.businessId,
      reportType: envelope.reportType,
      definitionId: envelope.definitionId,
      definitionVersion: envelope.definitionVersion,
      filters: JSON.parse(JSON.stringify({
        fromDate: request.fromDate ?? null,
        toDate: request.toDate ?? null,
        asOfDate: request.asOfDate ?? null,
        branchId: request.branchId ?? null,
        comparison: request.comparison ?? null,
        includeZeroBalances: request.includeZeroBalances,
      })),
      filtersHash: envelope.filtersHash,
      status: REPORT_RUN_STATUS.GENERATED,
      integrityStatus: envelope.integrityStatus,
      trialBalanceStatus: envelope.trialBalanceStatus ?? null,
      integrityWarnings: envelope.integrityWarnings ?? [],
      totals: envelope.totals ?? null,
      resultChecksum: envelope.resultChecksum,
      accountingDataVersion,
      generatedBy: context.userId,
      requestId: envelope.requestId,
      correlationId: envelope.correlationId,
    },
  });
  return run;
}

async function loadRun(db, context, runId) {
  const run = await db.acctV2ReportRun.findFirst({
    where: { id: runId, tenantId: context.businessId },
  });
  if (!run) {
    throw new AccountingValidationError('Report run not found in this business.');
  }
  return run;
}

/** Mark a run reviewed. Requires the run to be GENERATED. */
export async function reviewReportRun(db, context, runId, { comment = null } = {}) {
  const run = await loadRun(db, context, runId);
  if (run.status !== REPORT_RUN_STATUS.GENERATED) {
    throw new AccountingValidationError(`Cannot review a run in status ${run.status}.`);
  }
  return db.acctV2ReportRun.update({
    where: { id: run.id },
    data: {
      status: REPORT_RUN_STATUS.REVIEWED,
      reviewedBy: context.userId,
      reviewedAt: new Date(),
      reviewComment: comment,
    },
  });
}

/**
 * Approve a run. Blocked when integrity is UNVERIFIED or BLOCKED — an
 * unbalanced or failing report can never be approved as accurate (§12/§49).
 */
export async function approveReportRun(db, context, runId, { comment = null } = {}) {
  const run = await loadRun(db, context, runId);
  if (run.status !== REPORT_RUN_STATUS.REVIEWED) {
    throw new AccountingValidationError(`Cannot approve a run in status ${run.status}; review first.`);
  }
  if (
    run.integrityStatus === REPORT_INTEGRITY_STATUS.UNVERIFIED ||
    run.integrityStatus === REPORT_INTEGRITY_STATUS.BLOCKED ||
    run.trialBalanceStatus === 'UNBALANCED' ||
    run.trialBalanceStatus === 'BLOCKED'
  ) {
    throw new AccountingValidationError(
      `Report integrity status ${run.trialBalanceStatus ?? run.integrityStatus} does not permit approval; resolve or formally accept the exceptions first.`
    );
  }
  return db.acctV2ReportRun.update({
    where: { id: run.id },
    data: {
      status: REPORT_RUN_STATUS.APPROVED,
      approvedBy: context.userId,
      approvedAt: new Date(),
      approvalComment: comment,
    },
  });
}

/**
 * Create an immutable snapshot of a run's full result payload. If an ACTIVE
 * snapshot already exists for the same scope, it is superseded (never mutated)
 * and a new version is created with the reason recorded (§51).
 */
export async function snapshotReport(db, context, runId, envelope, { reason = null } = {}) {
  const run = await loadRun(db, context, runId);
  if (envelope.resultChecksum !== run.resultChecksum) {
    throw new AccountingValidationError(
      'Snapshot payload does not match the recorded run result; regenerate before snapshotting.'
    );
  }
  // A previous ACTIVE snapshot of the same report scope (same filters hash)
  // is superseded by this new version.
  const activeSnapshots = await db.acctV2ReportSnapshotV2.findMany({
    where: { tenantId: context.businessId, reportType: run.reportType, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
  });
  let previous = null;
  let matchingPrevious = null;
  for (const candidate of activeSnapshots) {
    if (candidate.runId === run.id) continue;
    const candidateRun = await db.acctV2ReportRun.findFirst({
      where: { id: candidate.runId, tenantId: context.businessId, filtersHash: run.filtersHash },
    });
    if (candidateRun) {
      previous = candidate;
      matchingPrevious = candidateRun;
      break;
    }
  }

  const snapshot = await db.acctV2ReportSnapshotV2.create({
    data: {
      tenantId: context.businessId,
      runId: run.id,
      reportType: run.reportType,
      definitionVersion: run.definitionVersion,
      version: matchingPrevious ? (previous.version ?? 1) + 1 : 1,
      payload: JSON.parse(JSON.stringify(envelope)),
      checksum: crypto.createHash('sha256').update(JSON.stringify(envelope)).digest('hex'),
      accountingDataVersion: run.accountingDataVersion,
      integrityStatus: run.integrityStatus,
      status: 'ACTIVE',
      createdBy: context.userId,
    },
  });
  if (matchingPrevious) {
    await db.acctV2ReportSnapshotV2.update({
      where: { id: previous.id },
      data: {
        status: 'SUPERSEDED',
        supersededBySnapshotId: snapshot.id,
        supersededReason: reason ?? 'Superseded by a newer snapshot of the same report scope.',
      },
    });
    await db.acctV2ReportRun.update({
      where: { id: matchingPrevious.id },
      data: {
        status: REPORT_RUN_STATUS.SUPERSEDED,
        supersededByRunId: run.id,
        supersededReason: reason ?? 'Superseded by a newer approved run.',
      },
    });
  }
  return snapshot;
}

/** List runs for the business (audit surface). */
export async function listReportRuns(db, context, { reportType = null, page = 1, pageSize = 50 } = {}) {
  const where = {
    tenantId: context.businessId,
    ...(reportType ? { reportType } : {}),
  };
  const [rows, total] = await Promise.all([
    db.acctV2ReportRun.findMany({
      where,
      orderBy: { generatedAt: 'desc' },
      skip: (Math.max(1, page) - 1) * pageSize,
      take: Math.min(200, pageSize),
    }),
    db.acctV2ReportRun.count({ where }),
  ]);
  return { runs: rows, total, page, pageSize };
}
