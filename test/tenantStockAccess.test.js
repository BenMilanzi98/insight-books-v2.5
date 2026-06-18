import { describe, it, expect, vi } from 'vitest';
import {
  resolvePrimaryBranchForTenant,
  ensurePrimaryBranchForTenant,
} from '@/lib/tenantStockAccess';

describe('tenantStockAccess primary branch', () => {
  it('resolvePrimaryBranchForTenant returns first branch by createdAt', async () => {
    const db = {
      branch: {
        findFirst: vi.fn().mockResolvedValue({ id: 'branch-first' }),
      },
    };
    const id = await resolvePrimaryBranchForTenant('t1', db);
    expect(id).toBe('branch-first');
    expect(db.branch.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 't1' },
        orderBy: { createdAt: 'asc' },
      })
    );
  });

  it('ensurePrimaryBranchForTenant syncs tenant.defaultBranchId to first branch', async () => {
    const db = {
      tenant: {
        findUnique: vi.fn().mockResolvedValue({ id: 't1', name: 'Acme' }),
        update: vi.fn().mockResolvedValue({}),
      },
      branch: {
        findFirst: vi.fn().mockResolvedValue({ id: 'branch-oldest', isActive: true }),
        update: vi.fn(),
        create: vi.fn(),
      },
    };
    const id = await ensurePrimaryBranchForTenant('t1', db);
    expect(id).toBe('branch-oldest');
    expect(db.tenant.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { defaultBranchId: 'branch-oldest' },
    });
    expect(db.branch.create).not.toHaveBeenCalled();
  });
});
