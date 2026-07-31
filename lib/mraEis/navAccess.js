import prisma from '@/lib/prisma';
import { isEISPlan, EIS_PLAN_IDS } from '@/lib/subscriptionConfig';
import { ENTITLEMENT_STATUS } from '@/lib/mraEis/domain/constants.js';
import {
  TENANT_EIS_NAV_FULL,
  TENANT_EIS_NAV_LOCKED,
  buildTenantEisNavMenuItem,
} from '@/lib/mraEis/navConfig.js';

export {
  TENANT_EIS_NAV_FULL,
  TENANT_EIS_NAV_LOCKED,
  buildTenantEisNavMenuItem,
} from '@/lib/mraEis/navConfig.js';

/** Entitlement statuses that unlock full tenant EIS management UI. */
export const EIS_MANAGEMENT_ENTITLEMENT_STATUSES = Object.freeze([
  ENTITLEMENT_STATUS.ENTITLED_SANDBOX_ONLY,
  ENTITLEMENT_STATUS.ENTITLED_PRODUCTION,
]);

/**
 * Unlock rule A: active MRA EIS subscription OR entitled status.
 */
export async function resolveTenantEisManagementAccess(tenantId, db = prisma) {
  if (!tenantId) {
    return {
      unlocked: false,
      via: null,
      hasActiveEisSubscription: false,
      entitlementStatus: null,
      navItems: [...TENANT_EIS_NAV_LOCKED],
    };
  }

  const now = new Date();
  const planIds = Array.isArray(EIS_PLAN_IDS) ? EIS_PLAN_IDS : ['eis-monthly', 'eis-yearly'];

  let subscription = null;
  try {
    subscription = await db.accountSubscription.findFirst({
      where: {
        tenantId,
        isActive: true,
        isTrial: false,
        plan: { in: planIds },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, plan: true, isActive: true, expiresAt: true },
    });
  } catch {
    subscription = null;
  }

  const hasActiveEisSubscription = Boolean(subscription && isEISPlan(subscription.plan));

  let entitlement = null;
  try {
    entitlement = await db.mraEisTenantEntitlement.findFirst({
      where: { tenantId, isCurrent: true },
      select: { status: true },
    });
  } catch {
    entitlement = null;
  }

  const entitlementStatus = entitlement?.status || null;
  const entitled = EIS_MANAGEMENT_ENTITLEMENT_STATUSES.includes(entitlementStatus);

  const unlocked = hasActiveEisSubscription || entitled;
  let via = null;
  if (hasActiveEisSubscription && entitled) via = 'subscription_and_entitlement';
  else if (hasActiveEisSubscription) via = 'subscription';
  else if (entitled) via = 'entitlement';

  return {
    unlocked,
    via,
    hasActiveEisSubscription,
    entitlementStatus,
    navItems: unlocked ? [...TENANT_EIS_NAV_FULL] : [...TENANT_EIS_NAV_LOCKED],
    menuItem: buildTenantEisNavMenuItem(
      unlocked ? TENANT_EIS_NAV_FULL : TENANT_EIS_NAV_LOCKED
    ),
  };
}
