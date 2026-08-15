import { describe, expect, it } from 'vitest';
import { assertSetupSnapshot } from '../../lib/desktop/setupPayload.js';

describe('assertSetupSnapshot', () => {
  it('accepts a valid v1 snapshot with tenantId', () => {
    expect(
      assertSetupSnapshot({ version: 1, tenantId: 'tenant-1', products: [] }),
    ).toBe(true);
  });

  it('rejects missing tenantId', () => {
    expect(() => assertSetupSnapshot({ version: 1 })).toThrow('Invalid snapshot');
  });

  it('rejects wrong version', () => {
    expect(() =>
      assertSetupSnapshot({ version: 2, tenantId: 'tenant-1' }),
    ).toThrow('Invalid snapshot');
  });

  it('rejects null snapshot', () => {
    expect(() => assertSetupSnapshot(null)).toThrow('Invalid snapshot');
  });
});
