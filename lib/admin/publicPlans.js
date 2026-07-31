import prisma from '@/lib/prisma';
import {
  PUBLIC_SUBSCRIPTION_PLANS,
  SUBSCRIPTION_PLANS,
  getStorefrontFeatures,
  isEISPlan,
} from '@/lib/subscriptionConfig';
import { PLAN_CATEGORY, PLAN_STATUS, toNumber } from '@/lib/admin/mraEisPlans';

function formatMwk(amount) {
  const n = toNumber(amount);
  return `MK${n.toLocaleString('en-US')}`;
}

function catalogFallbackPlans() {
  return PUBLIC_SUBSCRIPTION_PLANS.map((plan) => ({
    id: plan.id,
    name: plan.displayName || plan.name,
    displayName: plan.displayName || plan.name,
    price: plan.price,
    priceFormatted: plan.priceFormatted || formatMwk(plan.price),
    period: plan.period,
    periodDisplay: plan.periodDisplay,
    currency: plan.currency || 'MWK',
    features: getStorefrontFeatures(plan),
    popular: Boolean(plan.popular),
    highlight: Boolean(plan.highlight),
    savings: plan.savings || null,
    badge: plan.badge || null,
    requiresEIS: Boolean(plan.requiresEIS),
    planCategory: isEISPlan(plan.id) ? PLAN_CATEGORY.MRA_EIS : PLAN_CATEGORY.CORE,
    ctaText: plan.requiresEIS ? 'Subscribe to MRA EIS' : 'Start subscription',
    source: 'catalog',
  }));
}

function mapDbPlan(row) {
  const code = row.planCode;
  const catalog = Object.values(SUBSCRIPTION_PLANS || {}).find((p) => p.id === code);
  const price = toNumber(row.basePrice, catalog?.price || 0);
  const isEis =
    row.planCategory === PLAN_CATEGORY.MRA_EIS || isEISPlan(code) || Boolean(catalog?.requiresEIS);
  const period = row.billingFrequency || catalog?.period || 'month';
  const draft = {
    id: code,
    requiresEIS: isEis,
    features: Array.isArray(row.featuresJson) && row.featuresJson.length
      ? row.featuresJson
      : catalog?.features || [],
  };
  return {
    id: code,
    name: row.publicName || row.name || catalog?.displayName || code,
    displayName: row.publicName || row.name || catalog?.displayName || code,
    price,
    priceFormatted: formatMwk(price),
    period,
    periodDisplay: period === 'year' ? '/year' : period === 'quarter' ? '/quarter' : '/month',
    currency: row.currency || 'MWK',
    // Prefer canonical storefront lists so landing and /subscription stay identical
    features: getStorefrontFeatures(draft),
    popular: Boolean(row.isFeatured || catalog?.popular),
    highlight: Boolean(row.isFeatured || catalog?.highlight),
    savings: row.highlightText || catalog?.savings || null,
    badge: row.presentationJson?.badge || catalog?.badge || (isEis ? 'EIS' : null),
    requiresEIS: isEis,
    planCategory: isEis ? PLAN_CATEGORY.MRA_EIS : PLAN_CATEGORY.CORE,
    ctaText: row.ctaText || (isEis ? 'Subscribe to MRA EIS' : 'Start subscription'),
    source: 'platform',
    version: row.version,
  };
}

/**
 * Public storefront plans: published + isPublic PlatformPlanVersion rows,
 * falling back to catalog (core + EIS).
 */
export async function listPublicStorefrontPlans() {
  const fallback = catalogFallbackPlans();

  if (typeof prisma.platformPlanVersion?.findMany !== 'function') {
    return { plans: fallback, source: 'catalog' };
  }

  try {
    const rows = await prisma.platformPlanVersion.findMany({
      where: {
        isPublic: true,
        status: { in: [PLAN_STATUS.PUBLISHED, PLAN_STATUS.ACTIVE] },
      },
      orderBy: [{ displayOrder: 'asc' }, { planCode: 'asc' }, { version: 'desc' }],
      take: 100,
    });

    if (!rows.length) {
      return { plans: fallback, source: 'catalog' };
    }

    const latestByCode = {};
    for (const row of rows) {
      if (!latestByCode[row.planCode]) latestByCode[row.planCode] = row;
    }

    const fromDb = Object.values(latestByCode).map(mapDbPlan);

    // Ensure catalog codes missing from DB still appear (e.g. core if only EIS published)
    const codes = new Set(fromDb.map((p) => p.id));
    for (const plan of fallback) {
      if (!codes.has(plan.id)) fromDb.push(plan);
    }

    fromDb.sort((a, b) => {
      const ao = isEISPlan(a.id) ? 10 : 0;
      const bo = isEISPlan(b.id) ? 10 : 0;
      if (ao !== bo) return ao - bo;
      return String(a.id).localeCompare(String(b.id));
    });

    return { plans: fromDb, source: 'platform' };
  } catch (err) {
    console.warn('[publicPlans] falling back to catalog:', err?.message || err);
    return { plans: fallback, source: 'catalog' };
  }
}
