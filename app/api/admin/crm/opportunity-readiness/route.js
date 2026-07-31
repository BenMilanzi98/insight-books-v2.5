import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { evaluateOpportunityReadiness } from '@/lib/admin/crm';

export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const result = await evaluateOpportunityReadiness(prisma, {
      admin,
      leadId: body.leadId,
      allowUnknownProductInterest: body.allowUnknownProductInterest === true,
      accountContactExceptionReason: body.accountContactExceptionReason || null,
      markReady: body.markReady === true,
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
      return NextResponse.json(
        { success: false, error: result.error || 'Readiness evaluation failed' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      readinessStatus: result.readinessStatus,
      checklist: result.checklist,
      handoffPayload: result.handoffPayload,
      opportunityCreated: false,
      leadStatus: result.leadStatus,
      transition: result.transition || null,
      meta: result.meta,
    });
  } catch (error) {
    console.error('CRM opportunity readiness error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to evaluate opportunity readiness' },
      { status: 500 }
    );
  }
}
