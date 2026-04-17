// app/api/stock/export/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { createObjectCsvStringifier } from '@/lib/csv-writer';
import { requireStandardAccess } from '@/lib/accessControl';
import { resolveProductListBranchId } from '@/lib/branchAccess';
import { userHasAccessToTenant } from '@/lib/tenantStockAccess';
import { resolveProductCostPriceForDisplay } from '@/lib/productCostDisplay';
import { exportToNumber } from '@/lib/exportNumberUtils';

/**
 * Build product `where` aligned with GET /api/stock so export matches on-screen inventory.
 */
async function buildStockExportWhere(user, searchParams) {
  const category = searchParams.get('category');
  const search = searchParams.get('search');
  const location = searchParams.get('location');
  const branchIdParam = searchParams.get('branchId');
  const allBranchesParam = searchParams.get('allBranches');
  const tenantIdParam = searchParams.get('tenantId')?.trim();
  const effectiveTenantId = tenantIdParam || user.tenantId;

  let allBranches;
  if (branchIdParam) {
    allBranches = false;
  } else if (allBranchesParam === null || allBranchesParam === '') {
    // Stock page lists tenant-wide catalog (fetchProducts always sends allBranches=true).
    allBranches = true;
  } else {
    allBranches = /^(1|true|yes)$/i.test(String(allBranchesParam));
  }

  const where = {
    tenantId: effectiveTenantId,
    isDeleted: false,
  };

  const isForeignTenant = effectiveTenantId !== user.tenantId;

  if (isForeignTenant) {
    if (branchIdParam) {
      const branch = await prisma.branch.findFirst({
        where: { id: branchIdParam, tenantId: effectiveTenantId, isActive: true },
        select: { id: true },
      });
      if (branch) {
        where.AND = [{ OR: [{ branchId: branchIdParam }, { branchId: null }] }];
      }
    }
  } else if (allBranches && !branchIdParam) {
    const allowed = user?.allowedBranchIds;
    if (Array.isArray(allowed) && allowed.length === 0) {
      where.AND = [...(where.AND || []), { id: { in: [] } }];
    } else if (allowed == null) {
      // full tenant
    } else {
      where.AND = [...(where.AND || []), { OR: [{ branchId: null }, { branchId: { in: allowed } }] }];
    }
  } else {
    const desiredBranchId = resolveProductListBranchId(user, branchIdParam);
    if (desiredBranchId === false) {
      where.AND = [...(where.AND || []), { id: { in: [] } }];
    } else if (desiredBranchId && typeof desiredBranchId === 'string') {
      const branch = await prisma.branch.findFirst({
        where: { id: desiredBranchId, tenantId: user.tenantId, isActive: true },
        select: { id: true },
      });
      if (branch) {
        where.AND = [
          ...(where.AND || []),
          { OR: [{ branchId: desiredBranchId }, { branchId: null }] },
        ];
      }
    }
  }

  let searchOrFallback = null;
  if (search) {
    const searchTrimmed = search.trim();
    searchOrFallback = [
      { name: { contains: search, mode: 'insensitive' } },
      { sku: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { category: { contains: search, mode: 'insensitive' } },
      { barcode: { contains: searchTrimmed, mode: 'insensitive' } },
    ];
    where.OR = [
      ...searchOrFallback,
      { productBarcodes: { some: { barcode: { contains: searchTrimmed, mode: 'insensitive' } } } },
    ];
  }

  if (category && category !== 'All') {
    if (category === 'Uncategorized') {
      where.category = null;
    } else {
      where.category = category;
    }
  }

  if (location && location !== 'All') {
    where.location = location;
  }

  return { where, searchOrFallback };
}

// GET - Export stock data in CSV format
export async function GET(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const format = searchParams.get('format') || 'csv';

    const tenantIdParam = searchParams.get('tenantId')?.trim();
    const effectiveTenantId = tenantIdParam || user.tenantId;
    if (tenantIdParam && effectiveTenantId !== user.tenantId) {
      const ok = await userHasAccessToTenant(user, effectiveTenantId);
      if (!ok) {
        return NextResponse.json({ error: 'Access denied to this business' }, { status: 403 });
      }
    }

    const { where, searchOrFallback } = await buildStockExportWhere(user, searchParams);

    const productSelect = {
      id: true,
      name: true,
      sku: true,
      category: true,
      stockLevel: true,
      reorderPoint: true,
      price: true,
      cost: true,
      location: true,
      isService: true,
      createdAt: true,
      updatedAt: true,
      lastPurchaseCost: true,
      averageCost: true,
      totalStockValue: true,
      barcode: true,
      productBarcodes: { select: { barcode: true } },
    };

    let products;
    try {
      products = await prisma.product.findMany({
        where,
        orderBy: { name: 'asc' },
        select: productSelect,
      });
    } catch (err) {
      const msg = err?.message || '';
      if (msg.includes('ProductBarcode') || msg.includes('productBarcodes') || msg.includes('does not exist')) {
        const whereRetry = searchOrFallback ? { ...where, OR: searchOrFallback } : where;
        const { productBarcodes: _pb, ...selectNoBarcodes } = productSelect;
        products = await prisma.product.findMany({
          where: whereRetry,
          orderBy: { name: 'asc' },
          select: selectNoBarcodes,
        });
      } else {
        throw err;
      }
    }

    const processedProducts = products
      .map((product) => {
        const stockLevel = exportToNumber(product.stockLevel);
        const reorderPoint = exportToNumber(product.reorderPoint) || 10;

        let productStatus;
        if (product.isService) {
          productStatus = 'Service';
        } else if (stockLevel === 0) {
          productStatus = 'Out of Stock';
        } else if (stockLevel <= reorderPoint) {
          productStatus = 'Low Stock';
        } else {
          productStatus = 'In Stock';
        }

        const costPrice = resolveProductCostPriceForDisplay(product);
        const totalStockValueStored =
          product.totalStockValue != null ? exportToNumber(product.totalStockValue) : null;
        const totalStockValue =
          totalStockValueStored != null && totalStockValueStored > 0
            ? totalStockValueStored
            : stockLevel * costPrice;

        return {
          ...product,
          status: productStatus,
          _stockLevelNum: stockLevel,
          _reorderNum: reorderPoint,
          _costPrice: costPrice,
          _totalStockValue: totalStockValue,
        };
      })
      .filter((product) => !status || status === 'All' || product.status === status);

    if (format === 'csv') {
      return generateCsvResponse(processedProducts, user.tenantId);
    }

    return NextResponse.json({ error: 'Unsupported export format' }, { status: 400 });
  } catch (error) {
    console.error('Error exporting stock:', error);
    return NextResponse.json(
      { error: 'Failed to export stock. Please try again.' },
      { status: 500 }
    );
  }
}

