import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';

/**
 * PATCH — Mark a receipt notice as read (id = StockTransferReceiptNotice id).
 */
export async function PATCH(request, { params }) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    let updated = await prisma.stockTransferReceiptNotice.updateMany({
      where: { id, tenantId: user.tenantId },
      data: { readAt: new Date() },
    });

    if (updated.count === 0) {
      const xfer = await prisma.stockTransfer.findFirst({
        where: {
          id,
          status: 'received',
          tenantId: { not: user.tenantId },
          toBranch: { tenantId: user.tenantId, isActive: true },
        },
        select: { id: true, tenantId: true },
      });
      if (xfer) {
        try {
          await prisma.stockTransferReceiptNotice.upsert({
            where: { stockTransferId: id },
            create: {
              tenantId: user.tenantId,
              stockTransferId: id,
              sourceTenantId: xfer.tenantId,
              readAt: new Date(),
            },
            update: { readAt: new Date() },
          });
        } catch {
          // Table may be missing; treat as acknowledged for UI
        }
        return NextResponse.json({ ok: true });
      }
      return NextResponse.json({ error: 'Notice not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('stock-transfer-receipts PATCH:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}
