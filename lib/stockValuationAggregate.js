/**
 * Physical inventory valuation — same branch scope and line math as GET /api/stock/statistics
 * and GET /api/chart-of-accounts (Stock Management tie-out).
 */
import { resolveProductListBranchId } from '@/lib/branchAccess';
import { resolveProductCostPriceForDisplay } from '@/lib/productCostDisplay';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {object} user — session user with tenantId, currentBranchId, allowedBranchIds
 * @param {URLSearchParams} [searchParams]
 * @returns {Promise<object|null>} Prisma AND conjunct for Product rows (null = tenant-wide physical stock)
 */
export async function resolveStockBranchClauseFromParams(prisma, user, searchParams) {
  const sp = searchParams || new URLSearchParams();
  const allBranchesParam = sp.get('allBranches');
  const allBranches =
    allBranchesParam == null || allBranchesParam === ''
      ? true
      : /^(1|true|yes)$/i.test(String(allBranchesParam));
  const branchIdParam = sp.get('branchId')?.trim() || null;

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

export function productLineValue(product) {
  const stockLevel = Number(product.stockLevel) || 0;
  const cost = resolveProductCostPriceForDisplay(product);
  const stored = product.totalStockValue != null ? Number(product.totalStockValue) : null;
  if (stored != null && !Number.isNaN(stored) && stored > 0) return stored;
  return stockLevel * cost;
}

/** @param {Array<object>} products */
export function sumPhysicalInventoryProductLines(products) {
  let total = 0;
  for (const product of products || []) {
    try {
      total += productLineValue(product);
    } catch {
      // skip
    }
  }
  return total;
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} tenantId
 * @param {object|null} branchClause — from resolveStockBranchClauseFromParams
 */
export async function probeUseDeletedFilterForPhysicalStock(prisma, tenantId, branchClause) {
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
    return true;
  } catch {
    return false;
  }
}

/**
 * @returns {Promise<{ physicalWhere: object, branchClause: object|null, useDeletedFilter: boolean }>}
 */
export async function buildPhysicalInventoryWhere(prisma, tenantId, user, searchParams) {
  const branchClause = await resolveStockBranchClauseFromParams(prisma, user, searchParams);
  const useDeletedFilter = await probeUseDeletedFilterForPhysicalStock(prisma, tenantId, branchClause);
  const physicalWhere = {
    AND: [
      { tenantId },
      { isService: false },
      ...(useDeletedFilter ? [{ isDeleted: false }] : []),
      ...(branchClause ? [branchClause] : []),
    ],
  };
  return { physicalWhere, branchClause, useDeletedFilter };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} tenantId
 * @param {object} user
 * @param {URLSearchParams} [searchParams] — optional; default allBranches=true matches /stock/statistics
 * @returns {Promise<{ total: number, productCount: number, products: Array<object> }>}
 */
export async function computePhysicalInventoryValuationTotal(prisma, tenantId, user, searchParams) {
  const { physicalWhere } = await buildPhysicalInventoryWhere(prisma, tenantId, user, searchParams);

  const products = await prisma.product.findMany({
    where: physicalWhere,
    select: {
      id: true,
      name: true,
      stockLevel: true,
      cost: true,
      totalStockValue: true,
      averageCost: true,
      lastPurchaseCost: true,
      reorderPoint: true,
    },
  });

  const total = sumPhysicalInventoryProductLines(products);

  return { total, productCount: products.length, products };
}
