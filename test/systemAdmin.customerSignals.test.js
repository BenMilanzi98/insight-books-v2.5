import { describe, it, expect, vi } from 'vitest';
import {
  evaluateTenantSignals,
  evaluateAttentionQueue,
  deriveCandidateSignals,
  SIGNAL_CODES,
  CUSTOMER_SIGNAL_RULE_VERSION,
} from '@/lib/admin/customers';

const FUTURE = new Date(Date.now() + 14 * 864e5);
const RECENT_LOGIN = new Date(Date.now() - 2 * 864e5);

function fixtureTenant(id = 'tenant-a', overrides = {}) {
  return {
    id,
    name: `Tenant ${id}`,
    subdomain: id,
    status: 'ACTIVE',
    createdAt: new Date('2024-01-15T00:00:00.000Z'),
    updatedAt: new Date('2024-06-01T00:00:00.000Z'),
    ...overrides,
  };
}

function fixtureSub(tenantId, overrides = {}) {
  return {
    id: `sub-${tenantId}`,
    tenantId,
    plan: '1month',
    amount: 12000,
    currency: 'MWK',
    status: 'Completed',
    isActive: true,
    isTrial: false,
    expiresAt: new Date(Date.now() + 120 * 864e5),
    updatedAt: new Date(),
    createdAt: new Date(),
    ...overrides,
  };
}

