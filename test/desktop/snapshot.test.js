import { describe, expect, it } from 'vitest';
import { buildDesktopSnapshot } from '../../lib/desktop/cloud/snapshot.js';

function fakePrisma() {
  return {
    user: {
      findFirst: async () => ({
        id: 'u1',
        name: 'Till User',
        email: 'till@example.com',
        tenantId: 't1',
        role: { id: 'r1', name: 'Sales', permissions: ['sales.view'] },
      }),
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
});
