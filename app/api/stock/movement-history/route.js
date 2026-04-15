// app/api/stock/movement-history/route.js
/**
 * Stock Movement History API
 * Returns a complete timeline of inventory activity for each item:
 * - Stock ins, stock outs, stock adjustments
 * Used for accurate tracking and auditability.
 */
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

// Normalize type for qty in/out (matches lib/stockMovementService.js)
const QTY_IN_TYPES = ['goods_receipt', 'goods receipt', 'purchase', 'stock in', 'stock_in', 'refund_restoration', 'sale_refund', 'sales_return', 'sales return', 'void_restoration', 'reversal_restoration'];
const QTY_OUT_TYPES = ['sale', 'stock out', 'stock_out', 'purchase_return', 'purchase return'];

function normalizeType(type) {
  return (type || '').toLowerCase().trim().replace(/\s+/g, '_');
}

function deltaFromTransaction(t) {
  const type = normalizeType(t.type);
  const qty = Number(t.quantity) || 0;
  if (QTY_IN_TYPES.some(x => type === x.toLowerCase().replace(/\s+/g, '_'))) return Math.max(0, qty);
  if (QTY_OUT_TYPES.some(x => type === x.toLowerCase().replace(/\s+/g, '_'))) return -Math.abs(qty);
  return qty; // adjustment: quantity is already signed
}

export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const branchId = searchParams.get('branchId') || user.currentBranchId || null;
    const limit = Math.min(parseInt(searchParams.get('limit'), 10) || 500, 1000);
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    const order = searchParams.get('order') || 'desc'; // 'desc' = newest first, 'asc' = timeline (oldest first)

    const where = {
      tenantId: user.tenantId
    };
    if (productId) where.productId = productId;
    if (branchId) where.branchId = branchId;
    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = new Date(fromDate);
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const transactions = await prisma.inventoryTransaction.findMany({
      where,
      orderBy: { createdAt: order === 'asc' ? 'asc' : 'desc' },
      take: limit,
      include: {
        product: { select: { id: true, name: true, sku: true } },
        user: { select: { id: true, name: true } }
      }
    });

    // Compute running balance when we have a single product and asc order (timeline)
    const withBalance = [];
    if (productId && order === 'asc' && transactions.length > 0) {
      // Get opening balance (sum of all movements before the earliest in this set would require another query; we use 0 and relative balance from first row)
      let running = 0;
      for (const t of transactions) {
        const delta = deltaFromTransaction(t);
        running += delta;
        withBalance.push({
          id: t.id,
          type: t.type,
          quantity: t.quantity,
          notes: t.notes,
          createdAt: t.createdAt,
          product: t.product,
          user: t.user,
          productId: t.productId,
          branchId: t.branchId,
          delta,
          balanceAfter: running
        });
      }
    } else {
      for (const t of transactions) {
        const delta = deltaFromTransaction(t);
        withBalance.push({
          id: t.id,
          type: t.type,
          quantity: t.quantity,
          notes: t.notes,
          createdAt: t.createdAt,
          product: t.product,
          user: t.user,
          productId: t.productId,
          branchId: t.branchId,
          delta
        });
      }
    }

    return NextResponse.json({
      movements: withBalance,
      total: withBalance.length
    });
  } catch (error) {
    console.error('Error fetching stock movement history:', error);
    return NextResponse.json(
      { error: 'Failed to load stock movement history.' },
      { status: 500 }
    );
  }
}
