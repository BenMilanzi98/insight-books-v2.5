import { describe, expect, it } from 'vitest';
import { openDesktopDb } from '../../lib/desktop/sqlite/db.js';
import { replaceSnapshot, getProduct } from '../../lib/desktop/sqlite/snapshotStore.js';
import { appendOutbox, listOutbox } from '../../lib/desktop/sqlite/outboxStore.js';
import { canPullSnapshot } from '../../lib/desktop/outboxState.js';
import { writeMeta, readMeta } from '../../lib/desktop/sqlite/meta.js';

describe('sqlite snapshot + outbox', () => {
  it('replaces products atomically and keeps outbox', () => {
    const db = openDesktopDb(':memory:');
    appendOutbox(db, { id: 'm1', kind: 'pos.sale', payload: { n: 1 } });
    replaceSnapshot(db, {
      version: 1,
      tenantId: 't1',
      products: [{ id: 'p1', quantity: 5, name: 'Bread' }],
      customers: [],
      taxTypes: [],
      paymentAccounts: [],
      openInvoices: [],
      recentPayments: [],
      sessionUser: { id: 'u1' },
      tenantSettings: {},
      posConfig: {},
      serverNow: '2026-08-15T10:00:00.000Z',
    });
    expect(getProduct(db, 'p1').quantity).toBe(5);
    expect(listOutbox(db)).toHaveLength(1);
    replaceSnapshot(db, {
      version: 1,
      tenantId: 't1',
      products: [{ id: 'p1', quantity: 4, name: 'Bread' }],
      customers: [],
      taxTypes: [],
      paymentAccounts: [],
      openInvoices: [],
      recentPayments: [],
      sessionUser: { id: 'u1' },
      tenantSettings: {},
      posConfig: {},
      serverNow: '2026-08-15T11:00:00.000Z',
    });
    expect(getProduct(db, 'p1').quantity).toBe(4);
    expect(listOutbox(db)).toHaveLength(1);
  });

  it('populates sales and seeds lastSuccessfulSyncAt on first bind', () => {
    const db = openDesktopDb(':memory:');
    replaceSnapshot(db, {
      version: 1,
      tenantId: 't1',
      products: [],
      customers: [],
      taxTypes: [],
      paymentAccounts: [],
      openInvoices: [],
      recentPayments: [],
      sales: [
        {
          id: 'sale1',
          saleNumber: 'TILL1-SALE-1',
          date: '2026-08-15',
          subtotal: 1000,
          total: 1000,
          status: 'completed',
          items: [],
          createdAt: '2026-08-15T10:00:00.000Z',
        },
      ],
      sessionUser: { id: 'u1' },
      tenantSettings: {},
      posConfig: {},
      serverNow: '2026-08-15T10:00:00.000Z',
    });
    const rows = db.prepare('SELECT payload FROM sales').all();
    expect(rows).toHaveLength(1);
    expect(JSON.parse(rows[0].payload).saleNumber).toBe('TILL1-SALE-1');
    expect(readMeta(db).lastSuccessfulSyncAt).toBe(String(Date.parse('2026-08-15T10:00:00.000Z')));
    expect(readMeta(db).lastLocalNow).toBe(String(Date.parse('2026-08-15T10:00:00.000Z')));
  });

  it('assigns increasing seq', () => {
    const db = openDesktopDb(':memory:');
    appendOutbox(db, { id: 'a', kind: 'pos.sale', payload: {} });
    appendOutbox(db, { id: 'b', kind: 'pos.sale', payload: {} });
    expect(listOutbox(db).map((r) => r.seq)).toEqual([1, 2]);
  });
});
