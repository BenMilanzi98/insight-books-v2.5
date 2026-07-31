/**
 * GET /api/stock-by-business
 * Stock summary by business (tenant). No branch concept exposed.
 */
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requireAnyPermission } from '@/lib/auth';
import { getAccessibleTenantIdsForUser } from '@/lib/dashboardTenantScope';

function num(value) {
  if (value == null) return 0;
  if (typeof value === 'object' && typeof value.toNumber === 'function') {
    try {
      return value.toNumber();
    } catch {
      return Number(value) || 0;
    }
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function GET(request) {
  try {
    const perm = await requireAnyPermission(request, [
      'inventory.view',
      'sales.view',
      'sales.create',
    ]);
    if (perm) return perm;

    const user = await getUserFromSession(request);
    if (!user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    let accessibleTenantIds = [];
    try {
      accessibleTenantIds = await getAccessibleTenantIdsForUser(user);
    } catch (scopeErr) {
      console.warn('stock-by-business tenant scope failed:', scopeErr?.message || scopeErr);
      if (user.tenantId) accessibleTenantIds = [user.tenantId];
    }

    if (!accessibleTenantIds.length && user.tenantId) {
      accessibleTenantIds = [user.tenantId];
    }

    if (!accessibleTenantIds.length) {
      return NextResponse.json({ businesses: [] });
    }

    const tenants = await prisma.tenant.findMany({
      where: { id: { in: accessibleTenantIds } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    const businesses = [];
    for (const tenant of tenants) {
      try {
        const products = await prisma.product.findMany({
          where: {
            tenantId: tenant.id,
            isDeleted: false,
            isService: false,
          },
          select: {
            stockLevel: true,
            cost: true,
          },
        });

        let totalQuantity = 0;
        let totalValue = 0;
        for (const p of products) {
          const qty = num(p.stockLevel);
          const cost = num(p.cost);
          totalQuantity += qty;
          totalValue += qty * cost;
        }

        businesses.push({
          id: tenant.id,
          name: tenant.name || 'Business',
          productCount: products.length,
          totalQuantity: Number(totalQuantity.toFixed(4)),
          totalValue: Number(totalValue.toFixed(2)),
        });
      } catch (tenantErr) {
        console.warn(`stock-by-business failed for tenant ${tenant.id}:`, tenantErr?.message || tenantErr);
        businesses.push({
          id: tenant.id,
          name: tenant.name || 'Business',
          productCount: 0,
          totalQuantity: 0,
          totalValue: 0,
          error: true,
        });
      }
    }

    return NextResponse.json({ businesses });
  } catch (error) {
    console.error('Error fetching stock by business:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stock by business', businesses: [] },
      { status: 500 }
    );
  }
}
