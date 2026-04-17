import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, hasPermission } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { releaseExpiredRentals } from '@/lib/rentalLifecycle';

export async function GET(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (
      !hasPermission(user, 'rentals.view') &&
      !hasPermission(user, 'rentals.create') &&
      !hasPermission(user, 'invoices.create')
    ) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    await releaseExpiredRentals(prisma, user.tenantId);

    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const kind = searchParams.get('kind');
    const rentalAssetId = searchParams.get('rentalAssetId');

    const start = from ? new Date(from) : new Date();
    const end = to ? new Date(to) : new Date(start.getTime() + 30 * 86400000);
    if (!(end > start)) {
      return NextResponse.json({ error: 'Invalid range' }, { status: 400 });
    }

    const slots = await prisma.rentalAssetAvailability.findMany({
      where: {
        startAt: { lt: end },
        endAt: { gt: start },
        ...(rentalAssetId ? { rentalAssetId } : {}),
        rentalTransaction: {
          tenantId: user.tenantId,
          status: { in: ['booked', 'active', 'overdue'] },
          ...(kind && ['rental', 'hiring'].includes(kind) ? { kind } : {}),
        },
      },
      include: {
        rentalAsset: { select: { id: true, name: true, kind: true, category: true } },
        rentalTransaction: {
          include: {
            client: { select: { id: true, name: true } },
            invoice: { select: { id: true, invoiceNumber: true, status: true } },
          },
        },
      },
      orderBy: { startAt: 'asc' },
    });

    return NextResponse.json({ from: start.toISOString(), to: end.toISOString(), events: slots });
  } catch (e) {
    console.error('[rentals calendar]', e);
    return NextResponse.json({ error: 'Failed to load calendar' }, { status: 500 });
  }
}
