/**
 * Onboarding CS handover create / accept — Phase 21 Wave 3.
 * Checksum + idempotent; does not overwrite Customer Health.
 */

import { createHash } from 'crypto';
import { loadOnboardingProjectForActor } from './projectAccess.js';
import {
  canManageOnboarding,
  hasCustomerOnboardingHandoverModel,
  serializeOnboardingHandover,
} from './model.js';
import { getOnboardingDomainContract, ONBOARDING_PROJECT_STATUS } from './catalogue.js';
import { transitionOnboardingProjectStatus } from './status.js';

export function computeOnboardingHandoverChecksum(payload = {}) {
  const canonical = {
    type: payload.type || 'ONBOARDING_CS_HANDOVER',
    projectId: payload.projectId || null,
    customerId: payload.customerId || null,
    tenantId: payload.tenantId || null,
    subscriptionId: payload.subscriptionId || null,
    openGaps: payload.openGaps || payload.openItemsJson || null,
    successCriteria: payload.successCriteria || null,
    recipients: payload.recipients || payload.recipientsJson || null,
    commercial: payload.commercial || null,
    implementation: payload.implementation || null,
    training: payload.training || null,
    migration: payload.migration || null,
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

/**
 * Pure guard — CS handover must never mutate Customer Health snapshots/scores.
 */
export function assertHandoverDoesNotOverwriteCustomerHealth(args = {}) {
  if (
    args.mutateCustomerHealth === true ||
    args.overwriteCustomerHealth === true ||
    args.writeCustomerHealthSnapshot === true
  ) {
    return {
      ok: false,
      error: 'cs_handover_must_not_overwrite_customer_health',
    };
  }
  return { ok: true, overwritesCustomerHealth: false };
}

export async function createOnboardingHandover(prisma, args = {}) {
  const loaded = await loadOnboardingProjectForActor(prisma, args);
  if (!loaded.ok) return loaded;
  if (!canManageOnboarding(loaded.admin)) {
    return { ok: false, forbidden: true, error: 'onboarding_handover_forbidden' };
  }
  if (!hasCustomerOnboardingHandoverModel(prisma)) {
    return {
      ok: false,
      error: 'customer_onboarding_handover_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const healthGuard = assertHandoverDoesNotOverwriteCustomerHealth(args);
  if (!healthGuard.ok) return healthGuard;

  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : '';
  if (!idempotencyKey) {
    return { ok: false, error: 'idempotencyKey_required' };
  }
  const existing = await prisma.customerOnboardingHandover.findUnique({
    where: { idempotencyKey },
  });
  if (existing) {
    if (existing.projectId !== loaded.project.id) {
      return { ok: false, error: 'idempotency_conflict' };
    }
    return {
      ok: true,
      alreadyExists: true,
      idempotentReplay: true,
      handover: serializeOnboardingHandover(existing),
      checksumSha256: existing.checksumSha256 || null,
    };
  }

  const packagePayload =
    args.packagePayload && typeof args.packagePayload === 'object'
      ? args.packagePayload
      : {
          type: 'ONBOARDING_CS_HANDOVER',
          projectId: loaded.project.id,
          customerId: loaded.project.customerId || null,
          tenantId: loaded.project.tenantId || null,
          subscriptionId: loaded.project.subscriptionId || null,
          openGaps: args.openItemsJson || null,
          recipients: args.recipients || args.recipientsJson || null,
          successCriteria: args.successCriteria || null,
        };

  const checksumSha256 = computeOnboardingHandoverChecksum(packagePayload);
  const now = args.now || new Date();
  const row = await prisma.customerOnboardingHandover.create({
    data: {
      projectId: loaded.project.id,
      status: 'PENDING',
      recipientsJson: args.recipients || args.recipientsJson || null,
      openItemsJson: args.openItemsJson || packagePayload.openGaps || null,
      packagePayloadJson: packagePayload,
      checksumSha256,
      idempotencyKey,
      createdByAdminId: loaded.admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    handover: serializeOnboardingHandover(row),
    checksumSha256,
    created: true,
    domain: getOnboardingDomainContract(),
    meta: { overwritesCustomerHealth: false },
  };
}

export async function acceptOnboardingHandover(prisma, args = {}) {
  const loaded = await loadOnboardingProjectForActor(prisma, args);
  if (!loaded.ok) return loaded;
  if (!canManageOnboarding(loaded.admin)) {
    return { ok: false, forbidden: true, error: 'onboarding_handover_forbidden' };
  }
  if (!hasCustomerOnboardingHandoverModel(prisma)) {
    return {
      ok: false,
      error: 'customer_onboarding_handover_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const healthGuard = assertHandoverDoesNotOverwriteCustomerHealth(args);
  if (!healthGuard.ok) return healthGuard;

  let row = null;
  if (args.handoverId) {
    row = await prisma.customerOnboardingHandover.findUnique({
      where: { id: String(args.handoverId) },
    });
  } else {
    row = await prisma.customerOnboardingHandover.findFirst({
      where: { projectId: loaded.project.id },
    });
  }
  if (!row || row.projectId !== loaded.project.id) {
    return { ok: false, notFound: true, error: 'handover_not_found' };
  }

  const now = args.now || new Date();
  row = await prisma.customerOnboardingHandover.update({
    where: { id: row.id },
    data: {
      status: 'ACCEPTED',
      acceptedAt: now,
      acceptedByAdminId: loaded.admin?.id || null,
      updatedAt: now,
    },
  });

  // Intentionally never touch customerHealthSnapshot / Customer Health scores.
  if (loaded.project.status === ONBOARDING_PROJECT_STATUS.HANDOVER_PENDING) {
    await transitionOnboardingProjectStatus(prisma, {
      ...args,
      projectId: loaded.project.id,
      toStatus: ONBOARDING_PROJECT_STATUS.COMPLETION_PENDING,
      reason: 'handover_accepted',
      now,
    });
  }

  return {
    ok: true,
    handover: serializeOnboardingHandover(row),
    domain: getOnboardingDomainContract(),
    meta: { overwritesCustomerHealth: false },
  };
}
