/**
 * Wave 3 — Subscription create/amend from accepted commercial snapshot.
 * Closed Won ≠ ACTIVE. Pending until activation policy passes.
 */

import { createHash } from 'crypto';
import { assertNoDuplicateActiveSubscription } from '../../platformBilling.js';
import {
  CRM_CONVERSION_RESOURCE_TYPE,
  CRM_SUBSCRIPTION_PROVISION_STATUS,
} from './catalogue.js';
import { resolveConversionActor } from './model.js';
import { stripFabricatedProvisionArgs } from './requestHonesty.js';

function hasSubscriptionModel(prisma) {
  return typeof prisma?.accountSubscription?.create === 'function';
}

function hasResourceModel(prisma) {
  return typeof prisma?.crmConversionResource?.create === 'function';
}

function normalizeSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return null;
  return snapshot;
}

function snapshotAmount(snapshot) {
  const totals = snapshot?.totals || {};
  const total = Number(totals.total);
  if (Number.isFinite(total)) return total;
  const subtotal = Number(totals.subtotal || 0);
  const discount = Number(totals.discount || 0);
  const tax = Number(totals.tax || 0);
  return Math.round((subtotal - discount + tax) * 100) / 100;
}

function buildTxRef({ conversionId, idempotencyKey, amendVersion }) {
  const raw = `cvn-sub:${conversionId || 'none'}:${idempotencyKey || 'none'}:${amendVersion || 1}`;
  return `CVNSUB-${createHash('sha256').update(raw).digest('hex').slice(0, 24)}`;
}

/**
 * Create or amend AccountSubscription from accepted pricing snapshot.
 * Never sets isActive=true / status ACTIVE — activation is a separate step.
 */
