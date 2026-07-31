import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { join } from 'path';
import { listAdminNavHrefs, ADMIN_NAV_SECTIONS } from '@/lib/admin/adminNav';
import { listHealthSectionHrefs } from '@/lib/admin/healthNav';
import { listCustomerSuccessSectionHrefs, CS_PERMISSIONS } from '@/lib/admin/customerSuccessNav';
import {
  NAV_PERMISSION_MAP,
  SYSTEM_ADMIN_PERMISSIONS,
  adminHasPermission,
} from '@/lib/admin/permissions';

const root = process.cwd();

describe('Phase 8 Wave 2 — Health + CS nav / permissions', () => {
  it('defines customerSuccess permission keys', () => {
    expect(SYSTEM_ADMIN_PERMISSIONS.customerSuccess.read).toBe(
      'systemAdmin.customerSuccess.read'
    );
    expect(SYSTEM_ADMIN_PERMISSIONS.customerSuccess.manageCases).toBe(
      'systemAdmin.customerSuccess.manageCases'
    );
    expect(CS_PERMISSIONS.read).toBe(SYSTEM_ADMIN_PERMISSIONS.customerSuccess.read);
    expect(CS_PERMISSIONS.manageCases).toBe(
      SYSTEM_ADMIN_PERMISSIONS.customerSuccess.manageCases
    );
  });

  it('maps every health section href in NAV_PERMISSION_MAP', () => {
    const hrefs = listHealthSectionHrefs();
    expect(hrefs.length).toBeGreaterThan(3);
    const missing = hrefs.filter((href) => !NAV_PERMISSION_MAP[href]);
    expect(missing, `Unmapped health hrefs: ${missing.join(', ')}`).toEqual([]);
    for (const href of hrefs) {
      expect(NAV_PERMISSION_MAP[href]).toBe(
        SYSTEM_ADMIN_PERMISSIONS.intel.customerHealthRead
      );
    }
  });

  it('maps every CS section href in NAV_PERMISSION_MAP', () => {
    const hrefs = listCustomerSuccessSectionHrefs();
    expect(hrefs.length).toBeGreaterThan(5);
    const missing = hrefs.filter((href) => !NAV_PERMISSION_MAP[href]);
    expect(missing, `Unmapped CS hrefs: ${missing.join(', ')}`).toEqual([]);
    expect(NAV_PERMISSION_MAP['/insightbooks/customer-success']).toBe(
      SYSTEM_ADMIN_PERMISSIONS.customerSuccess.read
    );
    expect(NAV_PERMISSION_MAP['/insightbooks/customer-success/command-centre']).toBe(
      SYSTEM_ADMIN_PERMISSIONS.customerSuccess.read
    );
    expect(NAV_PERMISSION_MAP['/insightbooks/customer-success/interventions']).toBe(
      SYSTEM_ADMIN_PERMISSIONS.customerSuccess.manageCases
    );
  });

  it('adds Health and CS entries to adminNav overview', () => {
    const hrefs = listAdminNavHrefs();
    expect(hrefs).toContain('/insightbooks/intelligence/customer-health/overview');
    expect(hrefs).toContain('/insightbooks/customer-success/command-centre');
    expect(hrefs).not.toContain('/insightbooks/chart-of-accounts');

    const overview = ADMIN_NAV_SECTIONS.find((s) => s.id === 'overview');
    const texts = (overview?.items || []).map((i) => i.text);
    expect(texts).toEqual(expect.arrayContaining(['Customer Health', 'Customer Success']));
  });

  it('gates CS read vs manageCases for non–super-admin', () => {
    const reader = {
      role: 'Platform Support',
      permissions: {
        systemAdmin: { customerSuccess: { read: true } },
      },
    };
    expect(adminHasPermission(reader, SYSTEM_ADMIN_PERMISSIONS.customerSuccess.read)).toBe(
      true
    );
    expect(
      adminHasPermission(reader, SYSTEM_ADMIN_PERMISSIONS.customerSuccess.manageCases)
    ).toBe(false);

    const manager = {
      role: 'Platform Support',
      permissions: {
        systemAdmin: {
          customerSuccess: { read: true, manageCases: true },
        },
      },
    };
    expect(
      adminHasPermission(manager, SYSTEM_ADMIN_PERMISSIONS.customerSuccess.manageCases)
    ).toBe(true);
  });

  it('ships Health and CS page routes', () => {
    expect(
      existsSync(join(root, 'app/insightbooks/intelligence/customer-health/overview/page.js'))
    ).toBe(true);
    expect(
      existsSync(join(root, 'app/insightbooks/customer-success/command-centre/page.js'))
    ).toBe(true);
    expect(existsSync(join(root, 'lib/admin/healthNav.js'))).toBe(true);
    expect(existsSync(join(root, 'lib/admin/customerSuccessNav.js'))).toBe(true);
  });
});
