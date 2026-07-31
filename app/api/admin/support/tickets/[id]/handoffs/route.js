import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { createSupportHandoff, listSupportHandoffs } from '@/lib/admin/support';

export async function GET(request, context) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const { searchParams } = new URL(request.url);
    const result = await listSupportHandoffs(prisma, {
      admin,
      ticketId: params?.id,
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
    console.error('Support handoffs list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list support handoffs' },
      { status: 500 }
    );
  }
}

export async function POST(request, context) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const body = await request.json().catch(() => ({}));
    const result = await createSupportHandoff(prisma, {
      admin,
      ticketId: params?.id,
      targetType: body.targetType,
      summary: body.summary,
      // Keep typed Finance/Billing ids distinct — do not collapse subscriptionId into invoiceId/targetRefId.
      targetRefId: body.targetRefId || body.csCaseId || undefined,
      invoiceId: body.invoiceId || undefined,
      subscriptionId: body.subscriptionId || undefined,
      featureCode: body.featureCode,
      payload: body.payload,
      status: body.status,
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
        { success: false, error: result.error || 'Failed to create handoff', ...result },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error) {
    console.error('Support handoff create error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create support handoff' },
      { status: 500 }
    );
  }
}
