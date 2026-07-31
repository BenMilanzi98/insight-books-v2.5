/**
 * Onboarding Change Requests — commercial / scope impact handoff.
 * Never mutates Subscription entitlements.
 */

import {
  ONBOARDING_CHANGE_REQUEST_REASON,
  getOnboardingDomainContract,
} from './catalogue.js';
import {
  canManageOnboarding,
  hasCustomerOnboardingChangeRequestModel,
  resolveOnboardingActor,
  serializeOnboardingChangeRequest,
} from './model.js';

export async function createOnboardingChangeRequest(prisma, args = {}) {
  const admin = resolveOnboardingActor(args);
  if (!canManageOnboarding(admin)) {
    return { ok: false, forbidden: true, reason: 'onboarding_cr_forbidden' };
  }
  if (!hasCustomerOnboardingChangeRequestModel(prisma)) {
    return {
      ok: false,
      error: 'customer_onboarding_change_request_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const projectId = args.projectId ? String(args.projectId).trim() : '';
  if (!projectId) return { ok: false, error: 'projectId_required' };

  const reasonCode = String(
    args.reasonCode || ONBOARDING_CHANGE_REQUEST_REASON.SCOPE_MISMATCH
  )
    .trim()
    .toUpperCase();
  const now = args.now || new Date();

  const row = await prisma.customerOnboardingChangeRequest.create({
    data: {
      projectId,
      reasonCode,
      status: 'OPEN',
      title: args.title || 'Scope mismatch — commercial amendment required',
      description: args.description || null,
      requestedScopeJson: args.requestedScope || null,
      confirmedScopeJson: args.confirmedScope || null,
      commercialHandoffRequired: true,
      subscriptionMutated: false,
      createdByAdminId: admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    changeRequest: serializeOnboardingChangeRequest(row),
    subscriptionMutated: false,
    domain: getOnboardingDomainContract(),
  };
}
