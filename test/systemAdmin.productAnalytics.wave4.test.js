import { describe, it, expect, vi } from 'vitest';
import {
  FUNNEL_CODES,
  FUNNEL_STEP_STATUS,
  FUNNEL_DEFINITION_VERSION,
  enforceFunnelStepOrder,
  funnelConversionRate,
  evaluateProductFunnel,
  buildProductFunnelsPack,
  buildFirstValueCohorts,
  associationRate,
  ASSOCIATION_DISCLAIMER,
  productSignalIdentity,
  evaluateProductSignalCandidates,
  dedupeProductSignals,
  buildProductSignalsPack,
  PRODUCT_SIGNAL_CODES,
  applyReconHonesty,
  buildProductReconciliation,
  PRODUCT_RELIABILITY_STATUS,
  buildProductAnalyticsExportPack,
} from '@/lib/admin/productAnalytics';

function mockAdmin(perms = { 'systemAdmin.intel.productAnalytics.read': true }) {
  return {
    id: 'admin-1',
    role: 'Platform Support',
    permissions: Array.isArray(perms)
      ? Object.fromEntries(perms.map((p) => [p, true]))
      : perms,
  };
}

function mockSuperAdmin() {
  return { id: 'a-super', role: 'Super Admin', permissions: {} };
}

describe('Phase 9 Wave 4 — funnel step order honesty', () => {
  it('blocks later REACHED when a prior step is incomplete', () => {
    const ordered = enforceFunnelStepOrder([
      { id: 'entitled', status: FUNNEL_STEP_STATUS.REACHED },
      { id: 'available', status: FUNNEL_STEP_STATUS.NOT_REACHED },
      { id: 'first_value', status: FUNNEL_STEP_STATUS.REACHED },
      { id: 'repeat', status: FUNNEL_STEP_STATUS.REACHED },
    ]);
    expect(ordered[2].status).toBe(FUNNEL_STEP_STATUS.INCOMPLETE);
    expect(ordered[2].reasonCode).toBe('prior_step_missing');
    expect(ordered[3].status).toBe(FUNNEL_STEP_STATUS.INCOMPLETE);
  });

  it('null conversion when incomplete — never invented zero from missing evidence', () => {
    expect(funnelConversionRate(10, 0, false)).toBeNull();
    expect(funnelConversionRate(null, 0, true)).toBeNull();
    expect(funnelConversionRate(10, 5, true)).toBe(0.5);
  });

  it('marks first_value incomplete when no usage facts (not zero conversion)', async () => {
    const prisma = {
      platformFeatureEntitlement: {
        findUnique: vi.fn(async () => ({
          status: 'ACTIVE',
          startDate: null,
          endDate: null,
        })),
      },
      accountSubscription: { findFirst: vi.fn(async () => null) },
      productFirstValueFact: {
        findUnique: vi.fn(async () => null),
      },
      analyticsFactProductUsage: {
        findMany: vi.fn(async () => []),
      },
    };

    const result = await evaluateProductFunnel(prisma, {
      funnelCode: FUNNEL_CODES.COMMERCE_INVOICE_VALUE,
      tenantId: 't1',
    });

    expect(result.definitionVersion).toBe(FUNNEL_DEFINITION_VERSION);
    expect(result.complete).toBe(false);
    const first = result.steps.find((s) => s.id === 'first_value');
    expect(first.status).toBe(FUNNEL_STEP_STATUS.INCOMPLETE);
    expect(first.reasonCode).toBe('missing_events');
    expect(result.conversionRates.available_to_first_value).toBeNull();
  });
});

describe('Phase 9 Wave 4 — cohorts honesty', () => {
  it('omits missing periods — no zero-fill', () => {
    const matrix = buildFirstValueCohorts([
      {
        tenantId: 't1',
        featureCode: 'invoices.post',
        occurredAt: '2026-01-15T00:00:00.000Z',
      },
      {
        tenantId: 't2',
        featureCode: 'invoices.post',
        occurredAt: '2026-03-01T00:00:00.000Z',
      },
    ]);
    expect(matrix.zeroFilled).toBe(false);
    expect(matrix.rows.map((r) => r.period)).toEqual(['2026-01', '2026-03']);
    expect(matrix.rows.find((r) => r.period === '2026-02')).toBeUndefined();
    expect(matrix.associationLabel).toMatch(/association/i);
    expect(matrix.associationLabel).toMatch(/not causation/i);
  });

  it('association helper never claims causation', () => {
    const assoc = associationRate(2, 10);
    expect(assoc.rate).toBe(0.2);
    expect(assoc.causation).toBe(false);
    expect(assoc.label).toBe(ASSOCIATION_DISCLAIMER);
  });
});

