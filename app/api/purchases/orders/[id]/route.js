// app/api/purchases/orders/[id]/route.js
//
// Inventory policy: PUT/updates here do not mutate stock. Receipt posting drives quantity (see receipts API).
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { createExpenseReversal } from '@/lib/transactionReversalService';
import { createTransactionReversal } from '@/lib/transactionReversalService';
import { assertExpectedDeliveryOnOrAfterPoDate } from '@/lib/purchaseOrderDateValidation';

const PO_STATUSES = ['Draft', 'Approved', 'Sent', 'Partially Received', 'Received', 'Cancelled'];
const ORDER_TYPES = ['goods', 'services', 'mixed', 'assets'];

/** Any goods line with received qty > 0 — PO must not be edited or cancelled from the UI. */
function poHasGoodsReceiptActivity(purchaseOrder) {
  return (purchaseOrder.items || []).some((it) => {
    const lt = (it.lineType || 'goods').toLowerCase();
    if (lt !== 'goods' || !it.productId) return false;
    return Number(it.quantityReceived || 0) > 0;
  });
}

function getLineType(item) {
  const t = (item.lineType || '').toLowerCase();
  if (t === 'service' || t === 'goods') return t;
  return item.productId ? 'goods' : 'service';
}

function validateItems(items, orderType = 'goods') {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Purchase order items are required');
  }
  items.forEach((item, idx) => {
    const lineType = getLineType(item);
    if (lineType === 'goods') {
      if (!item.productId) throw new Error(`Item ${idx + 1}: productId is required for goods lines`);
    } else {
      if (!item.description?.trim()) throw new Error(`Item ${idx + 1}: description is required for service lines`);
    }
    const qty = Number(item.quantityOrdered ?? 0);
    if (qty <= 0) throw new Error(`Item ${idx + 1}: quantityOrdered must be greater than zero`);
    if (Number(item.unitCost ?? 0) < 0) throw new Error(`Item ${idx + 1}: unitCost cannot be negative`);
  });
}

async function getPurchaseOrder(id, tenantId) {
  return prisma.purchaseOrder.findFirst({
    where: { id, tenantId },
    include: {
      supplier: { select: { supplierName: true, supplierCode: true } },
      items: {
        include: {
          product: { select: { id: true, name: true, sku: true, barcode: true } },
          expenseCategory: {
            select: {
              id: true,
              name: true,
              accountCode: true,
              account: { select: { accountCode: true, accountName: true } }
            }
          },
          taxType: { select: { id: true, taxName: true, taxCode: true, taxRate: true } }
        }
      },
      receipts: {
        select: { id: true, receiptNumber: true, receiptDate: true, totalAmount: true }
      },
      expenses: { select: { id: true, description: true, amount: true, date: true, status: true } },
      supplierBills: {
        select: {
          id: true,
          billNumber: true,
          billDate: true,
          dueDate: true,
          status: true,
          totalAmount: true,
          amountPaid: true,
          billType: true,
        },
        orderBy: { billDate: 'desc' },
      },
    }
  });
}

export async function GET(request, { params }) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const purchaseOrder = await getPurchaseOrder(params.id, user.tenantId);
    if (!purchaseOrder) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    return NextResponse.json({ purchaseOrder });
  } catch (error) {
    console.error('Error fetching purchase order:', error);
    return NextResponse.json(
      { error: 'Failed to fetch purchase order.' },
      { status: 500 }
    );
  }
}

