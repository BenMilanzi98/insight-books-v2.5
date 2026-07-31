import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, hasPermission } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { sumBookedQuantityForWindow } from '@/lib/rentalAvailability';
import { isQuantityPoolKind } from '@/lib/rentalKinds';

export async function POST(request) {
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

    const body = await request.json().catch(() => ({}));
    const { rentalAssetId, startAt, endAt, quantity = 1, excludeTransactionId } = body;
    if (!rentalAssetId || !startAt || !endAt) {
      return NextResponse.json({ error: 'rentalAssetId, startAt, endAt required' }, { status: 400 });
    }

    const start = new Date(startAt);
    const end = new Date(endAt);
    if (!(end > start)) {
      return NextResponse.json({ error: 'Invalid date range' }, { status: 400 });
    }

    const asset = await prisma.rentalAsset.findFirst({
      where: { id: rentalAssetId, tenantId: user.tenantId, isActive: true },
    });
    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    const booked = await sumBookedQuantityForWindow(prisma, rentalAssetId, start, end, {
      excludeTransactionId,
    });
    const cap = Math.max(1, Math.floor(Number(asset.totalQuantity) || 1));
    const pool = isQuantityPoolKind(asset.kind);
    const requested = pool ? Math.max(1, Math.floor(Number(quantity) || 1)) : 1;

    let available = 0;
    let allowed = false;
    if (!pool) {
      available = booked > 0 ? 0 : 1;
      allowed = booked === 0;
    } else {
      available = Math.max(0, cap - booked);
      allowed = booked + requested <= cap;
    }

    return NextResponse.json({
      allowed,
      asset: { id: asset.id, name: asset.name, kind: asset.kind, totalQuantity: cap },
      bookedInWindow: booked,
      requested,
      availableUnits: available,
    });
  } catch (e) {
    console.error('[check-availability]', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
