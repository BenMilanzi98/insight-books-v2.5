// app/api/stock-by-branch/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { getAccessibleTenantIdsForUser } from '@/lib/dashboardTenantScope';

/**
 * Stock summary by business (tenant) for users with access to multiple businesses.
 * Legacy response key `branches` holds one row per business with aggregate totals.
 */
export async function GET(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const accessibleTenantIds = await getAccessibleTenantIdsForUser(user);
    const tenants = await prisma.tenant.findMany({
      where: { id: { in: accessibleTenantIds } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    const businesses = await Promise.all(
      tenants.map(async (tenant) => {
        const products = await prisma.product.findMany({
          where: {
            tenantId: tenant.id,
            isDeleted: false,
            isService: false,
          },
          select: {
            id: true,
            stockLevel: true,
            cost: true,
            price: true,
          },
        });

        const productCount = products.length;
        const totalQuantity = products.reduce(
          (sum, p) => sum + parseFloat(p.stockLevel || 0),
          0
        );
        const totalValue = products.reduce((sum, p) => {
          const qty = parseFloat(p.stockLevel || 0);
          const cost = parseFloat(p.cost || 0);
          return sum + qty * cost;
        }, 0);

        return {
          id: tenant.id,
          name: tenant.name,
          productCount,
          totalQuantity: parseFloat(totalQuantity.toFixed(4)),
          totalValue: parseFloat(totalValue.toFixed(2)),
        };
      })
    );

    return NextResponse.json({
      businesses,
      branches: businesses,
    });
  } catch (error) {
    console.error('Error fetching stock by business:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stock by business' },
      { status: 500 }
    );
  }
}
