import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { transitionActivityStatus } from '@/lib/admin/crm';

export async function POST(request, context) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const body = await request.json().catch(() => ({}));
    const result = await transitionActivityStatus(prisma, {
      admin,
      activityId: params?.id,
      toStatus: body.toStatus || body.status,
      reason: body.reason,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges', reason: result.reason },
        { status: 403 }
      );
    }
    if (result.notFound) {
      return NextResponse.json({ success: false, error: 'Activity not found' }, { status: 404 });
    }
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to transition activity' },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({
      success: true,
      activity: result.activity,
      alreadyInStatus: Boolean(result.alreadyInStatus),
    });
  } catch (error) {
    console.error('CRM activity status error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to transition CRM activity' },
      { status: 500 }
    );
  }
}
