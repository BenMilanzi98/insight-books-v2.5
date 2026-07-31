/**
 * Subscription readiness honesty — Phase 21 Wave 2 (G21-08).
 * ACTIVE only from authoritative subscription service row.
 * Pin / REQUESTED / force flags ≠ ACTIVE/READY.
 */

import { READINESS_STATUS } from './tenant.js';

/**
 * @returns {{ status: string, evidence: object }}
 */
export async function evaluateSubscriptionReadiness(prisma, project, args = {}) {
  if (args.dimensionOverrides?.subscription) {
    return {
      status: String(args.dimensionOverrides.subscription).toUpperCase(),
      evidence: { override: true },
    };
  }

  if (!project?.subscriptionId) {
    return {
      status: READINESS_STATUS.UNKNOWN,
      evidence: { reason: 'subscription_pin_missing' },
    };
  }

  // Never honour caller force / claimed ACTIVE without authoritative row
  if (args.ignoreAuthoritative === true || typeof prisma?.subscription?.findUnique !== 'function') {
    return {
      status: READINESS_STATUS.UNKNOWN,
      evidence: {
        reason: 'subscription_authoritative_unavailable',
        subscriptionId: project.subscriptionId,
        forceActiveIgnored: args.forceActive === true,
      },
    };
  }

  const sub = await prisma.subscription.findUnique({
    where: { id: project.subscriptionId },
  });
  if (!sub) {
    return {
      status: READINESS_STATUS.NOT_READY,
      evidence: {
        reason: 'subscription_not_found',
        subscriptionId: project.subscriptionId,
        forceActiveIgnored: args.forceActive === true,
      },
    };
  }

  const subscriptionStatus = String(sub.status || '').trim().toUpperCase();
  if (subscriptionStatus === 'ACTIVE') {
    return {
      status: READINESS_STATUS.READY,
      evidence: {
        subscriptionId: project.subscriptionId,
        subscriptionStatus: 'ACTIVE',
        planCode: sub.planCode || sub.entitlementsJson?.planCode || null,
        authoritative: true,
      },
    };
  }

  return {
    status: READINESS_STATUS.NOT_READY,
    evidence: {
      subscriptionId: project.subscriptionId,
      subscriptionStatus: subscriptionStatus || 'UNKNOWN',
      reason: 'subscription_not_active',
      forceActiveIgnored: args.forceActive === true,
    },
  };
}
