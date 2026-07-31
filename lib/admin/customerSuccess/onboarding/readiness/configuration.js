/**
 * Product configuration vs entitlements — Phase 21 Wave 2 (G21-12).
 * Evidence-based pin/plan only; does not invent subscription ACTIVE
 * (authoritative ACTIVE lives in readiness/subscription.js).
 */

import { READINESS_STATUS } from './tenant.js';

export async function evaluateConfigurationReadiness(prisma, project, args = {}) {
  if (args.dimensionOverrides?.configuration) {
    return {
      status: String(args.dimensionOverrides.configuration).toUpperCase(),
      evidence: { override: true },
    };
  }

  if (!project?.subscriptionId) {
    return {
      status: READINESS_STATUS.UNKNOWN,
      evidence: { reason: 'subscription_pin_missing' },
    };
  }

  if (typeof prisma?.subscription?.findUnique !== 'function') {
    return {
      status: READINESS_STATUS.UNKNOWN,
      evidence: {
        reason: 'subscription_model_unavailable',
        subscriptionId: project.subscriptionId,
      },
    };
  }

  const sub = await prisma.subscription.findUnique({
    where: { id: project.subscriptionId },
  });
  if (!sub) {
    return {
      status: READINESS_STATUS.NOT_READY,
      evidence: { reason: 'subscription_not_found' },
    };
  }

  const subscriptionStatus = String(sub.status || '').trim().toUpperCase() || null;

  // Pin + plan evidence only — never claim subscription ACTIVE here
  return {
    status: READINESS_STATUS.READY,
    evidence: {
      subscriptionId: project.subscriptionId,
      planCode: sub.planCode || sub.entitlementsJson?.planCode || null,
      subscriptionStatus,
      subscriptionActiveClaimed: false,
      inventsSubscriptionActive: false,
    },
  };
}
