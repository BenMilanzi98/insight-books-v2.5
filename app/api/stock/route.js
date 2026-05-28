import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requirePermission } from '@/lib/auth';
import { resolveProductListBranchId, clampResolvedBranchToUserAccess } from '@/lib/branchAccess';
import { requireStandardAccess } from '@/lib/accessControl';
import { createFifoBatch } from '@/lib/fifoCosting';
import { userHasAccessToTenant } from '@/lib/tenantStockAccess';
import { resolveProductCostPriceForDisplay } from '@/lib/productCostDisplay';
import { normalizeExpiryAllocations } from '@/lib/expiryAllocations';
import {
  buildProductUnitPayloadRows,
  ensureOneDefaultUnit,
} from '@/lib/productUnitSavePayload';
import { productLineValue } from '@/lib/stockValuationAggregate';
import { roundMoney } from '@/lib/money';

// GET - Fetch products with all fields
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'inventory.view');
    if (perm) return perm;

    // Check for standard access
    const accessError = await requireStandardAccess(request);
    if (accessError) {
      return accessError;
    }

    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    const includeProductUnits = /^(1|true|yes)$/i.test(String(searchParams.get('productUnits') || ''));
    const productUnitsInclude = includeProductUnits
      ? {
          productUnits: {
            where: { isActive: true },
            include: {
              unit: { select: { id: true, symbol: true, name: true } },
            },
            orderBy: [{ isDefault: 'desc' }, { id: 'asc' }],
          },
        }
      : {};

    // Parse query parameters
    const page = parseInt(searchParams.get('page')) || 1;
    const limitParam = searchParams.get('limit');
    // If no limit is specified or limit is 0, fetch all items
    const limit = limitParam ? (parseInt(limitParam) || 0) : 0;
    const sort = searchParams.get('sort') || 'name';
    const order = searchParams.get('order') || 'asc';
    const search = searchParams.get('search');
    const category = searchParams.get('category');
    const status = searchParams.get('status');
    const location = searchParams.get('location');
    const branchIdParam = searchParams.get('branchId');
    const allBranchesParam = searchParams.get('allBranches');
    const allBranches = /^(1|true|yes)$/i.test(String(allBranchesParam || ''));
    const tenantIdParam = searchParams.get('tenantId')?.trim();
    const effectiveTenantId = tenantIdParam || user.tenantId;

    if (tenantIdParam && effectiveTenantId !== user.tenantId) {
      const ok = await userHasAccessToTenant(user, effectiveTenantId);
      if (!ok) {
        return NextResponse.json({ error: 'Access denied to this business' }, { status: 403 });
      }
    }
    
    // Calculate pagination (only if limit is specified and > 0)
    const skip = limit > 0 ? (page - 1) * limit : 0;
    
    // Build filter object for Prisma
    const where = {
      tenantId: effectiveTenantId,
      isDeleted: false, // Exclude soft-deleted products by default
    };

    const isForeignTenant = effectiveTenantId !== user.tenantId;

    // Another business (tenant): full catalog for that tenant; session branch rules do not apply.
    if (isForeignTenant) {
      if (branchIdParam) {
        const branch = await prisma.branch.findFirst({
          where: { id: branchIdParam, tenantId: effectiveTenantId, isActive: true },
          select: { id: true }
        });
        if (branch) {
          where.AND = [
            { OR: [{ branchId: branchIdParam }, { branchId: null }] }
          ];
        }
      }
    } else if (allBranches && !branchIdParam) {
      // Tenant-wide catalog (e.g. POS): all branches in the business. Explicit branchId wins over allBranches.
      const allowed = user?.allowedBranchIds;
      if (Array.isArray(allowed) && allowed.length === 0) {
        where.AND = [...(where.AND || []), { id: { in: [] } }];
      } else if (allowed == null) {
        // Full tenant catalog — no branch filter beyond tenantId
      } else {
        where.AND = [
          ...(where.AND || []),
          { OR: [{ branchId: null }, { branchId: { in: allowed } }] }
        ];
      }
    } else {
      // Branch scoping: query param (if allowed) + session + default; restricted users cannot see all branches.
      const desiredBranchId = resolveProductListBranchId(user, branchIdParam);

      if (desiredBranchId === false) {
        where.AND = [...(where.AND || []), { id: { in: [] } }];
      } else if (desiredBranchId && typeof desiredBranchId === 'string') {
        const branch = await prisma.branch.findFirst({
          where: { id: desiredBranchId, tenantId: user.tenantId, isActive: true },
          select: { id: true }
        });
        if (branch) {
          // Branch-specific rows + global products (branchId=null) for all-branches catalog items.
          where.AND = [
            ...(where.AND || []),
            { OR: [{ branchId: desiredBranchId }, { branchId: null }] }
          ];
        }
      }
    }

    // Catalog: physical products vs billable services (same Product table)
    const catalog = (searchParams.get('catalog') || '').toLowerCase();
    if (catalog === 'products') {
      where.isService = false;
    } else if (catalog === 'services') {
      where.isService = true;
    }
    const includeUsageCounts = catalog === 'services' || searchParams.get('usageCounts') === '1';
    
    // Add search filter if provided (name, SKU, barcode; barcode matches prefix/partial via Product + ProductBarcode)
    let searchOrFallback = null; // for retry when ProductBarcode relation missing
    if (search) {
      const searchTrimmed = search.trim();
      searchOrFallback = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: searchTrimmed, mode: 'insensitive' } }
      ];
      where.OR = [
        ...searchOrFallback,
        { productBarcodes: { some: { barcode: { contains: searchTrimmed, mode: 'insensitive' } } } }
      ];
    }
    
    // Add category filter if provided
    if (category && category !== 'All') {
      if (category === 'Uncategorized') {
        where.category = null;
      } else {
        where.category = category;
      }
    }
    
    // Add location filter if provided
    if (location && location !== 'All') {
      where.location = location;
    }
    
    // Add status filter if provided (this is computed, so we'll filter after fetching)
    // Note: Status is computed based on stockLevel and reorderPoint, so we can't filter in the query
    // We'll filter it after fetching if needed
    
    // Get total count for pagination
    const totalCount = await prisma.product.count({ where });
    
    // Build sort object for Prisma
    const validSortFields = ['name', 'sku', 'category', 'price', 'stockLevel', 'createdAt'];
    const orderBy = {
      [validSortFields.includes(sort) ? sort : 'name']: 
      order === 'asc' ? 'asc' : 'desc'
    };
    
    // Fetch products (include productBarcodes only if table exists to avoid 500 before migration)
    let products;
    const countSelect = { invoiceItems: true, saleItems: true, quotationItems: true };
    const includeWithBarcodes = {
      productTaxes: {
        include: {
          taxType: {
            select: { id: true, taxRate: true, taxName: true, taxCode: true, calculationType: true, status: true }
          }
        }
      },
      productBarcodes: { select: { barcode: true } },
      ...productUnitsInclude,
      ...(includeUsageCounts ? { _count: { select: countSelect } } : {}),
    };
    const includeWithoutBarcodes = {
      productTaxes: {
        include: {
          taxType: {
            select: { id: true, taxRate: true, taxName: true, taxCode: true, calculationType: true, status: true }
          }
        }
      },
      ...productUnitsInclude,
      ...(includeUsageCounts ? { _count: { select: countSelect } } : {}),
    };
    try {
      products = await prisma.product.findMany({
        where,
        orderBy,
        ...(limit > 0 ? { skip, take: limit } : {}),
        include: includeWithBarcodes
      });
    } catch (err) {
      const msg = err?.message || '';
      if (msg.includes('ProductBarcode') || msg.includes('productBarcodes') || msg.includes('does not exist')) {
        const whereRetry = searchOrFallback ? { ...where, OR: searchOrFallback } : where;
        products = await prisma.product.findMany({
          where: whereRetry,
          orderBy,
          ...(limit > 0 ? { skip, take: limit } : {}),
          include: includeWithoutBarcodes
        });
      } else {
        throw err;
      }
    }

    // Process products to enhance with derived fields
    let processedProducts = products.map(product => {
      const usageLineCount =
        product._count != null
          ? (Number(product._count.invoiceItems) || 0) +
            (Number(product._count.saleItems) || 0) +
            (Number(product._count.quotationItems) || 0)
          : undefined;
      const { _count: _usageCount, ...productFields } = product;

      // Default values for missing fields
      const stockLevel = productFields.stockLevel || 0;
      const reorderPoint = productFields.reorderPoint || 10;
      
      // Determine product status based on stock level (services are not inventory-tracked)
      let status;
      if (productFields.isService) {
        status = 'Service';
      } else if (stockLevel === 0) {
        status = 'Out of Stock';
      } else if (stockLevel <= reorderPoint) {
        status = 'Low Stock';
      } else {
        status = 'In Stock';
      }
      
      // Compute taxRate from productTaxes relation if the field is null/0
      const computedTaxRate = productFields.taxRate || (productFields.productTaxes || [])
        .filter(pt => pt.taxType && pt.taxType.status === 'Active')
        .reduce(function(sum, pt) { return sum + (parseFloat(pt.taxType.taxRate) || 0); }, 0);
      
      // Format taxes for frontend
      const formattedTaxes = (productFields.productTaxes || [])
        .filter(function(pt) { return pt.taxType && pt.taxType.status === 'Active'; })
        .map(function(pt) {
          return {
            id: pt.taxType.id,
            taxId: pt.taxType.taxId,
            taxName: pt.taxType.taxName,
            taxCode: pt.taxType.taxCode,
            taxRate: pt.taxType.taxRate,
            calculationType: pt.taxType.calculationType
          };
        });
      
      const costPrice = roundMoney(resolveProductCostPriceForDisplay(productFields));
      const totalStockValue = productLineValue({
        ...productFields,
        stockLevel,
        cost: costPrice,
      });

      // Build barcodes array: ProductBarcode records (if loaded) + legacy Product.barcode (dedupe)
      const barcodeSet = new Set();
      if (productFields.productBarcodes && Array.isArray(productFields.productBarcodes)) {
        productFields.productBarcodes.forEach(pb => { if (pb && pb.barcode) barcodeSet.add(String(pb.barcode).trim()); });
      }
      if (productFields.barcode && String(productFields.barcode).trim()) barcodeSet.add(String(productFields.barcode).trim());
      const barcodes = Array.from(barcodeSet);

      // Return product with additional fields
      return {
        ...productFields,
        usageLineCount,
        barcodes,
        // Ensure these fields exist and have default values if null
        category: productFields.category || 'Uncategorized',
        reorderPoint: reorderPoint,
        location: productFields.location || 'Default Location',
        // Use computed taxRate from productTaxes
        taxRate: computedTaxRate,
        // Include taxes data for the frontend
        taxes: formattedTaxes,
        // Computed fields
        quantityInStock: stockLevel,
        unitPrice: roundMoney(productFields.price),
        costPrice,
        totalStockValue,
        status,
        // Ensure image fields
        image: productFields.image || `/api/placeholder/80/80`,
        imageUrl: productFields.image || `/api/placeholder/80/80`,
        lastUpdated: productFields.updatedAt.toISOString(),
      };
    });
    
    // Filter by status if provided (since status is computed)
    if (status && status !== 'All') {
      processedProducts = processedProducts.filter(product => product.status === status);
    }
    
    // Return products with pagination metadata
    const finalCount = processedProducts.length;
    return NextResponse.json({
      products: processedProducts,
      pagination: {
        page: limit > 0 ? page : 1,
        limit: limit > 0 ? limit : finalCount,
        totalCount: limit > 0 ? totalCount : finalCount,
        totalPages: limit > 0 ? Math.ceil(totalCount / limit) : 1
      }
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products. Please try again.' },
      { status: 500 }
    );
  }
}