describe('Phase 9 Wave 4 — signal dedupe / identity', () => {
  it('builds idempotent identity and dedupes', () => {
    const a = productSignalIdentity(
      't1',
      PRODUCT_SIGNAL_CODES.ENTITLED_NO_FIRST_VALUE,
      'invoices.post'
    );
    const b = productSignalIdentity(
      't1',
      PRODUCT_SIGNAL_CODES.ENTITLED_NO_FIRST_VALUE,
      'invoices.post'
    );
    expect(a).toBe(b);

    const candidates = [
      ...evaluateProductSignalCandidates({
        tenantId: 't1',
        featureCode: 'invoices.post',
        entitled: true,
        hasFirstValue: false,
      }),
      ...evaluateProductSignalCandidates({
        tenantId: 't1',
        featureCode: 'invoices.post',
        entitled: true,
        hasFirstValue: false,
      }),
    ];
    expect(candidates.length).toBeGreaterThan(1);
    const deduped = dedupeProductSignals(candidates);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].identity).toBe(a);
    expect(JSON.stringify(deduped[0])).not.toMatch(/probability|expectedRevenue/i);
  });

  it('does not invent signals for uninstrumented features', () => {
    const candidates = evaluateProductSignalCandidates({
      tenantId: 't1',
      featureCode: 'payroll.run',
      entitled: true,
      hasFirstValue: false,
    });
    expect(candidates).toEqual([]);
  });
});

describe('Phase 9 Wave 4 — recon honesty', () => {
  it('failed recon clears conversion and complete flags', () => {
    const honest = applyReconHonesty({
      reconStatus: PRODUCT_RELIABILITY_STATUS.RECONCILIATION_FAILED,
      conversionRate: 0.9,
      complete: true,
      metricStatus: PRODUCT_RELIABILITY_STATUS.AVAILABLE,
    });
    expect(honest.blockedByRecon).toBe(true);
    expect(honest.complete).toBe(false);
    expect(honest.conversionRate).toBeNull();
    expect(honest.metricStatus).toBe(
      PRODUCT_RELIABILITY_STATUS.RECONCILIATION_FAILED
    );
  });

  it('events without facts → FAIL and blocked metrics', async () => {
    const prisma = {
      analyticsEvent: {
        count: vi.fn(async () => 5),
      },
      analyticsFactProductUsage: {
        count: vi.fn(async () => 0),
      },
      productFirstValueFact: {
        count: vi.fn(async () => 0),
      },
      customerOwnership: {
        findMany: vi.fn(async () => []),
      },
    };

    const pack = await buildProductReconciliation(prisma, {
      admin: mockSuperAdmin(),
    });

    expect(pack.ok).toBe(true);
    expect(pack.overallStatus).toBe('FAIL');
    expect(pack.blockedByRecon).toBe(true);
    expect(pack.complete).toBe(false);
    expect(pack.conversionRate).toBeNull();
    const invoice = pack.features.find((f) => f.featureCode === 'invoices.post');
    expect(invoice.reconStatus).toBe('FAIL');
    expect(invoice.complete).toBe(false);
  });
});

describe('Phase 9 Wave 4 — export permission gate', () => {
  it('requires export permission', async () => {
    const pack = await buildProductAnalyticsExportPack(
      {},
      {
        admin: mockAdmin({ 'systemAdmin.intel.productAnalytics.read': true }),
        dataset: 'overview',
      }
    );
    expect(pack.ok).toBe(false);
    expect(pack.forbidden).toBe(true);
    expect(pack.reasonCode).toBe('export_permission_required');
  });
});

describe('Phase 9 Wave 4 — portfolio isolation (funnels / signals / export)', () => {
  function portfolioAgentPrisma(ownedTenantIds = ['tenant-owned-1']) {
    return {
      customerOwnership: {
        findMany: vi.fn(async () =>
          ownedTenantIds.map((tenantId) => ({ tenantId }))
        ),
      },
    };
  }

  function portfolioAgentAdmin() {
    return mockAdmin({
      'systemAdmin.intel.productAnalytics.read': true,
      'systemAdmin.intel.productAnalytics.export': true,
      'systemAdmin.intel.customers.read': true,
    });
  }

  it('rejects out-of-portfolio tenant funnel evaluation', async () => {
    const result = await buildProductFunnelsPack(portfolioAgentPrisma(), {
      admin: portfolioAgentAdmin(),
      tenantId: 'tenant-other',
      funnelCode: FUNNEL_CODES.COMMERCE_INVOICE_VALUE,
    });
    expect(result.forbidden).toBe(true);
    expect(result.reasonCode).toBe('tenant_out_of_portfolio');
    expect(result.portfolioMode).toBe('owned');
  });

  it('rejects out-of-portfolio tenant signal evaluation', async () => {
    const result = await buildProductSignalsPack(portfolioAgentPrisma(), {
      admin: portfolioAgentAdmin(),
      tenantId: 'tenant-other',
    });
    expect(result.forbidden).toBe(true);
    expect(result.reasonCode).toBe('tenant_out_of_portfolio');
    expect(result.portfolioMode).toBe('owned');
  });

  it('rejects out-of-portfolio tenant on export', async () => {
    const pack = await buildProductAnalyticsExportPack(portfolioAgentPrisma(), {
      admin: portfolioAgentAdmin(),
      dataset: 'funnels',
      tenantId: 'tenant-other',
    });
    expect(pack.ok).toBe(false);
    expect(pack.forbidden).toBe(true);
    expect(pack.reasonCode).toBe('tenant_out_of_portfolio');
    expect(pack.portfolioMode).toBe('owned');
  });
});
