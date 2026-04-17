import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, hasPermission } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';

/**
 * Partial return for hiring: reduces blocked quantity on the availability row and increments returnedQuantity on the line.
 */
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
    const { rentalItemId, quantity } = body;
    if (!rentalItemId || quantity == null) {
      return NextResponse.json({ error: 'rentalItemId and quantity are required' }, { status: 400 });
    }
    const q = Math.max(1, Math.floor(Number(quantity) || 0));

    const item = await prisma.rentalItem.findFirst({
      where: { id: rentalItemId },
      include: {
        rentalAsset: true,
        rentalTransaction: true,
      },
    });
    if (!item || item.rentalTransaction.tenantId !== user.tenantId) {
      return NextResponse.json({ error: 'Line not found' }, { status: 404 });
    }
    if (item.rentalAsset.kind !== 'hiring') {
      return NextResponse.json({ error: 'Partial returns apply to hiring lines only' }, { status: 400 });
    }
    if (!['booked', 'active', 'overdue'].includes(item.rentalTransaction.status)) {
      return NextResponse.json({ error: 'Booking is not active' }, { status: 400 });
    }

    const already = item.returnedQuantity || 0;
    const remaining = item.quantity - already;
    if (q > remaining) {
      return NextResponse.json(
        { error: `Cannot return ${q}; only ${remaining} unit(s) still out on this line.` },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.rentalItem.update({
        where: { id: item.id },
        data: { returnedQuantity: already + q },
      });

      const slot = await tx.rentalAssetAvailability.findFirst({
        where: {
          rentalTransactionId: item.rentalTransactionId,
          rentalAssetId: item.rentalAssetId,
        },
      });
      if (slot) {
        const nextQty = Math.max(0, slot.quantity - q);
        if (nextQty === 0) {
          await tx.rentalAssetAvailability.delete({ where: { id: slot.id } });
        } else {
          await tx.rentalAssetAvailability.update({
            where: { id: slot.id },
            data: { quantity: nextQty },
          });
        }
      }
    });

    return NextResponse.json({ ok: true, rentalItemId, returned: q });
  } catch (e) {
    console.error('[rentals items return]', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
