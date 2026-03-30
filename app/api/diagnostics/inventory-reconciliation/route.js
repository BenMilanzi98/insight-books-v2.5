import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

function toNumber(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const tenantId = user.tenantId;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '25', 10), 1), 200);
    const tolerance = Math.max(0, parseFloat(searchParams.get('tolerance') || '1'));

    // 1) Posted goods receipts total (this is what the Receipts page shows)
    const postedReceipts = await prisma.goodsReceipt.findMany({
      where: { tenantId, status: 'Posted' },
      select: { id: true, totalAmount: true },
    });
    const postedReceiptsTotal = postedReceipts.reduce((s, r) => s + toNumber(r.totalAmount), 0);

    // 2) Product valuation as used by inventory pages/dashboards (sum product.totalStockValue)
    const products = await prisma.product.findMany({
      where: { tenantId, isDeleted: false, isService: false },
      select: {
        id: true,
        name: true,
        sku: true,
        stockLevel: true,
        cost: true,
        averageCost: true,
        totalStockValue: true,
      },
    });
    const totalProductStoredValue = products.reduce((s, p) => s + toNumber(p.totalStockValue), 0);

    // 3) FIFO valuation (sum remaining inventory batches)
    const batches = await prisma.inventoryBatch.findMany({
      where: { tenantId, qtyRemaining: { gt: 0 } },
      select: { productId: true, qtyRemaining: true, unitCost: true, sourceType: true },
    });

    const fifoByProduct = new Map();
    const fifoBySourceType = new Map();
    for (const b of batches) {
      const v = toNumber(b.qtyRemaining) * toNumber(b.unitCost);
      fifoByProduct.set(b.productId, (fifoByProduct.get(b.productId) || 0) + v);
      const st = b.sourceType || 'Unknown';
      fifoBySourceType.set(st, (fifoBySourceType.get(st) || 0) + v);
    }
    const totalFifoValue = [...fifoByProduct.values()].reduce((s, v) => s + v, 0);

    // Divergences: where stored product.totalStockValue does not match FIFO valuation.
    const divergences = products
      .map((p) => {
        const stored = toNumber(p.totalStockValue);
        const fifo = fifoByProduct.get(p.id) || 0;
        const diff = stored - fifo;
        const absDiff = Math.abs(diff);
        return {
          productId: p.id,
          name: p.name,
          sku: p.sku,
          stockLevel: toNumber(p.stockLevel),
          storedTotalStockValue: stored,
          fifoTotalStockValue: fifo,
          diff,
          absDiff,
        };
      })
      .filter((row) => row.absDiff > tolerance)
      .sort((a, b) => b.absDiff - a.absDiff)
      .slice(0, limit);

    return NextResponse.json({
      summary: {
        postedReceiptsTotal,
        totalProductStoredValue,
        totalFifoValue,
        fifoBySourceType: Object.fromEntries([...fifoBySourceType.entries()].sort((a, b) => b[1] - a[1])),
        divergenceCount: divergences.length,
        tolerance,
      },
      divergences,
    });
  } catch (error) {
    console.error('inventory-reconciliation diagnostic error:', error);
    return NextResponse.json({ error: error.message || 'Failed to reconcile inventory' }, { status: 500 });
  }
}

