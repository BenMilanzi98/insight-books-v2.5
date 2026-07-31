/**
 * Customer Adoption Plans (ADP-YYYY-######) — Phase 19 Wave 1–2.
 * Requires pinned ACTIVE planTemplateVersionId. Wave 2 seeds milestone defs.
 */

import { createHash } from 'crypto';
import {
  ADOPTION_PLAN_STATUS,
  ADOPTION_REQUEST_STATUS,
  ADOPTION_TEMPLATE_STATUS,
  WAVE1_DEFAULT_PLAN_TEMPLATE_CODE,
  WAVE2_DEFAULT_MILESTONE_DEFS,
  getAdoptionDomainContract,
} from './catalogue.js';
import { allocateAdoptionPlanNumber } from './numbering.js';
import {
  canManageAdoption,
  canViewAdoption,
  hasCustomerAdoptionPlanModel,
  hasCustomerAdoptionPlanTemplateModel,
  hasCustomerAdoptionPlanTemplateVersionModel,
  resolveAdoptionActor,
  serializeAdoptionPlan,
  serializeAdoptionPlanTemplateVersion,
} from './model.js';
import { requestMissingPins } from './requests.js';
import { transitionAdoptionRequestStatus } from './status.js';
import {
  resolveAdoptionListScope,
  tenantWhereFromScope,
} from './listScope.js';
import { loadAdoptionRequestForActor } from './planAccess.js';

function hashPlanInput(payload) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function resolveOwnerPins(ownerAssignments = {}, admin = null) {
  const assignments =
    ownerAssignments && typeof ownerAssignments === 'object' ? ownerAssignments : {};
  const csOwnerAdminId =
    (assignments.csOwnerAdminId && String(assignments.csOwnerAdminId)) ||
    (assignments.csOwnerId && String(assignments.csOwnerId)) ||
    (admin?.id ? String(admin.id) : null);
  const ownerAdminId =
    (assignments.ownerAdminId && String(assignments.ownerAdminId)) ||
    csOwnerAdminId ||
    (admin?.id ? String(admin.id) : null);
  return { csOwnerAdminId, ownerAdminId };
}

async function ensureRequestConvertedToPlan(prisma, args = {}) {
  const { admin, request, plan, now, actorContext } = args;
  if (!request || !plan) return;
  if (request.status === ADOPTION_REQUEST_STATUS.CONVERTED_TO_PLAN) {
    if (!request.planId && plan.id) {
      await prisma.customerAdoptionRequest.update({
        where: { id: request.id },
        data: { planId: plan.id, updatedAt: now || new Date() },
      });
    }
    return;
  }
  if (request.status !== ADOPTION_REQUEST_STATUS.ACCEPTED) return;

  await transitionAdoptionRequestStatus(prisma, {
    admin,
    actorContext,
    adoptionRequestId: request.id,
    toStatus: ADOPTION_REQUEST_STATUS.CONVERTED_TO_PLAN,
    planId: plan.id,
    reason: 'converted_to_plan',
    now: now || new Date(),
  });
}

/**
 * Ensure seeded ACTIVE default plan template version exists (idempotent).
 */
