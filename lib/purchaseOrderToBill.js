/**
 * Creates a SupplierBill from a received service (or mixed) Purchase Order
 * so the PO appears in Bills/Payables for payment processing at receipt stage.
 * Inventory POs use Goods Receipt → Bill flow; service POs use this flow.
 */

import prisma from './prisma';
import { getOrCreateExpenseAccountForCategory } from './expenseCategoryNormalization';
import { finalizeExpenseBill } from './supplierBillExpenseFinalize';

/**
 * For a received service/mixed PO, create one SupplierBill linked to the PO
 * so it shows in Bills/Payables. Idempotent: if a bill already exists for this PO, returns it.
 * @param {string} purchaseOrderId
 * @param {string} tenantId
 * @param {string} [userId] - createdById for the bill
 * @param {import('@prisma/client').PrismaClient} [tx] - optional transaction client
 * @returns {{ bill: object | null, created: boolean }}
 */
export async function createBillFromApprovedServicePO(purchaseOrderId, tenantId, userId = null, tx = prisma) {
  const po = await tx.purchaseOrder.findFirst({
    where: { id: purchaseOrderId, tenantId },
    include: {
      items: { include: { expenseCategory: { include: { account: true } } } },
      supplier: true
    }
  });
  // Only create a payable once receipt is confirmed (PO moved to Received).
  if (!po || po.status !== 'Received') return { bill: null, created: false };

  const serviceItems = po.items.filter(
    (item) => (item.lineType || 'goods') === 'service' || (!item.productId && item.description)
  );
  if (serviceItems.length === 0) return { bill: null, created: false };

  // Idempotent: if a bill already linked to this PO, return it (post GL once if missing)
  const existing = await tx.supplierBill.findFirst({
    where: { purchaseOrderId: po.id, tenantId },
    include: { items: true }
  });
  if (existing) {
    if (!existing.journalEntryId && userId) {
      const fullBill = await tx.supplierBill.findFirst({
        where: { id: existing.id },
        include: {
          supplier: { select: { supplierName: true, supplierCode: true } },
          items: true,
        },
      });
      if (fullBill) {
        await finalizeExpenseBill(tx, fullBill, tenantId, userId);
      }
    }
    return { bill: existing, created: false };
  }

  const poDate = po.poDate ? new Date(po.poDate) : new Date();
  const paymentTerms = po.paymentTerms ?? 30;
  const dueDate = new Date(poDate);
  dueDate.setDate(dueDate.getDate() + paymentTerms);

  let subtotal = 0;
  let taxTotal = 0;
  const billItems = [];

  for (let i = 0; i < serviceItems.length; i++) {
    const item = serviceItems[i];
    const qty = Number(item.quantityOrdered ?? 0);
    const unitCost = Number(item.unitCost ?? 0);
    const lineSubtotal = qty * unitCost;
    const lineTax = Number(item.taxAmount ?? 0);
    const lineTotal = lineSubtotal + lineTax;
    if (lineTotal <= 0) continue;

    subtotal += lineSubtotal;
    taxTotal += lineTax;

    let expenseAccountId = null;
    if (item.expenseCategoryId && item.expenseCategory?.account) {
      expenseAccountId = item.expenseCategory.account.id;
    }
    if (!expenseAccountId) {
      try {
        const cat = item.expenseCategory?.name || 'Other';
        const account = await getOrCreateExpenseAccountForCategory(tenantId, cat);
        if (account && account.id) expenseAccountId = account.id;
      } catch (_) {
        const fallback = await tx.account.findFirst({
          where: { tenantId, accountType: 'Expense', isActive: true },
          orderBy: { accountCode: 'asc' }
        });
        if (fallback) expenseAccountId = fallback.id;
      }
    }

    billItems.push({
      lineNumber: i + 1,
      productId: null,
      expenseAccountId,
      description: item.description?.trim() || `Service - PO ${po.poNumber} line ${item.lineNumber}`,
      quantity: null,
      unitCost: lineTotal,
      lineTotal,
      taxRate: item.taxRate ?? 0,
      taxAmount: lineTax
    });
  }

  if (billItems.length === 0) return { bill: null, created: false };

  const totalAmount = subtotal + taxTotal;
  const billNumber = await generateUniqueBillNumber(tx, tenantId, po.poNumber);

  const bill = await tx.supplierBill.create({
    data: {
      tenantId,
      supplierId: po.supplierId,
      purchaseOrderId: po.id,
      billNumber,
      billDate: poDate,
      dueDate,
      billType: 'expense',
      subtotal,
      taxAmount: taxTotal,
      totalAmount,
      amountPaid: 0,
      status: 'Unpaid',
      paymentTerms,
      currency: po.currency || 'MWK',
      notes: po.notes ? `From PO ${po.poNumber}` : null,
      createdById: userId,
      finalizedAt: new Date(),
      finalizedById: userId,
      items: {
        create: billItems.map((it) => ({
          lineNumber: it.lineNumber,
          productId: it.productId,
          expenseAccountId: it.expenseAccountId,
          description: it.description,
          quantity: it.quantity,
          unitCost: it.unitCost,
          lineTotal: it.lineTotal,
          taxRate: it.taxRate,
          taxAmount: it.taxAmount
        }))
      }
    },
    include: {
      supplier: { select: { supplierName: true, supplierCode: true } },
      items: true
    }
  });

  if (userId) {
    const fullBill = await tx.supplierBill.findFirst({
      where: { id: bill.id },
      include: {
        supplier: { select: { supplierName: true, supplierCode: true } },
        items: true,
      },
    });
    if (fullBill && !fullBill.journalEntryId) {
      await finalizeExpenseBill(tx, fullBill, tenantId, userId);
    }
  }

  return { bill, created: true };
}

async function generateUniqueBillNumber(tx, tenantId, poNumber) {
  const base = `BILL-PO-${(poNumber || '').trim() || 'PO'}`;
  let candidate = base;
  let n = 0;
  while (true) {
    const exists = await tx.supplierBill.findFirst({
      where: { billNumber: candidate }
    });
    if (!exists) return candidate;
    n++;
    candidate = `${base}-${n}`;
  }
}
