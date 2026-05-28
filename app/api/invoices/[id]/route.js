// app/api/invoices/[id]/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { createInvoiceJournalEntry } from '@/lib/transactionJournalHelpers';
import { calculateCOGS } from '@/lib/inventoryCosting';
import { reverseAndDeleteInvoiceRecord } from '@/lib/invoiceDeleteService';
import { calculateInvoiceTotals } from '@/lib/invoiceTotals';
import { parseMoney, subtractMoney, sumMoney } from '@/lib/money';

function sumEligibleInvoicePayments(payments) {
  if (!payments?.length) return 0;
  const amounts = [];
  for (const p of payments) {
    if (!p || p.isReversal) continue;
    const st = p.status;
    if (st != null && String(st) !== 'Completed') continue;
    amounts.push(parseMoney(p.amount));
  }
  return sumMoney(amounts);
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
            notes: true,
            status: true,
            isReversal: true,
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
    const totalPaid = sumEligibleInvoicePayments(invoice.payments);
    const invTotal = parseMoney(invoice.total);
    const outstandingAmount = Math.max(0, subtractMoney(invTotal, totalPaid));
    const isFullyPaid = outstandingAmount <= 0.005;
    const isPartiallyPaid = totalPaid > 0 && !isFullyPaid;
    
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
        paymentCount: invoice.payments.filter(
          (p) => p && !p.isReversal && (p.status == null || String(p.status) === 'Completed')
        ).length,
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

    // Resolve default postable income account for items missing accountId (e.g. from older data or UI race)
    let defaultAccountId = null;
    const missingAccountId = body.items.some(item => !item.accountId);
    if (missingAccountId) {
      const { resolveDefaultPostableRevenueAccountId } = await import('@/lib/coaIncomeAccounts');
      defaultAccountId = await resolveDefaultPostableRevenueAccountId(prisma, user.tenantId);
      if (!defaultAccountId) {
        return NextResponse.json(
          {
            error:
              'Each invoice item must reference an income account. Add a detail Income account (e.g. 4100 Product Sales) in Chart of Accounts.',
          },
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
          { error: 'All items must have valid description, quantity, and Selling Price' },
          { status: 400 }
        );
      }

      if (!item.accountId) {
        return NextResponse.json(
          { error: 'Each invoice item must reference an income account.' },
          { status: 400 }
        );
      }
      
      // Validate per-item discount amount (should be non-negative and not exceed Selling Price)
      if (item.discountAmount && item.discountAmount < 0) {
        return NextResponse.json(
          { error: 'Discount amount must be positive' },
          { status: 400 }
        );
      }
      
      if (item.discountAmount && item.discountAmount > item.unitPrice) {
        return NextResponse.json(
          { error: 'Per-item discount cannot exceed Selling Price' },
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
    
    const body = await request.json().catch(() => ({}));
    const reasonRaw = body.reason || body.voidReason || body.reversalReason || body.deletionReason;
    const voidReason = typeof reasonRaw === 'string' ? reasonRaw.trim() : '';
    const deleteResult = await reverseAndDeleteInvoiceRecord({
      invoice,
      tenantId: user.tenantId,
      userId: user.id,
      request,
      reason: voidReason || 'Invoice deleted by user',
    });

    return NextResponse.json({
      message: deleteResult.reversal
        ? 'Invoice reversed and deleted successfully'
        : 'Invoice deleted successfully',
      deleted: true,
      invoice: {
        id: invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        status: deleteResult.deletedInvoice.status,
        deletedAt: deleteResult.deletedInvoice.deletedAt,
        deletionReason: deleteResult.deletedInvoice.deletionReason,
      },
      reversal: deleteResult.reversal
        ? {
            id: deleteResult.reversal.id,
            invoiceNumber: deleteResult.reversal.invoiceNumber,
            total: deleteResult.reversal.total,
          }
        : null,
    });
  } catch (error) {
    console.error('Error deleting invoice:', error);
    const status = error?.statusCode === 400 ? 400 : 500;
    return NextResponse.json(
      { error: error?.message || 'Failed to delete invoice. Please try again.' },
      { status }
    );
  }
}