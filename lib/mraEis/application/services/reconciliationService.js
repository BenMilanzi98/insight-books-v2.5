import prisma from '@/lib/prisma.js';
import {
  RECON_STATUS,
  RECON_TYPE,
  MANUAL_REVIEW_STATUS,
  EIS_OUTBOX_EVENT,
} from '../../domain/operationalEnums.js';
import { EisErrors } from '../../domain/errors.js';
import { assertTenantBusinessMatch } from '../../domain/valueObjects/index.js';
import { appendEisOutboxEvent } from '../../infrastructure/outbox/outboxService.js';
import { recordEisControlAudit } from '../../infrastructure/audit.js';

/**
 * Reconciliation never mutates Journals, Sales, or Stock.
 */
export async function createReconciliationRun({
  tenantId,
  businessId = tenantId,
  terminalId = null,
  type = RECON_TYPE.TRANSMISSION,
  initiatedBy,
  initiationSource = 'MANUAL',
  dateFrom = null,
  dateTo = null,
  correlationId = null,
  requestId = null,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  if (!Object.values(RECON_TYPE).includes(type)) {
    throw EisErrors.validation({ message: 'Invalid reconciliation type.' });
  }

  const run = await db.mraEisReconciliationRun.create({
    data: {
      tenantId,
      businessId,
      terminalId,
      type,
      status: RECON_STATUS.CREATED,
      dateFrom,
      dateTo,
      initiatedBy,
      initiationSource,
      recordsExamined: 0,
      differencesFound: 0,
      criticalDifferences: 0,
      highDifferences: 0,
      correlationId,
      requestId,
      version: 1,
    },
  });

  await appendEisOutboxEvent({
    tenantId,
    businessId,
    aggregateType: 'MraEisReconciliationRun',
    aggregateId: run.id,
    eventType: EIS_OUTBOX_EVENT.RECONCILIATION_REQUESTED,
    payload: { runId: run.id, type, initiationSource },
    idempotencyKey: `recon-created:${run.id}`,
    db,
  });

  await recordEisControlAudit({
    tenantId,
    businessId,
    actorId: initiatedBy,
    actorType: 'SERVICE',
    action: 'RECONCILIATION_RUN_CREATED',
    resourceType: 'MraEisReconciliationRun',
    resourceId: run.id,
    newStatus: run.status,
  }, db);

  return run;
}

export async function appendReconciliationDifference({
  tenantId,
  businessId = tenantId,
  reconciliationRunId,
  differenceType,
  severity = 'MEDIUM',
  description,
  terminalId = null,
  snapshotId = null,
  transmissionId = null,
  localValue = null,
  externalValue = null,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const run = await db.mraEisReconciliationRun.findFirst({
    where: { id: reconciliationRunId, tenantId, businessId },
  });
  if (!run) {
    throw EisErrors.reconciliationScope({
      tenantId,
      businessId,
      message: 'Reconciliation run not found in business scope.',
    });
  }
  if (
    [
      RECON_STATUS.COMPLETED,
      RECON_STATUS.COMPLETED_WITH_DIFFERENCES,
      RECON_STATUS.CANCELLED,
    ].includes(run.status)
  ) {
    throw EisErrors.validation({ message: 'Completed reconciliation run is immutable.' });
  }

  const diff = await db.mraEisReconciliationDifference.create({
    data: {
      tenantId,
      businessId,
      reconciliationRunId,
      terminalId,
      snapshotId,
      transmissionId,
      differenceType,
      severity,
      description,
      localValue,
      externalValue,
      status: 'OPEN',
    },
  });

  await db.mraEisReconciliationRun.update({
    where: { id: run.id },
    data: {
      differencesFound: { increment: 1 },
      criticalDifferences: severity === 'CRITICAL' ? { increment: 1 } : undefined,
      highDifferences: severity === 'HIGH' ? { increment: 1 } : undefined,
      version: { increment: 1 },
    },
  });

  return diff;
}

export async function openManualReviewCase({
  tenantId,
  businessId = tenantId,
  caseType,
  severity = 'HIGH',
  sourceEntityType,
  sourceEntityId,
  title,
  description,
  openedBy,
  terminalId = null,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const row = await db.mraEisManualReviewCase.create({
    data: {
      tenantId,
      businessId,
      terminalId,
      caseType,
      status: MANUAL_REVIEW_STATUS.OPEN,
      severity,
      sourceEntityType,
      sourceEntityId,
      title,
      description,
      openedBy,
      openedAt: new Date(),
      version: 1,
    },
  });

  await appendEisOutboxEvent({
    tenantId,
    businessId,
    aggregateType: 'MraEisManualReviewCase',
    aggregateId: row.id,
    eventType: EIS_OUTBOX_EVENT.MANUAL_REVIEW_OPENED,
    payload: { caseId: row.id, caseType, sourceEntityType, sourceEntityId },
    idempotencyKey: `manual-review:${row.id}`,
    db,
  });

  return row;
}

export async function createSyncRun({
  tenantId,
  businessId = tenantId,
  syncType,
  environment,
  requestedBy,
  terminalId = null,
  idempotencyKey,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  if (!idempotencyKey) throw EisErrors.validation({ message: 'idempotencyKey required.' });

  try {
    return await db.mraEisSyncRun.create({
      data: {
        tenantId,
        businessId,
        terminalId,
        syncType,
        environment,
        status: 'CREATED',
        requestedAt: new Date(),
        requestedBy,
        recordsReceived: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        recordsUnchanged: 0,
        recordsRejected: 0,
        warnings: [],
        idempotencyKey,
        version: 1,
      },
    });
  } catch (err) {
    if (err?.code === 'P2002') {
      const existing = await db.mraEisSyncRun.findFirst({ where: { idempotencyKey } });
      if (
        existing &&
        (existing.tenantId !== tenantId ||
          existing.businessId !== businessId ||
          existing.syncType !== syncType)
      ) {
        throw EisErrors.idempotencyConflict({
          tenantId,
          businessId,
          message: 'Sync idempotency key reused with different scope.',
        });
      }
      return existing;
    }
    throw err;
  }
}
