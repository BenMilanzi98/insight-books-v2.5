import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { listClocksForTicket } from '@/lib/admin/support';

export async function GET(request, context) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const result = await listClocksForTicket(prisma, {
      admin,
      ticketId: params?.id,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }
    if (result.notFound) {
      return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 });
    }
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to list SLA clocks' },
        { status: 400 }
      );
    }

    // UNAVAILABLE / NOT_AVAILABLE — never invent breach percentages
    return NextResponse.json({
      success: true,
      items: result.items,
      meta: result.meta,
      status: result.status || 'AVAILABLE',
    });
  } catch (error) {
    console.error('Support SLA clocks list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list SLA clocks', status: 'UNAVAILABLE' },
      { status: 500 }
    );
  }
}
