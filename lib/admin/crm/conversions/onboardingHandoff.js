/**
 * Onboarding handoff — Phase 16 Wave 4 / Phase 20 Wave 3.
 * Idempotent package only. Never fabricates onboarding complete.
 * Never creates CS Onboarding Project (tree-17 / PRD-21).
 */

import {
  createDomainHandoff,
  sendDomainHandoff,
  supersedeDomainHandoff,
  CRM_CONVERSION_HANDOFF_TYPE,
  CRM_ONBOARDING_HANDOFF_PACKAGE_STATUS,
  computeOnboardingHandoffChecksum,
  sanitizeConversionHandoffPayload,
} from './handoffShared.js';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin?: object,
 *   conversionId?: string,
 *   tenantId?: string,
 *   idempotencyKey: string,
 *   payload?: object,
 *   correction?: boolean,
 *   correctionReason?: string,
 *   pendingProvisioning?: boolean,
 *   now?: Date,
 * }} args
 */
export async function createOnboardingHandoff(prisma, args = {}) {
  const result = await createDomainHandoff(prisma, {
    ...args,
    handoffType: CRM_CONVERSION_HANDOFF_TYPE.ONBOARDING,
    payload: {
      type: 'CRM_ONBOARDING_HANDOFF',
      conversionId: args.conversionId || null,
      tenantId: args.tenantId || null,
      ...(args.payload && typeof args.payload === 'object' ? args.payload : {}),
      // Force after spread — caller cannot forge onboarding completion / Project.
      onboardingCompleted: false,
      fabricatedComplete: false,
      executionComplete: false,
      onboardingProjectCreated: false,
      createsOnboardingProject: false,
      pendingProvisioning: args.pendingProvisioning !== false,
      provisioningStatus:
        args.payload?.provisioningStatus ||
        (args.pendingProvisioning === false ? 'READY' : 'PENDING'),
    },
  });

  if (!result.ok) return result;

  return {
    ...result,
    onboardingCompleted: false,
    fabricatedComplete: false,
    createsOnboardingProject: false,
    checksumSha256: result.checksumSha256 || result.handoff?.checksumSha256 || null,
    meta: {
      handoffOnly: true,
      executesOnboarding: false,
      createsOnboardingProject: false,
      phase21Consumer: true,
    },
  };
}

/**
 * Transition onboarding handoff READY → SENT. Does not create Project.
 */
export async function sendOnboardingHandoff(prisma, args = {}) {
  const result = await sendDomainHandoff(prisma, args);
  if (!result.ok) return result;
  return {
    ...result,
    createsOnboardingProject: false,
    onboardingCompleted: false,
    meta: {
      handoffOnly: true,
      executesOnboarding: false,
      createsOnboardingProject: false,
    },
  };
}

/**
 * Supersede an onboarding handoff with history (or use correction on create).
 */
export async function supersedeOnboardingHandoff(prisma, args = {}) {
  return supersedeDomainHandoff(prisma, args);
}

export {
  CRM_ONBOARDING_HANDOFF_PACKAGE_STATUS,
  computeOnboardingHandoffChecksum,
  sanitizeConversionHandoffPayload,
};
