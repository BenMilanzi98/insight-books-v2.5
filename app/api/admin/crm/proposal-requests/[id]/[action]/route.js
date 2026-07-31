import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  convertProposalRequest,
  qualifyProposalRequest,
  rejectProposalRequest,
} from '@/lib/admin/crm';

const ACTIONS = new Set(['qualify', 'reject', 'convert']);

export async function POST(request, context) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const id = params?.id;
    const action = String(params?.action || '')
      .trim()
      .toLowerCase();
    if (!ACTIONS.has(action)) {
      return NextResponse.json(
        { success: false, error: 'Unsupported action' },
        { status: 404 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const actor = { admin, actorContext: { admin } };
    let result;
    if (action === 'qualify') {
      result = await qualifyProposalRequest(prisma, { ...actor, requestId: id });
    } else if (action === 'reject') {
      result = await rejectProposalRequest(prisma, {
        ...actor,
        requestId: id,
        reason: body.reason,
      });
    } else {
      result = await convertProposalRequest(prisma, {
        ...actor,
        requestId: id,
        createProposal: body.createProposal,
        createQuotation: body.createQuotation,
        title: body.title,
        ownerAdminId: body.ownerAdminId,
        idempotencyKey: body.idempotencyKey,
      });
    }

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges', reason: result.reason },
        { status: 403 }
      );
    }
    if (result.notFound) {
      return NextResponse.json(
        { success: false, error: result.error || 'Not found' },
        { status: 404 }
      );
    }
    if (!result.ok) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || `Failed to ${action} proposal request`,
          status: result.status,
        },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({
      success: true,
      request: result.request,
      proposal: result.proposal,
      quotation: result.quotation,
      alreadyExists: result.alreadyExists,
      alreadyQualified: result.alreadyQualified,
      alreadyRejected: result.alreadyRejected,
      opportunityMutated: false,
    });
  } catch (error) {
    console.error('CRM proposal-request action error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process proposal request action' },
      { status: 500 }
    );
  }
}
