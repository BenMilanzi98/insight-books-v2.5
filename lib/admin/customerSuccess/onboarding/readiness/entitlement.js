/**
 * Entitlement readiness honesty — Phase 21 Wave 2 (G21-09).
 * No unaccepted scope; no UI term mutation of entitlements.
 */

import { READINESS_STATUS } from './tenant.js';

const OPEN_CR = new Set(['OPEN', 'PENDING', 'SUBMITTED', 'IN_REVIEW']);

/**
 * @returns {{ status: string, evidence: object }}
 */
export async function evaluateEntitlementReadiness(prisma, project, args = {}) {
  if (args.dimensionOverrides?.entitlements) {
    return {
      status: String(args.dimensionOverrides.entitlements).toUpperCase(),
      evidence: { override: true },
    };
  }

  if (typeof prisma?.customerOnboardingChangeRequest?.findMany !== 'function') {
    return {
      status: READINESS_STATUS.UNKNOWN,
      evidence: { reason: 'change_request_model_unavailable' },
    };
  }

  const crs = await prisma.customerOnboardingChangeRequest.findMany({
    where: { projectId: project.id },
  });
  const openScope = (crs || []).filter((cr) => {
    const status = String(cr.status || '').toUpperCase();
    const reason = String(cr.reason || cr.title || '').toUpperCase();
    const isOpen = OPEN_CR.has(status);
    const isScope =
      reason.includes('SCOPE') ||
      String(cr.type || '').toUpperCase().includes('SCOPE');
    return isOpen && isScope;
  });

  if (openScope.length > 0) {
    return {
      status: READINESS_STATUS.NOT_READY,
      evidence: {
        reason: 'unaccepted_scope_change_request',
        openScopeChangeRequestCount: openScope.length,
      },
    };
  }

  if (!project?.subscriptionId) {
    return {
      status: READINESS_STATUS.UNKNOWN,
      evidence: { reason: 'subscription_pin_missing' },
    };
  }

  return {
    status: READINESS_STATUS.READY,
    evidence: {
      openScopeChangeRequestCount: 0,
      subscriptionId: project.subscriptionId,
      subscriptionMutated: false,
    },
  };
}

/** Explicit refuse — onboarding UI must never mutate entitlements. */
export function refuseEntitlementMutationFromOnboarding(_args = {}) {
  return {
    ok: false,
    error: 'entitlement_ui_term_mutation_forbidden',
    subscriptionMutated: false,
    reason: 'onboarding_must_not_mutate_entitlements',
  };
}