export async function createOrAmendSubscriptionFromAccepted(prisma, args = {}) {
  // Ignore caller forgeries (forceActive / ACTIVATED / PAID) — activation is separate.
  args = stripFabricatedProvisionArgs(args);
  const admin = resolveConversionActor(args);
  const conversionId = args.conversionId ? String(args.conversionId) : null;
  const tenantId = args.tenantId ? String(args.tenantId).trim() : '';
  const idempotencyKey =
    args.idempotencyKey ||
    (conversionId ? `sub:${conversionId}` : null);
  const now = args.now || new Date();
  const snapshot = normalizeSnapshot(args.acceptedSnapshot);

  if (!tenantId) {
    return { ok: false, error: 'tenantId_required' };
  }
  if (!snapshot) {
    return { ok: false, error: 'accepted_snapshot_required' };
  }
  if (!idempotencyKey) {
    return { ok: false, error: 'idempotencyKey_required' };
  }
  if (!hasSubscriptionModel(prisma)) {
    return {
      ok: false,
      error: 'subscription_model_unavailable',
      status: 'NOT_AVAILABLE',
    };
  }

  if (hasResourceModel(prisma) && conversionId) {
    const existingRes = await prisma.crmConversionResource.findFirst({
      where: {
        conversionId,
        resourceType: CRM_CONVERSION_RESOURCE_TYPE.SUBSCRIPTION,
        idempotencyKey,
      },
    });
    if (existingRes?.resourceId) {
      const sub = await prisma.accountSubscription.findUnique({
        where: { id: existingRes.resourceId },
      });
      // Replay honesty: never report ACTIVE unless the persisted row truly is.
      const persistedActive =
        Boolean(sub?.isActive) &&
        String(sub?.status || '').toUpperCase() === 'ACTIVE';
      return {
        ok: true,
        action: existingRes.action || 'CREATE',
        subscriptionId: existingRes.resourceId,
        tenantId,
        status: persistedActive
          ? 'ACTIVE'
          : CRM_SUBSCRIPTION_PROVISION_STATUS.PENDING_ACTIVATION,
        isActive: persistedActive,
        idempotentReplay: true,
        subscriptionCreated: existingRes.action === 'CREATE',
        subscriptionAmended: existingRes.action === 'AMEND',
      };
    }
  }

  const existingSubscriptionId = args.existingSubscriptionId
    ? String(args.existingSubscriptionId)
    : null;
  const isAmend =
    Boolean(existingSubscriptionId) ||
    args.action === 'AMEND' ||
    args.conversionType === 'EXISTING_CUSTOMER_NEW_SUBSCRIPTION' &&
      Boolean(args.forceAmend);

  // Expansion amend path — update existing subscription amounts/plan; never create Tenant.
  if (existingSubscriptionId || (args.action === 'AMEND' && args.existingSubscriptionId)) {
    const targetId = existingSubscriptionId || args.existingSubscriptionId;
    const existing = await prisma.accountSubscription.findUnique({
      where: { id: targetId },
    });
    if (!existing) {
      return { ok: false, error: 'subscription_not_found', status: 'NOT_AVAILABLE' };
    }
    if (existing.tenantId && existing.tenantId !== tenantId) {
      return { ok: false, error: 'subscription_tenant_mismatch', status: 'BLOCKED' };
    }

    const amount = snapshotAmount(snapshot);
    const updated = await prisma.accountSubscription.update({
      where: { id: existing.id },
      data: {
        plan: snapshot.planCode || existing.plan,
        amount,
        currency: snapshot.currency || existing.currency || 'MWK',
        status: CRM_SUBSCRIPTION_PROVISION_STATUS.PENDING_ACTIVATION,
        isActive: false,
        notes: `Amended from accepted snapshot ${snapshot.acceptanceId || ''}`.trim(),
        gatewayResponse: {
          source: 'ACCEPTED_SNAPSHOT',
          acceptanceId: snapshot.acceptanceId || null,
          documentVersionId: snapshot.documentVersionId || null,
          checksumSha256: snapshot.checksumSha256 || null,
          planVersion: snapshot.planVersion ?? null,
          conversionId,
          action: 'AMEND',
        },
        updatedAt: now,
      },
    });

    if (hasResourceModel(prisma) && conversionId) {
      await prisma.crmConversionResource.create({
        data: {
          conversionId,
          resourceType: CRM_CONVERSION_RESOURCE_TYPE.SUBSCRIPTION,
          resourceId: updated.id,
          action: 'AMEND',
          status: CRM_SUBSCRIPTION_PROVISION_STATUS.PENDING_ACTIVATION,
          idempotencyKey,
          metaJson: {
            tenantId,
            acceptanceId: snapshot.acceptanceId || null,
            planCode: snapshot.planCode || null,
          },
          actorAdminId: admin?.id || null,
          createdAt: now,
          updatedAt: now,
        },
      });
    }

    return {
      ok: true,
      action: 'AMEND',
      subscriptionId: updated.id,
      tenantId,
      status: updated.status,
      isActive: false,
      subscriptionCreated: false,
      subscriptionAmended: true,
    };
  }

  // Guard against fabricating a second ACTIVE subscription (active count must stay 0 until activation).
  const activeCount =
    typeof prisma.accountSubscription.count === 'function'
      ? await prisma.accountSubscription.count({
          where: { tenantId, isActive: true },
        })
      : 0;
  const dup = assertNoDuplicateActiveSubscription(activeCount);
  if (!dup.ok) {
    return { ok: false, error: 'duplicate_active_subscription', status: 'BLOCKED' };
  }

  const amount = snapshotAmount(snapshot);
  const txRef = buildTxRef({
    conversionId,
    idempotencyKey,
    amendVersion: 1,
  });

  // Exact txRef retry
  let existingByTx = null;
  if (typeof prisma.accountSubscription.findUnique === 'function') {
    existingByTx = await prisma.accountSubscription.findUnique({
      where: { txRef },
    });
  }
  if (!existingByTx) {
    existingByTx = await prisma.accountSubscription.findFirst({
      where: { txRef },
    });
  }
  if (existingByTx) {
    if (hasResourceModel(prisma) && conversionId) {
      const prior = await prisma.crmConversionResource.findFirst({
        where: { conversionId, resourceType: CRM_CONVERSION_RESOURCE_TYPE.SUBSCRIPTION, idempotencyKey },
      });
      if (!prior) {
        await prisma.crmConversionResource.create({
          data: {
            conversionId,
            resourceType: CRM_CONVERSION_RESOURCE_TYPE.SUBSCRIPTION,
            resourceId: existingByTx.id,
            action: 'CREATE',
            status: existingByTx.status,
            idempotencyKey,
            metaJson: { tenantId, txRef },
            actorAdminId: admin?.id || null,
            createdAt: now,
            updatedAt: now,
          },
        });
      }
    }
    return {
      ok: true,
      action: 'CREATE',
      subscriptionId: existingByTx.id,
      tenantId,
      status: existingByTx.status,
      isActive: Boolean(existingByTx.isActive),
      idempotentReplay: true,
      subscriptionCreated: true,
      subscriptionAmended: false,
    };
  }

  let created;
  try {
    created = await prisma.accountSubscription.create({
      data: {
        tenantId,
        plan: snapshot.planCode || 'UNKNOWN',
        txRef,
        amount,
        currency: snapshot.currency || 'MWK',
        status: CRM_SUBSCRIPTION_PROVISION_STATUS.PENDING_ACTIVATION,
        isActive: false,
        isTrial: false,
        notes: `Provisioned from accepted snapshot ${snapshot.acceptanceId || ''}`.trim(),
        gatewayResponse: {
          source: 'ACCEPTED_SNAPSHOT',
          acceptanceId: snapshot.acceptanceId || null,
          documentVersionId: snapshot.documentVersionId || null,
          checksumSha256: snapshot.checksumSha256 || null,
          planVersion: snapshot.planVersion ?? null,
          conversionId,
          action: isAmend ? 'AMEND' : 'CREATE',
        },
        createdAt: now,
        updatedAt: now,
      },
    });
  } catch (err) {
    const raced = await prisma.accountSubscription.findFirst({ where: { txRef } });
    if (raced) {
      return {
        ok: true,
        action: 'CREATE',
        subscriptionId: raced.id,
        tenantId,
        status: raced.status,
        isActive: Boolean(raced.isActive),
        idempotentReplay: true,
        subscriptionCreated: true,
        subscriptionAmended: false,
      };
    }
    return {
      ok: false,
      error: err?.message || 'subscription_create_failed',
      status: 'FAILED_RETRYABLE',
    };
  }

  if (hasResourceModel(prisma) && conversionId) {
    await prisma.crmConversionResource.create({
      data: {
        conversionId,
        resourceType: CRM_CONVERSION_RESOURCE_TYPE.SUBSCRIPTION,
        resourceId: created.id,
        action: 'CREATE',
        status: CRM_SUBSCRIPTION_PROVISION_STATUS.PENDING_ACTIVATION,
        idempotencyKey,
        metaJson: {
          tenantId,
          acceptanceId: snapshot.acceptanceId || null,
          planCode: snapshot.planCode || null,
          txRef,
        },
        actorAdminId: admin?.id || null,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  return {
    ok: true,
    action: 'CREATE',
    subscriptionId: created.id,
    tenantId,
    status: created.status,
    isActive: false,
    subscriptionCreated: true,
    subscriptionAmended: false,
  };
}
