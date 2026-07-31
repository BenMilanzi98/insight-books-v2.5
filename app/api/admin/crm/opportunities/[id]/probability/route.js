import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  getOpportunityProbability,
  overrideOpportunityProbability,
} from '@/lib/admin/crm';

export async function GET(request, context) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const result = await getOpportunityProbability(prisma, {
      admin,
      opportunityId: params?.id,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
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
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to get probability' },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({
      success: true,
      probability: result.probability,
      history: result.history,
    });
  } catch (error) {
    console.error('CRM opportunity probability GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get opportunity probability' },
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

    const result = await overrideOpportunityProbability(prisma, {
      admin,
      opportunityId: params?.id,
      probability: body.probability,
      reason: body.reason,
      confidence: body.confidence,
      approvalStatus: body.approvalStatus,
      requireApproval: body.requireApproval,
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
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to override probability', ...result },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({
      success: true,
      opportunity: result.opportunity,
      historyId: result.historyId,
      probability: result.probability,
      source: result.source,
      confidence: result.confidence,
      approvalStub: result.approvalStub,
      isMl: false,
      isRevenueCertainty: false,
    });
  } catch (error) {
    console.error('CRM opportunity probability POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to override opportunity probability' },
      { status: 500 }
    );
  }
}
