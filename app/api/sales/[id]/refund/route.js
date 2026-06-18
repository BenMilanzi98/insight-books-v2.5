// app/api/sales/[id]/refund/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requirePermission } from '@/lib/auth';
import { reverseSaleGlForRefundInTx } from '@/lib/transactionReversalService';

export async function POST(request, { params }) {
  try {
    const { id: saleId } = await params;
    
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const perm = await requirePermission(request, 'sales.refund');
    if (perm) return perm;
    
    // Parse request body
    const body = await request.json();
    const reason = body.reason;
    const refundMethod = body.refundMethod || null;
    
    if (!reason || reason.trim() === '') {
      return NextResponse.json(
        { error: 'Refund reason is required' },
        { status: 400 }
      );
    }
    if (reason.trim().length < 10) {
      return NextResponse.json(
        { error: 'Refund reason must be at least 10 characters (audit and GL reversal requirement).' },
        { status: 400 }
      );
    }

    // Start transaction to refund sale and restore inventory
    const result = await prisma.$transaction(async (tx) => {
      // Get sale with items
      const sale = await tx.sale.findUnique({
        where: { id: saleId },
        include: {
          items: {
            include: {
              product: true
            }
          }
        }
      });

      if (!sale) {
        throw new Error('Sale not found');
      }

      if (sale.tenantId !== user.tenantId) {
        throw new Error('Unauthorized access to sale');
      }

      if (sale.status !== 'completed') {
        throw new Error('Only completed sales can be refunded');
      }

      // Try to create state history record if table exists
      try {
        await tx.saleStateHistory.create({
          data: {
            saleId: sale.id,
            fromStatus: sale.status,
            toStatus: 'refunded',
            reason: reason,
            changedById: user.id
          }
        });
      } catch (historyError) {
        console.log('SaleStateHistory table not available, skipping history record');
        // Continue without failing the transaction
      }

      const refundNote = refundMethod
        ? `REFUNDED: ${reason} | Method: ${refundMethod}`
        : `REFUNDED: ${reason}`;
      const updateData = {
        status: 'refunded',
        notes: sale.notes ? `${sale.notes}\n\n${refundNote}` : refundNote
      };

      // Try to add enhanced refund fields if schema supports them
      try {
        // Test if enhanced fields exist by attempting a dry run
        await tx.sale.findFirst({
          where: { id: saleId },
          select: { refundReason: true, refundedAt: true, refundedById: true }
        });
        
        // If no error, the fields exist, so add them
        updateData.refundReason = reason;
        updateData.refundedAt = new Date();
        updateData.refundedById = user.id;
      } catch (schemaError) {
        console.log('Enhanced refund fields not available in schema, using basic fields only');
        // Continue with basic fields only
      }

      // Update the sale
      const updatedSale = await tx.sale.update({
        where: { id: saleId },
        data: updateData
      });

      // Restore inventory for non-custom products
      for (const item of sale.items) {
        // Skip custom products (they don't affect inventory)
        if (item.isCustom || !item.productId) {
          continue;
        }

        try {
          // Restore product stock
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stockLevel: {
                increment: item.quantity
              }
            }
          });

          // Try to create inventory adjustment record if table exists
          try {
            await tx.inventoryAdjustment.create({
              data: {
                productId: item.productId,
                quantity: item.quantity, // Positive for restocking
                reason: 'sale_refund',
                referenceId: sale.id,
                notes: `Refunded sale ${sale.saleNumber}: ${reason}`,
                createdById: user.id,
                tenantId: user.tenantId
              }
            });
          } catch (adjustmentError) {
            console.log('InventoryAdjustment table not available, creating inventory transaction instead');

            // Create basic inventory transaction for audit trail
          await tx.inventoryTransaction.create({
            data: {
              productId: item.productId,
              type: 'refund_restoration',
              quantity: item.quantity, // Positive for restoration
                notes: `Refund restoration for sale ${sale.saleNumber}: ${reason}`,
              userId: user.id,
              tenantId: user.tenantId
            }
          });
          }
        } catch (inventoryError) {
          console.error(`Error restoring inventory for product ${item.productId}:`, inventoryError);
          // Continue with other products even if one fails
        }
      }

      // 🔐 Handle payment reversal for refunded sale
      try {
        // Find the original payment for this sale
        const originalPayment = await tx.payment.findFirst({
          where: {
            saleId: sale.id,
            type: 'sale',
            status: 'Completed'
          }
        });

        if (originalPayment) {
          // Create a refund payment record
          const refundPayment = await tx.payment.create({
            data: {
              saleId: sale.id,
              amount: -originalPayment.amount, // Negative amount for refund
              paymentDate: new Date(),
              paymentMethod: originalPayment.paymentMethod,
              reference: `Refund for sale ${sale.saleNumber}`,
              notes: `Payment refund due to: ${reason}`,
              status: 'Completed',
              tenantId: user.tenantId,
              type: 'sale_refund',
              sourceAccount: originalPayment.sourceAccount
            }
          });

          // Update original payment status to refunded
          await tx.payment.update({
            where: { id: originalPayment.id },
            data: { status: 'Refunded' }
          });
        }
      } catch (paymentError) {
        console.error('Error handling payment refund:', paymentError);
        // Continue without failing the transaction
      }

      // Reverse posted GL: revenue, payment-side lines, COGS/inventory, and Tax-Sale (or line-tax fallback)
      const glSummary = await reverseSaleGlForRefundInTx({
        tx,
        saleId: sale.id,
        saleNumber: sale.saleNumber,
        userId: user.id,
        tenantId: user.tenantId,
        reversalReason: reason,
        context: 'refund',
      });

      // Create audit log (includes traceable GL reversal ids for accountants / auditors)
      await tx.auditLog.create({
        data: {
          action: 'SALE_REFUNDED',
          entityType: 'SALE',
          entityId: sale.id,
          userId: user.id,
          tenantId: user.tenantId,
          details: JSON.stringify({
            saleNumber: sale.saleNumber,
            reason: reason,
            refundAmount: sale.total,
            itemsRestored: sale.items.filter(item => !item.isCustom && item.productId).length,
            glReversal: {
              saleJournalReversalsCreated: glSummary.reversedJournals,
              taxJournalReversalsCreated: glSummary.reversedTax,
              journalReversalTransactionIds: glSummary.journalReversalIds,
              taxReversalTransactionIds: glSummary.taxReversalIds,
              fallbackTaxAutoPostEntries: glSummary.fallbackTaxEntries,
            },
          })
        }
      });

      return updatedSale;
    });

    return NextResponse.json({
      success: true,
      sale: result,
      message: `Sale ${result.saleNumber} has been refunded successfully`
    });

  } catch (error) {
    console.error('Error refunding sale:', error);
    
    // Handle specific error types
    if (error.message.includes('not found')) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }
    
    if (error.message.includes('Unauthorized')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }
    
    if (error.message.includes('Only completed sales')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to refund sale' },
      { status: 500 }
    );
  }
}