import { describe, it, expect } from 'vitest';
import {
  computeAllowedBranchIds,
  getEffectiveDashboardBranchId,
  resolveProductListBranchId,
  clampResolvedBranchToUserAccess,
} from '../lib/branchAccess.js';

describe('hidden primary branch policy', () => {
  it('computeAllowedBranchIds always grants full business scope', () => {
    expect(computeAllowedBranchIds()).toEqual({ allowedBranchIds: null });
  });

  it('getEffectiveDashboardBranchId uses primaryBranchId on user', () => {
    const user = {
      tenantId: 't1',
      primaryBranchId: 'b-primary',
      currentBranchId: 'b-other',
    };
    expect(getEffectiveDashboardBranchId(user)).toBe('b-primary');
  });

  it('resolveProductListBranchId returns null (tenant-wide catalog)', () => {
    expect(resolveProductListBranchId({ tenantId: 't1' }, 'b1')).toBe(null);
  });

  it('clampResolvedBranchToUserAccess does not restrict branch', () => {
    expect(clampResolvedBranchToUserAccess({}, 'b1')).toBe('b1');
    expect(clampResolvedBranchToUserAccess({}, null)).toBe(null);
  });
});
