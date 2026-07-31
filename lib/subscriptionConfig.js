/**
 * Centralized subscription configuration for InsightBooks
 * This file contains all subscription plans, pricing, and related constants
 */

/** Storefront feature list for InsightBooks core plans (landing + /subscription). */
export const CORE_STOREFRONT_FEATURES = Object.freeze([
  'POS (Point of Sale)',
  'Stock management',
  'Expense tracking',
  'Invoices',
  'Quotations',
  'Customer database',
  'Financial reporting',
  'AI assistant',
  'HR & payroll',
  'Supplier management',
  'Tax management',
  'Accounting & bookkeeping',
]);

/** Storefront feature list for MRA EIS commercial plans. */
export const EIS_STOREFRONT_FEATURES = Object.freeze([
  'All Standard Features',
  'MRA EIS Integration',
  'Electronic Invoice Submission',
  'Invoice Status Tracking',
  'MRA Validation',
  'EIS Reports & Analytics',
  'Unlimited Invoices',
  'Priority Support',
]);

export const EIS_YEARLY_STOREFRONT_FEATURES = Object.freeze([
  ...EIS_STOREFRONT_FEATURES,
  '2 Months Free',
]);

/**
 * Resolve the feature bullets shown on public pricing cards.
 * Keeps landing and /subscription identical.
 */
export function getStorefrontFeatures(plan) {
  if (!plan) return [...CORE_STOREFRONT_FEATURES];
  if (plan.requiresEIS || isEISPlan(plan.id)) {
    if (plan.id === 'eis-yearly') return [...EIS_YEARLY_STOREFRONT_FEATURES];
    if (Array.isArray(plan.features) && plan.features.length) return [...plan.features];
    return [...EIS_STOREFRONT_FEATURES];
  }
  return [...CORE_STOREFRONT_FEATURES];
}

export const SUBSCRIPTION_PLANS = {
  ONE_MONTH: {
    id: '1month',
    name: '1 Month',
    displayName: '1 Month Plan',
    price: 50000,
    priceFormatted: 'MK50,000',
    period: 'month',
    periodDisplay: '/month',
    currency: 'MWK',
    features: [...CORE_STOREFRONT_FEATURES],
    popular: false,
    highlight: false
  },
  ONE_YEAR: {
    id: '1year',
    name: '1 Year',
    displayName: '1 Year Plan',
    price: 300000,
    priceFormatted: 'MK300,000',
    period: 'year',
    periodDisplay: '/year',
    currency: 'MWK',
    features: [...CORE_STOREFRONT_FEATURES],
    popular: true,
    highlight: true,
    savings: 'Save MK300,000 with annual plan'
  },

  // EIS Plans - Monthly and Yearly
  EIS_MONTHLY: {
    id: 'eis-monthly',
    name: 'EIS Monthly',
    displayName: 'EIS - Monthly',
    price: 150000,
    priceFormatted: 'MK150,000',
    period: 'month',
    periodDisplay: '/month',
    currency: 'MWK',
    features: [...EIS_STOREFRONT_FEATURES],
    popular: true,
    highlight: true,
    badge: 'EIS',
    requiresEIS: true,
    eisQuota: {
      monthlyInvoices: Infinity,
      apiCalls: 10000
    }
  },

  EIS_YEARLY: {
    id: 'eis-yearly',
    name: 'EIS Yearly',
    displayName: 'EIS - Yearly',
    price: 950000,
    priceFormatted: 'MK950,000',
    period: 'year',
    periodDisplay: '/year',
    currency: 'MWK',
    features: [...EIS_YEARLY_STOREFRONT_FEATURES],
    popular: false,
    highlight: false,
    badge: 'EIS',
    savings: 'Save MK850,000 with annual plan',
    requiresEIS: true,
    eisQuota: {
      monthlyInvoices: Infinity,
      apiCalls: 120000
    }
  }
};

export const EIS_PLANS = {
  MONTHLY: 'eis-monthly',
  YEARLY: 'eis-yearly'
};

export const EIS_PLAN_IDS = [
  EIS_PLANS.MONTHLY,
  EIS_PLANS.YEARLY
];

/**
 * Check if plan requires EIS
 */
export function isEISPlan(planId) {
  return EIS_PLAN_IDS.includes(planId);
}

/**
 * Get EIS quota for a plan
 */
