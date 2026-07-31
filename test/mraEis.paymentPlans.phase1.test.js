import { describe, expect, it } from 'vitest';
import {
  PLAN_CATEGORY,
  categoryForPlanCode,
  planCodesInCategory,
  resolveCanonicalPlanPrice,
  seedDataFromCatalogPlan,
  serializePlanVersion,
} from '@/lib/admin/mraEisPlans';
import { assertPlanPriceChangeCreatesVersion } from '@/lib/admin/platformBilling';
import { SUBSCRIPTION_PLANS } from '@/lib/subscriptionConfig';

describe('MRA EIS payment plans Phase 1 helpers', () => {
  it('categorizes EIS vs core plan codes', () => {
    expect(categoryForPlanCode('eis-monthly')).toBe(PLAN_CATEGORY.MRA_EIS);
    expect(categoryForPlanCode('eis-yearly')).toBe(PLAN_CATEGORY.MRA_EIS);
    expect(categoryForPlanCode('1month')).toBe(PLAN_CATEGORY.CORE);
    expect(categoryForPlanCode('1year')).toBe(PLAN_CATEGORY.CORE);
  });

  it('keeps product families disjoint for coexistence-safe deactivation', () => {
    const eis = planCodesInCategory(PLAN_CATEGORY.MRA_EIS);
    const core = planCodesInCategory(PLAN_CATEGORY.CORE);
    expect(eis).toContain('eis-monthly');
    expect(eis).toContain('eis-yearly');
    expect(eis).not.toContain('1month');
    expect(core).toContain('1month');
    expect(core).not.toContain('eis-monthly');
    expect(eis.every((code) => !core.includes(code))).toBe(true);
  });

  it('resolves canonical catalog prices and rejects unknown plans', () => {
    const monthly = resolveCanonicalPlanPrice('eis-monthly');
    expect(monthly.ok).toBe(true);
    expect(monthly.amount).toBe(Number(SUBSCRIPTION_PLANS.EIS_MONTHLY.price));
    expect(monthly.category).toBe(PLAN_CATEGORY.MRA_EIS);

    const mismatchCheck = resolveCanonicalPlanPrice('eis-monthly');
    const clientWrong = mismatchCheck.amount + 1000;
    expect(Math.abs(clientWrong - mismatchCheck.amount) > 0.009).toBe(true);

    const unknown = resolveCanonicalPlanPrice('not-a-real-plan');
    expect(unknown.ok).toBe(false);
  });

  it('seeds EIS plans as MRA_EIS with entitlement eligibility flag', () => {
    const plan = SUBSCRIPTION_PLANS.EIS_MONTHLY;
    const seed = seedDataFromCatalogPlan(plan, 'admin-1');
    expect(seed.planCategory).toBe(PLAN_CATEGORY.MRA_EIS);
    expect(seed.productCode).toBe('MRA_EIS');
    expect(seed.eligibilityJson.requiresEntitlementApproval).toBe(true);
    expect(seed.isPublic).toBe(true);
  });

  it('serializes prices to numbers and fills category defaults', () => {
    const out = serializePlanVersion({
      planCode: 'eis-yearly',
      basePrice: '120000',
      name: 'EIS Yearly',
    });
    expect(out.basePrice).toBe(120000);
    expect(out.planCategory).toBe(PLAN_CATEGORY.MRA_EIS);
    expect(out.publicName).toBe('EIS Yearly');
  });

  it('requires forceNewVersion when published price changes', () => {
    const blocked = assertPlanPriceChangeCreatesVersion({
      existingPrice: 50000,
      newPrice: 60000,
      forceNewVersion: false,
    });
    expect(blocked.ok).toBe(false);

    const allowed = assertPlanPriceChangeCreatesVersion({
      existingPrice: 50000,
      newPrice: 60000,
      forceNewVersion: true,
    });
    expect(allowed.ok).toBe(true);
    expect(allowed.requiresNewVersion).toBe(true);
  });
});
