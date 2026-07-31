import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const root = process.cwd();

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

describe('Wave 1 — calm ops admin UI foundation', () => {
  it('expands admin design tokens without indigo active tint', () => {
    const css = read('app/globals.css');
    expect(css).toMatch(/--admin-border:/);
    expect(css).toMatch(/--admin-text-muted:/);
    expect(css).toMatch(/--admin-focus-ring:/);
    expect(css).toMatch(/--admin-row-height:/);
    expect(css).not.toMatch(/--admin-sidebar-active:\s*rgba\(99,\s*102,\s*241/);
  });

  it('AdminShell uses AdminHeader and does not import AppBar/Footer', () => {
    const shell = read('components/shell/AdminShell.jsx');
    expect(shell).toMatch(/AdminHeader/);
    expect(shell).not.toContain("from '@/components/AppBar'");
    expect(shell).not.toContain("from '@/components/Footer'");
    expect(shell).not.toContain('AppBar');
    expect(shell).not.toContain('Footer');
  });

  it('exports Wave 1 primitives', () => {
    const index = read('components/admin/index.js');
    for (const name of [
      'AdminHeader',
      'AdminDataTable',
      'AdminFilterBar',
      'AdminField',
      'AdminModal',
      'AdminDrawer',
      'AdminActionMenu',
      'AdminPageEnter',
      'AdminChartCard',
      'AdminPieChart',
      'AdminTrendChart',
      'AdminBarChart',
    ]) {
      expect(index).toMatch(new RegExp(name));
      expect(existsSync(join(root, `components/admin/${name}.jsx`))).toBe(true);
    }
  });

  it('includes admin motion tokens and reduced-motion-safe classes', () => {
    const css = read('app/globals.css');
    expect(css).toMatch(/--admin-motion-base:/);
    expect(css).toMatch(/admin-page-enter/);
    expect(css).toMatch(/admin-lift/);
    expect(css).toMatch(/prefers-reduced-motion/);
  });

  it('uses a vivid admin color system', () => {
    const css = read('app/globals.css');
    expect(css).toMatch(/--admin-accent:/);
    expect(css).toMatch(/admin-shell-canvas/);
    expect(css).toMatch(/admin-btn-primary/);
    expect(css).toMatch(/admin-card-sky/);
  });

  it('dashboard control tower wires charts and live APIs', () => {
    const page = read('app/insightbooks/dashboard/page.js');
    expect(page).toMatch(/AdminPieChart/);
    expect(page).toMatch(/AdminTrendChart/);
    expect(page).toMatch(/AdminBarChart/);
    expect(page).toMatch(/\/api\/admin\/dashboard\/stats/);
    expect(page).toMatch(/\/api\/admin\/dashboard\/tenant-growth/);
    expect(page).toMatch(/\/api\/admin\/platform-billing\/payments/);
    expect(page).toMatch(/never invented/i);
  });

  it('AdminDataTable mounts only one layout via matchMedia', () => {
    const src = read('components/admin/AdminDataTable.jsx');
    expect(src).toMatch(/useSyncExternalStore/);
    expect(src).toMatch(/matchMedia/);
    expect(src).toMatch(/space-y-3/);
  });

  it('AdminActionMenu portals to document.body to avoid overflow clipping', () => {
    const src = read('components/admin/AdminActionMenu.jsx');
    expect(src).toMatch(/createPortal/);
    expect(src).toMatch(/document\.body/);
    expect(src).toMatch(/fixed/);
  });
});
