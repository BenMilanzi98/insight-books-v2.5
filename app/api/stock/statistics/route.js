// GET /api/stock/statistics — aggregates for Stock Management header cards.
// Branch scope must match GET /api/stock (list uses allBranches=true + OR branchId null).
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { resolveProductListBranchId } from '@/lib/branchAccess';
import { resolveProductCostPriceForDisplay } from '@/lib/productCostDisplay';

/**
 * Same branch rules as app/api/stock/route.js for the current tenant.
 * @returns {Promise<object|null>} Extra conjunct for AND (null = no branch filter).
 */
async function branchScopeClauseForStockStatistics(user, searchParams) {
  const allBranchesParam = searchParams.get('allBranches');
  const allBranches =
    allBranchesParam == null || allBranchesParam === ''
      ? true
      : /^(1|true|yes)$/i.test(String(allBranchesParam));
  const branchIdParam = searchParams.get('branchId')?.trim() || null;

  if (allBranches && !branchIdParam) {
    const allowed = user?.allowedBranchIds;
    if (Array.isArray(allowed) && allowed.length === 0) {
      return { id: { in: [] } };
    }
    if (allowed == null) {
      return null;
    }
    return { OR: [{ branchId: null }, { branchId: { in: allowed } }] };
  }

  const desiredBranchId = resolveProductListBranchId(user, branchIdParam);
  if (desiredBranchId === false) {
    return { id: { in: [] } };
  }
  if (desiredBranchId && typeof desiredBranchId === 'string') {
    const branch = await prisma.branch.findFirst({
      where: { id: desiredBranchId, tenantId: user.tenantId, isActive: true },
      select: { id: true },
    });
    if (branch) {
      return { OR: [{ branchId: desiredBranchId }, { branchId: null }] };
    }
  }
  return null;
}

// GET - Fetch inventory statistics with fallbacks
export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tenantId = user.tenantId;
    const branchClause = await branchScopeClauseForStockStatistics(user, searchParams);

    let useDeletedFilter = false;
    try {
      const probeWhere = {
        AND: [
          { tenantId },
          { isService: false },
          ...(branchClause ? [branchClause] : []),
          { isDeleted: false },
        ],
      };
      await prisma.product.findFirst({ where: probeWhere, select: { id: true } });
      useDeletedFilter = true;
    } catch {
      useDeletedFilter = false;
    }

    const buildProductWhere = (isService) => {
      const parts = [{ tenantId }, { isService }];
      if (useDeletedFilter) parts.push({ isDeleted: false });
      if (branchClause) parts.push(branchClause);
      return { AND: parts };
    };

    const physicalWhere = buildProductWhere(false);
    const serviceWhere = buildProductWhere(true);

    const totalItems = await prisma.product.count({ where: physicalWhere });

    let serviceCount = 0;
    try {
      serviceCount = await prisma.product.count({ where: serviceWhere });
    } catch {
      serviceCount = 0;
    }

    const products = await prisma.product.findMany({
      where: physicalWhere,
      select: {
        id: true,
        name: true,
        stockLevel: true,
        cost: true,
        averageCost: true,
        lastPurchaseCost: true,
        totalStockValue: true,
        reorderPoint: true,
      },
    });

    let lowStock = 0;
    let outOfStock = 0;
    let totalValue = 0;

    products.forEach((product) => {
      const stockLevel = Number(product.stockLevel) || 0;
      const cost = resolveProductCostPriceForDisplay(product);
      const stored = product.totalStockValue != null ? Number(product.totalStockValue) : null;
      const productValue = stored != null && stored > 0 ? stored : stockLevel * cost;
      totalValue += productValue;

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
      totalValue: totalValue.toLocaleString(undefined, {
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
