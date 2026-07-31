import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/prisma.js', () => {
  const accountSubscription = { findFirst: vi.fn() };
  const mraEisTenantEntitlement = { findFirst: vi.fn() };
  return {
    default: {
      accountSubscription,
      mraEisTenantEntitlement,
    },
  };
});

import prisma from '../lib/prisma.js';
import {
  resolveTenantEisManagementAccess,
  TENANT_EIS_NAV_FULL,
  TENANT_EIS_NAV_LOCKED,
} from '../lib/mraEis/navAccess.js';
import { isAdminMraEisSectionActive } from '../lib/admin/mraEisNav.js';

describe('resolveTenantEisManagementAccess', () => {
  beforeEach(() => {
    prisma.accountSubscription.findFirst.mockReset();
    prisma.mraEisTenantEntitlement.findFirst.mockReset();
  });

  it('unlocks via active EIS subscription', async () => {
    prisma.accountSubscription.findFirst.mockResolvedValue({
      plan: 'eis-monthly',
      isActive: true,
    });
    prisma.mraEisTenantEntitlement.findFirst.mockResolvedValue({
      status: 'NOT_ENTITLED',
    });
    const access = await resolveTenantEisManagementAccess('t1');
    expect(access.unlocked).toBe(true);
    expect(access.via).toBe('subscription');
    expect(access.navItems).toHaveLength(TENANT_EIS_NAV_FULL.length);
  });

  it('unlocks via entitled status without subscription', async () => {
    prisma.accountSubscription.findFirst.mockResolvedValue(null);
    prisma.mraEisTenantEntitlement.findFirst.mockResolvedValue({
      status: 'ENTITLED_SANDBOX_ONLY',
    });
    const access = await resolveTenantEisManagementAccess('t1');
    expect(access.unlocked).toBe(true);
    expect(access.via).toBe('entitlement');
    expect(access.navItems.map((i) => i.href)).toContain(
      '/settings/integrations/mra-eis/terminals'
    );
  });

  it('keeps locked hub nav when neither subscription nor entitlement', async () => {
    prisma.accountSubscription.findFirst.mockResolvedValue(null);
    prisma.mraEisTenantEntitlement.findFirst.mockResolvedValue({
      status: 'ENTITLEMENT_PENDING',
    });
    const access = await resolveTenantEisManagementAccess('t1');
    expect(access.unlocked).toBe(false);
    expect(access.navItems).toEqual([...TENANT_EIS_NAV_LOCKED]);
  });
});

describe('admin MRA EIS section active state', () => {
  it('does not mark entitlements hub active on child routes', () => {
    expect(
      isAdminMraEisSectionActive('/insightbooks/mra-eis/terminals', {
        href: '/insightbooks/mra-eis',
        exact: true,
      })
    ).toBe(false);
    expect(
      isAdminMraEisSectionActive('/insightbooks/mra-eis', {
        href: '/insightbooks/mra-eis',
        exact: true,
      })
    ).toBe(true);
    expect(
      isAdminMraEisSectionActive('/insightbooks/mra-eis/terminals', {
        href: '/insightbooks/mra-eis/terminals',
      })
    ).toBe(true);
  });
});
