import prisma from '@/lib/prisma.js';
import {
  ENTITLEMENT_STATUS,
  ENTITLEMENT_SOURCE,
  EIS_ENVIRONMENT,
  PARTICIPATION_STATUS,
  BUSINESS_OPS_STATUS,
} from '../domain/constants.js';
import { EisErrors } from '../domain/errors.js';
import {
  assertEntitlementTransition,
  resolveResumeEntitlementStatus,
} from '../domain/stateMachines.js';
import { recordEisControlAudit } from '../infrastructure/audit.js';
import { beginIdempotentAction, completeIdempotentAction } from '../infrastructure/idempotency.js';
import { invalidateEisCapabilityCache } from '../infrastructure/capabilityCache.js';
import { getPlatformEisSetting } from './platformService.js';
import { notifyEisControlEvent } from '../infrastructure/notifications.js';

function requireReason(reason, message) {
  if (!String(reason || '').trim()) {
    throw EisErrors.reasonRequired({ message });
  }
}

function validateDates(effectiveFrom, effectiveUntil) {
  if (effectiveFrom && effectiveUntil && new Date(effectiveUntil) < new Date(effectiveFrom)) {
    throw EisErrors.validation({ message: 'Expiry cannot precede effective date.' });
  }
}

export async function getCurrentEntitlement(tenantId, db = prisma) {
  return db.mraEisTenantEntitlement.findFirst({
    where: { tenantId, isCurrent: true },
    orderBy: { version: 'desc' },
  });
}

export async function listEntitlements({ status, search, environment, take = 50, skip = 0 }, db = prisma) {
  const where = { isCurrent: true };
  if (status) where.status = status;
  if (environment === EIS_ENVIRONMENT.PRODUCTION) where.productionAllowed = true;
  if (environment === EIS_ENVIRONMENT.SANDBOX) where.sandboxAllowed = true;

  const rows = await db.mraEisTenantEntitlement.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take,
    skip,
  });

  const tenantIds = [...new Set(rows.map((r) => r.tenantId))];
  const tenants = tenantIds.length
    ? await db.tenant.findMany({
        where: { id: { in: tenantIds } },
        select: { id: true, name: true, subdomain: true, status: true, eisEnabled: true },
      })
    : [];
  const byId = Object.fromEntries(tenants.map((t) => [t.id, t]));

  let items = rows.map((r) => ({ ...r, tenant: byId[r.tenantId] || null }));
  if (search) {
    const q = search.toLowerCase();
    items = items.filter(
      (i) =>
        i.tenant?.name?.toLowerCase().includes(q) ||
        i.tenant?.subdomain?.toLowerCase().includes(q) ||
        i.tenantId.toLowerCase().includes(q)
    );
  }
  return { items, total: items.length };
}

async function supersedeCurrent(tenantId, db) {
  await db.mraEisTenantEntitlement.updateMany({
    where: { tenantId, isCurrent: true },
    data: { isCurrent: false },
  });
}

