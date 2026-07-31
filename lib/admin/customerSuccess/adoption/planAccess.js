/**
 * Adoption Plan / Request load + Cross-Tenant isolation — Phase 19 Wave 1.
 */

import {
  canManageAdoption,
  canViewAdoption,
  hasCustomerAdoptionPlanModel,
  hasCustomerAdoptionRequestModel,
  resolveAdoptionActor,
  serializeAdoptionPlan,
  serializeAdoptionRequest,
} from './model.js';
import { resolveAdoptionListScope } from './listScope.js';

export function resolveActorTenantId(args = {}) {
  if (args.tenantId != null && String(args.tenantId).trim()) {
    return String(args.tenantId).trim();
  }
  const ctx = args.actorContext || {};
  if (ctx.tenantId != null && String(ctx.tenantId).trim()) {
    return String(ctx.tenantId).trim();
  }
  const admin = resolveAdoptionActor(args);
  if (admin?.tenantId != null && String(admin.tenantId).trim()) {
    return String(admin.tenantId).trim();
  }
  return null;
}

export async function loadAdoptionPlanForActor(prisma, args = {}) {
  const admin = resolveAdoptionActor(args);
  if (!canViewAdoption(admin) && !canManageAdoption(admin)) {
    return { ok: false, forbidden: true, error: 'adoption_access_forbidden' };
  }
  if (!hasCustomerAdoptionPlanModel(prisma)) {
    return {
      ok: false,
      error: 'customer_adoption_plan_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const planId = args.planId || args.adoptionPlanId
    ? String(args.planId || args.adoptionPlanId).trim()
    : '';
  if (!planId) {
    return { ok: false, error: 'planId_required' };
  }

  const plan = await prisma.customerAdoptionPlan.findUnique({
    where: { id: planId },
  });
  if (!plan) {
    return { ok: false, notFound: true, error: 'adoption_plan_not_found' };
  }

  const actorTenantId = resolveActorTenantId(args);
  if (
    actorTenantId &&
    plan.tenantId &&
    String(plan.tenantId).trim() !== actorTenantId
  ) {
    return {
      ok: false,
      forbidden: true,
      error: 'cross_tenant_denied',
      lockedTenantId: plan.tenantId,
      requestedTenantId: actorTenantId,
    };
  }

  const scopeResult = await resolveAdoptionListScope(prisma, admin, args);
  if (!scopeResult.ok) {
    if (scopeResult.forbidden) {
      return { ok: false, forbidden: true, error: 'adoption_access_forbidden' };
    }
    return {
      ok: false,
      forbidden: true,
      notFound: true,
      error: 'adoption_plan_out_of_scope',
      reason: scopeResult.reason,
    };
  }

  if (
    scopeResult.tenantScope &&
    plan.tenantId &&
    !scopeResult.tenantScope.includes(String(plan.tenantId))
  ) {
    return {
      ok: false,
      forbidden: true,
      notFound: true,
      error: 'adoption_plan_out_of_scope',
      lockedTenantId: plan.tenantId,
    };
  }

  return {
    ok: true,
    plan: serializeAdoptionPlan(plan),
    planRow: plan,
    admin,
    actorTenantId,
  };
}

export async function loadAdoptionRequestForActor(prisma, args = {}) {
  const admin = resolveAdoptionActor(args);
  if (!canViewAdoption(admin) && !canManageAdoption(admin)) {
    return { ok: false, forbidden: true, error: 'adoption_access_forbidden' };
  }
  if (!hasCustomerAdoptionRequestModel(prisma)) {
    return {
      ok: false,
      error: 'customer_adoption_request_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const requestId = args.adoptionRequestId || args.requestId
    ? String(args.adoptionRequestId || args.requestId).trim()
    : '';
  if (!requestId) {
    return { ok: false, error: 'requestId_required' };
  }

  const request = await prisma.customerAdoptionRequest.findUnique({
    where: { id: requestId },
  });
  if (!request) {
    return { ok: false, notFound: true, error: 'adoption_request_not_found' };
  }

  const actorTenantId = resolveActorTenantId(args);
  if (
    actorTenantId &&
    request.tenantId &&
    String(request.tenantId).trim() !== actorTenantId
  ) {
    return {
      ok: false,
      forbidden: true,
      error: 'cross_tenant_denied',
      lockedTenantId: request.tenantId,
      requestedTenantId: actorTenantId,
    };
  }

  const scopeResult = await resolveAdoptionListScope(prisma, admin, args);
  if (!scopeResult.ok) {
    if (scopeResult.forbidden) {
      return { ok: false, forbidden: true, error: 'adoption_access_forbidden' };
    }
    return {
      ok: false,
      forbidden: true,
      notFound: true,
      error: 'adoption_request_out_of_scope',
      reason: scopeResult.reason,
    };
  }

  if (
    scopeResult.tenantScope &&
    request.tenantId &&
    !scopeResult.tenantScope.includes(String(request.tenantId))
  ) {
    return {
      ok: false,
      forbidden: true,
      notFound: true,
      error: 'adoption_request_out_of_scope',
      lockedTenantId: request.tenantId,
    };
  }

  return {
    ok: true,
    request: serializeAdoptionRequest(request),
    requestRow: request,
    admin,
    actorTenantId,
  };
}
