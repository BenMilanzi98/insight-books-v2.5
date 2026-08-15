import { describe, expect, it, vi } from 'vitest';
import { openDesktopDb } from '../../lib/desktop/sqlite/db.js';
import { replaceSnapshot } from '../../lib/desktop/sqlite/snapshotStore.js';
import { appendOutbox, listOutbox, updateOutbox } from '../../lib/desktop/sqlite/outboxStore.js';
import { writeMeta, readMeta } from '../../lib/desktop/sqlite/meta.js';
import { runDesktopSync } from '../../lib/desktop/syncWorker.js';
import { OUTBOX_STATUS } from '../../lib/desktop/outboxState.js';

const t0 = Date.parse('2026-08-15T10:00:00.000Z');

function seedDb() {
  const db = openDesktopDb(':memory:');
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
    products: [],
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
  return db;
}

describe('runDesktopSync', () => {
  it('does not refresh lastSuccessfulSyncAt on heartbeat-only when outbox failed', async () => {
    const db = seedDb();
    appendOutbox(db, { id: 'm1', kind: 'pos.sale', payload: {} });
    appendOutbox(db, { id: 'm2', kind: 'pos.sale', payload: {} });
    const cloud = {
      heartbeat: async () => ({
        serverNow: '2026-08-15T12:00:00.000Z',
        bound: true,
        subscriptionActive: true,
      }),
      pushItems: async ({ items }) => {
        if (items[0].id === 'm1') {
          return { results: [], stoppedAt: 'm1', error: 'stock 0' };
        }
        throw new Error('must not push m2');
      },
      pullSnapshot: vi.fn(),
    };
    const r = await runDesktopSync({ db, cloud, now: t0 + 2 * 60 * 60 * 1000 });
    expect(r.ok).toBe(false);
    expect(listOutbox(db).find((x) => x.id === 'm1').status).toBe('failed');
    expect(listOutbox(db).find((x) => x.id === 'm2').status).toBe('pending');
    expect(cloud.pullSnapshot).not.toHaveBeenCalled();
    expect(readMeta(db).lastSuccessfulSyncAt).toBe(String(t0));
  });

  it('returns OUTBOX_BLOCKED when failed rows block snapshot pull with no push', async () => {
    const db = seedDb();
    appendOutbox(db, { id: 'm1', kind: 'pos.sale', payload: {} });
    updateOutbox(db, 'm1', { status: OUTBOX_STATUS.failed, errorMessage: 'stock 0' });
    const cloud = {
      heartbeat: async () => ({
        serverNow: '2026-08-15T12:00:00.000Z',
        bound: true,
        subscriptionActive: true,
      }),
      pushItems: vi.fn(),
      pullSnapshot: vi.fn(),
    };
    const r = await runDesktopSync({ db, cloud, now: t0 + 2 * 60 * 60 * 1000 });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('OUTBOX_BLOCKED');
    expect(r.failedItemId).toBe('m1');
    expect(cloud.pushItems).not.toHaveBeenCalled();
    expect(cloud.pullSnapshot).not.toHaveBeenCalled();
  });

  it('pushes two sales then pulls snapshot and stamps lastSuccessfulSyncAt', async () => {
    const db = seedDb();
    appendOutbox(db, { id: 'm1', kind: 'pos.sale', payload: {} });
    appendOutbox(db, { id: 'm2', kind: 'pos.sale', payload: {} });
    const cloud = {
      heartbeat: async () => ({
        serverNow: '2026-08-15T12:00:00.000Z',
        bound: true,
        subscriptionActive: true,
      }),
      pushItems: async ({ items }) => ({
        results: [{ id: items[0].id, serverId: 'srv-' + items[0].id }],
      }),
      pullSnapshot: async () => ({
        version: 1,
        tenantId: 't1',
        products: [{ id: 'p1', quantity: 9, name: 'Bread' }],
        customers: [],
        taxTypes: [],
        paymentAccounts: [],
        openInvoices: [],
        recentPayments: [],
        sessionUser: { id: 'u1' },
        tenantSettings: {},
        posConfig: {},
        serverNow: '2026-08-15T12:00:00.000Z',
      }),
    };
    const r = await runDesktopSync({ db, cloud, now: t0 + 1000 });
    expect(r.ok).toBe(true);
    expect(readMeta(db).lastSuccessfulSyncAt).toBe(String(Date.parse('2026-08-15T12:00:00.000Z')));
  });
});
