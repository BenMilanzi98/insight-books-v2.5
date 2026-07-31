import { describe, it, expect, vi } from 'vitest';
import {
  buildCustomer360,
  listCustomerDirectory,
  buildCustomerOverviewPack,
  resolveLifecycleStage,
  CUSTOMER_CATALOGUE_VERSION,
  CUSTOMER_READINESS,
  LIFECYCLE_STAGES,
  CUSTOMER_METRIC_CODES,
} from '@/lib/admin/customers';
import { assertNoFalseZero } from '@/lib/admin/intelligence/executiveKpiPack.js';
import { METRIC_STATUS } from '@/lib/admin/intelligence/metricStates.js';
import { SYSTEM_ADMIN_PERMISSIONS, NAV_PERMISSION_MAP } from '@/lib/admin/permissions';

const FUTURE = new Date(Date.now() + 30 * 864e5);
const PAST = new Date(Date.now() - 30 * 864e5);

function fixtureTenant(overrides = {}) {
  return {
    id: 'tenant-fixture-1',
    name: 'Acme Books',
    subdomain: 'acme-books',
    status: 'ACTIVE',
    createdAt: new Date('2024-01-15T00:00:00.000Z'),
    updatedAt: new Date('2024-06-01T00:00:00.000Z'),
    subscriptionPlan: '1month',
    ...overrides,
  };
}

function fixtureSub(overrides = {}) {
  return {
    id: 'sub-1',
    tenantId: 'tenant-fixture-1',
    plan: '1month',
    amount: 12000,
    currency: 'MWK',
    status: 'Completed',
    isActive: true,
    isTrial: false,
    startedAt: new Date('2024-06-01T00:00:00.000Z'),
    expiresAt: FUTURE,
    trialStartDate: null,
    trialEndDate: null,
    updatedAt: new Date('2024-06-01T00:00:00.000Z'),
    createdAt: new Date('2024-06-01T00:00:00.000Z'),
    ...overrides,
  };
}

function makePrisma(overrides = {}) {
  const tenant = fixtureTenant();
  const sub = fixtureSub();
  return {
    tenant: {
      findUnique: vi.fn(async ({ where }) =>
        where.id === tenant.id ? tenant : null
      ),
      findMany: vi.fn(async () => [tenant]),
      count: vi.fn(async () => 1),
    },
    branch: {
      count: vi.fn(async () => 2),
    },
    user: {
      count: vi.fn(async ({ where } = {}) => {
        if (where?.lastLogin) return 1;
        if (where?.isActive) return 3;
        return 5;
      }),
      aggregate: vi.fn(async () => ({
        _max: { lastLogin: new Date('2024-07-01T12:00:00.000Z') },
      })),
    },
    accountSubscription: {
      findMany: vi.fn(async () => [sub]),
      count: vi.fn(async () => 0),
    },
    platformInvoice: {
      aggregate: vi.fn(async () => ({
        _sum: { total: 24000, outstanding: 1000 },
      })),
    },
    platformPayment: {
      aggregate: vi.fn(async () => ({
        _sum: { amount: 23000 },
      })),
    },
    mraEisTenantEntitlement: {
      findFirst: vi.fn(async () => ({
        status: 'ACTIVE',
        allowedEnvironment: 'SANDBOX',
        sandboxAllowed: true,
        productionAllowed: false,
        entitlementSource: 'MANUAL',
        effectiveFrom: new Date(),
        effectiveUntil: null,
        isCurrent: true,
      })),
    },
    ...overrides,
  };
}

const superAdmin = { id: 'a1', role: 'Super Admin', permissions: {} };

describe('permissions / nav', () => {
  it('defines intel.customers.read and maps customers nav routes', () => {
    expect(SYSTEM_ADMIN_PERMISSIONS.intel.customersRead).toBe(
      'systemAdmin.intel.customers.read'
    );
    expect(SYSTEM_ADMIN_PERMISSIONS.intel.managePortfolios).toBe(
      'systemAdmin.intel.customers.managePortfolios'
    );
    expect(NAV_PERMISSION_MAP['/insightbooks/intelligence/customers']).toBe(
      SYSTEM_ADMIN_PERMISSIONS.intel.customersRead
    );
    expect(NAV_PERMISSION_MAP['/insightbooks/intelligence/customers/overview']).toBe(
      SYSTEM_ADMIN_PERMISSIONS.intel.customersRead
    );
    expect(NAV_PERMISSION_MAP['/insightbooks/intelligence/customers/portfolios']).toBe(
      SYSTEM_ADMIN_PERMISSIONS.intel.customersRead
    );
  });
});

