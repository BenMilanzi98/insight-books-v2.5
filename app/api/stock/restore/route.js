import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

// POST - Restore deleted products (single or batch)
export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { productIds } = body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json(
        { error: 'Product IDs array is required' },
        { status: 400 }
      );
    }

    // Validate all products exist, are deleted, and belong to user's tenant
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        tenantId: user.tenantId,
        isDeleted: true
      },
      select: {
        id: true,
        name: true,
        sku: true,
        deletedAt: true,
        deletionReason: true
      }
    });

    if (products.length === 0) {
      return NextResponse.json(
        { error: 'No deleted products found with the provided IDs' },
        { status: 404 }
      );
    }

    if (products.length !== productIds.length) {
      const foundIds = products.map(p => p.id);
      const missingIds = productIds.filter(id => !foundIds.includes(id));
      return NextResponse.json(
        { 
          error: 'Some products not found or not deleted',
          missingIds,
          foundCount: products.length
        },
        { status: 404 }
      );
    }

    // Perform batch restore in transaction
    const result = await prisma.$transaction(async (tx) => {
      const restoredProducts = await tx.product.updateMany({
        where: {
          id: { in: productIds },
          tenantId: user.tenantId,
          isDeleted: true
        },
        data: {
          isDeleted: false,
          deletedAt: null,
          deletedBy: null,
          deletionReason: null
        }
      });

      // Create audit logs for each restored product
      const auditLogs = products.map(product => ({
        action: 'PRODUCT_RESTORED',
        entityType: 'PRODUCT',
        entityId: product.id,
        userId: user.id,
        tenantId: user.tenantId,
        timestamp: new Date(),
        details: JSON.stringify({
          productName: product.name,
          productSku: product.sku,
          originalDeletionDate: product.deletedAt,
          originalDeletionReason: product.deletionReason,
          restoredBy: user.name || user.email,
          batchSize: productIds.length
        })
      }));

      await tx.auditLog.createMany({
        data: auditLogs
      });

      return { restoredCount: restoredProducts.count };
    });

    return NextResponse.json({
      success: true,
      restoredCount: result.restoredCount,
      restoredProducts: products.map(p => ({
        id: p.id,
        name: p.name,
        sku: p.sku
      })),
      message: `Successfully restored ${result.restoredCount} products`
    });

  } catch (error) {
    console.error('Error in restore:', error);
    return NextResponse.json(
      { error: 'Failed to restore products. Please try again.' },
      { status: 500 }
    );
  }
}

// GET - Get deleted products for restore interface
export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sortBy') || 'deletedAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const skip = (page - 1) * limit;

    // Build where clause
    const where = {
      tenantId: user.tenantId,
      isDeleted: true,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
          { category: { contains: search, mode: 'insensitive' } }
        ]
      })
    };

    // Get deleted products with pagination
    const [deletedProducts, totalCount] = await Promise.all([
      prisma.product.findMany({
        where,
        select: {
          id: true,
          name: true,
          sku: true,
          category: true,
          location: true,
          price: true,
          stockLevel: true,
          image: true,
          deletedAt: true,
          deletionReason: true,
          deletedByUser: {
            select: {
              name: true,
              email: true
            }
          }
        },
        orderBy: {
          [sortBy]: sortOrder
        },
        skip,
        take: limit
      }),
      prisma.product.count({ where })
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      products: deletedProducts,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: totalCount,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Error fetching deleted products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch deleted products' },
      { status: 500 }
    );
  }
}
