import { NextResponse } from 'next/server';
import { getUserFromSession, requireAnyPermission } from '@/lib/auth';
import { createReservation, listReservations } from '@/lib/rentalV2/reservationService';

export async function GET(request) {
  try {
    const perm = await requireAnyPermission(request, ['rentals.view']);
    if (perm) return perm;
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const reservations = await listReservations({
      tenantId: user.tenantId,
      status: searchParams.get('status') || undefined,
      clientId: searchParams.get('clientId') || undefined,
    });
    return NextResponse.json({ reservations });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const perm = await requireAnyPermission(request, ['rentals.create', 'rentals.update']);
    if (perm) return perm;
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const reservation = await createReservation({
      tenantId: user.tenantId,
      userId: user.id,
      ...body,
    });
    return NextResponse.json({ reservation }, { status: 201 });
  } catch (e) {
    const status = e.code === 'DOUBLE_BOOK' || e.code === 'OVERBOOK_QTY' ? 409 : 400;
    return NextResponse.json({ error: e.message || 'Failed' }, { status });
  }
}
