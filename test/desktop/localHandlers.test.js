import { describe, expect, it } from 'vitest';
import { openDesktopDb } from '../../lib/desktop/sqlite/db.js';
import { replaceSnapshot, getProduct } from '../../lib/desktop/sqlite/snapshotStore.js';
import { writeMeta } from '../../lib/desktop/sqlite/meta.js';
import { handleDesktopLocal } from '../../lib/desktop/local/handlers.js';
import { listOutbox, updateOutbox, appendOutbox } from '../../lib/desktop/sqlite/outboxStore.js';
import { DESKTOP_CODES } from '../../lib/desktop/codes.js';
import { OUTBOX_STATUS } from '../../lib/desktop/outboxState.js';
import { vi } from 'vitest';

const t0 = Date.parse('2026-08-15T10:00:00.000Z');

function seed(db, { posConfig = {}, lastSuccessfulSyncAt = String(t0) } = {}) {
  writeMeta(db, {
    tenantId: 't1',
    deviceId: 'pc-a',
    numberPrefix: 'TILL1',
    lastSuccessfulSyncAt,
    lastLocalNow: lastSuccessfulSyncAt === String(t0) ? String(t0) : lastSuccessfulSyncAt,
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
    sales: [],
    sessionUser: { id: 'u1' },
    tenantSettings: {},
    posConfig,
    serverNow: '2026-08-15T10:00:00.000Z',
  });
}

function openTill(db, now = t0 + 60 * 1000) {
  return handleDesktopLocal({
    db,
    method: 'POST',
    pathname: '/api/pos/cash-day/open',
    body: { openingBalance: 5000 },
    now,
    user: { id: 'u1', tenantId: 't1' },
  });
}

function createTestSale(db, now = t0 + 60 * 1000) {
  openTill(db, now);
  const res = handleDesktopLocal({
    db,
    method: 'POST',
    pathname: '/api/sales',
    body: { items: [{ productId: 'p1', quantity: 2, price: 1000 }], payments: [] },
    now,
    user: { id: 'u1', tenantId: 't1' },
  });
  expect(res.status).toBe(201);
  return res.json.sale;
}

describe('handleDesktopLocal POS sale', () => {
  it('writes sale, decrements stock, appends outbox', () => {
    const db = openDesktopDb(':memory:');
    seed(db);
    openTill(db);
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
    const saleOutbox = listOutbox(db).find((e) => e.kind === 'pos.sale');
    expect(saleOutbox).toBeTruthy();
    expect(saleOutbox.payload.saleNumber).toBe('TILL1-SALE-1');
  });

  it('accepts unitPrice on sale items', () => {
    const db = openDesktopDb(':memory:');
    seed(db);
    openTill(db);
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

  it('rejects sale when till is not open', () => {
    const db = openDesktopDb(':memory:');
    seed(db);
    const res = handleDesktopLocal({
      db,
      method: 'POST',
      pathname: '/api/sales',
      body: { items: [{ productId: 'p1', quantity: 1, price: 1000 }] },
      now: t0 + 60 * 1000,
      user: { id: 'u1', tenantId: 't1' },
    });
    expect(res.status).toBe(409);
    expect(res.json.code).toBe('TILL_NOT_OPEN');
  });

  it('rejects writes after 24h', () => {
    const db = openDesktopDb(':memory:');
    seed(db);
    openTill(db);
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

describe('handleDesktopLocal POS void and refund', () => {
  it('voids sale locally, restores stock, appends pos.void outbox', () => {
    const db = openDesktopDb(':memory:');
    seed(db);
    const sale = createTestSale(db);
    expect(getProduct(db, 'p1').quantity).toBe(8);

    const res = handleDesktopLocal({
      db,
      method: 'POST',
      pathname: `/api/sales/${sale.id}/void`,
      body: { reason: 'Duplicate entry corrected' },
      now: t0 + 120 * 1000,
      user: { id: 'u1', tenantId: 't1' },
    });
    expect(res.status).toBe(200);
    expect(res.json.success).toBe(true);
    expect(res.json.sale.status).toBe('voided');
    expect(getProduct(db, 'p1').quantity).toBe(10);
    expect(listOutbox(db).some((e) => e.kind === 'pos.void')).toBe(true);
  });

  it('refunds sale locally, restores stock, appends pos.refund outbox', () => {
    const db = openDesktopDb(':memory:');
    seed(db);
    const sale = createTestSale(db);

    const res = handleDesktopLocal({
      db,
      method: 'POST',
      pathname: `/api/sales/${sale.id}/refund`,
      body: { reason: 'Customer returned goods', refundMethod: 'cash' },
      now: t0 + 120 * 1000,
      user: { id: 'u1', tenantId: 't1' },
    });
    expect(res.status).toBe(200);
    expect(res.json.success).toBe(true);
    expect(res.json.sale.status).toBe('refunded');
    expect(getProduct(db, 'p1').quantity).toBe(10);
    expect(listOutbox(db).some((e) => e.kind === 'pos.refund')).toBe(true);
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

describe('handleDesktopLocal sync-status and sync-now', () => {
  it('returns sync status with failed outbox issues', () => {
    const db = openDesktopDb(':memory:');
    seed(db);
    appendOutbox(db, { id: 'fail-1', kind: 'pos.sale', payload: {} });
    updateOutbox(db, 'fail-1', {
      status: OUTBOX_STATUS.failed,
      errorMessage: 'stock 0',
    });

    const res = handleDesktopLocal({
      db,
      method: 'GET',
      pathname: '/api/sync-status',
      now: t0 + 21 * 60 * 60 * 1000,
    });
    expect(res.status).toBe(200);
    expect(res.json.warning).toBe(true);
    expect(res.json.locked).toBe(false);
    expect(res.json.failedCount).toBeGreaterThanOrEqual(1);
    expect(res.json.issues[0]).toMatchObject({
      kind: expect.any(String),
      errorMessage: expect.any(String),
    });
  });

  it('POST sync-now runs desktop sync via injected cloud client', async () => {
    const db = openDesktopDb(':memory:');
    seed(db);
    const cloud = {
      heartbeat: vi.fn(async () => ({
        serverNow: '2026-08-15T12:00:00.000Z',
        bound: true,
        subscriptionActive: true,
      })),
      pushItems: vi.fn(async () => ({ results: [] })),
      pullSnapshot: vi.fn(async () => ({
        version: 1,
        tenantId: 't1',
        products: [],
        customers: [],
        taxTypes: [],
        paymentAccounts: [],
        openInvoices: [],
        recentPayments: [],
        sessionUser: { id: 'u1' },
        tenantSettings: {},
        posConfig: {},
        serverNow: '2026-08-15T12:00:00.000Z',
      })),
    };

    const res = await handleDesktopLocal({
      db,
      method: 'POST',
      pathname: '/api/sync-now',
      now: t0 + 1000,
      cloud,
    });
    expect(res.status).toBe(200);
    expect(res.json.ok).toBe(true);
    expect(cloud.heartbeat).toHaveBeenCalled();
  });
});
