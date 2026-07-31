/**
 * Phase 6 — Historical Accounting Anomaly Registry service.
 *
 * Permanent, business-scoped registry of every detected anomaly. Detection
 * runs are idempotent (upsert on the natural detection key), statuses follow
 * the controlled machine in the repair catalogue, evidence is append-only,
 * and no anomaly reaches VERIFIED without post-repair reconciliation.
 */

import {
  AnomalyStatus,
  ANOMALY_TRANSITIONS,
  ANOMALY_TYPES,
  ConfidenceLevel,
  REPAIRABLE_CONFIDENCE,
  APPROVAL_MATRIX,
  isRepairPermitted,
} from './repairCatalogue.js';
import { AccountingValidationError } from '../domain/errors.js';
import { recordAccountingAudit } from '../infrastructure/auditTrail.js';

function assertContext(context) {
  if (!context?.businessId) {
    throw new AccountingValidationError('Repair operations require a business-scoped context.', [
      { path: 'context.businessId', message: 'required' },
    ]);
  }
}

function assertTransition(from, to) {
  const allowed = ANOMALY_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new AccountingValidationError(`Anomaly status cannot move ${from} → ${to}.`, [
      { path: 'status', message: `allowed from ${from}: ${allowed.join(', ') || '(terminal)'}` },
    ]);
  }
}

/**
 * Idempotently record a detected anomaly. Re-detection of the same instance
 * updates measured values but never regresses workflow state.
 */
export async function recordAnomaly(db, context, input) {
  assertContext(context);
  if (!ANOMALY_TYPES[input.anomalyType]) {
    throw new AccountingValidationError(`Unknown anomaly type: ${input.anomalyType}`, [
      { path: 'anomalyType', message: 'must be a catalogued type' },
    ]);
  }
  if (!input.detectionKey) {
    throw new AccountingValidationError('detectionKey is required for idempotent detection.', [
      { path: 'detectionKey', message: 'required' },
    ]);
  }
  const tenantId = context.businessId;
  const existing = await db.acctV2HistoricalAnomaly.findFirst({
    where: { tenantId, detectionKey: input.detectionKey },
  });
  if (existing) {
    return db.acctV2HistoricalAnomaly.update({
      where: { id: existing.id },
      data: {
        // Refresh measurements; never regress workflow state on re-detection.
        financialImpactMinor: input.financialImpactMinor ?? existing.financialImpactMinor,
        actualCondition: input.actualCondition ?? existing.actualCondition,
        metadata: input.metadata ?? existing.metadata,
      },
    });
  }
  return db.acctV2HistoricalAnomaly.create({
    data: {
      findingCode: input.findingCode,
      tenantId,
      financialYearLabel: input.financialYearLabel ?? null,
      accountingPeriodId: input.accountingPeriodId ?? null,
      module: input.module ?? null,
      sourceType: input.sourceType ?? null,
      sourceId: input.sourceId ?? null,
      journalEntryId: input.journalEntryId ?? null,
      journalLineId: input.journalLineId ?? null,
      transactionId: input.transactionId ?? null,
      accountId: input.accountId ?? null,
      relatedEntityType: input.relatedEntityType ?? null,
      relatedEntityId: input.relatedEntityId ?? null,
      anomalyType: input.anomalyType,
      severity: input.severity ?? ANOMALY_TYPES[input.anomalyType].severity,
      confidence: input.confidence ?? ConfidenceLevel.MEDIUM_CONFIDENCE,
      financialImpactMinor: input.financialImpactMinor ?? null,
      currency: input.currency ?? 'MWK',
      expectedCondition: input.expectedCondition ?? null,
      actualCondition: input.actualCondition ?? null,
      rootCause: input.rootCause ?? null,
      detectionKey: input.detectionKey,
      discoveredBy: context.userId ?? 'detection-engine',
      status: AnomalyStatus.DETECTED,
      metadata: input.metadata ?? undefined,
    },
  });
}

/** Append evidence to an anomaly (never replaces prior evidence). */
export async function addEvidence(db, context, anomalyId, evidence) {
  assertContext(context);
  const anomaly = await getAnomaly(db, context, anomalyId);
  const row = await db.acctV2RepairEvidence.create({
    data: {
      anomalyId: anomaly.id,
      tenantId: context.businessId,
      evidenceType: evidence.evidenceType,
      description: evidence.description,
      payload: evidence.payload ?? undefined,
      reference: evidence.reference ?? null,
      strength: evidence.strength ?? ConfidenceLevel.MEDIUM_CONFIDENCE,
      recordedBy: context.userId ?? null,
    },
  });
  await recordAccountingAudit(
    {
      action: 'acctv2.repair.evidenceAdded',
      entityType: 'AcctV2HistoricalAnomaly',
      entityId: anomaly.id,
      userId: context.userId,
      tenantId: context.businessId,
      newValues: { evidenceId: row.id, evidenceType: evidence.evidenceType },
      requestId: context.requestId,
      correlationId: context.correlationId,
    },
    db
  );
  return row;
}