describe('resolveLifecycleStage', () => {
  it('returns ACTIVE_PAID for active paid subscription', () => {
    const result = resolveLifecycleStage(fixtureTenant(), {
      subscriptions: [fixtureSub()],
      now: new Date(),
    });
    expect(result.stage).toBe(LIFECYCLE_STAGES.ACTIVE_PAID);
    expect(result.ruleVersion).toBeTruthy();
  });

  it('returns TRIAL for active trial', () => {
    const result = resolveLifecycleStage(fixtureTenant({ status: 'TRIAL' }), {
      subscriptions: [
        fixtureSub({
          isTrial: true,
          isActive: true,
          trialStartDate: PAST,
          trialEndDate: FUTURE,
          status: 'active',
        }),
      ],
      now: new Date(),
    });
    expect(result.stage).toBe(LIFECYCLE_STAGES.TRIAL);
  });

  it('returns ARCHIVED for archived tenant', () => {
    const result = resolveLifecycleStage(fixtureTenant({ status: 'ARCHIVED' }), {
      subscriptions: [],
    });
    expect(result.stage).toBe(LIFECYCLE_STAGES.ARCHIVED);
  });
});

describe('buildCustomer360', () => {
  it('returns forbidden without customers.read or dashboard.view', async () => {
    const pack = await buildCustomer360(makePrisma(), {
      admin: {
        id: 'a0',
        role: 'Platform Support',
        permissions: {},
      },
      tenantId: 'tenant-fixture-1',
    });
    expect(pack.forbidden).toBe(true);
    expect(pack.ok).toBe(false);
  });

  it('allows dashboard.view and builds 360 for fixture tenant', async () => {
    const prisma = makePrisma();
    const pack = await buildCustomer360(prisma, {
      admin: {
        id: 'a2',
        role: 'Platform Support',
        permissions: {
          systemAdmin: { dashboard: { view: true, financialMetrics: true } },
        },
      },
      tenantId: 'tenant-fixture-1',
      currency: 'MWK',
    });

    expect(pack.ok).toBe(true);
    expect(pack.catalogueVersion).toBe(CUSTOMER_CATALOGUE_VERSION);
    expect(pack.customer.tenantId).toBe('tenant-fixture-1');
    expect(pack.customer.displayName).toBe('Acme Books');
    expect(pack.customer.customerReference).toBe('acme-books');
    expect(pack.hierarchy.branchCount).toBe(2);
    expect(pack.hierarchy.userCount).toBe(5);
    expect(pack.hierarchy.activeUserCount).toBe(3);
    expect(pack.adoption.status).toBe(CUSTOMER_READINESS.UNAVAILABLE);
    expect(pack.adoption.reason).toMatch(/FEATURE_USED/i);
    expect(pack.service.support.status).toBe(CUSTOMER_READINESS.NOT_INSTRUMENTED);
    expect(pack.service.onboarding.status).toBe(CUSTOMER_READINESS.NOT_INSTRUMENTED);
    expect(pack.service.training.status).toBe(CUSTOMER_READINESS.NOT_INSTRUMENTED);
    expect(pack.engagement.limitations).toMatch(/not unique-user DAU/i);
    expect(pack.commercial.mrr).toBeGreaterThan(0);

    const blob = JSON.stringify(pack);
    expect(blob).not.toMatch(/\bSale\b/);
    expect(blob).not.toMatch(/tenantActivity/);
  });

  it('allows intel.customers.read', async () => {
    const pack = await buildCustomer360(makePrisma(), {
      admin: {
        id: 'a3',
        role: 'Platform Support',
        permissions: {
          systemAdmin: { intel: { 'customers.read': true } },
        },
      },
      tenantId: 'tenant-fixture-1',
    });
    expect(pack.ok).toBe(true);
    expect(pack.forbidden).toBeFalsy();
  });

  it('returns notFound for missing tenant', async () => {
    const pack = await buildCustomer360(makePrisma(), {
      admin: superAdmin,
      tenantId: 'missing-tenant',
    });
    expect(pack.ok).toBe(false);
    expect(pack.notFound).toBe(true);
  });

  it('marks commercial money UNAVAILABLE for currency ALL', async () => {
    const pack = await buildCustomer360(makePrisma(), {
      admin: superAdmin,
      tenantId: 'tenant-fixture-1',
      currency: 'ALL',
    });
    expect(pack.ok).toBe(true);
    expect(pack.commercial.mrr).toBeNull();
    expect(pack.commercial.arr).toBeNull();
    expect(pack.commercial.billed).toBeNull();
    expect(pack.commercial.collected).toBeNull();
    expect(pack.commercial.outstanding).toBeNull();
    expect(pack.commercial.status).toBe(CUSTOMER_READINESS.UNAVAILABLE);
    const envelopes = pack.commercial._envelope || {};
    for (const m of Object.values(envelopes)) {
      expect(assertNoFalseZero(m)).toBe(true);
      expect(m.value).toBeNull();
      expect(m.status).toBe(METRIC_STATUS.UNAVAILABLE);
    }
  });

  it('marks commercial money UNAVAILABLE when billing client is missing', async () => {
    const prisma = makePrisma({
      platformInvoice: {},
    });
    const pack = await buildCustomer360(prisma, {
      admin: superAdmin,
      tenantId: 'tenant-fixture-1',
      currency: 'MWK',
    });
    expect(pack.ok).toBe(true);
    expect(pack.commercial.status).toBe(CUSTOMER_READINESS.UNAVAILABLE);
    expect(pack.commercial.reason).toBe('query_failed');
    expect(pack.commercial.mrr).toBeNull();
    expect(pack.commercial.arr).toBeNull();
    expect(pack.commercial.billed).toBeNull();
    expect(pack.commercial.collected).toBeNull();
    expect(pack.commercial.outstanding).toBeNull();
    expect(pack.commercial.billed).not.toBe(0);
    expect(pack.commercial.collected).not.toBe(0);
    expect(pack.commercial.outstanding).not.toBe(0);
    const envelopes = pack.commercial._envelope || {};
    for (const code of [
      CUSTOMER_METRIC_CODES.BILLED,
      CUSTOMER_METRIC_CODES.COLLECTED,
      CUSTOMER_METRIC_CODES.OUTSTANDING,
      CUSTOMER_METRIC_CODES.MRR,
      CUSTOMER_METRIC_CODES.ARR,
    ]) {
      const m = envelopes[code];
      expect(m).toBeTruthy();
      expect(assertNoFalseZero(m)).toBe(true);
      expect(m.value).toBeNull();
      expect(m.status).toBe(METRIC_STATUS.UNAVAILABLE);
    }
  });

  it('assertNoFalseZero on overview envelopes and unavailable sections', async () => {
    const prisma = makePrisma({
      tenant: {
        findUnique: vi.fn(async () => fixtureTenant()),
        findMany: vi.fn(async () => [fixtureTenant()]),
        count: vi.fn(async () => {
          throw new Error('db down');
        }),
      },
      accountSubscription: {
        findMany: vi.fn(async () => {
          throw new Error('db down');
        }),
        count: vi.fn(async () => {
          throw new Error('db down');
        }),
      },
    });

    const overview = await buildCustomerOverviewPack(prisma, { admin: superAdmin });
    expect(overview.ok).toBe(true);
    for (const m of Object.values(overview.metrics)) {
      expect(assertNoFalseZero(m)).toBe(true);
    }
    expect(overview.metrics[CUSTOMER_METRIC_CODES.TENANTS_TOTAL].status).toBe(
      METRIC_STATUS.UNAVAILABLE
    );
    expect(overview.metrics[CUSTOMER_METRIC_CODES.TENANTS_TOTAL].value).toBeNull();
    expect(overview.adoption.status).toBe(CUSTOMER_READINESS.UNAVAILABLE);
  });
});

describe('listCustomerDirectory', () => {
  it('forbids without perms and paginates with perms', async () => {
    const denied = await listCustomerDirectory(makePrisma(), {
      admin: { id: 'x', role: 'Platform Support', permissions: {} },
      page: 1,
      pageSize: 10,
    });
    expect(denied.forbidden).toBe(true);

    const ok = await listCustomerDirectory(makePrisma(), {
      admin: superAdmin,
      page: 1,
      pageSize: 10,
      q: 'acme',
    });
    expect(ok.ok).toBe(true);
    expect(ok.rows.length).toBe(1);
    expect(ok.rows[0].tenantId).toBe('tenant-fixture-1');
    expect(ok.page).toBe(1);
  });
});
