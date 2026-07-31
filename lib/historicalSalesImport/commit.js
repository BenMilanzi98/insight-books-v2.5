import { postPosSaleAccounting } from '../accountingV2/adapters/posSaleAdapter.js';
import { allocateNextSaleNumberReliable } from '../documentSequences.js';
import { toDateOnlyString } from './dates.js';

function saleNumberDatePrefixFromDate(d) {
  const iso = toDateOnlyString(d instanceof Date ? d : new Date(d));
  if (!iso) {
    const n = new Date();
    return `${n.getFullYear()}${String(n.getMonth() + 1).padStart(2, '0')}${String(n.getDate()).padStart(2, '0')}`;
  }
  return iso.replace(/-/g, '');
}

/**
 * Commit validated historical import rows.
 * Creates sales as custom lines — no product stock / FIFO changes.
 *
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} db
 * @param {{
 *   tenantId: string,
 *   userId: string,
 *   migrationBatch: string,
 *   rows: Array<Record<string, any>>,
 * }} input
 */
export async function commitHistoricalImportRows(db, input) {
  const { tenantId, userId, migrationBatch, rows } = input;
  const successful = [];
  const failed = [];

  for (const row of rows) {
    try {
      const sale = await createHistoricalSaleFromRow(db, {
        tenantId,
        userId,
        migrationBatch,
        row,
      });
      successful.push({
        rowNumber: row.rowNumber,
        saleId: sale.id,
        saleNumber: sale.saleNumber,
        date: row.dateOnly,
        total: row.total,
        customer: row.customer || 'Walk-in',
      });
    } catch (error) {
      failed.push({
        rowNumber: row.rowNumber,
        error: error?.message || String(error),
        description: row.description,
      });
    }
  }

  return { successful, failed, migrationBatch };
}

async function createHistoricalSaleFromRow(db, { tenantId, userId, migrationBatch, row }) {
  let clientId = null;
  if (row.customer) {
    const existing = await db.client.findFirst({
      where: {
        tenantId,
        name: { equals: row.customer, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (existing) {
      clientId = existing.id;
    } else {
      const slug =
        row.customer
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '.')
          .replace(/^\.+|\.+$/g, '') || 'customer';
      const created = await db.client.create({
        data: {
          name: row.customer,
          email: `${slug}.${Date.now()}@historical.local`,
          tenantId,
        },
        select: { id: true },
      });
      clientId = created.id;
    }
  }

  const datePrefix = saleNumberDatePrefixFromDate(row.date);
  let saleNumber;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const seq = await allocateNextSaleNumberReliable(db, tenantId);
    saleNumber = `SALE-${datePrefix}-${String(seq).padStart(3, '0')}`;
    const dup = await db.sale.findFirst({
      where: { tenantId, saleNumber },
      select: { id: true },
    });
    if (!dup) break;
  }
  if (!saleNumber) {
    throw new Error('Could not allocate sale number');
  }

  // Idempotency: same batch + original reference → return existing
  if (row.reference) {
    const existingSale = await db.sale.findFirst({
      where: {
        tenantId,
        isHistorical: true,
        migrationBatch,
        originalReference: row.reference,
      },
      select: { id: true, saleNumber: true, total: true },
    });
    if (existingSale) {
      return existingSale;
    }
  }

  const sale = await db.sale.create({
    data: {
      saleNumber,
      saleDate: row.date,
      subtotal: row.subtotal,
      totalTaxAmount: row.taxAmount,
      totalDiscountAmount: 0,
      total: row.total,
      status: 'completed',
      paymentMethod: row.paymentMethod,
      notes: row.notes || '',
      taxRate: row.taxPercent,
      taxAmount: row.taxAmount,
      isHistorical: true,
      historicalDate: row.date,
      migrationBatch,
      originalReference: row.reference,
      createdBy: { connect: { id: userId } },
      tenant: { connect: { id: tenantId } },
      ...(clientId ? { client: { connect: { id: clientId } } } : {}),
      items: {
        create: [
          {
            description: row.description,
            quantity: row.qty,
            unitPrice: row.unitPrice,
            amount: row.subtotal,
            taxRate: row.taxPercent,
            taxAmount: row.taxAmount,
            discountAmount: 0,
            discount: 0,
            isCustom: true,
            customProductData: {
              name: row.description,
              price: row.unitPrice,
              description: row.description,
              historicalImport: true,
              noStockImpact: true,
            },
          },
        ],
      },
    },
  });

  await db.payment.create({
    data: {
      saleId: sale.id,
      amount: row.total,
      paymentDate: row.date,
      paymentMethod: row.paymentMethod,
      reference: row.reference || `Historical Sale ${saleNumber}`,
      notes: `Historical import ${migrationBatch}`,
      status: 'Completed',
      tenantId,
      type: 'sale',
      sourceAccount: row.paymentMethod,
    },
  });

  await postPosSaleAccounting({
    db,
    tenantId,
    userId,
    saleId: sale.id,
    saleNumber: sale.saleNumber,
    saleDate: row.date,
    totalAmount: row.total,
    paymentMethod: row.paymentMethod,
    taxAmount: row.taxAmount,
    branchId: null,
  });

  if (db.auditLog?.create) {
    await db.auditLog.create({
      data: {
        action: 'HISTORICAL_BATCH_SALE_CREATED',
        entityType: 'SALE',
        entityId: sale.id,
        userId,
        tenantId,
        details: JSON.stringify({
          saleNumber: sale.saleNumber,
          total: sale.total,
          migrationBatch,
          originalReference: row.reference,
          rowNumber: row.rowNumber,
          dateOnly: row.dateOnly,
          stockImpact: 'NONE',
        }),
      },
    });
  }

  return sale;
}
