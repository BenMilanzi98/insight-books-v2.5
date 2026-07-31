/**
 * MRA EIS readiness coordination — credential status boundary only.
 * No fabricated credentials; no Production fiscal submit.
 */

import { loadOnboardingProjectForActor } from './projectAccess.js';
import {
  canManageOnboarding,
  hasCustomerOnboardingMraEisModel,
  serializeOnboardingMraEis,
} from './model.js';
import { getOnboardingDomainContract } from './catalogue.js';

export const MRA_EIS_STATUS = Object.freeze({
  UNKNOWN: 'UNKNOWN',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
  NOT_READY: 'NOT_READY',
  READY: 'READY',
  BLOCKED: 'BLOCKED',
});

export async function setMraEisCoordinationStatus(prisma, args = {}) {
  const loaded = await loadOnboardingProjectForActor(prisma, args);
  if (!loaded.ok) return loaded;
  if (!canManageOnboarding(loaded.admin)) {
    return { ok: false, forbidden: true, error: 'onboarding_mra_forbidden' };
  }
  if (!hasCustomerOnboardingMraEisModel(prisma)) {
    return {
      ok: false,
      error: 'customer_onboarding_mra_eis_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const status = String(args.status || MRA_EIS_STATUS.UNKNOWN)
    .trim()
    .toUpperCase();
  // Credential values must never be persisted — status boundary only
  if (args.credentials || args.credentialSecret || args.apiKey) {
    return {
      ok: false,
      error: 'mra_credentials_forbidden_in_onboarding',
    };
  }

  const now = args.now || new Date();
  const existing = await prisma.customerOnboardingMraEis.findFirst({
    where: { projectId: loaded.project.id },
  });

  const data = {
    projectId: loaded.project.id,
    status,
    credentialStatus: args.credentialStatus
      ? String(args.credentialStatus).trim().toUpperCase()
      : existing?.credentialStatus || 'UNKNOWN',
    testApprovalRef: args.testApprovalRef || existing?.testApprovalRef || null,
    productionApprovalRef:
      args.productionApprovalRef || existing?.productionApprovalRef || null,
    updatedAt: now,
  };

  const row = existing
    ? await prisma.customerOnboardingMraEis.update({
        where: { id: existing.id },
        data,
      })
    : await prisma.customerOnboardingMraEis.create({
        data: {
          ...data,
          createdByAdminId: loaded.admin?.id || null,
          createdAt: now,
        },
      });

  return {
    ok: true,
    mraEis: serializeOnboardingMraEis(row),
    domain: getOnboardingDomainContract(),
  };
}
