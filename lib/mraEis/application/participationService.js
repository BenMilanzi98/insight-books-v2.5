import prisma from '@/lib/prisma.js';
import {
  PARTICIPATION_STATUS,
  ENTITLEMENT_STATUS,
  ACTIVE_ENTITLEMENT_STATUSES,
  PAUSE_MODE,
  BUSINESS_OPS_STATUS,
} from '../domain/constants.js';
import { EisErrors } from '../domain/errors.js';
import { assertParticipationTransition } from '../domain/stateMachines.js';
import { recordEisControlAudit } from '../infrastructure/audit.js';
import { beginIdempotentAction, completeIdempotentAction } from '../infrastructure/idempotency.js';
import { invalidateEisCapabilityCache } from '../infrastructure/capabilityCache.js';
import { getCurrentEntitlement } from './entitlementService.js';
import { pausePolicyContract } from '../policies/effectiveCapability.js';
import { notifyEisControlEvent } from '../infrastructure/notifications.js';

export async function getParticipation(tenantId, db = prisma) {
  return db.mraEisTenantParticipation.findUnique({ where: { tenantId } });
}

async function assertEntitled(tenantId, db) {
  const entitlement = await getCurrentEntitlement(tenantId, db);
  if (!entitlement || !ACTIVE_ENTITLEMENT_STATUSES.has(entitlement.status)) {
    if (entitlement?.status === ENTITLEMENT_STATUS.SUSPENDED) {
      throw EisErrors.entitlementSuspended({ tenantId });
    }
    throw EisErrors.notEntitled({ tenantId });
  }
  return entitlement;
}

export async function optInTenantToEis({
  user,
  tenantId,
  requestId,
  ipAddress,
  userAgent,
  db = prisma,
}) {
  if (user?.tenantId && user.tenantId !== tenantId) {
    throw EisErrors.crossTenant({ tenantId });
  }
  await assertEntitled(tenantId, db);

  const idem = await beginIdempotentAction({
    actionKey: 'TENANT_EIS_OPT_IN',
    requestId,
    tenantId,
    payload: { tenantId },
    db,
  });
  if (idem.hit) return idem.result;

  const current =
    (await getParticipation(tenantId, db)) ||
    (await db.mraEisTenantParticipation.create({
      data: { tenantId, status: PARTICIPATION_STATUS.NOT_STARTED, version: 1 },
    }));

  if (current.status === PARTICIPATION_STATUS.OPTED_IN) {
    const out = { participation: current, pausePolicy: null };
    await completeIdempotentAction({ identity: idem.identity, result: out, db });
    return out;
  }

  assertParticipationTransition(current.status, PARTICIPATION_STATUS.OPTED_IN, { tenantId });

  const updated = await db.mraEisTenantParticipation.update({
    where: { tenantId },
    data: {
      status: PARTICIPATION_STATUS.OPTED_IN,
      optedInBy: user.id,
      optedInAt: new Date(),
      version: { increment: 1 },
    },
  });

  await recordEisControlAudit({
    tenantId,
    businessId: tenantId,
    actorId: user.id,
    actorType: 'TENANT_USER',
    action: 'TENANT_OPTED_IN',
    resourceType: 'MraEisTenantParticipation',
    resourceId: updated.id,
    previousStatus: current.status,
    newStatus: PARTICIPATION_STATUS.OPTED_IN,
    requestId,
    ipAddress,
    userAgent,
  });

  invalidateEisCapabilityCache();
  await notifyEisControlEvent({
    type: 'TENANT_OPTED_IN',
    tenantId,
    message: 'EIS participation is active. Complete business setup before operational use.',
  });
  const out = { participation: updated };
  await completeIdempotentAction({ identity: idem.identity, result: out, db });
  return out;
}

