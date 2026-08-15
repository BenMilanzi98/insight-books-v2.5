import { describe, expect, it } from 'vitest';
import { openDesktopDb } from '../../lib/desktop/sqlite/db.js';
import { replaceSnapshot } from '../../lib/desktop/sqlite/snapshotStore.js';
import { getDesktopSessionUserFromDb } from '../../lib/desktop/local/session.js';

const baseSnapshot = {
  version: 1,
  tenantId: 't1',
  sessionUser: {
    id: 'u1',
    name: 'Ada',
    email: 'ada@example.com',
    tenantId: 't1',
    role: { id: 'r1', name: 'Admin', permissions: ['sales.create'] },
  },
  products: [],
  customers: [],
  taxTypes: [],
  paymentAccounts: [],
  openInvoices: [],
  recentPayments: [],
  tenantSettings: {},
  posConfig: {},
  serverNow: '2026-08-15T10:00:00.000Z',
};

describe('getDesktopSessionUserFromDb', () => {
  it('returns snapshot user when ids match', () => {
    const db = openDesktopDb(':memory:');
    replaceSnapshot(db, baseSnapshot);
    const user = getDesktopSessionUserFromDb(db, { userId: 'u1', tenantId: 't1' });
    expect(user.email).toBe('ada@example.com');
    expect(user.role.permissions).toContain('sales.create');
  });

  it('returns null when session user id does not match', () => {
    const db = openDesktopDb(':memory:');
    replaceSnapshot(db, baseSnapshot);
    expect(getDesktopSessionUserFromDb(db, { userId: 'u2', tenantId: 't1' })).toBeNull();
  });

  it('returns null when tenant id does not match', () => {
    const db = openDesktopDb(':memory:');
    replaceSnapshot(db, baseSnapshot);
    expect(getDesktopSessionUserFromDb(db, { userId: 'u1', tenantId: 't2' })).toBeNull();
  });

  it('returns null when snapshot has no session user', () => {
    const db = openDesktopDb(':memory:');
    replaceSnapshot(db, { ...baseSnapshot, sessionUser: null });
    expect(getDesktopSessionUserFromDb(db, { userId: 'u1', tenantId: 't1' })).toBeNull();
  });
});