async function nextVersion(tenantId, db) {
  const last = await db.mraEisTenantEntitlement.findFirst({
    where: { tenantId },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  return (last?.version || 0) + 1;
}

/**
 * Grant sandbox or production entitlement. Tenants cannot call this.
 */
export async function grantTenantEntitlement({
  admin,
  tenantId,
  targetStatus,
  reason,
  source = ENTITLEMENT_SOURCE.SYSTEM_ADMINISTRATOR,
  effectiveFrom,
  effectiveUntil,
  certificationRequirement = true,
  productionApprovalRequired = false,
  approvalReference = null,
  requestId,
  ipAddress,
  userAgent,
  db = prisma,
}) {
  if (!tenantId) throw EisErrors.validation({ message: 'tenantId is required.' });
  requireReason(reason, 'A reason is required when granting entitlement.');
  validateDates(effectiveFrom, effectiveUntil);

  if (
    targetStatus !== ENTITLEMENT_STATUS.ENTITLED_SANDBOX_ONLY &&
    targetStatus !== ENTITLEMENT_STATUS.ENTITLED_PRODUCTION
  ) {
    throw EisErrors.validation({ message: 'targetStatus must be sandbox or production entitlement.' });
  }

  const platform = await getPlatformEisSetting(db);
  if (!platform.newEntitlementsAllowed && platform.status !== 'ENABLED') {
    // still allow if platform enabled; block only when new entitlements disabled
  }
  if (platform.newEntitlementsAllowed === false) {
    throw EisErrors.platformDisabled({
      message: 'New EIS entitlements are currently disabled by the platform.',
      code: 'EIS_NEW_ENTITLEMENTS_DISABLED',
    });
  }

  if (targetStatus === ENTITLEMENT_STATUS.ENTITLED_PRODUCTION && !platform.productionGloballyAllowed) {
    throw EisErrors.productionNotAuthorized({
      message: 'Platform has not globally allowed production EIS entitlements.',
    });
  }

  if (
    targetStatus === ENTITLEMENT_STATUS.ENTITLED_PRODUCTION &&
    productionApprovalRequired &&
    !approvalReference &&
    admin.role !== 'Super Admin'
  ) {
    throw EisErrors.approvalRequired({
      tenantId,
      requiredAction: 'Obtain compliance approval reference before production grant.',
    });
  }

  const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
  if (!tenant) throw EisErrors.validation({ message: 'Tenant not found.', httpStatus: 404 });

  const idem = await beginIdempotentAction({
    actionKey: 'TENANT_EIS_ENTITLEMENT_GRANT',
    requestId,
    tenantId,
    payload: { tenantId, targetStatus, reason, effectiveFrom, effectiveUntil },
    db,
  });
  if (idem.hit) return idem.result;

  const current = await getCurrentEntitlement(tenantId, db);
  const from = current?.status || ENTITLEMENT_STATUS.NOT_ENTITLED;

  if (current && current.status === targetStatus && current.isCurrent) {
    const out = { entitlement: current, idempotent: true };
    await completeIdempotentAction({ identity: idem.identity, result: out, db });
    return out;
  }

  if (from === ENTITLEMENT_STATUS.REVOKED) {
    // New grant creates a new version; revoked row stays historical (isCurrent flipped below).
  } else if (current) {
    assertEntitlementTransition(from, targetStatus, { tenantId });
  }

  const sandboxAllowed = true;
  const productionAllowed = targetStatus === ENTITLEMENT_STATUS.ENTITLED_PRODUCTION;
  const allowedEnvironment = productionAllowed ? EIS_ENVIRONMENT.PRODUCTION : EIS_ENVIRONMENT.SANDBOX;

  const result = await db.$transaction(async (tx) => {
    if (current?.isCurrent) {
      await tx.mraEisTenantEntitlement.update({
        where: { id: current.id },
        data: { isCurrent: false },
      });
    } else {
      await supersedeCurrent(tenantId, tx);
    }

    const version = await nextVersion(tenantId, tx);
    const row = await tx.mraEisTenantEntitlement.create({
      data: {
        tenantId,
        status: targetStatus,
        allowedEnvironment,
        sandboxAllowed,
        productionAllowed,
        entitlementSource: source,
        entitlementReason: reason,
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
        effectiveUntil: effectiveUntil ? new Date(effectiveUntil) : null,
        certificationRequirement,
        productionApprovalRequired,
        approvalReference,
        grantedBy: admin.id,
        grantedAt: new Date(),
        priorStatus: from === ENTITLEMENT_STATUS.REVOKED ? ENTITLEMENT_STATUS.REVOKED : from,
        isCurrent: true,
        version,
      },
    });

    // Ensure participation + business setting shells exist (not opted in)
    await tx.mraEisTenantParticipation.upsert({
      where: { tenantId },
      create: {
        tenantId,
        status: PARTICIPATION_STATUS.NOT_STARTED,
        version: 1,
      },
      update: {},
    });
    await tx.mraEisBusinessSetting.upsert({
      where: { businessId: tenantId },
      create: {
        tenantId,
        businessId: tenantId,
        status: BUSINESS_OPS_STATUS.AVAILABLE,
        selectedEnvironment: allowedEnvironment === EIS_ENVIRONMENT.PRODUCTION ? EIS_ENVIRONMENT.SANDBOX : EIS_ENVIRONMENT.SANDBOX,
        setupStatus: BUSINESS_OPS_STATUS.SETUP_REQUIRED,
        preferredOperationMode: 'ONLINE_ONLY',
        receiptPolicy: 'ISSUE_PENDING_RECEIPT',
        version: 1,
      },
      update: {},
    });

    await recordEisControlAudit(
      {
        tenantId,
        businessId: tenantId,
        actorId: admin.id,
        actorType: 'ADMIN',
        action: productionAllowed ? 'TENANT_ENTITLEMENT_GRANTED_PRODUCTION' : 'TENANT_ENTITLEMENT_GRANTED_SANDBOX',
        resourceType: 'MraEisTenantEntitlement',
        resourceId: row.id,
        previousStatus: from,
        newStatus: targetStatus,
        reason,
        environment: allowedEnvironment,
        approvalReference,
        requestId,
        ipAddress,
        userAgent,
      },
      tx
    );

    return row;
  });

  invalidateEisCapabilityCache();
  await notifyEisControlEvent({
    type: productionAllowed ? 'PRODUCTION_ENTITLEMENT_GRANTED' : 'SANDBOX_ENTITLEMENT_GRANTED',
    tenantId,
    message: productionAllowed
      ? 'Production EIS entitlement has been granted for your business.'
      : 'Sandbox EIS entitlement has been granted for your business.',
  });

  const out = { entitlement: result };
  await completeIdempotentAction({ identity: idem.identity, result: out, db });
  return out;
}

export async function upgradeTenantEntitlementToProduction(args) {
  return grantTenantEntitlement({
    ...args,
    targetStatus: ENTITLEMENT_STATUS.ENTITLED_PRODUCTION,
  });
}

export async function suspendTenantEntitlement({
  admin,
  tenantId,
  reason,
  expectedVersion,
  requestId,
  ipAddress,
  userAgent,
  db = prisma,
}) {
  requireReason(reason, 'A reason is required to suspend entitlement.');
  const idem = await beginIdempotentAction({
    actionKey: 'TENANT_EIS_ENTITLEMENT_SUSPEND',
    requestId,
    tenantId,
    payload: { tenantId, reason },
    db,
  });
  if (idem.hit) return idem.result;

  const current = await getCurrentEntitlement(tenantId, db);
  if (!current) throw EisErrors.notEntitled({ tenantId });
  assertEntitlementTransition(current.status, ENTITLEMENT_STATUS.SUSPENDED, { tenantId });
  if (expectedVersion != null && current.version !== expectedVersion) {
    throw EisErrors.versionConflict({ tenantId });
  }

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.mraEisTenantEntitlement.update({
      where: { id: current.id },
      data: {
        status: ENTITLEMENT_STATUS.SUSPENDED,
        priorStatus: current.status,
        suspendedBy: admin.id,
        suspendedAt: new Date(),
        suspensionReason: reason,
        version: { increment: 1 },
      },
    });
    await tx.mraEisTenantParticipation.updateMany({
      where: { tenantId },
      data: {
        status: PARTICIPATION_STATUS.SUSPENDED_BY_SYSTEM,
        version: { increment: 1 },
      },
    });
    await tx.mraEisBusinessSetting.updateMany({
      where: { tenantId },
      data: {
        status: BUSINESS_OPS_STATUS.SUSPENDED_BY_SYSTEM,
        version: { increment: 1 },
      },
    });
    // Do NOT clear Tenant.eisEnabled history flag destructively — sync operational false
    await tx.tenant.update({
      where: { id: tenantId },
      data: { eisEnabled: false },
    });
    await recordEisControlAudit(
      {
        tenantId,
        businessId: tenantId,
        actorId: admin.id,
        actorType: 'ADMIN',
        action: 'TENANT_ENTITLEMENT_SUSPENDED',
        resourceType: 'MraEisTenantEntitlement',
        resourceId: row.id,
        previousStatus: current.status,
        newStatus: ENTITLEMENT_STATUS.SUSPENDED,
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
  await notifyEisControlEvent({
    type: 'ENTITLEMENT_SUSPENDED',
    tenantId,
    message: 'Your MRA EIS entitlement has been suspended. Historical records remain available.',
  });
  const out = { entitlement: updated };
  await completeIdempotentAction({ identity: idem.identity, result: out, db });
  return out;
}

export async function resumeTenantEntitlement({
  admin,
  tenantId,
  reason,
  expectedVersion,
  requestId,
  ipAddress,
  userAgent,
  db = prisma,
}) {
  requireReason(reason, 'A reason is required to resume entitlement.');
  const current = await getCurrentEntitlement(tenantId, db);
  if (!current) throw EisErrors.notEntitled({ tenantId });
  if (current.status === ENTITLEMENT_STATUS.REVOKED) {
    throw EisErrors.revokedCannotResume({ tenantId });
  }
  if (current.status !== ENTITLEMENT_STATUS.SUSPENDED) {
    throw EisErrors.invalidTransition({
      tenantId,
      currentStatus: current.status,
      message: 'Only suspended entitlements can be resumed.',
    });
  }
  const resumeTo = resolveResumeEntitlementStatus(current.priorStatus);
  assertEntitlementTransition(current.status, resumeTo, { tenantId });
  if (expectedVersion != null && current.version !== expectedVersion) {
    throw EisErrors.versionConflict({ tenantId });
  }

  const updated = await db.mraEisTenantEntitlement.update({
    where: { id: current.id },
    data: {
      status: resumeTo,
      suspendedBy: null,
      suspendedAt: null,
      suspensionReason: null,
      version: { increment: 1 },
    },
  });

  await db.mraEisTenantParticipation.updateMany({
    where: { tenantId, status: PARTICIPATION_STATUS.SUSPENDED_BY_SYSTEM },
    data: { status: PARTICIPATION_STATUS.PAUSED, version: { increment: 1 } },
  });
  await db.mraEisBusinessSetting.updateMany({
    where: { tenantId, status: BUSINESS_OPS_STATUS.SUSPENDED_BY_SYSTEM },
    data: { status: BUSINESS_OPS_STATUS.PAUSED, version: { increment: 1 } },
  });

  await recordEisControlAudit({
    tenantId,
    businessId: tenantId,
    actorId: admin.id,
    actorType: 'ADMIN',
    action: 'TENANT_ENTITLEMENT_RESUMED',
    resourceType: 'MraEisTenantEntitlement',
    resourceId: updated.id,
    previousStatus: ENTITLEMENT_STATUS.SUSPENDED,
    newStatus: resumeTo,
    reason,
    requestId,
    ipAddress,
    userAgent,
  });

  invalidateEisCapabilityCache();
  await notifyEisControlEvent({
    type: 'ENTITLEMENT_RESUMED',
    tenantId,
    message: 'Your MRA EIS entitlement has been resumed. Re-enable operational use when ready.',
  });
  return { entitlement: updated };
}

export async function revokeTenantEntitlement({
  admin,
  tenantId,
  reason,
  expectedVersion,
  requestId,
  ipAddress,
  userAgent,
  db = prisma,
}) {
  requireReason(reason, 'A reason is required to revoke entitlement.');
  const idem = await beginIdempotentAction({
    actionKey: 'TENANT_EIS_ENTITLEMENT_REVOKE',
    requestId,
    tenantId,
    payload: { tenantId, reason },
    db,
  });
  if (idem.hit) return idem.result;

  const current = await getCurrentEntitlement(tenantId, db);
  if (!current) throw EisErrors.notEntitled({ tenantId });
  assertEntitlementTransition(current.status, ENTITLEMENT_STATUS.REVOKED, { tenantId });
  if (expectedVersion != null && current.version !== expectedVersion) {
    throw EisErrors.versionConflict({ tenantId });
  }

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.mraEisTenantEntitlement.update({
      where: { id: current.id },
      data: {
        status: ENTITLEMENT_STATUS.REVOKED,
        revokedBy: admin.id,
        revokedAt: new Date(),
        revocationReason: reason,
        version: { increment: 1 },
      },
    });
    await tx.mraEisTenantParticipation.updateMany({
      where: { tenantId },
      data: {
        status: PARTICIPATION_STATUS.OPTED_OUT,
        optedOutAt: new Date(),
        optOutReason: 'Entitlement revoked',
        version: { increment: 1 },
      },
    });
    await tx.mraEisBusinessSetting.updateMany({
      where: { tenantId },
      data: {
        status: BUSINESS_OPS_STATUS.DISABLED,
        disabledAt: new Date(),
        disableReason: 'Entitlement revoked',
        version: { increment: 1 },
      },
    });
    await tx.tenant.update({
      where: { id: tenantId },
      data: { eisEnabled: false },
    });
    await recordEisControlAudit(
      {
        tenantId,
        businessId: tenantId,
        actorId: admin.id,
        actorType: 'ADMIN',
        action: 'TENANT_ENTITLEMENT_REVOKED',
        resourceType: 'MraEisTenantEntitlement',
        resourceId: row.id,
        previousStatus: current.status,
        newStatus: ENTITLEMENT_STATUS.REVOKED,
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
  await notifyEisControlEvent({
    type: 'ENTITLEMENT_REVOKED',
    tenantId,
    message: 'Your MRA EIS entitlement has been revoked. Historical compliance records are retained.',
  });
  const out = { entitlement: updated };
  await completeIdempotentAction({ identity: idem.identity, result: out, db });
  return out;
}

export async function expireDueEntitlements({ now = new Date(), db = prisma } = {}) {
  const due = await db.mraEisTenantEntitlement.findMany({
    where: {
      isCurrent: true,
      status: { in: [ENTITLEMENT_STATUS.ENTITLED_SANDBOX_ONLY, ENTITLEMENT_STATUS.ENTITLED_PRODUCTION] },
      effectiveUntil: { lt: now },
    },
  });
  let count = 0;
  for (const row of due) {
    await db.mraEisTenantEntitlement.update({
      where: { id: row.id },
      data: { status: ENTITLEMENT_STATUS.EXPIRED, version: { increment: 1 } },
    });
    await db.tenant.update({ where: { id: row.tenantId }, data: { eisEnabled: false } });
    await recordEisControlAudit({
      tenantId: row.tenantId,
      businessId: row.tenantId,
      actorType: 'SYSTEM',
      action: 'TENANT_ENTITLEMENT_EXPIRED',
      resourceType: 'MraEisTenantEntitlement',
      resourceId: row.id,
      previousStatus: row.status,
      newStatus: ENTITLEMENT_STATUS.EXPIRED,
      reason: 'effectiveUntil passed',
    });
    count += 1;
  }
  if (count) invalidateEisCapabilityCache();
  return { expired: count };
}

/**
 * Subscription-first policy: after paid MRA EIS activation, open an entitlement
 * review request without granting sandbox/production access.
 * Idempotent when already pending or already entitled.
 */
export async function requestEntitlementPendingFromSubscription({
  tenantId,
  subscriptionId,
  planCode,
  reason = 'Paid MRA EIS subscription activated — entitlement review required',
  requestId,
  db = prisma,
}) {
  if (!tenantId) return { ok: false, error: 'tenantId required' };

  const current = await getCurrentEntitlement(tenantId, db);
  if (
    current &&
    (current.status === ENTITLEMENT_STATUS.ENTITLEMENT_PENDING ||
      current.status === ENTITLEMENT_STATUS.ENTITLED_SANDBOX_ONLY ||
      current.status === ENTITLEMENT_STATUS.ENTITLED_PRODUCTION)
  ) {
    return { ok: true, entitlement: current, idempotent: true };
  }

  const from = current?.status || ENTITLEMENT_STATUS.NOT_ENTITLED;
  if (current && from !== ENTITLEMENT_STATUS.NOT_ENTITLED && from !== ENTITLEMENT_STATUS.EXPIRED) {
    try {
      assertEntitlementTransition(from, ENTITLEMENT_STATUS.ENTITLEMENT_PENDING, { tenantId });
    } catch {
      return { ok: true, entitlement: current, skipped: true };
    }
  }

  const idem = await beginIdempotentAction({
    actionKey: 'TENANT_EIS_ENTITLEMENT_PENDING_FROM_SUB',
    requestId: requestId || `sub-pending:${subscriptionId || 'none'}:${tenantId}`,
    tenantId,
    payload: { tenantId, subscriptionId, planCode },
    db,
  });
  if (idem.hit) return { ok: true, ...idem.result };

  const version = await nextVersion(tenantId, db);
  await supersedeCurrent(tenantId, db);

  const entitlement = await db.mraEisTenantEntitlement.create({
    data: {
      tenantId,
      version,
      isCurrent: true,
      status: ENTITLEMENT_STATUS.ENTITLEMENT_PENDING,
      allowedEnvironment: EIS_ENVIRONMENT.SANDBOX,
      sandboxAllowed: false,
      productionAllowed: false,
      entitlementSource: ENTITLEMENT_SOURCE.SUBSCRIPTION_PLAN,
      entitlementReason: `${reason}${planCode ? ` (plan ${planCode})` : ''}${
        subscriptionId ? ` [sub ${subscriptionId}]` : ''
      }`,
    },
  });

  await recordEisControlAudit({
    tenantId,
    businessId: tenantId,
    actorType: 'SYSTEM',
    action: 'TENANT_ENTITLEMENT_PENDING_FROM_SUBSCRIPTION',
    resourceType: 'MraEisTenantEntitlement',
    resourceId: entitlement.id,
    previousStatus: from,
    newStatus: ENTITLEMENT_STATUS.ENTITLEMENT_PENDING,
    reason,
    metadata: { subscriptionId, planCode },
  });

  invalidateEisCapabilityCache();
  const out = { entitlement, idempotent: false };
  await completeIdempotentAction({ identity: idem.identity, result: out, db });
  return { ok: true, ...out };
}
