/**
 * Training Program / Request load + Cross-Tenant isolation — Phase 18 Wave 3.
 */

import {
  canManageTraining,
  canViewTraining,
  hasCustomerTrainingProgramModel,
  hasCustomerTrainingRequestModel,
  resolveTrainingActor,
  serializeTrainingProgram,
  serializeTrainingRequest,
} from './model.js';
import { resolveTrainingListScope } from './listScope.js';

/**
 * Portfolio fail-closed gate for writes by tenant id (accept / Program create).
 * Mirrors onboarding assertOnboardingTenantInPortfolioScope.
 */
export async function assertTrainingTenantInPortfolioScope(
  prisma,
  admin,
  tenantId,
  args = {}
) {
  const scopeResult = await resolveTrainingListScope(prisma, admin, args);
  if (!scopeResult.ok) {
    if (scopeResult.forbidden) {
      return {
        ok: false,
        forbidden: true,
        error: 'training_access_forbidden',
        reason: scopeResult.reason,
      };
    }
    return {
      ok: false,
      forbidden: true,
      notFound: true,
      error: 'training_out_of_scope',
      reason: scopeResult.reason,
    };
  }

  const tid = tenantId != null ? String(tenantId).trim() : '';
  if (
    scopeResult.tenantScope &&
    tid &&
    !scopeResult.tenantScope.includes(tid)
  ) {
    return {
      ok: false,
      forbidden: true,
      notFound: true,
      error: 'training_out_of_scope',
      lockedTenantId: tid,
    };
  }

  return { ok: true, scopeResult };
}

export function resolveActorTenantId(args = {}) {
  if (args.tenantId != null && String(args.tenantId).trim()) {
    return String(args.tenantId).trim();
  }
  const ctx = args.actorContext || {};
  if (ctx.tenantId != null && String(ctx.tenantId).trim()) {
    return String(ctx.tenantId).trim();
  }
  const admin = resolveTrainingActor(args);
  if (admin?.tenantId != null && String(admin.tenantId).trim()) {
    return String(admin.tenantId).trim();
  }
  return null;
}

/**
 * Load program and enforce Cross-Tenant + portfolio denial for scoped actors.
 */
export async function loadTrainingProgramForActor(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canViewTraining(admin) && !canManageTraining(admin)) {
    return { ok: false, forbidden: true, error: 'training_access_forbidden' };
  }
  if (!hasCustomerTrainingProgramModel(prisma)) {
    return {
      ok: false,
      error: 'customer_training_program_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const programId = args.programId ? String(args.programId).trim() : '';
  if (!programId) {
    return { ok: false, error: 'programId_required' };
  }

  const program = await prisma.customerTrainingProgram.findUnique({
    where: { id: programId },
  });
  if (!program) {
    return { ok: false, notFound: true, error: 'training_program_not_found' };
  }

  const actorTenantId = resolveActorTenantId(args);
  if (
    actorTenantId &&
    program.tenantId &&
    String(program.tenantId).trim() !== actorTenantId
  ) {
    return {
      ok: false,
      forbidden: true,
      error: 'cross_tenant_denied',
      lockedTenantId: program.tenantId,
      requestedTenantId: actorTenantId,
    };
  }

  const scopeResult = await resolveTrainingListScope(prisma, admin, args);
  if (!scopeResult.ok) {
    if (scopeResult.forbidden) {
      return { ok: false, forbidden: true, error: 'training_access_forbidden' };
    }
    return {
      ok: false,
      forbidden: true,
      notFound: true,
      error: 'training_program_out_of_scope',
      reason: scopeResult.reason,
    };
  }

  if (
    scopeResult.tenantScope &&
    program.tenantId &&
    !scopeResult.tenantScope.includes(String(program.tenantId))
  ) {
    return {
      ok: false,
      forbidden: true,
      notFound: true,
      error: 'training_program_out_of_scope',
      lockedTenantId: program.tenantId,
    };
  }

  return {
    ok: true,
    program: serializeTrainingProgram(program),
    programRow: program,
    admin,
    actorTenantId,
  };
}

/**
 * Load request and enforce Cross-Tenant + portfolio denial for scoped actors.
 */
export async function loadTrainingRequestForActor(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canViewTraining(admin) && !canManageTraining(admin)) {
    return { ok: false, forbidden: true, error: 'training_access_forbidden' };
  }
  if (!hasCustomerTrainingRequestModel(prisma)) {
    return {
      ok: false,
      error: 'customer_training_request_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const requestId = args.trainingRequestId || args.requestId
    ? String(args.trainingRequestId || args.requestId).trim()
    : '';
  if (!requestId) {
    return { ok: false, error: 'requestId_required' };
  }

  const request = await prisma.customerTrainingRequest.findUnique({
    where: { id: requestId },
  });
  if (!request) {
    return { ok: false, notFound: true, error: 'training_request_not_found' };
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

  const scopeResult = await resolveTrainingListScope(prisma, admin, args);
  if (!scopeResult.ok) {
    if (scopeResult.forbidden) {
      return { ok: false, forbidden: true, error: 'training_access_forbidden' };
    }
    return {
      ok: false,
      forbidden: true,
      notFound: true,
      error: 'training_request_out_of_scope',
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
      error: 'training_request_out_of_scope',
      lockedTenantId: request.tenantId,
    };
  }

  return {
    ok: true,
    request: serializeTrainingRequest(request),
    requestRow: request,
    admin,
    actorTenantId,
  };
}
