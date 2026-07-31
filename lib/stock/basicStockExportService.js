/**
 * Basic four-column stock export for the current Business.
 * Order Price = WAC (Hybrid display).
 */

import prisma from '../prisma.js';
import { resolveOrderPriceForExport } from './weightedAverageCost.js';
import { buildBasicStockWorkbookBuffer } from './basicStockWorkbook.js';

/**
 * @param {{ tenantId: string, search?: string|null, db?: import('@prisma/client').PrismaClient }} params
 */
export async function listBasicStockExportRows({ tenantId, search = null, db = prisma }) {
  if (!tenantId) throw new Error('tenantId is required');

  const where = {
    tenantId,
    isDeleted: false,
    isService: false,
  };
  if (search?.trim()) {
    const q = search.trim();
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { sku: { contains: q, mode: 'insensitive' } },
      { barcode: { contains: q, mode: 'insensitive' } },
    ];
  }

  const products = await db.product.findMany({
    where,
    select: {
      id: true,
      name: true,
      stockLevel: true,
      totalStockValue: true,
      averageCost: true,
      cost: true,
      price: true,
    },
    orderBy: { name: 'asc' },
  });

  return products.map((p) => {
    const quantity = Number(p.stockLevel ?? 0) || 0;
    const totalValue = Number(p.totalStockValue ?? 0) || 0;
    return {
      productId: p.id,
      itemName: p.name,
      quantity,
      orderPrice: resolveOrderPriceForExport({
        quantity,
        totalValue,
        averageCost: p.averageCost ?? p.cost ?? 0,
      }),
      sellingPrice: Number(p.price ?? 0) || 0,
    };
  });
}

export async function exportBasicStockWorkbook({ tenantId, search = null, businessName = 'Business', db = prisma }) {
  const rows = await listBasicStockExportRows({ tenantId, search, db });
  const buffer = await buildBasicStockWorkbookBuffer(
    rows.map((r) => ({
      itemName: r.itemName,
      quantity: r.quantity,
      orderPrice: r.orderPrice,
      sellingPrice: r.sellingPrice,
    }))
  );
  const date = new Date().toISOString().slice(0, 10);
  const safe = String(businessName || 'Business').replace(/[^\w\-]+/g, '_').slice(0, 40);
  return {
    buffer,
    filename: `Stock_Export_${safe}_${date}.xlsx`,
    rowCount: rows.length,
  };
}
