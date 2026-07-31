/**
 * Wave 1 minimal template seed — ACTIVE STANDARD version for Project pin.
 * Wave 2: approve/activate via templateVersions.js; materialise via materialise.js.
 */

import {
  ONBOARDING_TEMPLATE_STATUS,
  ONBOARDING_TYPE,
  WAVE1_STANDARD_TEMPLATE_CODE,
  getOnboardingDomainContract,
} from './catalogue.js';
import {
  canManageOnboarding,
  hasCustomerOnboardingTemplateVersionModel,
  resolveOnboardingActor,
  serializeOnboardingTemplateVersion,
} from './model.js';

/**
 * Ensure a seeded ACTIVE STANDARD template version exists (idempotent).
 */
export async function ensureWave1StandardTemplateVersion(prisma, args = {}) {
  const admin = resolveOnboardingActor(args);
  if (!canManageOnboarding(admin)) {
    return {
      ok: false,
      forbidden: true,
      reason: 'onboarding_template_seed_forbidden',
    };
  }
  if (!hasCustomerOnboardingTemplateVersionModel(prisma)) {
    return {
      ok: false,
      error: 'customer_onboarding_template_version_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const existing = await prisma.customerOnboardingTemplateVersion.findFirst({
    where: {
      templateCode: WAVE1_STANDARD_TEMPLATE_CODE,
      onboardingType: ONBOARDING_TYPE.STANDARD,
      status: ONBOARDING_TEMPLATE_STATUS.ACTIVE,
    },
  });
  if (existing) {
    return {
      ok: true,
      templateVersion: serializeOnboardingTemplateVersion(existing),
      alreadyExists: true,
      domain: getOnboardingDomainContract(),
    };
  }

  const now = args.now || new Date();
  const row = await prisma.customerOnboardingTemplateVersion.create({
    data: {
      templateCode: WAVE1_STANDARD_TEMPLATE_CODE,
      versionNumber: 1,
      onboardingType: ONBOARDING_TYPE.STANDARD,
      status: ONBOARDING_TEMPLATE_STATUS.ACTIVE,
      immutable: true,
      contentJson: {
        wave: 1,
        materialisation: 'DEFERRED_TO_WAVE_2',
        workstreams: [],
        milestones: [],
        tasks: [],
      },
      createdByAdminId: admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    templateVersion: serializeOnboardingTemplateVersion(row),
    created: true,
    domain: getOnboardingDomainContract(),
  };
}
