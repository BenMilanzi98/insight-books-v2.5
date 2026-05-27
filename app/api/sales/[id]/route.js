// app/api/sales/[id]/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { updateAccountBalance } from '@/lib/core';
import { calculateCOGS } from '@/lib/inventoryCosting';
import { createSaleJournalEntries } from '@/lib/transactionJournalHelpers';
import { addMoney, multiplyMoney, percentOfMoney, roundMoney, subtractMoney } from '@/lib/money';

// Helper function to get sale by ID with validation
async function getSaleWithValidation(id, userId, tenantId) {
  const sale = await prisma.sale.findUnique({
    where: { id },
    include: {
      client: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true
        }
      },
      createdBy: {
        select: {
          id: true,
          name: true
        }
      },
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              stockLevel: true
            }
          }
        },
        orderBy: {
          id: 'asc'
        }
      },
      inventoryBatchConsumptions: {
        include: {
          batch: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                }
              }
            }
          }
        }
      }
    }
  });
  
  if (!sale) {
    return { error: 'Sale not found', status: 404 };
  }
  
  // Security check: Ensure the sale belongs to the user's tenant
  if (sale.tenantId !== tenantId) {
    return { error: 'Access denied', status: 403 };
  }
  
  // Calculate actual tax information from items
  const itemTaxTotal = sale.items.reduce((sum, item) => sum + (item.taxAmount || 0), 0);
  const itemTaxRates = [...new Set(sale.items.map(item => item.taxRate || 0).filter(rate => rate > 0))];
  const displayTaxRate = itemTaxRates.length === 1 ? itemTaxRates[0] : (itemTaxRates.length > 1 ? 'Mixed' : sale.taxRate);
  
  // Use item-level tax if available, otherwise use sale-level tax
  const actualTaxAmount = itemTaxTotal > 0 ? itemTaxTotal : sale.taxAmount;
  const actualTaxRate = itemTaxTotal > 0 ? displayTaxRate : sale.taxRate;

  // Build items list - use SaleItems if available, otherwise reconstruct from batch consumptions
  let formattedItems = sale.items.map(item => {
    const quantity = Number(item.quantity) || 0;
    const rawAmount = Number(item.amount) || 0;
    const discountAmount = Number(item.discountAmount) || 0;
    const netAmount = Math.max(0, rawAmount - discountAmount);
    const effectiveUnitPrice = quantity > 0 ? netAmount / quantity : Number(item.unitPrice) || 0;

    return {
      ...item,
      unitPrice: item.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      amount: rawAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      lineNetAmount: netAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      effectiveUnitPrice: effectiveUnitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      taxAmount: (item.taxAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      rawUnitPrice: item.unitPrice,
      rawAmount,
      rawLineNetAmount: netAmount,
      rawEffectiveUnitPrice: effectiveUnitPrice,
      rawDiscountAmount: discountAmount,
      rawTaxAmount: item.taxAmount || 0
    };
  });

  // Fallback: get product names/quantities from batch consumptions for old sales
  let batchProducts = [];
  if (formattedItems.length === 0 && sale.inventoryBatchConsumptions?.length > 0) {
    const productMap = {};
    for (const c of sale.inventoryBatchConsumptions) {
      const name = c.batch?.product?.name || 'Item';
      const qty = Number(c.quantity) || 0;
      if (productMap[name]) productMap[name] += qty;
      else productMap[name] = qty;
    }
    batchProducts = Object.entries(productMap).map(([name, quantity]) => ({ name, quantity }));
  }

  return {
    sale: {
      ...sale,
      // Format currency values for display
      subtotal: sale.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      taxAmount: actualTaxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      total: sale.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      // Use calculated tax rate for display
      taxRate: actualTaxRate,
      // For historical sales, prefer historicalDate (handles legacy records
      // where saleDate may have been stored as the upload date)
      saleDate: (sale.isHistorical && sale.historicalDate)
        ? sale.historicalDate.toISOString().split('T')[0]
        : sale.saleDate.toISOString().split('T')[0],
      // Add raw values for frontend calculations
      rawSubtotal: sale.subtotal,
      rawTaxAmount: actualTaxAmount,
      rawTotal: sale.total,
      items: formattedItems,
      // Product names recovered from inventory records (for old sales without SaleItems)
      batchProducts,
    }
  };
}

