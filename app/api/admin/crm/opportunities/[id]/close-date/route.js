import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  getOpportunityCloseDate,
  setOpportunityCloseDate,
} from '@/lib/admin/crm';

export async function GET(request, context) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const result = await getOpportunityCloseDate(prisma, {
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
        { success: false, error: result.error || 'Failed to get close date' },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({
      success: true,
      closeDate: result.closeDate,
      history: result.history,
    });
  } catch (error) {
    console.error('CRM opportunity close-date GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get opportunity close date' },
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

    const result = await setOpportunityCloseDate(prisma, {
      admin,
      opportunityId: params?.id,
      expectedCloseDate: body.expectedCloseDate,
      source: body.source,
      confidence: body.confidence,
      reason: body.reason,
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
        { success: false, error: result.error || 'Failed to set close date', ...result },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({
      success: true,
      opportunity: result.opportunity,
      historyId: result.historyId,
      expectedCloseDate: result.expectedCloseDate,
      source: result.source,
      confidence: result.confidence,
      forecastEligible: result.forecastEligible,
      invented: false,
    });
  } catch (error) {
    console.error('CRM opportunity close-date POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to set opportunity close date' },
      { status: 500 }
    );
  }
}
