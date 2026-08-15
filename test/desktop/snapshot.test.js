import { describe, expect, it } from 'vitest';
import { buildDesktopSnapshot } from '../../lib/desktop/cloud/snapshot.js';
import { assertBoundDesktopDevice } from '../../app/api/desktop/snapshot/route.js';
import { DESKTOP_CODES } from '../../lib/desktop/codes.js';

function fakePrisma({
  user = {
    id: 'u1',
    name: 'Till User',
    email: 'till@example.com',
    tenantId: 't1',
    isActive: true,
    status: 'active',
    role: { id: 'r1', name: 'Sales', permissions: ['sales.view'] },
  },
  membership = null,
} = {}) {
  return {
    user: {
      findUnique: async () => user,
    },
    tenantMembership: {
      findUnique: async () => membership,
    },
    tenantSettings: {
      findUnique: async () => ({
        currencyCode: 'MWK',
        invoicePrefix: 'INV',
        taxEnabled: true,
        defaultTaxRate: 16.5,
        defaultLanguage: 'en',
      }),
    },
    client: {
      findMany: async () => [{ id: 'c1', name: 'Customer One', isActive: true }],
    },
    product: {
      findMany: async () => [
        {
          id: 'p1',
          name: 'Product One',
          stockLevel: 7,
          productBarcodes: [{ id: 'b1', barcode: '123456' }],
        },
      ],
    },
    taxType: {
      findMany: async () => [{ id: 'tax1', taxName: 'VAT', status: 'Active' }],
    },
    paymentAccount: {
      findMany: async () => [{ id: 'pa1', name: 'Cash' }],
    },
    invoice: {
      findMany: async () => [{ id: 'inv1', status: 'sent', items: [] }],
    },
    payment: {
      findMany: async () => [{ id: 'pay1', amount: 100 }],
    },
    posCashDay: {
      findFirst: async () => ({ id: 'day1', status: 'OPEN' }),
    },
  };
}

describe('buildDesktopSnapshot', () => {
  it('maps operational prisma results into the snapshot shape', async () => {
    const snapshot = await buildDesktopSnapshot({
      prisma: fakePrisma(),
      tenantId: 't1',
      userId: 'u1',
    });

    expect(Object.keys(snapshot)).toEqual([
      'version',
      'tenantId',
      'sessionUser',
      'tenantSettings',
      'customers',
      'products',
      'taxTypes',
      'paymentAccounts',
      'openInvoices',
      'recentPayments',
      'posConfig',
      'serverNow',
    ]);
    expect(snapshot.version).toBe(1);
    expect(snapshot.customers[0].id).toBe('c1');
    expect(snapshot.products[0].quantity).toBe(7);
    expect(snapshot.products[0].barcodes).toEqual(['123456']);
    expect(snapshot.sessionUser.role.name).toBe('Sales');
    expect(snapshot.posConfig.cashDay.id).toBe('day1');
    expect(new Date(snapshot.serverNow).toISOString()).toBe(snapshot.serverNow);
  });

  it('uses the active tenant and tenant membership role for the session user', async () => {
    const snapshot = await buildDesktopSnapshot({
      prisma: fakePrisma({
        user: {
          id: 'u1',
          name: 'Till User',
          email: 'till@example.com',
          tenantId: 'home',
          isActive: true,
          status: 'active',
          role: { id: 'home-role', name: 'Owner', permissions: ['settings.manage'] },
        },
        membership: {
          status: 'active',
          role: { id: 'member-role', name: 'Cashier', permissions: ['sales.create'] },
        },
      }),
      tenantId: 't1',
      userId: 'u1',
    });

    expect(snapshot.sessionUser.tenantId).toBe('t1');
    expect(snapshot.sessionUser.role).toEqual({
      id: 'member-role',
      name: 'Cashier',
      permissions: ['sales.create'],
    });
  });

  it.each([
    ['missing', null],
    ['inactive', { id: 'u1', isActive: false, status: 'inactive' }],
  ])('rejects a %s snapshot user clearly', async (_label, user) => {
    await expect(
      buildDesktopSnapshot({
        prisma: fakePrisma({ user }),
        tenantId: 't1',
        userId: 'u1',
      })
    ).rejects.toThrow(/snapshot user .*inactive|snapshot user .*not found/i);
  });
});

describe('assertBoundDesktopDevice', () => {
  it.each([
    ['missing device', null],
    ['unbound device', { tenantId: 't1', unboundAt: new Date() }],
    ['other tenant', { tenantId: 't2', unboundAt: null }],
  ])('rejects a %s as not bound', (_label, device) => {
    expect(() => assertBoundDesktopDevice(device, 't1')).toThrow(
      expect.objectContaining({
        code: DESKTOP_CODES.NOT_BOUND,
        status: 403,
      })
    );
  });

  it('returns a matching bound device', () => {
    const device = { id: 'd1', tenantId: 't1', unboundAt: null };

    expect(assertBoundDesktopDevice(device, 't1')).toBe(device);
  });
});
