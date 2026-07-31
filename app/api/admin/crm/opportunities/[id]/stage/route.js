import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { transitionOpportunityStage } from '@/lib/admin/crm';

export async function POST(request, context) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const id = params?.id;
    const body = await request.json().catch(() => ({}));

    const result = await transitionOpportunityStage({
      prisma,
      admin,
      opportunityId: id,
      toStageCode: body.toStageCode,
      reason: body.reason,
      evidenceReferences: body.evidence ?? body.evidenceReferences,
      idempotencyKey: body.idempotencyKey,
      expectedVersion: body.expectedVersion ?? body.version,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges', reason: result.reason },
        { status: 403 }
      );
    }

    if (result.notFound) {
      return NextResponse.json(
        { success: false, error: 'Opportunity not found' },
        { status: 404 }
      );
    }

    if (!result.ok) {
      const status =
        result.error === 'INVALID_TRANSITION'
          ? 409
          : result.error === 'OPTIMISTIC_LOCK_CONFLICT'
            ? 409
            : result.status === 'UNAVAILABLE'
              ? 503
              : 400;
      return NextResponse.json(
        { success: false, error: result.error || 'Stage transition failed', ...result },
        { status }
      );
    }

    return NextResponse.json({
      success: true,
      opportunity: result.opportunity,
      idempotent: Boolean(result.idempotent),
      fromStageCode: result.fromStageCode,
      toStageCode: result.toStageCode,
      historyId: result.historyId,
    });
  } catch (error) {
    console.error('CRM opportunity stage transition error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to transition opportunity stage' },
      { status: 500 }
    );
  }
}
