import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, hasPermission } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';

export async function POST(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (!hasPermission(user, 'rentals.update') && !hasPermission(user, 'rentals.create')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { transactionId } = body;
    if (!transactionId) {
      return NextResponse.json({ error: 'transactionId is required' }, { status: 400 });
    }

    const rt = await prisma.rentalTransaction.findFirst({
      where: { id: transactionId, tenantId: user.tenantId },
      include: { items: { include: { rentalAsset: true } } },
    });
    if (!rt) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }
    if (['completed', 'cancelled'].includes(rt.status)) {
      return NextResponse.json({ error: 'Transaction already closed' }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.rentalAssetAvailability.deleteMany({ where: { rentalTransactionId: rt.id } });
      await tx.rentalTransaction.update({
        where: { id: rt.id },
        data: { status: 'completed' },
      });

      for (const item of rt.items) {
        if (item.rentalAsset.kind === 'rental') {
          const still = await tx.rentalAssetAvailability.count({
            where: {
              rentalAssetId: item.rentalAssetId,
              rentalTransaction: { status: { in: ['booked', 'active', 'overdue'] } },
            },
          });
          if (still === 0) {
            await tx.rentalAsset.update({
              where: { id: item.rentalAssetId },
              data: { status: 'available' },
            });
          }
        }
      }
    });

    return NextResponse.json({ ok: true, transactionId });
  } catch (e) {
    console.error('[rentals complete]', e);
    return NextResponse.json({ error: 'Failed to complete' }, { status: 500 });
  }
}
