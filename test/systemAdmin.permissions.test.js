import { describe, it, expect } from 'vitest';
import {
  SYSTEM_ADMIN_PERMISSIONS,
  ADMIN_ROLES,
  NAV_PERMISSION_MAP,
  permissionKeyParts,
  adminHasPermission,
} from '@/lib/admin/permissions';

describe('systemAdmin permissions catalog', () => {
  it('defines tenant lifecycle and supportAccess permissions', () => {
    expect(SYSTEM_ADMIN_PERMISSIONS.tenants.view).toBe('systemAdmin.tenants.view');
    expect(SYSTEM_ADMIN_PERMISSIONS.tenants.create).toBe('systemAdmin.tenants.create');
    expect(SYSTEM_ADMIN_PERMISSIONS.tenants.activate).toBe('systemAdmin.tenants.activate');
    expect(SYSTEM_ADMIN_PERMISSIONS.tenants.suspend).toBe('systemAdmin.tenants.suspend');
    expect(SYSTEM_ADMIN_PERMISSIONS.tenants.reactivate).toBe(
      'systemAdmin.tenants.reactivate'
    );
    expect(SYSTEM_ADMIN_PERMISSIONS.tenants.archive).toBe('systemAdmin.tenants.archive');
    expect(SYSTEM_ADMIN_PERMISSIONS.tenants.supportAccess).toBe(
      'systemAdmin.tenants.supportAccess'
    );
  });

  it('defines settings and billing permission keys', () => {
    expect(SYSTEM_ADMIN_PERMISSIONS.settings.view).toBe('systemAdmin.settings.view');
    expect(SYSTEM_ADMIN_PERMISSIONS.settings.manage).toBe('systemAdmin.settings.manage');
    expect(SYSTEM_ADMIN_PERMISSIONS.billing.invoicesCreate).toBe(
      'systemAdmin.billing.invoices.create'
    );
    expect(SYSTEM_ADMIN_PERMISSIONS.billing.paymentsManage).toBe(
      'systemAdmin.billing.payments.manage'
    );
    expect(SYSTEM_ADMIN_PERMISSIONS.billing.reconciliation).toBe(
      'systemAdmin.billing.reconciliation'
    );
  });

  it('parses systemAdmin permission key parts including dotted actions', () => {
    expect(permissionKeyParts('systemAdmin.billing.invoices.create')).toEqual({
      root: 'systemAdmin',
      category: 'billing',
      action: 'invoices.create',
    });
    expect(permissionKeyParts('tenants.view')).toEqual({
      root: null,
      category: 'tenants',
      action: 'view',
    });
  });

  it('Super Admin bypasses permission object', () => {
    const admin = { role: ADMIN_ROLES.SUPER_ADMIN, permissions: {} };
    expect(adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.users.view)).toBe(true);
    expect(adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.tenants.archive)).toBe(true);
  });

  it('restricted roles require nested systemAdmin grants', () => {
    const admin = {
      role: ADMIN_ROLES.PLATFORM_SUPPORT,
      permissions: {
        systemAdmin: {
          tenants: { view: true, supportAccess: true },
        },
      },
    };
    expect(adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.tenants.view)).toBe(true);
    expect(adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.tenants.supportAccess)).toBe(
      true
    );
    expect(adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.tenants.suspend)).toBe(false);
    expect(adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.settings.manage)).toBe(false);
  });

  it('supports flat permission key fallback', () => {
    const admin = {
      role: 'Custom',
      permissions: { 'systemAdmin.users.view': true },
    };
    expect(adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.users.view)).toBe(true);
  });

  it('maps nav routes to view permissions', () => {
    expect(NAV_PERMISSION_MAP['/insightbooks/tenant-management']).toBe(
      SYSTEM_ADMIN_PERMISSIONS.tenants.view
    );
    expect(NAV_PERMISSION_MAP['/insightbooks/global-settings']).toBe(
      SYSTEM_ADMIN_PERMISSIONS.settings.view
    );
    expect(NAV_PERMISSION_MAP['/insightbooks/billing']).toBe(
      SYSTEM_ADMIN_PERMISSIONS.billing.view
    );
  });
});
