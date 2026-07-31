/**
 * Wave 3 — Entitlement provision from accepted snapshot.
 * Quantity ≤ accepted; no hidden/unquoted features. Pending until activation.
 */

import {
  ENTITLEMENT_SOURCES,
  ENTITLEMENT_STATUSES,
  validateEntitlementWrite,
} from '../../featureEntitlements.js';
import {
  CRM_CONVERSION_RESOURCE_TYPE,
} from './catalogue.js';
import { resolveConversionActor } from './model.js';
import { stripFabricatedProvisionArgs } from './requestHonesty.js';

function hasEntitlementModel(prisma) {
  return (
    typeof prisma?.platformFeatureEntitlement?.create === 'function' ||
    typeof prisma?.platformFeatureEntitlement?.upsert === 'function'
  );
}

function hasResourceModel(prisma) {
  return typeof prisma?.crmConversionResource?.create === 'function';
}

function acceptedQtyByFeature(snapshot) {
  const map = new Map();
  for (const li of snapshot?.lineItems || []) {
    const code = String(li.featureCode || li.productRef || '').trim();
    if (!code) continue;
    const qty = Number(li.quantity);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    map.set(code, (map.get(code) || 0) + qty);
  }
  return map;
}

/**
 * Provision entitlements from accepted line items.
 * Rejects qty > accepted; never grants features absent from snapshot.
 */
export async function provisionEntitlementsFromAccepted(prisma, args = {}) {
  // Ignore forceActive / ACTIVATED — entitlements stay PENDING until activation.
  args = stripFabricatedProvisionArgs(args);
  const admin = resolveConversionActor(args);
  const conversionId = args.conversionId ? String(args.conversionId) : null;
  const tenantId = args.tenantId ? String(args.tenantId).trim() : '';
  const subscriptionId = args.subscriptionId || null;
  const snapshot = args.acceptedSnapshot;
  const idempotencyKey =
    args.idempotencyKey ||
    (conversionId ? `ent:${conversionId}` : null);
  const now = args.now || new Date();

  if (!tenantId) return { ok: false, error: 'tenantId_required' };
  if (!snapshot || typeof snapshot !== 'object') {
    return { ok: false, error: 'accepted_snapshot_required' };
  }
  if (!idempotencyKey) return { ok: false, error: 'idempotencyKey_required' };

  if (!hasEntitlementModel(prisma)) {
    return {
      ok: false,
      error: 'entitlement_model_unavailable',
      status: 'NOT_AVAILABLE',
    };
  }

  if (hasResourceModel(prisma) && conversionId) {
    const existingRes = await prisma.crmConversionResource.findFirst({
      where: {
        conversionId,
        resourceType: CRM_CONVERSION_RESOURCE_TYPE.ENTITLEMENT_SET,
        idempotencyKey,
      },
    });
    if (existingRes?.resourceId) {
      return {
        ok: true,
        entitlementIds: existingRes.metaJson?.entitlementIds || [],
        quantities: existingRes.metaJson?.quantities || {},
        idempotentReplay: true,
        status: existingRes.status || ENTITLEMENT_STATUSES.PENDING,
      };
    }
  }

  const acceptedMap = acceptedQtyByFeature(snapshot);
  const requested =
    Array.isArray(args.requestedEntitlements) && args.requestedEntitlements.length
      ? args.requestedEntitlements
      : [...acceptedMap.entries()].map(([featureCode, quantity]) => ({
          featureCode,
          quantity,
        }));

  // Validate quantities and reject hidden features
  for (const req of requested) {
    const code = String(req.featureCode || '').trim();
    const qty = Number(req.quantity);
    if (!code) {
      return { ok: false, error: 'featureCode_required' };
    }
    if (!acceptedMap.has(code)) {
      return {
        ok: false,
        error: 'hidden_entitlement_forbidden',
        featureCode: code,
      };
    }
    const acceptedQty = acceptedMap.get(code);
    if (!Number.isFinite(qty) || qty <= 0) {
      return { ok: false, error: 'invalid_entitlement_quantity', featureCode: code };
    }
    if (qty > acceptedQty) {
      return {
        ok: false,
        error: 'entitlement_qty_exceeds_accepted',
        featureCode: code,
        requested: qty,
        accepted: acceptedQty,
      };
    }
  }

  const entitlementIds = [];
  const quantities = {};

  for (const req of requested) {
    const featureCode = String(req.featureCode).trim();
    const quantity = Number(req.quantity);
    const writeCheck = validateEntitlementWrite({
      featureCode,
      tenantId,
      status: ENTITLEMENT_STATUSES.PENDING,
    });
    if (!writeCheck.ok) {
      return { ok: false, error: writeCheck.error || 'entitlement_write_invalid' };
    }

    let row;
    if (typeof prisma.platformFeatureEntitlement.upsert === 'function') {
      row = await prisma.platformFeatureEntitlement.upsert({
        where: {
          tenantId_featureCode: { tenantId, featureCode },
        },
        create: {
          tenantId,
          featureCode,
          featureName: featureCode,
          source: ENTITLEMENT_SOURCES.PLAN,
          status: ENTITLEMENT_STATUSES.PENDING,
          reason: `Conversion provision qty=${quantity}; subscription=${subscriptionId || 'n/a'}`,
          grantedBy: admin?.id || null,
          startDate: null,
          endDate: null,
          createdAt: now,
          updatedAt: now,
        },
        update: {
          status: ENTITLEMENT_STATUSES.PENDING,
          reason: `Conversion provision qty=${quantity}; subscription=${subscriptionId || 'n/a'}`,
          grantedBy: admin?.id || null,
          updatedAt: now,
        },
      });
    } else {
      const existing = await prisma.platformFeatureEntitlement.findFirst({
        where: { tenantId, featureCode },
      });
      if (existing) {
        row = await prisma.platformFeatureEntitlement.update({
          where: { id: existing.id },
          data: {
            status: ENTITLEMENT_STATUSES.PENDING,
            reason: `Conversion provision qty=${quantity}`,
            updatedAt: now,
          },
        });
      } else {
        row = await prisma.platformFeatureEntitlement.create({
          data: {
            tenantId,
            featureCode,
            featureName: featureCode,
            source: ENTITLEMENT_SOURCES.PLAN,
            status: ENTITLEMENT_STATUSES.PENDING,
            reason: `Conversion provision qty=${quantity}`,
            grantedBy: admin?.id || null,
            createdAt: now,
            updatedAt: now,
          },
        });
      }
    }

    entitlementIds.push(row.id);
    quantities[featureCode] = quantity;
  }

  if (hasResourceModel(prisma) && conversionId) {
    await prisma.crmConversionResource.create({
      data: {
        conversionId,
        resourceType: CRM_CONVERSION_RESOURCE_TYPE.ENTITLEMENT_SET,
        resourceId: entitlementIds[0] || `ent-set:${conversionId}`,
        action: 'PROVISION',
        status: ENTITLEMENT_STATUSES.PENDING,
        idempotencyKey,
        metaJson: {
          entitlementIds,
          quantities,
          subscriptionId,
          acceptanceId: snapshot.acceptanceId || null,
        },
        actorAdminId: admin?.id || null,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  return {
    ok: true,
    entitlementIds,
    quantities,
    status: ENTITLEMENT_STATUSES.PENDING,
    activated: false,
  };
}
