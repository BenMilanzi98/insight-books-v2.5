// app/api/inventory/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';

// GET - Fetch products with all fields
export async function GET(request) {
  try {
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
    
    // Calculate pagination (only if limit is specified and > 0)
    const skip = limit > 0 ? (page - 1) * limit : 0;
    
    // Build filter object for Prisma
    const where = {
      tenantId: user.tenantId,
      isDeleted: false, // Exclude soft-deleted products by default
    };
    
    // Branch scoping: Priority: query param > session branch > user default branch
    const desiredBranchId = branchIdParam || user.currentBranchId || user.defaultBranchId || null;
    if (desiredBranchId) {
      const branch = await prisma.branch.findFirst({
        where: { id: desiredBranchId, tenantId: user.tenantId, isActive: true },
        select: { id: true }
      });
      if (branch) {
        where.branchId = desiredBranchId;
      }
    }
    
    // Add search filter if provided
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } }
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
    
    // Fetch products with all fields
    const products = await prisma.product.findMany({
      where,
      orderBy,
      ...(limit > 0 ? { skip, take: limit } : {}) // Only apply pagination if limit > 0
    });
    
    // Process products to enhance with derived fields
    let processedProducts = products.map(product => {
      // Default values for missing fields
      const stockLevel = product.stockLevel || 0;
      const reorderPoint = product.reorderPoint || 10;
      
      // Determine product status based on stock level
      let status;
      if (stockLevel === 0) {
        status = 'Out of Stock';
      } else if (stockLevel <= reorderPoint) {
        status = 'Low Stock';
      } else {
        status = 'In Stock';
      }
      
      // Return product with additional fields
      return {
        ...product,
        // Ensure these fields exist and have default values if null
        category: product.category || 'Uncategorized',
        reorderPoint: reorderPoint,
        location: product.location || 'Default Location',
        // Computed fields
        quantityInStock: stockLevel,
        unitPrice: product.price,
        costPrice: product.cost || 0,
        status,
        // Ensure image fields
        image: product.image || `/api/placeholder/80/80`,
        imageUrl: product.image || `/api/placeholder/80/80`,
        lastUpdated: product.updatedAt.toISOString(),
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
    
    const body = await request.json();

    // Resolve branch for the new product (optional)
    const desiredBranchId = body.branchId || user.defaultBranchId || null;
    let branchIdToSet = null;
    if (desiredBranchId) {
      const branch = await prisma.branch.findFirst({
        where: { id: desiredBranchId, tenantId: user.tenantId, isActive: true },
        select: { id: true }
      });
      if (branch) branchIdToSet = desiredBranchId;
    }
    
    // Validate required fields
    if (!body.name || !body.sku) {
      return NextResponse.json(
        { error: 'Product name and SKU are required' },
        { status: 400 }
      );
    }
    
    // Check if SKU is unique for this tenant (active products only)
    const existingActiveSku = await prisma.product.findFirst({
      where: {
        sku: body.sku,
        tenantId: user.tenantId,
        isDeleted: false
      }
    });
    
    if (existingActiveSku) {
      return NextResponse.json(
        { error: 'A product with this SKU already exists' },
        { status: 400 }
      );
    }
    
    // Check if there's a soft-deleted product with the same SKU
    const deletedProductWithSku = await prisma.product.findFirst({
      where: {
        sku: body.sku,
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
    
    // Create the product with all available fields in database
    const product = await prisma.product.create({
      data: {
        name: body.name,
        sku: body.sku,
        description: body.description || null,
        category: body.category || 'Uncategorized',
        stockLevel: parseInt(body.quantityInStock || body.stockLevel || 0),
        reorderPoint: parseInt(body.reorderPoint || 10),
        location: body.location || 'Default Location',
        price: parseFloat(body.unitPrice || body.price || 0),
        cost: parseFloat(body.costPrice || body.cost || 0),
        image: imagePath,
        isService: !!body.isService,
        branchId: branchIdToSet,
        tenant: {
          connect: {
            id: user.tenantId
          }
        }
      }
    });

    // Handle unit management if enabled
    if (body.unitManagementEnabled && body.selectedUnits && body.selectedUnits.length > 0) {
      const productUnits = [];
      
      for (const unit of body.selectedUnits) {
        const config = body.unitConfigurations[unit.id];
        if (config) {
          // Validate and cap numeric values to prevent database overflow
          const maxValue = 999999999.999999; // Max value for precision 15, scale 6
          const quantityInStock = Math.min(parseFloat(config.quantityInStock || 0), maxValue);
          const reorderPoint = Math.min(parseFloat(config.reorderPoint || 0), maxValue);
          const unitPrice = Math.min(parseFloat(config.unitPrice || 0), maxValue);
          const costPrice = Math.min(parseFloat(config.costPrice || 0), maxValue);
          
          productUnits.push({
            productId: product.id,
            unitId: unit.id,
            isDefault: config.isDefault || false,
            unitPrice: unitPrice,
            costPrice: costPrice,
            quantityInStock: quantityInStock,
            reorderPoint: reorderPoint,
            isActive: true
          });
        }
      }
      
      if (productUnits.length > 0) {
        await prisma.productUnit.createMany({
          data: productUnits
        });
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
    if (product.stockLevel === 0) {
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
          status,
          imageUrl: product.image || `/api/placeholder/80/80`,
          lastUpdated: product.updatedAt.toISOString(),
        }
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      { error: 'Failed to create product. Please try again.' },
      { status: 500 }
    );
  }
}