import { NextResponse } from 'next/server';
import { getUserFromSession, requireAnyPermission } from '@/lib/auth';
import { getQuotation, transitionQuotation } from '@/lib/rentalV2/quotationService';
import { createReservation } from '@/lib/rentalV2/reservationService';

export async function POST(request, { params }) {
  try {
    const perm = await requireAnyPermission(request, ['rentals.create', 'rentals.update']);
    if (perm) return perm;
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const { id, action } = await params;
    const body = await request.json().catch(() => ({}));
    const cmd = String(action || '').toLowerCase();

    if (['send', 'accept', 'reject', 'expire'].includes(cmd)) {
      const quotation = await transitionQuotation({
        tenantId: user.tenantId,
        quotationId: id,
        command: cmd,
      });
      return NextResponse.json({ quotation });
    }

    if (cmd === 'reserve') {
      let q = await getQuotation({ tenantId: user.tenantId, quotationId: id });
      if (['DRAFT', 'SENT'].includes(q.status)) {
        q = await transitionQuotation({
          tenantId: user.tenantId,
          quotationId: id,
          command: 'accept',
        });
      }
      const reservation = await createReservation({
        tenantId: user.tenantId,
        userId: user.id,
        clientId: q.clientId,
        quotationId: id,
        startAt: body.startAt || q.startAt,
        endAt: body.endAt || q.endAt,
        holdUntil: body.holdUntil,
        notes: body.notes,
      });
      return NextResponse.json({ reservation });
    }

    return NextResponse.json({ error: `Unknown action "${action}"` }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 400 });
  }
}
