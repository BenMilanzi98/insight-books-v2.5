/**
 * Onboarding requirements confirmation — Phase 17 Wave 2.
 */

import { getOnboardingDomainContract } from './catalogue.js';
import {
  canManageOnboarding,
  hasCustomerOnboardingRequirementModel,
  hasCustomerOnboardingProjectModel,
  resolveOnboardingActor,
  serializeOnboardingRequirement,
} from './model.js';

export async function confirmOnboardingRequirements(prisma, args = {}) {
  const admin = resolveOnboardingActor(args);
  if (!canManageOnboarding(admin)) {
    return { ok: false, forbidden: true, reason: 'onboarding_requirements_forbidden' };
  }
  if (!hasCustomerOnboardingProjectModel(prisma)) {
    return {
      ok: false,
      error: 'customer_onboarding_project_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }
  if (!hasCustomerOnboardingRequirementModel(prisma)) {
    return {
      ok: false,
      error: 'customer_onboarding_requirement_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const projectId = args.projectId ? String(args.projectId).trim() : '';
  if (!projectId) return { ok: false, error: 'projectId_required' };

  const project = await prisma.customerOnboardingProject.findUnique({
    where: { id: projectId },
  });
  if (!project) return { ok: false, error: 'project_not_found' };

  const confirmedScope = args.confirmedScope || {};
  const now = args.now || new Date();

  const existing = await prisma.customerOnboardingRequirement.findFirst({
    where: { projectId },
  });
  if (existing) {
    const updated = await prisma.customerOnboardingRequirement.update({
      where: { id: existing.id },
      data: {
        confirmedScopeJson: confirmedScope,
        status: 'CONFIRMED',
        confirmedByAdminId: admin?.id || null,
        confirmedAt: now,
        updatedAt: now,
      },
    });
    return {
      ok: true,
      requirement: serializeOnboardingRequirement(updated),
      domain: getOnboardingDomainContract(),
    };
  }

  const row = await prisma.customerOnboardingRequirement.create({
    data: {
      projectId,
      confirmedScopeJson: confirmedScope,
      status: 'CONFIRMED',
      confirmedByAdminId: admin?.id || null,
      confirmedAt: now,
      createdByAdminId: admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    requirement: serializeOnboardingRequirement(row),
    created: true,
    domain: getOnboardingDomainContract(),
  };
}
