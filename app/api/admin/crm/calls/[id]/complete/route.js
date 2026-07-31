import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { completeCall } from '@/lib/admin/crm';

export async function POST(request, context) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const body = await request.json().catch(() => ({}));
    const result = await completeCall(prisma, {
      admin,
      callId: params.id,
      outcome: body.outcome,
      completedAt: body.completedAt,
      notes: body.notes,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges', reason: result.reason },
        { status: 403 }
      );
    }
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to complete call', call: result.call },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({
      success: true,
      call: result.call,
      alreadyCompleted: result.alreadyCompleted,
      telephony: result.telephony,
    });
  } catch (error) {
    console.error('CRM call complete error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to complete CRM call' },
      { status: 500 }
    );
  }
}
