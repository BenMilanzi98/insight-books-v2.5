import { describe, it, expect } from 'vitest';
import { listAdminNavHrefs, isRemovedAdminRoute } from '@/lib/admin/adminNav';
import { NAV_PERMISSION_MAP } from '@/lib/admin/permissions';

describe('NAV_PERMISSION_MAP completeness', () => {
  it('maps every adminNav href to a permission', () => {
    const hrefs = listAdminNavHrefs();
    expect(hrefs.length).toBeGreaterThan(10);
    const missing = hrefs.filter((href) => !NAV_PERMISSION_MAP[href]);
    expect(missing, `Unmapped nav hrefs: ${missing.join(', ')}`).toEqual([]);
  });

  it('does not map removed CoA route', () => {
    expect(NAV_PERMISSION_MAP['/insightbooks/chart-of-accounts']).toBeUndefined();
    expect(isRemovedAdminRoute('/insightbooks/chart-of-accounts')).toBe(true);
  });

  it('billing children are mapped', () => {
    for (const href of [
      '/insightbooks/billing/overview',
      '/insightbooks/billing/plans',
      '/insightbooks/billing/subscriptions',
      '/insightbooks/billing/invoices',
      '/insightbooks/billing/payments',
      '/insightbooks/billing/credits',
      '/insightbooks/billing/reconciliation',
    ]) {
      expect(NAV_PERMISSION_MAP[href]).toBeTruthy();
    }
  });
});
