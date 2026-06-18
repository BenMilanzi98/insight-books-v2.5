import { describe, it, expect, vi } from 'vitest';
import {
  BACKFILL_BRANCH_MODELS,
  countNullBranchIdsForTenant,
  backfillPrimaryBranchForTenant,
} from '@/lib/backfillPrimaryBranch';

vi.mock('@/lib/tenantStockAccess', () => ({
  ensurePrimaryBranchForTenant: vi.fn().mockResolvedValue('branch-primary-1'),
}));

describe('backfillPrimaryBranch', () => {
  it('defines models with tenant-scoped nullable branchId', () => {
    expect(BACKFILL_BRANCH_MODELS.length).toBeGreaterThan(5);
    expect(BACKFILL_BRANCH_MODELS.some((m) => m.key === 'sales')).toBe(true);
  });

  it('countNullBranchIdsForTenant sums per model', async () => {
    const db = Object.fromEntries(
      BACKFILL_BRANCH_MODELS.map(({ delegate }) => [
        delegate,
        { count: vi.fn().mockResolvedValue(delegate === 'sale' ? 3 : delegate === 'expense' ? 1 : 0) },
      ])
    );
    const counts = await countNullBranchIdsForTenant('t1', db);
    expect(counts.sales).toBe(3);
    expect(counts.expenses).toBe(1);
  });

  it('dryRun reports counts without updating', async () => {
    const db = Object.fromEntries(
      BACKFILL_BRANCH_MODELS.map(({ delegate }) => [
        delegate,
        {
          count: vi.fn().mockResolvedValue(delegate === 'sale' ? 2 : 0),
          updateMany: vi.fn(),
        },
      ])
    );
    db.$transaction = vi.fn();

    const result = await backfillPrimaryBranchForTenant('tenant-a', { dryRun: true, db });
    expect(result.dryRun).toBe(true);
    expect(result.totalUpdated).toBe(2);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});
