import { describe, it, expect, vi } from 'vitest';
import {
  computeRenewalExposure,
  applyForecastScenarios,
  FORECAST_SCENARIO_MULTIPLIERS,
  FORECAST_LABEL,
  buildForecastAnalyticsPack,
  assertNoFalseZero,
  REVENUE_KPI_CODES,
  METRIC_STATUS,
} from '@/lib/admin/revenue';

const adminFinance = { id: 'a1', role: 'Super Admin', permissions: {} };

function makePrisma(overrides = {}) {
  return {
    accountSubscription: {
      findMany: vi.fn(async () => []),
    },
    ...overrides,
  };
}

describe('applyForecastScenarios', () => {
  it('applies documented 0.9 / 1.0 / 1.1 multipliers', () => {
    expect(FORECAST_SCENARIO_MULTIPLIERS).toEqual({
      conservative: 0.9,
      base: 1.0,
      optimistic: 1.1,
    });
    const result = applyForecastScenarios(1000);
    expect(result.ok).toBe(true);
    expect(result.label).toBe(FORECAST_LABEL);
    expect(result.scenarios).toEqual({
      conservative: 900,
      base: 1000,
      optimistic: 1100,
    });
  });
});

describe('computeRenewalExposure', () => {
  it('sums estimated MRR for subs expiring within horizon', async () => {
    const now = new Date('2026-07-28T12:00:00Z');
    const prisma = makePrisma({
      accountSubscription: {
        findMany: vi.fn(async () => [
          {
            id: 's1',
            tenantId: 't1',
            plan: '1month',
            amount: 1000,
            currency: 'MWK',
            expiresAt: new Date('2026-08-15T00:00:00Z'),
          },
          {
            id: 's2',
            tenantId: 't2',
            plan: '1month',
            amount: 500,
            currency: 'MWK',
            expiresAt: new Date('2026-09-01T00:00:00Z'),
          },
          {
            id: 's3',
            tenantId: 't3',
            plan: '1month',
            amount: 999,
            currency: 'USD',
            expiresAt: new Date('2026-08-10T00:00:00Z'),
          },
        ]),
      },
    });

    const result = await computeRenewalExposure(prisma, {
      currency: 'MWK',
      horizonDays: 90,
      now,
    });
    expect(result.ok).toBe(true);
    expect(result.label).toBe('deterministic renewal exposure');
    expect(result.exposureMrr).toBe(1500);
    expect(result.scenarios.base).toBe(1500);
    expect(result.scenarios.conservative).toBe(1350);
    expect(result.scenarios.optimistic).toBe(1650);
    expect(result.subscriptionCount).toBe(2);
  });

  it('currency=ALL → UNAVAILABLE (no FX)', async () => {
    const result = await computeRenewalExposure(makePrisma(), {
      currency: 'ALL',
      horizonDays: 30,
      now: new Date('2026-07-28'),
    });
    expect(result.ok).toBe(false);
    expect(result.reasonCode).toBe('fx_unavailable');
    expect(result.exposureMrr).toBeNull();
    expect(result.scenarios).toBeNull();
  });

  it('does not query Tenant Sale', async () => {
    const prisma = makePrisma();
    await computeRenewalExposure(prisma, {
      currency: 'MWK',
      horizonDays: 30,
      now: new Date('2026-07-28'),
    });
    expect(prisma.accountSubscription.findMany).toHaveBeenCalled();
    expect(prisma.sale).toBeUndefined();
    expect(JSON.stringify(prisma)).not.toMatch(/\bSale\b/);
  });
});

describe('buildForecastAnalyticsPack', () => {
  it('marks money UNAVAILABLE for currency=ALL', async () => {
    const pack = await buildForecastAnalyticsPack(makePrisma(), {
      admin: adminFinance,
      currency: 'ALL',
      now: new Date('2026-07-28'),
    });
    expect(pack.ok).toBe(true);
    const exposure = pack.metrics[REVENUE_KPI_CODES.FORECAST_RENEWAL_EXPOSURE];
    expect(exposure.status).toBe(METRIC_STATUS.UNAVAILABLE);
    expect(exposure.value).toBeNull();
    expect(exposure.reasonCode).toBe('fx_unavailable');
    expect(assertNoFalseZero(exposure)).toBe(true);
    for (const m of Object.values(pack.metrics)) {
      expect(assertNoFalseZero(m)).toBe(true);
    }
  });

  it('builds ready scenario metrics without Sale in pack blob', async () => {
    const now = new Date('2026-07-28T12:00:00Z');
    const prisma = makePrisma({
      accountSubscription: {
        findMany: vi.fn(async () => [
          {
            id: 's1',
            tenantId: 't1',
            plan: '1month',
            amount: 2000,
            currency: 'MWK',
            expiresAt: new Date('2026-08-20T00:00:00Z'),
          },
        ]),
      },
    });
    const pack = await buildForecastAnalyticsPack(prisma, {
      admin: adminFinance,
      currency: 'MWK',
      now,
      horizonDays: 60,
    });
    expect(pack.ok).toBe(true);
    expect(pack.label).toBe('deterministic renewal exposure');
    expect(pack.metrics[REVENUE_KPI_CODES.FORECAST_RENEWAL_EXPOSURE].value).toBe(2000);
    expect(pack.metrics[REVENUE_KPI_CODES.FORECAST_SCENARIO_CONSERVATIVE].value).toBe(1800);
    expect(pack.metrics[REVENUE_KPI_CODES.FORECAST_SCENARIO_OPTIMISTIC].value).toBe(2200);
    const blob = JSON.stringify(pack);
    expect(blob).not.toMatch(/\bSale\b/);
    expect(blob).not.toMatch(/tenantActivity/);
  });

  it('forbids without view permission', async () => {
    const pack = await buildForecastAnalyticsPack(makePrisma(), {
      admin: { id: 'x', role: 'Platform Support', permissions: {} },
      currency: 'MWK',
    });
    expect(pack.forbidden).toBe(true);
  });
});