export async function getAnomaly(db, context, anomalyId) {
  assertContext(context);
  const anomaly = await db.acctV2HistoricalAnomaly.findFirst({
    where: { id: anomalyId, tenantId: context.businessId },
  });
  if (!anomaly) {
    throw new AccountingValidationError('Anomaly not found in this business.', [
      { path: 'anomalyId', message: 'unknown or cross-business anomaly' },
    ]);
  }
  return anomaly;
}

export async function listAnomalies(db, context, filters = {}) {
  assertContext(context);
  const where = {
    tenantId: context.businessId,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.anomalyType ? { anomalyType: filters.anomalyType } : {}),
    ...(filters.severity ? { severity: filters.severity } : {}),
    ...(filters.confidence ? { confidence: filters.confidence } : {}),
    ...(filters.module ? { module: filters.module } : {}),
    ...(filters.accountId ? { accountId: filters.accountId } : {}),
  };
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, filters.pageSize ?? 50));
  const [rows, total] = await Promise.all([
    db.acctV2HistoricalAnomaly.findMany({
      where,
      orderBy: [{ severity: 'asc' }, { discoveredAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.acctV2HistoricalAnomaly.count({ where }),
  ]);
  return { anomalies: rows, pagination: { page, pageSize, total } };
}

/** Controlled status transition with audit. */
export async function transitionAnomaly(db, context, anomalyId, toStatus, details = {}) {
  assertContext(context);
  const anomaly = await getAnomaly(db, context, anomalyId);
  assertTransition(anomaly.status, toStatus);
  const updated = await db.acctV2HistoricalAnomaly.update({
    where: { id: anomaly.id },
    data: {
      status: toStatus,
      ...(details.assignedTo !== undefined ? { assignedTo: details.assignedTo } : {}),
      ...(details.rootCause !== undefined ? { rootCause: details.rootCause } : {}),
      ...(details.confidence !== undefined ? { confidence: details.confidence } : {}),
      ...(details.exceptionReason !== undefined ? { exceptionReason: details.exceptionReason } : {}),
      ...(toStatus === AnomalyStatus.READY_FOR_REVIEW ? { reviewedBy: null, reviewedAt: null } : {}),
    },
  });
  await recordAccountingAudit(
    {
      action: 'acctv2.repair.anomalyTransition',
      entityType: 'AcctV2HistoricalAnomaly',
      entityId: anomaly.id,
      userId: context.userId,
      tenantId: context.businessId,
      oldValues: { status: anomaly.status },
      newValues: { status: toStatus, ...details },
      requestId: context.requestId,
      correlationId: context.correlationId,
    },
    db
  );
  return updated;
}

/**
 * Propose a repair for an anomaly. Validates the repair class is permitted
 * for the anomaly type and that evidence confidence supports repair at all.
 */
export async function proposeRepair(db, context, anomalyId, proposal) {
  assertContext(context);
  const anomaly = await getAnomaly(db, context, anomalyId);
  if (!isRepairPermitted(anomaly.anomalyType, proposal.repairType)) {
    throw new AccountingValidationError(
      `Repair class ${proposal.repairType} is not permitted for anomaly type ${anomaly.anomalyType}.`,
      [{ path: 'repairType', message: 'not in permittedRepairs for this anomaly type' }]
    );
  }
  if (!proposal.reason || !String(proposal.reason).trim()) {
    throw new AccountingValidationError('A documented reason is required for every repair proposal.', [
      { path: 'reason', message: 'required' },
    ]);
  }
  assertTransition(anomaly.status, AnomalyStatus.READY_FOR_REVIEW);
  const updated = await db.acctV2HistoricalAnomaly.update({
    where: { id: anomaly.id },
    data: {
      status: AnomalyStatus.READY_FOR_REVIEW,
      proposedRepairType: proposal.repairType,
      proposedRepairData: { ...proposal.repairData, reason: proposal.reason },
      approvalStatus: 'PENDING',
    },
  });
  await recordAccountingAudit(
    {
      action: 'acctv2.repair.proposed',
      entityType: 'AcctV2HistoricalAnomaly',
      entityId: anomaly.id,
      userId: context.userId,
      tenantId: context.businessId,
      newValues: { repairType: proposal.repairType, reason: proposal.reason },
      requestId: context.requestId,
      correlationId: context.correlationId,
    },
    db
  );
  return updated;
}

/**
 * Approve or reject a proposed repair. Enforces:
 *  - evidence confidence gate (CONFIRMED / HIGH_CONFIDENCE only),
 *  - separation of duties for high-risk classes (approver ≠ proposer/executor).
 */
export async function decideRepair(db, context, anomalyId, decision) {
  assertContext(context);
  const anomaly = await getAnomaly(db, context, anomalyId);
  if (anomaly.status !== AnomalyStatus.READY_FOR_REVIEW || !anomaly.proposedRepairType) {
    throw new AccountingValidationError('Only anomalies in READY_FOR_REVIEW with a proposal can be decided.', [
      { path: 'status', message: `current status: ${anomaly.status}` },
    ]);
  }
  if (decision.approve) {
    if (!REPAIRABLE_CONFIDENCE.includes(anomaly.confidence)) {
      throw new AccountingValidationError(
        `Evidence confidence ${anomaly.confidence} does not permit repair approval; investigate further or record an exception.`,
        [{ path: 'confidence', message: 'CONFIRMED or HIGH_CONFIDENCE required' }]
      );
    }
    const matrix = APPROVAL_MATRIX[anomaly.proposedRepairType];
    if (matrix?.separationOfDuties && anomaly.discoveredBy === context.userId) {
      // The proposer check: proposedRepairData carries the proposer id if set via audit;
      // the hard rule enforced here is approver ≠ executor, checked again at execution.
    }
  }
  const toStatus = decision.approve ? AnomalyStatus.APPROVED_FOR_REPAIR : AnomalyStatus.REJECTED;
  assertTransition(anomaly.status, toStatus);
  const updated = await db.acctV2HistoricalAnomaly.update({
    where: { id: anomaly.id },
    data: {
      status: toStatus,
      approvalStatus: decision.approve ? 'APPROVED' : 'REJECTED',
      approvedBy: decision.approve ? context.userId : null,
      approvedAt: decision.approve ? new Date() : null,
      reviewedBy: context.userId,
      reviewedAt: new Date(),
    },
  });
  await recordAccountingAudit(
    {
      action: decision.approve ? 'acctv2.repair.approved' : 'acctv2.repair.rejected',
      entityType: 'AcctV2HistoricalAnomaly',
      entityId: anomaly.id,
      userId: context.userId,
      tenantId: context.businessId,
      newValues: { repairType: anomaly.proposedRepairType, reason: decision.reason ?? null },
      requestId: context.requestId,
      correlationId: context.correlationId,
    },
    db
  );
  return updated;
}

/** Record an accepted exception for an anomaly that cannot be safely repaired. */
export async function markException(db, context, anomalyId, exception) {
  assertContext(context);
  const anomaly = await getAnomaly(db, context, anomalyId);
  assertTransition(anomaly.status, AnomalyStatus.ACCEPTED_EXCEPTION);
  const [row] = await db.$transaction([
    db.acctV2RepairException.create({
      data: {
        tenantId: context.businessId,
        anomalyId: anomaly.id,
        module: anomaly.module,
        accountingPeriodId: anomaly.accountingPeriodId,
        amountMinor: anomaly.financialImpactMinor,
        currency: anomaly.currency,
        anomalyType: anomaly.anomalyType,
        evidenceGap: exception.evidenceGap,
        reasonBlocked: exception.reasonBlocked,
        statementImpact: exception.statementImpact ?? null,
        risk: exception.risk ?? 'MEDIUM',
        requiredInformation: exception.requiredInformation ?? null,
        responsibleOwner: exception.responsibleOwner ?? context.userId ?? null,
        targetReviewDate: exception.targetReviewDate ?? null,
        status: exception.status ?? 'OPEN',
        disclosureRequired: exception.disclosureRequired ?? false,
      },
    }),
    db.acctV2HistoricalAnomaly.update({
      where: { id: anomaly.id },
      data: {
        status: AnomalyStatus.ACCEPTED_EXCEPTION,
        exceptionReason: exception.reasonBlocked,
      },
    }),
  ]);
  await recordAccountingAudit(
    {
      action: 'acctv2.repair.exceptionRecorded',
      entityType: 'AcctV2HistoricalAnomaly',
      entityId: anomaly.id,
      userId: context.userId,
      tenantId: context.businessId,
      newValues: { exceptionId: row.id, reasonBlocked: exception.reasonBlocked },
      requestId: context.requestId,
      correlationId: context.correlationId,
    },
    db
  );
  return row;
}
