import prisma from '@/lib/prisma';
import { toMinor } from '../domain/money.js';
import {
  monthlyVelocity,
  suggestedDemandQty,
  reorderGapQty,
  suggestedPurchaseAmount,
  schedulePurchaseByMonth,
} from '../domain/demandVelocity.js';

/**
 * Product demand hints from invoice line quantities (read-only).
 */
export async function getProductDemandHints(
  tenantId,
  { lookbackMonths = 6, horizonMonths = 3, take = 25 } = {}
) {
  const end = new Date();
  const start = new Date(end);
  start.setUTCMonth(start.getUTCMonth() - Math.max(1, Number(lookbackMonths) || 6));

  const items = await prisma.invoiceItem.findMany({
    where: {
      productId: { not: null },
      invoice: {
        tenantId,
        isDeleted: false,
        status: { notIn: ['draft', 'void', 'voided', 'cancelled'] },
        issueDate: { gte: start, lte: end },
      },
    },
    select: {
      productId: true,
      quantity: true,
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          cost: true,
          averageCost: true,
          stockLevel: true,
          reorderPoint: true,
          isService: true,
          isDeleted: true,
          cogsAccountId: true,
          inventoryAccountId: true,
          incomeAccountId: true,
        },
      },
    },
    take: 5000,
  });

  const byProduct = new Map();
  for (const row of items) {
    const p = row.product;
    if (!p || p.isDeleted || p.isService) continue;
    const cur = byProduct.get(p.id) || { product: p, qtySold: 0 };
    cur.qtySold += Number(row.quantity) || 0;
    byProduct.set(p.id, cur);
  }

  const lookback = Math.max(1, Number(lookbackMonths) || 6);
  const horizon = Math.max(1, Number(horizonMonths) || 3);

  const rows = [...byProduct.values()]
    .map(({ product, qtySold }) => {
      const avgMonthly = monthlyVelocity(qtySold, lookback);
      const demandQty = suggestedDemandQty(avgMonthly, horizon);
      const unitCost = Number(product.averageCost || product.cost || 0) || 0;
      const gapQty = reorderGapQty({
        stockLevel: product.stockLevel,
        reorderPoint: product.reorderPoint,
        demandQty,
      });
      const purchaseAmount = suggestedPurchaseAmount(gapQty, unitCost);
      return {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        qtySold,
        avgMonthlyQty: Math.round(avgMonthly * 100) / 100,
        demandQty,
        stockLevel: Number(product.stockLevel) || 0,
        reorderPoint: product.reorderPoint ?? null,
        gapQty,
        unitCost,
        purchaseAmount,
        cogsAccountId: product.cogsAccountId || null,
        inventoryAccountId: product.inventoryAccountId || null,
        incomeAccountId: product.incomeAccountId || null,
      };
    })
    .sort((a, b) => b.purchaseAmount - a.purchaseAmount || b.qtySold - a.qtySold)
    .slice(0, Math.max(1, Number(take) || 25));

  const totalPurchase = rows.reduce((s, r) => s + r.purchaseAmount, 0);

  return {
    lookbackMonths: lookback,
    horizonMonths: horizon,
    products: rows,
    totals: { purchaseAmount: Math.round(totalPurchase * 100) / 100 },
    note: 'Read-only demand hints from invoice quantities. Does not create POs or stock movements.',
  };
}

/**
 * Build forecast line drafts (major → minor) for INVENTORY_DEMAND method.
 */
export async function buildInventoryDemandLines(tenantId, { periodsCount = 3, lookbackMonths = 6 } = {}) {
  const hints = await getProductDemandHints(tenantId, {
    lookbackMonths,
    horizonMonths: periodsCount,
    take: 50,
  });

  const byAccount = new Map();
  for (const p of hints.products) {
    const accountId = p.cogsAccountId || p.inventoryAccountId;
    if (!accountId || !p.purchaseAmount) continue;
    byAccount.set(accountId, (byAccount.get(accountId) || 0) + p.purchaseAmount);
  }

  // Fallback: if no product accounts, leave empty (caller may error)
  const lines = [];
  for (const [accountId, amountMajor] of byAccount) {
    const totalMinor = toMinor(amountMajor);
    const schedule = schedulePurchaseByMonth(totalMinor, periodsCount);
    lines.push({
      accountId,
      forecastMethod: 'INVENTORY_DEMAND',
      historicalActualMinor: 0,
      budgetAmountMinor: 0,
      projectedAmountMinor: totalMinor,
      periods: schedule,
    });
  }

  return { hints, lines };
}
