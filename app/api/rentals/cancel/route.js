import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, hasPermission } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { reverseRentalBooking } from '@/lib/rentalReverseService';

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
    const { transactionId, reason } = body;
    if (!transactionId) {
      return NextResponse.json({ error: 'transactionId is required' }, { status: 400 });
    }

    const result = await reverseRentalBooking({
      prisma,
      tenantId: user.tenantId,
      userId: user.id,
      transactionId,
      reason: reason?.trim() || 'Rental booking reversed',
    });
    if (result.ok) return NextResponse.json(result);

    const statusByCode = {
      NOT_FOUND: 404,
      NEED_CREDIT_REFUND: 409,
      CLOSED: 400,
    };
    return NextResponse.json(result, { status: statusByCode[result.code] || 500 });
  } catch (e) {
    console.error('[rentals cancel]', e);
    return NextResponse.json({ error: 'Failed to cancel' }, { status: 500 });
  }
}
