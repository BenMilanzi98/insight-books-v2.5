import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { transitionTicketStatus } from '@/lib/admin/support';

export async function POST(request, context) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const body = await request.json().catch(() => ({}));
    const result = await transitionTicketStatus(prisma, {
      admin,
      ticketId: params?.id,
      toStatus: body.toStatus,
      reason: body.reason,
      resolutionCategory: body.resolutionCategory,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges', reason: result.reason },
        { status: 403 }
      );
    }
    if (result.notFound) {
      return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 });
    }
    if (!result.ok) {
      const status =
        result.error === 'INVALID_TRANSITION'
          ? 400
          : result.status === 'UNAVAILABLE'
            ? 503
            : 400;
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to transition status',
          ...result,
        },
        { status }
      );
    }

    return NextResponse.json({ success: true, ticket: result.ticket });
  } catch (error) {
    console.error('Support ticket status transition error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to transition support ticket status' },
      { status: 500 }
    );
  }
}
