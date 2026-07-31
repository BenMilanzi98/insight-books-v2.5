/**
 * Onboarding responsibilities — CUSTOMER | INSIGHTBOOKS | SHARED.
 * Acceptance ≠ commercial Contract execution.
 */

import {
  ONBOARDING_RESPONSIBILITY_PARTY,
  getOnboardingDomainContract,
} from './catalogue.js';
import {
  canManageOnboarding,
  hasCustomerOnboardingResponsibilityModel,
  hasCustomerOnboardingProjectModel,
  resolveOnboardingActor,
  serializeOnboardingResponsibility,
} from './model.js';

export async function assignOnboardingResponsibility(prisma, args = {}) {
  const admin = resolveOnboardingActor(args);
  if (!canManageOnboarding(admin)) {
    return { ok: false, forbidden: true, reason: 'onboarding_responsibility_forbidden' };
  }
  if (!hasCustomerOnboardingProjectModel(prisma)) {
    return {
      ok: false,
      error: 'customer_onboarding_project_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }
  if (!hasCustomerOnboardingResponsibilityModel(prisma)) {
    return {
      ok: false,
      error: 'customer_onboarding_responsibility_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const projectId = args.projectId ? String(args.projectId).trim() : '';
  if (!projectId) return { ok: false, error: 'projectId_required' };

  const party = String(args.party || ONBOARDING_RESPONSIBILITY_PARTY.SHARED)
    .trim()
    .toUpperCase();
  const now = args.now || new Date();

  const row = await prisma.customerOnboardingResponsibility.create({
    data: {
      projectId,
      party,
      title: args.title || 'Responsibility',
      description: args.description || null,
      dueAt: args.dueAt ? new Date(args.dueAt) : null,
      status: 'OPEN',
      createdByAdminId: admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    responsibility: serializeOnboardingResponsibility(row),
    commercialContractAcceptance: false,
    domain: getOnboardingDomainContract(),
  };
}
