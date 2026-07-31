/**
 * Conversion commercial snapshot lock — Phase 20 Wave 2.
 * Immutable deep-copy + checksum after lock. Proposal draft edits must not
 * mutate the locked conversion snapshot (material change → amendment conversion).
 */

import { createHash } from 'crypto';
import { CRM_CONVERSION_RESOURCE_TYPE } from './catalogue.js';
import { resolveConversionActor } from './model.js';

function deepClone(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

export function checksumCommercialSnapshot(snapshot) {
  const canonical = JSON.stringify(snapshot ?? null);
  return createHash('sha256').update(canonical).digest('hex');
}

function hasResourceModel(prisma) {
  return typeof prisma?.crmConversionResource?.create === 'function';
}

/**
 * Prefer locked conversion snapshot over live plan / args (fail-closed honesty).
 */
export function resolveConversionAcceptedSnapshot({
  lockedSnapshot = null,
  planSnapshot = null,
  argsSnapshot = null,
  plan = null,
} = {}) {
  if (lockedSnapshot && typeof lockedSnapshot === 'object') {
    return deepClone(lockedSnapshot);
  }
  const fromPlan =
    planSnapshot ||
    plan?.acceptedSnapshot ||
    plan?.pricingSnapshot ||
    null;
  if (fromPlan && typeof fromPlan === 'object') return deepClone(fromPlan);
  if (argsSnapshot && typeof argsSnapshot === 'object') return deepClone(argsSnapshot);
  return null;
}

/**
 * Lock a deep-copied commercial snapshot onto the Conversion.
 * Exact retry (same conversionId) returns existing lock; does not overwrite.
 */
export async function lockConversionCommercialSnapshot(prisma, args = {}) {
  const admin = resolveConversionActor(args);
  const conversionId = args.conversionId ? String(args.conversionId).trim() : '';
  if (!conversionId) {
    return { ok: false, error: 'conversionId_required' };
  }
  if (!hasResourceModel(prisma)) {
    return { ok: false, error: 'crm_conversion_resource_model_unavailable' };
  }

  const idempotencyKey =
    args.idempotencyKey || `commercial-snapshot:${conversionId}`;

  const existing = await prisma.crmConversionResource.findFirst({
    where: {
      conversionId,
      resourceType: CRM_CONVERSION_RESOURCE_TYPE.COMMERCIAL_SNAPSHOT,
      idempotencyKey,
    },
  });
  if (existing) {
    const meta = existing.metaJson || {};
    return {
      ok: true,
      locked: true,
      immutable: true,
      idempotentReplay: true,
      checksumSha256: meta.checksumSha256 || existing.resourceId || null,
      snapshot: deepClone(meta.snapshot || null),
      resourceId: existing.id,
    };
  }

  const snapshot = deepClone(args.snapshot || null);
  if (!snapshot || typeof snapshot !== 'object') {
    return { ok: false, error: 'snapshot_required' };
  }

  const checksumSha256 =
    args.checksumSha256 ||
    snapshot.checksumSha256 ||
    checksumCommercialSnapshot(snapshot);
  const now = args.now || new Date();

  // Ensure nested commercial fields cannot be shared-mutated later
  const lockedCopy = deepClone({
    ...snapshot,
    acceptanceId: args.acceptanceId || snapshot.acceptanceId || null,
    documentVersionId: args.documentVersionId || snapshot.documentVersionId || null,
    checksumSha256,
    lockedAt: now.toISOString?.() || new Date(now).toISOString(),
    immutable: true,
  });

  const row = await prisma.crmConversionResource.create({
    data: {
      conversionId,
      resourceType: CRM_CONVERSION_RESOURCE_TYPE.COMMERCIAL_SNAPSHOT,
      resourceId: checksumSha256,
      action: 'LOCK',
      status: 'LOCKED',
      idempotencyKey,
      metaJson: {
        snapshot: lockedCopy,
        checksumSha256,
        acceptanceId: lockedCopy.acceptanceId,
        documentVersionId: lockedCopy.documentVersionId,
        immutable: true,
        lockedAt: lockedCopy.lockedAt,
      },
      actorAdminId: admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    locked: true,
    immutable: true,
    idempotentReplay: false,
    checksumSha256,
    snapshot: deepClone(lockedCopy),
    resourceId: row.id,
  };
}

export async function getLockedConversionCommercialSnapshot(prisma, args = {}) {
  const conversionId = args.conversionId ? String(args.conversionId).trim() : '';
  if (!conversionId) {
    return { ok: false, error: 'conversionId_required' };
  }
  if (!hasResourceModel(prisma)) {
    return { ok: false, error: 'crm_conversion_resource_model_unavailable' };
  }

  const existing = await prisma.crmConversionResource.findFirst({
    where: {
      conversionId,
      resourceType: CRM_CONVERSION_RESOURCE_TYPE.COMMERCIAL_SNAPSHOT,
    },
  });
  if (!existing) {
    return { ok: false, notFound: true, error: 'commercial_snapshot_not_locked' };
  }

  const meta = existing.metaJson || {};
  return {
    ok: true,
    locked: true,
    immutable: true,
    checksumSha256: meta.checksumSha256 || existing.resourceId || null,
    snapshot: deepClone(meta.snapshot || null),
    resourceId: existing.id,
  };
}
