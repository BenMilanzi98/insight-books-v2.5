import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  ADMIN_NAV_SECTIONS,
  REMOVED_ADMIN_ROUTES,
  isRemovedAdminRoute,
  adminNavContainsCoa,
} from '@/lib/admin/adminNav';

const root = process.cwd();

describe('System Chart of Accounts route removal', () => {
  it('marks /insightbooks/chart-of-accounts as removed', () => {
    expect(REMOVED_ADMIN_ROUTES).toContain('/insightbooks/chart-of-accounts');
    expect(isRemovedAdminRoute('/insightbooks/chart-of-accounts')).toBe(true);
    expect(isRemovedAdminRoute('/insightbooks/chart-of-accounts/anything')).toBe(true);
    expect(isRemovedAdminRoute('/chart-of-accounts')).toBe(false);
    expect(isRemovedAdminRoute('/insightbooks/dashboard')).toBe(false);
  });

  it('admin navigation does not include System chart of accounts', () => {
    expect(adminNavContainsCoa()).toBe(false);
    const flat = ADMIN_NAV_SECTIONS.flatMap((s) => [
      ...s.items.map((i) => i.href),
      ...s.items.flatMap((i) => (i.subItems || []).map((sub) => sub.href)),
    ]);
    expect(flat).not.toContain('/insightbooks/chart-of-accounts');
    const labels = ADMIN_NAV_SECTIONS.flatMap((s) =>
      s.items.map((i) => String(i.text || '').toLowerCase())
    );
    expect(labels.some((t) => t.includes('chart of accounts'))).toBe(false);
  });

  it('page file redirects and does not render CoA editor', () => {
    const pagePath = join(root, 'app/insightbooks/chart-of-accounts/page.js');
    expect(existsSync(pagePath)).toBe(true);
    const src = readFileSync(pagePath, 'utf8');
    expect(src).toMatch(/redirect\(/);
    expect(src).toMatch(/coa-removed/);
    expect(src).not.toMatch(/SystemLedgerCoaTable/);
    expect(src).not.toMatch(/buildDefaultSystemCoaPayload/);
  });

  it('system-coa admin APIs remain available', () => {
    expect(existsSync(join(root, 'app/api/admin/system-coa/route.js'))).toBe(true);
    expect(existsSync(join(root, 'app/api/admin/system-coa/apply/route.js'))).toBe(true);
    expect(existsSync(join(root, 'app/api/admin/system-coa/tenant-accounts/route.js'))).toBe(true);
  });

  it('tenant Chart of Accounts route remains', () => {
    expect(existsSync(join(root, 'app/chart-of-accounts/page.js'))).toBe(true);
  });

  it('AdminSidebar source does not hardcode System chart of accounts href', () => {
    const sidebarPath = join(root, 'components/AdminSidebar/AdminSidebar.js');
    const src = readFileSync(sidebarPath, 'utf8');
    expect(src).not.toMatch(/System chart of accounts/);
    expect(src).not.toMatch(/\/insightbooks\/chart-of-accounts/);
  });
});