async function generateCsvResponse(products, tenantId) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true },
  });

  const csvStringifier = createObjectCsvStringifier({
    header: [
      { id: 'sku', title: 'SKU' },
      { id: 'name', title: 'Product Name' },
      { id: 'category', title: 'Category' },
      { id: 'stockLevel', title: 'Quantity in Stock' },
      { id: 'reorderPoint', title: 'Reorder Point' },
      { id: 'price', title: 'Selling Price (MWK)' },
      { id: 'cost', title: 'Cost Price (MWK)' },
      { id: 'location', title: 'Location' },
      { id: 'status', title: 'Status' },
      { id: 'profit', title: 'Profit Margin %' },
      { id: 'stockValue', title: 'Stock Value (MWK)' },
      { id: 'lastUpdated', title: 'Last Updated' },
    ],
  });

  const records = products.map((product) => {
    const price = exportToNumber(product.price);
    const cost = exportToNumber(product._costPrice ?? product.cost);
    const stockLevel = product._stockLevelNum ?? exportToNumber(product.stockLevel);
    const profitMargin =
      price > 0 ? Math.round(((price - cost) / price) * 100) : 0;
    const stockValue = product._totalStockValue ?? stockLevel * cost;

    return {
      sku: product.sku ?? '',
      name: product.name,
      category: product.category || 'Uncategorized',
      stockLevel: Number(stockLevel.toFixed(4)),
      reorderPoint: Math.round(exportToNumber(product.reorderPoint) || 0),
      price: Number(price.toFixed(2)),
      cost: Number(cost.toFixed(2)),
      location: product.location || '',
      status: product.status,
      profit: profitMargin,
      stockValue: Number(exportToNumber(stockValue).toFixed(2)),
      lastUpdated: product.updatedAt.toISOString().split('T')[0],
    };
  });

  const csvContent = csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);
  const date = new Date().toISOString().split('T')[0];
  const tenantName = tenant?.name?.replace(/\s+/g, '_').toLowerCase() || 'stock';
  const filename = `${tenantName}_stock_${date}.csv`;

  return new NextResponse(csvContent, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