function makePrisma({
  tenants = null,
  ownedRows = [],
  lastLoginByTenant = {},
  outstandingByTenant = {},
  entitlementByTenant = {},
  signals = [],
} = {}) {
  const allTenants = tenants || [
    fixtureTenant('tenant-a'),
    fixtureTenant('tenant-b', { name: 'Other', subdomain: 'tenant-b' }),
  ];
  const signalStore = [...signals];

  return {
    tenant: {
      findUnique: vi.fn(async ({ where }) =>
        allTenants.find((t) => t.id === where.id) || null
      ),
      findMany: vi.fn(async ({ where } = {}) => {
        let rows = allTenants;
        if (where?.id?.in) {
          const set = new Set(where.id.in);
          rows = rows.filter((t) => set.has(t.id));
        }
        return rows;
      }),
      count: vi.fn(async ({ where } = {}) => {
        let rows = allTenants;
        if (where?.id?.in) {
          const set = new Set(where.id.in);
          rows = rows.filter((t) => set.has(t.id));
        }
        return rows.length;
      }),
    },
    user: {
      aggregate: vi.fn(async ({ where } = {}) => {
        const tid = where?.tenantId;
        const login = tid ? lastLoginByTenant[tid] : null;
        return { _max: { lastLogin: login || null } };
      }),
      count: vi.fn(async () => 0),
    },
    accountSubscription: {
      findMany: vi.fn(async ({ where } = {}) => {
        const tid = where?.tenantId;
        if (!tid) return allTenants.map((t) => fixtureSub(t.id));
        return [fixtureSub(tid)];
      }),
    },
    platformInvoice: {
      aggregate: vi.fn(async ({ where } = {}) => {
        const tid = where?.tenantId;
        const outstanding = tid != null ? Number(outstandingByTenant[tid] || 0) : 0;
        return { _sum: { total: 0, outstanding } };
      }),
    },
    platformPayment: {
      aggregate: vi.fn(async () => ({ _sum: { amount: 0 } })),
    },
    mraEisTenantEntitlement: {
      findFirst: vi.fn(async ({ where } = {}) => {
        const tid = where?.tenantId;
        if (tid && entitlementByTenant[tid]) return entitlementByTenant[tid];
        return null;
      }),
    },
    customerOwnership: {
      findMany: vi.fn(async ({ where } = {}) => {
        let rows = ownedRows;
        if (where?.ownerAdminId) {
          rows = rows.filter((r) => r.ownerAdminId === where.ownerAdminId);
        }
        if (where?.tenantId) {
          rows = rows.filter((r) => r.tenantId === where.tenantId);
        }
        if (where?.status) {
          rows = rows.filter((r) => r.status === where.status);
        }
        return rows;
      }),
    },
    customerSignal: {
      findMany: vi.fn(async ({ where } = {}) => {
        let rows = signalStore;
        if (where?.tenantId) rows = rows.filter((r) => r.tenantId === where.tenantId);
        return rows.map((r) => ({ ...r }));
      }),
      findUnique: vi.fn(async ({ where }) =>
        signalStore.find((r) => r.id === where.id) || null
      ),
      create: vi.fn(async ({ data }) => {
        const row = {
          id: `sig-${data.tenantId}-${data.code}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        signalStore.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }) => {
        const idx = signalStore.findIndex((r) => r.id === where.id);
        if (idx < 0) throw new Error('missing');
        signalStore[idx] = { ...signalStore[idx], ...data };
        return signalStore[idx];
      }),
    },
  };
}

const superAdmin = { id: 'a-super', role: 'Super Admin', permissions: {} };

const agentOwner = {
  id: 'admin-owner-1',
  role: 'Platform Support',
  permissions: {
    systemAdmin: { intel: { 'customers.read': true } },
  },
};

describe('deriveCandidateSignals', () => {
  it('emits SUBSCRIPTION_SUSPENDED for suspended tenant', () => {
    const candidates = deriveCandidateSignals({
      tenant: fixtureTenant('t1', { status: 'SUSPENDED' }),
      lastLoginAt: RECENT_LOGIN,
      subscriptions: [fixtureSub('t1')],
      outstanding: 0,
      outstandingKnown: true,
      hasActiveOwnership: true,
      ownershipKnown: true,
      now: new Date(),
    });
    const codes = candidates.map((c) => c.code);
    expect(codes).toContain(SIGNAL_CODES.SUBSCRIPTION_SUSPENDED);
  });

  it('emits CUSTOMER_OWNER_MISSING when no active ownership', () => {
    const candidates = deriveCandidateSignals({
      tenant: fixtureTenant('t1'),
      lastLoginAt: RECENT_LOGIN,
      subscriptions: [fixtureSub('t1')],
      outstanding: 0,
      outstandingKnown: true,
      hasActiveOwnership: false,
      ownershipKnown: true,
      now: new Date(),
    });
    expect(candidates.map((c) => c.code)).toContain(SIGNAL_CODES.CUSTOMER_OWNER_MISSING);
  });

  it('never includes probability / expected revenue / health score fields', () => {
    const candidates = deriveCandidateSignals({
      tenant: fixtureTenant('t1', { status: 'SUSPENDED' }),
      lastLoginAt: null,
      subscriptions: [fixtureSub('t1', { expiresAt: FUTURE })],
      outstanding: 500,
      outstandingKnown: true,
      entitlementStatus: 'PENDING',
      hasActiveOwnership: false,
      ownershipKnown: true,
      now: new Date(),
    });
    const blob = JSON.stringify(candidates);
    expect(blob).not.toMatch(/probability/i);
    expect(blob).not.toMatch(/expectedRevenue|expected_revenue/i);
    expect(blob).not.toMatch(/healthScore|health_score/i);
    expect(candidates.map((c) => c.code)).not.toContain('FEATURE_USED');
    expect(candidates.every((c) => !('probability' in (c.payload || {})))).toBe(true);
  });
});

describe('evaluateTenantSignals', () => {
  it('suspended tenant → SUBSCRIPTION_SUSPENDED', async () => {
    const prisma = makePrisma({
      tenants: [fixtureTenant('tenant-suspended', { status: 'SUSPENDED' })],
      lastLoginByTenant: { 'tenant-suspended': RECENT_LOGIN },
      ownedRows: [
        {
          id: 'own-1',
          tenantId: 'tenant-suspended',
          ownerAdminId: 'admin-owner-1',
          status: 'ACTIVE',
          endAt: null,
        },
      ],
    });
    prisma.accountSubscription.findMany = vi.fn(async () => [
      fixtureSub('tenant-suspended'),
    ]);

    const result = await evaluateTenantSignals(prisma, 'tenant-suspended', {
      now: new Date(),
      persist: true,
    });
    expect(result.ok).toBe(true);
    expect(result.ruleVersion).toBe(CUSTOMER_SIGNAL_RULE_VERSION);
    const codes = result.signals.map((s) => s.code);
    expect(codes).toContain(SIGNAL_CODES.SUBSCRIPTION_SUSPENDED);
    const blob = JSON.stringify(result.signals);
    expect(blob).not.toMatch(/probability/i);
    expect(blob).not.toMatch(/expectedRevenue/i);
    expect(blob).not.toMatch(/healthScore/i);
  });

  it('owner missing → CUSTOMER_OWNER_MISSING when no active ownership', async () => {
    const prisma = makePrisma({
      tenants: [fixtureTenant('tenant-orphan')],
      lastLoginByTenant: { 'tenant-orphan': RECENT_LOGIN },
      ownedRows: [],
    });
    prisma.accountSubscription.findMany = vi.fn(async () => [
      fixtureSub('tenant-orphan'),
    ]);

    const result = await evaluateTenantSignals(prisma, 'tenant-orphan', {
      now: new Date(),
    });
    expect(result.ok).toBe(true);
    expect(result.signals.map((s) => s.code)).toContain(
      SIGNAL_CODES.CUSTOMER_OWNER_MISSING
    );
  });
});

describe('evaluateAttentionQueue portfolio scope', () => {
  it('portfolio-scoped agent does not see other tenants in queue', async () => {
    const prisma = makePrisma({
      tenants: [
        fixtureTenant('tenant-a', { status: 'SUSPENDED' }),
        fixtureTenant('tenant-b', { status: 'SUSPENDED', name: 'Other Co' }),
      ],
      lastLoginByTenant: {
        'tenant-a': RECENT_LOGIN,
        'tenant-b': RECENT_LOGIN,
      },
      ownedRows: [
        {
          id: 'own-1',
          tenantId: 'tenant-a',
          ownerAdminId: 'admin-owner-1',
          status: 'ACTIVE',
          endAt: null,
        },
      ],
    });
    prisma.accountSubscription.findMany = vi.fn(async ({ where } = {}) => {
      const tid = where?.tenantId;
      return tid ? [fixtureSub(tid)] : [];
    });

    const queue = await evaluateAttentionQueue(prisma, {
      admin: agentOwner,
      limit: 50,
      queue: 'all',
      now: new Date(),
    });

    expect(queue.ok).toBe(true);
    expect(queue.scope.isAgentScoped).toBe(true);
    const tenantIds = [...new Set(queue.items.map((i) => i.tenantId))];
    expect(tenantIds).toContain('tenant-a');
    expect(tenantIds).not.toContain('tenant-b');

    const asSuper = await evaluateAttentionQueue(prisma, {
      admin: superAdmin,
      limit: 50,
      queue: 'all',
      now: new Date(),
    });
    const superIds = [...new Set(asSuper.items.map((i) => i.tenantId))];
    expect(superIds).toContain('tenant-a');
    expect(superIds).toContain('tenant-b');
  });
});