export async function ensureWave1DefaultPlanTemplateVersion(prisma, args = {}) {
  const admin = resolveAdoptionActor(args);
  if (!canManageAdoption(admin)) {
    return {
      ok: false,
      forbidden: true,
      reason: 'adoption_template_seed_forbidden',
    };
  }
  if (!hasCustomerAdoptionPlanTemplateVersionModel(prisma)) {
    return {
      ok: false,
      error: 'customer_adoption_plan_template_version_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const existing = await prisma.customerAdoptionPlanTemplateVersion.findFirst({
    where: {
      templateCode: WAVE1_DEFAULT_PLAN_TEMPLATE_CODE,
      status: ADOPTION_TEMPLATE_STATUS.ACTIVE,
    },
  });
  if (existing) {
    return {
      ok: true,
      templateVersion: serializeAdoptionPlanTemplateVersion(existing),
      alreadyExists: true,
      domain: getAdoptionDomainContract(),
    };
  }

  const now = args.now || new Date();
  let templateId = null;

  if (hasCustomerAdoptionPlanTemplateModel(prisma)) {
    let template = await prisma.customerAdoptionPlanTemplate.findFirst({
      where: { templateCode: WAVE1_DEFAULT_PLAN_TEMPLATE_CODE },
    });
    if (!template) {
      template = await prisma.customerAdoptionPlanTemplate.create({
        data: {
          templateCode: WAVE1_DEFAULT_PLAN_TEMPLATE_CODE,
          name: 'Customer Adoption Default (Wave 1)',
          status: ADOPTION_TEMPLATE_STATUS.ACTIVE,
          createdByAdminId: admin?.id || null,
          createdAt: now,
          updatedAt: now,
        },
      });
    }
    templateId = template.id;
  }

  const row = await prisma.customerAdoptionPlanTemplateVersion.create({
    data: {
      templateId,
      templateCode: WAVE1_DEFAULT_PLAN_TEMPLATE_CODE,
      versionNumber: 1,
      status: ADOPTION_TEMPLATE_STATUS.ACTIVE,
      immutable: true,
      contentJson: {
        wave: 2,
        milestonesDeferred: false,
        valueOutcomesDeferred: false,
        milestones: [...WAVE2_DEFAULT_MILESTONE_DEFS],
      },
      createdByAdminId: admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    templateVersion: serializeAdoptionPlanTemplateVersion(row),
    created: true,
    domain: getAdoptionDomainContract(),
  };
}

/**
 * Create Adoption Plan from accepted Request. One Request → at most one Plan.
 */
export async function createCustomerAdoptionPlan(prisma, args = {}) {
  const admin = resolveAdoptionActor(args);
  if (!canManageAdoption(admin)) {
    return {
      ok: false,
      forbidden: true,
      reason: 'adoption_plan_create_forbidden',
    };
  }
  if (!hasCustomerAdoptionPlanModel(prisma)) {
    return {
      ok: false,
      error: 'customer_adoption_plan_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const adoptionRequestId = args.adoptionRequestId || args.requestId
    ? String(args.adoptionRequestId || args.requestId).trim()
    : '';
  if (!adoptionRequestId) {
    return { ok: false, error: 'adoption_request_id_required' };
  }

  const planTemplateVersionId =
    args.planTemplateVersionId || args.templateVersionId || null;
  if (!planTemplateVersionId) {
    return { ok: false, error: 'plan_template_version_id_required' };
  }

  if (hasCustomerAdoptionPlanTemplateVersionModel(prisma)) {
    const tmpl = await prisma.customerAdoptionPlanTemplateVersion.findUnique({
      where: { id: String(planTemplateVersionId) },
    });
    if (!tmpl) {
      return { ok: false, error: 'plan_template_version_not_found' };
    }
    if (String(tmpl.status).toUpperCase() !== 'ACTIVE') {
      return { ok: false, error: 'plan_template_version_not_active' };
    }
  }

  const access = await loadAdoptionRequestForActor(prisma, {
    ...args,
    admin,
    actorContext: args.actorContext || { admin },
    adoptionRequestId,
    requestId: adoptionRequestId,
  });
  if (!access.ok) return access;
  const request = access.requestRow || access.request;

  const missing = requestMissingPins(request);
  if (missing.length) {
    return {
      ok: false,
      error: `missing_required_pins: ${missing.join(',')}`,
      missing,
    };
  }

  const now = args.now || new Date();
  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : null;
  if (!idempotencyKey) {
    return { ok: false, error: 'idempotency_key_required' };
  }

  const ownerAssignments = args.ownerAssignments || {};
  const { csOwnerAdminId, ownerAdminId } = resolveOwnerPins(ownerAssignments, admin);
  const inputPayload = {
    adoptionRequestId,
    planTemplateVersionId: String(planTemplateVersionId),
    ownerAssignments,
  };
  const inputHash = hashPlanInput(inputPayload);

  const existingByKey = await prisma.customerAdoptionPlan.findUnique({
    where: { idempotencyKey },
  });
  if (existingByKey) {
    if (existingByKey.inputHash && existingByKey.inputHash !== inputHash) {
      return {
        ok: false,
        error: 'idempotency_conflict',
        existingInputHash: existingByKey.inputHash,
        attemptedInputHash: inputHash,
      };
    }
    await ensureRequestConvertedToPlan(prisma, {
      admin,
      actorContext: args.actorContext,
      request,
      plan: existingByKey,
      now,
    });
    return {
      ok: true,
      plan: serializeAdoptionPlan(existingByKey),
      alreadyExists: true,
      idempotentReplay: true,
      domain: getAdoptionDomainContract(),
    };
  }

  const existingByRequest = await prisma.customerAdoptionPlan.findFirst({
    where: { adoptionRequestId },
  });
  if (existingByRequest) {
    await ensureRequestConvertedToPlan(prisma, {
      admin,
      actorContext: args.actorContext,
      request,
      plan: existingByRequest,
      now,
    });
    return {
      ok: true,
      plan: serializeAdoptionPlan(existingByRequest),
      alreadyExists: true,
      idempotentReplay: true,
      domain: getAdoptionDomainContract(),
    };
  }

  if (
    request.status !== ADOPTION_REQUEST_STATUS.ACCEPTED &&
    request.status !== ADOPTION_REQUEST_STATUS.CONVERTED_TO_PLAN
  ) {
    return {
      ok: false,
      error: `invalid_status_for_plan_create: ${request.status}`,
    };
  }

  const allocated = await allocateAdoptionPlanNumber(prisma, { now });
  if (!allocated.ok) {
    return {
      ok: false,
      error: allocated.error || 'adoption_plan_number_allocation_failed',
    };
  }

  let row;
  try {
    row = await prisma.customerAdoptionPlan.create({
      data: {
        planNumber: allocated.number,
        status: ADOPTION_PLAN_STATUS.DRAFT,
        adoptionRequestId,
        trainingProgramId: request.trainingProgramId || null,
        onboardingProjectId: request.onboardingProjectId || null,
        onboardingHandoverId: request.onboardingHandoverId || null,
        customerId: request.customerId,
        tenantId: request.tenantId,
        subscriptionId: request.subscriptionId,
        planTemplateVersionId: String(planTemplateVersionId),
        successPlanId: args.successPlanId || null,
        ownerAssignmentsJson: ownerAssignments,
        csOwnerAdminId,
        ownerAdminId,
        inputHash,
        idempotencyKey,
        createdByAdminId: admin?.id || null,
        createdAt: now,
        updatedAt: now,
      },
    });
  } catch (err) {
    try {
      let raced = await prisma.customerAdoptionPlan.findUnique({
        where: { idempotencyKey },
      });
      if (!raced) {
        raced = await prisma.customerAdoptionPlan.findFirst({
          where: { adoptionRequestId },
        });
      }
      if (raced) {
        if (
          raced.idempotencyKey === idempotencyKey &&
          raced.inputHash &&
          raced.inputHash !== inputHash
        ) {
          return {
            ok: false,
            error: 'idempotency_conflict',
            existingInputHash: raced.inputHash,
            attemptedInputHash: inputHash,
          };
        }
        await ensureRequestConvertedToPlan(prisma, {
          admin,
          actorContext: args.actorContext,
          request,
          plan: raced,
          now,
        });
        return {
          ok: true,
          plan: serializeAdoptionPlan(raced),
          alreadyExists: true,
          idempotentReplay: true,
          domain: getAdoptionDomainContract(),
        };
      }
    } catch {
      // fall through
    }
    return { ok: false, error: err?.message || 'adoption_plan_create_failed' };
  }

  await ensureRequestConvertedToPlan(prisma, {
    admin,
    actorContext: args.actorContext,
    request,
    plan: row,
    now,
  });

  return {
    ok: true,
    plan: serializeAdoptionPlan(row),
    domain: getAdoptionDomainContract(),
  };
}

export async function listAdoptionPlans(prisma, args = {}) {
  const admin = resolveAdoptionActor(args);
  if (!canViewAdoption(admin) && !canManageAdoption(admin)) {
    return {
      ok: false,
      forbidden: true,
      error: 'adoption_list_forbidden',
      plans: [],
    };
  }
  if (!hasCustomerAdoptionPlanModel(prisma)) {
    return {
      ok: false,
      error: 'customer_adoption_plan_model_unavailable',
      status: 'UNAVAILABLE',
      plans: [],
    };
  }

  const scopeResult = await resolveAdoptionListScope(prisma, admin, args);
  if (!scopeResult.ok) {
    if (scopeResult.forbidden) {
      return {
        ok: false,
        forbidden: true,
        error: 'adoption_list_forbidden',
        plans: [],
      };
    }
    return {
      ok: true,
      plans: [],
      reason: scopeResult.reason,
      meta: { portfolioScoped: true, failClosed: true },
      domain: getAdoptionDomainContract(),
    };
  }

  const where = { ...tenantWhereFromScope(scopeResult.tenantScope) };
  const rows = await prisma.customerAdoptionPlan.findMany({ where });
  return {
    ok: true,
    plans: rows.map(serializeAdoptionPlan),
    meta: {
      portfolioScoped: scopeResult.portfolioScoped,
      failClosed: scopeResult.portfolioScoped,
    },
    domain: getAdoptionDomainContract(),
  };
}
