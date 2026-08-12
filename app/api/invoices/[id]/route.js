// app/api/invoices/[id]/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { ensureInvoiceSalesAccounting } from '@/lib/ensureInvoiceSalesAccounting';
import { reverseAndDeleteInvoiceRecord } from '@/lib/invoiceDeleteService';
import { calculateInvoiceTotals } from '@/lib/invoiceTotals';
import { parseMoney, subtractMoney, sumMoney } from '@/lib/money';
import {
  requireInvoiceItemAccountIdColumn,
  buildInvoiceItemCreateData,
} from '@/lib/ensureInvoiceItemAccountId';
import {
  assertEisFinalizationAllowed,
  bridgeSalesInvoiceAfterCommit,
} from '@/lib/mraEis/application/eligibility/finalizationIntegration.js';
import { MraEisControlError } from '@/lib/mraEis/domain/errors.js';
import { emitSalesInvoicePosted } from '@/lib/admin/productAnalytics/producers';
import {
  assertActiveTaxTypeIds,
  collectTaxTypeIdsFromItems,
} from '@/lib/taxManagement/assertActiveTaxTypes';

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
            product: { select: { name: true } },
            itemTaxes: true,
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
    
    // Ensure each line has a display title (description or product name) and expose taxes for the UI
    const itemsWithTitle = (invoice.items || []).map((item) => ({
      ...item,
      description: (item.description && String(item.description).trim()) || (item.product && item.product.name) || 'Item',
      taxes: item.itemTaxes || [],
      productTaxes: item.itemTaxes || [],
    }));

    // Format the response to include prepared by info and payment details
    const formattedInvoice = {
      ...invoice,
      items: itemsWithTitle,
      preparedBy: invoice.createdBy?.name || 'N/A',
      preparedById: invoice.createdBy?.id || null,
      totalPaid,
      amountDue: outstandingAmount,
      remainingBalance: outstandingAmount,
      status: invoice.status,
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

    const columnCheck = await requireInvoiceItemAccountIdColumn();
    if (!columnCheck.ok) return columnCheck.response;
    const invoiceItemHasAccountId = columnCheck.hasColumn;
    
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

    // Historical lines may keep Inactive taxes; new taxTypeIds must still be Active
    const existingItemTaxes = await prisma.invoiceItemTax.findMany({
      where: {
        invoiceItem: {
          invoiceId,
          invoice: { tenantId: user.tenantId },
        },
      },
      select: { taxTypeId: true },
    });
    const allowInactiveIds = existingItemTaxes.map((r) => r.taxTypeId);

    try {
      await assertActiveTaxTypeIds(
        prisma,
        user.tenantId,
        collectTaxTypeIdsFromItems(normalizedItems),
        allowInactiveIds
      );
    } catch (e) {
      if (e?.status === 400 || e?.code === 'INACTIVE_TAX' || e?.code === 'UNKNOWN_TAX') {
        return NextResponse.json({ error: e.message, code: e.code }, { status: 400 });
      }
      throw e;
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

    // Phase 11: EIS preflight when issuing/posting from Draft
    if (
      existingInvoice.status === 'Draft' &&
      body.status &&
      body.status !== 'Draft' &&
      String(body.status).toUpperCase() !== 'PROFORMA'
    ) {
      try {
        await assertEisFinalizationAllowed({
          tenantId: user.tenantId,
          sourceType: 'SALES_INVOICE',
          sourceId: invoiceId,
          sourceState: String(body.status).toUpperCase(),
          branchId: existingInvoice.branchId,
          lines: (calculations.processedItems || []).map((item, idx) => ({
            id: item.id || `line-${idx}`,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxAmount: item.taxAmount || 0,
            description: item.description,
            isService: item.isService,
          })),
          payments: [
            {
              localPaymentMethodId: body.paymentMethod || 'Credit',
              amount: calculations.total,
              isCredit: true,
            },
          ],
          header: {
            subtotal: calculations.subtotal,
            taxAmount: calculations.taxAmount,
            total: calculations.total,
            paymentMethod: body.paymentMethod || 'Credit',
          },
          buyer: {
            customerId: body.clientId || existingInvoice.clientId,
            isB2B: true,
          },
          isCreditSale: true,
          actorContext: { userId: user.id },
        });
      } catch (eisPreflightErr) {
        if (eisPreflightErr instanceof MraEisControlError) {
          return NextResponse.json(eisPreflightErr.toJSON(), { status: eisPreflightErr.httpStatus || 422 });
        }
        throw eisPreflightErr;
      }
    }

    // Create a transaction to update invoice and items
    const updatedInvoice = await prisma.$transaction(async (tx) => {
      // 1. Update the invoice
      const paidToDate = parseMoney(existingInvoice.totalPaid);
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
          // Keep outstanding in sync when totals change (cash-basis AR).
          remainingBalance: Math.max(0, subtractMoney(calculations.total, paidToDate)),
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
      await Promise.all(
        itemsWithTitles.map(item =>
          tx.invoiceItem.create({
            data: {
              invoiceId,
              ...buildInvoiceItemCreateData(item, invoiceItemHasAccountId),
            }
          })
        )
      );
      
      // 3. Recognize revenue + COGS when leaving Draft (or repairing a posted invoice)
      const finalStatus = String(body.status || invoice.status || '');
      if (
        finalStatus &&
        finalStatus.toLowerCase() !== 'draft' &&
        finalStatus.toUpperCase() !== 'PROFORMA'
      ) {
        try {
          await ensureInvoiceSalesAccounting({
            db: tx,
            tenantId: user.tenantId,
            userId: user.id,
            invoiceId: invoice.id,
          });
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
          items: { include: { itemTaxes: true } },
          createdBy: {
            select: {
              id: true,
              name: true,
            }
          }
        }
      });
    });
    
    let eisResult = null;
    if (
      existingInvoice.status === 'Draft' &&
      updatedInvoice.status !== 'Draft' &&
      String(updatedInvoice.status).toUpperCase() !== 'PROFORMA'
    ) {
      try {
        await emitSalesInvoicePosted(prisma, {
          tenantId: user.tenantId,
          invoiceId: updatedInvoice.id,
          actorId: user.id,
          status: updatedInvoice.status,
          occurredAt: updatedInvoice.updatedAt || new Date(),
          branchId: updatedInvoice.branchId || null,
        });
      } catch (analyticsErr) {
        console.warn('[productAnalytics] invoice posted emit failed:', analyticsErr?.message);
      }

      eisResult = await bridgeSalesInvoiceAfterCommit({
        tenantId: user.tenantId,
        invoice: updatedInvoice,
        actorContext: { userId: user.id },
      });
    }

    return NextResponse.json({
      message: 'Invoice updated successfully',
      invoice: updatedInvoice,
      eis: eisResult
        ? {
            status: eisResult.eisStatus || eisResult.bridge?.status || null,
            bridgeId: eisResult.bridge?.id || null,
            decision: eisResult.eligibility?.decision || null,
            message: eisResult.message || null,
            recoveryRequired: Boolean(eisResult.recoveryRequired),
            mraSubmitted: false,
            mraAccepted: false,
            fiscalNumber: null,
            qrPresent: false,
          }
        : null,
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