export async function PUT(request, { params }) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const purchaseOrder = await getPurchaseOrder(params.id, user.tenantId);
    if (!purchaseOrder) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    if (poHasGoodsReceiptActivity(purchaseOrder)) {
      return NextResponse.json(
        {
          error:
            'Cannot edit this purchase order because goods have already been received against it.',
        },
        { status: 400 }
      );
    }

    const lockedStatuses = ['Received', 'Cancelled'];
    if (lockedStatuses.includes(purchaseOrder.status)) {
      return NextResponse.json(
        { error: 'Cannot modify a purchase order that is already fully received or cancelled.' },
        { status: 400 }
      );
    }

    const body = await request.json();

    const nextExpected =
      body.expectedDeliveryDate !== undefined
        ? body.expectedDeliveryDate
          ? new Date(body.expectedDeliveryDate)
          : null
        : purchaseOrder.expectedDeliveryDate;
    try {
      assertExpectedDeliveryOnOrAfterPoDate(purchaseOrder.poDate, nextExpected);
    } catch (dateErr) {
      return NextResponse.json({ error: dateErr.message }, { status: 400 });
    }

    const orderType = ORDER_TYPES.includes(body.orderType) ? body.orderType : (purchaseOrder.orderType || 'goods');
    if (body.items) validateItems(body.items, orderType);

    const pricesIncludeTax = body.pricesIncludeTax !== undefined ? Boolean(body.pricesIncludeTax) : purchaseOrder.pricesIncludeTax;

    const data = {
      orderType: body.orderType !== undefined ? (ORDER_TYPES.includes(body.orderType) ? body.orderType : purchaseOrder.orderType) : purchaseOrder.orderType,
      expectedDeliveryDate: body.expectedDeliveryDate ? new Date(body.expectedDeliveryDate) : purchaseOrder.expectedDeliveryDate,
      deliveryAddress: body.deliveryAddress ?? purchaseOrder.deliveryAddress,
      paymentTerms: body.paymentTerms ?? purchaseOrder.paymentTerms,
      currency: body.currency ?? purchaseOrder.currency,
      notes: body.notes ?? purchaseOrder.notes,
      termsAndConditions: body.termsAndConditions ?? purchaseOrder.termsAndConditions,
      pricesIncludeTax,
      supplierInvoiceUrl: body.supplierInvoiceUrl !== undefined ? (body.supplierInvoiceUrl || null) : purchaseOrder.supplierInvoiceUrl
    };

    data.status = 'Approved';
    data.approvedById = user.id;
    data.approvedDate = new Date();

    let subtotal = purchaseOrder.subtotal;
    let taxAmount = purchaseOrder.taxAmount ?? 0;
    let headerTaxRate = purchaseOrder.taxRate ?? 0;

    const round2 = (n) => Math.round(Number(n) * 100) / 100;

    if (body.items) {
      const taxTypeIds = [...new Set(body.items.map((it) => it.taxTypeId).filter(Boolean))];
      if (taxTypeIds.length > 0) {
        const taxTypes = await prisma.taxType.findMany({
          where: { id: { in: taxTypeIds }, tenantId: user.tenantId, status: 'Active' }
        });
        if (taxTypes.length !== taxTypeIds.length) {
          return NextResponse.json({ error: 'One or more tax types not found or inactive.' }, { status: 400 });
        }
      }
      const itemRows = body.items.map((item, index) => {
        const lineType = getLineType(item);
        const qty = Number(item.quantityOrdered ?? 0);
        const unitCost = Number(item.unitCost ?? 0);
        const taxRatePct = Number(item.taxRate ?? 0);
        let lineSubtotal;
        let lineTaxAmount = Number(item.taxAmount ?? 0);
        if (pricesIncludeTax && taxRatePct > 0) {
          const lineTotalInclusive = qty * unitCost;
          lineSubtotal = lineTotalInclusive / (1 + taxRatePct / 100);
          lineTaxAmount = lineTotalInclusive - lineSubtotal;
        } else {
          lineSubtotal = qty * unitCost;
          if (lineTaxAmount === 0 && taxRatePct > 0) {
            lineTaxAmount = lineSubtotal * (taxRatePct / 100);
          }
        }
        lineSubtotal = round2(lineSubtotal);
        lineTaxAmount = round2(lineTaxAmount);
        return {
          lineNumber: index + 1,
          lineType,
          productId: item.productId || null,
          expenseCategoryId: item.expenseCategoryId || null,
          description: item.description?.trim() || null,
          quantityOrdered: new Prisma.Decimal(qty),
          unitCost: new Prisma.Decimal(unitCost),
          taxTypeId: item.taxTypeId && String(item.taxTypeId).trim() ? item.taxTypeId : null,
          taxRate: taxRatePct,
          taxAmount: lineTaxAmount,
          _lineSubtotal: lineSubtotal
        };
      });
      subtotal = round2(itemRows.reduce((sum, row) => sum + (row._lineSubtotal ?? Number(row.quantityOrdered) * Number(row.unitCost)), 0));
      taxAmount = round2(itemRows.reduce((sum, row) => sum + row.taxAmount, 0));
      headerTaxRate = subtotal > 0 ? round2((taxAmount / subtotal) * 100) : (body.taxRate ?? 0);
      data.items = {
        deleteMany: { purchaseOrderId: purchaseOrder.id },
        create: itemRows.map((row) => ({
          lineNumber: row.lineNumber,
          lineType: row.lineType,
          productId: row.productId,
          expenseCategoryId: row.expenseCategoryId,
          description: row.description,
          quantityOrdered: row.quantityOrdered,
          unitCost: row.unitCost,
          taxTypeId: row.taxTypeId,
          taxRate: row.taxRate,
          taxAmount: row.taxAmount
        }))
      };
    }

    data.subtotal = subtotal;
    data.taxAmount = taxAmount;
    data.totalAmount = round2(subtotal + taxAmount);
    data.taxRate = headerTaxRate;

    const updated = await prisma.purchaseOrder.update({
      where: { id: purchaseOrder.id },
      data,
      include: {
        supplier: { select: { supplierName: true, supplierCode: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, barcode: true } },
            expenseCategory: {
              select: {
                id: true,
                name: true,
                accountCode: true,
                account: { select: { accountCode: true, accountName: true } }
              }
            }
          }
        },
        expenses: { select: { id: true, description: true, amount: true, date: true, status: true } }
      }
    });

    return NextResponse.json({ purchaseOrder: updated });
  } catch (error) {
    console.error('Error updating purchase order:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update purchase order.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const purchaseOrder = await getPurchaseOrder(params.id, user.tenantId);
    if (!purchaseOrder) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    if (purchaseOrder.status === 'Cancelled') {
      return NextResponse.json(
        { error: 'This purchase order is already cancelled.' },
        { status: 400 }
      );
    }

    if (poHasGoodsReceiptActivity(purchaseOrder)) {
      return NextResponse.json(
        {
          error: `Cannot cancel PO ${purchaseOrder.poNumber} because goods have already been received on this order.`,
        },
        { status: 400 }
      );
    }

    // Reversal-only policy: do not hard-delete POs.
    // Cancel PO and reverse/cancel linked records for auditability.
    const reversalReason = `PO cancellation: ${purchaseOrder.poNumber}`;

    // If inventory receipts already exist, full accounting reversal is not automatic here.
    // Block cancellation to avoid partial/inconsistent rollback.
    const inventoryReceipt = await prisma.goodsReceipt.findFirst({
      where: {
        tenantId: user.tenantId,
        purchaseOrderId: purchaseOrder.id,
        items: { some: {} }
      },
      select: { id: true, receiptNumber: true }
    });
    if (inventoryReceipt) {
      return NextResponse.json(
        {
          error:
            `Cannot reverse PO ${purchaseOrder.poNumber} because inventory has already been received (${inventoryReceipt.receiptNumber || inventoryReceipt.id}). Reverse inventory/stock effects first, then cancel the PO.`
        },
        { status: 400 }
      );
    }

    const linkedBills = await prisma.supplierBill.findMany({
      where: { tenantId: user.tenantId, purchaseOrderId: purchaseOrder.id },
      select: {
        id: true,
        billNumber: true,
        status: true,
        amountPaid: true,
        totalAmount: true,
        notes: true,
        journalEntryId: true,
        supplierId: true
      }
    });

    const paidOrAllocatedBills = linkedBills.filter((bill) => Number(bill.amountPaid || 0) > 0);
    if (paidOrAllocatedBills.length > 0) {
      return NextResponse.json(
        {
          error:
            `Cannot reverse PO ${purchaseOrder.poNumber} because one or more linked bills have payments applied (${paidOrAllocatedBills.map((b) => b.billNumber || b.id).join(', ')}). Reverse those payments first.`
        },
        { status: 400 }
      );
    }

    const linkedExpenses = await prisma.expense.findMany({
      where: {
        tenantId: user.tenantId,
        purchaseOrderId: purchaseOrder.id,
        isReversal: false
      },
      select: { id: true }
    });

    // Reverse linked expenses through accounting-safe reversal service
    // (creates equal-and-opposite entries and preserves original rows).
    let reversedExpenses = 0;
    for (const expense of linkedExpenses) {
      const alreadyReversed = await prisma.expense.findFirst({
        where: {
          tenantId: user.tenantId,
          isReversal: true,
          reversedTransactionId: expense.id
        },
        select: { id: true }
      });
      if (alreadyReversed) continue;
      await createExpenseReversal({
        expenseId: expense.id,
        reversalReason,
        userId: user.id,
        tenantId: user.tenantId
      });
      reversedExpenses++;
    }

    // Reverse linked bill journal entries as well (includes bill tax lines).
    // This ensures tax effects are fully reversed, not just bill status changes.
    let reversedBillTransactions = 0;
    for (const bill of linkedBills) {
      if (!bill.journalEntryId) continue;
      const alreadyReversed = await prisma.transaction.findFirst({
        where: {
          tenantId: user.tenantId,
          isReversal: true,
          reversedTransactionId: bill.journalEntryId
        },
        select: { id: true }
      });
      if (alreadyReversed) continue;

      await createTransactionReversal({
        transactionId: bill.journalEntryId,
        reversalReason: `${reversalReason} (Bill ${bill.billNumber || bill.id})`,
        userId: user.id,
        tenantId: user.tenantId
      });
      reversedBillTransactions++;
    }

    const reversalSummary = await prisma.$transaction(async (tx) => {
      // Cancel linked unpaid bills (keep records visible for audit trail).
      let cancelledBills = 0;
      for (const bill of linkedBills) {
        if (bill.status === 'Cancelled') continue;
        await tx.supplierBill.update({
          where: { id: bill.id },
          data: {
            status: 'Cancelled',
            notes: [bill.notes, `CANCELLED via PO reversal ${purchaseOrder.poNumber} on ${new Date().toISOString()}`]
              .filter(Boolean)
              .join('\n')
          }
        });
        // Reverse supplier running balance impact from this bill.
        await tx.supplier.update({
          where: { id: bill.supplierId },
          data: {
            currentBalance: {
              decrement: Number(bill.totalAmount || 0)
            }
          }
        });
        cancelledBills++;
      }

      // Mark PO as cancelled (retain record).
      const updatedPo = await tx.purchaseOrder.update({
        where: { id: purchaseOrder.id },
        data: {
          status: 'Cancelled',
          notes: [purchaseOrder.notes, `CANCELLED (reversal): ${reversalReason}`].filter(Boolean).join('\n')
        },
        select: { id: true, status: true }
      });

      return { cancelledBills, updatedPo };
    });

    return NextResponse.json({
      success: true,
      purchaseOrderId: reversalSummary.updatedPo.id,
      status: reversalSummary.updatedPo.status,
      reversedExpenses,
      reversedBillTransactions,
      cancelledBills: reversalSummary.cancelledBills
    });
  } catch (error) {
    console.error('Error deleting purchase order:', error);
    return NextResponse.json(
      { error: 'Failed to delete purchase order.' },
      { status: 500 }
    );
  }
}

