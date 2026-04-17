import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, hasPermission } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';

/**
 * Cancel a **draft** booking only: removes availability and deletes the draft invoice (cascade removes rental transaction).
 * Posted invoices must be voided from Invoicing (reverses GL) before deleting operational data.
 */
export async function POST(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (!hasPermission(user, 'rentals.update') && !hasPermission(user, 'rentals.delete')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { transactionId } = body;
    if (!transactionId) {
      return NextResponse.json({ error: 'transactionId is required' }, { status: 400 });
    }

    const rt = await prisma.rentalTransaction.findFirst({
      where: { id: transactionId, tenantId: user.tenantId },
      include: { items: { include: { rentalAsset: true } }, invoice: true },
    });
    if (!rt) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }
    if (['completed', 'cancelled'].includes(rt.status)) {
      return NextResponse.json({ error: 'Transaction already closed' }, { status: 400 });
    }

    const invStatus = String(rt.invoice?.status || '').toLowerCase();
    if (invStatus !== 'draft') {
      return NextResponse.json(
        {
          error:
            'Only draft rental invoices can be cancelled here. Void the invoice from Invoicing if it was already posted.',
        },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      for (const item of rt.items) {
        if (item.rentalAsset.kind === 'rental') {
          await tx.rentalAsset.update({
            where: { id: item.rentalAssetId },
            data: { status: 'available' },
          });
        }
      }
      await tx.invoice.delete({ where: { id: rt.invoiceId } });
    });

    return NextResponse.json({ ok: true, transactionId });
  } catch (e) {
    console.error('[rentals cancel]', e);
    return NextResponse.json({ error: 'Failed to cancel' }, { status: 500 });
  }
}
