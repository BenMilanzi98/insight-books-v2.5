// app/api/invoices/[id]/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { createInvoiceJournalEntry } from '@/lib/transactionJournalHelpers';
import { calculateCOGS } from '@/lib/inventoryCosting';

// Enhanced helper function to calculate invoice totals with discounts
function calculateInvoiceTotals(items, globalDiscount = 0) {
  let subtotal = 0;
  let totalDiscountAmount = 0;
  
  const processedItems = items.map(item => {
    // Calculate line total before discount
    const lineTotal = item.quantity * item.unitPrice;
    
    // Interpret discountAmount as per-item discount; convert to line discount
    const perItemDiscount = item.discountAmount || 0;
    const lineDiscountAmount = perItemDiscount * item.quantity;
    
    // Calculate net amount after discount
    const netLineAmount = lineTotal - lineDiscountAmount;
    
    // Calculate tax on net amount
    const lineTaxAmount = netLineAmount * ((item.taxRate || 0) / 100);
    
    // Calculate final amount including tax
    const finalAmount = netLineAmount + lineTaxAmount;
    
    // Add to totals
    subtotal += lineTotal;
    totalDiscountAmount += lineDiscountAmount;
    
    return {
      ...item,
      // Persist per-item discount for each item
      discountAmount: Number(perItemDiscount.toFixed(2)),
      netAmount: Number(netLineAmount.toFixed(2)),
      amount: Number(finalAmount.toFixed(2))
    };
  });
  
  // Apply global discount to the net subtotal (after line item discounts)
  const netSubtotalBeforeGlobal = subtotal - totalDiscountAmount;
  const validGlobalDiscount = Math.max(0, Math.min(globalDiscount || 0, netSubtotalBeforeGlobal));
  
  // Calculate tax on the net amount after global discount
  const finalNetSubtotal = netSubtotalBeforeGlobal - validGlobalDiscount;
  
  // Calculate total tax from processed items (this should already include line item taxes)
  let totalTaxAmount = 0;
  processedItems.forEach(item => {
    const lineTotal = item.quantity * item.unitPrice;
    const perItemDiscount = item.discountAmount || 0;
    const lineDiscountAmount = perItemDiscount * item.quantity;
    const netLineAmount = lineTotal - lineDiscountAmount;
    totalTaxAmount += netLineAmount * ((item.taxRate || 0) / 100);
  });
  
  const total = finalNetSubtotal + totalTaxAmount;
  
  return {
    processedItems,
    subtotal: Number(subtotal.toFixed(2)),
    totalDiscountAmount: Number(totalDiscountAmount.toFixed(2)),
    globalDiscount: Number(validGlobalDiscount.toFixed(2)),
    taxAmount: Number(totalTaxAmount.toFixed(2)),
    total: Number(total.toFixed(2))
  };
}

