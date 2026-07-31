import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/prisma.js', () => {
  const accountSubscription = {
    findFirst: vi.fn(),
  };
  return {
    default: {
      accountSubscription,
    },
  };
});

vi.mock('../lib/subscriptionConfig', async () => {
  const actual = await vi.importActual('../lib/subscriptionConfig');
  return actual;
});

import prisma from '../lib/prisma.js';
import { hasEISAccess } from '../lib/subscriptionService.js';

describe('hasEISAccess G2-004 fix', () => {
  beforeEach(() => {
    prisma.accountSubscription.findFirst.mockReset();
  });

  it('queries EIS plan ids explicitly', async () => {
    prisma.accountSubscription.findFirst.mockResolvedValue({
      plan: 'eis-monthly',
      isActive: true,
    });
    const ok = await hasEISAccess('tenant-1');
    expect(ok).toBe(true);
    const arg = prisma.accountSubscription.findFirst.mock.calls[0][0];
    expect(arg.where.plan.in).toEqual(expect.arrayContaining(['eis-monthly', 'eis-yearly']));
  });

  it('returns false when no EIS subscription exists even if other paid plans do', async () => {
    prisma.accountSubscription.findFirst.mockResolvedValue(null);
    const ok = await hasEISAccess('tenant-1');
    expect(ok).toBe(false);
  });
});
