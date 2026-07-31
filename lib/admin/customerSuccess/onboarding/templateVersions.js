/**
 * Template version approve / activate — Phase 17 Wave 2.
 * ACTIVE versions are immutable (content must not change via domain services).
 */

import {
  ONBOARDING_TEMPLATE_STATUS,
  getOnboardingDomainContract,
} from './catalogue.js';
import {
  canManageOnboarding,
  hasCustomerOnboardingTemplateVersionModel,
  resolveOnboardingActor,
  serializeOnboardingTemplateVersion,
} from './model.js';

/**
 * Move DRAFT → APPROVED (SoD: approver preferably ≠ author — soft warn only in Wave 2).
 */
export async function approveOnboardingTemplateVersion(prisma, args = {}) {
  const admin = resolveOnboardingActor(args);
  if (!canManageOnboarding(admin)) {
    return { ok: false, forbidden: true, reason: 'onboarding_template_approve_forbidden' };
  }
  if (!hasCustomerOnboardingTemplateVersionModel(prisma)) {
    return {
      ok: false,
      error: 'customer_onboarding_template_version_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const templateVersionId = args.templateVersionId
    ? String(args.templateVersionId).trim()
    : '';
  if (!templateVersionId) {
    return { ok: false, error: 'templateVersionId_required' };
  }

  const row = await prisma.customerOnboardingTemplateVersion.findUnique({
    where: { id: templateVersionId },
  });
  if (!row) return { ok: false, error: 'template_version_not_found' };

  if (row.status === ONBOARDING_TEMPLATE_STATUS.APPROVED) {
    return {
      ok: true,
      templateVersion: serializeOnboardingTemplateVersion(row),
      alreadyExists: true,
      domain: getOnboardingDomainContract(),
    };
  }
  if (
    row.status !== ONBOARDING_TEMPLATE_STATUS.DRAFT &&
    row.status !== ONBOARDING_TEMPLATE_STATUS.PENDING_APPROVAL
  ) {
    return { ok: false, error: `invalid_template_status_${row.status}` };
  }

  const now = args.now || new Date();
  const updated = await prisma.customerOnboardingTemplateVersion.update({
    where: { id: row.id },
    data: {
      status: ONBOARDING_TEMPLATE_STATUS.APPROVED,
      approvedByAdminId: admin?.id || null,
      approvedAt: now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    templateVersion: serializeOnboardingTemplateVersion(updated),
    domain: getOnboardingDomainContract(),
  };
}

/**
 * Activate an APPROVED (or DRAFT Wave-1 path) version → ACTIVE + immutable.
 * Rejects contentJson mutation attempts on already-ACTIVE versions.
 */
export async function activateOnboardingTemplateVersion(prisma, args = {}) {
  const admin = resolveOnboardingActor(args);
  if (!canManageOnboarding(admin)) {
    return { ok: false, forbidden: true, reason: 'onboarding_template_activate_forbidden' };
  }
  if (!hasCustomerOnboardingTemplateVersionModel(prisma)) {
    return {
      ok: false,
      error: 'customer_onboarding_template_version_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const templateVersionId = args.templateVersionId
    ? String(args.templateVersionId).trim()
    : '';
  if (!templateVersionId) {
    return { ok: false, error: 'templateVersionId_required' };
  }

  const row = await prisma.customerOnboardingTemplateVersion.findUnique({
    where: { id: templateVersionId },
  });
  if (!row) return { ok: false, error: 'template_version_not_found' };

  if (
    row.status === ONBOARDING_TEMPLATE_STATUS.ACTIVE &&
    (row.immutable !== false || args.contentJson != null)
  ) {
    if (args.contentJson != null) {
      return { ok: false, error: 'active_template_version_immutable' };
    }
    return {
      ok: true,
      templateVersion: serializeOnboardingTemplateVersion(row),
      alreadyExists: true,
      domain: getOnboardingDomainContract(),
    };
  }

  if (
    row.status !== ONBOARDING_TEMPLATE_STATUS.APPROVED &&
    row.status !== ONBOARDING_TEMPLATE_STATUS.DRAFT &&
    row.status !== ONBOARDING_TEMPLATE_STATUS.ACTIVE
  ) {
    return { ok: false, error: `invalid_template_status_${row.status}` };
  }

  const now = args.now || new Date();

  // Retire prior ACTIVE for same templateCode (best-effort)
  if (typeof prisma.customerOnboardingTemplateVersion.findMany === 'function') {
    const priors = await prisma.customerOnboardingTemplateVersion.findMany({
      where: {
        templateCode: row.templateCode,
        status: ONBOARDING_TEMPLATE_STATUS.ACTIVE,
      },
    });
    for (const prior of priors) {
      if (prior.id === row.id) continue;
      await prisma.customerOnboardingTemplateVersion.update({
        where: { id: prior.id },
        data: {
          status: ONBOARDING_TEMPLATE_STATUS.RETIRED,
          updatedAt: now,
        },
      });
    }
  }

  const updated = await prisma.customerOnboardingTemplateVersion.update({
    where: { id: row.id },
    data: {
      status: ONBOARDING_TEMPLATE_STATUS.ACTIVE,
      immutable: true,
      activatedByAdminId: admin?.id || null,
      activatedAt: now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    templateVersion: serializeOnboardingTemplateVersion(updated),
    domain: getOnboardingDomainContract(),
  };
}
