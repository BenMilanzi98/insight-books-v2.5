import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { ADMIN_NAV_SECTIONS } from '@/lib/admin/adminNav';
import { adminHasPermission, SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';

const root = process.cwd();

describe('Admin shell and navigation', () => {
  it('defines sectioned navigation with required Phase 1 items', () => {
    const ids = ADMIN_NAV_SECTIONS.map((s) => s.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'overview',
        'platform',
        'configuration',
        'apps',
        'billing',
        'communication',
        'compliance',
        'security',
      ])
    );
    const hrefs = ADMIN_NAV_SECTIONS.flatMap((s) => s.items.map((i) => i.href));
    expect(hrefs).toContain('/insightbooks/dashboard');
    expect(hrefs).toContain('/insightbooks/tenant-management');
    expect(hrefs).toContain('/insightbooks/system-health');
    expect(hrefs).not.toContain('/insightbooks/chart-of-accounts');
  });

  it('uses Lucide icon names rather than emoji in nav config', () => {
    ADMIN_NAV_SECTIONS.forEach((section) => {
      section.items.forEach((item) => {
        expect(item.icon).toMatch(/^[A-Z]/);
        expect(String(item.icon)).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
      });
    });
  });

  it('Super Admin has all permissions even with empty permissions object', () => {
    const admin = { role: 'Super Admin', permissions: {} };
    expect(adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.tenants.view)).toBe(true);
    expect(adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.billing.view)).toBe(true);
  });

  it('restricted admin requires explicit systemAdmin permission', () => {
    const admin = {
      role: 'Billing Administrator',
      permissions: { systemAdmin: { billing: { view: true } } },
    };
    expect(adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.billing.view)).toBe(true);
    expect(adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.tenants.suspend)).toBe(false);
  });

  it('AdminShell and admin components exist', () => {
    expect(existsSync(join(root, 'components/shell/AdminShell.jsx'))).toBe(true);
    expect(existsSync(join(root, 'components/admin/AdminPageHeader.jsx'))).toBe(true);
    expect(existsSync(join(root, 'components/admin/AdminNoticeBanner.jsx'))).toBe(true);
    const shell = readFileSync(join(root, 'components/shell/AdminShell.jsx'), 'utf8');
    expect(shell).toMatch(/AdminNoticeBanner/);
    expect(shell).toMatch(/100dvh/);
  });

  it('system-health page exists for nav target', () => {
    expect(existsSync(join(root, 'app/insightbooks/system-health/page.js'))).toBe(true);
  });
});
