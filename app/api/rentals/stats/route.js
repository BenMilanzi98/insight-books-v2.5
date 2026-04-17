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

    const [rentalAssets, hiringAssets, activeTx] = await Promise.all([
      prisma.rentalAsset.count({ where: { tenantId: user.tenantId, isActive: true, kind: 'rental' } }),
      prisma.rentalAsset.count({ where: { tenantId: user.tenantId, isActive: true, kind: 'hiring' } }),
      prisma.rentalTransaction.count({
        where: {
          tenantId: user.tenantId,
          status: { in: ['booked', 'active', 'overdue'] },
        },
      }),
    ]);

    const rentalBooked = await prisma.rentalAsset.count({
      where: { tenantId: user.tenantId, isActive: true, kind: 'rental', status: 'booked' },
    });

    return NextResponse.json({
      totalRentalAssets: rentalAssets,
      totalHiringAssets: hiringAssets,
      activeBookings: activeTx,
      rentalUnitsBooked: rentalBooked,
      rentalUnitsAvailable: Math.max(0, rentalAssets - rentalBooked),
    });
  } catch (e) {
    console.error('[rentals stats]', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
