import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { updateCustomerSignalState } from '@/lib/admin/customers';

/**
 * POST body: { action: 'acknowledge'|'dismiss', reason?: string }
 * Dismiss requires reason.
 */
export async function POST(request, context) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const signalId = params?.id ? String(params.id) : '';
    const body = await request.json().catch(() => ({}));
    const action = body.action || body.op || '';
    const reason = body.reason || '';

    const result = await updateCustomerSignalState(prisma, {
      admin,
      signalId,
      action,
      reason,
      now: new Date(),
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges', reason: result.reason },
        { status: 403 }
      );
    }
    if (result.notFound) {
      return NextResponse.json(
        { success: false, error: result.error || 'Signal not found' },
        { status: 404 }
      );
    }
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to update signal', ...result },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    try {
      await prisma.adminAuditLog.create({
        data: {
          adminId: admin.id,
          action: action === 'dismiss' ? 'CUSTOMER_SIGNAL_DISMISS' : 'CUSTOMER_SIGNAL_ACKNOWLEDGE',
          entityType: 'CUSTOMER_SIGNAL',
          entityId: signalId,
          details: JSON.stringify({
            reason: reason || null,
            ephemeral: Boolean(result.ephemeral),
            status: result.signal?.status || null,
          }),
        },
      });
    } catch {
      /* non-fatal */
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('customer signal action error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update customer signal' },
      { status: 500 }
    );
  }
}
