import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { assignTicket } from '@/lib/admin/support';

export async function POST(request, context) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const body = await request.json().catch(() => ({}));
    const result = await assignTicket(prisma, {
      admin,
      ticketId: params?.id,
      assigneeAdminId: body.assigneeAdminId,
      queueCode: body.queueCode,
      reason: body.reason,
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
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to assign ticket', ...result },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({
      success: true,
      noop: Boolean(result.noop),
      ticket: result.ticket,
      assignmentHistory: result.assignmentHistory || null,
    });
  } catch (error) {
    console.error('Support ticket assign error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to assign support ticket' },
      { status: 500 }
    );
  }
}
