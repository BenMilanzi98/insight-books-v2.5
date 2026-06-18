// GET /api/stock/statistics — aggregates for Stock Management header cards.
// Branch scope must match GET /api/stock (list uses allBranches=true + OR branchId null).
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import {
  buildPhysicalInventoryWhere,
  sumPhysicalInventoryProductLines,
} from '@/lib/stockValuationAggregate';
import { roundMoney } from '@/lib/money';
import {
  resolveOrEnsureStockOnHandGlAccount,
  STOCK_ON_HAND_GL_CODE,
  STOCK_ON_HAND_GL_NAME,
} from '@/lib/inventoryGlAccount';

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

    let glAccount = {
      code: STOCK_ON_HAND_GL_CODE,
      name: STOCK_ON_HAND_GL_NAME,
      id: null,
      postedBalance: null,
    };
    try {
      const stockGl = await resolveOrEnsureStockOnHandGlAccount(tenantId, prisma);
      glAccount = {
        id: stockGl.id,
        code: STOCK_ON_HAND_GL_CODE,
        name: stockGl.accountName || stockGl.name || STOCK_ON_HAND_GL_NAME,
        postedBalance:
          stockGl.balance != null ? roundMoney(parseFloat(stockGl.balance) || 0) : null,
      };
    } catch (glErr) {
      console.warn('Stock statistics: could not resolve 1310 GL link:', glErr?.message || glErr);
    }

    return NextResponse.json({
      totalItems,
      serviceCount,
      totalValue: roundMoney(totalValueNum),
      lowStock,
      outOfStock,
      nearingReorder,
      categories: categoryPercentages,
      recentTransactions,
      glAccount,
      valuationNote:
        'Stock value is tied to GL 1310 Stock on Hand (same aggregate shown on Chart of Accounts under Inventory).',
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
