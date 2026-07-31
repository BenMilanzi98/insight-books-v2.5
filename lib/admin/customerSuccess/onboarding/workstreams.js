/**
 * Workstream list helpers — Phase 17 Wave 2.
 */

import { getOnboardingDomainContract } from './catalogue.js';
import {
  canViewOnboarding,
  hasCustomerOnboardingWorkstreamModel,
  resolveOnboardingActor,
  serializeOnboardingWorkstream,
} from './model.js';

export async function listOnboardingWorkstreams(prisma, args = {}) {
  const admin = resolveOnboardingActor(args);
  if (!canViewOnboarding(admin)) {
    return { ok: false, forbidden: true, reason: 'onboarding_workstream_list_forbidden' };
  }
  if (!hasCustomerOnboardingWorkstreamModel(prisma)) {
    return {
      ok: false,
      error: 'customer_onboarding_workstream_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const projectId = args.projectId ? String(args.projectId).trim() : '';
  if (!projectId) return { ok: false, error: 'projectId_required' };

  const rows = await prisma.customerOnboardingWorkstream.findMany({
    where: { projectId },
  });

  return {
    ok: true,
    workstreams: rows.map(serializeOnboardingWorkstream),
    domain: getOnboardingDomainContract(),
  };
}
