/**
 * Scope mismatch detection — creates Change Request; never mutates Subscription.
 */

import {
  ONBOARDING_CHANGE_REQUEST_REASON,
  getOnboardingDomainContract,
} from './catalogue.js';
import { createOnboardingChangeRequest } from './changeRequests.js';
import {
  canManageOnboarding,
  hasCustomerOnboardingProjectModel,
  resolveOnboardingActor,
} from './model.js';

function normalizeScope(scope = {}) {
  return {
    planCode: String(scope.planCode || '').trim().toUpperCase() || null,
    addOns: Array.isArray(scope.addOns)
      ? [...scope.addOns].map((a) => String(a).trim().toUpperCase()).sort()
      : [],
    quantity: scope.quantity != null ? Number(scope.quantity) : null,
    businesses: scope.businesses != null ? Number(scope.businesses) : null,
    branches: scope.branches != null ? Number(scope.branches) : null,
  };
}

function scopesEqual(a, b) {
  return JSON.stringify(normalizeScope(a)) === JSON.stringify(normalizeScope(b));
}

/**
 * Compare requested vs confirmed (or accepted commercial) scope.
 * On mismatch → Change Request; does not call subscription.update.
 */
export async function detectScopeMismatch(prisma, args = {}) {
  const admin = resolveOnboardingActor(args);
  if (!canManageOnboarding(admin)) {
    return { ok: false, forbidden: true, reason: 'onboarding_scope_forbidden' };
  }
  if (!hasCustomerOnboardingProjectModel(prisma)) {
    return {
      ok: false,
      error: 'customer_onboarding_project_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const projectId = args.projectId ? String(args.projectId).trim() : '';
  if (!projectId) return { ok: false, error: 'projectId_required' };

  const project = await prisma.customerOnboardingProject.findUnique({
    where: { id: projectId },
  });
  if (!project) return { ok: false, error: 'project_not_found' };

  let confirmedScope = args.confirmedScope || null;
  if (!confirmedScope && typeof prisma.customerOnboardingRequirement?.findFirst === 'function') {
    const req = await prisma.customerOnboardingRequirement.findFirst({
      where: { projectId },
    });
    confirmedScope = req?.confirmedScopeJson || null;
  }
  if (!confirmedScope) {
    return { ok: false, error: 'confirmed_scope_required' };
  }

  // Omitted/null requestedScope must not coerce to {} and open a false SCOPE_MISMATCH CR
  if (args.requestedScope == null) {
    return {
      ok: true,
      mismatch: false,
      hasMismatch: false,
      skipped: true,
      reason: 'requested_scope_omitted',
      subscriptionMutated: false,
      domain: getOnboardingDomainContract(),
    };
  }

  const requestedScope = args.requestedScope;
  const hasMismatch = !scopesEqual(confirmedScope, requestedScope);

  if (!hasMismatch) {
    return {
      ok: true,
      mismatch: false,
      hasMismatch: false,
      subscriptionMutated: false,
      domain: getOnboardingDomainContract(),
    };
  }

  // Explicit: never mutate Subscription entitlements from onboarding scope path
  const cr = await createOnboardingChangeRequest(prisma, {
    actorContext: args.actorContext,
    admin,
    projectId,
    reasonCode: ONBOARDING_CHANGE_REQUEST_REASON.SCOPE_MISMATCH,
    title: 'SCOPE_MISMATCH — commercial / subscription amendment required',
    description:
      'Detected scope mismatch vs confirmed requirements. Entitlements unchanged.',
    requestedScope,
    confirmedScope,
    now: args.now,
  });

  if (!cr.ok) return cr;

  return {
    ok: true,
    mismatch: true,
    hasMismatch: true,
    changeRequest: cr.changeRequest,
    subscriptionMutated: false,
    domain: getOnboardingDomainContract(),
  };
}
