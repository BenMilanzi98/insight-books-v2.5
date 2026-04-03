import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { applyGoodsReceiptInventoryPosting } from '@/lib/applyGoodsReceiptInventoryPosting';
import { isReceiptDateOnOrBeforeTodayUTC } from '@/lib/goodsReceiptDateUtils';

/**
 * Applies FIFO/stock, GL, and supplier bills for posted goods receipts whose receipt date
 * is today or earlier (UTC calendar) but inventory was deferred (future dated at creation).
 */
async function runApplyDeferredGoodsReceipts() {
  const now = new Date();
  const candidates = await prisma.goodsReceipt.findMany({
    where: {
      status: 'Posted',
      inventoryAppliedAt: null,
      items: { some: {} },
    },
    include: {
      items: true,
      supplier: true,
      purchaseOrder: true,
    },
    take: 200,
    orderBy: { receiptDate: 'asc' },
  });

  const due = candidates.filter((r) => isReceiptDateOnOrBeforeTodayUTC(r.receiptDate));

  const results = { processed: 0, skipped: 0, errors: [] };

  for (const receipt of due) {
    try {
      if (!receipt.receivedById) {
        results.skipped++;
        continue;
      }
      const actingUser = await prisma.user.findUnique({
        where: { id: receipt.receivedById },
      });
      if (!actingUser || actingUser.tenantId !== receipt.tenantId) {
        results.skipped++;
        continue;
      }

      await prisma.$transaction(async (tx) => {
        const locked = await tx.goodsReceipt.findFirst({
          where: {
            id: receipt.id,
            inventoryAppliedAt: null,
            status: 'Posted',
          },
          include: { items: true },
        });
        if (!locked?.items?.length) return;

        await applyGoodsReceiptInventoryPosting(tx, {
          goodsReceipt: locked,
          tenantId: receipt.tenantId,
          userId: receipt.receivedById,
          actingUser,
          supplier: receipt.supplier,
          purchaseOrder: receipt.purchaseOrder,
          totalAmount: Number(receipt.totalAmount || 0),
          requestBranchId: null,
        });
      });

      results.processed++;
    } catch (err) {
      console.error(`apply-deferred-goods-receipts: failed for ${receipt.id}`, err);
      results.errors.push({ id: receipt.id, message: err.message });
    }
  }

  return { ...results, checkedAt: now.toISOString() };
}

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const summary = await runApplyDeferredGoodsReceipts();
    return NextResponse.json({ success: true, ...summary });
  } catch (error) {
    console.error('apply-deferred-goods-receipts cron error:', error);
    return NextResponse.json(
      { error: error.message || 'Cron failed' },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  return POST(request);
}
