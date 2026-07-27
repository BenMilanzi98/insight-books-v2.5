import prisma from '@/lib/prisma.js';
import {
  BUSINESS_OPS_STATUS,
  EIS_ENVIRONMENT,
  PARTICIPATION_STATUS,
  OPERATION_MODE,
  RECEIPT_POLICY,
  DISABLE_MODE,
} from '../domain/constants.js';
import { EisErrors } from '../domain/errors.js';
import { assertBusinessOpsTransition } from '../domain/stateMachines.js';
import { recordEisControlAudit } from '../infrastructure/audit.js';
import { beginIdempotentAction, completeIdempotentAction } from '../infrastructure/idempotency.js';
import { invalidateEisCapabilityCache } from '../infrastructure/capabilityCache.js';
import { getCurrentEntitlement } from './entitlementService.js';
import { getParticipation } from './participationService.js';
import { disablementPolicyContract } from '../policies/effectiveCapability.js';

function assertSameTenantBusiness(tenantId, businessId) {
  // Phase 4: Tenant = Business; businessId must equal tenantId
  if (!tenantId || !businessId || tenantId !== businessId) {
    throw EisErrors.businessMismatch({ tenantId, businessId });
  }
}

export async function getBusinessEisSetting(tenantId, businessId = tenantId, db = prisma) {
  assertSameTenantBusiness(tenantId, businessId);
  return db.mraEisBusinessSetting.findUnique({ where: { businessId } });
}

export async function listBusinessEisSettings(tenantId, db = prisma) {
  return db.mraEisBusinessSetting.findMany({ where: { tenantId } });
}

async function requireOptedIn(tenantId, db) {
  const participation = await getParticipation(tenantId, db);
  if (!participation || participation.status !== PARTICIPATION_STATUS.OPTED_IN) {
    throw EisErrors.notParticipating({ tenantId });
  }
  return participation;
}

export async function startBusinessEisSetup({
  user,
  tenantId,
  businessId = tenantId,
  selectedEnvironment = EIS_ENVIRONMENT.SANDBOX,
  requestId,
  ipAddress,
  userAgent,
  db = prisma,
}) {
  if (user?.tenantId && user.tenantId !== tenantId) throw EisErrors.crossTenant({ tenantId });
  assertSameTenantBusiness(tenantId, businessId);
  await requireOptedIn(tenantId, db);

  const entitlement = await getCurrentEntitlement(tenantId, db);
  if (selectedEnvironment === EIS_ENVIRONMENT.PRODUCTION && !entitlement?.productionAllowed) {
    throw EisErrors.productionNotAuthorized({ tenantId });
  }

  const idem = await beginIdempotentAction({
    actionKey: 'BUSINESS_EIS_SETUP_START',
    requestId,
    tenantId,
    businessId,
    payload: { tenantId, businessId, selectedEnvironment },
    db,
  });
  if (idem.hit) return idem.result;

  let current = await getBusinessEisSetting(tenantId, businessId, db);
  if (!current) {
    current = await db.mraEisBusinessSetting.create({
      data: {
        tenantId,
        businessId,
        status: BUSINESS_OPS_STATUS.AVAILABLE,
        selectedEnvironment,
        setupStatus: BUSINESS_OPS_STATUS.SETUP_REQUIRED,
        preferredOperationMode: OPERATION_MODE.ONLINE_ONLY,
        receiptPolicy: RECEIPT_POLICY.ISSUE_PENDING_RECEIPT,
        version: 1,
      },
    });
  }

  if (current.status === BUSINESS_OPS_STATUS.SETUP_IN_PROGRESS) {
    const out = { businessSetting: current };
    await completeIdempotentAction({ identity: idem.identity, result: out, db });
    return out;
  }

  assertBusinessOpsTransition(current.status, BUSINESS_OPS_STATUS.SETUP_IN_PROGRESS, {
    tenantId,
    businessId,
  });

  const updated = await db.mraEisBusinessSetting.update({
    where: { businessId },
    data: {
      status: BUSINESS_OPS_STATUS.SETUP_IN_PROGRESS,
      setupStatus: BUSINESS_OPS_STATUS.SETUP_IN_PROGRESS,
      selectedEnvironment,
      version: { increment: 1 },
    },
  });

  await recordEisControlAudit({
    tenantId,
    businessId,
    actorId: user.id,
    actorType: 'TENANT_USER',
    action: 'BUSINESS_EIS_SETUP_STARTED',
    resourceType: 'MraEisBusinessSetting',
    resourceId: updated.id,
    previousStatus: current.status,
    newStatus: BUSINESS_OPS_STATUS.SETUP_IN_PROGRESS,
    environment: selectedEnvironment,
    requestId,
    ipAddress,
    userAgent,
  });

  invalidateEisCapabilityCache();
  const out = {
    businessSetting: updated,
    note: 'Terminal activation is not available in Phase 4. Setup status only.',
  };
  await completeIdempotentAction({ identity: idem.identity, result: out, db });
  return out;
}

export async function resumeBusinessEisSetup(args) {
  return startBusinessEisSetup(args);
}

