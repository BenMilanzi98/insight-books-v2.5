import { describe, it, expect } from 'vitest';
import {
  hasAnySalesPermission,
  posGrantsPermission,
  getPosImplicitPermissions,
} from '../lib/posPermissions.js';
import { hasPermissionInSet } from '../lib/permissionUtils.js';
import { hasPermission } from '../lib/auth.js';

const salesOnly = {
  sales: { view: true, create: true, void: true, refund: true, export: true },
};

describe('POS implicit permissions', () => {
  it('detects any sales.* permission', () => {
    expect(hasAnySalesPermission(salesOnly)).toBe(true);
    expect(hasAnySalesPermission({ dashboard: { view: true } })).toBe(false);
  });

  it('grants supporting read permissions for POS workflows', () => {
    const implicit = getPosImplicitPermissions(salesOnly);
    expect(implicit.has('clients.view')).toBe(true);
    expect(implicit.has('inventory.view')).toBe(true);
    expect(implicit.has('tax.view')).toBe(true);
    expect(implicit.has('payments.view')).toBe(true);
    expect(implicit.has('settings.view')).toBe(true);
    expect(implicit.has('system.switchTenant')).toBe(true);
    expect(implicit.has('accounts.view')).toBe(false);
    expect(implicit.has('dashboard.view')).toBe(false);
  });

  it('grants client create/update when sales.create is present', () => {
    expect(posGrantsPermission(salesOnly, 'clients.create')).toBe(true);
    expect(posGrantsPermission(salesOnly, 'clients.update')).toBe(true);
    expect(posGrantsPermission({ sales: { view: true } }, 'clients.create')).toBe(false);
  });

  it('maps tenants.switch and system.switchTenant', () => {
    expect(posGrantsPermission(salesOnly, 'tenants.switch')).toBe(true);
    expect(hasPermissionInSet(salesOnly, 'system.switchTenant')).toBe(true);
  });

  it('does not grant full chart of accounts access', () => {
    expect(posGrantsPermission(salesOnly, 'accounts.view')).toBe(false);
    expect(posGrantsPermission(salesOnly, 'generalLedger.view')).toBe(false);
  });

  it('wires through hasPermission for POS staff', () => {
    const user = { role: { name: 'Cashier', permissions: salesOnly } };
    expect(hasPermission(user, 'clients.view')).toBe(true);
    expect(hasPermission(user, 'payments.view')).toBe(true);
    expect(hasPermission(user, 'accounts.view')).toBe(false);
  });

  it('Sales role still cannot access dashboard', () => {
    const user = {
      role: {
        name: 'Sales',
        permissions: { sales: { view: true, create: true } },
      },
    };
    expect(hasPermission(user, 'dashboard.view')).toBe(false);
    expect(hasPermission(user, 'inventory.view')).toBe(true);
  });
});