export function getEISQuota(planId) {
  const plan = SUBSCRIPTION_PLANS[planId];
  if (plan && plan.requiresEIS) {
    return plan.eisQuota;
  }
  return null;
}

/**
 * Public plans for landing + /subscription storefront.
 * Includes InsightBooks core and MRA EIS commercial add-on plans.
 * Admin-published PlatformPlanVersion rows (isPublic) override prices via /api/subscription/plans.
 */
export const PUBLIC_SUBSCRIPTION_PLANS = [
  SUBSCRIPTION_PLANS.ONE_MONTH,
  SUBSCRIPTION_PLANS.ONE_YEAR,
  SUBSCRIPTION_PLANS.EIS_MONTHLY,
  SUBSCRIPTION_PLANS.EIS_YEARLY,
];

export const SUBSCRIPTION_PLANS_ARRAY = PUBLIC_SUBSCRIPTION_PLANS;


export const TRIAL_DURATION_DAYS = 2;

export const DEFAULT_SUBSCRIPTION_PLAN = SUBSCRIPTION_PLANS.ONE_MONTH.id;

export const SUBSCRIPTION_PLAN_IDS = {
  ONE_MONTH: '1month',
  ONE_YEAR: '1year',
  TAILOR_MADE: 'tailor'
};

/**
 * Get subscription plan by ID
 */
export function getSubscriptionPlan(planId) {
  if (!planId) return SUBSCRIPTION_PLANS.ONE_MONTH;
  // Allow lookup by object key (ONE_MONTH) or by plan.id ('1month')
  if (SUBSCRIPTION_PLANS[planId]) return SUBSCRIPTION_PLANS[planId];
  const byId = Object.values(SUBSCRIPTION_PLANS).find((p) => p.id === planId);
  return byId || SUBSCRIPTION_PLANS.ONE_MONTH;
}

/**
 * Get all paid subscription plans (excluding tailor-made)
 */
export function getPaidSubscriptionPlans() {
  return [
    SUBSCRIPTION_PLANS.ONE_MONTH,
    SUBSCRIPTION_PLANS.ONE_YEAR,
    SUBSCRIPTION_PLANS.EIS_MONTHLY,
    SUBSCRIPTION_PLANS.EIS_YEARLY,
  ];
}

/**
 * Get subscription plan display name
 */
export function getPlanDisplayName(planId) {
  const plan = getSubscriptionPlan(planId);
  return plan.displayName;
}

/**
 * Get subscription plan price
 */
export function getPlanPrice(planId) {
  const plan = getSubscriptionPlan(planId);
  return plan.price;
}

/**
 * Get subscription plan price formatted
 */
export function getPlanPriceFormatted(planId) {
  const plan = getSubscriptionPlan(planId);
  return plan.priceFormatted;
}

/**
 * Check if plan is popular/highlighted
 */
export function isPlanHighlighted(planId) {
  const plan = getSubscriptionPlan(planId);
  return plan.highlight;
}

/**
 * Get plan features
 */
export function getPlanFeatures(planId) {
  const plan = getSubscriptionPlan(planId);
  return plan.features;
}

/**
 * Calculate monthly recurring revenue for a plan
 */
export function calculateMRR(planId) {
  const plan = getSubscriptionPlan(planId);
  if (!plan.price) return 0;

  switch (plan.period) {
    case 'month':
      return plan.price;
    case 'year':
      return Math.round(plan.price / 12);
    default:
      return 0;
  }
}

/**
 * Get all subscription plan IDs as an array
 */
export function getAllPlanIds() {
  return Object.values(SUBSCRIPTION_PLAN_IDS);
}

/**
 * Check if a plan ID is valid
 */
export function isValidPlanId(planId) {
  return getAllPlanIds().includes(planId);
}

/**
 * Calculate subscription expiry date based on plan type
 * @param {string} plan - Plan ID ('1month', '1year')
 * @param {Date} startDate - Start date (defaults to current date)
 * @returns {Date} Expiry date
 */
export function calculateSubscriptionExpiry(plan, startDate = new Date()) {
  const expiryDate = new Date(startDate);

  switch (plan) {
    case '1month':
    case 'eis-monthly':
      expiryDate.setMonth(expiryDate.getMonth() + 1);
      break;
    case '1year':
    case 'annual':
    case 'eis-yearly':
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);
      break;
    default:
      expiryDate.setMonth(expiryDate.getMonth() + 1);
      break;
  }

  return expiryDate;
}