export async function pauseTenantEisParticipation({
  user,
  tenantId,
  reason,
  pauseMode = PAUSE_MODE.PAUSE_NEW_ONLY,
  requestId,
  ipAddress,
  userAgent,
  db = prisma,
}) {
  if (!String(reason || '').trim()) throw EisErrors.reasonRequired();
  if (user?.tenantId && user.tenantId !== tenantId) throw EisErrors.crossTenant({ tenantId });

  const current = await getParticipation(tenantId, db);
  if (!current) throw EisErrors.notParticipating({ tenantId });
  assertParticipationTransition(current.status, PARTICIPATION_STATUS.PAUSED, { tenantId });

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.mraEisTenantParticipation.update({
      where: { tenantId },
      data: {
        status: PARTICIPATION_STATUS.PAUSED,
        pausedBy: user.id,
        pausedAt: new Date(),
        pauseReason: reason,
        pauseMode,
        version: { increment: 1 },
      },
    });
    await tx.mraEisBusinessSetting.updateMany({
      where: { tenantId, status: BUSINESS_OPS_STATUS.OPERATIONALLY_ENABLED },
      data: { status: BUSINESS_OPS_STATUS.PAUSED, version: { increment: 1 } },
    });
    await tx.tenant.update({ where: { id: tenantId }, data: { eisEnabled: false } });
    await recordEisControlAudit(
      {
        tenantId,
        businessId: tenantId,
        actorId: user.id,
        actorType: 'TENANT_USER',
        action: 'TENANT_PARTICIPATION_PAUSED',
        resourceType: 'MraEisTenantParticipation',
        resourceId: row.id,
        previousStatus: current.status,
        newStatus: PARTICIPATION_STATUS.PAUSED,
        reason,
        requestId,
        ipAddress,
        userAgent,
      },
      tx
    );
    return row;
  });

  invalidateEisCapabilityCache();
  const pausePolicy = pausePolicyContract({ scope: 'TENANT', pauseMode });
  return { participation: updated, pausePolicy };
}

export async function resumeTenantEisParticipation({
  user,
  tenantId,
  reason,
  requestId,
  ipAddress,
  userAgent,
  db = prisma,
}) {
  await assertEntitled(tenantId, db);
  if (user?.tenantId && user.tenantId !== tenantId) throw EisErrors.crossTenant({ tenantId });
  const current = await getParticipation(tenantId, db);
  if (!current) throw EisErrors.notParticipating({ tenantId });
  assertParticipationTransition(current.status, PARTICIPATION_STATUS.OPTED_IN, { tenantId });

  const updated = await db.mraEisTenantParticipation.update({
    where: { tenantId },
    data: {
      status: PARTICIPATION_STATUS.OPTED_IN,
      pausedBy: null,
      pausedAt: null,
      pauseReason: null,
      version: { increment: 1 },
    },
  });
  await recordEisControlAudit({
    tenantId,
    businessId: tenantId,
    actorId: user.id,
    actorType: 'TENANT_USER',
    action: 'TENANT_PARTICIPATION_RESUMED',
    resourceType: 'MraEisTenantParticipation',
    resourceId: updated.id,
    previousStatus: current.status,
    newStatus: PARTICIPATION_STATUS.OPTED_IN,
    reason,
    requestId,
    ipAddress,
    userAgent,
  });
  invalidateEisCapabilityCache();
  return { participation: updated };
}

export async function optOutTenantFromEis({
  user,
  tenantId,
  reason,
  requestId,
  ipAddress,
  userAgent,
  db = prisma,
}) {
  if (!String(reason || '').trim()) throw EisErrors.reasonRequired();
  if (user?.tenantId && user.tenantId !== tenantId) throw EisErrors.crossTenant({ tenantId });
  const current = await getParticipation(tenantId, db);
  if (!current) throw EisErrors.notParticipating({ tenantId });
  assertParticipationTransition(current.status, PARTICIPATION_STATUS.OPTED_OUT, { tenantId });

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.mraEisTenantParticipation.update({
      where: { tenantId },
      data: {
        status: PARTICIPATION_STATUS.OPTED_OUT,
        optedOutBy: user.id,
        optedOutAt: new Date(),
        optOutReason: reason,
        version: { increment: 1 },
      },
    });
    await tx.mraEisBusinessSetting.updateMany({
      where: { tenantId },
      data: {
        status: BUSINESS_OPS_STATUS.DISABLED,
        disabledBy: user.id,
        disabledAt: new Date(),
        disableReason: reason,
        version: { increment: 1 },
      },
    });
    await tx.tenant.update({ where: { id: tenantId }, data: { eisEnabled: false } });
    await recordEisControlAudit(
      {
        tenantId,
        businessId: tenantId,
        actorId: user.id,
        actorType: 'TENANT_USER',
        action: 'TENANT_OPTED_OUT',
        resourceType: 'MraEisTenantParticipation',
        resourceId: row.id,
        previousStatus: current.status,
        newStatus: PARTICIPATION_STATUS.OPTED_OUT,
        reason,
        requestId,
        ipAddress,
        userAgent,
      },
      tx
    );
    return row;
  });

  invalidateEisCapabilityCache();
  return { participation: updated, historyPreserved: true };
}
