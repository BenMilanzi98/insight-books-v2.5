import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, hasPermission } from '@/lib/auth';

/**
 * POST /api/products/bulk-taxes
 * Apply taxes to multiple products in bulk
 * Requires Admin or Manager permissions
 */
export async function POST(request) {
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

    const body = await request.json();
    const { taxTypeIds, productIds, applyToAll = false } = body;

    // Validate taxTypeIds
    if (!Array.isArray(taxTypeIds) || taxTypeIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one tax type must be selected' },
        { status: 400 }
      );
    }

    // Validate productIds (if not applying to all)
    if (!applyToAll && (!Array.isArray(productIds) || productIds.length === 0)) {
      return NextResponse.json(
        { error: 'At least one product must be selected or applyToAll must be true' },
        { status: 400 }
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

    // Get products to update
    let productsToUpdate = [];
    if (applyToAll) {
      // Get all products for the tenant
      productsToUpdate = await prisma.product.findMany({
        where: {
          tenantId: user.tenantId,
          isDeleted: false,
        },
        select: {
          id: true,
        },
      });
    } else {
      // Verify all products belong to tenant
      productsToUpdate = await prisma.product.findMany({
        where: {
          id: { in: productIds },
          tenantId: user.tenantId,
          isDeleted: false,
        },
        select: {
          id: true,
        },
      });

      if (productsToUpdate.length !== productIds.length) {
        return NextResponse.json(
          { error: 'One or more products not found or do not belong to your tenant' },
          { status: 400 }
        );
      }
    }

    if (productsToUpdate.length === 0) {
      return NextResponse.json(
        { error: 'No products found to update' },
        { status: 400 }
      );
    }

    // Apply taxes to all products in a transaction
    try {
      const result = await prisma.$transaction(async (tx) => {
        const results = {
          success: 0,
          failed: 0,
          errors: [],
        };

        for (const product of productsToUpdate) {
          try {
            // Delete existing taxes for this product
            await tx.productTax.deleteMany({
              where: {
                productId: product.id,
              },
            });

            // Create new tax assignments
            if (taxTypeIds.length > 0) {
              await tx.productTax.createMany({
                data: taxTypeIds.map((taxTypeId) => ({
                  productId: product.id,
                  taxTypeId,
                })),
              });
            }

            results.success++;
          } catch (error) {
            console.error(`Error applying taxes to product ${product.id}:`, error);
            results.failed++;
            results.errors.push({
              productId: product.id,
              error: error.message,
            });
          }
        }

        return results;
      });

      return NextResponse.json({
        message: `Taxes applied to ${result.success} product(s)`,
        success: result.success,
        failed: result.failed,
        errors: result.errors,
        totalProducts: productsToUpdate.length,
      });
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
    console.error('Error applying bulk taxes:', error);
    return NextResponse.json(
      { error: 'Failed to apply taxes to products', details: error.message },
      { status: 500 }
    );
  }
}

