import { isEISPlan, SUBSCRIPTION_PLANS } from '@/lib/subscriptionConfig';

export const PLAN_CATEGORY = Object.freeze({
  CORE: 'CORE',
  MRA_EIS: 'MRA_EIS',
});

export const PLAN_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  PUBLISHED: 'PUBLISHED',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  RETIRED: 'RETIRED',
  SUPERSEDED: 'SUPERSEDED',
});

export function categoryForPlanCode(planCode) {
  return isEISPlan(planCode) ? PLAN_CATEGORY.MRA_EIS : PLAN_CATEGORY.CORE;
}

export function productCodeForPlanCode(planCode) {
  return isEISPlan(planCode) ? 'MRA_EIS' : 'INSIGHTBOOKS_CORE';
}

/** Plans in the same commercial family (used for coexistence-safe deactivation). */
export function planCodesInCategory(category) {
  const codes = Object.values(SUBSCRIPTION_PLANS || {}).map((p) => p.id);
  if (category === PLAN_CATEGORY.MRA_EIS) {
    return codes.filter((id) => isEISPlan(id));
  }
  return codes.filter((id) => !isEISPlan(id));
}

export function resolveCanonicalPlanPrice(planCode) {
  const aliases = {
    annual: '1year',
    '1_year': '1year',
    year: '1year',
    '3_months': '3months',
    '1_month': '1month',
    month: '1month',
  };
  const id = aliases[planCode] || planCode;
  const fromConfig = Object.values(SUBSCRIPTION_PLANS || {}).find((p) => p.id === id);
  if (!fromConfig) {
    return { ok: false, error: `Unknown plan: ${planCode}`, planId: id };
  }
  return {
    ok: true,
    planId: id,
    amount: Number(fromConfig.price) || 0,
    currency: fromConfig.currency || 'MWK',
    label: fromConfig.displayName || fromConfig.name || id,
    category: categoryForPlanCode(id),
    plan: fromConfig,
  };
}

export function defaultLimitsForEisPlan(plan) {
  const q = plan?.eisQuota || {};
  return {
    monthlyFiscalTransactions: Number.isFinite(q.monthlyInvoices) ? q.monthlyInvoices : null,
    apiRequests: Number.isFinite(q.apiCalls) ? q.apiCalls : null,
    terminals: null,
    sites: null,
    businesses: null,
    users: null,
  };
}

export function seedDataFromCatalogPlan(plan, createdBy) {
  const category = categoryForPlanCode(plan.id);
  const isEis = category === PLAN_CATEGORY.MRA_EIS;
  return {
    planCode: plan.id,
    version: 1,
    name: plan.displayName || plan.name,
    publicName: plan.displayName || plan.name,
    description: plan.savings || null,
    planCategory: category,
    productCode: productCodeForPlanCode(plan.id),
    currency: plan.currency || 'MWK',
    basePrice: plan.price ?? 0,
    billingFrequency: plan.period || 'month',
    featuresJson: plan.features || [],
    limitsJson: isEis ? defaultLimitsForEisPlan(plan) : {},
    eligibilityJson: {
      availableToNewTenants: true,
      availableToExistingTenants: true,
      requiresEntitlementApproval: isEis,
    },
    billingCyclesJson: [
      {
        cycle: plan.period === 'year' ? 'ANNUAL' : 'MONTHLY',
        price: plan.price ?? 0,
        preferred: true,
      },
    ],
    presentationJson: {
      popular: Boolean(plan.popular),
      badge: plan.badge || null,
    },
    status: isEis ? PLAN_STATUS.PUBLISHED : PLAN_STATUS.ACTIVE,
    // EIS commercial plans are storefront-visible; entitlement remains admin-gated
    isPublic: true,
    isFeatured: Boolean(plan.popular || plan.highlight),
    displayOrder: isEis ? (plan.id === 'eis-monthly' ? 10 : 20) : plan.id === '1month' ? 1 : 2,
    trialEnabled: false,
    trialDays: null,
    ctaText: isEis ? 'Subscribe to MRA EIS' : 'Start subscription',
    highlightText: plan.savings || null,
    createdBy: createdBy || null,
  };
}

export function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function serializePlanVersion(p) {
  if (!p) return p;
  return {
    ...p,
    basePrice: toNumber(p.basePrice),
    planCategory: p.planCategory || categoryForPlanCode(p.planCode),
    productCode: p.productCode || productCodeForPlanCode(p.planCode),
    publicName: p.publicName || p.name,
  };
}
