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
    ]) {
      expect(index).toMatch(new RegExp(name));
      expect(existsSync(join(root, `components/admin/${name}.jsx`))).toBe(true);
    }
  });

  it('AdminDataTable supports mobile card list', () => {
    const src = read('components/admin/AdminDataTable.jsx');
    expect(src).toMatch(/md:hidden/);
    expect(src).toMatch(/hidden.*md:block|md:block/);
  });
});