// POST - Create a new product with all fields
export async function POST(request) {
  try {
    const perm = await requirePermission(request, 'inventory.create');
    if (perm) return perm;

    // Check for standard access
    const accessError = await requireStandardAccess(request);
    if (accessError) {
      return accessError;
    }

    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!user.tenantId) {
      return NextResponse.json(
        { error: 'User must be associated with a tenant' },
        { status: 400 }
      );
    }
    
    const body = await request.json();

    // Resolve branch for the new product (optional)
    // Ensure branchId is a string, not an object
    let desiredBranchId = body.branchId ?? null;
    if (desiredBranchId === '') {
      desiredBranchId = null;
    }
    if (desiredBranchId && typeof desiredBranchId !== 'string') {
      // If it's an object, try to extract the id
      if (desiredBranchId.id && typeof desiredBranchId.id === 'string') {
        desiredBranchId = desiredBranchId.id;
      } else {
        console.warn('Invalid branchId type, defaulting to null:', typeof desiredBranchId, desiredBranchId);
        desiredBranchId = null;
      }
    }
    
    let branchIdToSet = null;
    if (desiredBranchId && typeof desiredBranchId === 'string') {
      const branch = await prisma.branch.findFirst({
        where: { id: desiredBranchId, tenantId: user.tenantId, isActive: true },
        select: { id: true }
      });
      if (branch) branchIdToSet = desiredBranchId;
    }
    try {
      branchIdToSet = clampResolvedBranchToUserAccess(user, branchIdToSet);
    } catch (branchAccessErr) {
      return NextResponse.json(
        { error: branchAccessErr.message || 'Branch not allowed' },
        { status: 403 }
      );
    }

    // Validate required fields
    if (!body.name) {
      return NextResponse.json(
        { error: 'Product name is required' },
        { status: 400 }
      );
    }

    const productNameTrim = String(body.name || '').trim().replace(/\s+/g, ' ');
    const duplicateName = await prisma.product.findFirst({
      where: {
        tenantId: user.tenantId,
        isDeleted: false,
        name: { equals: productNameTrim, mode: 'insensitive' },
      },
      select: { id: true, name: true, sku: true },
    });
    if (duplicateName) {
      return NextResponse.json(
        {
          error: `A product with this name already exists (SKU: ${duplicateName.sku || 'n/a'}). Use a different name or edit the existing product.`,
        },
        { status: 400 }
      );
    }
    
    // Normalize provided SKU (if any) and validate uniqueness.
    // SKU uniqueness is enforced per-tenant (active products).
    let finalSku = body.sku != null ? String(body.sku).trim() : undefined;
    if (finalSku === '') finalSku = undefined;

    if (finalSku) {
      const existingActiveSku = await prisma.product.findFirst({
        where: {
          sku: finalSku,
          tenantId: user.tenantId,
          isDeleted: false,
        },
        select: { id: true, name: true, sku: true },
      });
      if (existingActiveSku) {
        return NextResponse.json(
          { error: `A product with this SKU already exists (${existingActiveSku.name || 'Unnamed'}).` },
          { status: 400 }
        );
      }
    }

    // Auto-generate SKU if not provided
    if (!finalSku || finalSku === '') {
      // Generate SKU from product name
      const cleanName = productNameTrim;
      let skuBase = cleanName
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .substring(0, 15); // Limit to 15 chars for base
      
      // Ensure SKU is not empty
      if (!skuBase || skuBase.length === 0) {
        skuBase = 'PROD';
      }
      
      // Get the highest SKU number for this tenant to generate sequential SKU
      const lastProduct = await prisma.product.findFirst({
        where: {
          tenantId: user.tenantId,
          sku: {
            startsWith: skuBase
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        select: {
          sku: true
        }
      });
      
      let skuCounter = 1;
      if (lastProduct && lastProduct.sku) {
        // Extract number from SKU like "PROD-001" or "PROD1"
        const match = lastProduct.sku.match(/(\d+)$/);
        if (match) {
          skuCounter = parseInt(match[1], 10) + 1;
        }
      }
      
      // Format SKU with zero-padded counter (e.g., PROD-001, PROD-002)
      finalSku = `${skuBase}-${String(skuCounter).padStart(3, '0')}`;
      
      // Check if generated SKU already exists and increment if needed
      let existingSku = await prisma.product.findFirst({
        where: {
          sku: finalSku,
          tenantId: user.tenantId,
          isDeleted: false
        }
      });
      
      while (existingSku && skuCounter < 9999) {
        skuCounter++;
        finalSku = `${skuBase}-${String(skuCounter).padStart(3, '0')}`;
        existingSku = await prisma.product.findFirst({
          where: {
            sku: finalSku,
            tenantId: user.tenantId,
            isDeleted: false
          }
        });
      }
    }
    
    // At this point SKU uniqueness has been checked (for provided SKUs) and
    // auto-generated SKUs are looped until a free value is found.
    
    // Check if there's a soft-deleted product with the same SKU
    const deletedProductWithSku = await prisma.product.findFirst({
      where: {
        sku: finalSku,
        tenantId: user.tenantId,
        isDeleted: true
      },
      select: {
        id: true,
        name: true,
        sku: true,
        deletedAt: true,
        deletionReason: true,
        deletedByUser: {
          select: {
            name: true,
            email: true
          }
        }
      }
    });
    
    if (deletedProductWithSku) {
      return NextResponse.json(
        { 
          error: 'A product with this SKU was previously deleted',
          conflictType: 'deleted_product',
          deletedProduct: deletedProductWithSku,
          message: 'This SKU belongs to a deleted product. You can either restore the existing product or use a different SKU.'
        },
        { status: 409 }
      );
    }
    
    // Handle image field
    let imagePath = null;
    if (body.image) {
      imagePath = typeof body.image === 'string' ? body.image : null;
    } else if (body.imageUrl) {
      imagePath = typeof body.imageUrl === 'string' ? body.imageUrl : null;
    }
    
    // If image is an object with a url property
    if (!imagePath && body.image && typeof body.image === 'object' && body.image.url) {
      imagePath = body.image.url;
    }
    
    // Get initial stock and cost BEFORE creating product (services are never stocked)
    let initialStock = parseInt(body.quantityInStock || body.stockLevel || 0);
    if (body.isService) {
      initialStock = 0;
    }
    const productCost = body.isService
      ? 0
      : roundMoney(body.costPrice ?? body.cost ?? 0);
    let normalizedAllocations = [];
    if (!body.isService) {
      try {
        normalizedAllocations = normalizeExpiryAllocations({
          expiryAllocations: body.expiryAllocations,
          isPerishable: !!body.isPerishable,
          fallbackExpiryDate: body.expiryDate,
          targetQty: initialStock,
          fallbackUnitCost: productCost,
        });
      } catch (allocErr) {
        return NextResponse.json(
          { error: allocErr?.message || 'Invalid expiryAllocations payload' },
          { status: 400 }
        );
      }
    }
    
    // Compute taxRate from selectedTaxIds if provided, otherwise use body.taxRate
    let computedTaxRate = parseFloat(body.taxRate || 0);
    if (body.selectedTaxIds && Array.isArray(body.selectedTaxIds) && body.selectedTaxIds.length > 0) {
      try {
        const taxTypes = await prisma.taxType.findMany({
          where: {
            id: { in: body.selectedTaxIds },
            tenantId: user.tenantId,
            status: 'Active',
          },
          select: { taxRate: true }
        });
        // Sum up all tax rates
        computedTaxRate = taxTypes.reduce((sum, tax) => sum + (parseFloat(tax.taxRate) || 0), 0);
        console.log(`[Product Creation] Computed taxRate from ${taxTypes.length} tax types: ${computedTaxRate}`);
      } catch (taxError) {
        console.error('[Product Creation] Error computing tax rate from selectedTaxIds:', taxError);
        // Keep using body.taxRate as fallback
      }
    }
    
    // Normalize barcodes: support both barcodes[] and legacy barcode (single); dedupe for multiple per product
    const barcodesRaw = Array.isArray(body.barcodes)
      ? body.barcodes.map(b => String(b).trim()).filter(Boolean)
      : (body.barcode && String(body.barcode).trim() ? [String(body.barcode).trim()] : []);
    const barcodesInput = [...new Set(barcodesRaw)];

    // Check barcode uniqueness (one barcode per product in tenant)
    if (barcodesInput.length > 0) {
      const existing = await prisma.productBarcode.findMany({
        where: { tenantId: user.tenantId, barcode: { in: barcodesInput } },
        select: { barcode: true }
      });
      if (existing.length > 0) {
        return NextResponse.json(
          { error: `Barcode(s) already in use: ${existing.map(e => e.barcode).join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Create the product with all available fields in database
    // IMPORTANT: Set stockLevel to 0 initially if we'll create a FIFO batch
    // createFifoBatch will increment it, so we don't want to double-count
    const productData = {
      name: body.name,
      sku: finalSku,
      description: body.description || null,
      category: body.category || 'Uncategorized',
      stockLevel: body.isService ? 0 : (initialStock > 0 && productCost > 0) ? 0 : initialStock, // Set to 0 if FIFO batch will be created
      reorderPoint: body.isService ? null : parseInt(body.reorderPoint || 10),
      location: body.location || 'Default Location',
      price: roundMoney(body.unitPrice ?? body.price ?? 0),
      cost: productCost,
      taxRate: computedTaxRate,
      image: imagePath,
      isService: !!body.isService,
      isPerishable: !!body.isPerishable,
      batchNumber:
        body.batchNumber !== undefined && body.batchNumber !== null && String(body.batchNumber).trim() !== ''
          ? String(body.batchNumber).trim()
          : null,
      supplier:
        body.supplier !== undefined && body.supplier !== null && String(body.supplier).trim() !== ''
          ? String(body.supplier).trim()
          : null,
      discountAmount:
        body.discountAmount !== undefined && body.discountAmount !== null && body.discountAmount !== ''
          ? roundMoney(body.discountAmount)
          : null,
      weight:
        body.weight !== undefined && body.weight !== null && body.weight !== ''
          ? parseFloat(body.weight)
          : null,
      dimensions:
        body.dimensions !== undefined && body.dimensions !== null && String(body.dimensions).trim() !== ''
          ? String(body.dimensions).trim()
          : null,
      tags: Array.isArray(body.tags) ? body.tags.map((tag) => String(tag).trim()).filter(Boolean) : [],
      expiryDate:
        body.isPerishable && body.expiryDate
          ? new Date(body.expiryDate)
          : null,
      barcode: barcodesInput[0] || null, // legacy single field
      tenant: {
        connect: {
          id: user.tenantId
        }
      }
    };

    if (body.isService) {
      const bt = String(body.serviceBillingType || body.billingType || 'fixed').toLowerCase();
      if (['fixed', 'hourly', 'daily'].includes(bt)) {
        productData.serviceBillingType = bt;
      }
      const { resolveDefaultRevenueAccountId } = await import('@/lib/defaultRevenueAccount');
      const revenueId = body.incomeAccountId
        ? String(body.incomeAccountId)
        : await resolveDefaultRevenueAccountId(prisma, user.tenantId);
      if (revenueId) {
        productData.incomeAccountId = revenueId;
      }
      if (body.serviceDefaultQty !== undefined && body.serviceDefaultQty !== null && body.serviceDefaultQty !== '') {
        const q = parseFloat(body.serviceDefaultQty);
        if (!Number.isNaN(q) && q >= 0) {
          productData.serviceDefaultQty = q;
        }
      }
    }

    // Add branch relation if branchId is set
    if (branchIdToSet) {
      productData.branch = {
        connect: {
          id: branchIdToSet
        }
      };
    }

    /** Flexible units: validate & merge configs before creating Product (avoids orphan rows without ProductUnit). */
    let preparedProductUnitRows = null;
    if (body.unitManagementEnabled && Array.isArray(body.selectedUnits) && body.selectedUnits.length > 0) {
      preparedProductUnitRows = ensureOneDefaultUnit(
        buildProductUnitPayloadRows(body),
        body.selectedUnits
      );
      if (preparedProductUnitRows.length === 0) {
        return NextResponse.json(
          {
            error:
              'Flexible units: choose valid catalog units (e.g. kg, L). Placeholder custom IDs cannot be saved until those units exist in your catalog.',
          },
          { status: 400 }
        );
      }
    }

    const product = await prisma.product.create({
      data: productData
    });

    // Create ProductBarcode records for each barcode (multiple barcodes per product)
    if (barcodesInput.length > 0) {
      try {
        await prisma.productBarcode.createMany({
          data: barcodesInput.map(barcode => ({
            productId: product.id,
            barcode,
            tenantId: user.tenantId
          }))
        });
      } catch (barcodeErr) {
        console.warn('ProductBarcode createMany (non-fatal):', barcodeErr?.message);
      }
    }

    if (preparedProductUnitRows?.length > 0) {
      const maxValue = 999999999.999999;
      const unitIds = preparedProductUnitRows.map((r) => r.unitId);
      const existingUnits = await prisma.unit.findMany({
        where: { id: { in: unitIds } },
        select: { id: true },
      });
      const okIds = new Set(existingUnits.map((u) => u.id));
      const missing = unitIds.filter((id) => !okIds.has(id));
      if (missing.length > 0) {
        console.error('ProductUnit create: missing Unit ids', missing);
        throw new Error(`Units not found: ${missing.join(', ')}`);
      }

      await prisma.productUnit.createMany({
        data: preparedProductUnitRows.map((r) => ({
          productId: product.id,
          unitId: r.unitId,
          isDefault: Boolean(r.isDefault),
          unitPrice: Math.max(0, Math.min(Number(r.unitPrice) || 0, maxValue)),
          costPrice: Math.max(0, Math.min(Number(r.costPrice) || 0, maxValue)),
          quantityInStock: Math.max(0, Math.min(Number(r.quantityInStock) || 0, maxValue)),
          reorderPoint: Math.max(0, Math.min(Number(r.reorderPoint) || 0, maxValue)),
          isActive: true,
        })),
      });
    }
    
    // Create FIFO batch if product has initial stock
    // NOTE: Product was created with stockLevel = 0 if initialStock > 0 and productCost > 0
    // If productCost is 0, product was created with stockLevel = initialStock, so we need to handle that
    if (!body.isService && initialStock > 0) {
      try {
        // Use product cost, or default to 0 if not provided (FIFO will still work, just with 0 cost)
        const costForFifo = productCost > 0 ? productCost : 0;
        
        // If product was created with stockLevel = initialStock (because cost was 0), 
        // we need to reset it to 0 before creating the FIFO batch
        if (productCost === 0 && product.stockLevel !== 0) {
          await prisma.product.update({
            where: { id: product.id },
            data: { stockLevel: 0 }
          });
          product.stockLevel = 0;
          console.log(`[Product Creation] Reset stockLevel to 0 before creating FIFO batch (cost was 0)`);
        }
        
        // Generate deterministic sourceId for product creation
        const creationSourceId = `product-creation-${product.id}-${Date.now()}`;
        
        const allocationRows =
          normalizedAllocations.length > 0
            ? normalizedAllocations
            : [{ qty: initialStock, unitCost: costForFifo, expiryDate: body.expiryDate || null }];

        for (let i = 0; i < allocationRows.length; i++) {
          const row = allocationRows[i];
          await createFifoBatch({
            tenantId: user.tenantId,
            branchId: branchIdToSet,
            productId: product.id,
            quantityPurchased: row.qty,
            unitCost: row.unitCost,
            purchaseDate: new Date(),
            sourceType: 'DirectCreation',
            sourceId: `${creationSourceId}-alloc-${i + 1}`,
            expiryDate: row.expiryDate || null,
            tx: prisma,
          });
        }
        console.log(`[Product Creation] Created ${allocationRows.length} FIFO allocation batch(es) for product ${product.id}`);
        
        // Refresh product to get updated stockLevel from createFifoBatch
        const updatedProduct = await prisma.product.findUnique({
          where: { id: product.id },
          select: { stockLevel: true }
        });
        if (updatedProduct) {
          product.stockLevel = updatedProduct.stockLevel;
          console.log(`[Product Creation] Product ${product.id} stockLevel after FIFO batch: ${updatedProduct.stockLevel}`);
        }
      } catch (fifoError) {
        console.error('[Product Creation] Error creating FIFO batch for new product:', fifoError);
        // If FIFO fails, manually set stockLevel as fallback
        if (initialStock > 0) {
          await prisma.product.update({
            where: { id: product.id },
            data: { stockLevel: initialStock }
          });
          product.stockLevel = initialStock;
          console.log(`[Product Creation] Fallback: Set stockLevel to ${initialStock} manually`);
        }
      }
    }
    
    // Create an audit log entry
    await prisma.auditLog.create({
      data: {
        action: 'PRODUCT_CREATED',
        entityType: 'PRODUCT',
        entityId: product.id,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          name: product.name,
          sku: product.sku,
          category: product.category,
          stockLevel: product.stockLevel,
          image: product.image
        })
      }
    });
    
    // Determine product status
    let status;
    if (product.isService) {
      status = 'Service';
    } else if (product.stockLevel === 0) {
      status = 'Out of Stock';
    } else if (product.stockLevel <= (product.reorderPoint || 10)) {
      status = 'Low Stock';
    } else {
      status = 'In Stock';
    }
    
    // Return the created product with some additional fields
    return NextResponse.json(
      { 
        message: 'Product created successfully',
        product: {
          ...product,
          quantityInStock: product.stockLevel,
          unitPrice: product.price,
          costPrice: product.cost || 0,
          taxRate: product.taxRate || 0,
          status,
          imageUrl: product.image || `/api/placeholder/80/80`,
          lastUpdated: product.updatedAt.toISOString(),
        }
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating product:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      meta: error.meta
    });
    
    // Return more detailed error information
    const errorMessage = error.message || 'Failed to create product. Please try again.';
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    return NextResponse.json(
      { 
        error: errorMessage,
        ...(isDevelopment && {
          details: error.message,
          code: error.code,
          meta: error.meta
        })
      },
      { status: 500 }
    );
  }
}