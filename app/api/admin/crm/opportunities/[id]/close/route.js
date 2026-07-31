import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { closeOpportunityLost, closeOpportunityWon, reopenOpportunity } from '@/lib/admin/crm';

export async function POST(request, context) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const id = params?.id;
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || body.outcome || '').trim().toUpperCase();

    let result;
    if (action === 'WON' || action === 'CLOSED_WON') {
      result = await closeOpportunityWon(prisma, {
        admin,
        opportunityId: id,
        winReason: body.winReason,
        decisionDate: body.decisionDate,
        evidence: body.evidence ?? body.evidenceReferences,
        reason: body.reason,
        idempotencyKey: body.idempotencyKey,
        expectedVersion: body.expectedVersion ?? body.version,
        requireApproval: body.requireApproval,
        approvalGranted: body.approvalGranted,
      });
    } else if (action === 'LOST' || action === 'CLOSED_LOST') {
      result = await closeOpportunityLost(prisma, {
        admin,
        opportunityId: id,
        lossReason: body.lossReason,
        decisionDate: body.decisionDate,
        evidence: body.evidence ?? body.evidenceReferences,
        reason: body.reason,
        idempotencyKey: body.idempotencyKey,
        expectedVersion: body.expectedVersion ?? body.version,
      });
    } else if (action === 'REOPEN') {
      result = await reopenOpportunity(prisma, {
        admin,
        opportunityId: id,
        reopenReason: body.reopenReason || body.reason,
        toStageCode: body.toStageCode,
        idempotencyKey: body.idempotencyKey,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'action_required',
          hint: 'action must be WON | LOST | REOPEN',
        },
        { status: 400 }
      );
    }

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
        { success: false, error: result.error || 'Close failed', ...result },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      opportunity: result.opportunity,
      tenantCreated: false,
      subscriptionCreated: false,
      invoiceCreated: false,
      paymentCreated: false,
      provisionExecuted: false,
      ...result,
    });
  } catch (error) {
    console.error('CRM opportunity close error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to close opportunity' },
      { status: 500 }
    );
  }
}
