import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';

/**
 * Backfill open inventory batches with missing expiryDate from Product.expiryDate.
 * Scope: current tenant only.
 *
 * This is intended as a one-time recovery tool after enabling batch-level expiry.
 */
export async function POST(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const candidates = await prisma.inventoryBatch.findMany({
      where: {
        tenantId: user.tenantId,
        expiryDate: null,
        qtyRemaining: { gt: 0 },
        product: {
          isDeleted: false,
          isService: false,
          isPerishable: true,
          expiryDate: { not: null },
        },
      },
      select: {
        id: true,
        productId: true,
        product: {
          select: {
            expiryDate: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (candidates.length === 0) {
      return NextResponse.json({
        message: 'No batches needed backfill',
        scanned: 0,
        updated: 0,
        updatedBatchIds: [],
      });
    }

    const updates = candidates
      .filter((row) => row.product?.expiryDate)
      .map((row) =>
        prisma.inventoryBatch.update({
          where: { id: row.id },
          data: { expiryDate: row.product.expiryDate },
          select: { id: true },
        })
      );

    const updatedRows = updates.length ? await prisma.$transaction(updates) : [];

    return NextResponse.json({
      message: 'Batch expiry backfill completed',
      scanned: candidates.length,
      updated: updatedRows.length,
      updatedBatchIds: updatedRows.map((r) => r.id),
    });
  } catch (error) {
    console.error('[expiry-alerts/backfill]', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to run backfill' },
      { status: 500 }
    );
  }
}