export async function GET(request, { params }) {
  try {
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Await params for Next.js 15 compatibility
    const { id: invoiceId } = await params;
    
    // Fetch invoice with client and items (include product so line title can fallback to product name)
    const invoice = await prisma.invoice.findUnique({
      where: { 
        id: invoiceId,
        tenantId: user.tenantId // Ensure the invoice belongs to the user's tenant
      },
      include: {
        client: true,
        items: {
          include: {
            product: { select: { name: true } }
          }
        },
        payments: {
          select: {
            id: true,
            amount: true,
            paymentDate: true,
            paymentMethod: true,
            reference: true,
            notes: true
          },
          orderBy: {
            paymentDate: 'desc'
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    });
    
    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }
    
    // Calculate payment information
    const totalPaid = invoice.payments.reduce((sum, payment) => sum + payment.amount, 0);
    const outstandingAmount = invoice.total - totalPaid;
    const isFullyPaid = totalPaid >= invoice.total;
    const isPartiallyPaid = totalPaid > 0 && !isFullyPaid;
    
    // Debug log for payment information
    console.log('Payment calculation for invoice:', {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      total: invoice.total,
      payments: invoice.payments,
      totalPaid,
      outstandingAmount,
      isFullyPaid,
      isPartiallyPaid
    });
    
    // Ensure each line has a display title (description or product name)
    const itemsWithTitle = (invoice.items || []).map((item) => ({
      ...item,
      description: (item.description && String(item.description).trim()) || (item.product && item.product.name) || 'Item'
    }));

    // Format the response to include prepared by info and payment details
    const formattedInvoice = {
      ...invoice,
      items: itemsWithTitle,
      preparedBy: invoice.createdBy?.name || 'N/A',
      preparedById: invoice.createdBy?.id || null,
      paymentInfo: {
        totalPaid,
        outstandingAmount,
        isFullyPaid,
        isPartiallyPaid,
        paymentCount: invoice.payments.length
      }
    };
    
    return NextResponse.json(formattedInvoice);
  } catch (error) {
    console.error(`Error fetching invoice ${invoiceId}:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch invoice. Please try again.' },
      { status: 500 }
    );
  }
}

// PUT handler for updating an invoice
export async function PUT(request, { params }) {
  try {
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Await params for Next.js 15 compatibility
    const { id: invoiceId } = await params;
    
    // Check if invoice exists and belongs to user's tenant
    const existingInvoice = await prisma.invoice.findUnique({
      where: {
        id: invoiceId,
        tenantId: user.tenantId
      },
      include: {
        items: true
      }
    });
    
    if (!existingInvoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }
    
    // Only allow editing if invoice is in Draft or Pending status
    if (existingInvoice.status !== 'Draft' && existingInvoice.status !== 'Pending') {
      return NextResponse.json(
        { error: 'Cannot edit invoices that are Paid or Overdue' },
        { status: 400 }
      );
    }
    
    const body = await request.json();

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { error: 'Invoice must have at least one item.' },
        { status: 400 }
      );
    }

    // Resolve default income account for items missing accountId (e.g. from older data or UI race)
    let defaultAccountId = null;
    const missingAccountId = body.items.some(item => !item.accountId);
    if (missingAccountId) {
      const incomeOrRevenue = {
        tenantId: user.tenantId,
        isActive: true,
        OR: [
          { accountType: 'Income' },
          { accountType: 'Revenue' }
        ]
      };
      const defaultAccount = await prisma.account.findFirst({
        where: {
          ...incomeOrRevenue,
          AND: [
            {
              OR: [
                { accountCode: '4000' },
                { name: { contains: 'Revenue', mode: 'insensitive' } },
                { accountName: { contains: 'Revenue', mode: 'insensitive' } }
              ]
            }
          ]
        },
        select: { id: true }
      });
      defaultAccountId = defaultAccount?.id || null;
      if (!defaultAccountId) {
        const anyIncome = await prisma.account.findFirst({
          where: incomeOrRevenue,
          select: { id: true }
        });
        defaultAccountId = anyIncome?.id || null;
      }
      if (!defaultAccountId) {
        return NextResponse.json(
          { error: 'Each invoice item must reference an income account. Please add an Income account (e.g. 4000 - Revenue) in Chart of Accounts.' },
          { status: 400 }
        );
      }
    }
    const normalizedItems = body.items.map(item => ({
      ...item,
      accountId: item.accountId || defaultAccountId
    }));

    // Enhanced validation for each item
    for (const item of normalizedItems) {
      if (!item.description || item.quantity <= 0 || item.unitPrice < 0) {
        return NextResponse.json(
          { error: 'All items must have valid description, quantity, and unit price' },
          { status: 400 }
        );
      }

      if (!item.accountId) {
        return NextResponse.json(
          { error: 'Each invoice item must reference an income account.' },
          { status: 400 }
        );
      }
      
      // Validate per-item discount amount (should be non-negative and not exceed unit price)
      if (item.discountAmount && item.discountAmount < 0) {
        return NextResponse.json(
          { error: 'Discount amount must be positive' },
          { status: 400 }
        );
      }
      
      if (item.discountAmount && item.discountAmount > item.unitPrice) {
        return NextResponse.json(
          { error: 'Per-item discount cannot exceed unit price' },
          { status: 400 }
        );
      }
      
      // Validate tax rate
      if (item.taxRate && (item.taxRate < 0 || item.taxRate > 100)) {
        return NextResponse.json(
          { error: 'Tax rate must be between 0 and 100%' },
          { status: 400 }
        );
      }
    }

    const incomeAccountIds = normalizedItems.map(item => item.accountId).filter(Boolean);
    const incomeAccounts = await prisma.account.findMany({
      where: {
        tenantId: user.tenantId,
        id: { in: incomeAccountIds },
        isActive: true,
        OR: [
          { accountType: 'Income' },
          { accountType: 'Revenue' }
        ]
      },
      select: { id: true }
    });

    if (incomeAccounts.length !== new Set(incomeAccountIds).size) {
      return NextResponse.json(
        { error: 'Invoice items must reference active income accounts.' },
        { status: 400 }
      );
    }

    // Enhanced calculation using the new function
    const calculations = calculateInvoiceTotals(normalizedItems, body.discount || 0);

    // Create a transaction to update invoice and items
    const updatedInvoice = await prisma.$transaction(async (tx) => {
      // 1. Update the invoice
      const invoice = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          clientId: body.clientId,
          issueDate: new Date(body.issueDate),
          dueDate: new Date(body.dueDate),
          discount: body.discount || 0, // Legacy global discount
          subtotal: calculations.subtotal,
          taxAmount: calculations.taxAmount,
          totalDiscountAmount: calculations.totalDiscountAmount, // Enhanced: Total of all line item discounts
          total: calculations.total,
          status: body.status,
          notes: body.notes,
          footerPhoneOverride: body.footerPhoneOverride ?? undefined,
          footerBankDetailsOverride: body.footerBankDetailsOverride ?? undefined
        }
      });
      
      // 2. Handle invoice items — ensure every line has a title (description or product name)
      const productIds = calculations.processedItems
        .filter(item => item.productId)
        .map(item => item.productId);
      let productNameById = {};
      if (productIds.length > 0) {
        const products = await tx.product.findMany({
          where: { id: { in: productIds }, tenantId: user.tenantId },
          select: { id: true, name: true }
        });
        productNameById = Object.fromEntries(products.map(p => [p.id, p.name]));
      }
      const itemsWithTitles = calculations.processedItems.map(item => {
        const desc = (item.description && String(item.description).trim()) || productNameById[item.productId] || 'Item';
        return { ...item, description: desc };
      });

      // Delete all existing items
      await tx.invoiceItem.deleteMany({
        where: { invoiceId }
      });
      
      // Create new items
      const items = await Promise.all(
        itemsWithTitles.map(item =>
          tx.invoiceItem.create({
            data: {
              invoiceId,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              taxRate: Number(item.taxRate || 0),
              discountRate: 0,
              discountAmount: item.discountAmount || 0,
              netAmount: item.netAmount || 0,
              amount: item.amount,
              productId: item.productId || null,
              accountId: item.accountId
            }
          })
        )
      );
      
      // 3. Create journal entry if status changed from Draft to something else
      if (existingInvoice.status === 'Draft' && body.status && body.status !== 'Draft') {
        try {
          // Check if journal entry already exists
          const existingJournalEntry = await tx.journalEntry.findFirst({
            where: {
              tenantId: user.tenantId,
              sourceType: 'Invoice',
              sourceId: invoice.id,
            },
          });

          if (!existingJournalEntry) {
            // Check if invoice has service items
            let invoiceHasServices = false;
            if (items.some(item => item.productId)) {
              const productIds = items
                .filter(item => item.productId)
                .map(item => item.productId);
              const products = await tx.product.findMany({
                where: { id: { in: productIds }, tenantId: user.tenantId },
                select: { id: true, isService: true }
              });
              invoiceHasServices = products.some(p => p.isService) || 
                items.some(item => !item.productId);
            } else {
              invoiceHasServices = true; // All custom items
            }

            // Calculate total COGS for all inventory items
            let totalCOGS = 0;
            
            for (const item of items) {
              if (item.productId) {
                try {
                  // Check if product is a service (services don't have COGS)
                  const product = await tx.product.findUnique({
                    where: { id: item.productId },
                    select: { id: true, isService: true }
                  });
                  
                  // Only calculate COGS and deduct stock for non-service products
                  if (product && !product.isService) {
                    const cogsData = await calculateCOGS({
                      productId: item.productId,
                      tenantId: user.tenantId,
                      quantitySold: item.quantity,
                      tx,
                    });
                    totalCOGS += cogsData.cogsAmount;
                    // Deduct stock when invoice is posted (reversal will restore)
                    const qty = Number(item.quantity) || 0;
                    if (qty > 0) {
                      await tx.product.update({
                        where: { id: item.productId },
                        data: { stockLevel: { decrement: qty } }
                      });
                      try {
                        await tx.inventoryTransaction.create({
                          data: {
                            productId: item.productId,
                            type: 'invoice',
                            quantity: -Math.round(qty),
                            notes: `Invoice ${existingInvoice.invoiceNumber}`,
                            userId: user.id,
                            tenantId: user.tenantId
                          }
                        });
                      } catch (e) {
                        if (!e.message?.includes('Unknown model')) console.warn('InventoryTransaction for invoice:', e?.message);
                      }
                    }
                  }
                } catch (cogsError) {
                  console.error(`Error calculating COGS for product ${item.productId}:`, cogsError);
                  // Continue with other items
                }
              }
            }

            // Resolve taxTypeId so invoice tax is posted to the correct TaxType account
            let invoiceTaxTypeId = null;
            const invoiceTaxAmount = Number(invoice.taxAmount || 0);
            if (invoiceTaxAmount > 0) {
              try {
                const activeTaxTypes = await tx.taxType.findMany({
                  where: { tenantId: user.tenantId, status: 'Active' },
                });
                const nonPayeTypes = activeTaxTypes.filter(t => Number(t.taxRate) > 0);
                const itemTaxRates = calculations.processedItems
                  .map(i => Number(i.taxRate || 0))
                  .filter(r => r > 0);
                const primaryRate = itemTaxRates.length > 0 ? itemTaxRates[0] : 0;
                if (primaryRate > 0) {
                  invoiceTaxTypeId = nonPayeTypes.find(t => Math.abs(Number(t.taxRate) - primaryRate) < 0.01)?.id
                    || nonPayeTypes[0]?.id || null;
                } else {
                  invoiceTaxTypeId = nonPayeTypes[0]?.id || null;
                }
              } catch (taxLookupErr) {
                console.warn('Could not resolve taxTypeId for invoice update:', taxLookupErr?.message);
              }
            }

            await createInvoiceJournalEntry({
              tenantId: user.tenantId,
              userId: user.id,
              invoiceId: invoice.id,
              invoiceNumber: invoice.invoiceNumber,
              issueDate: invoice.issueDate,
              totalAmount: invoice.total,
              items: calculations.processedItems,
              hasServices: invoiceHasServices,
              cogsAmount: totalCOGS,
              taxAmount: invoiceTaxAmount,
              taxTypeId: invoiceTaxTypeId,
              tx,
            });
          }
        } catch (journalError) {
          console.error('Error creating journal entry for invoice:', journalError);
          throw journalError;
        }
      }

      // 4. Create audit log
      await tx.auditLog.create({
        data: {
          action: 'INVOICE_UPDATED',
          entityType: 'INVOICE',
          entityId: invoice.id,
          userId: user.id,
          tenantId: user.tenantId,
          details: JSON.stringify({
            invoiceNumber: existingInvoice.invoiceNumber,
            clientId: invoice.clientId,
            total: invoice.total,
            status: invoice.status
          })
        }
      });
      
      // Return the updated invoice with relations
      return tx.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              email: true,
            }
          },
          items: true,
          createdBy: {
            select: {
              id: true,
              name: true,
            }
          }
        }
      });
    });
    
    return NextResponse.json({
      message: 'Invoice updated successfully',
      invoice: updatedInvoice
    });
  } catch (error) {
    console.error(`Error updating invoice ${invoiceId}:`, error);
    return NextResponse.json(
      { error: 'Failed to update invoice. Please try again.' },
      { status: 500 }
    );
  }
}

// DELETE handler for deleting an invoice
export async function DELETE(request, { params }) {
  try {
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Await params for Next.js 15 compatibility
    const { id: invoiceId } = await params;
    
    // Check if invoice exists and belongs to user's tenant
    const invoice = await prisma.invoice.findUnique({
      where: {
        id: invoiceId,
        tenantId: user.tenantId
      }
    });
    
    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }
    
    // Only allow deletion if invoice is in Draft or Pending status
    if (invoice.status !== 'Draft' && invoice.status !== 'Pending') {
      return NextResponse.json(
        { error: 'Cannot delete invoices that are Paid or Overdue' },
        { status: 400 }
      );
    }
    
    // Delete invoice and related items in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete invoice items first
      await tx.invoiceItem.deleteMany({
        where: { invoiceId }
      });
      
      // Delete the invoice
      await tx.invoice.delete({
        where: { id: invoiceId }
      });
      
      // Create audit log
      await tx.auditLog.create({
        data: {
          action: 'INVOICE_DELETED',
          entityType: 'INVOICE',
          entityId: invoiceId,
          userId: user.id,
          tenantId: user.tenantId,
          details: JSON.stringify({
            invoiceNumber: invoice.invoiceNumber,
            clientId: invoice.clientId,
            total: invoice.total
          })
        }
      });
    });
    
    return NextResponse.json({
      message: 'Invoice deleted successfully'
    });
  } catch (error) {
    console.error(`Error deleting invoice ${invoiceId}:`, error);
    return NextResponse.json(
      { error: 'Failed to delete invoice. Please try again.' },
      { status: 500 }
    );
  }
}