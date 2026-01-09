// app/api/sales/clear-history/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, hasPermission } from '@/lib/auth';

export async function DELETE(request) {
  try {
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if user is admin (MASTER_ADMIN) or has sales.delete permission
    const isMasterAdmin = user.role?.name === 'MASTER_ADMIN';
    const hasDeletePermission = hasPermission(user, 'sales.delete');
    
    if (!isMasterAdmin && !hasDeletePermission) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Only admin users can clear sales history.' },
        { status: 403 }
      );
    }

    // Get all sales for this tenant
    const sales = await prisma.sale.findMany({
      where: {
        tenantId: user.tenantId
      },
      select: {
        id: true,
        saleNumber: true
      }
    });

    if (sales.length === 0) {
      return NextResponse.json({
        message: 'No sales history to clear.',
        deletedCount: 0
      });
    }

    const saleIds = sales.map(sale => sale.id);

    // Delete in a transaction to ensure data consistency
    await prisma.$transaction(async (tx) => {
      // Try to set saleId to null in payments first to avoid foreign key constraint issues
      // This keeps the payment records but removes the link to the sale
      try {
        const paymentsToUpdate = await tx.payment.findMany({
          where: {
            saleId: {
              in: saleIds
            }
          },
          select: {
            id: true,
            saleId: true
          }
        });

        if (paymentsToUpdate.length > 0) {
          console.log(`Found ${paymentsToUpdate.length} payments to update`);
          // Update payments one by one to handle potential constraint issues
          for (const payment of paymentsToUpdate) {
            try {
              await tx.payment.update({
                where: { id: payment.id },
                data: { saleId: null }
              });
            } catch (updateError) {
              console.log(`Error updating payment ${payment.id}:`, updateError.message);
              // If we can't set to null, the foreign key might be RESTRICT
              // In that case, we'll try to delete sales anyway and see what happens
            }
          }
        }
      } catch (paymentError) {
        console.log('Error finding/updating payments:', paymentError.message);
        console.log('Payment error details:', paymentError);
        // Continue even if payment update fails - try to delete sales anyway
      }

      // Delete the sales
      // Note: SaleItem will be automatically deleted due to onDelete: Cascade
      // All other records (payments, transactions, journal entries, audit logs) will be kept
      console.log(`Attempting to delete ${saleIds.length} sales`);
      const deletedSales = await tx.sale.deleteMany({
        where: {
          tenantId: user.tenantId
        }
      });

      console.log(`Successfully deleted ${deletedSales.count} sales`);

      // Create an audit log entry for the bulk deletion
      try {
        await tx.auditLog.create({
          data: {
            action: 'SALES_HISTORY_CLEARED',
            entityType: 'SALE',
            entityId: null,
            userId: user.id,
            tenantId: user.tenantId,
            details: JSON.stringify({
              deletedCount: deletedSales.count,
              saleNumbers: sales.map(s => s.saleNumber).slice(0, 10), // Log first 10 for reference
              clearedBy: user.name || user.email
            })
          }
        });
      } catch (auditError) {
        console.log('Error creating audit log (non-critical):', auditError.message);
        // Don't fail the transaction if audit log creation fails
      }
    }, {
      timeout: 60000, // 60 second timeout for large deletions
    });

    return NextResponse.json({
      message: `Successfully cleared ${sales.length} sales records.`,
      deletedCount: sales.length
    });

  } catch (error) {
    console.error('Error clearing sales history:', error);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    return NextResponse.json(
      { 
        error: 'Failed to clear sales history. Please try again.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

