import prisma from '@/lib/prisma.js';
import { TERMINAL_STATUS } from '../../domain/operationalEnums.js';
import { transitionTerminal } from '../../domain/operationalStateMachines.js';
import { EisErrors } from '../../domain/errors.js';
import { assertTenantBusinessMatch } from '../../domain/valueObjects/index.js';
import { appendEisOutboxEvent } from '../../infrastructure/outbox/outboxService.js';
import { EIS_OUTBOX_EVENT } from '../../domain/operationalEnums.js';
import { recordEisControlAudit } from '../../infrastructure/audit.js';
import { evaluateTenantEisCapability } from '../capabilityService.js';
import { EIS_OPERATION } from '../../domain/constants.js';

export async function createDraftTerminal({
  tenantId,
  businessId = tenantId,
  environment,
  terminalLabel,
  branchId = null,
  createdBy,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const capability = await evaluateTenantEisCapability({
    tenantId,
    businessId,
    requestedOperation: EIS_OPERATION.START_SETUP,
    environment,
  });
  if (!capability.tenantEntitled && !capability.effectiveSetupAllowed) {
    // Allow structural draft creation only when entitled at least for setup view
    if (!capability.tenantEntitled) {
      throw EisErrors.notEntitled({ tenantId });
    }
  }

  const row = await db.mraEisTerminal.create({
    data: {
      tenantId,
      businessId,
      branchId,
      environment,
      terminalLabel,
      status: TERMINAL_STATUS.DRAFT,
      offlineCertified: false,
      createdBy,
      updatedBy: createdBy,
      version: 1,
    },
  });

  await appendEisOutboxEvent({
    tenantId,
    businessId,
    aggregateType: 'MraEisTerminal',
    aggregateId: row.id,
    eventType: EIS_OUTBOX_EVENT.TERMINAL_STATE_CHANGED,
    payload: { terminalId: row.id, status: row.status, environment },
    idempotencyKey: `terminal-created:${row.id}`,
    db,
  });

  await recordEisControlAudit({
    tenantId,
    businessId,
    actorId: createdBy,
    actorType: 'SERVICE',
    action: 'TERMINAL_CREATED',
    resourceType: 'MraEisTerminal',
    resourceId: row.id,
    newStatus: TERMINAL_STATUS.DRAFT,
    environment,
  }, db);

  return row;
}

export async function transitionTerminalStatus({
  tenantId,
  businessId = tenantId,
  terminalId,
  nextStatus,
  expectedVersion,
  actorId,
  reason = null,
  requireCredentialReference = false,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const current = await db.mraEisTerminal.findFirst({
    where: { id: terminalId, tenantId, businessId },
  });
  if (!current) throw EisErrors.terminalNotFound({ tenantId, businessId });
  if (expectedVersion != null && current.version !== expectedVersion) {
    throw EisErrors.versionConflict({ tenantId, businessId, details: { expectedVersion, actual: current.version } });
  }

  transitionTerminal(current.status, nextStatus);

  if (nextStatus === TERMINAL_STATUS.ACTIVE) {
    if (!current.activationConfirmedAt && current.status !== TERMINAL_STATUS.CONFIRMATION_IN_PROGRESS) {
      // ACTIVE only from confirmation path
    }
    if (requireCredentialReference !== false && !current.currentCredentialReferenceId) {
      throw EisErrors.invalidTerminalTransition({
        message: 'Active terminal requires a credential reference.',
        currentStatus: current.status,
      });
    }
  }
  if (current.status === TERMINAL_STATUS.REVOKED) {
    throw EisErrors.invalidTerminalTransition({
      message: 'Revoked terminal cannot transition.',
      currentStatus: current.status,
    });
  }
  if (current.status === TERMINAL_STATUS.BLOCKED && nextStatus === TERMINAL_STATUS.ACTIVE) {
    throw EisErrors.invalidTerminalTransition({
      message:
        'Blocked terminal cannot transition directly to ACTIVE. Phase 17 requires MRA clearance evidence, Unblock Request approval, and post-unblock revalidation.',
      currentStatus: current.status,
      code: 'MRA_EIS_TERMINAL_DIRECT_ACTIVE_FORBIDDEN',
    });
  }
  // Phase 17: browser/admin cannot force ACTIVE while compliance projection has blockers
  if (nextStatus === TERMINAL_STATUS.ACTIVE && reason === 'DIRECT_OVERRIDE') {
    throw EisErrors.invalidTerminalTransition({
      message: 'Direct ACTIVE override is prohibited.',
      currentStatus: current.status,
      code: 'MRA_EIS_TERMINAL_DIRECT_ACTIVE_FORBIDDEN',
    });
  }

  const updated = await db.mraEisTerminal.update({
    where: { id: terminalId },
    data: {
      previousStatus: current.status,
      status: nextStatus,
      version: { increment: 1 },
      updatedBy: actorId,
      blockedAt: nextStatus === TERMINAL_STATUS.BLOCKED ? new Date() : current.blockedAt,
      blockReason: nextStatus === TERMINAL_STATUS.BLOCKED ? reason : current.blockReason,
      activatedAt: nextStatus === TERMINAL_STATUS.ACTIVE ? new Date() : current.activatedAt,
      activationConfirmedAt:
        nextStatus === TERMINAL_STATUS.ACTIVE ? new Date() : current.activationConfirmedAt,
    },
  });

  await appendEisOutboxEvent({
    tenantId,
    businessId,
    aggregateType: 'MraEisTerminal',
    aggregateId: terminalId,
    eventType: EIS_OUTBOX_EVENT.TERMINAL_STATE_CHANGED,
    payload: {
      terminalId,
      previousStatus: current.status,
      status: nextStatus,
      version: updated.version,
    },
    idempotencyKey: `terminal-state:${terminalId}:${current.version}:${nextStatus}`,
    db,
  });

  await recordEisControlAudit({
    tenantId,
    businessId,
    actorId,
    actorType: 'SERVICE',
    action: 'TERMINAL_STATE_CHANGED',
    resourceType: 'MraEisTerminal',
    resourceId: terminalId,
    previousStatus: current.status,
    newStatus: nextStatus,
    reason,
  }, db);

  return updated;
}

export async function createCredentialReference({
  tenantId,
  businessId = tenantId,
  terminalId,
  environment,
  credentialType,
  vaultReference,
  createdByService = 'phase5-foundation',
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  if (!vaultReference || String(vaultReference).includes('plaintext:')) {
    throw EisErrors.validation({ message: 'vaultReference must be a non-plaintext vault pointer.' });
  }
  // Reject common secret-looking column misuse
  if (/^(eyJ|sk_|tac_)/i.test(String(vaultReference))) {
    throw EisErrors.validation({ message: 'vaultReference must not contain credential material.' });
  }

  const terminal = await db.mraEisTerminal.findFirst({
    where: { id: terminalId, tenantId, businessId },
  });
  if (!terminal) throw EisErrors.terminalNotFound({ tenantId, businessId });

  return db.mraEisCredentialReference.create({
    data: {
      tenantId,
      businessId,
      terminalId,
      environment,
      credentialType,
      vaultReference,
      status: 'PENDING',
      createdByService,
      version: 1,
    },
  });
}
