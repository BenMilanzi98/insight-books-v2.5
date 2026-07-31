import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { requestEmailSend } from '@/lib/admin/crm';

export async function POST(request, context) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const body = await request.json().catch(() => ({}));
    const result = await requestEmailSend(prisma, {
      admin,
      emailActivityId: params.id,
      idempotencyKey: body.idempotencyKey,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges', reason: result.reason },
        { status: 403 }
      );
    }
    if (!result.ok && !result.sendRequest) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to request email send',
          email: result.email,
          smtpCalled: result.smtpCalled === true,
        },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({
      success: result.ok !== false || Boolean(result.alreadyExists),
      email: result.email,
      sendRequest: result.sendRequest,
      alreadyExists: result.alreadyExists,
      delivered: false,
      opens: null,
      replies: null,
      error: result.error,
    });
  } catch (error) {
    console.error('CRM email send error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send CRM email' },
      { status: 500 }
    );
  }
}
