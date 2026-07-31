import { describe, it, expect, vi } from 'vitest';
import {
  buildCustomer360,
  listUnassignedCustomers,
  resolvePortfolioScope,
  assertTenantInPortfolio,
} from '@/lib/admin/customers';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';

const FUTURE = new Date(Date.now() + 30 * 864e5);

function fixtureTenant(id = 'tenant-owned-1', overrides = {}) {
  return {
    id,
    name: `Tenant ${id}`,
    subdomain: id,
    status: 'ACTIVE',
    createdAt: new Date('2024-01-15T00:00:00.000Z'),
    updatedAt: new Date('2024-06-01T00:00:00.000Z'),
    subscriptionPlan: '1month',
    ...overrides,
  };
}

function fixtureSub(tenantId = 'tenant-owned-1') {
  return {
    id: `sub-${tenantId}`,
    tenantId,
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
  };
}

function makePrisma({ ownedRows = [], tenants = null } = {}) {
  const tenantA = fixtureTenant('tenant-owned-1');
  const tenantB = fixtureTenant('tenant-other-2', { name: 'Other Co', subdomain: 'other-co' });
  const allTenants = tenants || [tenantA, tenantB];

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
    branch: { count: vi.fn(async () => 1) },
    user: {
      count: vi.fn(async () => 2),
      aggregate: vi.fn(async () => ({
        _max: { lastLogin: new Date('2024-07-01T12:00:00.000Z') },
      })),
    },
    accountSubscription: {
      findMany: vi.fn(async ({ where } = {}) => {
        const tid = where?.tenantId;
        if (tid) return [fixtureSub(tid)];
        return allTenants.map((t) => fixtureSub(t.id));
      }),
      count: vi.fn(async () => 0),
    },
    platformInvoice: {
      aggregate: vi.fn(async () => ({
        _sum: { total: 1000, outstanding: 0 },
      })),
    },
    platformPayment: {
      aggregate: vi.fn(async () => ({
        _sum: { amount: 1000 },
      })),
    },
    mraEisTenantEntitlement: {
      findFirst: vi.fn(async () => null),
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
    customerPortfolio: {
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async () => null),
      create: vi.fn(),
    },
  };
}

const agentOwner = {
  id: 'admin-owner-1',
  role: 'Platform Support',
  permissions: {
    systemAdmin: { intel: { 'customers.read': true } },
  },
};

const superAdmin = { id: 'a-super', role: 'Super Admin', permissions: {} };

describe('permissions key', () => {
  it('exposes managePortfolios', () => {
    expect(SYSTEM_ADMIN_PERMISSIONS.intel.managePortfolios).toBe(
      'systemAdmin.intel.customers.managePortfolios'
    );
  });
});

describe('portfolio scope', () => {
  it('Super Admin can read all tenants (360)', async () => {
    const prisma = makePrisma({
      ownedRows: [
        {
          id: 'own-1',
          tenantId: 'tenant-owned-1',
          ownerAdminId: 'admin-owner-1',
          status: 'ACTIVE',
          isPrimary: true,
          endAt: null,
          portfolioId: 'p1',
          ownerAdmin: { id: 'admin-owner-1', name: 'Owner', email: 'o@x.com' },
          portfolio: { id: 'p1', code: 'CS-A', name: 'East' },
        },
      ],
    });

    const other = await buildCustomer360(prisma, {
      admin: superAdmin,
      tenantId: 'tenant-other-2',
    });
    expect(other.ok).toBe(true);
    expect(other.forbidden).toBeFalsy();

    const scope = await resolvePortfolioScope(prisma, superAdmin);
    expect(scope.mode).toBe('all');
    expect(scope.isSuperAdmin).toBe(true);
  });

  it('owner with assignment cannot read other tenant 360', async () => {
    const prisma = makePrisma({
      ownedRows: [
        {
          id: 'own-1',
          tenantId: 'tenant-owned-1',
          ownerAdminId: 'admin-owner-1',
          status: 'ACTIVE',
          isPrimary: true,
          endAt: null,
          portfolioId: 'p1',
          ownerAdmin: { id: 'admin-owner-1', name: 'Owner', email: 'o@x.com' },
          portfolio: { id: 'p1', code: 'CS-A', name: 'East' },
        },
      ],
    });

    const denied = await buildCustomer360(prisma, {
      admin: agentOwner,
      tenantId: 'tenant-other-2',
    });
    expect(denied.ok).toBe(false);
    expect(denied.forbidden).toBe(true);
    expect(denied.reason).toBe('out_of_portfolio_scope');

    const allowed = await buildCustomer360(prisma, {
      admin: agentOwner,
      tenantId: 'tenant-owned-1',
    });
    expect(allowed.ok).toBe(true);
    expect(allowed.ownership.primaryOwnerId).toBe('admin-owner-1');
    expect(allowed.ownership.portfolioCode).toBe('CS-A');

    const assertDenied = await assertTenantInPortfolio(
      prisma,
      agentOwner,
      'tenant-other-2'
    );
    expect(assertDenied.ok).toBe(false);
    expect(assertDenied.forbidden).toBe(true);
  });

  it('unassigned list excludes owned tenants', async () => {
    const prisma = makePrisma({
      ownedRows: [
        {
          id: 'own-1',
          tenantId: 'tenant-owned-1',
          ownerAdminId: 'admin-owner-1',
          status: 'ACTIVE',
          isPrimary: true,
          endAt: null,
        },
      ],
    });

    const manager = {
      id: 'admin-manager',
      role: 'Platform Support',
      permissions: {
        systemAdmin: { intel: { 'customers.read': true } },
      },
    };

    const result = await listUnassignedCustomers(prisma, {
      admin: manager,
      page: 1,
      pageSize: 25,
    });
    expect(result.ok).toBe(true);
    const ids = result.rows.map((r) => r.tenantId);
    expect(ids).toContain('tenant-other-2');
    expect(ids).not.toContain('tenant-owned-1');
  });

  it('manager with zero ownership sees all (not agent-scoped)', async () => {
    const prisma = makePrisma({ ownedRows: [] });
    const manager = {
      id: 'admin-manager',
      role: 'Platform Support',
      permissions: {
        systemAdmin: { intel: { 'customers.read': true } },
      },
    };
    const scope = await resolvePortfolioScope(prisma, manager);
    expect(scope.mode).toBe('all');
    expect(scope.isManager).toBe(true);

    const pack = await buildCustomer360(prisma, {
      admin: manager,
      tenantId: 'tenant-other-2',
    });
    expect(pack.ok).toBe(true);
  });
});
