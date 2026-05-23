// app/api/invoices/[id]/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { createInvoiceJournalEntry } from '@/lib/transactionJournalHelpers';
import { calculateCOGS } from '@/lib/inventoryCosting';
import { generateReferenceNumber } from '@/lib/journalService';
import { updateAccountBalanceOnTransaction } from '@/lib/accountBalanceService';
import { assertPeriodOpen } from '@/lib/accountingPeriodService';

function sumEligibleInvoicePayments(payments) {
  if (!payments?.length) return 0;
  return payments.reduce((sum, p) => {
    if (!p || p.isReversal) return sum;
    // Treat missing status as Completed (older queries omitted status; default in DB is Completed)
    const st = p.status;
    if (st != null && String(st) !== 'Completed') return sum;
    return sum + (parseFloat(p.amount) || 0);
  }, 0);
}

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
    const invTotal = parseFloat(invoice.total) || 0;
    const outstandingAmount = Math.max(0, invTotal - totalPaid);
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

    if (!voidReason || voidReason.length < 3) {
      return NextResponse.json(
        { error: 'Void reason is required (minimum 3 characters)' },
        { status: 400 }
      );
    }

    // Block voiding when the invoice has payments applied (refund flow is required).
    const totalPaid = Number(invoice.totalPaid || 0);
    if (totalPaid > 0) {
      return NextResponse.json(
        { error: 'Cannot remove an invoice with payments applied. Process refund instead.' },
        { status: 400 }
      );
    }

    // Invoice already voided/refunded guardrails.
    if (invoice.status === 'void' || invoice.status === 'voided') {
      return NextResponse.json({ error: 'Invoice is already voided.' }, { status: 400 });
    }
    if (invoice.status === 'refunded' || invoice.status === 'partially_refunded') {
      return NextResponse.json(
        { error: 'Cannot void a refunded invoice' },
        { status: 400 }
      );
    }

    // Void with full audit-safe reversal (journal + tax). Keeps invoice visible.
    const updatedInvoice = await prisma.$transaction(async (tx) => {
      const originalTotal = invoice.total;
      const voidDate = new Date();

      const updated = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: 'void',
          voidedAt: voidDate,
          voidedById: user.id,
          voidReason: voidReason,
          originalTotal: originalTotal,
          updatedAt: voidDate
        }
      });

      // Reverse all posted journal entries for this invoice
      const originalTransactions = await tx.transaction.findMany({
        where: {
          tenantId: user.tenantId,
          sourceId: invoiceId,
          status: 'posted'
        },
        include: { lines: true }
      });

      await assertPeriodOpen(user.tenantId, voidDate, tx);

      for (const origTxn of originalTransactions) {
        const reversalRef = await generateReferenceNumber(tx, user.tenantId, voidDate);

        const reversedLines = (origTxn.lines || []).map((line, idx) => ({
          lineNumber: idx + 1,
          accountId: line.accountId,
          debitAmount: Number(line.creditAmount || 0),
          creditAmount: Number(line.debitAmount || 0),
          description: `VOID reversal: ${line.description || ''}`
        }));

        const reversalTxn = await tx.transaction.create({
          data: {
            tenantId: user.tenantId,
            date: voidDate,
            reference: reversalRef,
            description: `VOID reversal for invoice ${invoice.invoiceNumber} (${origTxn.sourceType})`,
            entryType: 'Regular',
            status: 'posted',
            sourceType: `${origTxn.sourceType}-Void`,
            sourceId: invoiceId,
            createdById: user.id,
            postedById: user.id,
            postedDate: voidDate,
            lines: { create: reversedLines }
          },
          include: { lines: true }
        });

        for (const line of reversalTxn.lines) {
          await updateAccountBalanceOnTransaction(
            line.accountId,
            line.debitAmount,
            line.creditAmount,
            tx
          );
        }
      }

      // Reverse tax postings for this voided invoice
      try {
        const { reverseAutoPostTaxEntry } = await import('@/lib/taxCalculationService');

        const taxTransactions = await tx.transaction.findMany({
          where: {
            sourceType: 'Tax-Invoice',
            sourceId: invoiceId,
            tenantId: user.tenantId,
            status: 'posted'
          },
          include: { lines: true }
        });

        for (const taxTxn of taxTransactions) {
          for (const line of taxTxn.lines || []) {
            const taxAmt = Number(line.creditAmount || 0) || Number(line.debitAmount || 0);
            if (taxAmt <= 0) continue;

            const taxType = await tx.taxType.findFirst({
              where: { accountId: line.accountId, tenantId: user.tenantId, status: 'Active' }
            });
            if (!taxType) continue;

            await reverseAutoPostTaxEntry({
              tenantId: user.tenantId,
              userId: user.id,
              taxTypeId: taxType.id,
              taxAmount: taxAmt,
              transactionDate: voidDate,
              sourceType: 'InvoiceVoid',
              sourceId: invoiceId,
              description: `Tax reversal for voided invoice ${invoice.invoiceNumber}`,
              tx
            });
          }
        }
      } catch (taxReversalError) {
        console.error('Error reversing tax for voided invoice:', taxReversalError);
      }

      // Audit log entry
      await tx.auditLog.create({
        data: {
          action: 'INVOICE_VOID',
          entityType: 'INVOICE',
          entityId: invoiceId,
          userId: user.id,
          tenantId: user.tenantId,
          details: JSON.stringify({
            invoiceNumber: invoice.invoiceNumber,
            clientId: invoice.clientId,
            originalTotal: originalTotal,
            voidReason: voidReason,
            voidedBy: user.email
          }),
          ipAddress:
            request.headers.get('x-forwarded-for') ||
            request.headers.get('x-real-ip') ||
            'unknown'
        }
      });

      return updated;
    });

    return NextResponse.json({
      message: 'Invoice voided successfully',
      invoice: {
        id: updatedInvoice.id,
        invoiceNumber: invoice.invoiceNumber,
        status: updatedInvoice.status,
        voidedAt: updatedInvoice.voidedAt,
        voidReason: updatedInvoice.voidReason
      }
    });
  } catch (error) {
    console.error(`Error deleting invoice ${invoiceId}:`, error);
    return NextResponse.json(
      { error: 'Failed to delete invoice. Please try again.' },
      { status: 500 }
    );
  }
}