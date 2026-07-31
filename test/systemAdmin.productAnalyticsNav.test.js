import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { join } from 'path';
import { listAdminNavHrefs, ADMIN_NAV_SECTIONS } from '@/lib/admin/adminNav';
import {
  listProductAnalyticsSectionHrefs,
  PRODUCT_ANALYTICS_SECTIONS,
  PRODUCT_ANALYTICS_BASE,
} from '@/lib/admin/productAnalyticsNav';
import {
  NAV_PERMISSION_MAP,
  SYSTEM_ADMIN_PERMISSIONS,
} from '@/lib/admin/permissions';

const root = process.cwd();

describe('Phase 9 Wave 3 — Product Analytics nav / permissions', () => {
  it('defines productAnalytics permission keys', () => {
    expect(SYSTEM_ADMIN_PERMISSIONS.intel.productAnalyticsRead).toBe(
      'systemAdmin.intel.productAnalytics.read'
    );
  });

  it('maps every product-analytics section href in NAV_PERMISSION_MAP', () => {
    const hrefs = listProductAnalyticsSectionHrefs();
    expect(hrefs.length).toBeGreaterThan(6);
    const missing = hrefs.filter((href) => !NAV_PERMISSION_MAP[href]);
    expect(missing, `Unmapped product-analytics hrefs: ${missing.join(', ')}`).toEqual(
      []
    );
    for (const href of hrefs) {
      const expected =
        href === `${PRODUCT_ANALYTICS_BASE}/reports`
          ? SYSTEM_ADMIN_PERMISSIONS.intel.productAnalyticsExport
          : SYSTEM_ADMIN_PERMISSIONS.intel.productAnalyticsRead;
      expect(NAV_PERMISSION_MAP[href]).toBe(expected);
    }
  });

  it('gates Reports on export permission (not read-only live→403)', () => {
    expect(
      NAV_PERMISSION_MAP[`${PRODUCT_ANALYTICS_BASE}/reports`]
    ).toBe(SYSTEM_ADMIN_PERMISSIONS.intel.productAnalyticsExport);
    const reports = PRODUCT_ANALYTICS_SECTIONS.find((s) => s.id === 'reports');
    expect(reports?.permission).toBe(
      SYSTEM_ADMIN_PERMISSIONS.intel.productAnalyticsExport
    );
    expect(reports?.readiness).toBe('live');
  });

  it('includes Wave 3/4 live sections and definitions stub', () => {
    const ids = PRODUCT_ANALYTICS_SECTIONS.map((s) => s.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'overview',
        'modules',
        'features',
        'adoption',
        'activation',
        'first-value',
        'funnels',
        'cohorts',
        'signals',
        'definitions',
        'reconciliation',
        'reports',
      ])
    );
    expect(PRODUCT_ANALYTICS_BASE).toBe('/insightbooks/intelligence/product-analytics');
    const wave4Live = PRODUCT_ANALYTICS_SECTIONS.filter((s) => s.wave === 4);
    expect(wave4Live.every((s) => s.readiness === 'live')).toBe(true);
  });

  it('adds Product Analytics to adminNav overview', () => {
    const hrefs = listAdminNavHrefs();
    expect(hrefs).toContain('/insightbooks/intelligence/product-analytics/overview');

    const overview = ADMIN_NAV_SECTIONS.find((s) => s.id === 'overview');
    const texts = (overview?.items || []).map((i) => i.text);
    expect(texts).toEqual(expect.arrayContaining(['Product Analytics']));
  });

  it('ships Product Analytics page routes and nav module', () => {
    expect(
      existsSync(
        join(root, 'app/insightbooks/intelligence/product-analytics/overview/page.js')
      )
    ).toBe(true);
    expect(
      existsSync(
        join(root, 'app/insightbooks/intelligence/product-analytics/modules/page.js')
      )
    ).toBe(true);
    expect(
      existsSync(
        join(root, 'app/insightbooks/intelligence/product-analytics/features/page.js')
      )
    ).toBe(true);
    expect(
      existsSync(
        join(root, 'app/insightbooks/intelligence/product-analytics/adoption/page.js')
      )
    ).toBe(true);
    expect(
      existsSync(
        join(root, 'app/insightbooks/intelligence/product-analytics/activation/page.js')
      )
    ).toBe(true);
    expect(
      existsSync(
        join(root, 'app/insightbooks/intelligence/product-analytics/first-value/page.js')
      )
    ).toBe(true);
    expect(existsSync(join(root, 'lib/admin/productAnalyticsNav.js'))).toBe(true);
  });
});
