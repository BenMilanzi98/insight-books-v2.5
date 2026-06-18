import { describe, it, expect } from 'vitest';
import { hasPermission } from '../lib/auth.js';

describe('RBAC permission checks (hasPermission)', () => {
  it('denies when user/role/permissions missing', () => {
    expect(hasPermission(null, 'users.view')).toBe(false);
    expect(hasPermission({}, 'users.view')).toBe(false);
    expect(hasPermission({ role: {} }, 'users.view')).toBe(false);
    expect(hasPermission({ role: { permissions: null } }, 'users.view')).toBe(false);
  });

  it('allows MASTER_ADMIN for any permission', () => {
    const user = { role: { name: 'MASTER_ADMIN', permissions: {} } };
    expect(hasPermission(user, 'users.view')).toBe(true);
    expect(hasPermission(user, 'roles.delete')).toBe(true);
  });

  it('allows Owner and Admin with empty permission maps (trial / full-access roles)', () => {
    const owner = { role: { name: 'Owner', permissions: {} } };
    expect(hasPermission(owner, 'users.view')).toBe(true);
    expect(hasPermission(owner, 'roles.delete')).toBe(true);
    const admin = { role: { name: 'Admin', permissions: {} } };
    expect(hasPermission(admin, 'accounts.update')).toBe(true);
  });

  it('allows master-admin role name variants', () => {
    expect(
      hasPermission({ role: { name: 'Master Admin', permissions: {} } }, 'settings.view')
    ).toBe(true);
    expect(
      hasPermission({ role: { name: 'MASTER ADMIN', permissions: {} } }, 'suppliers.delete')
    ).toBe(true);
  });

  it('supports nested permission maps', () => {
    const user = { role: { name: 'Staff', permissions: { users: { view: true, create: false } } } };
    expect(hasPermission(user, 'users.view')).toBe(true);
    expect(hasPermission(user, 'users.create')).toBe(false);
  });

  it('supports flat permission maps', () => {
    const user = { role: { name: 'Staff', permissions: { 'users.view': true, 'users.create': false } } };
    expect(hasPermission(user, 'users.view')).toBe(true);
    expect(hasPermission(user, 'users.create')).toBe(false);
  });

  it('maps employees.* API checks to hr.* role permissions', () => {
    const user = {
      role: {
        name: 'HR Staff',
        permissions: { hr: { view: true, update: true, create: false } },
      },
    };
    expect(hasPermission(user, 'employees.view')).toBe(true);
    expect(hasPermission(user, 'employees.update')).toBe(true);
    expect(hasPermission(user, 'employees.create')).toBe(false);
  });

  it('denies dashboard.view for Sales role even if legacy permissions include it', () => {
    const sales = {
      role: {
        name: 'Sales',
        permissions: { dashboard: { view: true }, sales: { create: true } },
      },
    };
    expect(hasPermission(sales, 'dashboard.view')).toBe(false);
    expect(hasPermission(sales, 'sales.create')).toBe(true);
  });

  it('grants POS supporting permissions when user has sales.* only', () => {
    const cashier = {
      role: {
        name: 'Cashier',
        permissions: {
          sales: { view: true, create: true, void: true, refund: true, export: true },
        },
      },
    };
    expect(hasPermission(cashier, 'clients.view')).toBe(true);
    expect(hasPermission(cashier, 'tax.view')).toBe(true);
    expect(hasPermission(cashier, 'system.switchTenant')).toBe(true);
    expect(hasPermission(cashier, 'accounts.view')).toBe(false);
  });
});

