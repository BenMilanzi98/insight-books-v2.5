// GET /api/stock/statistics — aggregates for Stock Management header cards.
// Branch scope must match GET /api/stock (list uses allBranches=true + OR branchId null).
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import {
  buildPhysicalInventoryWhere,
  sumPhysicalInventoryProductLines,
} from '@/lib/stockValuationAggregate';

// GET - Fetch inventory statistics with fallbacks
export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tenantId = user.tenantId;

    const { physicalWhere, branchClause, useDeletedFilter } = await buildPhysicalInventoryWhere(
      prisma,
      tenantId,
      user,
      searchParams
    );

    const productSelect = {
      id: true,
      name: true,
      stockLevel: true,
      cost: true,
      totalStockValue: true,
      averageCost: true,
      lastPurchaseCost: true,
      reorderPoint: true,
    };

    const [totalItems, products] = await Promise.all([
      prisma.product.count({ where: physicalWhere }),
      prisma.product.findMany({ where: physicalWhere, select: productSelect }),
    ]);

    const totalValueNum = sumPhysicalInventoryProductLines(products);

    const serviceWhere = {
      AND: [
        { tenantId },
        { isService: true },
        ...(useDeletedFilter ? [{ isDeleted: false }] : []),
        ...(branchClause ? [branchClause] : []),
      ],
    };

    let serviceCount = 0;
    try {
      serviceCount = await prisma.product.count({ where: serviceWhere });
    } catch {
      serviceCount = 0;
    }

    let lowStock = 0;
    let outOfStock = 0;

    products.forEach((product) => {
      const stockLevel = Number(product.stockLevel) || 0;
      const reorderPoint = product.reorderPoint || 10;

      if (stockLevel === 0) {
        outOfStock++;
      } else if (stockLevel <= reorderPoint) {
        lowStock++;
      }
    });

    const recentTransactions = [];

    const nearingReorder = products.filter((product) => {
      const stockLevel = product.stockLevel || 0;
      const reorderPoint = product.reorderPoint || 10;
      return stockLevel > 0 && stockLevel <= reorderPoint * 1.2;
    }).length;

    const categoryPercentages = [
      {
        name: 'Uncategorized',
        count: totalItems,
        percentage: totalItems > 0 ? 100 : 0,
      },
    ];

    return NextResponse.json({
      totalItems,
      serviceCount,
      totalValue: totalValueNum.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      lowStock,
      outOfStock,
      nearingReorder,
      categories: categoryPercentages,
      recentTransactions,
    });
  } catch (error) {
    console.error('Error fetching inventory statistics:', error);
    console.error('Error details:', error.message);
    console.error('Stack trace:', error.stack);
    return NextResponse.json(
      { error: 'Failed to fetch inventory statistics. Please try again.', details: error.message },
      { status: 500 }
    );
  }
}
