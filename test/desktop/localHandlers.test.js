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
    expect(res.status).toBe(201);
    expect(res.json.message).toBe('Sale created successfully');
    expect(res.json.sale.saleNumber).toBe('TILL1-SALE-1');
    expect(getProduct(db, 'p1').quantity).toBe(8);
    expect(listOutbox(db)[0].kind).toBe('pos.sale');
    expect(listOutbox(db)[0].payload.saleNumber).toBe('TILL1-SALE-1');
  });

  it('accepts unitPrice on sale items', () => {
    const db = openDesktopDb(':memory:');
    seed(db);
    const res = handleDesktopLocal({
      db,
      method: 'POST',
      pathname: '/api/sales',
      body: { items: [{ productId: 'p1', quantity: 1, unitPrice: 1000 }] },
      now: t0 + 60 * 1000,
      user: { id: 'u1', tenantId: 't1' },
    });
    expect(res.status).toBe(201);
    expect(res.json.sale.subtotal).toBe(1000);
    expect(res.json.sale.total).toBe(1000);
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

describe('handleDesktopLocal invoices', () => {
  function createTestInvoice(db) {
    const res = handleDesktopLocal({
      db,
      method: 'POST',
      pathname: '/api/invoices',
      body: {
        clientId: 'c1',
        subtotal: 1000,
        total: 1000,
        items: [{ description: 'Widget', quantity: 1, unitPrice: 1000 }],
      },
      now: t0 + 60 * 1000,
      user: { id: 'u1', tenantId: 't1' },
    });
    expect(res.status).toBe(201);
    return res.json.invoice.id;
  }

  it('updates invoice locally and appends invoice.update outbox', () => {
    const db = openDesktopDb(':memory:');
    seed(db);
    const invoiceId = createTestInvoice(db);
    const res = handleDesktopLocal({
      db,
      method: 'PUT',
      pathname: `/api/invoices/${invoiceId}`,
      body: { notes: 'Updated offline', total: 1200, subtotal: 1200 },
      now: t0 + 120 * 1000,
      user: { id: 'u1', tenantId: 't1' },
    });
    expect(res.status).toBe(200);
    expect(res.json.invoice.notes).toBe('Updated offline');
    expect(res.json.invoice.total).toBe(1200);
    const kinds = listOutbox(db).map((e) => e.kind);
    expect(kinds).toContain('invoice.create');
    expect(kinds).toContain('invoice.update');
  });

  it('voids invoice and records partial payment outbox', () => {
    const db = openDesktopDb(':memory:');
    seed(db);
    const invoiceId = createTestInvoice(db);

    const voidRes = handleDesktopLocal({
      db,
      method: 'POST',
      pathname: '/api/invoices/void',
      body: { id: invoiceId, reason: 'Duplicate entry' },
      now: t0 + 180 * 1000,
      user: { id: 'u1', tenantId: 't1' },
    });
    expect(voidRes.status).toBe(200);
    expect(voidRes.json.success).toBe(true);
    expect(voidRes.json.invoice.status).toBe('void');
    expect(listOutbox(db).some((e) => e.kind === 'invoice.void')).toBe(true);

    const payDb = openDesktopDb(':memory:');
    seed(payDb);
    const payInvoiceId = createTestInvoice(payDb);
    const payRes = handleDesktopLocal({
      db: payDb,
      method: 'POST',
      pathname: '/api/invoices/partial-payment',
      body: { invoiceId: payInvoiceId, amount: 500, paymentMethod: 'cash' },
      now: t0 + 240 * 1000,
      user: { id: 'u1', tenantId: 't1' },
    });
    expect(payRes.status).toBe(201);
    expect(payRes.json.invoice.status).toBe('Partial');
    expect(payRes.json.invoice.totalPaid).toBe(500);
    expect(listOutbox(payDb).some((e) => e.kind === 'invoice.payment')).toBe(true);
  });
});

describe('handleDesktopLocal clients', () => {
  it('creates client locally and appends customer.upsert outbox', () => {
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
    expect(res.status).toBe(201);
    expect(res.json.client.name).toBe('Acme');
    expect(listOutbox(db)[0].kind).toBe('customer.upsert');
    expect(listOutbox(db)[0].payload.name).toBe('Acme');
  });

  it('returns 403 not 501 for locked client POST', () => {
    const db = openDesktopDb(':memory:');
    seed(db);
    const res = handleDesktopLocal({
      db,
      method: 'POST',
      pathname: '/api/clients',
      body: { name: 'Acme' },
      now: t0 + 24 * 60 * 60 * 1000,
      user: { id: 'u1', tenantId: 't1' },
    });
    expect(res.status).toBe(403);
    expect(res.json.code).toBe(DESKTOP_CODES.SYNC_REQUIRED);
    expect(res.status).not.toBe(501);
  });
});