// GET - Fetch a single sale by ID
export async function GET(request, { params }) {
  try {
    // Fix for Next.js 15: await params before accessing properties
    const { id: saleId } = await params;
    
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Get sale with validation
    const result = await getSaleWithValidation(saleId, user.id, user.tenantId);
    
    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }
    
    return NextResponse.json(result.sale);
  } catch (error) {
    console.error(`Error fetching sale ${saleId}:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch sale. Please try again.' },
      { status: 500 }
    );
  }
}

// PUT - Update a sale
export async function PUT(request, { params }) {
  try {
    // Fix for Next.js 15: await params before accessing properties
    const { id: saleId } = await params;
    
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Get sale with validation
    const result = await getSaleWithValidation(saleId, user.id, user.tenantId);
    
    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }
    
    const body = await request.json();
    
    // Prevent updating completed sales unless explicitly changing status
    if (result.sale.status === 'completed' && !body.status) {
      return NextResponse.json(
        { error: 'Completed sales cannot be updated' },
        { status: 400 }
      );
    }
    
    // Prepare update data
    const updateData = {};
    // Calculate totals
    const discountRate = roundMoney(body.discount || 0);
    const grossSubtotal = body.items.reduce(
      (sum, item) => addMoney(sum, multiplyMoney(item.quantity, item.unitPrice)),
      0
    );
    const subtotal = subtractMoney(grossSubtotal, discountRate);
    const taxRate = roundMoney(body.taxRate || 0);
    const taxAmount = percentOfMoney(subtotal, taxRate);
    const total = addMoney(subtotal, taxAmount);
    // Only include fields that are provided in the request
    if (body.clientId !== undefined) updateData.clientId = body.clientId;
    if (body.saleDate !== undefined) updateData.saleDate = new Date(body.saleDate);
    if (body.status !== undefined) updateData.status = body.status;
    if (body.discount !== undefined) updateData.discount = body.discount;
    if (body.taxRate !== undefined) updateData.taxRate = body.taxRate;
    if (body.taxRate !== undefined) updateData.taxAmount = taxAmount;
    if (body.taxRate !== undefined) updateData.total = total;
    if (body.paymentMethod !== undefined) updateData.paymentMethod = body.paymentMethod;
    if (body.notes !== undefined) updateData.notes = body.notes;
    const paymentMethod=updateData.paymentMethod
    const notes=updateData.notes
    // Start a transaction for updating the sale
    const updatedSale = await prisma.$transaction(async (tx) => {
        // Get current sale items from DB
        const existingItems = await tx.saleItem.findMany({
          where: { saleId: saleId },
          select: { productId: true }
        });

        // Create a Set of productIds from body
        const incomingProductIds = new Set(body.items.map(item => item.productId));

        // Find items that are in DB but NOT in the incoming list
        const itemsToDelete = existingItems
          .filter(item => !incomingProductIds.has(item.productId));

        // Delete those items
        await Promise.all(
          itemsToDelete.map(item =>
            tx.saleItem.delete({
              where: {
                saleId_productId: {
                  saleId: saleId,
                  productId: item.productId
                }
              }
            })
          )
        );

        // Upsert incoming items
        await Promise.all(
          body.items.map(async (item) => {
            const amount = multiplyMoney(item.quantity, item.unitPrice);
            return tx.saleItem.upsert({
              where: {
                saleId_productId: {
                  saleId: saleId,
                  productId: item.productId
                }
              },
              update: {
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                amount: amount
              },
              create: {
                sale: {
                  connect: { id: saleId }
                },
                product: {
                  connect: { id: item.productId }
                },
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                amount: amount
              }
            });
          })
        );
      // Update the sale
      const sale = await tx.sale.update({
        where: { id: saleId },
        data: updateData,
        include: {
          client: {
            select: {
              id: true,
              name: true
            }
          },
          items: true
        }
      });
      
      // If status is being changed to 'void' or 'refunded', restore product stock
      if (body.status === 'void' || body.status === 'refunded') {
        for (const item of sale.items) {
          const product = await tx.product.findUnique({
            where: { id: item.productId }
          });
          
          if (product && product.stockLevel !== null) {
            await tx.product.update({
              where: { id: item.productId },
              data: {
                stockLevel: product.stockLevel + item.quantity
              }
            });
          }
        }
      }
        // Update inventory if status is completed
        if (body.status === 'completed') {
          await Promise.all(
            sale.items.map(async (item) => {
              // Only update stock level if it's not null
              return tx.product.update({
                where: { id: item.productId },
                data: {
                  stockLevel: {
                    decrement: item.quantity
                  }
                }
              });
            })
          );
          // 🔐 Create payment
          // Use sale date for paymentDate (historicalDate if set, otherwise saleDate)
          // This ensures historical sales are recorded with their actual sale date
          const paymentDate = sale.historicalDate || sale.saleDate;
          
          const newPayment = await tx.payment.create({
            data: {
              saleId: sale.id,
              amount: sale.total,
              paymentDate: paymentDate, // Use sale date instead of current date
              paymentMethod: body.paymentMethod || sale.paymentMethod,
              reference: `Sale ${sale.saleNumber}`,
              notes: body.notes || sale.notes || `Payment for sale ${sale.saleNumber}`,
              status: 'Completed',
              tenantId: user.tenantId,
              type: 'sale',
              sourceAccount: body.paymentMethod || sale.paymentMethod
            }
          });
          await updateAccountBalance(user.tenantId, body.paymentMethod || sale.paymentMethod, sale.total, "add");

          // Create transactions for sale (Revenue + COGS) if they don't already exist
          try {
            const existingTransaction = await tx.transaction.findFirst({
              where: {
                tenantId: user.tenantId,
                sourceType: 'Sale',
                sourceId: sale.id,
                status: 'posted',
              },
            });

            if (!existingTransaction) {
              // Calculate total COGS for all inventory items
              let totalCOGS = 0;
              const hasServices = sale.items.some(item => item.isCustom || !item.productId);

              for (const item of sale.items) {
                if (item.productId && !item.isCustom) {
                  try {
                    // Check if product is a service (services don't have COGS)
                    const product = await tx.product.findUnique({
                      where: { id: item.productId },
                      select: { id: true, isService: true }
                    });
                    
                    // Only calculate COGS for non-service products
                    if (product && !product.isService) {
                      const cogsData = await calculateCOGS({
                        productId: item.productId,
                        tenantId: user.tenantId,
                        quantitySold: item.quantity,
                        tx,
                      });
                      totalCOGS += cogsData.cogsAmount;
                    }
                  } catch (cogsError) {
                    console.error(`Error calculating COGS for product ${item.productId}:`, cogsError);
                    // Continue with other items
                  }
                }
              }

              // Create journal entries
              await createSaleJournalEntries({
                tenantId: user.tenantId,
                userId: user.id,
                saleId: sale.id,
                saleNumber: sale.saleNumber,
                saleDate: paymentDate,
                totalAmount: sale.total,
                paymentMethod: body.paymentMethod || sale.paymentMethod,
                hasServices,
                cogsAmount: totalCOGS,
                branchId: sale.branchId || null,
                tx,
              });
            }
          } catch (journalError) {
            console.error('Error creating journal entries for sale:', journalError);
            // Don't fail the sale update if journal entry creation fails
          }
        }
      
      // Create an audit log entry
      await tx.auditLog.create({
        data: {
          action: 'SALE_UPDATED',
          entityType: 'SALE',
          entityId: sale.id,
          userId: user.id,
          tenantId: user.tenantId,
          details: JSON.stringify({
            saleNumber: sale.saleNumber,
            status: body.status,
            changes: Object.keys(updateData).join(', ')
          })
        }
      });
      
      return sale;
    });
    
    // Return updated sale
    return NextResponse.json({
      message: 'Sale updated successfully',
      sale: {
        id: updatedSale.id,
        saleNumber: updatedSale.saleNumber,
        client: updatedSale.client ? updatedSale.client.name : 'Walk-in Customer',
        status: updatedSale.status,
        total: updatedSale.total.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }),
        date: updatedSale.saleDate.toISOString().split('T')[0]
      }
    });
  } catch (error) {
    console.error(`Error updating sale ${saleId}:`, error);
    return NextResponse.json(
      { error: 'Failed to update sale. Please try again.' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a sale
export async function DELETE(request, { params }) {
  try {
    // Fix for Next.js 15: await params before accessing properties
    const { id: saleId } = await params;
    
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Get sale with validation
    const result = await getSaleWithValidation(saleId, user.id, user.tenantId);
    
    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }
    
    // Can only delete sales in draft status
    if (result.sale.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft sales can be deleted. Completed sales should be voided instead.' },
        { status: 400 }
      );
    }
    
    // Start a transaction to delete sale and restore stock
    await prisma.$transaction(async (tx) => {
      // Get items before deleting the sale
      const items = await tx.saleItem.findMany({
        where: { saleId }
      });
      
      // Delete the sale (will cascade to delete items)
      await tx.sale.delete({
        where: { id: saleId }
      });
      
      // Create an audit log entry
      await tx.auditLog.create({
        data: {
          action: 'SALE_DELETED',
          entityType: 'SALE',
          entityId: saleId,
          userId: user.id,
          tenantId: user.tenantId,
          details: JSON.stringify({
            saleNumber: result.sale.saleNumber,
            amount: result.sale.rawTotal,
            itemCount: items.length
          })
        }
      });
    });
    
    return NextResponse.json({
      message: 'Sale deleted successfully'
    });
  } catch (error) {
    console.error(`Error deleting sale ${saleId}:`, error);
    return NextResponse.json(
      { error: 'Failed to delete sale. Please try again.' },
      { status: 500 }
    );
  }
}