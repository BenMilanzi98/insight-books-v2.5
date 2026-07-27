import { describe, it, expect } from 'vitest';
import { dryRunImport, IMPORT_DRY_RUN_MAX_ROWS } from '@/lib/admin/importDryRun';

describe('importDryRun', () => {
  it('validates tenant CSV without inventing persistence', () => {
    const csv = 'name,subdomain,status\nAcme,acme,active\n';
    const result = dryRunImport('tenants', csv);
    expect(result.ok).toBe(true);
    expect(result.preview).toHaveLength(1);
    expect(result.preview[0].subdomain).toBe('acme');
    expect(result.errors).toEqual([]);
  });

  it('rejects invalid user emails and duplicates', () => {
    const rows = [
      { email: 'bad', name: 'A' },
      { email: 'ok@example.com', name: 'B' },
      { email: 'ok@example.com', name: 'C' },
    ];
    const result = dryRunImport('users', rows);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === 'email' && e.row === 1)).toBe(true);
    expect(result.errors.some((e) => /duplicate/i.test(e.message))).toBe(true);
  });

  it('enforces max row cap', () => {
    const rows = Array.from({ length: IMPORT_DRY_RUN_MAX_ROWS + 1 }, (_, i) => ({
      name: `T${i}`,
      subdomain: `t${i}`,
    }));
    const result = dryRunImport('tenants', rows);
    expect(result.ok).toBe(false);
    expect(result.errors[0].message).toMatch(/Maximum is/);
    expect(result.preview).toEqual([]);
  });
});
