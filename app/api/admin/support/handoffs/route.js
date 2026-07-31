import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { listSupportHandoffs } from '@/lib/admin/support';

/** Global handoffs list for Support UI (ticket-scoped create remains under tickets/[id]/handoffs). */
export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const result = await listSupportHandoffs(prisma, {
      admin,
      ticketId: searchParams.get('ticketId') || undefined,
      targetType: searchParams.get('targetType') || undefined,
      status: searchParams.get('status') || undefined,
      limit: searchParams.get('limit') || '50',
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

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Support handoffs global list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list support handoffs' },
      { status: 500 }
    );
  }
}
