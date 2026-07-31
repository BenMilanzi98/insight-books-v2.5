/**
 * Feature entitlement resolution for Product Analytics (observe only — never mutate).
 * Sources: PlatformFeatureEntitlement override, plan featuresJson, MRA EIS entitlement.
 */

import { PRODUCT_FEATURE_CODES } from './features.js';

export const ENTITLEMENT_STATUS = Object.freeze({
  INCLUDED: 'INCLUDED',
  OPTIONAL_ADD_ON: 'OPTIONAL_ADD_ON',
  NOT_INCLUDED: 'NOT_INCLUDED',
  GRANDFATHERED: 'GRANDFATHERED',
  CUSTOM_CONTRACT: 'CUSTOM_CONTRACT',
  UNKNOWN: 'UNKNOWN',
});

function featureMatchesPlanList(featuresJson, featureCode) {
  if (!Array.isArray(featuresJson)) return false;
  const code = String(featureCode);
  const modulePrefix = code.split('.')[0];
  return featuresJson.some((entry) => {
    const v = typeof entry === 'string' ? entry : entry?.code || entry?.featureCode;
    if (!v) return false;
    const s = String(v);
    return s === code || s === modulePrefix || s.startsWith(`${modulePrefix}.`);
  });
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ tenantId: string, featureCode: string, asOf?: Date }} args
 * @returns {Promise<{ status: string, planVersion: object|null, limitations: string[], source: string|null, enabled: boolean|null }>}
 */
export async function resolveFeatureEntitlement(prisma, args = {}) {
  const tenantId = args.tenantId ? String(args.tenantId) : '';
  const featureCode = args.featureCode ? String(args.featureCode) : '';
  const asOf = args.asOf instanceof Date ? args.asOf : new Date();
  const limitations = [];

  if (!tenantId || !featureCode) {
    return {
      status: ENTITLEMENT_STATUS.UNKNOWN,
      planVersion: null,
      limitations: ['tenantId and featureCode required'],
      source: null,
      enabled: null,
    };
  }

  // Tenant override wins
  let override = null;
  try {
    override = await prisma.platformFeatureEntitlement?.findUnique?.({
      where: { tenantId_featureCode: { tenantId, featureCode } },
    });
  } catch {
    override = null;
  }

  if (override) {
    const startOk = !override.startDate || new Date(override.startDate) <= asOf;
    const endOk = !override.endDate || new Date(override.endDate) >= asOf;
    if (override.status === 'DISABLED' || !startOk || !endOk) {
      return {
        status: ENTITLEMENT_STATUS.NOT_INCLUDED,
        planVersion: null,
        limitations: ['Tenant override disables or is outside window'],
        source: 'TENANT_OVERRIDE',
        enabled: false,
      };
    }
    if (override.status === 'ACTIVE' && startOk && endOk) {
      return {
        status: ENTITLEMENT_STATUS.CUSTOM_CONTRACT,
        planVersion: null,
        limitations: override.reason ? [String(override.reason)] : [],
        source: 'TENANT_OVERRIDE',
        enabled: true,
      };
    }
  }

  // MRA EIS add-on path
  if (featureCode === PRODUCT_FEATURE_CODES.EIS_FISCAL_ACCEPT) {
    let eis = null;
    try {
      eis = await prisma.mraEisTenantEntitlement?.findFirst?.({
        where: {
          tenantId,
          isCurrent: true,
          status: { in: ['ACTIVE', 'GRANTED', 'ENABLED'] },
        },
        orderBy: { updatedAt: 'desc' },
      });
    } catch {
      try {
        eis = await prisma.mraEisTenantEntitlement?.findFirst?.({
          where: { tenantId, isCurrent: true },
          orderBy: { updatedAt: 'desc' },
        });
      } catch {
        eis = null;
      }
    }
    if (eis) {
      const statusUpper = String(eis.status || '').toUpperCase();
      if (['REVOKED', 'EXPIRED', 'DISABLED', 'CANCELLED'].includes(statusUpper)) {
        return {
          status: ENTITLEMENT_STATUS.NOT_INCLUDED,
          planVersion: null,
          limitations: ['MRA EIS entitlement not active'],
          source: 'MRA_EIS_ENTITLEMENT',
          enabled: false,
        };
      }
      return {
        status: ENTITLEMENT_STATUS.OPTIONAL_ADD_ON,
        planVersion: null,
        limitations: [],
        source: 'MRA_EIS_ENTITLEMENT',
        enabled: true,
      };
    }
  }

  // Plan included features via subscription → plan version
  let subscription = null;
  try {
    subscription = await prisma.accountSubscription?.findFirst?.({
      where: {
        tenantId,
        status: { in: ['ACTIVE', 'TRIAL', 'PAST_DUE'] },
      },
      orderBy: { updatedAt: 'desc' },
    });
  } catch {
    subscription = null;
  }

  let planVersion = null;
  if (subscription?.planVersionId) {
    try {
      planVersion =
        (await prisma.platformPlanVersion?.findUnique?.({
          where: { id: subscription.planVersionId },
        })) ||
        (await prisma.platformPlanVersion?.findFirst?.({
          where: { id: subscription.planVersionId },
        }));
    } catch {
      planVersion = null;
    }
  }
  if (!planVersion && subscription?.plan) {
    try {
      planVersion = await prisma.platformPlanVersion?.findFirst?.({
        where: {
          planCode: subscription.plan,
          status: { in: ['ACTIVE', 'PUBLISHED'] },
        },
        orderBy: { version: 'desc' },
      });
    } catch {
      planVersion = null;
    }
  }

  if (!planVersion) {
    limitations.push('No active plan version resolved');
    return {
      status: ENTITLEMENT_STATUS.UNKNOWN,
      planVersion: null,
      limitations,
      source: null,
      enabled: null,
    };
  }

  const included = featureMatchesPlanList(planVersion.featuresJson, featureCode);
  const limits =
    planVersion.limitsJson && typeof planVersion.limitsJson === 'object'
      ? planVersion.limitsJson
      : {};
  if (limits && Object.keys(limits).length) {
    limitations.push('Plan usage limits apply (observe only)');
  }

  return {
    status: included ? ENTITLEMENT_STATUS.INCLUDED : ENTITLEMENT_STATUS.NOT_INCLUDED,
    planVersion: {
      id: planVersion.id,
      version: planVersion.version,
      planCode: planVersion.planCode,
    },
    limitations,
    source: 'PLAN',
    enabled: included,
  };
}
