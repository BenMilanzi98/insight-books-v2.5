import { describe, it, expect } from 'vitest';
import {
  listProductModules,
  listProductFeatures,
  PRODUCT_CATALOGUE_VERSION,
  INSTRUMENTED_FEATURE_CODES,
} from '@/lib/admin/productCatalogue';
import {
  evaluateProductReliability,
  PRODUCT_RELIABILITY_STATUS,
  SYSTEM_ADMIN_PERMISSIONS,
  NAV_PERMISSION_MAP,
  resolveProductAnalyticsAccess,
} from '@/lib/admin/productAnalytics';
import {
  ANALYTICS_EVENT_TYPES,
  VERIFIED_EMITTERS,
  SCAFFOLD_ONLY,
} from '@/lib/admin/analytics';

describe('product catalogue (repo-backed)', () => {
  it('lists repo modules including invoices, sales, eis', () => {
    const modules = listProductModules();
    expect(PRODUCT_CATALOGUE_VERSION).toMatch(/product-catalogue-/);
    expect(Array.isArray(modules)).toBe(true);
    expect(modules.length).toBeGreaterThanOrEqual(3);

    const codes = modules.map((m) => m.code);
    expect(codes).toEqual(expect.arrayContaining(['invoices', 'sales', 'eis']));

    for (const mod of modules) {
      expect(mod).toMatchObject({
        code: expect.any(String),
        area: expect.any(String),
        instrumentation: expect.any(String),
      });
    }
  });

  it('seeds Wave 1 instrumented feature codes only for commerce trio', () => {
    const features = listProductFeatures();
    const codes = features.map((f) => f.code);
    expect(codes).toEqual(
      expect.arrayContaining(['invoices.post', 'sales.pos.complete', 'eis.fiscal.accept'])
    );
    expect(INSTRUMENTED_FEATURE_CODES.has('invoices.post')).toBe(true);
    expect(INSTRUMENTED_FEATURE_CODES.has('sales.pos.complete')).toBe(true);
    expect(INSTRUMENTED_FEATURE_CODES.has('eis.fiscal.accept')).toBe(true);
    // Uninstrumented module features must not pretend to be live
    const payroll = features.find((f) => f.moduleCode === 'payroll' && f.instrumented);
    expect(payroll).toBeUndefined();
  });
});

describe('product reliability gate', () => {
  it('returns NOT_INSTRUMENTED for uninstrumented feature metrics', () => {
    const result = evaluateProductReliability('product.feature.payroll.run', {
      featureCode: 'payroll.run',
    });
    expect(result.status).toBe(PRODUCT_RELIABILITY_STATUS.NOT_INSTRUMENTED);
    expect(result.value).toBeNull();
    expect(result.reasonCode).toBeTruthy();
  });

  it('returns AVAILABLE for instrumented commerce feature metrics', () => {
    const result = evaluateProductReliability('product.feature.invoices.post.count', {
      featureCode: 'invoices.post',
    });
    expect(result.status).toBe(PRODUCT_RELIABILITY_STATUS.AVAILABLE);
  });

  it('returns DEFINITION_MISSING when feature is absent from catalogue', () => {
    const result = evaluateProductReliability('product.feature.unknown.x', {
      featureCode: 'totally.unknown.feature',
    });
    expect(result.status).toBe(PRODUCT_RELIABILITY_STATUS.DEFINITION_MISSING);
    expect(result.value).toBeNull();
  });
});

describe('product analytics permissions + nav stubs', () => {
  it('registers intel.productAnalytics.* permissions', () => {
    expect(SYSTEM_ADMIN_PERMISSIONS.intel.productAnalyticsRead).toBe(
      'systemAdmin.intel.productAnalytics.read'
    );
    expect(SYSTEM_ADMIN_PERMISSIONS.intel.productAnalyticsManageDefinitions).toBe(
      'systemAdmin.intel.productAnalytics.manageDefinitions'
    );
    expect(SYSTEM_ADMIN_PERMISSIONS.intel.productAnalyticsExport).toBe(
      'systemAdmin.intel.productAnalytics.export'
    );
  });

  it('maps product-analytics routes in NAV_PERMISSION_MAP', () => {
    expect(NAV_PERMISSION_MAP['/insightbooks/intelligence/product-analytics']).toBe(
      SYSTEM_ADMIN_PERMISSIONS.intel.productAnalyticsRead
    );
    expect(
      NAV_PERMISSION_MAP['/insightbooks/intelligence/product-analytics/modules']
    ).toBe(SYSTEM_ADMIN_PERMISSIONS.intel.productAnalyticsRead);
  });

  it('resolveProductAnalyticsAccess denies by default', () => {
    const denied = resolveProductAnalyticsAccess({ role: 'Platform Support', permissions: {} });
    expect(denied.canView).toBe(false);
    const allowed = resolveProductAnalyticsAccess({
      role: 'Super Admin',
      permissions: {},
    });
    expect(allowed.canView).toBe(true);
  });
});

describe('FEATURE_USED remains scaffold-only', () => {
  it('does not promote FEATURE_USED to a free-for-all verified emitter', () => {
    expect(SCAFFOLD_ONLY.has(ANALYTICS_EVENT_TYPES.FEATURE_USED)).toBe(true);
    expect(VERIFIED_EMITTERS.has(ANALYTICS_EVENT_TYPES.FEATURE_USED)).toBe(false);
  });

  it('adds commerce product events as verified emitters', () => {
    expect(VERIFIED_EMITTERS.has(ANALYTICS_EVENT_TYPES.SALES_INVOICE_POSTED)).toBe(true);
    expect(VERIFIED_EMITTERS.has(ANALYTICS_EVENT_TYPES.POS_TRANSACTION_COMPLETED)).toBe(true);
    expect(VERIFIED_EMITTERS.has(ANALYTICS_EVENT_TYPES.MRA_EIS_TRANSACTION_ACCEPTED)).toBe(
      true
    );
  });
});
