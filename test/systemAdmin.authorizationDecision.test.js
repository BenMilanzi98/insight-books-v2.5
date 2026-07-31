import { describe, it, expect } from 'vitest';
import {
  authorizeAdminDecision,
  AUTHZ_OUTCOMES,
  CATALOGUE_VERSION,
} from '@/lib/admin/authorization';
import {
  SYSTEM_ADMIN_PERMISSIONS,
  INTEL_CRM_PERMISSION_SCAFFOLD,
  adminHasPermission,
} from '@/lib/admin/permissions';

describe('authorizeAdminDecision', () => {
  it('exports catalogue version', () => {
    expect(CATALOGUE_VERSION).toMatch(/^platform-authz-/);
  });

  it('denies when admin missing', () => {
    const d = authorizeAdminDecision({
      admin: null,
      permission: SYSTEM_ADMIN_PERMISSIONS.dashboard.view,
    });
    expect(d.outcome).toBe(AUTHZ_OUTCOMES.DENY);
    expect(d.allowed).toBe(false);
  });

  it('allows Super Admin as break-glass', () => {
    const d = authorizeAdminDecision({
      admin: { id: 'a1', role: 'Super Admin', permissions: {} },
      permission: SYSTEM_ADMIN_PERMISSIONS.billing.reconciliation,
    });
    expect(d.outcome).toBe(AUTHZ_OUTCOMES.ALLOW);
    expect(d.breakGlass).toBe(true);
    expect(d.allowed).toBe(true);
  });

  it('allows nested systemAdmin permission grant', () => {
    const d = authorizeAdminDecision({
      admin: {
        id: 'a2',
        role: 'Billing Administrator',
        permissions: {
          systemAdmin: {
            billing: { view: true },
          },
        },
      },
      permission: SYSTEM_ADMIN_PERMISSIONS.billing.view,
    });
    expect(d.outcome).toBe(AUTHZ_OUTCOMES.ALLOW);
    expect(d.breakGlass).toBe(false);
  });

  it('denies missing nested permission (default deny)', () => {
    const d = authorizeAdminDecision({
      admin: {
        id: 'a3',
        role: 'Billing Administrator',
        permissions: {
          systemAdmin: {
            billing: { view: true },
          },
        },
      },
      permission: SYSTEM_ADMIN_PERMISSIONS.billing.reconciliation,
    });
    expect(d.outcome).toBe(AUTHZ_OUTCOMES.DENY);
    expect(d.allowed).toBe(false);
  });

  it('denies scaffold intel permission even when billing view granted', () => {
    const d = authorizeAdminDecision({
      admin: {
        id: 'a4',
        role: 'Billing Administrator',
        permissions: {
          systemAdmin: {
            billing: { view: true },
          },
        },
      },
      permission: INTEL_CRM_PERMISSION_SCAFFOLD.intel.executiveRead,
    });
    expect(d.outcome).toBe(AUTHZ_OUTCOMES.DENY);
  });

  it('returns ALLOW_MASKED for financial metrics when only dashboard.view', () => {
    const d = authorizeAdminDecision({
      admin: {
        id: 'a5',
        role: 'Executive',
        permissions: {
          systemAdmin: {
            dashboard: { view: true },
          },
        },
      },
      permission: SYSTEM_ADMIN_PERMISSIONS.dashboard.financialMetrics,
    });
    expect(d.outcome).toBe(AUTHZ_OUTCOMES.ALLOW_MASKED);
    expect(d.allowed).toBe(true);
  });

  it('adminHasPermission adapter matches decision.allowed', () => {
    const admin = {
      id: 'a6',
      role: 'Platform Support',
      permissions: {
        systemAdmin: {
          tenants: { view: true },
        },
      },
    };
    expect(adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.tenants.view)).toBe(true);
    expect(adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.tenants.supportAccess)).toBe(
      false
    );
  });
});
