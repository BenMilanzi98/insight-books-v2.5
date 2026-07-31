import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { transitionLeadStatus } from '@/lib/admin/crm';

export async function POST(request, context) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const body = await request.json().catch(() => ({}));
    const result = await transitionLeadStatus(prisma, {
      admin,
      leadId: params?.id,
      toStatus: body.toStatus,
      reason: body.reason,
      disqualificationReason: body.disqualificationReason,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges', reason: result.reason },
        { status: 403 }
      );
    }
    if (result.notFound) {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 });
    }
    if (!result.ok) {
      const status =
        result.error === 'INVALID_TRANSITION' || result.error === 'NOT_IMPLEMENTED'
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

    return NextResponse.json({ success: true, lead: result.lead });
  } catch (error) {
    console.error('CRM lead status transition error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to transition CRM lead status' },
      { status: 500 }
    );
  }
}