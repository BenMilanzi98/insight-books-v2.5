/**
 * Centralized subscription configuration for InsightBooks
 * This file contains all subscription plans, pricing, and related constants
 */

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
    features: [
      "POS (Point of Sale)",
      "Inventory Tracking",
      "Expenses Tracking",
      "Invoices",
      "Quotations",
      "Customer Database",
      "Financial Reporting"
    ],
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
    features: [
      "POS (Point of Sale)",
      "Inventory Tracking",
      "Expenses Tracking",
      "Invoices",
      "Quotations",
      "Customer Database",
      "Financial Reporting"
    ],
    popular: true,
    highlight: true,
    savings: 'Save MK300,000 with annual plan'
  },

  // EIS Plans
  EIS_STANDARD_MONTHLY: {
    id: 'eis-standard-monthly',
    name: 'EIS Standard Monthly',
    displayName: 'EIS Standard - Monthly',
    price: 15000,
    priceFormatted: 'MK15,000',
    period: 'month',
    periodDisplay: '/month',
    currency: 'MWK',
    features: [
      "All Standard Features",
      "MRA EIS Integration",
      "Electronic Invoice Submission",
      "Invoice Status Tracking",
      "MRA Validation",
      "EIS Reports & Analytics",
      "Unlimited Invoices",
      "Priority Support"
    ],
    popular: true,
    highlight: true,
    badge: 'EIS',
    requiresEIS: true,
    eisQuota: {
      monthlyInvoices: Infinity,
      apiCalls: 10000
    }
  },

  EIS_STANDARD_YEARLY: {
    id: 'eis-standard-yearly',
    name: 'EIS Standard Yearly',
    displayName: 'EIS Standard - Yearly',
    price: 150000,
    priceFormatted: 'MK150,000',
    period: 'year',
    periodDisplay: '/year',
    currency: 'MWK',
    features: [
      "All Standard Features",
      "MRA EIS Integration",
      "Electronic Invoice Submission",
      "Invoice Status Tracking",
      "MRA Validation",
      "EIS Reports & Analytics",
      "Unlimited Invoices",
      "Priority Support",
      "2 Months Free"
    ],
    popular: false,
    highlight: false,
    badge: 'EIS',
    savings: 'Save MK30,000 with annual plan',
    requiresEIS: true,
    eisQuota: {
      monthlyInvoices: Infinity,
      apiCalls: 120000
    }
  },

  EIS_PROFESSIONAL_MONTHLY: {
    id: 'eis-professional-monthly',
    name: 'EIS Professional Monthly',
    displayName: 'EIS Professional - Monthly',
    price: 35000,
    priceFormatted: 'MK35,000',
    period: 'month',
    periodDisplay: '/month',
    currency: 'MWK',
    features: [
      "All Standard Features",
      "MRA EIS Integration",
      "Electronic Invoice Submission",
      "Invoice Status Tracking",
      "MRA Validation",
      "EIS Reports & Analytics",
      "Unlimited Invoices",
      "Priority Support (24/7)",
      "Multi-Branch EIS",
      "Custom Invoice Templates",
      "API Access",
      "Dedicated Account Manager"
    ],
    popular: false,
    highlight: true,
    badge: 'EIS Pro',
    requiresEIS: true,
    eisQuota: {
      monthlyInvoices: Infinity,
      apiCalls: 50000,
      customTemplates: true,
      multiBranch: true
    }
  },

  EIS_PROFESSIONAL_YEARLY: {
    id: 'eis-professional-yearly',
    name: 'EIS Professional Yearly',
    displayName: 'EIS Professional - Yearly',
    price: 350000,
    priceFormatted: 'MK350,000',
    period: 'year',
    periodDisplay: '/year',
    currency: 'MWK',
    features: [
      "All Standard Features",
      "MRA EIS Integration",
      "Electronic Invoice Submission",
      "Invoice Status Tracking",
      "MRA Validation",
      "EIS Reports & Analytics",
      "Unlimited Invoices",
      "Priority Support (24/7)",
      "Multi-Branch EIS",
      "Custom Invoice Templates",
      "API Access",
      "Dedicated Account Manager",
      "3 Months Free"
    ],
    popular: true,
    highlight: true,
    badge: 'EIS Pro',
    savings: 'Save MK70,000 with annual plan',
    requiresEIS: true,
    eisQuota: {
      monthlyInvoices: Infinity,
      apiCalls: 600000,
      customTemplates: true,
      multiBranch: true
    }
  }
};

export const EIS_PLANS = {
  STANDARD_MONTHLY: 'eis-standard-monthly',
  STANDARD_YEARLY: 'eis-standard-yearly',
  PROFESSIONAL_MONTHLY: 'eis-professional-monthly',
  PROFESSIONAL_YEARLY: 'eis-professional-yearly'
};

export const EIS_PLAN_IDS = [
  EIS_PLANS.STANDARD_MONTHLY,
  EIS_PLANS.STANDARD_YEARLY,
  EIS_PLANS.PROFESSIONAL_MONTHLY,
  EIS_PLANS.PROFESSIONAL_YEARLY
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

export const SUBSCRIPTION_PLANS_ARRAY = Object.values(SUBSCRIPTION_PLANS);

export const TRIAL_DURATION_DAYS = 3;

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
  return SUBSCRIPTION_PLANS[planId] || SUBSCRIPTION_PLANS.ONE_MONTH;
}

/**
 * Get all paid subscription plans (excluding tailor-made)
 */
export function getPaidSubscriptionPlans() {
  return [SUBSCRIPTION_PLANS.ONE_MONTH, SUBSCRIPTION_PLANS.ONE_YEAR];
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
      // Add 1 month
      expiryDate.setMonth(expiryDate.getMonth() + 1);
      break;
    case '1year':
    case 'annual':
      // Add 1 year
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);
      break;
    default:
      // Default to 1 month if plan is unknown
      expiryDate.setMonth(expiryDate.getMonth() + 1);
      break;
  }

  return expiryDate;
}
