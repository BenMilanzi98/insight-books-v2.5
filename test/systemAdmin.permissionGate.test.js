import { describe, it, expect } from 'vitest';
import { adminHasPermission, SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';

describe('AdminPermissionGate permission helper', () => {
  it('denies without permission', () => {
    const admin = { role: 'Platform Support', permissions: { systemAdmin: {} } };
    expect(adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.billing.view)).toBe(false);
  });

  it('allows Super Admin', () => {
    const admin = { role: 'Super Admin', permissions: {} };
    expect(adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.billing.view)).toBe(true);
  });
});
