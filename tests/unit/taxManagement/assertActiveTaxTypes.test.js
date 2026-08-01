import { describe, it, expect, vi } from 'vitest';
import { assertActiveTaxTypeIds } from '@/lib/taxManagement/assertActiveTaxTypes';

describe('assertActiveTaxTypeIds', () => {
  it('no-ops for empty ids', async () => {
    const db = { taxType: { findMany: vi.fn() } };
    await expect(assertActiveTaxTypeIds(db, 't1', [])).resolves.toBeUndefined();
    expect(db.taxType.findMany).not.toHaveBeenCalled();
  });

  it('passes when all found and Active', async () => {
    const db = {
      taxType: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'a', status: 'Active', taxName: 'VAT' },
        ]),
      },
    };
    await expect(assertActiveTaxTypeIds(db, 't1', ['a'])).resolves.toBeUndefined();
  });

  it('rejects Inactive', async () => {
    const db = {
      taxType: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'a', status: 'Inactive', taxName: 'Old VAT' },
        ]),
      },
    };
    await expect(assertActiveTaxTypeIds(db, 't1', ['a'])).rejects.toMatchObject({
      code: 'INACTIVE_TAX',
    });
  });

  it('rejects unknown id', async () => {
    const db = {
      taxType: { findMany: vi.fn().mockResolvedValue([]) },
    };
    await expect(assertActiveTaxTypeIds(db, 't1', ['missing'])).rejects.toMatchObject({
      code: 'UNKNOWN_TAX',
    });
  });

  it('passes Inactive id when listed in allowInactiveIds', async () => {
    const db = {
      taxType: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'a', status: 'Inactive', taxName: 'Old VAT' },
        ]),
      },
    };
    await expect(
      assertActiveTaxTypeIds(db, 't1', ['a'], ['a'])
    ).resolves.toBeUndefined();
  });

  it('rejects Inactive id when not in allowInactiveIds', async () => {
    const db = {
      taxType: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'a', status: 'Inactive', taxName: 'Old VAT' },
        ]),
      },
    };
    await expect(
      assertActiveTaxTypeIds(db, 't1', ['a'], ['other'])
    ).rejects.toMatchObject({
      code: 'INACTIVE_TAX',
    });
  });
});