export async function updateBusinessEisPreferences({
  user,
  tenantId,
  businessId = tenantId,
  preferredOperationMode,
  receiptPolicy,
  autoRetryPreference,
  selectedEnvironment,
  expectedVersion,
  requestId,
  ipAddress,
  userAgent,
  db = prisma,
}) {
  if (user?.tenantId && user.tenantId !== tenantId) throw EisErrors.crossTenant({ tenantId });
  assertSameTenantBusiness(tenantId, businessId);
  const current = await getBusinessEisSetting(tenantId, businessId, db);
  if (!current) throw EisErrors.businessDisabled({ tenantId, businessId, message: 'Business EIS setting missing.' });
  if (expectedVersion != null && current.version !== expectedVersion) {
    throw EisErrors.versionConflict({ tenantId, businessId });
  }

  if (preferredOperationMode === OPERATION_MODE.ONLINE_WITH_CERTIFIED_OFFLINE_FALLBACK) {
    // Allowed to store preference; capability policy still blocks offline use.
  }
  if (selectedEnvironment === EIS_ENVIRONMENT.PRODUCTION) {
    const entitlement = await getCurrentEntitlement(tenantId, db);
    if (!entitlement?.productionAllowed) throw EisErrors.productionNotAuthorized({ tenantId });
  }

  const updated = await db.mraEisBusinessSetting.update({
    where: { businessId },
    data: {
      preferredOperationMode: preferredOperationMode ?? current.preferredOperationMode,
      receiptPolicy: receiptPolicy ?? current.receiptPolicy,
      autoRetryPreference:
        autoRetryPreference === undefined ? current.autoRetryPreference : Boolean(autoRetryPreference),
      selectedEnvironment: selectedEnvironment ?? current.selectedEnvironment,
      version: { increment: 1 },
    },
  });

  await recordEisControlAudit({
    tenantId,
    businessId,
    actorId: user.id,
    actorType: 'TENANT_USER',
    action: 'BUSINESS_EIS_PREFERENCES_UPDATED',
    resourceType: 'MraEisBusinessSetting',
    resourceId: updated.id,
    previousStatus: current.status,
    newStatus: updated.status,
    requestId,
    ipAddress,
    userAgent,
  });
  invalidateEisCapabilityCache();
  return { businessSetting: updated };
}

/**
 * Phase 4: operational enable is blocked until future deps exist — mark READY_FOR_ACTIVATION only.
 * True OPERATIONALLY_ENABLED is reserved for later phases when terminal/config/mappings pass.
 */
export async function enableBusinessEisOperation({
  user,
  tenantId,
  businessId = tenantId,
  forceReadyOnly = true,
  requestId,
  ipAddress,
  userAgent,
  db = prisma,
}) {
  if (user?.tenantId && user.tenantId !== tenantId) throw EisErrors.crossTenant({ tenantId });
  assertSameTenantBusiness(tenantId, businessId);
  await requireOptedIn(tenantId, db);
  const current = await getBusinessEisSetting(tenantId, businessId, db);
  if (!current) throw EisErrors.setupRequired({ tenantId, businessId });

  const target = forceReadyOnly
    ? BUSINESS_OPS_STATUS.READY_FOR_ACTIVATION
    : BUSINESS_OPS_STATUS.OPERATIONALLY_ENABLED;

  if (current.status === target) {
    return { businessSetting: current, blocked: forceReadyOnly };
  }

  assertBusinessOpsTransition(current.status, target, { tenantId, businessId });

  const updated = await db.mraEisBusinessSetting.update({
    where: { businessId },
    data: {
      status: target,
      setupStatus: target,
      enabledBy: user.id,
      enabledAt: new Date(),
      version: { increment: 1 },
    },
  });

  // Do not set Tenant.eisEnabled true until later phases confirm runtime readiness
  await recordEisControlAudit({
    tenantId,
    businessId,
    actorId: user.id,
    actorType: 'TENANT_USER',
    action: forceReadyOnly ? 'BUSINESS_READY_FOR_ACTIVATION' : 'BUSINESS_OPERATION_ENABLED',
    resourceType: 'MraEisBusinessSetting',
    resourceId: updated.id,
    previousStatus: current.status,
    newStatus: target,
    requestId,
    ipAddress,
    userAgent,
    metadata: { note: 'Phase 4 cannot fully enable fiscal transmission.' },
  });
  invalidateEisCapabilityCache();
  return {
    businessSetting: updated,
    blocked: true,
    message:
      'Marked ready for activation. Terminal, configuration and mappings are required in later phases before operational fiscalization.',
  };
}

