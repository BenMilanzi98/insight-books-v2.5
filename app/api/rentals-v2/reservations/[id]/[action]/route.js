import { NextResponse } from 'next/server';
import { getUserFromSession, requireAnyPermission } from '@/lib/auth';
import {
  convertReservationToContract,
  releaseReservation,
} from '@/lib/rentalV2/reservationService';

export async function POST(request, { params }) {
  try {
    const perm = await requireAnyPermission(request, ['rentals.create', 'rentals.update']);
    if (perm) return perm;
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const { id, action } = await params;
    const cmd = String(action || '').toLowerCase();

    if (cmd === 'release') {
      const reservation = await releaseReservation({
        tenantId: user.tenantId,
        reservationId: id,
      });
      return NextResponse.json({ reservation });
    }

    if (cmd === 'convert') {
      const contract = await convertReservationToContract({
        tenantId: user.tenantId,
        userId: user.id,
        reservationId: id,
      });
      return NextResponse.json({ contract });
    }

    return NextResponse.json({ error: `Unknown action "${action}"` }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 400 });
  }
}
