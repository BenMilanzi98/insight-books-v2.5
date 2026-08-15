import { describe, expect, it } from 'vitest';
import { openDesktopDb } from '../../lib/desktop/sqlite/db.js';
import { replaceSnapshot, getProduct } from '../../lib/desktop/sqlite/snapshotStore.js';
import { writeMeta } from '../../lib/desktop/sqlite/meta.js';
import { handleDesktopLocal } from '../../lib/desktop/local/handlers.js';
import { listOutbox } from '../../lib/desktop/sqlite/outboxStore.js';
import { DESKTOP_CODES } from '../../lib/desktop/codes.js';

const t0 = Date.parse('2026-08-15T10:00:00.000Z');

function seed(db) {
  writeMeta(db, {
    tenantId: 't1',
    deviceId: 'pc-a',
    numberPrefix: 'TILL1',
    lastSuccessfulSyncAt: String(t0),
    lastLocalNow: String(t0),
    lastServerNow: '2026-08-15T10:00:00.000Z',
    subscriptionActive: 'true',
  });
  replaceSnapshot(db, {
    version: 1,
    tenantId: 't1',
    products: [{ id: 'p1', quantity: 10, name: 'Bread', sellingPrice: 1000 }],
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
}

describe('handleDesktopLocal POS sale', () => {
  it('writes sale, decrements stock, appends outbox', () => {
    const db = openDesktopDb(':memory:');
    seed(db);
    const res = handleDesktopLocal({
      db,
      method: 'POST',
      pathname: '/api/sales',
      body: { items: [{ productId: 'p1', quantity: 2, price: 1000 }], payments: [] },
      now: t0 + 60 * 1000,
      user: { id: 'u1', tenantId: 't1' },
    });
    expect(res.status).toBe(200);
    expect(res.json.sale.saleNumber).toBe('TILL1-SALE-1');
    expect(getProduct(db, 'p1').quantity).toBe(8);
    expect(listOutbox(db)[0].kind).toBe('pos.sale');
    expect(listOutbox(db)[0].payload.saleNumber).toBe('TILL1-SALE-1');
  });

  it('rejects writes after 24h', () => {
    const db = openDesktopDb(':memory:');
    seed(db);
    const res = handleDesktopLocal({
      db,
      method: 'POST',
      pathname: '/api/sales',
      body: { items: [{ productId: 'p1', quantity: 1, price: 1000 }] },
      now: t0 + 24 * 60 * 60 * 1000,
      user: { id: 'u1', tenantId: 't1' },
    });
    expect(res.status).toBe(403);
    expect(res.json.code).toBe(DESKTOP_CODES.SYNC_REQUIRED);
  });

  it('allows GET while locked', () => {
    const db = openDesktopDb(':memory:');
    seed(db);
    const res = handleDesktopLocal({
      db,
      method: 'GET',
      pathname: '/api/sales',
      body: null,
      now: t0 + 24 * 60 * 60 * 1000,
      user: { id: 'u1', tenantId: 't1' },
    });
    expect(res.status).toBe(200);
    expect(res.json).toHaveProperty('sales');
    expect(res.json).toHaveProperty('pagination');
  });
});

describe('handleDesktopLocal cash day', () => {
  it('opens till and appends outbox', () => {
    const db = openDesktopDb(':memory:');
    seed(db);
    const res = handleDesktopLocal({
      db,
      method: 'POST',
      pathname: '/api/pos/cash-day/open',
      body: { openingBalance: 5000 },
      now: t0 + 60 * 1000,
      user: { id: 'u1', tenantId: 't1' },
    });
    expect(res.status).toBe(200);
    expect(res.json.success).toBe(true);
    expect(res.json.register).toBeTruthy();
    expect(listOutbox(db)[0].kind).toBe('pos.cashDay.open');
  });
});

describe('handleDesktopLocal stubs', () => {
  it('returns 501 for unimplemented operational writes', () => {
    const db = openDesktopDb(':memory:');
    seed(db);
    const res = handleDesktopLocal({
      db,
      method: 'POST',
      pathname: '/api/clients',
      body: { name: 'Acme' },
      now: t0 + 60 * 1000,
      user: { id: 'u1', tenantId: 't1' },
    });
    expect(res.status).toBe(501);
    expect(res.json.error).toMatch(/not implemented/i);
  });
});