export async function pauseBusinessEisOperation({
  user,
  tenantId,
  businessId = tenantId,
  reason,
  requestId,
  ipAddress,
  userAgent,
  db = prisma,
}) {
  if (!String(reason || '').trim()) throw EisErrors.reasonRequired();
  if (user?.tenantId && user.tenantId !== tenantId) throw EisErrors.crossTenant({ tenantId });
  assertSameTenantBusiness(tenantId, businessId);
  const current = await getBusinessEisSetting(tenantId, businessId, db);
  if (!current) throw EisErrors.businessDisabled({ tenantId, businessId });
  assertBusinessOpsTransition(current.status, BUSINESS_OPS_STATUS.PAUSED, { tenantId, businessId });

  const updated = await db.mraEisBusinessSetting.update({
    where: { businessId },
    data: {
      status: BUSINESS_OPS_STATUS.PAUSED,
      pausedBy: user.id,
      pausedAt: new Date(),
      pauseReason: reason,
      version: { increment: 1 },
    },
  });
  await db.tenant.update({ where: { id: tenantId }, data: { eisEnabled: false } });
  await recordEisControlAudit({
    tenantId,
    businessId,
    actorId: user.id,
    actorType: 'TENANT_USER',
    action: 'BUSINESS_OPERATION_PAUSED',
    resourceType: 'MraEisBusinessSetting',
    resourceId: updated.id,
    previousStatus: current.status,
    newStatus: BUSINESS_OPS_STATUS.PAUSED,
    reason,
    requestId,
    ipAddress,
    userAgent,
  });
  invalidateEisCapabilityCache();
  return { businessSetting: updated };
}

export async function resumeBusinessEisOperation({
  user,
  tenantId,
  businessId = tenantId,
  reason,
  requestId,
  ipAddress,
  userAgent,
  db = prisma,
}) {
  await requireOptedIn(tenantId, db);
  if (user?.tenantId && user.tenantId !== tenantId) throw EisErrors.crossTenant({ tenantId });
  assertSameTenantBusiness(tenantId, businessId);
  const current = await getBusinessEisSetting(tenantId, businessId, db);
  if (!current) throw EisErrors.businessDisabled({ tenantId, businessId });

  const target = BUSINESS_OPS_STATUS.READY_FOR_ACTIVATION;
  assertBusinessOpsTransition(current.status, target, { tenantId, businessId });

  const updated = await db.mraEisBusinessSetting.update({
    where: { businessId },
    data: {
      status: target,
      pausedBy: null,
      pausedAt: null,
      pauseReason: null,
      version: { increment: 1 },
    },
  });
  await recordEisControlAudit({
    tenantId,
    businessId,
    actorId: user.id,
    actorType: 'TENANT_USER',
    action: 'BUSINESS_OPERATION_RESUMED',
    resourceType: 'MraEisBusinessSetting',
    resourceId: updated.id,
    previousStatus: current.status,
    newStatus: target,
    reason,
    requestId,
    ipAddress,
    userAgent,
  });
  invalidateEisCapabilityCache();
  return { businessSetting: updated };
}

export async function disableBusinessEis({
  user,
  tenantId,
  businessId = tenantId,
  reason,
  mode = DISABLE_MODE.DISABLE_BEFORE_ACTIVATION,
  requestId,
  ipAddress,
  userAgent,
  db = prisma,
}) {
  if (!String(reason || '').trim()) throw EisErrors.reasonRequired();
  if (user?.tenantId && user.tenantId !== tenantId) throw EisErrors.crossTenant({ tenantId });
  assertSameTenantBusiness(tenantId, businessId);
  const current = await getBusinessEisSetting(tenantId, businessId, db);
  if (!current) throw EisErrors.businessDisabled({ tenantId, businessId });

  const contract = disablementPolicyContract({ mode, queueDepth: 0, unknownOutcomes: 0 });
  if (mode === DISABLE_MODE.DISABLE_AFTER_QUEUE_DRAINS && !contract.queueDrainComplete) {
    assertBusinessOpsTransition(current.status, BUSINESS_OPS_STATUS.DISABLING_AFTER_QUEUE, {
      tenantId,
      businessId,
    });
    const draining = await db.mraEisBusinessSetting.update({
      where: { businessId },
      data: {
        status: BUSINESS_OPS_STATUS.DISABLING_AFTER_QUEUE,
        disableMode: mode,
        disableReason: reason,
        version: { increment: 1 },
      },
    });
    return { businessSetting: draining, disablement: contract, historyPreserved: true };
  }

  assertBusinessOpsTransition(current.status, BUSINESS_OPS_STATUS.DISABLED, { tenantId, businessId });

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.mraEisBusinessSetting.update({
      where: { businessId },
      data: {
        status: BUSINESS_OPS_STATUS.DISABLED,
        disabledBy: user.id,
        disabledAt: new Date(),
        disableReason: reason,
        disableMode: mode,
        version: { increment: 1 },
      },
    });
    await tx.tenant.update({ where: { id: tenantId }, data: { eisEnabled: false } });
    await recordEisControlAudit(
      {
        tenantId,
        businessId,
        actorId: user.id,
        actorType: 'TENANT_USER',
        action: 'BUSINESS_EIS_DISABLED',
        resourceType: 'MraEisBusinessSetting',
        resourceId: row.id,
        previousStatus: current.status,
        newStatus: BUSINESS_OPS_STATUS.DISABLED,
        reason,
        requestId,
        ipAddress,
        userAgent,
        metadata: { mode, historyPreserved: true },
      },
      tx
    );
    return row;
  });

  invalidateEisCapabilityCache();
  return { businessSetting: updated, disablement: contract, historyPreserved: true };
}
