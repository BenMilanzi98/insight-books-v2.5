/**
 * Onboarding project load + Cross-Tenant / portfolio isolation — Phase 17 Wave 3/17.
 * Phase 21 Wave 1: portfolio fail-closed on create/accept by id.
 */

import {
  canManageOnboarding,
  canViewOnboarding,
  hasCustomerOnboardingProjectModel,
  resolveOnboardingActor,
} from './model.js';
import { resolveOnboardingListScope } from './listScope.js';

/**
 * Resolve actor tenant pin (explicit arg > actorContext.tenantId > admin.tenantId).
 */
export function resolveActorTenantId(args = {}) {
  if (args.tenantId != null && String(args.tenantId).trim()) {
    return String(args.tenantId).trim();
  }
  const ctx = args.actorContext || {};
  if (ctx.tenantId != null && String(ctx.tenantId).trim()) {
    return String(ctx.tenantId).trim();
  }
  const admin = resolveOnboardingActor(args);
  if (admin?.tenantId != null && String(admin.tenantId).trim()) {
    return String(admin.tenantId).trim();
  }
  return null;
}

/**
 * Fail-closed portfolio check for write-by-id paths (accept handoff / create Project).
 * Super Admin with mode=all may proceed; scoped actors must include tenantId.
 *
 * @returns {{ ok: true, scopeResult: object } | { ok: false, forbidden?: boolean, notFound?: boolean, error: string, reason?: string }}
 */
export async function assertOnboardingTenantInPortfolioScope(
  prisma,
  admin,
  tenantId,
  args = {}
) {
  const scopeResult = await resolveOnboardingListScope(prisma, admin, args);
  if (!scopeResult.ok) {
    if (scopeResult.forbidden) {
      return {
        ok: false,
        forbidden: true,
        error: 'onboarding_access_forbidden',
        reason: scopeResult.reason,
      };
    }
    return {
      ok: false,
      forbidden: true,
      notFound: true,
      error: 'onboarding_out_of_scope',
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
      error: 'onboarding_out_of_scope',
      lockedTenantId: tid,
    };
  }

  return { ok: true, scopeResult };
}

/**
 * Load project and enforce Cross-Tenant + portfolio denial for scoped actors.
 */
export async function loadOnboardingProjectForActor(prisma, args = {}) {
  const admin = resolveOnboardingActor(args);
  if (!canViewOnboarding(admin) && !canManageOnboarding(admin)) {
    return { ok: false, forbidden: true, error: 'onboarding_access_forbidden' };
  }
  if (!hasCustomerOnboardingProjectModel(prisma)) {
    return {
      ok: false,
      error: 'customer_onboarding_project_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const projectId = args.projectId ? String(args.projectId).trim() : '';
  if (!projectId) {
    return { ok: false, error: 'projectId_required' };
  }

  const project = await prisma.customerOnboardingProject.findUnique({
    where: { id: projectId },
  });
  if (!project) {
    return { ok: false, notFound: true, error: 'onboarding_project_not_found' };
  }

  const actorTenantId = resolveActorTenantId(args);
  if (
    actorTenantId &&
    project.tenantId &&
    String(project.tenantId).trim() !== actorTenantId
  ) {
    return {
      ok: false,
      forbidden: true,
      error: 'cross_tenant_denied',
      lockedTenantId: project.tenantId,
      requestedTenantId: actorTenantId,
    };
  }

  // Portfolio scope for CS-scoped actors (no pin still cannot open out-of-portfolio IDs)
  const scopeResult = await resolveOnboardingListScope(prisma, admin, args);
  if (!scopeResult.ok) {
    if (scopeResult.forbidden) {
      return { ok: false, forbidden: true, error: 'onboarding_access_forbidden' };
    }
    // Empty / missing portfolio for non-super → deny (do not fail-open by ID)
    return {
      ok: false,
      forbidden: true,
      notFound: true,
      error: 'onboarding_project_out_of_scope',
      reason: scopeResult.reason,
    };
  }

  if (
    scopeResult.tenantScope &&
    project.tenantId &&
    !scopeResult.tenantScope.includes(String(project.tenantId))
  ) {
    return {
      ok: false,
      forbidden: true,
      notFound: true,
      error: 'onboarding_project_out_of_scope',
      lockedTenantId: project.tenantId,
    };
  }

  return { ok: true, project, admin, actorTenantId };
}
