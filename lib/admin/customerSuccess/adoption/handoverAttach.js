/**
 * Attach Phase 17 onboarding handover to Adoption Request or Plan.
 * Attach only — never invents Training Program COMPLETED.
 */

import { getAdoptionDomainContract } from './catalogue.js';
import {
  canManageAdoption,
  hasCustomerAdoptionPlanModel,
  hasCustomerAdoptionRequestModel,
  resolveAdoptionActor,
  serializeAdoptionPlan,
  serializeAdoptionRequest,
} from './model.js';
import {
  loadAdoptionPlanForActor,
  loadAdoptionRequestForActor,
} from './planAccess.js';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ actorContext?: object, admin?: object, handoverId: string, requestId?: string, planId?: string, adoptionRequestId?: string, adoptionPlanId?: string, idempotencyKey: string, now?: Date }} args
 */
export async function attachOnboardingHandoverToAdoption(prisma, args = {}) {
  const admin = resolveAdoptionActor(args);
  if (!canManageAdoption(admin)) {
    return {
      ok: false,
      forbidden: true,
      reason: 'adoption_handover_attach_forbidden',
    };
  }

  const handoverId = args.handoverId ? String(args.handoverId).trim() : '';
  if (!handoverId) {
    return { ok: false, error: 'handover_id_required' };
  }

  const requestId = args.requestId || args.adoptionRequestId
    ? String(args.requestId || args.adoptionRequestId).trim()
    : '';
  const planId = args.planId || args.adoptionPlanId
    ? String(args.planId || args.adoptionPlanId).trim()
    : '';

  if (!requestId && !planId) {
    return { ok: false, error: 'requestId_or_planId_required' };
  }

  const now = args.now || new Date();
  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : `adr-handover-attach:${handoverId}:${requestId || planId}`;

  if (requestId) {
    if (!hasCustomerAdoptionRequestModel(prisma)) {
      return {
        ok: false,
        error: 'customer_adoption_request_model_unavailable',
        status: 'UNAVAILABLE',
      };
    }
    const access = await loadAdoptionRequestForActor(prisma, {
      ...args,
      admin,
      actorContext: args.actorContext || { admin },
      requestId,
      adoptionRequestId: requestId,
    });
    if (!access.ok) return access;
    const request = access.requestRow || access.request;

    if (
      request.onboardingHandoverId &&
      String(request.onboardingHandoverId) === handoverId
    ) {
      return {
        ok: true,
        request: serializeAdoptionRequest(request),
        handoverId,
        alreadyAttached: true,
        idempotentReplay: true,
        trainingCompleted: false,
        fabricatedTrainingCompleted: false,
        domain: getAdoptionDomainContract(),
      };
    }

    const updated = await prisma.customerAdoptionRequest.update({
      where: { id: request.id },
      data: {
        onboardingHandoverId: handoverId,
        payloadJson: {
          ...(request.payloadJson && typeof request.payloadJson === 'object'
            ? request.payloadJson
            : {}),
          onboardingHandoverId: handoverId,
          handoverAttachIdempotencyKey: idempotencyKey,
          fabricatedTrainingCompleted: false,
        },
        updatedAt: now,
      },
    });

    return {
      ok: true,
      request: serializeAdoptionRequest(updated),
      handoverId,
      trainingCompleted: false,
      fabricatedTrainingCompleted: false,
      domain: getAdoptionDomainContract(),
    };
  }

  if (!hasCustomerAdoptionPlanModel(prisma)) {
    return {
      ok: false,
      error: 'customer_adoption_plan_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const planAccess = await loadAdoptionPlanForActor(prisma, {
    ...args,
    admin,
    actorContext: args.actorContext || { admin },
    planId,
    adoptionPlanId: planId,
  });
  if (!planAccess.ok) return planAccess;
  const plan = planAccess.planRow || planAccess.plan;

  if (plan.onboardingHandoverId && String(plan.onboardingHandoverId) === handoverId) {
    return {
      ok: true,
      plan: serializeAdoptionPlan(plan),
      handoverId,
      alreadyAttached: true,
      idempotentReplay: true,
      trainingCompleted: false,
      fabricatedTrainingCompleted: false,
      domain: getAdoptionDomainContract(),
    };
  }

  const updated = await prisma.customerAdoptionPlan.update({
    where: { id: plan.id },
    data: {
      onboardingHandoverId: handoverId,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    plan: serializeAdoptionPlan(updated),
    handoverId,
    trainingCompleted: false,
    fabricatedTrainingCompleted: false,
    domain: getAdoptionDomainContract(),
  };
}
