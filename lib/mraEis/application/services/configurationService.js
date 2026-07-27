import prisma from '@/lib/prisma.js';
import {
  CONFIGURATION_STATUS,
  CONFIGURATION_TYPE,
  EIS_OUTBOX_EVENT,
} from '../../domain/operationalEnums.js';
import { transitionConfiguration } from '../../domain/operationalStateMachines.js';
import { EisErrors } from '../../domain/errors.js';
import {
  assertTenantBusinessMatch,
  createChecksum,
} from '../../domain/valueObjects/index.js';
import { appendEisOutboxEvent } from '../../infrastructure/outbox/outboxService.js';
import { recordEisControlAudit } from '../../infrastructure/audit.js';

/**
 * Store immutable configuration snapshot (synthetic/safe data only in Phase 5).
 * Same version + checksum → return existing. Same version + different checksum → conflict.
 */
export async function storeConfigurationSnapshot({
  tenantId,
  businessId = tenantId,
  terminalId,
  environment,
  configurationType = CONFIGURATION_TYPE.TERMINAL,
  mraVersion,
  canonicalData,
  createdByService = 'phase5-config-service',
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  if (!Object.values(CONFIGURATION_TYPE).includes(configurationType)) {
    throw EisErrors.validation({ message: 'Invalid configuration type.' });
  }

  const sourceChecksum = createChecksum(canonicalData).value;
  const existing = await db.mraEisConfigurationSnapshot.findUnique({
    where: {
      terminalId_configurationType_mraVersion: {
        terminalId,
        configurationType,
        mraVersion,
      },
    },
  });

  if (existing) {
    if (existing.tenantId !== tenantId || existing.businessId !== businessId) {
      throw EisErrors.crossTenant({ tenantId, businessId });
    }
    if (existing.sourceChecksum === sourceChecksum) return existing;
    throw EisErrors.configurationVersionConflict({
      tenantId,
      businessId,
      message: 'Configuration version exists with a different checksum.',
      details: { terminalId, configurationType, mraVersion },
    });
  }

  const terminal = await db.mraEisTerminal.findFirst({
    where: { id: terminalId, tenantId, businessId },
  });
  if (!terminal) throw EisErrors.terminalNotFound({ tenantId, businessId });

  const row = await db.mraEisConfigurationSnapshot.create({
    data: {
      tenantId,
      businessId,
      terminalId,
      environment,
      configurationType,
      mraVersion,
      status: CONFIGURATION_STATUS.RECEIVED,
      canonicalData,
      sourceChecksum,
      createdByService,
    },
  });

  await recordEisControlAudit({
    tenantId,
    businessId,
    actorType: 'SERVICE',
    action: 'CONFIGURATION_SNAPSHOT_STORED',
    resourceType: 'MraEisConfigurationSnapshot',
    resourceId: row.id,
    newStatus: row.status,
    environment,
  }, db);

  return row;
}

export async function markConfigurationValid({
  tenantId,
  businessId = tenantId,
  snapshotId,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const snap = await db.mraEisConfigurationSnapshot.findFirst({
    where: { id: snapshotId, tenantId, businessId },
  });
  if (!snap) throw EisErrors.validation({ message: 'Configuration snapshot not found.', httpStatus: 404 });

  transitionConfiguration(snap.status, CONFIGURATION_STATUS.VALIDATING);
  await db.mraEisConfigurationSnapshot.update({
    where: { id: snap.id },
    data: { status: CONFIGURATION_STATUS.VALIDATING },
  });
  transitionConfiguration(CONFIGURATION_STATUS.VALIDATING, CONFIGURATION_STATUS.VALID);
  return db.mraEisConfigurationSnapshot.update({
    where: { id: snap.id },
    data: { status: CONFIGURATION_STATUS.VALID, validatedAt: new Date() },
  });
}

async function activateConfigurationSnapshotInner({
  tenantId,
  businessId,
  snapshotId,
  activatedBy,
  reason,
  correlationId,
  requestId,
  tx,
}) {
  const snap = await tx.mraEisConfigurationSnapshot.findFirst({
    where: { id: snapshotId, tenantId, businessId },
  });
  if (!snap) throw EisErrors.validation({ message: 'Configuration snapshot not found.', httpStatus: 404 });
  if (snap.status === CONFIGURATION_STATUS.INVALID || snap.status === CONFIGURATION_STATUS.REJECTED) {
    throw EisErrors.validation({ message: 'Invalid configuration cannot activate.' });
  }
  if (snap.status === CONFIGURATION_STATUS.ACTIVE) {
    return snap;
  }
  if (
    ![
      CONFIGURATION_STATUS.RECEIVED,
      CONFIGURATION_STATUS.VALIDATING,
      CONFIGURATION_STATUS.VALID,
    ].includes(snap.status)
  ) {
    throw EisErrors.configurationActivationConflict({
      tenantId,
      businessId,
      message: `Cannot activate configuration in status ${snap.status}.`,
    });
  }

  let status = snap.status;
  if (status === CONFIGURATION_STATUS.RECEIVED) {
    transitionConfiguration(status, CONFIGURATION_STATUS.VALIDATING);
    status = CONFIGURATION_STATUS.VALIDATING;
  }
  if (status === CONFIGURATION_STATUS.VALIDATING) {
    transitionConfiguration(status, CONFIGURATION_STATUS.VALID);
    status = CONFIGURATION_STATUS.VALID;
  }

  const previous = await tx.mraEisConfigurationSnapshot.findFirst({
    where: {
      terminalId: snap.terminalId,
      configurationType: snap.configurationType,
      status: CONFIGURATION_STATUS.ACTIVE,
      NOT: { id: snap.id },
    },
  });

  if (previous) {
    await tx.mraEisConfigurationSnapshot.update({
      where: { id: previous.id },
      data: { status: CONFIGURATION_STATUS.SUPERSEDED, supersededAt: new Date() },
    });
  }

  transitionConfiguration(status, CONFIGURATION_STATUS.ACTIVE);

  const activated = await tx.mraEisConfigurationSnapshot.update({
    where: { id: snap.id },
    data: {
      status: CONFIGURATION_STATUS.ACTIVE,
      validatedAt: snap.validatedAt || new Date(),
      activatedAt: new Date(),
    },
  });

  await tx.mraEisConfigurationActivation.create({
    data: {
      tenantId,
      businessId,
      terminalId: snap.terminalId,
      configurationType: snap.configurationType,
      previousSnapshotId: previous?.id ?? null,
      activatedSnapshotId: activated.id,
      reason,
      activatedBy,
      correlationId,
      requestId,
    },
  });

  const terminalField =
    snap.configurationType === CONFIGURATION_TYPE.GLOBAL
      ? 'activeGlobalConfigurationSnapshotId'
      : snap.configurationType === CONFIGURATION_TYPE.TAXPAYER
        ? 'activeTaxpayerConfigurationSnapshotId'
        : 'activeTerminalConfigurationSnapshotId';

  await tx.mraEisTerminal.updateMany({
    where: { id: snap.terminalId, tenantId, businessId },
    data: { [terminalField]: activated.id, lastConfigurationSyncAt: new Date() },
  });

  await appendEisOutboxEvent({
    tenantId,
    businessId,
    aggregateType: 'MraEisConfigurationSnapshot',
    aggregateId: activated.id,
    eventType: EIS_OUTBOX_EVENT.CONFIGURATION_ACTIVATED,
    payload: {
      snapshotId: activated.id,
      terminalId: snap.terminalId,
      configurationType: snap.configurationType,
      mraVersion: snap.mraVersion,
    },
    idempotencyKey: `config-activated:${activated.id}`,
    db: tx,
  });

  await recordEisControlAudit({
    tenantId,
    businessId,
    actorId: activatedBy,
    actorType: 'SERVICE',
    action: 'CONFIGURATION_ACTIVATED',
    resourceType: 'MraEisConfigurationSnapshot',
    resourceId: activated.id,
    previousStatus: previous?.status ?? null,
    newStatus: CONFIGURATION_STATUS.ACTIVE,
    environment: snap.environment,
  }, tx);

  return activated;
}

/**
 * Activate one snapshot per terminal+type transactionally; supersede prior ACTIVE.
 * Pass `db` as an interactive transaction client to participate in an outer transaction.
 */
export async function activateConfigurationSnapshot({
  tenantId,
  businessId = tenantId,
  snapshotId,
  activatedBy,
  reason = null,
  correlationId = null,
  requestId = null,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const args = { tenantId, businessId, snapshotId, activatedBy, reason, correlationId, requestId };

  if (typeof db.$transaction === 'function') {
    return db.$transaction(async (tx) => activateConfigurationSnapshotInner({ ...args, tx }));
  }
  return activateConfigurationSnapshotInner({ ...args, tx: db });
}
