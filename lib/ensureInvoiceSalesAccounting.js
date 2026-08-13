/**
 * Idempotent invoice issue accounting: AR + Deferred Revenue + VAT (Journal A) + Invoice-COGS + stock.
 * Does NOT post Sales Revenue — that happens on payment recognition (Task 6).
 * Used when leaving Draft, on create (non-draft), and on first/partial payment
 * so issue journals and COGS hit the GL even if payment lands before formal issue.
 */

import { postInvoiceAccounting, postCostOfSalesAccounting } from '@/lib/accountingV2/adapters';
import { calculateCOGS } from '@/lib/inventoryCosting';
import { addMoney, parseMoney } from '@/lib/money';

/**
 * @param {object} params
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} params.db
 * @param {string} params.tenantId
 * @param {string} params.userId
 * @param {string} params.invoiceId
 * @param {boolean} [params.force] — post issue+COGS even when status is Draft (payment path)
 * @param {(k: string) => boolean} [params.hasPermission]
 * @returns {Promise<{
 *   skipped?: string,
 *   postedInvoice: boolean, — true when Journal A (AR/Deferred/VAT) was posted; never Sales Revenue
 *   postedCogs: boolean,
 *   stockDeducted: boolean,
 *   cogsAmount: number,
 * }>}
 */
export async function ensureInvoiceSalesAccounting({
  db,
  tenantId,
  userId,
  invoiceId,
  force = false,
  hasPermission = () => true,
}) {
  const invoice = await db.invoice.findFirst({
    where: { id: invoiceId, tenantId },
    include: {
      items: {
        select: {
          productId: true,
          quantity: true,
          description: true,
        },
      },
    },
  });

  if (!invoice) {
    throw new Error('Invoice not found for issue accounting');
  }

  const status = String(invoice.status || '');
  if (!force && status.toLowerCase() === 'draft') {
    return {
      skipped: 'draft',
      postedInvoice: false,
      postedCogs: false,
      stockDeducted: false,
      cogsAmount: 0,
    };
  }
  if (String(status).toUpperCase() === 'PROFORMA' && !force) {
    return {
      skipped: 'proforma',
      postedInvoice: false,
      postedCogs: false,
      stockDeducted: false,
      cogsAmount: 0,
    };
  }

  const existingInvoiceJe = await db.journalEntry.findFirst({
    where: {
      tenantId,
      sourceType: 'Invoice',
      sourceId: invoice.id,
      status: { in: ['Posted', 'POSTED', 'posted'] },
    },
    select: { id: true },
  });

  const existingCogsJe = await db.journalEntry.findFirst({
    where: {
      tenantId,
      sourceType: 'Invoice-COGS',
      sourceId: invoice.id,
      status: { in: ['Posted', 'POSTED', 'posted'] },
    },
    select: { id: true },
  });

  // Journal A: Dr AR / Cr Deferred Revenue / Cr VAT — not Sales Revenue (see CUSTOMER_INVOICE template).
  let postedInvoice = false;
  if (!existingInvoiceJe) {
    await postInvoiceAccounting({
      db,
      tenantId,
      userId,
      invoiceId: invoice.id,
      hasPermission,
    });
    postedInvoice = true;
  }

  let totalCOGS = 0;
  let stockDeducted = false;

  if (!existingCogsJe) {
    for (const item of invoice.items || []) {
      if (!item.productId) continue;
      try {
        const product = await db.product.findUnique({
          where: { id: item.productId },
          select: { id: true, isService: true, stockLevel: true, name: true },
        });
        if (!product || product.isService) continue;

        const qty = parseMoney(item.quantity);
        if (
          qty > 0 &&
          product.stockLevel !== null &&
          Number(product.stockLevel) < qty
        ) {
          throw new Error(
            `Insufficient stock for "${product.name}". Available: ${product.stockLevel}, Requested: ${qty}`
          );
        }

        const cogsData = await calculateCOGS({
          productId: item.productId,
          tenantId,
          quantitySold: item.quantity,
          tx: db,
        });
        totalCOGS = addMoney(totalCOGS, cogsData.cogsAmount);

        if (qty > 0) {
          const alreadyDeducted = await db.inventoryTransaction.findFirst({
            where: {
              tenantId,
              productId: item.productId,
              type: 'invoice',
              notes: { contains: invoice.invoiceNumber },
            },
            select: { id: true },
          });
          if (!alreadyDeducted) {
            await db.product.update({
              where: { id: item.productId },
              data: { stockLevel: { decrement: qty } },
            });
            try {
              await db.inventoryTransaction.create({
                data: {
                  productId: item.productId,
                  type: 'invoice',
                  quantity: -Math.round(qty),
                  notes: `Invoice ${invoice.invoiceNumber}`,
                  userId,
                  tenantId,
                },
              });
            } catch (e) {
              if (!e.message?.includes('Unknown model')) {
                console.warn('InventoryTransaction for invoice:', e?.message);
              }
            }
            stockDeducted = true;
          }
        }
      } catch (cogsError) {
        console.error(
          `ensureInvoiceSalesAccounting COGS failed for product ${item.productId}:`,
          cogsError
        );
        throw cogsError;
      }
    }

    if (totalCOGS > 0) {
      await postCostOfSalesAccounting({
        db,
        tenantId,
        userId,
        documentKind: 'Invoice',
        documentId: invoice.id,
        documentNumber: invoice.invoiceNumber,
        documentDate: invoice.issueDate,
        cogsAmount: totalCOGS,
        branchId: invoice.branchId || null,
        hasPermission,
      });
    }
  }

  return {
    postedInvoice,
    postedCogs: !existingCogsJe && totalCOGS > 0,
    stockDeducted,
    cogsAmount: totalCOGS,
  };
}
