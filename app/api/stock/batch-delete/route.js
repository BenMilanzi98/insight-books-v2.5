import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

// POST - Batch soft delete products
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
    const { productIds, reason } = body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json(
        { error: 'Product IDs array is required' },
        { status: 400 }
      );
    }

    // Validate all products exist and belong to user's tenant
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        tenantId: user.tenantId,
        isDeleted: false
      },
      select: {
        id: true,
        name: true,
        sku: true
      }
    });

    if (products.length !== productIds.length) {
      const foundIds = products.map(p => p.id);
      const missingIds = productIds.filter(id => !foundIds.includes(id));
      return NextResponse.json(
        { 
          error: 'Some products not found or already deleted',
          missingIds
        },
        { status: 404 }
      );
    }

    // Check if any products are used in invoices, sales, or quotations
    const usageChecks = await Promise.all([
      // Check invoice items
      prisma.invoiceItem.findMany({
        where: { productId: { in: productIds } },
        select: { productId: true, invoice: { select: { invoiceNumber: true } } },
        take: 5
      }),
      // Check sale items
      prisma.saleItem.findMany({
        where: { productId: { in: productIds } },
        select: { productId: true, sale: { select: { saleNumber: true } } },
        take: 5
      }),
      // Check quotation items
      prisma.quotationItem.findMany({
        where: { productId: { in: productIds } },
        select: { productId: true, quotation: { select: { quotationNumber: true } } },
        take: 5
      })
    ]);

    const [invoiceItems, saleItems, quotationItems] = usageChecks;
    const usedProducts = [];

    // Collect usage information
    if (invoiceItems.length > 0) {
      usedProducts.push({
        type: 'invoices',
        count: invoiceItems.length,
        examples: invoiceItems.map(item => item.invoice.invoiceNumber)
      });
    }

    if (saleItems.length > 0) {
      usedProducts.push({
        type: 'sales',
        count: saleItems.length,
        examples: saleItems.map(item => item.sale.saleNumber)
      });
    }

    if (quotationItems.length > 0) {
      usedProducts.push({
        type: 'quotations',
        count: quotationItems.length,
        examples: quotationItems.map(item => item.quotation.quotationNumber)
      });
    }

    // If products are in use, return warning (but still allow deletion)
    if (usedProducts.length > 0) {
      console.warn(`Products in use being deleted: ${JSON.stringify(usedProducts)}`);
    }

    // Perform batch soft deletion in transaction
    const result = await prisma.$transaction(async (tx) => {
      const deletedProducts = await tx.product.updateMany({
        where: {
          id: { in: productIds },
          tenantId: user.tenantId,
          isDeleted: false
        },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: user.id,
          deletionReason: reason || 'Batch deletion'
        }
      });

      // Create audit logs for each deleted product
      const auditLogs = products.map(product => ({
        action: 'PRODUCT_BATCH_DELETED',
        entityType: 'PRODUCT',
        entityId: product.id,
        userId: user.id,
        tenantId: user.tenantId,
        timestamp: new Date(),
        details: JSON.stringify({
          productName: product.name,
          productSku: product.sku,
          reason: reason || 'Batch deletion',
          batchSize: productIds.length
        })
      }));

      await tx.auditLog.createMany({
        data: auditLogs
      });

      return { deletedCount: deletedProducts.count };
    });

    return NextResponse.json({
      success: true,
      deletedCount: result.deletedCount,
      usageWarnings: usedProducts.length > 0 ? usedProducts : null,
      message: `Successfully deleted ${result.deletedCount} products`
    });

  } catch (error) {
    console.error('Error in batch delete:', error);
    return NextResponse.json(
      { error: 'Failed to delete products. Please try again.' },
      { status: 500 }
    );
  }
}
