// app/api/sales/[id]/void/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { updateAccountBalance } from '@/lib/core';

export async function POST(request, { params }) {
  try {
    const { id: saleId } = params;
    
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Parse request body
    const { reason } = await request.json();
    
    if (!reason || reason.trim() === '') {
      return NextResponse.json(
        { error: 'Void reason is required' },
        { status: 400 }
      );
    }

    // Start transaction to void sale and restore inventory
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
        throw new Error('Only completed sales can be voided');
      }

      // Try to create state history record if table exists
      try {
        await tx.saleStateHistory.create({
          data: {
            saleId: sale.id,
            fromStatus: sale.status,
            toStatus: 'voided',
            reason: reason,
            changedById: user.id
          }
        });
      } catch (historyError) {
        console.log('SaleStateHistory table not available, skipping history record');
        // Continue without failing the transaction
      }

      // Prepare update data - start with basic fields that always exist
      const updateData = {
        status: 'voided',
        notes: sale.notes ? `${sale.notes}\n\nVOIDED: ${reason}` : `VOIDED: ${reason}`
      };

      // Try to add enhanced void fields if schema supports them
      try {
        // Test if enhanced fields exist by attempting a dry run
        await tx.sale.findFirst({
          where: { id: saleId },
          select: { voidReason: true, voidedAt: true, voidedById: true }
        });
        
        // If no error, the fields exist, so add them
        updateData.voidReason = reason;
        updateData.voidedAt = new Date();
        updateData.voidedById = user.id;
      } catch (schemaError) {
        console.log('Enhanced void fields not available in schema, using basic fields only');
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
                reason: 'sale_void',
                referenceId: sale.id,
                notes: `Voided sale ${sale.saleNumber}: ${reason}`,
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
              type: 'void_restoration',
              quantity: item.quantity, // Positive for restoration
                notes: `Void restoration for sale ${sale.saleNumber}: ${reason}`,
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

      // 🔐 Handle payment reversal for voided sale
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
          // Create a reversal payment record
          const reversalPayment = await tx.payment.create({
            data: {
              saleId: sale.id,
              amount: -originalPayment.amount, // Negative amount for reversal
              paymentDate: new Date(),
              paymentMethod: originalPayment.paymentMethod,
              reference: `Void reversal for sale ${sale.saleNumber}`,
              notes: `Payment reversal due to void: ${reason}`,
              status: 'Completed',
              tenantId: user.tenantId,
              type: 'sale_void',
              sourceAccount: originalPayment.sourceAccount
            }
          });

          // Update account balance (subtract the original payment)
          await updateAccountBalance(user.tenantId, originalPayment.paymentMethod, originalPayment.amount, "subtract");

          // Update original payment status to voided
          await tx.payment.update({
            where: { id: originalPayment.id },
            data: { status: 'Voided' }
          });
        }
      } catch (paymentError) {
        console.error('Error handling payment reversal:', paymentError);
        // Continue without failing the transaction
      }

      // Create audit log
      await tx.auditLog.create({
        data: {
          action: 'SALE_VOIDED',
          entityType: 'SALE',
          entityId: sale.id,
          userId: user.id,
          tenantId: user.tenantId,
          details: JSON.stringify({
            saleNumber: sale.saleNumber,
            reason: reason,
            originalTotal: sale.total,
            itemsRestored: sale.items.filter(item => !item.isCustom && item.productId).length
          })
        }
      });

      return updatedSale;
    });

    return NextResponse.json({
      success: true,
      sale: result,
      message: `Sale ${result.saleNumber} has been voided successfully`
    });

  } catch (error) {
    console.error('Error voiding sale:', error);
    
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
      { error: error.message || 'Failed to void sale' },
      { status: 500 }
    );
  }
}