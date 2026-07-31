/**
 * Onboarding lineage — Phase 17 Wave 4.
 * Preserve commercial → handoff → request → project → evidence → certificate.
 */

import {
  canViewOnboarding,
  hasCustomerOnboardingProjectModel,
  resolveOnboardingActor,
  serializeOnboardingProject,
} from './model.js';
import { getOnboardingDomainContract } from './catalogue.js';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin?: object, projectId?: string }} args
 */
export async function getOnboardingLineage(prisma, args = {}) {
  const admin = resolveOnboardingActor(args);
  if (!canViewOnboarding(admin)) {
    return { ok: false, forbidden: true, lineage: null };
  }
  if (!hasCustomerOnboardingProjectModel(prisma)) {
    return {
      ok: true,
      status: 'UNAVAILABLE',
      lineage: null,
      reason: 'customer_onboarding_project_model_unavailable',
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

  let certificate = null;
  if (typeof prisma.customerOnboardingCompletionCertificate?.findFirst === 'function') {
    certificate = await prisma.customerOnboardingCompletionCertificate.findFirst({
      where: { projectId },
    });
  }

  return {
    ok: true,
    lineage: {
      conversionId: project.conversionId || null,
      handoffId: project.handoffId || null,
      onboardingRequestId: project.onboardingRequestId || null,
      project: serializeOnboardingProject(project),
      certificateId: certificate?.id || null,
      certificateChecksum: certificate?.checksumSha256 || null,
    },
    domain: getOnboardingDomainContract(),
  };
}
