import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { isRemovedAdminRoute } from '@/lib/admin/adminNav';

describe('Admin breadcrumbs CoA safety', () => {
  it('breadcrumb helper module never references System CoA route as a crumb target', () => {
    const src = readFileSync(
      join(process.cwd(), 'components/admin/AdminBreadcrumbs.jsx'),
      'utf8'
    );
    expect(src).toMatch(/isRemovedAdminRoute/);
    expect(isRemovedAdminRoute('/insightbooks/chart-of-accounts')).toBe(true);
  });

  it('admin search helper does not index CoA routes', () => {
    const src = readFileSync(join(process.cwd(), 'lib/admin/adminSearch.js'), 'utf8');
    expect(src).not.toMatch(/chart-of-accounts/);
  });
});
