/**
 * Cutover coordination — Phase 21 Wave 3 (G21-17).
 * Distinct from go-live SUCCESSFUL; schedule/cutover readiness ≠ live success.
 */

import { loadOnboardingProjectForActor } from './projectAccess.js';
import {
  canManageOnboarding,
  hasCustomerOnboardingCutoverModel,
  serializeOnboardingCutover,
} from './model.js';
import { getOnboardingDomainContract } from './catalogue.js';

const GO_LIVE_SUCCESS = new Set(['SUCCESSFUL', 'COMPLETED']);

/**
 * Pure guard — cutover COMPLETED/READY must never be treated as go-live success.
 */
export function assertCutoverDistinctFromGoLiveSuccess(args = {}) {
  if (args.treatCutoverAsGoLiveSuccess === true) {
    return {
      ok: false,
      error: 'cutover_must_remain_distinct_from_go_live_success',
      goLiveSuccessful: false,
    };
  }
  const cutoverStatus = String(args.cutoverStatus || '').toUpperCase();
  const goLiveOutcome = String(args.goLiveOutcome || '').toUpperCase();
  const goLiveSuccessful = GO_LIVE_SUCCESS.has(goLiveOutcome);
  if (
    (cutoverStatus === 'COMPLETED' || cutoverStatus === 'READY') &&
    !goLiveSuccessful &&
    args.inferGoLiveFromCutover === true
  ) {
    return {
      ok: false,
      error: 'cutover_must_remain_distinct_from_go_live_success',
      goLiveSuccessful: false,
    };
  }
  return {
    ok: true,
    goLiveSuccessful,
    cutoverStatus: cutoverStatus || null,
  };
}

export async function recordCutoverCoordination(prisma, args = {}) {
  const loaded = await loadOnboardingProjectForActor(prisma, args);
  if (!loaded.ok) return loaded;
  if (!canManageOnboarding(loaded.admin)) {
    return { ok: false, forbidden: true, error: 'onboarding_cutover_forbidden' };
  }
  if (!hasCustomerOnboardingCutoverModel(prisma)) {
    return {
      ok: false,
      error: 'customer_onboarding_cutover_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : '';
  if (idempotencyKey) {
    const existing = await prisma.customerOnboardingCutover.findUnique({
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
        cutover: serializeOnboardingCutover(existing),
        created: false,
      };
    }
  }

  const now = args.now || new Date();
  const status = String(args.status || 'PLANNED')
    .trim()
    .toUpperCase();
  const existingForProject = await prisma.customerOnboardingCutover.findFirst({
    where: { projectId: loaded.project.id },
  });

  const data = {
    projectId: loaded.project.id,
    status,
    checklistJson: args.checklistJson ?? existingForProject?.checklistJson ?? null,
    rollbackPlanJson:
      args.rollbackPlanJson ?? existingForProject?.rollbackPlanJson ?? null,
    idempotencyKey: idempotencyKey || existingForProject?.idempotencyKey || null,
    updatedAt: now,
  };

  const row = existingForProject
    ? await prisma.customerOnboardingCutover.update({
        where: { id: existingForProject.id },
        data,
      })
    : await prisma.customerOnboardingCutover.create({
        data: {
          ...data,
          createdByAdminId: loaded.admin?.id || null,
          createdAt: now,
        },
      });

  return {
    ok: true,
    created: !existingForProject,
    cutover: serializeOnboardingCutover(row),
    domain: getOnboardingDomainContract(),
    meta: {
      impliesGoLiveSuccess: false,
      distinctFromGoLive: true,
    },
  };
}
