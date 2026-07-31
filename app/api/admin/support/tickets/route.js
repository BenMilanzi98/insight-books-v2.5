import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { createTicket, listTickets } from '@/lib/admin/support';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const myWorkRaw = searchParams.get('myWork');
    const myWork =
      myWorkRaw === '1' || String(myWorkRaw || '').toLowerCase() === 'true';
    const result = await listTickets(prisma, {
      admin,
      status: searchParams.get('status') || undefined,
      tenantId: searchParams.get('tenantId') || undefined,
      assigneeAdminId: searchParams.get('assigneeAdminId') || undefined,
      myWork: myWork || undefined,
      limit: searchParams.get('limit') || '50',
      offset: searchParams.get('offset') || undefined,
      cursor: searchParams.get('cursor') || undefined,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Support tickets list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list support tickets' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const result = await createTicket(prisma, {
      admin,
      tenantId: body.tenantId,
      title: body.title,
      description: body.description,
      type: body.type,
      impact: body.impact,
      urgency: body.urgency,
      priority: body.priority,
      severity: body.severity,
      portfolioId: body.portfolioId || null,
      assigneeAdminId: body.assigneeAdminId || null,
      queueCode: body.queueCode || null,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges', reason: result.reason },
        { status: 403 }
      );
    }

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to create ticket', ...result },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json(
      { success: true, ticket: result.ticket, ticketNumber: result.ticket?.ticketNumber },
      { status: 201 }
    );
  } catch (error) {
    console.error('Support tickets create error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create support ticket' },
      { status: 500 }
    );
  }
}
