import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  decideApprovalStep,
  listCommercialApprovals,
  submitCommercialDocumentForApproval,
} from '@/lib/admin/crm';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const result = await listCommercialApprovals(prisma, {
      admin,
      actorContext: { admin },
      documentVersionId: searchParams.get('documentVersionId') || undefined,
      status: searchParams.get('status') || undefined,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to list approvals' },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({ success: true, approvals: result.approvals });
  } catch (error) {
    console.error('CRM commercial approvals list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list commercial approvals' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const action = String(body.action || 'submit').trim().toLowerCase();

    let result;
    if (action === 'decide') {
      result = await decideApprovalStep(prisma, {
        admin,
        actorContext: { admin },
        approvalStepId: body.approvalStepId,
        decision: body.decision,
        reason: body.reason,
      });
    } else {
      result = await submitCommercialDocumentForApproval(prisma, {
        admin,
        actorContext: { admin },
        commercialDocumentVersionId: body.commercialDocumentVersionId || body.documentVersionId,
        approvalPolicyVersionId: body.approvalPolicyVersionId || body.approvalPolicyId,
        idempotencyKey: body.idempotencyKey,
      });
    }

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges', reason: result.reason },
        { status: 403 }
      );
    }
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Approval action failed', reason: result.reason },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({ success: true, ...result }, { status: result.alreadyExists ? 200 : 201 });
  } catch (error) {
    console.error('CRM commercial approvals action error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed commercial approval action' },
      { status: 500 }
    );
  }
}
