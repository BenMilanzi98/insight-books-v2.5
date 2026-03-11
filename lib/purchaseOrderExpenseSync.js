/**
 * Creates expense records for service lines of an approved Purchase Order
 * so that approved POs link directly to expenses (services → expenses).
 * Goods POs link to inventory/operations via Goods Receipt flow.
 */

import prisma from './prisma';
import { getOrCreateExpenseAccountForCategory } from './expenseCategoryNormalization';

/**
 * For an approved PO, create one expense per service line that doesn't already
 * have an expense. Amount = line subtotal + line tax so the expense is recorded correctly.
 * @param {string} purchaseOrderId
 * @param {string} tenantId
 * @param {string} userId - submittedById for created expenses
 * @param {import('@prisma/client').PrismaClient} [tx] - optional transaction client
 * @returns {{ created: number, skipped: number }}
 */
export async function syncExpensesFromPurchaseOrder(purchaseOrderId, tenantId, userId, tx = prisma) {
  const po = await tx.purchaseOrder.findFirst({
    where: { id: purchaseOrderId, tenantId },
    include: {
      items: { include: { expenseCategory: { include: { account: true } } } },
      supplier: true
    }
  });
  if (!po || po.status !== 'Approved') return { created: 0, skipped: 0 };

  const serviceItems = po.items.filter(
    (item) => (item.lineType || 'goods') === 'service' || (!item.productId && item.description)
  );
  if (serviceItems.length === 0) return { created: 0, skipped: 0 };

  const existingByItemId = new Set(
    (
      await tx.expense.findMany({
        where: { purchaseOrderId, purchaseOrderItemId: { not: null } },
        select: { purchaseOrderItemId: true }
      })
    )
      .map((e) => e.purchaseOrderItemId)
      .filter(Boolean)
  );

  let created = 0;
  const poDate = po.poDate || new Date();

  for (const item of serviceItems) {
    if (existingByItemId.has(item.id)) {
      continue;
    }
    const lineSubtotal = Number(item.quantityOrdered || 0) * Number(item.unitCost || 0);
    const lineTax = Number(item.taxAmount || 0);
    const amount = lineSubtotal + lineTax;
    if (amount <= 0) continue;

    let expenseAccount = null;
    let categoryName = 'Other';
    let categoryId = null;

    if (item.expenseCategoryId && item.expenseCategory?.account) {
      expenseAccount = item.expenseCategory.account;
      categoryName = item.expenseCategory.name;
      categoryId = item.expenseCategory.id;
    }

    if (!expenseAccount) {
      try {
        expenseAccount = await getOrCreateExpenseAccountForCategory(tenantId, categoryName);
      } catch (err) {
        const fallback = await tx.account.findFirst({
          where: { tenantId, accountType: 'Expense', isActive: true },
          orderBy: { accountCode: 'asc' }
        });
        if (!fallback) continue;
        expenseAccount = fallback;
        categoryName = fallback.accountName;
      }
    }

    const description =
      item.description?.trim() || (item.productId ? `PO line ${item.lineNumber}` : `Service - PO ${po.poNumber} line ${item.lineNumber}`);

    await tx.expense.create({
      data: {
        tenantId,
        submittedById: userId,
        description,
        amount,
        taxAmount: lineTax,
        taxRate: item.taxRate != null ? Number(item.taxRate) : null,
        date: poDate,
        category: categoryName,
        categoryId,
        expenseAccountId: expenseAccount.id,
        status: 'Approved',
        notes: `From PO ${po.poNumber} (line ${item.lineNumber}). Tax: ${lineTax.toFixed(2)} ${po.currency || 'MWK'}.`,
        supplierId: po.supplierId,
        purchaseOrderId: po.id,
        purchaseOrderItemId: item.id
      }
    });
    created++;
  }

  return { created, skipped: serviceItems.length - created };
}
