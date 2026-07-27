import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { assertFinalSuperAdminSafe } from '@/lib/admin/superAdminProtection';
import {
  resolveEffectiveEntitlement,
  validateEntitlementWrite,
  ENTITLEMENT_STATUSES,
} from '@/lib/admin/featureEntitlements';
import { ADMIN_NAV_SECTIONS } from '@/lib/admin/adminNav';

const root = process.cwd();

describe('Phase 2 — Super Admin protection', () => {
  it('blocks locking the final active Super Admin', () => {
    const result = assertFinalSuperAdminSafe(
      1,
      { role: 'Super Admin', isActive: true },
      'lock'
    );
    expect(result.ok).toBe(false);
  });

  it('allows locking a Super Admin when another remains', () => {
    const result = assertFinalSuperAdminSafe(
      2,
      { role: 'Super Admin', isActive: true },
      'lock'
    );
    expect(result.ok).toBe(true);
  });

  it('allows locking non-super admins', () => {
    const result = assertFinalSuperAdminSafe(
      1,
      { role: 'Billing Administrator', isActive: true },
      'lock'
    );
    expect(result.ok).toBe(true);
  });
});

describe('Phase 2 — Feature entitlements', () => {
  it('tenant override disable wins over plan', () => {
    const effective = resolveEffectiveEntitlement({
      planEnabled: true,
      override: { status: ENTITLEMENT_STATUSES.DISABLED, reason: 'Paused' },
    });
    expect(effective.enabled).toBe(false);
    expect(effective.readOnlyHistorical).toBe(true);
  });

  it('plan enable applies without override', () => {
    const effective = resolveEffectiveEntitlement({
      planEnabled: true,
      override: null,
    });
    expect(effective.enabled).toBe(true);
    expect(effective.source).toBe('PLAN');
  });

  it('validates entitlement writes', () => {
    expect(validateEntitlementWrite({ featureCode: '', tenantId: 't1' }).ok).toBe(false);
    expect(
      validateEntitlementWrite({
        featureCode: 'budgeting',
        tenantId: 't1',
        status: 'ACTIVE',
      }).ok
    ).toBe(true);
  });
});

describe('Phase 2 — Soft archive and UI routes', () => {
  it('tenant delete route soft-archives instead of hard delete', () => {
    const src = readFileSync(join(root, 'app/api/admin/tenants/delete/route.js'), 'utf8');
    expect(src).toMatch(/TENANT_ARCHIVE|ARCHIVE/);
    expect(src).toMatch(/hardDelete:\s*false|Hard delete is prohibited/i);
    expect(src).not.toMatch(/prisma\.tenant\.delete\(/);
    expect(src).not.toMatch(/accountSubscription\.deleteMany/);
  });

  it('user actions never return a password field', () => {
    const src = readFileSync(join(root, 'app/api/admin/users/actions/route.js'), 'utf8');
    expect(src).toMatch(/resetToken/);
    expect(src).not.toMatch(/newPassword/);
    expect(src).not.toMatch(/temporaryPassword/);
  });

  it('nav includes feature entitlements', () => {
    const hrefs = ADMIN_NAV_SECTIONS.flatMap((s) => s.items.map((i) => i.href));
    expect(hrefs).toContain('/insightbooks/feature-entitlements');
  });

  it('feature entitlements page and API exist', () => {
    expect(existsSync(join(root, 'app/insightbooks/feature-entitlements/page.js'))).toBe(
      true
    );
    expect(existsSync(join(root, 'app/api/admin/feature-entitlements/route.js'))).toBe(
      true
    );
  });

  it('global settings page loads persisted API', () => {
    const src = readFileSync(
      join(root, 'app/insightbooks/global-settings/page.js'),
      'utf8'
    );
    expect(src).toMatch(/\/api\/admin\/settings/);
    expect(src).toMatch(/method:\s*'PUT'/);
    expect(src).not.toMatch(/Simulate API call/);
  });
});
