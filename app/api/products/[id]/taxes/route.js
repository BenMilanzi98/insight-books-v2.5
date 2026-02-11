import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, hasPermission } from '@/lib/auth';

/**
 * GET /api/products/[id]/taxes
 * Get all taxes assigned to a product
 */
export async function GET(request, { params }) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const resolvedParams = await params;
    const { id } = resolvedParams;

    // Verify product belongs to tenant
    const product = await prisma.product.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
      },
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Get assigned taxes (handle case where table doesn't exist yet)
    try {
      const productTaxes = await prisma.productTax.findMany({
        where: {
          productId: id,
        },
        include: {
          taxType: {
            select: {
              id: true,
              taxId: true,
              taxName: true,
              taxCode: true,
              taxRate: true,
              calculationType: true,
              status: true,
              accountId: true
            }
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      // Transform to match expected format
      const taxes = productTaxes.map(pt => ({
        id: pt.taxType.id,
        taxId: pt.taxType.taxId,
        taxName: pt.taxType.taxName,
        taxCode: pt.taxType.taxCode,
        taxRate: pt.taxType.taxRate,
        calculationType: pt.taxType.calculationType,
        status: pt.taxType.status
      }));

      return NextResponse.json({ taxes });
    } catch (error) {
      // If table doesn't exist, return empty array
      if (error.message?.includes('does not exist') || error.message?.includes('Unknown model')) {
        return NextResponse.json([]);
      }
      throw error;
    }
  } catch (error) {
    console.error('Error fetching product taxes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product taxes', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/products/[id]/taxes
 * Assign taxes to a product
 * Requires Admin or Manager permissions
 */
export async function POST(request, { params }) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check permissions - only Admin or Manager can assign taxes
    const canManageInventory = hasPermission(user, 'inventory.update');
    const roleName = user.role?.name || '';
    const isAdmin = roleName === 'Admin' || roleName === 'MASTER_ADMIN';
    const isManager = roleName === 'Manager';
    
    if (!canManageInventory && !isAdmin && !isManager) {
      return NextResponse.json(
        { error: 'Permission denied. Only Admin or Manager can assign taxes to products.' },
        { status: 403 }
      );
    }

    const resolvedParams = await params;
    const { id } = resolvedParams;
    const body = await request.json();
    const { taxTypeIds } = body; // Array of tax type IDs

    if (!Array.isArray(taxTypeIds)) {
      return NextResponse.json(
        { error: 'taxTypeIds must be an array' },
        { status: 400 }
      );
    }

    // Verify product belongs to tenant
    const product = await prisma.product.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
      },
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Verify all tax types belong to tenant and are active
    const taxTypes = await prisma.taxType.findMany({
      where: {
        id: { in: taxTypeIds },
        tenantId: user.tenantId,
        status: 'Active',
      },
    });

    if (taxTypes.length !== taxTypeIds.length) {
      return NextResponse.json(
        { error: 'One or more tax types not found or inactive' },
        { status: 400 }
      );
    }

    // Use transaction to replace all taxes and update product taxRate
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Delete existing taxes
        await tx.productTax.deleteMany({
          where: {
            productId: id,
          },
        });

        // Create new tax assignments
        if (taxTypeIds.length > 0) {
          await tx.productTax.createMany({
            data: taxTypeIds.map((taxTypeId) => ({
              productId: id,
              taxTypeId,
            })),
          });
        }

        // Compute effective taxRate from selected tax types (sum of all tax rates)
        const totalTaxRate = taxTypes.reduce((sum, tax) => sum + (parseFloat(tax.taxRate) || 0), 0);
        
        // Update the product's taxRate field with the computed total
        await tx.product.update({
          where: { id },
          data: { taxRate: totalTaxRate },
        });

        // Return updated product taxes
        return await tx.productTax.findMany({
          where: {
            productId: id,
          },
          include: {
            taxType: {
              include: {
                account: {
                  select: {
                    id: true,
                    accountCode: true,
                    accountName: true,
                    accountType: true,
                  },
                },
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        });
      });

      return NextResponse.json(result, { status: 201 });
    } catch (error) {
      // If table doesn't exist, return error with helpful message
      if (error.message?.includes('does not exist') || error.message?.includes('Unknown model')) {
        return NextResponse.json(
          { error: 'Database migration required. Please run: npx prisma migrate dev --name add_product_tax_management' },
          { status: 503 }
        );
      }
      throw error;
    }
  } catch (error) {
    console.error('Error assigning product taxes:', error);
    return NextResponse.json(
      { error: 'Failed to assign product taxes', details: error.message },
      { status: 500 }
    );
  }
}

